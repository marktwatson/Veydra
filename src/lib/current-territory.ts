import { supabase } from "./supabase";
import { isSuperAdminEmail } from "./super-admin";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";

/**
 * localStorage key holding the user's chosen "view area" for the main manager
 * lists (Weddings, Proposals, Contractors, Payment Audit).
 *
 *  - Super admin: any territory id, or absent → All Areas (no filter).
 *  - Multi-area manager (territory_ids has > 1 id): one of their allowed ids.
 *    Absent → their home territory_id.
 *
 * This is read by currentTerritoryId() which feeds the list pages.
 * activeTerritoryId() (Packages page) also calls currentTerritoryId() first.
 */
export const SUPER_ADMIN_VIEW_KEY = "veydra_view_territory_id";
export const ALL_AREAS_VALUE = "all";

/** Read the saved view territory (null = All Areas for super admin / default for others). Sync. */
export function getSuperAdminViewTerritory(): string | null {
  try {
    const v = localStorage.getItem(SUPER_ADMIN_VIEW_KEY);
    if (v && v.trim() !== "" && v !== ALL_AREAS_VALUE) return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Set the view territory. Pass null / "all" to clear (All Areas). */
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

/** The user chosen by "view as", or null when this is a normal login. */
function readImpersonatedUser(): {
  id?: string;
  email?: string;
  role?: string;
} | null {
  try {
    const raw = localStorage.getItem("impersonated_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email && !parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Load the logged-in manager's row (territory_id + territory_ids) by email
 * then id. While impersonating, this is the viewed user's row, not the
 * super admin session. Returns null when there is no managers row.
 */
async function loadManagerTerritory(): Promise<{
  territory_id: string | null;
  territory_ids: string[] | null;
} | null> {
  try {
    const impersonated = readImpersonatedUser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = impersonated?.email || user?.email || null;
    const id = impersonated?.id || user?.id || null;
    if (email) {
      const { data: rows } = await supabase
        .from("managers")
        .select("territory_id, territory_ids, status")
        .ilike("email", email)
        .limit(5);
      const list = rows || [];
      const ids = new Set<string>();
      list.forEach((row) => {
        if (row.territory_id) ids.add(row.territory_id);
        const extra = (row.territory_ids as string[]) || [];
        if (Array.isArray(extra)) extra.forEach((id) => id && ids.add(id));
      });
      const mgr =
        list.find((row) => row.status === "active") || list[0] || null;
      if (mgr) {
        return {
          territory_id: mgr.territory_id,
          territory_ids: Array.from(ids),
        };
      }
    }
    if (id) {
      const { data: mgr } = await supabase
        .from("managers")
        .select("territory_id, territory_ids")
        .eq("id", id)
        .maybeSingle();
      if (mgr) return mgr as any;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * The set of areas the current user is allowed to switch between.
 *
 *  - Super admin → null (means "every area"; the switcher lists all).
 *  - Manager / owner with territory_ids → that array (deduped, non-empty).
 *  - Otherwise → [territory_id] (or [Honeysuckle] as a last resort).
 *
 * null return = unrestricted (super admin). An empty array is never returned.
 */
export async function getAllowedTerritoryIds(): Promise<string[] | null> {
  const impersonated = readImpersonatedUser();
  if (!impersonated) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (isSuperAdminEmail(user?.email)) return null; // every area
    } catch {
      /* ignore */
    }
  } else if (impersonated.role === "super_admin") {
    return null;
  }
  const mgr = await loadManagerTerritory();
  const ids = (mgr?.territory_ids as any) || [];
  const home = (mgr?.territory_id as string) || null;
  const set = new Set<string>();
  if (Array.isArray(ids)) ids.forEach((t) => t && set.add(t));
  if (home) set.add(home);
  if (set.size === 0) set.add(HONEYSUCKLE_TERRITORY_ID);
  return Array.from(set);
}

/**
 * Whether the current user should see the header area switcher:
 * super admin, or a manager whose territory_ids has more than one id.
 */
export async function canSwitchAreas(): Promise<boolean> {
  const impersonated = readImpersonatedUser();
  if (!impersonated) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (isSuperAdminEmail(user?.email)) return true;
    } catch {
      /* ignore */
    }
  } else if (impersonated.role === "super_admin") {
    return true;
  }
  const allowed = await getAllowedTerritoryIds();
  return !!allowed && allowed.length > 1;
}

/**
 * The territory the current logged-in user is scoped to.
 *
 *  - Super admin → the picked view area, or null meaning "All Areas"
 *    (manager list fetches must NOT filter).
 *  - Multi-area manager → the saved switcher value if it is still in their
 *    allowed list, else their home territory_id. Never null.
 *  - Single-area manager → their territory_id (or Honeysuckle fallback).
 *
 * Client-side scoping convenience for manager list pages only — NOT a
 * security boundary; access control stays in Supabase RLS.
 */
export async function currentTerritoryId(): Promise<string | null> {
  try {
    const impersonated = readImpersonatedUser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = impersonated?.email || user?.email || null;
    const actingAsSuperAdmin = impersonated
      ? impersonated.role === "super_admin"
      : isSuperAdminEmail(email);

    // Super admin: respect the area picker. null = All Areas (no filter).
    if (actingAsSuperAdmin) return getSuperAdminViewTerritory();

    // Manager / owner: resolve from their managers row.
    const mgr = await loadManagerTerritory();
    const home = (mgr?.territory_id as string) || null;
    const ids = (mgr?.territory_ids as any) || [];
    const allowed = new Set<string>();
    if (Array.isArray(ids)) ids.forEach((t: string) => t && allowed.add(t));
    if (home) allowed.add(home);

    // Selected header area wins when it is one of his assigned areas.
    // Home territory_id is only the default, not a lock.
    const saved = getSuperAdminViewTerritory();
    if (saved && allowed.has(saved)) return saved;

    // Default to home area. Never null for a non-super-admin.
    if (home) return home;
    if (allowed.size > 0) return Array.from(allowed)[0];
    return HONEYSUCKLE_TERRITORY_ID;
  } catch {
    return HONEYSUCKLE_TERRITORY_ID;
  }
}

/**
 * The logged-in manager's territory_id from their managers row, with NO
 * fallback. Returns null if there is no managers row or it has no
 * territory_id.
 *
 * Used by pages that must NOT fall back to Honeysuckle (e.g. Royalty for
 * owners/managers): a null result means "No area assigned". This never
 * consults isSuperAdminEmail, so an owner can never unlock the full area
 * list through it.
 */
export async function getManagerTerritoryIdRaw(): Promise<string | null> {
  const mgr = await loadManagerTerritory();
  return (mgr?.territory_id as string) || null;
}
