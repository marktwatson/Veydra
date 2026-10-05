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
    let stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    let source = "shared";

    if (territoryId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { data } = await supabase
          .from("territories")
          .select("name, editor_payout_stripe_key")
          .eq("id", territoryId)
          .maybeSingle();
        if (data?.editor_payout_stripe_key) {
          stripeKey = data.editor_payout_stripe_key;
          source = "area";
        }
      }
    }

    if (!stripeKey) {
      return new Response(
        JSON.stringify({ connected: false, reason: "no_key", source }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isTest = stripeKey.startsWith("sk_test_");
    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { "Authorization": `Bearer ${stripeKey}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ connected: false, reason: "invalid_key", error: errText, source }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = await res.json();
    return new Response(
      JSON.stringify({
        connected: true,
        source,
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

