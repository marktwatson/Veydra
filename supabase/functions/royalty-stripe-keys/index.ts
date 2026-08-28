// Royalty Stripe Keys — saves the separate HQ royalty Stripe account keys.
// Security: Super Admin only for saving keys. Any authenticated user may
// read the publishable key (it is safe to expose).
//
// Self-healing: before saving, ensures the royalty_settings / royalty_secrets
// tables and columns exist via exec_sql. This prevents silent save failures
// when a territory's schema is stale.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Ensure all royalty schema objects exist. Uses exec_sql (created by
// deploy-territory) so the statements run as the service role.
const HEAL_SQL = `
CREATE TABLE IF NOT EXISTS public.royalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_day_of_week INTEGER DEFAULT 5,
  processing_time TEXT DEFAULT '02:00',
  stripe_connected BOOLEAN DEFAULT false,
  retry_count INTEGER DEFAULT 3,
  retry_delay_hours INTEGER DEFAULT 24,
  notify_email TEXT,
  notify_on_success BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,
  notify_balance_zero BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_publishable_key TEXT;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_configured BOOLEAN DEFAULT false;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_webhook_secret TEXT;
INSERT INTO public.royalty_settings (processing_day_of_week, processing_time) VALUES (5, '02:00') ON CONFLICT DO NOTHING;
ALTER TABLE public.royalty_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access royalty_settings" ON public.royalty_settings;
CREATE POLICY "Public full access royalty_settings" ON public.royalty_settings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.royalty_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_secret_key TEXT,
  stripe_webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.royalty_secrets ENABLE ROW LEVEL SECURITY;
`;

async function healSchema(supabase: any) {
  // Split into individual statements and run each via exec_sql RPC.
  const statements = HEAL_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    try {
      await supabase.rpc("exec_sql", { sql_text: stmt });
    } catch (e) {
      console.warn("[royalty-stripe-keys] heal statement failed:", (e as any)?.message);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Always heal first so reads/writes don't fail on stale schemas.
    await healSchema(supabase);

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: return current royalty Stripe config status (safe to expose)
    if (req.method === "GET") {
      const { data: settings, error: readErr } = await supabase
        .from("royalty_settings")
        .select("stripe_royalty_configured, stripe_royalty_publishable_key")
        .maybeSingle();

      return new Response(
        JSON.stringify({
          configured: !!settings?.stripe_royalty_configured,
          hasPublishableKey: !!settings?.stripe_royalty_publishable_key,
          publishable_key: settings?.stripe_royalty_publishable_key || "",
          debug: readErr ? readErr.message : undefined,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST: save/validate keys — Super Admin only
    const { data: manager } = await supabase
      .from("managers")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!manager || manager.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Super Admin only" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const { secret_key, publishable_key, webhook_secret } = body;

    // Publishable key + configured flag → royalty_settings
    const settingsUpdates: any = {
      stripe_royalty_configured: true,
      stripe_connected: true,
      updated_at: new Date().toISOString(),
    };
    if (typeof publishable_key === "string" && publishable_key.trim()) {
      settingsUpdates.stripe_royalty_publishable_key = publishable_key.trim();
    }
    if (typeof webhook_secret === "string" && webhook_secret.trim()) {
      settingsUpdates.stripe_royalty_webhook_secret = webhook_secret.trim();
    }

    // Secret key + webhook secret → royalty_secrets (RLS-locked)
    const secretUpdates: any = {};
    if (typeof secret_key === "string" && secret_key.trim()) {
      secretUpdates.stripe_secret_key = secret_key.trim();
    }
    if (typeof webhook_secret === "string" && webhook_secret.trim()) {
      secretUpdates.stripe_webhook_secret = webhook_secret.trim();
    }

    // Upsert secrets row (service role bypasses RLS). Surface errors.
    const { data: existingSecret, error: secretSelErr } = await supabase
      .from("royalty_secrets")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (secretSelErr) throw new Error(`royalty_secrets read failed: ${secretSelErr.message}`);

    if (existingSecret?.id) {
      const { error: updErr } = await supabase
        .from("royalty_secrets")
        .update({ ...secretUpdates, updated_at: new Date().toISOString() })
        .eq("id", existingSecret.id);
      if (updErr) throw new Error(`royalty_secrets update failed: ${updErr.message}`);
    } else if (Object.keys(secretUpdates).length > 0) {
      const { error: insErr } = await supabase.from("royalty_secrets").insert(secretUpdates);
      if (insErr) throw new Error(`royalty_secrets insert failed: ${insErr.message}`);
    }

    // Upsert settings row. Surface errors.
    const { data: existingSettings, error: setSelErr } = await supabase
      .from("royalty_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (setSelErr) throw new Error(`royalty_settings read failed: ${setSelErr.message}`);

    if (existingSettings?.id) {
      const { error: updErr } = await supabase
        .from("royalty_settings")
        .update(settingsUpdates)
        .eq("id", existingSettings.id);
      if (updErr) throw new Error(`royalty_settings update failed: ${updErr.message}`);
    } else {
      const { error: insErr } = await supabase.from("royalty_settings").insert(settingsUpdates);
      if (insErr) throw new Error(`royalty_settings insert failed: ${insErr.message}`);
    }

    // ── Also flip the territory row's config flags so the UI health alert
    //    clears. The alert reads stripe_royalty_configured / stripe_connected
    //    from the territories table, not royalty_settings — so without this
    //    it would keep showing "not configured" even after a successful save.
    try {
      const SELF_PROJECT_REF = Deno.env.get("PROJECT_REF") || "oosmhtzqdmntlzhheofw";
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
      console.warn("[royalty-stripe-keys] territory flag sync failed:", (e as any)?.message);
    }

    // Validate the secret key against Stripe (non-fatal if it fails)
    let accountInfo: any = null;
    try {
      const verifyKey =
        secretUpdates.stripe_secret_key ||
        (await supabase
          .from("royalty_secrets")
          .select("stripe_secret_key")
          .maybeSingle())?.data?.stripe_secret_key;
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

    return new Response(
      JSON.stringify({ success: true, account: accountInfo }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[royalty-stripe-keys] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
