import { supabase } from "./supabase";
import { isSuperAdminEmail } from "./super-admin";
import { currentTerritoryId } from "./current-territory";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";

const ACTIVE_TERRITORY_KEY = "veydra_active_territory_id";

/**
 * The territory the current user is actively viewing/editing packages for.
 *
 *  - Manager / owner / owner_readonly → currentTerritoryId() (their own
 *    managers.territory_id, or Honeysuckle if none). This is the only area
 *    they can see, so it is always the active one.
 *  - Super admin → localStorage `veydra_active_territory_id` if set, else
 *    Honeysuckle. The Settings → Packages page exposes a Territory <Select>
 *    that writes that localStorage value so a super admin can edit any area's
 *    packages without a full territory switcher.
 *
 * Reads of pricing_packages / pricing_addons must .eq("territory_id",
 * activeTerritoryId()) so a super admin never silently sees every area's
 * packages at once.
 */
export async function activeTerritoryId(): Promise<string> {
  // Non-super-admins are locked to their own territory.
  const mine = await currentTerritoryId();
  if (mine) return mine;

  // Super admin (currentTerritoryId() === null): use the localStorage picker
  // value, defaulting to Honeysuckle.
  try {
    const stored = localStorage.getItem(ACTIVE_TERRITORY_KEY);
    if (stored && stored.trim() !== "") return stored;
  } catch {
    /* ignore */
  }
  return HONEYSUCKLE_TERRITORY_ID;
}

/** Set the super-admin active territory (from the Settings → Packages
 *  picker). No-op for non-super-admins. */
export function setActiveTerritoryId(territoryId: string): void {
  try {
    localStorage.setItem(ACTIVE_TERRITORY_KEY, territoryId);
  } catch {
    /* ignore */
  }
}

/** Whether the current user is a super admin (and thus sees the Territory
 *  picker on Settings → Packages). */
export async function isSuperAdminActive(): Promise<boolean> {
  try {
    const raw = localStorage.getItem("impersonated_user");
    if (raw) {
      const impersonated = JSON.parse(raw);
      return impersonated?.role === "super_admin";
    }
  } catch {
    /* ignore */
  }
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return isSuperAdminEmail(user?.email);
  } catch {
    return false;
  }
}

/** Load all territories for the super-admin picker. */
export async function loadTerritoriesForPicker(): Promise<
  { id: string; name: string; slug: string | null }[]
> {
  try {
    const { data, error } = await supabase
      .from("territories")
      .select("id, name, slug")
      .order("name");
    if (error) throw error;
    return (data || []) as { id: string; name: string; slug: string | null }[];
  } catch {
    return [];
  }
}
