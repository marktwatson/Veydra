import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, token, status, requestId } = await req.json();

    // ── Apply an approved plan (called from the public /payment-plan/:token page) ──
    if (action === "apply") {
      if (!token) throw new Error("Missing approval token");

      const { data: request, error: reqError } = await supabase
        .from("payment_plan_change_requests")
        .select("*")
        .eq("customer_token", token)
        .maybeSingle();
      if (reqError) throw reqError;
      if (!request) throw new Error("Invalid or unknown approval link");
      if (request.status !== "pending")
        throw new Error(
          `This request is no longer pending (status: ${request.status}).`,
        );

      // Expire after 7 days
      const created = new Date(request.created_at).getTime();
      if (Date.now() - created > 7 * 24 * 60 * 60 * 1000) {
        await supabase
          .from("payment_plan_change_requests")
          .update({
            status: "expired",
            customer_responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id);
        throw new Error("This approval link has expired.");
      }

      // Fetch the live wedding to re-check outstanding at apply time
      const { data: wedding, error: wErr } = await supabase
        .from("weddings")
        .select(
          "id, total_amount, paid_amount, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, client_name, client_email",
        )
        .eq("id", request.wedding_id)
        .maybeSingle();
      if (wErr) throw wErr;
      if (!wedding) throw new Error("Wedding no longer exists");

      const total = Number(wedding.total_amount) || 0;
      const paid = Number(wedding.paid_amount) || 0;
      const outstanding = total - paid;

      const proposed =
        typeof request.proposed_plan === "string"
          ? JSON.parse(request.proposed_plan)
          : request.proposed_plan;
      const installments: any[] = proposed?.custom_payment_plan?.installments || [];

      const sumProposed = installments.reduce(
        (s, i) => s + (Number(i.amount) || 0),
        0,
      );

      // Re-check: proposed sum must still equal live outstanding
      if (Math.abs(sumProposed - outstanding) > 0.01) {
        await supabase
          .from("payment_plan_change_requests")
          .update({
            status: "expired",
            customer_responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id);
        return new Response(
          JSON.stringify({
            success: false,
            expired: true,
            message:
              "The outstanding balance changed since this plan was proposed. The request has expired — staff will be notified to send a new one.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      // Re-check: no proposed date in the past
      const todayStr = new Date().toISOString().split("T")[0];
      const hasPastDate = installments.some(
        (i) => i.date && i.date < todayStr,
      );
      if (hasPastDate) {
        await supabase
          .from("payment_plan_change_requests")
          .update({
            status: "expired",
            customer_responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id);
        return new Response(
          JSON.stringify({
            success: false,
            expired: true,
            message:
              "One or more proposed payment dates are now in the past. The request has expired — staff will be notified.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      // ── Apply the custom plan to the wedding ──
      await supabase
        .from("weddings")
        .update({
          payment_plan: "custom",
          custom_payment_plan: {
            enabled: true,
            deposit: 0,
            installments: installments.map((i) => ({
              date: i.date,
              amount: Number(i.amount) || 0,
              label: i.label || undefined,
            })),
          },
        })
        .eq("id", wedding.id);

      // ── Cancel the active $250/mo subscription so it can't double-charge ──
      let subscriptionCancelled = false;
      if (
        wedding.stripe_subscription_id &&
        wedding.stripe_subscription_status === "active"
      ) {
        const stripeKey =
          Deno.env.get("STRIPE_SECRET_KEY") || "";
        if (stripeKey) {
          try {
            const stripe = new Stripe(stripeKey, {
              apiVersion: "2023-10-16",
            });
            await stripe.subscriptions.cancel(wedding.stripe_subscription_id, {
              prorate: false,
            });
            await supabase
              .from("weddings")
              .update({ stripe_subscription_status: "canceled" })
              .eq("id", wedding.id);
            subscriptionCancelled = true;
          } catch (e) {
            console.error("Failed to cancel subscription:", e);
          }
        }
      }

      // ── Mark request approved ──
      await supabase
        .from("payment_plan_change_requests")
        .update({
          status: "approved",
          customer_responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      return new Response(
        JSON.stringify({
          success: true,
          subscriptionCancelled,
          weddingName: wedding.client_name,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // ── Decline (couple keeps current schedule) ──
    if (action === "decline") {
      if (!token) throw new Error("Missing approval token");
      const { data: request, error: reqError } = await supabase
        .from("payment_plan_change_requests")
        .select("id, status, wedding_id")
        .eq("customer_token", token)
        .maybeSingle();
      if (reqError) throw reqError;
      if (!request) throw new Error("Invalid or unknown approval link");
      if (request.status !== "pending")
        throw new Error(`This request is no longer pending (status: ${request.status}).`);

      await supabase
        .from("payment_plan_change_requests")
        .update({
          status: "declined",
          customer_responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // ── Fetch a request by token (for the public page) ──
    if (action === "fetch") {
      if (!token) throw new Error("Missing approval token");
      const { data: request, error: reqError } = await supabase
        .from("payment_plan_change_requests")
        .select(
          "id, status, current_plan, proposed_plan, staff_note, created_at, wedding_id",
        )
        .eq("customer_token", token)
        .maybeSingle();
      if (reqError) throw reqError;
      if (!request) throw new Error("Invalid or unknown approval link");

      const { data: wedding, error: wErr } = await supabase
        .from("weddings")
        .select(
          "id, client_name, partner_name, date, package, total_amount, paid_amount, payment_plan, custom_payment_plan",
        )
        .eq("id", request.wedding_id)
        .maybeSingle();
      if (wErr) throw wErr;

      const created = new Date(request.created_at).getTime();
      const expired =
        request.status === "pending" &&
        Date.now() - created > 7 * 24 * 60 * 60 * 1000;

      return new Response(
        JSON.stringify({
          request: { ...request, status: expired ? "expired" : request.status },
          wedding,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // ── Cancel a pending request (staff side) ──
    if (action === "cancel") {
      if (!requestId) throw new Error("Missing request id");
      const { error } = await supabase
        .from("payment_plan_change_requests")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("status", "pending");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Unknown action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
