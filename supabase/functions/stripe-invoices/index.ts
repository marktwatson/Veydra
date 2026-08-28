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
      return new Response(JSON.stringify({ 
        error: "Stripe secret key not configured. Set STRIPE_SECRET_KEY as a Supabase edge function secret." 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Validate the key works before proceeding
    try {
      await stripe.accounts.retrieve();
      console.log("[stripe-invoices] Stripe key validated successfully");
    } catch (keyErr: any) {
      console.error("[stripe-invoices] Stripe key validation failed:", keyErr.message);
      return new Response(JSON.stringify({ 
        error: `Stripe key is invalid or unauthorized: ${keyErr.message}` 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { customerId: inputCustomerId, customerEmail } = await req.json();

    // Trim whitespace/newlines that often come from copy-paste
    let customerId = typeof inputCustomerId === 'string' ? inputCustomerId.trim() : inputCustomerId;
    const trimmedEmail = typeof customerEmail === 'string' ? customerEmail.trim() : customerEmail;

    console.log("[stripe-invoices] Input customerId:", JSON.stringify(customerId), "email:", JSON.stringify(trimmedEmail));

    // If customerId looks like an email or is missing, search by email
    if ((!customerId || customerId.includes('@')) && (customerId || trimmedEmail)) {
      const emailToSearch = trimmedEmail || customerId;
      if (emailToSearch && typeof emailToSearch === 'string') {
        console.log("[stripe-invoices] Searching by email:", emailToSearch);
        const searchRes = await stripe.customers.list({
          email: emailToSearch.trim(),
          limit: 1,
        });
        if (searchRes.data.length > 0) {
          customerId = searchRes.data[0].id;
          console.log("[stripe-invoices] Found customer by email:", customerId);
        } else {
          console.log("[stripe-invoices] No customer found by email");
        }
      }
    }

    if (!customerId || !customerId.startsWith('cus_')) {
      console.log("[stripe-invoices] No valid customer ID. Returning empty.");
      return new Response(JSON.stringify({ 
        upcoming: null, 
        pastInvoices: [], 
        customerId: null,
        totalPaid: 0,
        message: 'No Stripe customer found for this ID/email' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("[stripe-invoices] Fetching charges for customer:", customerId);

    // Fetch active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    let upcoming = null;
    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      try {
        const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
          customer: customerId,
          subscription: sub.id,
        });
        upcoming = {
          amount: upcomingInvoice.amount_due / 100,
          date: new Date((upcomingInvoice.next_payment_attempt || upcomingInvoice.period_end) * 1000).toISOString(),
          status: 'scheduled'
        };
      } catch (e) {
        // Ignore if no upcoming invoice
      }
    }

    // Fetch past payments (charges) to include both invoices and one-time deposits
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 50,
    });

    const pastInvoices = charges.data
      .filter((charge: any) => charge.paid && charge.status === 'succeeded')
      .map((charge: any) => ({
        id: charge.id,
        amount: charge.amount / 100,
        date: new Date(charge.created * 1000).toISOString(),
        status: 'paid',
        pdf: charge.receipt_url,
        number: charge.receipt_number || charge.id.slice(-8).toUpperCase(),
        description: charge.description || 'Payment'
      }));

    const totalPaid = pastInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0);

    return new Response(JSON.stringify({ upcoming, pastInvoices, customerId, totalPaid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
