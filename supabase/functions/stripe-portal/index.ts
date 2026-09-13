import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe secret key not configured. Set STRIPE_SECRET_KEY as a Supabase edge function secret." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    const { customerId, returnUrl } = await req.json();

    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Create a Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || req.headers.get('origin') || 'https://veydra.com',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
