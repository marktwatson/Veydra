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
    const { contractor_id, user_id, user_type, email, country, return_url, refresh_url, territory_id } = body;

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

    // ── Resolve the Stripe key ────────────────────────────────────────────
    // Editors use the per-area key from territories.editor_payout_stripe_key
    // (scoped to the editor's territory). Contractors keep using the shared
    // Veydra edge secret. An editor with no area key is rejected — we never
    // fall back to Veydra for a new area editor connection.
    let stripeKey: string | undefined;
    let resolvedTerritoryId: string | null = null;

    if (user_type === "editor") {
      // Body territory_id wins; else read it off the editor row.
      resolvedTerritoryId = territory_id || null;
      if (!resolvedTerritoryId) {
        const { data: ed } = await supabase
          .from("editors")
          .select("territory_id")
          .eq("id", targetId)
          .maybeSingle();
        resolvedTerritoryId = ed?.territory_id || null;
      }
      if (!resolvedTerritoryId) {
        return new Response(
          JSON.stringify({ error: "This area has no editor payout Stripe key yet." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
        );
      }
      const { data: terr, error: terrErr } = await supabase
        .from("territories")
        .select("editor_payout_stripe_key")
        .eq("id", resolvedTerritoryId)
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
        throw new Error("Veydra secret key is missing");
      }
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2022-11-15",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ── Look up an existing connected account ──────────────────────────────
    // For editors, the account is stored per-territory in editor_payout_accounts
    // (an editor editing two areas keeps two acct_ rows). For contractors it
    // stays on the contractors row as before.
    let accountId: string | null = null;

    if (user_type === "editor" && resolvedTerritoryId) {
      const { data: acctRow } = await supabase
        .from("editor_payout_accounts")
        .select("stripe_account_id")
        .eq("editor_id", targetId)
        .eq("territory_id", resolvedTerritoryId)
        .maybeSingle();
      accountId = acctRow?.stripe_account_id || null;
    } else {
      const { data: userRecord, error } = await supabase
        .from(targetTable)
        .select("stripe_account_id")
        .eq("id", targetId)
        .single();
      if (error) throw new Error(`Database error: ${error.message}`);
      accountId = userRecord?.stripe_account_id || null;
    }

    if (!accountId) {
      const capabilities: any = { transfers: { requested: true } };
      const accountCountry = country || "US";
      const accountParams: any = {
        type: "express",
        country: accountCountry,
        email: email,
      };

      if (accountCountry === "US") {
        capabilities.card_payments = { requested: true };
      } else {
        accountParams.tos_acceptance = { service_agreement: 'recipient' };
      }

      accountParams.capabilities = capabilities;

      const account = await stripe.accounts.create(accountParams);
      accountId = account.id;

      // Save the connected account against THIS territory only.
      if (user_type === "editor" && resolvedTerritoryId) {
        const { error: upErr } = await supabase
          .from("editor_payout_accounts")
          .upsert(
            { editor_id: targetId, territory_id: resolvedTerritoryId, stripe_account_id: accountId },
            { onConflict: "editor_id,territory_id" },
          );
        if (upErr) throw new Error(`Failed to save Stripe ID: ${upErr.message}`);
      } else {
        const { error: updateError } = await supabase
          .from(targetTable)
          .update({ stripe_account_id: accountId })
          .eq("id", targetId);
        if (updateError) throw new Error(`Failed to save Stripe ID: ${updateError.message}`);
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
