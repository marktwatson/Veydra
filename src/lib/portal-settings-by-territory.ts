import { supabase } from "./supabase";
import { HONEYSUCKLE_TERRITORY_ID, resolveTerritoryId } from "./territory";

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

/**
 * Load the regions list for a coverage request.
 *
 * portal_settings has one row per area now, so a bare .maybeSingle() on the
 * whole table errors when multiple rows exist and the dropdown stays empty.
 *
 * Resolution order for the territory id:
 *   1. The proposal's own territory_id (passed in).
 *   2. The viewed area (super-admin switcher → manager territory) via
 *      resolveTerritoryId().
 *   3. Honeysuckle as a last resort (never a bare unscoped query).
 *
 * Returns [] if no row is found — the caller shows an empty dropdown.
 */
export async function getRegionsForTerritory(
  proposalTerritoryId?: string | null,
): Promise<string[]> {
  let tid = proposalTerritoryId || null;
  if (!tid) {
    try {
      tid = await resolveTerritoryId();
    } catch {
      tid = null;
    }
  }
  if (!tid) tid = HONEYSUCKLE_TERRITORY_ID;

  const { data, error } = await supabase
    .from("portal_settings")
    .select("regions")
    .eq("territory_id", tid)
    .limit(1)
    .maybeSingle();
  if (error || !data) return [];
  return Array.isArray(data.regions) ? (data.regions as string[]) : [];
}
