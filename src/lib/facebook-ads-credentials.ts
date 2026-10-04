import { supabase } from "./supabase";
import { resolveTerritoryId } from "./territory";

/**
 * Load Facebook Ads credentials from the viewed area's portal_settings row
 * only. portal_settings has one row per area now, so a bare .single() either
 * errors or returns another area's token. Never fall back to another area.
 *
 * Throws "Missing Credentials" when the viewed area has no token/account.
 */
export async function loadFacebookAdsCredentials(): Promise<{
  fb_access_token: string;
  fb_ad_account_id: string;
}> {
  const tid = await resolveTerritoryId().catch(() => null);
  let query = supabase
    .from("portal_settings")
    .select("fb_access_token, fb_ad_account_id");
  if (tid) query = query.eq("territory_id", tid);
  const { data: settings } = await query.limit(1).maybeSingle();
  if (!settings?.fb_access_token || !settings?.fb_ad_account_id) {
    console.warn("Missing Facebook API credentials in portal_settings.");
    throw new Error("Missing Credentials");
  }
  return {
    fb_access_token: settings.fb_access_token,
    fb_ad_account_id: settings.fb_ad_account_id,
  };
}
