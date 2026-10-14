import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const territoryId = body?.territory_id || null;
    if (!territoryId) {
      return new Response(
        JSON.stringify({
          connected: false,
          reason: "no_area",
          source: "none",
          error: "Pick an area first. This check does not use another company's Stripe key.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ connected: false, reason: "error", source: "area", error: "Supabase is not configured on this function." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error: areaError } = await supabase
      .from("territories")
      .select("name, editor_payout_stripe_key")
      .eq("id", territoryId)
      .maybeSingle();
    if (areaError) {
      return new Response(
        JSON.stringify({ connected: false, reason: "error", source: "area", error: areaError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    const areaName = data?.name || "This area";
    const stripeKey = String(data?.editor_payout_stripe_key || "").trim();
    if (!stripeKey) {
      return new Response(
        JSON.stringify({
          connected: false,
          reason: "no_key",
          source: "area",
          areaName,
          error: `${areaName} has no editor payout secret saved.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (stripeKey.startsWith("mk_")) {
      return new Response(
        JSON.stringify({
          connected: false,
          reason: "key_id",
          source: "area",
          areaName,
          error: `${areaName} has a Stripe key ID (mk_), not the secret. Paste the key that starts with sk_live_.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isTest = stripeKey.startsWith("sk_test_");
    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { "Authorization": `Bearer ${stripeKey}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ connected: false, reason: "invalid_key", error: errText, source: "area", areaName }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = await res.json();
    return new Response(
      JSON.stringify({
        connected: true,
        source: "area",
        areaName,
        isTest,
        accountId: account.id,
        businessName: account.business_profile?.name || null,
        email: account.email || null,
        country: account.country || null,
        defaultCurrency: account.default_currency || null,
        businessType: account.business_type || null,
        payoutsEnabled: account.payouts_enabled || false,
        detailsSubmitted: account.details_submitted || false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ connected: false, reason: "error", error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

