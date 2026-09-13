import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";

/**
 * Create a card-only SetupIntent for adding a BACKUP card to a territory.
 * Only allowed after a bank account (ACH) is connected as primary.
 * Uses the HQ royalty Stripe account (separate from bride booking).
 *
 * Returns { client_secret, customer_id, publishable_key } or throws.
 */
export async function createRoyaltyCardSetupIntent(): Promise<{
  client_secret: string;
  customer_id?: string;
  publishable_key?: string;
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
    body: JSON.stringify({ action: "create_card_setup_intent" }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Card SetupIntent failed (${response.status}): ${errText}`);
  }
  return response.json();
}
