import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import Stripe from "npm:stripe@14.14.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function cors(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // Handle CORS preflight — the browser sends OPTIONS before POSTing from
  // the Payment Audit "Sync from Stripe" button. Without this, the browser
  // blocks the cross-origin request and the fetch rejects as "Failed to fetch".
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseKey) {
      return cors({ error: "Missing Supabase configuration" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // syncOnly mode: skip the scheduler/notification delegation and ONLY
    // recompute paid_amount + refunded_amount from Stripe. Used by the
    // "Sync from Stripe" button on the Payment Audit page so staff can force
    // a recompute after refunds without firing any notifications.
    let syncOnly = false;
    try {
      const body = await req.json();
      syncOnly = !!body?.syncOnly;
    } catch {
      // No body or invalid JSON — normal cron invocation.
    }

    // Fetch portal settings
    const { data: settings, error: settingsError } = await supabase
      .from("portal_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError || !settings) {
      return cors({ error: "Failed to fetch settings" }, 500);
    }

    // The scheduler worker is now the primary notification engine. This
    // function is kept for backward compatibility (old cron schedules) but
    // no longer gates on "hour === 9" — it delegates to the scheduler worker,
    // which is idempotent via dedupe_key and processes due jobs regardless
    // of the current hour.
    //
    // In syncOnly mode we skip the delegation entirely (no notifications).

    // Stripe paid-amount sync (read-only — no charging). Subscriptions and
    // deposits are charged by Stripe at booking; all other payments are manual
    // via Payment Audit. The scheduler sends a daily "payments due" push alert.
    let sentCount = 0;
    if (!syncOnly) {
      try {
        const schedulerRes = await fetch(`${supabaseUrl}/functions/v1/scheduler`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey },
          body: JSON.stringify({ source: "daily-reminders" }),
        });
        if (schedulerRes.ok) {
          const data = await schedulerRes.json();
          sentCount = data.sent || 0;
        }
      } catch (e) {
        console.warn("scheduler delegate failed:", e);
      }
    }

    // Auto-Sync Stripe Paid Amounts (read-only — no charging).
    const { data: allStripeWeddings } = await supabase
      .from("weddings")
      .select("*")
      .neq("status", "cancelled");

    // Per-wedding diagnostic log so the UI can show EXACTLY what the sync did
    // (or didn't do) for each wedding. This is the key fix: previously the
    // sync swallowed all errors silently and returned a generic "Synced"
    // message even when nothing updated. Now we report per-wedding outcomes.
    const syncLog: any[] = [];
    let totalGrossCents = 0;
    let totalRefundedCents = 0;
    let weddingsUpdated = 0;
    let weddingsSkipped = 0;
    let weddingsErrored = 0;
    let stripeKeyMissing = false;

    if (allStripeWeddings) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      if (!stripeKey) {
        stripeKeyMissing = true;
        console.error("[SYNC] STRIPE_SECRET_KEY env var is missing — cannot sync paid amounts.");
      }
      const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2023-10-16" }) : null;

      for (const wedding of allStripeWeddings) {
        const entry: any = {
          wedding_id: wedding.id,
          client_name: wedding.client_name || "Unknown",
          client_email: wedding.client_email || "",
          status: wedding.status,
          old_paid_amount: Number(wedding.paid_amount || 0),
          old_refunded_amount: Number(wedding.refunded_amount || 0),
          new_paid_amount: null,
          new_refunded_amount: null,
          updated: false,
          skipped_reason: null,
          error: null,
        };

        if (!stripe) {
          entry.error = "Stripe key not configured";
          weddingsErrored++;
          syncLog.push(entry);
          continue;
        }

        if (!wedding.stripe_customer_id && !wedding.client_email) {
          entry.skipped_reason = "No stripe_customer_id or client_email";
          weddingsSkipped++;
          syncLog.push(entry);
          continue;
        }

        try {
          let customerId = wedding.stripe_customer_id;
          if (!customerId && wedding.client_email) {
            const searchRes = await stripe.customers.list({ email: wedding.client_email.trim(), limit: 1 });
            if (searchRes.data.length > 0) {
              customerId = searchRes.data[0].id;
              await supabase.from("weddings").update({ stripe_customer_id: customerId }).eq("id", wedding.id);
            }
          }

          if (!customerId) {
            entry.skipped_reason = "No Stripe customer found for this wedding";
            weddingsSkipped++;
            syncLog.push(entry);
            continue;
          }

          const charges = await stripe.charges.list({ customer: customerId, limit: 100 });
          // Only SUCCEEDED charges count as paid. Refunds are tracked
          // separately so the UI can show them without inflating paid_amount.
          // paid_amount  = gross succeeded (NOT reduced by refunds)
          // refunded_amount = sum of amount_refunded on succeeded charges
          // The UI/net balance = paid_amount - refunded_amount.
          const succeeded = charges.data.filter((c: any) => c.paid && c.status === "succeeded");
          // NET paid = money actually kept. A refunded charge keeps
          // status "succeeded" but has amount_refunded > 0, so we
          // subtract it here. This is the SAME formula the webhook uses
          // on charge.refunded, so the two systems never fight over
          // paid_amount (which previously re-inflated refunded charges
          // or over-deducted legitimate deposits).
          const netPaidCents = succeeded.reduce((sum: number, c: any) => sum + ((c.amount || 0) - (c.amount_refunded || 0)), 0);
          const refundedCents = succeeded.reduce((sum: number, c: any) => sum + (c.amount_refunded || 0), 0);
          totalGrossCents += succeeded.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
          totalRefundedCents += refundedCents;
          // Manual "Mark Unpaid" adjustments reduce the effective paid total
          // (so they stick) — refunds are already netted out above.
          let manualTotal = 0;
          try {
            const { data: manual } = await supabase.from("payment_refunds")
              .select("amount").eq("wedding_id", wedding.id).eq("reason", "manual_unpaid");
            manualTotal = (manual || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
          } catch {}
          const totalPaidDollars = Math.max(0, (netPaidCents / 100) - manualTotal);
          const refundedDollars = refundedCents / 100;

          entry.new_paid_amount = totalPaidDollars;
          entry.new_refunded_amount = refundedDollars;
          entry.charge_count = succeeded.length;

          const up: any = { paid_amount: totalPaidDollars, refunded_amount: refundedDollars };
          if (Math.abs((wedding.paid_amount || 0) - totalPaidDollars) > 0.01 ||
              Math.abs((wedding.refunded_amount || 0) - refundedDollars) > 0.01) {
            await supabase.from("weddings").update(up).eq("id", wedding.id);
            entry.updated = true;
            weddingsUpdated++;
            console.log(`Synced ${wedding.client_name}: paid $${totalPaidDollars} (net), refunded $${refundedDollars}`);
          } else {
            entry.skipped_reason = "Already up to date";
            weddingsSkipped++;
          }

          // Backfill payment_refunds log for any refunded charges not yet
          // recorded, so the webhook idempotency check has a baseline and
          // future refund events don't double-deduct.
          for (const c of succeeded) {
            if ((c.amount_refunded || 0) > 0) {
              const chargeId = typeof c.id === "string" ? c.id : "";
              if (!chargeId) continue;
              const { data: existing } = await supabase.from("payment_refunds").select("id").eq("stripe_charge_id", chargeId).maybeSingle();
              if (!existing) {
                await supabase.from("payment_refunds").insert({
                  wedding_id: wedding.id, stripe_charge_id: chargeId,
                  amount: (c.amount_refunded || 0) / 100, reason: "backfill",
                }).then(() => {}).catch(() => {});
              }
            }
          }
        } catch (syncErr: any) {
          entry.error = syncErr?.message || String(syncErr);
          weddingsErrored++;
          console.error(`Failed to auto-sync Stripe charges for ${wedding.client_name}:`, syncErr);
        }

        syncLog.push(entry);

        // No automatic charging here. Subscriptions/deposits are handled by
        // Stripe at booking; all other payments are manual via Payment Audit.
        // The scheduler worker sends a daily "payments due" push alert instead.
      }
    }

    const summary = {
      total_weddings: allStripeWeddings?.length || 0,
      weddings_updated: weddingsUpdated,
      weddings_skipped: weddingsSkipped,
      weddings_errored: weddingsErrored,
      stripe_key_missing: stripeKeyMissing,
      total_gross_collected: totalGrossCents / 100,
      total_refunded: totalRefundedCents / 100,
      total_net_collected: (totalGrossCents - totalRefundedCents) / 100,
    };

    const msg = syncOnly
      ? `Synced Stripe paid amounts (syncOnly). Updated ${weddingsUpdated}, skipped ${weddingsSkipped}, errored ${weddingsErrored}. No notifications sent. No auto-charging.`
      : `Sent ${sentCount} reminders, synced Stripe paid amounts. Updated ${weddingsUpdated}. No auto-charging.`;
    return cors({ message: msg, syncOnly, summary, log: syncLog });
  } catch (err: any) {
    return cors({ error: err.message }, 500);
  }
});
