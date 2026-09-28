import { supabase } from "./supabase";
import { currentTerritoryId } from "./current-territory";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";
import { updatePortalSettingsRow } from "./portal-settings-update";
import type { DbPortalSettings } from "./api";

/** Parse a regions value (array, JSON string, or Postgres array literal). */
function parseRegionsArray(regions: any): string[] {
  if (!regions) return [];
  let parsed: string[] = [];
  if (Array.isArray(regions)) {
    parsed = regions;
  } else if (typeof regions === "string") {
    try {
      const j = JSON.parse(regions);
      if (Array.isArray(j)) {
        parsed = j;
      } else {
        parsed = [regions];
      }
    } catch (e) {
      if (regions.startsWith("{") && regions.endsWith("}")) {
        parsed = regions.slice(1, -1).split(",");
      } else if (regions.includes(",")) {
        parsed = regions.split(",");
      } else {
        parsed = [regions];
      }
    }
  }
  return parsed
    .map((s) => (typeof s === "string" ? s.trim() : String(s)))
    .filter((s) => s !== "");
}

/**
 * Per-area packages, addons, and portal_settings.
 *
 * pricing_packages and pricing_addons now use primary key (id, territory_id),
 * and portal_settings has one row per area. These helpers stamp the logged-in
 * manager's territory_id on every write and pick the matching row on read.
 *
 * Reads of packages/addons stay unfiltered in JS — RLS scopes them. Writes
 * always include territory_id and upsert on (id, territory_id).
 */

/** Resolve the territory_id to stamp on a write: manager's territory, or
 *  Honeysuckle for super admin (currentTerritoryId() === null). */
export async function writeTerritoryId(): Promise<string> {
  const t = await currentTerritoryId();
  return t ?? HONEYSUCKLE_TERRITORY_ID;
}

// ---------------------------------------------------------------------------
// Portal settings
// ---------------------------------------------------------------------------

export async function getPortalSettings(): Promise<DbPortalSettings | null> {
  let settings: DbPortalSettings | null = null;
  try {
    // Multi-territory: portal_settings now has one row per area. Pick the
    // row whose territory_id matches the logged-in manager. Super admin
    // (currentTerritoryId() === null) gets the Honeysuckle row. Never use a
    // bare .limit(1) — that returns an arbitrary area's keys/templates.
    const myTerritory = await currentTerritoryId();
    const territoryId = myTerritory ?? HONEYSUCKLE_TERRITORY_ID;

    const { data, error } = await supabase
      .from("portal_settings")
      .select("*")
      .eq("territory_id", territoryId)
      .limit(1);
    if (error && error.code !== "42P01") throw error; // Ignore table not found
    settings = data && data.length > 0 ? (data[0] as DbPortalSettings) : null;
  } catch (e) {
    console.warn("Could not fetch portal settings. Table might not exist yet.");
  }

  // Parse regions and excluded_campaign_ids if string
  if (settings && typeof settings.regions === "string") {
    settings.regions = parseRegionsArray(settings.regions);
  }
  if (settings && typeof settings.excluded_campaign_ids === "string") {
    try {
      settings.excluded_campaign_ids = JSON.parse(
        settings.excluded_campaign_ids as unknown as string,
      );
    } catch (e) {
      settings.excluded_campaign_ids = [];
    }
  }
  if (settings && typeof settings.manual_expenses === "string") {
    try {
      settings.manual_expenses = JSON.parse(
        settings.manual_expenses as unknown as string,
      );
    } catch (e) {
      settings.manual_expenses = [];
    }
  }

  // Fallback to local storage for regions if not found in DB
  if (!settings || !settings.regions || settings.regions.length === 0) {
    try {
      const localRegions = localStorage.getItem("veydra_regions");
      if (localRegions) {
        const parsedRegions = JSON.parse(localRegions);
        if (parsedRegions && parsedRegions.length > 0) {
          settings =
            settings ||
            ({
              id: "local",
              updated_at: new Date().toISOString(),
            } as DbPortalSettings);
          settings.regions = parsedRegions;
        }
      }
    } catch (e) {}
  }

  // Fallback to local storage for rates
  if (settings) {
    if (
      settings.photo_pay_rate === undefined ||
      settings.photo_pay_rate === null
    ) {
      try {
        const localPhotoRate = localStorage.getItem("veydra_photo_pay_rate");
        if (localPhotoRate) settings.photo_pay_rate = Number(localPhotoRate);
      } catch (e) {}
    }
    if (
      settings.video_pay_rate === undefined ||
      settings.video_pay_rate === null
    ) {
      try {
        const localVideoRate = localStorage.getItem("veydra_video_pay_rate");
        if (localVideoRate) settings.video_pay_rate = Number(localVideoRate);
      } catch (e) {}
    }
  }

  // Default fallback if still empty
  if (!settings || !settings.regions || settings.regions.length === 0) {
    settings =
      settings ||
      ({
        id: "default",
        updated_at: new Date().toISOString(),
      } as DbPortalSettings);
    settings.regions = ["Charlotte", "Raleigh"];
  }

  return settings;
}

export async function updatePortalSettings(
  settings: Partial<DbPortalSettings>,
  onUpdated?: () => Promise<void>,
): Promise<Record<string, any>> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(
            "Database request timed out after 30 seconds. Please check your internet connection or Supabase status.",
          ),
        ),
      30000,
    );
  });

  const task = async () => {
    try {
      // Stamp the manager's territory on the patch so the update targets the
      // correct area row. updatePortalSettingsRow filters by territory_id.
      const territoryId = await writeTerritoryId();
      const result = await updatePortalSettingsRow(settings, territoryId);
      if (onUpdated) onUpdated().catch(console.error);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return Promise.race([task(), timeoutPromise]) as Promise<Record<string, any>>;
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

export async function getPackages(includeArchived = false) {
  // Unfiltered in JS — RLS scopes by my_territory_id(). Super admin sees all.
  let query = supabase
    .from("pricing_packages")
    .select("*")
    .order("sort_order", { ascending: true });
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((p: any) => ({
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

export async function savePackage(pkg: {
  id?: string;
  name: string;
  description: string;
  priceBoth: number;
  priceSingle: number;
  photoFeatures: string[];
  videoFeatures: string[];
  isArchived: boolean;
}) {
  const territoryId = await writeTerritoryId();

  let id = pkg.id;
  if (!id) {
    const baseId = pkg.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    // Check if a package with this (id, territory_id) already exists to avoid
    // overwriting — id is no longer globally unique.
    const { data: existing } = await supabase
      .from("pricing_packages")
      .select("id")
      .eq("id", baseId)
      .eq("territory_id", territoryId)
      .maybeSingle();
    if (existing) {
      id = `${baseId}_copy_${Date.now().toString(36)}`;
    } else {
      id = baseId;
    }
  }
  const payload = {
    id,
    territory_id: territoryId,
    name: pkg.name,
    description: pkg.description,
    price_both: pkg.priceBoth,
    price_single: pkg.priceSingle,
    photo_features: pkg.photoFeatures,
    video_features: pkg.videoFeatures,
    is_archived: pkg.isArchived,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("pricing_packages")
    .upsert(payload, { onConflict: "id,territory_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePackage(id: string) {
  const territoryId = await writeTerritoryId();
  // id is only unique within a territory — filter by territory_id too.
  const { error } = await supabase
    .from("pricing_packages")
    .delete()
    .eq("id", id)
    .eq("territory_id", territoryId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Addons
// ---------------------------------------------------------------------------

export async function getAddons(includeArchived = false) {
  // Unfiltered in JS — RLS scopes by my_territory_id(). Super admin sees all.
  let query = supabase
    .from("pricing_addons")
    .select("*")
    .order("sort_order", { ascending: true });
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((a: any) => ({
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

export async function saveAddon(addon: {
  id?: string;
  name: string;
  price: number;
  isHourly: boolean;
  minHours: number;
  isArchived: boolean;
  isBartending?: boolean;
  description?: string;
  features?: string[];
}) {
  const territoryId = await writeTerritoryId();

  const id =
    addon.id ||
    addon.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  const payload = {
    id,
    territory_id: territoryId,
    name: addon.name,
    price: addon.price,
    is_hourly: addon.isHourly,
    min_hours: addon.minHours,
    is_archived: addon.isArchived,
    is_bartending: addon.isBartending || false,
    description: addon.description || "",
    features: addon.features || [],
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("pricing_addons")
    .upsert(payload, { onConflict: "id,territory_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAddon(id: string) {
  const territoryId = await writeTerritoryId();
  // id is only unique within a territory — filter by territory_id too.
  const { error } = await supabase
    .from("pricing_addons")
    .delete()
    .eq("id", id)
    .eq("territory_id", territoryId);
  if (error) throw error;
}
