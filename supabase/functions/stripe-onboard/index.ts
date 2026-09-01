import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("Veydra") || Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Veydra secret key is missing");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2022-11-15",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.json();
    const { contractor_id, user_id, user_type, email, country, return_url, refresh_url } = body;

    const targetId = user_id || contractor_id;
    const targetTable = user_type === "editor" ? "editors" : "contractors";

    if (!targetId || !email) {
      throw new Error("Missing required parameters");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userRecord, error } = await supabase
      .from(targetTable)
      .select("stripe_account_id")
      .eq("id", targetId)
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    let accountId = userRecord?.stripe_account_id;

    if (!accountId) {
      const capabilities: any = {
        transfers: { requested: true },
      };
      
      const accountCountry = country || "US";
      const accountParams: any = {
        type: "express",
        country: accountCountry,
        email: email,
      };

      if (accountCountry === "US") {
        capabilities.card_payments = { requested: true };
      } else {
        // Explicitly tell Stripe this international account is only receiving money
        accountParams.tos_acceptance = { service_agreement: 'recipient' };
      }
      
      accountParams.capabilities = capabilities;

      const account = await stripe.accounts.create(accountParams);
      accountId = account.id;

      const { error: updateError } = await supabase
        .from(targetTable)
        .update({ stripe_account_id: accountId })
        .eq("id", targetId);

      if (updateError) {
        throw new Error(`Failed to save Stripe ID: ${updateError.message}`);
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url,
      return_url: return_url,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
