import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey =
      Deno.env.get("Veydra") || Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY or Veydra secret is missing");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.json();
    const { subscriptionId, customerId, weddingId } = body;

    const cancelledSubs: string[] = [];
    const voidedInvoices: string[] = [];
    const errors: string[] = [];

    // 1. Cancel the subscription tied to this wedding (if provided)
    let subIdsToCancel: string[] = [];
    if (subscriptionId && typeof subscriptionId === "string") {
      subIdsToCancel.push(subscriptionId);
    }

    // 2. Also find any active subscriptions for this customer (safety net)
    if (customerId && typeof customerId === "string") {
      try {
        const activeSubs = await stripe.subscriptions.list({
          customer: customerId,
          status: "active",
          limit: 20,
        });
        for (const s of activeSubs.data) {
          // Only cancel subs whose metadata references this wedding, OR
          // cancel all active subs if no weddingId filter is given.
          const metaWedding = s.metadata?.weddingId;
          if (!weddingId || !metaWedding || metaWedding === String(weddingId)) {
            if (!subIdsToCancel.includes(s.id)) subIdsToCancel.push(s.id);
          }
        }
      } catch (e: any) {
        errors.push(`Failed to list subscriptions: ${e.message}`);
      }
    }

    for (const subId of subIdsToCancel) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        if (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due" || sub.status === "unpaid") {
          await stripe.subscriptions.cancel(subId, {
            cancellation_details: {
              feedback: "customer_discontinued",
              comment: weddingId ? `Wedding ${weddingId} cancelled` : "Wedding cancelled",
            },
          });
          cancelledSubs.push(subId);
        }
      } catch (e: any) {
        // Ignore "resource_missing" — subscription may already be gone
        if (e.code !== "resource_missing") {
          errors.push(`Failed to cancel subscription ${subId}: ${e.message}`);
        }
      }
    }

    // 3. Void any open/draft invoices for this customer tied to the wedding
    if (customerId && typeof customerId === "string") {
      try {
        const openInvoices = await stripe.invoices.list({
          customer: customerId,
          status: "open",
          limit: 50,
        });
        for (const inv of openInvoices.data) {
          const metaWedding = inv.metadata?.weddingId;
          const descMatch = weddingId && inv.description?.includes(String(weddingId));
          if (!weddingId || metaWedding === String(weddingId) || descMatch) {
            try {
              await stripe.invoices.voidInvoice(inv.id);
              voidedInvoices.push(inv.id);
            } catch (e: any) {
              // Some invoices can't be voided (e.g. automatic) — skip
              errors.push(`Failed to void invoice ${inv.id}: ${e.message}`);
            }
          }
        }
      } catch (e: any) {
        errors.push(`Failed to list invoices: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cancelledSubscriptions: cancelledSubs,
        voidedInvoices,
        errors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
