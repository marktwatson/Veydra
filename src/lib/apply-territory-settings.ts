import { supabase } from "./supabase";

export interface ApplyPortalSettings {
  company_name?: string | null;
  logo_url?: string | null;
  app_url?: string | null;
  hl_api_key?: string | null;
  hl_location_id?: string | null;
  regions?: string[];
}

function parseRegions(regions: any): string[] {
  if (!regions) return [];
  if (Array.isArray(regions)) return regions as string[];
  if (typeof regions === "string") {
    try {
      const parsed = JSON.parse(regions);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return regions
      .replace(/[\[\]"]/g, "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Load the portal_settings row scoped to a territory id (NOT a .limit(1)
 * global grab). Returns null when no row exists for that territory — the
 * caller should skip CRM tracking but still save the contractor.
 */
export async function getPortalSettingsForTerritory(
  territoryId: string,
): Promise<ApplyPortalSettings | null> {
  let settings: ApplyPortalSettings | null = null;
  try {
    const { data, error } = await supabase
      .from("portal_settings")
      .select("*")
      .eq("territory_id", territoryId)
      .limit(1);
    if (error && error.code !== "42P01") throw error;
    settings =
      data && data.length > 0 ? (data[0] as ApplyPortalSettings) : null;
  } catch (e) {
    console.warn("Could not fetch portal settings for territory.");
  }
  if (settings && typeof settings.regions === "string") {
    settings.regions = parseRegions(settings.regions);
  }
  return settings;
}
