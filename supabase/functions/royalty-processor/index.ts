// Royalty & Territory Payback Processor
// Runs weekly: calculates gross sales per territory, computes royalty + payback,
// and charges the territory owner via Stripe (ACH preferred, card fallback).
// Idempotent: safe to re-run — skips periods already calculated.

import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Royalty collections use a SEPARATE Stripe account (HQ royalty account),
  // distinct from the bride booking payments account. The keys are stored in
  // royalty_settings (set by Super Admin via UI) so each territory can target
  // the correct HQ account. Falls back to STRIPE_SECRET_KEY env var only if
  // the royalty keys have not been configured yet.
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Self-heal royalty schema so stale territories don't break reads/writes.
  // Includes the idempotency columns on royalty_sales so the processor can
  // exclude already-processed sales even on instances that predate this fix.
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
  ];
  for (const stmt of HEAL_SQL) {
    try { await supabase.rpc("exec_sql", { sql_text: stmt }); } catch (_) {}
  }

  // Publishable key is safe to expose → lives in royalty_settings (public read).
  // Use maybeSingle so an empty/stale table doesn't throw.
  const { data: royaltySettingsRow } = await supabase
    .from("royalty_settings")
    .select("stripe_royalty_publishable_key, stripe_royalty_configured")
    .limit(1)
    .maybeSingle();
  const royaltyPublishableKey = royaltySettingsRow?.stripe_royalty_publishable_key || null;
  // Secret key is NEVER exposed to the browser → lives in royalty_secrets, which has
  // RLS enabled with NO policy, so only the service role (this edge function) can read it.
  const { data: royaltySecretsRow } = await supabase
    .from("royalty_secrets")
    .select("stripe_secret_key, stripe_webhook_secret")
    .limit(1)
    .maybeSingle();
  const stripeKey = royaltySecretsRow?.stripe_secret_key || Deno.env.get("STRIPE_SECRET_KEY");

  try {
    let body: any = {};
    try { body = await req.json(); } catch (_) {}

    // Save the separate HQ royalty Stripe account keys (Super Admin only).
    // These keys target a DIFFERENT Stripe account than bride booking payments.
    if (body.action === "set_royalty_keys") {
      // Enforce Super Admin — verify the caller's JWT against the managers table.
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace("Bearer ", "");
      if (jwt && jwt.startsWith("eyJ")) {
        const { data: authUser } = await supabase.auth.getUser(jwt);
        if (authUser?.user) {
          const { data: mgr } = await supabase
            .from("managers")
            .select("role")
            .eq("id", authUser.user.id)
            .maybeSingle();
          if (!mgr || mgr.role !== "super_admin") {
            return jsonResponse({ error: "Forbidden: Super Admin only" }, 403);
          }
        }
      }
      // Secret key + webhook secret → royalty_secrets (RLS-locked, browser cannot read)
      const secretUpdates: any = {};
      if (typeof body.secret_key === "string" && body.secret_key.trim())
        secretUpdates.stripe_secret_key = body.secret_key.trim();
      if (typeof body.webhook_secret === "string" && body.webhook_secret.trim())
        secretUpdates.stripe_webhook_secret = body.webhook_secret.trim();

      // Publishable key + configured flag → royalty_settings (safe to expose)
      const settingsUpdates: any = { stripe_royalty_configured: true, stripe_connected: true, updated_at: new Date().toISOString() };
      if (typeof body.publishable_key === "string" && body.publishable_key.trim())
        settingsUpdates.stripe_royalty_publishable_key = body.publishable_key.trim();

      // Validate that the secret key and publishable key are the SAME mode
      // (both test or both live) and same account. A mismatch causes Stripe
      // Elements to 400 and the bank-connect form to spin forever.
      const finalSecret = secretUpdates.stripe_secret_key || royaltySecretsRow?.stripe_secret_key;
      const finalPublishable = settingsUpdates.stripe_royalty_publishable_key || royaltyPublishableKey;
      if (finalSecret && finalPublishable) {
        const secretIsTest = String(finalSecret).startsWith("sk_test_");
        const pkIsTest = String(finalPublishable).startsWith("pk_test_");
        if (secretIsTest !== pkIsTest) {
          return jsonResponse({
            error: `Key mode mismatch: your secret key is ${secretIsTest ? "TEST" : "LIVE"} but your publishable key is ${pkIsTest ? "TEST" : "LIVE"}. Both keys must be from the same Stripe account and same mode.`,
          }, 400);
        }
      }

      if (Object.keys(secretUpdates).length === 0 && Object.keys(settingsUpdates).length === 1) {
        return jsonResponse({ error: "No keys provided" }, 400);
      }

      // Upsert secrets row (service role bypasses RLS). Surface errors instead
      // of silently swallowing them.
      const { data: existingSecret, error: secSelErr } = await supabase.from("royalty_secrets").select("id").limit(1).maybeSingle();
      if (secSelErr) return jsonResponse({ error: `royalty_secrets read failed: ${secSelErr.message}` }, 500);
      if (existingSecret?.id) {
        const { error: updErr } = await supabase.from("royalty_secrets").update({ ...secretUpdates, updated_at: new Date().toISOString() }).eq("id", existingSecret.id);
        if (updErr) return jsonResponse({ error: `royalty_secrets update failed: ${updErr.message}` }, 500);
      } else if (Object.keys(secretUpdates).length > 0) {
        const { error: insErr } = await supabase.from("royalty_secrets").insert(secretUpdates);
        if (insErr) return jsonResponse({ error: `royalty_secrets insert failed: ${insErr.message}` }, 500);
      }

      // Upsert settings row. Surface errors.
      const { data: existingSettings, error: setSelErr } = await supabase.from("royalty_settings").select("id").limit(1).maybeSingle();
      if (setSelErr) return jsonResponse({ error: `royalty_settings read failed: ${setSelErr.message}` }, 500);
      if (existingSettings?.id) {
        const { error: updErr } = await supabase.from("royalty_settings").update(settingsUpdates).eq("id", existingSettings.id);
        if (updErr) return jsonResponse({ error: `royalty_settings update failed: ${updErr.message}` }, 500);
      } else {
        const { error: insErr } = await supabase.from("royalty_settings").insert(settingsUpdates);
        if (insErr) return jsonResponse({ error: `royalty_settings insert failed: ${insErr.message}` }, 500);
      }

      // ── Also flip the territory row's config flags so the UI health alert
      //    clears. The alert reads stripe_royalty_configured / stripe_connected
      //    from the territories table, not royalty_settings — so without this
      //    it would keep showing "not configured" even after a successful save.
      const SELF_PROJECT_REF = Deno.env.get("PROJECT_REF") || "oosmhtzqdmntlzhheofw";
      try {
        const { data: terrRow } = await supabase
          .from("territories")
          .select("id")
          .or(`project_ref.eq.${SELF_PROJECT_REF},is_primary.eq.true`)
          .limit(1)
          .maybeSingle();
        if (terrRow?.id) {
          await supabase
            .from("territories")
            .update({
              stripe_royalty_configured: true,
              stripe_connected: true,
            })
            .eq("id", terrRow.id);
        }
      } catch (e) {
        console.warn("[royalty-processor] territory flag sync failed:", (e as any)?.message);
      }

      // Verify the secret key is valid by hitting the Stripe account endpoint
      let accountInfo: any = null;
      try {
        const verifyKey = secretUpdates.stripe_secret_key || royaltySecretsRow?.stripe_secret_key;
        if (verifyKey) {
          const res = await fetch("https://api.stripe.com/v1/account", {
            headers: { Authorization: `Bearer ${verifyKey}` },
          });
          if (res.ok) {
            const acct = await res.json();
            accountInfo = {
              id: acct.id,
              businessName: acct.business_profile?.name || null,
              email: acct.email || null,
              country: acct.country || null,
              isTest: String(verifyKey).startsWith("sk_test_"),
            };
          }
        }
      } catch (_) {}
      return jsonResponse({ success: true, account: accountInfo });
    }

    // Return the royalty publishable key so the frontend can initialize
    // Stripe Elements against the correct (royalty) account.
    if (body.action === "get_publishable_key") {
      if (!royaltyPublishableKey) {
        return jsonResponse({ error: "Royalty Stripe account not configured. Super Admin must add the royalty publishable + secret keys." }, 400);
      }
      return jsonResponse({ publishable_key: royaltyPublishableKey });
    }

    // ─── Seed a test sale (Super Admin testing tool) ───
    // Inserts a fake gross-sale row into royalty_sales for THIS instance's
    // primary territory, dated today, so the weekly processor has something
    // to sum and charge. Used to test the royalty math + Stripe charge flow
    // WITHOUT running a real booking through /book (which uses a different
    // Stripe account). No real money moves until the processor runs.
    if (body.action === "seed_test_sale") {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) {
        return jsonResponse({ error: "A positive amount is required" }, 400);
      }
      // Identify THIS instance's own territory the SAME way the frontend does:
      // project_ref first, then fall back to is_primary. Using is_primary alone
      // caused seeds to land on an orphan row that the UI never reads.
      const SELF_PROJECT_REF = "oosmhtzqdmntlzhheofw";
      let territory: any = null;
      const { data: selfRow } = await supabase
        .from("territories")
        .select("id, name")
        .eq("project_ref", SELF_PROJECT_REF)
        .limit(1)
        .maybeSingle();
      if (selfRow) {
        territory = selfRow;
      } else {
        const { data: primaryRow, error: terrErr } = await supabase
          .from("territories")
          .select("id, name")
          .eq("is_primary", true)
          .limit(1)
          .maybeSingle();
        if (terrErr || !primaryRow) {
          return jsonResponse({ error: "No primary territory found for this instance" }, 400);
        }
        territory = primaryRow;
      }
      // Use YESTERDAY's date so it falls inside the processor's
      // 7-day lookback window (which uses sale_date < CURRENT_DATE).
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { error: insErr } = await supabase.from("royalty_sales").insert({
        territory_id: territory.id,
        wedding_id: null,
        sale_amount: amount,
        sale_date: yesterday.toISOString().split("T")[0],
        description: `TEST SALE — ${body.note || "seeded by Super Admin"} (not a real booking)`,
        is_refund: false,
      });
      if (insErr) return jsonResponse({ error: `Failed to seed sale: ${insErr.message}` }, 500);
      return jsonResponse({ success: true, territory: territory.name, amount, message: `Seeded $${amount} test sale for ${territory.name}. Run the processor to calculate + charge.` });
    }

    // Handle SetupIntent request (for connecting bank account/card)
    // Handle both "setup_intent" (legacy) and "create_setup_intent" (API naming)
    if (body.action === "setup_intent" || body.action === "create_setup_intent") {
      if (!stripeKey) {
        return jsonResponse({ error: "Royalty Stripe account not configured. A Super Admin must add the royalty Stripe secret + publishable keys first (Settings → Royalty)." }, 400);
      }
      if (!royaltyPublishableKey) {
        return jsonResponse({ error: "Royalty Stripe publishable key missing. A Super Admin must add the publishable key (pk_...) in Settings → Royalty." }, 400);
      }
      const stripe = new Stripe(stripeKey, {
        apiVersion: "2023-10-16",
        httpClient: Stripe.createFetchHttpClient(),
      });

      // Identify THIS instance's own territory the same way the frontend does:
      // project_ref first, then fall back to is_primary. Using is_primary alone
      // caused a row mismatch (orphan rows) where the PM was written to a
      // different row than the UI reads, so "No payment method" persisted.
      const SELF_PROJECT_REF = "oosmhtzqdmntlzhheofw";
      let territory: any = null;
      const { data: selfRow } = await supabase.from("territories").select("*").eq("project_ref", SELF_PROJECT_REF).limit(1).maybeSingle();
      if (selfRow) {
        territory = selfRow;
      } else {
        const { data: primRow } = await supabase.from("territories").select("*").eq("is_primary", true).limit(1).maybeSingle();
        territory = primRow || null;
      }
      let customerId = territory?.stripe_customer_id;

      // Validate that the stored customer actually exists in THIS Stripe account.
      // If user switched between test/live keys, old customer ID belongs to
      // the other account and will fail with "No such customer". Clear and recreate.
      if (customerId) {
        try {
          await stripe.customers.retrieve(customerId);
        } catch (_) {
          console.log(`[royalty] Customer ${customerId} not found in this Stripe account — clearing stale ID`);
          customerId = null;
          if (territory) {
            await supabase.from("territories").update({ stripe_customer_id: null }).eq("id", territory.id);
          }
        }
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          name: territory?.name || "Veydra Territory",
          metadata: { territory_id: territory?.id || "unknown" },
        });
        customerId = customer.id;
        if (territory) {
          await supabase.from("territories").update({ stripe_customer_id: customerId }).eq("id", territory.id);
        }
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["us_bank_account", "card"],
        usage: "off_session",
        metadata: { territory_id: territory?.id || "" },
      });

      return jsonResponse({ client_secret: setupIntent.client_secret, customer_id: customerId, publishable_key: royaltyPublishableKey });
    }

    // Handle payment method attachment
    if (body.action === "attach_payment_method" && body.payment_method_id) {
      if (!stripeKey) {
        return jsonResponse({ error: "Stripe not configured" }, 400);
      }
      const stripe = new Stripe(stripeKey, {
        apiVersion: "2023-10-16",
        httpClient: Stripe.createFetchHttpClient(),
      });

      // Identify THIS instance's own territory (project_ref first, then is_primary)
      // so we attach the PM to the SAME row the UI reads. is_primary-only caused
      // row-mismatch bugs where the PM was saved to a different territory row.
      const SELF_PROJECT_REF = "oosmhtzqdmntlzhheofw";
      let territory: any = null;
      const { data: selfRow } = await supabase.from("territories").select("*").eq("project_ref", SELF_PROJECT_REF).limit(1).maybeSingle();
      if (selfRow) {
        territory = selfRow;
      } else {
        const { data: primRow } = await supabase.from("territories").select("*").eq("is_primary", true).limit(1).maybeSingle();
        territory = primRow || null;
      }
      if (!territory) {
        return jsonResponse({ error: "No territory found for this instance" }, 400);
      }
      // Auto-create a Stripe customer if missing (e.g. after clearing a stale ID).
      if (!territory.stripe_customer_id) {
        const customer = await stripe.customers.create({
          name: territory.name || "Veydra Territory",
          metadata: { territory_id: territory.id },
        });
        await supabase.from("territories").update({ stripe_customer_id: customer.id }).eq("id", territory.id);
        territory.stripe_customer_id = customer.id;
      }

      // 1) Attach PM to the Stripe customer so we can charge it later.
      const paymentMethod = await stripe.paymentMethods.attach(body.payment_method_id as string, {
        customer: territory.stripe_customer_id,
      });

      // 2) Persist payment-method ID AND mark configured/connected in DB
      //    so the UI knows a bank account is on file.
      await supabase.from("territories").update({
        primary_payment_method_id: paymentMethod.id,
        stripe_payment_method_id: paymentMethod.id,
        stripe_royalty_configured: true,
        stripe_connected: true,
      }).eq("id", territory.id);

      return jsonResponse({
        success: true,
        payment_method_id: paymentMethod.id,
        configured: true,
      });
    }

    const forceRecalculate = body.force === true;
    const specificTerritoryId = body.territory_id || null;

    // 1. Fetch global royalty settings
    const { data: settings } = await supabase
      .from("royalty_settings")
      .select("*")
      .limit(1)
      .single();

    if (!settings) {
      return jsonResponse({ error: "Royalty settings not configured" }, 400);
    }

    // 2. Fetch territory to process.
    // Single-territory model: if no specific territory_id given, process the primary (this instance's own) territory.
    let territoryQuery = supabase
      .from("territories")
      .select("*")
      .eq("status", "active")
      .gt("royalty_percentage", 0);

    if (specificTerritoryId) {
      territoryQuery = territoryQuery.eq("id", specificTerritoryId);
    } else {
      // Default to this instance's own primary territory
      territoryQuery = territoryQuery.eq("is_primary", true);
    }

    const { data: territories, error: terrError } = await territoryQuery;
    if (terrError) throw terrError;
    if (!territories || territories.length === 0) {
      return jsonResponse({ message: "No active territory with royalty configured for this instance", processed: 0 });
    }

    const results: any[] = [];

    // 3. Process each territory
    for (const territory of territories) {
      try {
        const result = await processTerritory(supabase, territory, settings, stripeKey, forceRecalculate);
        results.push(result);
      } catch (err) {
        console.error(`Error processing territory ${territory.name}:`, err);
        results.push({ territory_id: territory.id, territory_name: territory.name, status: "error", error: err.message });
      }
    }

    // 4. Send summary notification
    const successCount = results.filter((r) => r.status === "paid" || r.status === "calculated").length;
    const failCount = results.filter((r) => r.status === "error" || r.status === "failed").length;

    return jsonResponse({
      processed: results.length,
      succeeded: successCount,
      failed: failCount,
      results,
    });
  } catch (err) {
    console.error("Royalty processor fatal error:", err);
    return jsonResponse({ error: err.message }, 500);
  }

  // ─── Helper: Process a single territory ───
  async function processTerritory(supabase: any, territory: any, settings: any, stripeKey: string | undefined, force: boolean) {
    // Determine the period: previous 7 days ending today
    const periodEnd = new Date();
    periodEnd.setHours(0, 0, 0, 0);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7);

    // If forced, delete existing pending/failed periods for these dates
    if (force) {
      await supabase
        .from("royalty_periods")
        .delete()
        .eq("territory_id", territory.id)
        .eq("period_start", periodStart.toISOString().split("T")[0])
        .eq("period_end", periodEnd.toISOString().split("T")[0])
        .in("status", ["pending", "failed"]);
    }

    // ════════════════════════════════════════════════════════════════
    // SAFETY NET: Detect unprocessed (orphaned) sales that fall INSIDE
    // an already-completed period's date range — caused by a prior run
    // that created the period record but FAILED to mark the sales as
    // consumed (processed_period_id IS NULL). Without this, every
    // subsequent processor run would re-sum those sales and charge
    // them AGAIN (double-billing).
    //
    // Fix: find completed (paid/waived) periods whose date range overlaps
    // today's window, then lock any stray unprocessed sales to THAT
    // existing period instead of creating a brand-new duplicate charge.
    // ════════════════════════════════════════════════════════════════
    const { data: completedPeriods } = await supabase
      .from("royalty_periods")
      .select("id, period_start, period_end, status, total_due, gross_sales")
      .eq("territory_id", territory.id)
      .in("status", ["paid", "waived"]);

    if (completedPeriods && completedPeriods.length > 0) {
      for (const cp of completedPeriods) {
        // Check if any UNPROCESSED sales exist within this completed period's dates
        const { data: orphanedSales } = await supabase
          .from("royalty_sales")
          .select("id, sale_amount, is_refund, description, sale_date")
          .eq("territory_id", territory.id)
          .gte("sale_date", cp.period_start)
          .lte("sale_date", cp.period_end)
          .is("processed_period_id", null);

        if (orphanedSales && orphanedSales.length > 0) {
          const orphanedIds = orphanedSales.map((s: any) => s.id);
          console.log(`[royalty] SAFETY NET: Found ${orphanedIds.length} orphaned sale(s) inside already-${cp.status} period ${cp.id} (${cp.period_start} → ${cp.period_end}). Locking them retroactively to prevent double-charge.`);

          const { error: lockErr } = await supabase
            .from("royalty_sales")
            .update({
              processed_period_id: cp.id,
              processed_at: new Date().toISOString(),
            })
            .in("id", orphanedIds)
            .is("processed_period_id", null);

          if (lockErr) {
            console.error(`[royalty] Safety-net lock failed for period ${cp.id}:`, lockErr.message);
          }
        }
      }
    }

    // ─── Calculate gross sales for the period ───
    // Idempotency: only sum sales that have NOT already been consumed by a
    // previous royalty period (processed_period_id IS NULL). This makes the
    // processor bulletproof against overlapping date windows — a sale can only
    // ever be charged once, regardless of how often or when the processor runs.
    // Refunds (is_refund = true) reduce gross sales.
    //
    // IMPORTANT: we fetch unprocessed sales BEFORE the period-existence skip.
    // The old code skipped the whole territory if ANY period existed for the
    // window, which silently dropped NEW sales seeded after a previous run.
    // Now: new unprocessed sales always get picked up and charged as a
    // supplemental period; the skip only fires when there's genuinely nothing
    // new to process.
    const { data: sales, error: salesError } = await supabase
      .from("royalty_sales")
      .select("id, sale_amount, is_refund, description, wedding_id, sale_date")
      .eq("territory_id", territory.id)
      .gte("sale_date", periodStart.toISOString().split("T")[0])
      .lte("sale_date", periodEnd.toISOString().split("T")[0]) // include today
      .is("processed_period_id", null);

    if (salesError) throw salesError;

    // Idempotency: only skip when there are NO new unprocessed sales AND a
    // period already exists for this window. If there are new sales, fall
    // through and create a supplemental period + charge them.
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

    const grossSales = (sales || []).reduce((sum: number, s: any) => {
      return sum + (s.is_refund ? -Number(s.sale_amount) : Number(s.sale_amount));
    }, 0);

    // ─── Compute royalty and payback ───
    const royaltyPct = Number(territory.royalty_percentage) || 0;
    const paybackPct = Number(territory.payback_percentage) || 0;
    const remainingBalance = Number(territory.remaining_balance) || 0;

    const royaltyDue = Math.max(0, grossSales * (royaltyPct / 100));
    let paybackDue = Math.max(0, grossSales * (paybackPct / 100));
    // Cap payback at remaining balance
    if (paybackDue > remainingBalance) {
      paybackDue = remainingBalance;
    }
    const totalDue = Math.round((royaltyDue + paybackDue) * 100) / 100;

    // ─── Create royalty period record ───
    const { data: period, error: periodError } = await supabase
      .from("royalty_periods")
      .insert({
        territory_id: territory.id,
        period_start: periodStart.toISOString().split("T")[0],
        period_end: periodEnd.toISOString().split("T")[0],
        gross_sales: grossSales,
        royalty_amount: royaltyDue,
        payback_amount: paybackDue,
        total_due: totalDue,
        status: totalDue > 0 ? "processing" : "paid",
        calculated_at: new Date().toISOString(),
        notes: sales && sales.length > 0 ? `${sales.length} sales transactions` : "No sales in period",
      })
      .select()
      .single();

    if (periodError) throw periodError;

    // ─── Lock the consumed sales to this period (idempotency) ───
    // Mark every sale that contributed to this period as processed so it can
    // NEVER be summed again — even if the processor runs on an overlapping
    // window later. This is what prevents double-charging.
    if (sales && sales.length > 0) {
      const saleIds = (sales as any[]).map((s) => s.id);
      const { error: lockErr } = await supabase
        .from("royalty_sales")
        .update({
          processed_period_id: period.id,
          processed_at: new Date().toISOString(),
        })
        .in("id", saleIds)
        .is("processed_period_id", null);
      if (lockErr) {
        console.error(`[royalty] Failed to lock sales for period ${period.id}:`, lockErr.message);
      }
    }

    // If nothing due, mark as paid (zero balance period)
    if (totalDue <= 0) {
      await supabase
        .from("royalty_periods")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", period.id);

      return { territory_id: territory.id, territory_name: territory.name, status: "paid", gross_sales: grossSales, total_due: 0, reason: "No sales or zero due" };
    }

    // ─── Charge via Stripe ───
    if (!stripeKey) {
      // No Stripe configured — leave as processing/pending for manual collection
      await supabase
        .from("royalty_periods")
        .update({ status: "pending", notes: "Stripe not configured — manual collection required" })
        .eq("id", period.id);

      return { territory_id: territory.id, territory_name: territory.name, status: "pending", gross_sales: grossSales, total_due: totalDue, reason: "Stripe not configured" };
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Ensure customer exists
    let stripeCustomerId = territory.stripe_customer_id;
    if (!stripeCustomerId) {
      return { territory_id: territory.id, territory_name: territory.name, status: "failed", gross_sales: grossSales, total_due: totalDue, error: "No Stripe customer ID on territory" };
    }

    // Determine payment method: prefer bank account (ACH), fall back to card
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "us_bank_account",
    });

    let paymentMethodId = territory.primary_payment_method_id;

    if (!paymentMethodId || paymentMethods.data.length === 0) {
      // Fall back to card
      const cardMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: "card",
      });

      if (cardMethods.data.length > 0) {
        paymentMethodId = cardMethods.data[0].id;
      }
    } else {
      // Verify the stored payment method is still valid
      const bankMatch = paymentMethods.data.find((pm: any) => pm.id === paymentMethodId);
      if (!bankMatch && paymentMethods.data.length > 0) {
        paymentMethodId = paymentMethods.data[0].id;
      }
    }

    if (!paymentMethodId) {
      await supabase
        .from("royalty_periods")
        .update({ status: "failed", notes: "No valid payment method on file" })
        .eq("id", period.id);

      // Notify owner + admin
      await sendNotification(supabase, territory, "failed", totalDue, "No valid payment method on file");

      return { territory_id: territory.id, territory_name: territory.name, status: "failed", gross_sales: grossSales, total_due: totalDue, error: "No valid payment method" };
    }

    // Create PaymentIntent
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalDue * 100),
        currency: "usd",
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Royalty + Payback for ${territory.name} — Period ${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]}`,
        metadata: {
          territory_id: territory.id,
          royalty_period_id: period.id,
          royalty_amount: royaltyDue.toFixed(2),
          payback_amount: paybackDue.toFixed(2),
          gross_sales: grossSales.toFixed(2),
        },
      });

      if (paymentIntent.status === "succeeded") {
        // ─── On success: reduce remaining_balance, mark paid ───
        const newRemainingBalance = Math.max(0, remainingBalance - paybackDue);

        await supabase
          .from("territories")
          .update({
            remaining_balance: newRemainingBalance,
            last_calculated_at: new Date().toISOString(),
          })
          .eq("id", territory.id);

        await supabase
          .from("royalty_periods")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntent.id,
          })
          .eq("id", period.id);

        // Notify owner + admin
        await sendNotification(supabase, territory, "paid", totalDue, null, newRemainingBalance);

        return {
          territory_id: territory.id,
          territory_name: territory.name,
          status: "paid",
          gross_sales: grossSales,
          royalty_due: royaltyDue,
          payback_due: paybackDue,
          total_due: totalDue,
          new_remaining_balance: newRemainingBalance,
          stripe_pi_id: paymentIntent.id,
        };
      } else {
        // Payment requires action or failed
        await supabase
          .from("royalty_periods")
          .update({
            status: "failed",
            stripe_payment_intent_id: paymentIntent.id,
            notes: `Payment status: ${paymentIntent.status}`,
          })
          .eq("id", period.id);

        await sendNotification(supabase, territory, "failed", totalDue, `Payment status: ${paymentIntent.status}`);

        return { territory_id: territory.id, territory_name: territory.name, status: "failed", gross_sales: grossSales, total_due: totalDue, error: `Payment status: ${paymentIntent.status}` };
      }
    } catch (chargeErr: any) {
      await supabase
        .from("royalty_periods")
        .update({ status: "failed", notes: chargeErr.message })
        .eq("id", period.id);

      await sendNotification(supabase, territory, "failed", totalDue, chargeErr.message);

      return { territory_id: territory.id, territory_name: territory.name, status: "failed", gross_sales: grossSales, total_due: totalDue, error: chargeErr.message };
    }
  }

  // ─── Helper: Send email notification ───
  async function sendNotification(supabase: any, territory: any, type: string, amount: number, errorMsg: string | null = null, newBalance: number | null = null) {
    try {
      const { data: settings } = await supabase
        .from("royalty_settings")
        .select("notify_email")
        .limit(1)
        .single();

      const notifyEmail = settings?.notify_email;
      if (!notifyEmail) return;

      // Use the existing email infrastructure (Ovanta/CRM webhook or SMTP)
      // For now, log — the notification system can be extended
      console.log(`[Royalty] ${type.toUpperCase()} notification for ${territory.name}: $${amount} ${errorMsg ? "- " + errorMsg : ""} ${newBalance !== null ? "- Remaining: $" + newBalance : ""}`);

      // If remaining balance hit zero, special notification
      if (type === "paid" && newBalance === 0) {
        console.log(`[Royalty] PAYBACK COMPLETE for ${territory.name}! Remaining balance is now $0.`);
      }
    } catch (e) {
      console.error("Failed to send royalty notification:", e);
    }
  }

  function jsonResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
