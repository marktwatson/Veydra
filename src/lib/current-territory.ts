import { supabase } from "./supabase";
import { isSuperAdminEmail } from "./super-admin";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";

/**
 * localStorage key holding the super admin's chosen "view area" for the main
 * manager lists (Weddings, Proposals, Contractors, Payment Audit).
 *
 *  - Absent / "all"  → All Areas (no territory filter; see everything).
 *  - A territory id  → lists are scoped to that single area.
 *
 * This is read by currentTerritoryId() for super admins, which in turn feeds
 * the four list pages. activeTerritoryId() (Packages page) also calls
 * currentTerritoryId() first, so picking an area here scopes Packages too;
 * when "All Areas" is selected, Packages fall back to its own picker.
 */
export const SUPER_ADMIN_VIEW_KEY = "veydra_view_territory_id";
export const ALL_AREAS_VALUE = "all";

/** Read the super-admin view territory (null = All Areas). Sync, no auth call. */
export function getSuperAdminViewTerritory(): string | null {
  try {
    const v = localStorage.getItem(SUPER_ADMIN_VIEW_KEY);
    if (v && v.trim() !== "" && v !== ALL_AREAS_VALUE) return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Set the super-admin view territory. Pass null / "all" to clear (All Areas). */
export function setSuperAdminViewTerritory(id: string | null): void {
  try {
    if (id && id !== ALL_AREAS_VALUE) {
      localStorage.setItem(SUPER_ADMIN_VIEW_KEY, id);
    } else {
      localStorage.removeItem(SUPER_ADMIN_VIEW_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * The territory the current logged-in user is scoped to.
 *
 *  - Super admin (isSuperAdminEmail) → the picked view area, or null meaning
 *    "All Areas" (manager list fetches must NOT filter).
 *  - A manager with managers.territory_id set → that id.
 *  - Anyone else with no managers row → the Honeysuckle fallback.
 *
 * Looked up by the auth user's email first, then by id. This is a
 * client-side scoping convenience for manager list pages only — it is
 * NOT a security boundary; access control stays in Supabase RLS.
 */
export async function currentTerritoryId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email ?? null;
    const id = user?.id ?? null;

    // Super admin: respect the area picker. null = All Areas (no filter).
    if (isSuperAdminEmail(email)) return getSuperAdminViewTerritory();

    // Look up the managers row by email (case-insensitive), then by id.
    if (email) {
      const { data: mgrByEmail } = await supabase
        .from("managers")
        .select("territory_id")
        .ilike("email", email)
        .maybeSingle();
      if (mgrByEmail?.territory_id) return mgrByEmail.territory_id as string;
    }
    if (id) {
      const { data: mgrById } = await supabase
        .from("managers")
        .select("territory_id")
        .eq("id", id)
        .maybeSingle();
      if (mgrById?.territory_id) return mgrById.territory_id as string;
    }

    // No managers row → Honeysuckle fallback.
    return HONEYSUCKLE_TERRITORY_ID;
  } catch {
    // If anything fails, fall back to the Honeysuckle id so the user still
    // sees *something* rather than an unfiltered list.
    return HONEYSUCKLE_TERRITORY_ID;
  }
}

/**
 * The logged-in manager's territory_id from their managers row, with NO
 * fallback. Returns null if there is no managers row or it has no
 * territory_id.
 *
 * Used by pages that must NOT fall back to Honeysuckle (e.g. Royalty for
 * owners/managers): a null result means "No area assigned" — do not load
 * Honeysuckle royalty. This never consults isSuperAdminEmail, so an owner
 * can never unlock the full area list through it.
 */
export async function getManagerTerritoryIdRaw(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email ?? null;
    const id = user?.id ?? null;
    if (email) {
      const { data: mgrByEmail } = await supabase
        .from("managers")
        .select("territory_id")
        .ilike("email", email)
        .maybeSingle();
      if (mgrByEmail) return (mgrByEmail.territory_id as string) || null;
    }
    if (id) {
      const { data: mgrById } = await supabase
        .from("managers")
        .select("territory_id")
        .eq("id", id)
        .maybeSingle();
      if (mgrById) return (mgrById.territory_id as string) || null;
    }
    return null;
  } catch {
    return null;
  }
}
