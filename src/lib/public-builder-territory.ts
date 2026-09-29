import { supabase } from "./supabase";
import { resolveTerritoryBySlug } from "./territory";
import { getPortalSettingsForTerritory } from "./apply-territory-settings";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";

export interface PublicBuilderTerritory {
  id: string;
  found: boolean;
  settings: {
    company_name?: string | null;
    logo_url?: string | null;
    app_url?: string | null;
    sales_pin?: string | null;
  } | null;
}

/**
 * Resolve the territory for the public proposal builder from a slug, and
 * load that area's portal_settings (company name, logo, sales PIN). Returns
 * found:false for an unknown slug so the page can render the "Unknown
 * location" state without inserting anything.
 */
export async function loadPublicBuilderTerritory(
  slug?: string,
): Promise<PublicBuilderTerritory> {
  const resolved = await resolveTerritoryBySlug(slug);
  if (!resolved.found || !resolved.id) {
    return { id: "", found: false, settings: null };
  }
  const settings = await getPortalSettingsForTerritory(resolved.id);
  return {
    id: resolved.id,
    found: true,
    settings: settings
      ? {
          company_name: settings.company_name,
          logo_url: (settings as any).logo_url,
          app_url: settings.app_url,
          sales_pin: (settings as any).sales_pin,
        }
      : null,
  };
}

/**
 * Load the packages + addons for a territory id (anon read — pricing tables
 * have public RLS). Falls back to the booking fallbacks if the DB is empty.
 */
export async function loadPublicBuilderPackages(territoryId: string) {
  const { FALLBACK_PACKAGES_SLIM, FALLBACK_ADDONS_SLIM } =
    await import("./booking-fallbacks");
  let packages: any[] = FALLBACK_PACKAGES_SLIM;
  let addons: any[] = FALLBACK_ADDONS_SLIM;
  try {
    const { data: pkgData } = await supabase
      .from("pricing_packages")
      .select("*")
      .eq("territory_id", territoryId)
      .eq("is_archived", false)
      .order("sort_order", { ascending: true });
    if (pkgData && pkgData.length) {
      packages = pkgData.map((p: any) => ({
        id: p.id,
        name: p.name,
        desc: p.description,
        priceBoth: Number(p.price_both),
        priceSingle: Number(p.price_single),
        photoFeatures: p.photo_features || [],
        videoFeatures: p.video_features || [],
        isArchived: p.is_archived,
        sortOrder: p.sort_order,
      }));
    }
  } catch {
    /* keep fallback */
  }
  try {
    const { data: addonData } = await supabase
      .from("pricing_addons")
      .select("*")
      .eq("territory_id", territoryId)
      .eq("is_archived", false)
      .order("sort_order", { ascending: true });
    if (addonData && addonData.length) {
      addons = addonData.map((a: any) => ({
        id: a.id,
        name: a.name,
        price: Number(a.price),
        isHourly: a.is_hourly,
        minHours: Number(a.min_hours) || 0,
        isArchived: a.is_archived,
        isBartending: a.is_bartending || false,
        description: a.description || "",
        features: a.features || [],
        sortOrder: a.sort_order,
      }));
    }
  } catch {
    /* keep fallback */
  }
  return { packages, addons };
}

export { HONEYSUCKLE_TERRITORY_ID };
