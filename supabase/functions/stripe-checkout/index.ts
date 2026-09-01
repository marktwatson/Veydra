import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.14.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-charge-offsession',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Lightweight GET: return the publishable key so the frontend can
  // initialize Stripe Elements against the correct (booking) account
  // without hardcoding the key. Mirrors the royalty-processor pattern.
  if (req.method === 'GET') {
    const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");
    if (!publishableKey) {
      return new Response(JSON.stringify({ error: "STRIPE_PUBLISHABLE_KEY not configured." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ publishable_key: publishableKey }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
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
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Expose the publishable key on every response so the frontend can
    // initialize Stripe Elements without a separate round-trip.
    const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY") || ""

    const { 
      amount, 
      customerEmail, 
      customerName, 
      description, 
      paymentOption, 
      totalPrice, 
      weddingDate,
      type,
      weddingId,
      successUrl,
      cancelUrl,
      stripeCustomerId,
      couponId,
      proposalId,
      packageName
    } = await req.json()

    // 1. Create or find customer
    let customer
    if (stripeCustomerId) {
      try {
        customer = await stripe.customers.retrieve(stripeCustomerId)
      } catch (e) {
        console.log("Could not retrieve existing customer");
      }
    }
    
    if (!customer && customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 })
      customer = customers.data[0]
      if (!customer) {
        customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName,
        })
      }
    }

    // 2. Handle "Gift a Wedding"
    if (type === 'gift') {
      const session = await stripe.checkout.sessions.create({
        customer: customer?.id,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: description || "Wedding Gift Contribution",
              description: `Gift for wedding ID: ${weddingId}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          type: 'gift',
          weddingId: weddingId || null,
          amount: amount.toString()
        }
      })

      return new Response(
        JSON.stringify({ url: session.url, publishableKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2b. Handle "Upsell" (bartending add-on purchase by a booked bride)
    if (type === 'upsell') {
      const session = await stripe.checkout.sessions.create({
        customer: customer?.id,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: description || 'Bartending Add-On',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          type: 'upsell',
          weddingId: weddingId || null,
          amount: amount.toString(),
          packageName: packageName || description || 'Bartending Add-On',
        }
      })

      return new Response(
        JSON.stringify({ url: session.url, publishableKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Handle different payment options
    const metadata: Record<string, string> = {
      paymentOption: paymentOption || '',
      weddingDate: weddingDate || '',
      totalPrice: totalPrice?.toString() || '0',
    };
    if (weddingId) metadata.weddingId = weddingId;
    if (proposalId) metadata.proposalId = proposalId;
    if (couponId) metadata.couponId = couponId;

    if (paymentOption === 'full' || paymentOption === 'half' || paymentOption === 'custom') {
      if (amount === 0) {
        const session = await stripe.setupIntents.create({
          customer: customer?.id,
          description: description,
          usage: 'off_session',
          metadata
        });
        return new Response(
          JSON.stringify({ clientSecret: session.client_secret, customerId: customer?.id, publishableKey }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Check if off-session auto-charge is requested (when no client interaction is taking place)
        if (req.headers.get("x-charge-offsession") === "true") {
          let targetCustomerId = customer?.id;
          
          if (!targetCustomerId && customerEmail) {
            const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
            if (customers.data.length > 0) {
              targetCustomerId = customers.data[0].id;
            }
          }

          if (!targetCustomerId) {
            throw new Error(`No Stripe Customer profile on file for ${customerName || customerEmail || 'this client'}.`);
          }

          // Retrieve customer to check invoice_settings.default_payment_method or fallback to paymentMethods list
          const fullCustomer = await stripe.customers.retrieve(targetCustomerId) as any;
          let defaultPm = fullCustomer.invoice_settings?.default_payment_method || fullCustomer.default_source;

          if (!defaultPm) {
            const paymentMethods = await stripe.paymentMethods.list({
              customer: targetCustomerId,
              type: 'card'
            });
            defaultPm = paymentMethods.data[0]?.id;
          }

          if (!defaultPm) {
            throw new Error(`Client ${customerName || customerEmail} does not have a saved card on file.`);
          }

          // Ensure amount is valid positive integer in cents
          const chargeAmountCents = Math.round(Number(amount) || 0);
          if (chargeAmountCents <= 0) {
            throw new Error(`Invalid charge amount: $${(chargeAmountCents/100).toFixed(2)}`);
          }

          // 1. Create formal draft invoice
          const invoice = await stripe.invoices.create({
            customer: targetCustomerId,
            auto_advance: false,
            default_payment_method: defaultPm,
            collection_method: 'charge_automatically',
            description: description || `Payment for ${customerName || 'wedding'}`,
            metadata
          });

          // 2. Attach line item directly to this draft invoice
          await stripe.invoiceItems.create({
            customer: targetCustomerId,
            invoice: invoice.id,
            amount: chargeAmountCents,
            currency: 'usd',
            description: description || `Payment for ${customerName || 'wedding'}`,
            metadata
          });

          // 3. Finalize invoice and charge saved card
          let paidInvoice = await stripe.invoices.finalizeInvoice(invoice.id, {
            auto_advance: true
          });
          
          if (paidInvoice.status !== 'paid') {
            try {
              paidInvoice = await stripe.invoices.pay(paidInvoice.id, {
                payment_method: defaultPm,
                off_session: true
              });
            } catch (payErr: any) {
              // If it was paid concurrently or in finalization step
              if (payErr.message?.includes('already paid') || payErr.code === 'invoice_already_paid') {
                paidInvoice = await stripe.invoices.retrieve(paidInvoice.id);
              } else {
                throw payErr;
              }
            }
          }

          return new Response(
            JSON.stringify({ 
              invoiceId: paidInvoice.id, 
              status: paidInvoice.status, 
              invoicePdf: paidInvoice.invoice_pdf,
              hostedInvoiceUrl: paidInvoice.hosted_invoice_url,
              customerId: targetCustomerId,
              publishableKey
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const session = await stripe.paymentIntents.create({
            customer: customer?.id,
            amount: amount,
            currency: 'usd',
            description: description,
            setup_future_usage: 'off_session',
            metadata
          });
          return new Response(
            JSON.stringify({ clientSecret: session.client_secret, customerId: customer?.id, publishableKey }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      // Subscription based
      const interval_count = paymentOption === 'quarterly' ? 3 : 1;

      // Create a product and price for the retainer upfront charge
      const retainerProduct = await stripe.products.create({ name: 'Wedding Retainer' });
      const retainerPrice = await stripe.prices.create({
        currency: 'usd',
        unit_amount: 9900,
        product: retainerProduct.id,
      });

      // Create a product and price for the recurring subscription
      const recurringProduct = await stripe.products.create({
        name: `Wedding Payment Plan (${paymentOption === 'quarterly' ? 'Quarterly' : 'Monthly'})`,
      });
      const recurringPrice = await stripe.prices.create({
        currency: 'usd',
        unit_amount: 25000,
        product: recurringProduct.id,
        recurring: {
          interval: 'month',
          interval_count: interval_count,
        },
      });

      // We use trial_period_days to delay the first recurring charge, 
      // while charging the retainer upfront via add_invoice_items.
      const daysToAdd = paymentOption === 'quarterly' ? 89 : 28;

      const subscription = await stripe.subscriptions.create({
        customer: customer?.id,
        items: [{ price: recurringPrice.id }],
        trial_period_days: daysToAdd,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata,
        add_invoice_items: [{ price: retainerPrice.id }]
      })

      const invoice = subscription.latest_invoice as any;
      const paymentIntent = invoice.payment_intent as any;

      return new Response(
        JSON.stringify({ 
          clientSecret: paymentIntent.client_secret, 
          customerId: customer?.id, 
          subscriptionId: subscription.id,
          publishableKey
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error("Checkout Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
