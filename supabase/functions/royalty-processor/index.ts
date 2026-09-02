// Royalty & Territory Payback Processor
// Runs weekly: calculates gross sales per territory, computes royalty + payback,
// and charges the territory owner via Stripe (ACH preferred, card fallback).
// Idempotent: safe to re-run — skips periods already calculated.
// On paid / charge-failed / no-payment-method it fires an instant push to
// owners + super admins via the send-push edge function (royalty_finance category).

import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "jsr:@supabase/supabase-js";
// ─── Inlined from _royalty-lib.ts (deploy only uploads index.ts) ───
const SELF_PROJECT_REF = Deno.env.get("PROJECT_REF") || "oosmhtzqdmntlzhheofw";
async function getOwnTerritory(supabase: any): Promise<any | null> {
  const { data: selfRow } = await supabase.from("territories").select("*").eq("project_ref", SELF_PROJECT_REF).limit(1).maybeSingle();
  if (selfRow) return selfRow;
  const { data: primRow } = await supabase.from("territories").select("*").eq("is_primary", true).limit(1).maybeSingle();
  return primRow || null;
}
async function persistPaymentMethod(supabase: any, stripe: any, territory: any, pmId: string): Promise<{ payment_method_id: string }> {
  if (!pmId || !pmId.startsWith("pm_")) throw new Error("Invalid payment method id");
  let customerId = territory.stripe_customer_id;
  if (!customerId) { const c = await stripe.customers.create({ name: territory.name || "Royalty Territory", metadata: { territory_id: territory.id, project_ref: SELF_PROJECT_REF } }); customerId = c.id; }
  try { await stripe.paymentMethods.attach(pmId, { customer: customerId }); } catch (e: any) { const m = (e?.message || "").toLowerCase(); if (!m.includes("already attached") && !m.includes("is already attached")) throw new Error(`Attach payment method failed: ${e?.message || e}`); }
  try { await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } }); } catch (_) {}
  const { data: updated, error: updErr } = await supabase.from("territories").update({ primary_payment_method_id: pmId, stripe_payment_method_id: pmId, stripe_customer_id: customerId, stripe_royalty_configured: true, stripe_connected: true }).eq("id", territory.id).select("id").maybeSingle();
  if (updErr) throw new Error(`Territory payment method save failed: ${updErr.message}`);
  if (!updated) throw new Error("Bank authorized in Stripe, but it was not saved to the territory. Do not close this dialog.");
  return { payment_method_id: pmId };
}
function portalNow(tz: string): { dow: number; hhmm: string } {
  try { const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit" }); const p: any = {}; for (const x of dtf.formatToParts(new Date())) p[x.type] = x.value; const dm: any = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }; const hh = p.hour === "24" ? "00" : p.hour || "00"; return { dow: dm[p.weekday] ?? 5, hhmm: `${hh.padStart(2, "0")}:${(p.minute || "00").padStart(2, "0")}` }; } catch { return { dow: 5, hhmm: "02:00" }; }
}
async function pushRoyaltyAlert(type: string, territory: any, amount: number, errorMsg: string | null, newBalance: number | null): Promise<void> {
  let title = "", body = "";
  if (type === "paid") { title = "Royalty Collected"; body = `$${amount.toFixed(2)} collected from ${territory.name}`; if (newBalance !== null) body += newBalance === 0 ? " · Payback complete!" : ` · Remaining $${newBalance.toFixed(2)}`; }
  else if (type === "failed") { const noPm = /no valid payment method|payment method/i.test(errorMsg || ""); title = noPm ? "Royalty Payment Method Missing" : "Royalty Charge Failed"; body = `$${amount.toFixed(2)} for ${territory.name}${errorMsg ? " — " + errorMsg : ""}`; }
  if (!title) return;
  try { await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "" }, body: JSON.stringify({ action: "send", roles: ["owner", "super_admin"], category: "royalty_finance", title, body, url: "/manager/royalty", tag: `royalty-${type}-${territory.id}` }) }); } catch (e) { console.warn("[Royalty] push failed:", (e as any)?.message); }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Self-heal royalty schema so stale territories don't break reads/writes.
  const HEAL_SQL = [
    `CREATE TABLE IF NOT EXISTS public.royalty_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), processing_day_of_week INTEGER DEFAULT 5, processing_time TEXT DEFAULT '02:00', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`,
    `ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_publishable_key TEXT`,
    `ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_configured BOOLEAN DEFAULT false`,
    `ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_webhook_secret TEXT`,
    `CREATE TABLE IF NOT EXISTS public.royalty_secrets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stripe_secret_key TEXT, stripe_webhook_secret TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`,
    `ALTER TABLE public.royalty_secrets ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE public.royalty_sales ADD COLUMN IF NOT EXISTS processed_period_id UUID REFERENCES public.royalty_periods(id) ON DELETE SET NULL`,
    `ALTER TABLE public.royalty_sales ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_royalty_sales_unprocessed ON public.royalty_sales(territory_id) WHERE processed_period_id IS NULL`,
    // Hard safeguard: one period per territory per week — prevents double charge.
    `CREATE UNIQUE INDEX IF NOT EXISTS royalty_periods_unique_period ON public.royalty_periods (territory_id, period_start, period_end)`,
    // Deduplicate royalty_settings: delete empty clone rows so .limit(1) reads
    // can't accidentally return an unconfigured row instead of the real one.
    `DELETE FROM public.royalty_settings WHERE stripe_royalty_configured = true AND id NOT IN (SELECT id FROM public.royalty_settings WHERE stripe_royalty_configured = true ORDER BY created_at ASC LIMIT 1)`,
    `DELETE FROM public.royalty_settings WHERE stripe_royalty_configured IS NULL OR stripe_royalty_configured = false`,
  ];
  for (const stmt of HEAL_SQL) { try { await supabase.rpc("exec_sql", { sql_text: stmt }); } catch (_) {} }

  const { data: royaltySettingsRow } = await supabase
    .from("royalty_settings")
    .select("stripe_royalty_publishable_key, stripe_royalty_configured")
    .order("stripe_royalty_configured", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();
  const royaltyPublishableKey = royaltySettingsRow?.stripe_royalty_publishable_key || null;
  const { data: royaltySecretsRow } = await supabase
    .from("royalty_secrets")
    .select("stripe_secret_key, stripe_webhook_secret")
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();
  const stripeKey = royaltySecretsRow?.stripe_secret_key || Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = royaltySecretsRow?.stripe_webhook_secret || Deno.env.get("STRIPE_ROYALTY_WEBHOOK_SECRET");

  try {
    // ─── Stripe webhook fallback (royalty account) ───
    // If the browser tab dies after Stripe confirms a SetupIntent, this
    // upserts primary_payment_method_id onto the matching territory.
    const stripeSig = req.headers.get("stripe-signature");
    if (stripeSig && stripeKey && webhookSecret) {
      const stripeForWh = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
      try {
        const rawBody = await req.text();
        const event = await stripeForWh.webhooks.constructEventAsync(rawBody, stripeSig, webhookSecret);
        if (["setup_intent.succeeded", "payment_method.attached"].includes(event.type)) {
          let pmId: string | null = null, customerId: string | null = null;
          if (event.type === "setup_intent.succeeded") { const si = event.data.object; pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id || null; customerId = typeof si.customer === "string" ? si.customer : null; }
          else if (event.type === "payment_method.attached") { const pm = event.data.object; pmId = pm.id; customerId = typeof pm.customer === "string" ? pm.customer : null; }
          if (pmId && customerId) { const { data: terr } = await supabase.from("territories").select("id").eq("stripe_customer_id", customerId).maybeSingle(); if (terr?.id) await supabase.from("territories").update({ primary_payment_method_id: pmId, stripe_payment_method_id: pmId, stripe_royalty_configured: true, stripe_connected: true }).eq("id", terr.id); }
          return jsonResponse({ received: true, persisted: pmId });
        }
      } catch (whErr: any) { return jsonResponse({ error: `Webhook failed: ${whErr.message}` }, 400); }
    }

    let body: any = {};
    try { body = await req.json(); } catch (_) {}

    // Save the separate HQ royalty Stripe account keys (Super Admin only).
    if (body.action === "set_royalty_keys") {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace("Bearer ", "");
      if (jwt && jwt.startsWith("eyJ")) {
        const { data: authUser } = await supabase.auth.getUser(jwt);
        if (authUser?.user) {
          const { data: mgr } = await supabase.from("managers").select("role").eq("id", authUser.user.id).maybeSingle();
          if (!mgr || mgr.role !== "super_admin") return jsonResponse({ error: "Forbidden: Super Admin only" }, 403);
        }
      }
      const secretUpdates: any = {};
      if (typeof body.secret_key === "string" && body.secret_key.trim()) secretUpdates.stripe_secret_key = body.secret_key.trim();
      if (typeof body.webhook_secret === "string" && body.webhook_secret.trim()) secretUpdates.stripe_webhook_secret = body.webhook_secret.trim();
      const settingsUpdates: any = { stripe_royalty_configured: true, stripe_connected: true, updated_at: new Date().toISOString() };
      if (typeof body.publishable_key === "string" && body.publishable_key.trim()) settingsUpdates.stripe_royalty_publishable_key = body.publishable_key.trim();

      const finalSecret = secretUpdates.stripe_secret_key || royaltySecretsRow?.stripe_secret_key;
      const finalPublishable = settingsUpdates.stripe_royalty_publishable_key || royaltyPublishableKey;
      if (finalSecret && finalPublishable) {
        const secretIsTest = String(finalSecret).startsWith("sk_test_");
        const pkIsTest = String(finalPublishable).startsWith("pk_test_");
        if (secretIsTest !== pkIsTest) {
          return jsonResponse({ error: `Key mode mismatch: your secret key is ${secretIsTest ? "TEST" : "LIVE"} but your publishable key is ${pkIsTest ? "TEST" : "LIVE"}. Both keys must be from the same Stripe account and same mode.` }, 400);
        }
      }
      if (Object.keys(secretUpdates).length === 0 && Object.keys(settingsUpdates).length === 1) {
        return jsonResponse({ error: "No keys provided" }, 400);
      }

      const { data: existingSecret, error: secSelErr } = await supabase.from("royalty_secrets").select("id").limit(1).maybeSingle();
      if (secSelErr) return jsonResponse({ error: `royalty_secrets read failed: ${secSelErr.message}` }, 500);
      if (existingSecret?.id) {
        const { error: updErr } = await supabase.from("royalty_secrets").update({ ...secretUpdates, updated_at: new Date().toISOString() }).eq("id", existingSecret.id);
        if (updErr) return jsonResponse({ error: `royalty_secrets update failed: ${updErr.message}` }, 500);
      } else if (Object.keys(secretUpdates).length > 0) {
        const { error: insErr } = await supabase.from("royalty_secrets").insert(secretUpdates);
        if (insErr) return jsonResponse({ error: `royalty_secrets insert failed: ${insErr.message}` }, 500);
      }

      const { data: existingSettings, error: setSelErr } = await supabase.from("royalty_settings").select("id").limit(1).maybeSingle();
      if (setSelErr) return jsonResponse({ error: `royalty_settings read failed: ${setSelErr.message}` }, 500);
      if (existingSettings?.id) {
        const { error: updErr } = await supabase.from("royalty_settings").update(settingsUpdates).eq("id", existingSettings.id);
        if (updErr) return jsonResponse({ error: `royalty_settings update failed: ${updErr.message}` }, 500);
      } else {
        const { error: insErr } = await supabase.from("royalty_settings").insert(settingsUpdates);
        if (insErr) return jsonResponse({ error: `royalty_settings insert failed: ${insErr.message}` }, 500);
      }

      try {
        const terrRow = await getOwnTerritory(supabase);
        if (terrRow?.id) {
          await supabase.from("territories").update({ stripe_royalty_configured: true, stripe_connected: true }).eq("id", terrRow.id);
        }
      } catch (e) { console.warn("[royalty-processor] territory flag sync failed:", (e as any)?.message); }

      let accountInfo: any = null;
      try {
        const verifyKey = secretUpdates.stripe_secret_key || royaltySecretsRow?.stripe_secret_key;
        if (verifyKey) {
          const res = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${verifyKey}` } });
          if (res.ok) {
            const acct = await res.json();
            accountInfo = { id: acct.id, businessName: acct.business_profile?.name || null, email: acct.email || null, country: acct.country || null, isTest: String(verifyKey).startsWith("sk_test_") };
          }
        }
      } catch (_) {}
      return jsonResponse({ success: true, account: accountInfo });
    }

    // Return the royalty publishable key so the frontend can init Stripe Elements.
    if (body.action === "get_publishable_key") {
      if (!royaltyPublishableKey) return jsonResponse({ error: "Royalty Stripe account not configured. Super Admin must add the royalty publishable + secret keys." }, 400);
      return jsonResponse({ publishable_key: royaltyPublishableKey });
    }

    // Sync payment methods from Stripe to database.
    if (body.action === "sync_payment_method" || body.action === "sync_customer") {
      if (!stripeKey) return jsonResponse({ error: "Stripe not configured" }, 400);
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
      const territory = await getOwnTerritory(supabase);
      if (!territory) return jsonResponse({ error: "No territory found" }, 400);

      let customerId = territory.stripe_customer_id;
      if (!customerId) {
        try {
          const list = await stripe.customers.search({ query: `metadata['territory_id']:'${territory.id}'` });
          if (list.data.length > 0) customerId = list.data[0].id;
        } catch (_) {}
      }
      if (!customerId) return jsonResponse({ error: "No Stripe customer found for this territory" }, 400);

      const bankMethods = await stripe.paymentMethods.list({ customer: customerId, type: "us_bank_account" });
      const cardMethods = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
      const pm = bankMethods.data[0] || cardMethods.data[0] || null;

      if (pm) {
        // Use the hardened persist path so the DB write is verified.
        try {
          await persistPaymentMethod(supabase, stripe, territory, pm.id);
        } catch (e) {
          return jsonResponse({ error: `Failed to persist payment method: ${(e as any)?.message}` }, 500);
        }
        return jsonResponse({ success: true, payment_method_id: pm.id, type: pm.type, details: pm.us_bank_account ? `${pm.us_bank_account.bank_name} (•••• ${pm.us_bank_account.last4})` : `${pm.card?.brand} (•••• ${pm.card?.last4})` });
      }
      return jsonResponse({ success: false, message: "No payment methods found attached to customer in Stripe" });
    }

    // SetupIntent (bank/card connect) — legacy + API naming.
    if (body.action === "setup_intent" || body.action === "create_setup_intent") {
      if (!stripeKey) return jsonResponse({ error: "Royalty Stripe account not configured. Super Admin must add the royalty Stripe secret + publishable keys first (Settings → Royalty)." }, 400);
      if (!stripeKey.startsWith("sk_live_") && !stripeKey.startsWith("sk_test_") && !stripeKey.startsWith("rk_live_") && !stripeKey.startsWith("rk_test_")) {
        return jsonResponse({ error: `Invalid Stripe Secret Key stored in royalty_secrets (${stripeKey.substring(0, 10)}...). Super Admin must go to Settings → Royalty and re-enter a valid Stripe Secret Key (sk_live_... or sk_test_...).` }, 400);
      }
      if (!royaltyPublishableKey) return jsonResponse({ error: "Royalty Stripe publishable key missing. A Super Admin must add the publishable key (pk_...) in Settings → Royalty." }, 400);
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
      const territory = await getOwnTerritory(supabase);
      let customerId = territory?.stripe_customer_id;
      if (customerId) {
        try { await stripe.customers.retrieve(customerId); }
        catch (_) {
          console.log(`[royalty] Customer ${customerId} not found in this Stripe account — clearing stale ID`);
          customerId = null;
          if (territory) await supabase.from("territories").update({ stripe_customer_id: null }).eq("id", territory.id);
        }
      }
      if (!customerId) {
        const customer = await stripe.customers.create({ name: territory?.name || "Veydra Territory", metadata: { territory_id: territory?.id || "unknown" } });
        customerId = customer.id;
        if (territory) await supabase.from("territories").update({ stripe_customer_id: customerId }).eq("id", territory.id);
      }

      // Check if customer already has a payment method in Stripe and auto-sync
      const bankMethods = await stripe.paymentMethods.list({ customer: customerId, type: "us_bank_account" });
      const cardMethods = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
      const existingPm = bankMethods.data[0] || cardMethods.data[0] || null;
      if (existingPm && territory) {
        try { await persistPaymentMethod(supabase, stripe, territory, existingPm.id); } catch (_) {}
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId, payment_method_types: ["us_bank_account", "card"], usage: "off_session",
        metadata: { territory_id: territory?.id || "" },
      });
      return jsonResponse({ client_secret: setupIntent.client_secret, customer_id: customerId, publishable_key: royaltyPublishableKey });
    }

    // Attach + persist payment method (hardened path). Called by the client
    // after stripe.confirmSetup succeeds. Verifies the DB write landed.
    if (body.action === "attach_payment_method" && body.payment_method_id) {
      if (!stripeKey) return jsonResponse({ error: "Stripe not configured" }, 400);
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
      const territory = await getOwnTerritory(supabase);
      if (!territory) return jsonResponse({ error: "No territory found for this instance" }, 400);
      try {
        const result = await persistPaymentMethod(supabase, stripe, territory, body.payment_method_id as string);
        return jsonResponse({ success: true, payment_method_id: result.payment_method_id, configured: true });
      } catch (err: any) {
        return jsonResponse({ error: err.message || "Failed to persist payment method" }, 500);
      }
    }

    const forceRecalculate = body.force === true;
    const specificTerritoryId = body.territory_id || null;

    const { data: settings } = await supabase.from("royalty_settings").select("*").limit(1).single();
    if (!settings) return jsonResponse({ error: "Royalty settings not configured" }, 400);

    // Portal timezone — same source as the scheduler / header clock. Processing
    // day/time are interpreted in THIS timezone, not UTC.
    const { data: portalSettings } = await supabase.from("portal_settings").select("timezone, company_timezone").limit(1).maybeSingle();
    const portalTz = portalSettings?.timezone || portalSettings?.company_timezone || "America/New_York";

    // Scheduled (auto) runs only fire on the configured day at/after the
    // configured time in portal TZ. Manual "Run Weekly Processor" always runs
    // but is still protected against double-charging by the existing-period
    // check + the unique index on royalty_periods(territory_id, period_start, period_end).
    if (body.scheduled === true && !forceRecalculate) {
      const { dow, hhmm } = portalNow(portalTz);
      const targetDow = Number(settings.processing_day_of_week ?? 5);
      const targetTime = String(settings.processing_time || "02:00").padStart(5, "0");
      if (dow !== targetDow || hhmm < targetTime) {
        return jsonResponse({ skipped: true, reason: "Not the scheduled processing day/time in portal timezone", portal_tz: portalTz, portal_dow: dow, portal_time: hhmm, target_dow: targetDow, target_time: targetTime });
      }
    }

    let territoryQuery = supabase.from("territories").select("*").eq("status", "active").gt("royalty_percentage", 0);
    if (specificTerritoryId) territoryQuery = territoryQuery.eq("id", specificTerritoryId);
    else territoryQuery = territoryQuery.eq("is_primary", true);
    const { data: territories, error: terrError } = await territoryQuery;
    if (terrError) throw terrError;
    if (!territories || territories.length === 0) return jsonResponse({ message: "No active territory with royalty configured for this instance", processed: 0 });

    const results: any[] = [];
    for (const territory of territories) {
      try {
        const result = await processTerritory(supabase, territory, settings, stripeKey, forceRecalculate);
        results.push(result);
      } catch (err) {
        console.error(`Error processing territory ${territory.name}:`, err);
        results.push({ territory_id: territory.id, territory_name: territory.name, status: "error", error: err.message });
      }
    }

    const successCount = results.filter((r) => r.status === "paid" || r.status === "calculated").length;
    const failCount = results.filter((r) => r.status === "error" || r.status === "failed").length;
    return jsonResponse({ processed: results.length, succeeded: successCount, failed: failCount, results });
  } catch (err) {
    console.error("Royalty processor fatal error:", err);
    return jsonResponse({ error: err.message }, 500);
  }

  // ─── Helper: Process a single territory ───
  async function processTerritory(supabase: any, territory: any, settings: any, stripeKey: string | undefined, force: boolean) {
    const periodEnd = new Date(); periodEnd.setHours(0, 0, 0, 0);
    const periodStart = new Date(periodEnd); periodStart.setDate(periodStart.getDate() - 7);

    if (force) {
      await supabase.from("royalty_periods").delete()
        .eq("territory_id", territory.id)
        .eq("period_start", periodStart.toISOString().split("T")[0])
        .eq("period_end", periodEnd.toISOString().split("T")[0])
        .in("status", ["pending", "failed"]);
    }

    // SAFETY NET: lock orphaned unprocessed sales inside already-completed periods
    const { data: completedPeriods } = await supabase
      .from("royalty_periods")
      .select("id, period_start, period_end, status, total_due, gross_sales")
      .eq("territory_id", territory.id)
      .in("status", ["paid", "waived"]);
    if (completedPeriods && completedPeriods.length > 0) {
      for (const cp of completedPeriods) {
        const { data: orphanedSales } = await supabase
          .from("royalty_sales")
          .select("id, sale_amount, is_refund, description, sale_date")
          .eq("territory_id", territory.id)
          .gte("sale_date", cp.period_start)
          .lte("sale_date", cp.period_end)
          .is("processed_period_id", null);
        if (orphanedSales && orphanedSales.length > 0) {
          const orphanedIds = orphanedSales.map((s: any) => s.id);
          console.log(`[royalty] SAFETY NET: Found ${orphanedIds.length} orphaned sale(s) inside already-${cp.status} period ${cp.id}. Locking retroactively.`);
          const { error: lockErr } = await supabase
            .from("royalty_sales")
            .update({ processed_period_id: cp.id, processed_at: new Date().toISOString() })
            .in("id", orphanedIds)
            .is("processed_period_id", null);
          if (lockErr) console.error(`[royalty] Safety-net lock failed for period ${cp.id}:`, lockErr.message);
        }
      }
    }

    const { data: sales, error: salesError } = await supabase
      .from("royalty_sales")
      .select("id, sale_amount, is_refund, description, wedding_id, sale_date")
      .eq("territory_id", territory.id)
      .gte("sale_date", periodStart.toISOString().split("T")[0])
      .lte("sale_date", periodEnd.toISOString().split("T")[0])
      .is("processed_period_id", null);
    if (salesError) throw salesError;

    if (!force && (!sales || sales.length === 0)) {
      const { data: existing } = await supabase
        .from("royalty_periods")
        .select("id, status")
        .eq("territory_id", territory.id)
        .eq("period_start", periodStart.toISOString().split("T")[0])
        .eq("period_end", periodEnd.toISOString().split("T")[0])
        .limit(1);
      if (existing && existing.length > 0) {
        return { territory_id: territory.id, territory_name: territory.name, status: "skipped", reason: "Already calculated for this period" };
      }
    }

    // Royalty rule: refunds NEVER count toward royalty — only processed sales.
    const grossSales = (sales || []).reduce((sum: number, s: any) => sum + (s.is_refund ? 0 : Number(s.sale_amount)), 0);
    const royaltyPct = Number(territory.royalty_percentage) || 0;
    const paybackPct = Number(territory.payback_percentage) || 0;
    const remainingBalance = Number(territory.remaining_balance) || 0;
    const royaltyDue = Math.max(0, grossSales * (royaltyPct / 100));
    let paybackDue = Math.max(0, grossSales * (paybackPct / 100));
    if (paybackDue > remainingBalance) paybackDue = remainingBalance;
    const totalDue = Math.round((royaltyDue + paybackDue) * 100) / 100;

    const { data: period, error: periodError } = await supabase.from("royalty_periods").insert({
      territory_id: territory.id, period_start: periodStart.toISOString().split("T")[0], period_end: periodEnd.toISOString().split("T")[0],
      gross_sales: grossSales, royalty_amount: royaltyDue, payback_amount: paybackDue, total_due: totalDue,
      status: totalDue > 0 ? "processing" : "paid", calculated_at: new Date().toISOString(),
      notes: sales && sales.length > 0 ? `${sales.length} sales transactions` : "No sales in period",
    }).select().single();
    if (periodError) {
      // 23505 = unique_violation → another invocation already created this
      // week's period. Hard safeguard against double charging — never insert
      // a second period for the same week. Treat as already processed.
      if (periodError.code === "23505") return { territory_id: territory.id, territory_name: territory.name, status: "skipped", reason: "Period already exists for this week (double-charge safeguard)" };
      throw periodError;
    }

    if (sales && sales.length > 0) {
      const saleIds = (sales as any[]).map((s) => s.id);
      const { error: lockErr } = await supabase
        .from("royalty_sales")
        .update({ processed_period_id: period.id, processed_at: new Date().toISOString() })
        .in("id", saleIds)
        .is("processed_period_id", null);
      if (lockErr) console.error(`[royalty] Failed to lock sales for period ${period.id}:`, lockErr.message);
    }

    if (totalDue <= 0) {
      await supabase.from("royalty_periods").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", period.id);
      return { territory_id: territory.id, territory_name: territory.name, status: "paid", gross_sales: grossSales, total_due: 0, reason: "No sales or zero due" };
    }

    if (!stripeKey) {
      await supabase.from("royalty_periods").update({ status: "pending", notes: "Stripe not configured — manual collection required" }).eq("id", period.id);
      return { territory_id: territory.id, territory_name: territory.name, status: "pending", gross_sales: grossSales, total_due: totalDue, reason: "Stripe not configured" };
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
    let stripeCustomerId = territory.stripe_customer_id;
    if (!stripeCustomerId) return { territory_id: territory.id, territory_name: territory.name, status: "failed", gross_sales: grossSales, total_due: totalDue, error: "No Stripe customer ID on territory" };

    const paymentMethods = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: "us_bank_account" });
    let paymentMethodId = territory.primary_payment_method_id;
    if (!paymentMethodId || paymentMethods.data.length === 0) {
      const cardMethods = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: "card" });
      if (cardMethods.data.length > 0) paymentMethodId = cardMethods.data[0].id;
    } else {
      const bankMatch = paymentMethods.data.find((pm: any) => pm.id === paymentMethodId);
      if (!bankMatch && paymentMethods.data.length > 0) paymentMethodId = paymentMethods.data[0].id;
    }
    if (paymentMethodId && paymentMethodId !== territory.primary_payment_method_id && paymentMethodId !== territory.stripe_payment_method_id) {
      try { await supabase.from("territories").update({ primary_payment_method_id: paymentMethodId, stripe_payment_method_id: paymentMethodId, stripe_royalty_configured: true, stripe_connected: true }).eq("id", territory.id); } catch (e) { console.warn("[royalty] auto-sync pm failed:", (e as any)?.message); }
    }

    if (!paymentMethodId) {
      await supabase.from("royalty_periods").update({ status: "failed", notes: "No valid payment method on file" }).eq("id", period.id);
      await pushRoyaltyAlert("failed", territory, totalDue, "No valid payment method on file", null);
      return { territory_id: territory.id, territory_name: territory.name, status: "failed", gross_sales: grossSales, total_due: totalDue, error: "No valid payment method" };
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalDue * 100), currency: "usd", customer: stripeCustomerId,
        payment_method: paymentMethodId, off_session: true, confirm: true,
        description: `Royalty + Payback for ${territory.name} — Period ${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]}`,
        metadata: { territory_id: territory.id, royalty_period_id: period.id, royalty_amount: royaltyDue.toFixed(2), payback_amount: paybackDue.toFixed(2), gross_sales: grossSales.toFixed(2) },
      });

      if (paymentIntent.status === "succeeded") {
        const newRemainingBalance = Math.max(0, remainingBalance - paybackDue);
        await supabase.from("territories").update({ remaining_balance: newRemainingBalance, last_calculated_at: new Date().toISOString() }).eq("id", territory.id);
        await supabase.from("royalty_periods").update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: paymentIntent.id }).eq("id", period.id);
        await pushRoyaltyAlert("paid", territory, totalDue, null, newRemainingBalance);
        return { territory_id: territory.id, territory_name: territory.name, status: "paid", gross_sales: grossSales, royalty_due: royaltyDue, payback_due: paybackDue, total_due: totalDue, new_remaining_balance: newRemainingBalance, stripe_pi_id: paymentIntent.id };
      } else {
        await supabase.from("royalty_periods").update({ status: "failed", stripe_payment_intent_id: paymentIntent.id, notes: `Payment status: ${paymentIntent.status}` }).eq("id", period.id);
        await pushRoyaltyAlert("failed", territory, totalDue, `Payment status: ${paymentIntent.status}`, null);
        return { territory_id: territory.id, territory_name: territory.name, status: "failed", gross_sales: grossSales, total_due: totalDue, error: `Payment status: ${paymentIntent.status}` };
      }
    } catch (chargeErr: any) {
      await supabase.from("royalty_periods").update({ status: "failed", notes: chargeErr.message }).eq("id", period.id);
      await pushRoyaltyAlert("failed", territory, totalDue, chargeErr.message, null);
      return { territory_id: territory.id, territory_name: territory.name, status: "failed", gross_sales: grossSales, total_due: totalDue, error: chargeErr.message };
    }
  }
});
