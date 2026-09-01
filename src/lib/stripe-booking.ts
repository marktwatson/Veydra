/**
 * Dynamic Stripe loader for the BRIDE BOOKING / proposal payment account.
 *
 * Previously the booking publishable key (pk_live_...) was hardcoded in
 * Book.tsx and ProposalReview.tsx. If the Stripe account ever changed,
 * checkout would silently break because the frontend key and the
 * stripe-checkout edge function's STRIPE_SECRET_KEY env var could drift
 * apart.
 *
 * Now the key is fetched from the stripe-checkout edge function (which
 * reads STRIPE_PUBLISHABLE_KEY from its env) — the same pattern Royalty
 * uses for its separate account. The edge function also returns the key
 * inline on every checkout response, so we prefer that to avoid an extra
 * round-trip.
 *
 * Fallback: if the edge function isn't configured yet (no env var), we
 * fall back to the last-known hardcoded key so existing deployments keep
 * working while you set STRIPE_PUBLISHABLE_KEY on the edge function.
 */
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase";

// Last-known key kept ONLY as a fallback so nothing breaks during the
// transition. Once STRIPE_PUBLISHABLE_KEY is set on the edge function,
// this is never used.
const FALLBACK_PUBLISHABLE_KEY = "pk_live_ksr3XxUGn2LLl5mf847DsThU";

let cachedPromise: Promise<Stripe | null> | null = null;
let cachedKey: string | null = null;

/**
 * Fetch the booking publishable key from the edge function (GET).
 * Returns null if unavailable.
 */
export async function fetchBookingPublishableKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.publishable_key) {
        cachedKey = data.publishable_key;
        return cachedKey;
      }
    }
  } catch (e) {
    console.warn("[stripe-booking] Could not fetch publishable key:", e);
  }
  return null;
}

/**
 * Load a Stripe instance for the booking account.
 *
 * @param inlineKey - If the checkout response already included the
 *   publishable key, pass it here to skip the extra GET round-trip.
 */
export function loadBookingStripe(inlineKey?: string): Promise<Stripe | null> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    let key = inlineKey || (await fetchBookingPublishableKey());
    if (!key) {
      console.warn(
        "[stripe-booking] Edge function did not return a publishable key — using fallback. Set STRIPE_PUBLISHABLE_KEY on the stripe-checkout edge function to remove this warning.",
      );
      key = FALLBACK_PUBLISHABLE_KEY;
    }
    return loadStripe(key);
  })();

  return cachedPromise;
}
