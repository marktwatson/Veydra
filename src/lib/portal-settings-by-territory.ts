import { supabase } from "./supabase";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";

/**
 * Load portal_settings (branding) for a specific territory — used by
 * client-facing pages (Bride Portal, Book) where there is no logged-in
 * manager to scope from.
 *
 * Never a bare .single() — portal_settings has one row per area now.
 * Falls back to the Honeysuckle row when territoryId is missing.
 */
export async function getPortalSettingsForTerritory(
  territoryId: string | null | undefined,
): Promise<any | null> {
  const tid = territoryId || HONEYSUCKLE_TERRITORY_ID;
  const { data, error } = await supabase
    .from("portal_settings")
    .select("*")
    .eq("territory_id", tid)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
}
