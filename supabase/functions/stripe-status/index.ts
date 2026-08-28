const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

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
    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ connected: false, reason: "no_key" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isTest = STRIPE_SECRET_KEY.startsWith("sk_test_");

    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ connected: false, reason: "invalid_key", error: errText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = await res.json();

    return new Response(
      JSON.stringify({
        connected: true,
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
