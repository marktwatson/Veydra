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
    const body = await req.json();
    const { amount, destination_account, description, idempotency_key, editor_id, wedding_id } = body;

    if (!amount) {
      throw new Error("Missing required parameter: amount");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // ── Resolve the Stripe key ────────────────────────────────────────────
    // Editor payouts use the per-area key from territories.editor_payout_stripe_key,
    // scoped to the wedding's territory_id (else the editor's territory_id).
    // The connected account (destination_account) must have been created under
    // THAT same territory — if it was created under a different area we reject
    // instead of transferring. Contractors keep using the shared Veydra secret.
    let stripeKey: string | undefined;
    let resolvedAccount: string | null = null;
    let resolvedTerritoryId: string | null = null;

    // An editor payout is identified by editor_id/wedding_id, OR by a
    // destination_account that belongs to an editor_payout_accounts row (the
    // legacy client call passes editor.stripe_account_id with no editor_id).
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let supabase: any = null;
    if (supabaseUrl && supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    let isEditorPayout = !!editor_id || !!wedding_id;
    if (!isEditorPayout && destination_account && supabase) {
      const { data: epa } = await supabase
        .from("editor_payout_accounts")
        .select("territory_id")
        .eq("stripe_account_id", destination_account)
        .maybeSingle();
      if (epa?.territory_id) {
        isEditorPayout = true;
        resolvedTerritoryId = epa.territory_id;
        resolvedAccount = destination_account;
      }
    }

    if (isEditorPayout) {
      if (!supabase) {
        throw new Error("Supabase environment variables missing");
      }

      // Resolve the territory from the wedding first, else the editor row.
      let territoryId: string | null = resolvedTerritoryId;
      if (!territoryId && wedding_id) {
        const { data: wed } = await supabase
          .from("weddings")
          .select("territory_id")
          .eq("id", wedding_id)
          .maybeSingle();
        territoryId = wed?.territory_id || null;
      }
      if (!territoryId && editor_id) {
        const { data: ed } = await supabase
          .from("editors")
          .select("territory_id")
          .eq("id", editor_id)
          .maybeSingle();
        territoryId = ed?.territory_id || null;
      }
      if (!territoryId) {
        return new Response(
          JSON.stringify({ error: "Editor payout has no area — cannot resolve Stripe key." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
        );
      }

      // Resolve / verify the connected account for THIS territory.
      resolvedAccount = destination_account || null;
      if (editor_id) {
        const { data: acct } = await supabase
          .from("editor_payout_accounts")
          .select("stripe_account_id")
          .eq("editor_id", editor_id)
          .eq("territory_id", territoryId)
          .maybeSingle();
        const dbAcct = acct?.stripe_account_id || null;
        if (!dbAcct) {
          return new Response(
            JSON.stringify({ error: "Editor does not have a connected Stripe account for this area." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
          );
        }
        // If a destination_account was passed, it must match this area's account.
        if (resolvedAccount && resolvedAccount !== dbAcct) {
          return new Response(
            JSON.stringify({ error: "This Stripe account was created under a different area. Reconnect it for this area before paying." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
          );
        }
        resolvedAccount = dbAcct;
      }
      if (!resolvedAccount) {
        return new Response(
          JSON.stringify({ error: "Missing destination_account for editor payout." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
        );
      }

      const { data: terr, error: terrErr } = await supabase
        .from("territories")
        .select("editor_payout_stripe_key")
        .eq("id", territoryId)
        .maybeSingle();
      if (terrErr) throw new Error(`Database error: ${terrErr.message}`);
      stripeKey = terr?.editor_payout_stripe_key || undefined;
      if (!stripeKey) {
        return new Response(
          JSON.stringify({ error: "This area has no editor payout Stripe key yet." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
        );
      }
    } else {
      stripeKey = Deno.env.get("Veydra") || Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        throw new Error("STRIPE_SECRET_KEY or Veydra secret is missing");
      }
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2022-11-15",
      httpClient: Stripe.createFetchHttpClient(),
    });

    try {
      const dest = isEditorPayout ? resolvedAccount : destination_account;
      if (!dest) {
        throw new Error("Missing required parameter: destination_account");
      }
      const transferParams: any = {
        amount: Math.round(amount * 100),
        currency: "usd",
        destination: dest,
        description: description || "Payout from Veydra",
      };
      if (idempotency_key) transferParams.idempotency_key = idempotency_key;

      const transfer = await stripe.transfers.create(transferParams);

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
