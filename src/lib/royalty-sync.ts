import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";

/**
 * Sync payment methods from the royalty Stripe account into the territory row.
 *
 * The royalty-processor edge function's `sync_payment_method` action lists the
 * bank accounts + cards attached to this territory's Stripe customer and, if
 * one exists, writes its id into `primary_payment_method_id` /
 * `stripe_payment_method_id` and flips `stripe_connected` / `stripe_royalty_configured`
 * to true.
 *
 * This is meant to be called on Royalty page load when no payment method is on
 * file — so a bank account that was attached directly in Stripe (or via a prior
 * setup that didn't write the DB columns) is detected automatically and the
 * "Connect Bank Account" prompt clears without a manual click.
 *
 * Returns { success, payment_method_id?, type?, details? } or throws.
 */
export async function syncRoyaltyPaymentMethod(): Promise<{
  success: boolean;
  payment_method_id?: string;
  type?: string;
  details?: string;
  message?: string;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const functionUrl = `${supabaseUrl}/functions/v1/royalty-processor`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ action: "sync_payment_method" }),
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error(
      "[Royalty] sync_payment_method failed:",
      response.status,
      errText,
    );
    throw new Error(`Sync failed (${response.status}): ${errText}`);
  }
  return response.json();
}
