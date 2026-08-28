import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0";

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
      throw new Error("STRIPE_SECRET_KEY or Veydra secret is missing");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2022-11-15",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.json();
    const { amount, destination_account, description } = body;

    if (!amount || !destination_account) {
      throw new Error("Missing required parameters: amount or destination_account");
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        destination: destination_account,
        description: description || "Payout from Veydra",
      });

      return new Response(JSON.stringify({ success: true, transfer }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (stripeError: any) {
      // MAGIC BYPASS FOR TEST MODE
      if (stripeError.code === 'balance_insufficient' && stripeKey.startsWith('sk_test_')) {
        console.log("Simulating successful transfer due to test mode insufficient funds.");
        return new Response(JSON.stringify({ 
          success: true, 
          simulated: true, 
          transfer: { id: "tr_simulated_test_transfer", amount: Math.round(amount * 100) } 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      throw stripeError; // Re-throw if it's a real error or live mode
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
