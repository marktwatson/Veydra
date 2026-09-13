// Stripe Royalty Webhook
// Separate from the booking stripe-webhook. This handles events from the HQ
// royalty Stripe account (the account that charges territory owners for
// royalty + payback). Booking events (weddings, invoices, checkout) stay on
// stripe-webhook — this function ignores them.
//
// Secrets (set on this function in Supabase):
//   STRIPE_ROYALTY_SECRET_KEY       — royalty account sk_live_ / sk_test_
//   STRIPE_ROYALTY_WEBHOOK_SECRET   — royalty account whsec_...
// Fallback (single-account projects): STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET.
//
// Handled events:
//   setup_intent.succeeded / payment_method.attached
//     → persist primary_payment_method_id on the matching territory.
//   payment_intent.processing
//     → mark the royalty_period (metadata.royalty_period_id) as processing.
//   payment_intent.succeeded
//     → mark the royalty_period paid + apply payback to
//       territories.remaining_balance once (idempotent).
//   payment_intent.payment_failed
//     → mark the royalty_period failed with the Stripe message.

import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Royalty-account keys, with single-account fallback.
  const stripeKey =
    Deno.env.get("STRIPE_ROYALTY_SECRET_KEY") ||
    Deno.env.get("STRIPE_SECRET_KEY") ||
    "";
  const endpointSecret =
    Deno.env.get("STRIPE_ROYALTY_WEBHOOK_SECRET") ||
    Deno.env.get("STRIPE_WEBHOOK_SECRET") ||
    undefined;

  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    if (endpointSecret && signature) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, endpointSecret);
    } else {
      // No secret configured — parse raw. Still ignore booking events below.
      event = JSON.parse(rawBody);
    }
  } catch (err: any) {
    console.error("[royalty-webhook] signature verification failed:", err?.message);
    return jsonResponse({ error: `Webhook signature verification failed: ${err?.message}` }, 400);
  }

  if (!stripeKey) {
    console.warn("[royalty-webhook] no royalty Stripe key configured — ignoring", event.type);
    return jsonResponse({ received: true, ignored: true, reason: "no_royalty_key" });
  }
  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });

  try {
    switch (event.type) {
      // ─── Bank/card connect: persist the payment method on the territory ───
      case "setup_intent.succeeded":
      case "payment_method.attached": {
        let pmId: string | null = null;
        let customerId: string | null = null;
        if (event.type === "setup_intent.succeeded") {
          const si = event.data.object as Stripe.SetupIntent;
          pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id || null;
          customerId = typeof si.customer === "string" ? si.customer : null;
        } else {
          const pm = event.data.object as Stripe.PaymentMethod;
          pmId = pm.id;
          customerId = typeof pm.customer === "string" ? pm.customer : null;
        }
        if (pmId && customerId) {
          const { data: terr } = await supabase
            .from("territories")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (terr?.id) {
            await supabase
              .from("territories")
              .update({
                primary_payment_method_id: pmId,
                stripe_payment_method_id: pmId,
                stripe_royalty_configured: true,
                stripe_connected: true,
              })
              .eq("id", terr.id);
            console.log(`[royalty-webhook] persisted pm ${pmId} on territory ${terr.id}`);
          }
        }
        break;
      }

      // ─── ACH charge submitted (3–5 day settlement) ───
      case "payment_intent.processing": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const periodId = pi.metadata?.royalty_period_id;
        if (!periodId) break; // not a royalty charge — ignore
        await supabase
          .from("royalty_periods")
          .update({
            status: "processing",
            stripe_payment_intent_id: pi.id,
            notes: "ACH submitted — waiting on bank (3–5 days)",
          })
          .eq("id", periodId);
        console.log(`[royalty-webhook] period ${periodId} → processing (PI ${pi.id})`);
        break;
      }

      // ─── Charge succeeded: mark period paid + apply payback (idempotent) ───
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const periodId = pi.metadata?.royalty_period_id;
        if (!periodId) break; // not a royalty charge — ignore

        const { data: period } = await supabase
          .from("royalty_periods")
          .select("id, status, territory_id, payback_amount")
          .eq("id", periodId)
          .maybeSingle();
        if (!period) break;

        // Idempotent: only apply payback if not already paid.
        if (period.status === "paid") {
          console.log(`[royalty-webhook] period ${periodId} already paid — skipping`);
          break;
        }

        const paybackDue = Number(period.payback_amount) || 0;
        if (paybackDue > 0 && period.territory_id) {
          const { data: terr } = await supabase
            .from("territories")
            .select("id, remaining_balance")
            .eq("id", period.territory_id)
            .maybeSingle();
          if (terr?.id) {
            const currentBalance = Number(terr.remaining_balance) || 0;
            const newRemainingBalance = Math.max(0, currentBalance - paybackDue);
            await supabase
              .from("territories")
              .update({ remaining_balance: newRemainingBalance, last_calculated_at: new Date().toISOString() })
              .eq("id", terr.id);
          }
        }

        await supabase
          .from("royalty_periods")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: pi.id,
          })
          .eq("id", periodId);
        console.log(`[royalty-webhook] period ${periodId} → paid (PI ${pi.id})`);
        break;
      }

      // ─── Charge failed: mark period failed with Stripe message ───
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const periodId = pi.metadata?.royalty_period_id;
        if (!periodId) break; // not a royalty charge — ignore
        const reason = pi.last_payment_error?.message || `Payment failed (status: ${pi.status})`;
        await supabase
          .from("royalty_periods")
          .update({
            status: "failed",
            stripe_payment_intent_id: pi.id,
            notes: reason,
          })
          .eq("id", periodId);
        console.log(`[royalty-webhook] period ${periodId} → failed: ${reason}`);
        break;
      }

      default:
        // Booking events (checkout, invoice, charge for weddings) belong to
        // stripe-webhook. Ignore everything else here.
        break;
    }

    return jsonResponse({ received: true });
  } catch (err: any) {
    console.error("[royalty-webhook] handler error:", err?.message);
    return jsonResponse({ error: err?.message || "Webhook handler failed" }, 500);
  }
});
