import { supabase } from "./supabase";
import { currentTerritoryId } from "./current-territory";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";
import type { DbPortalSettings } from "./portal-settings-types";

/**
 * Load the portal_settings row scoped to the current manager's territory
 * (super admin → picked area, or Honeysuckle when "All Areas").
 *
 * With one portal_settings row per area, an unscoped `.limit(1)` would load
 * ANOTHER area's hl_api_key / hl_location_id — so the Settings page would show
 * the wrong Location ID and a freshly-entered API key would 403 when tested
 * against it. This mirrors the save path (updatePortalSettingsRow), which
 * also scopes by currentTerritoryId(), keeping load + save on the same row.
 *
 * Returns null when no row exists for the resolved territory.
 */
export async function loadScopedPortalSettings(): Promise<DbPortalSettings | null> {
  let territoryId: string | null = null;
  try {
    territoryId = await currentTerritoryId();
  } catch {
    /* ignore */
  }
  // Super admin with "All Areas" (null) → Honeysuckle so they still see a row.
  const tid = territoryId ?? HONEYSUCKLE_TERRITORY_ID;
  try {
    const { data, error } = await supabase
      .from("portal_settings")
      .select("*")
      .eq("territory_id", tid)
      .limit(1);
    if (error && error.code !== "42P01") throw error;
    return data && data.length > 0 ? (data[0] as DbPortalSettings) : null;
  } catch (e) {
    console.warn("Could not fetch scoped portal settings.");
    return null;
  }
}
