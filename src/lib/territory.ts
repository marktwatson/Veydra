import { supabase } from "./supabase";
import { getSuperAdminViewTerritory } from "./current-territory";
import { isSuperAdminEmail } from "./super-admin";

/**
 * Honeysuckle fallback territory id — the legacy single-territory project.
 * Kept for callers that still need a concrete id (e.g. Apply's
 * /apply/honeysuckle route, portal_settings reads). resolveTerritoryId no
 * longer falls back to it on insert — a null result means "no area picked".
 */
export const HONEYSUCKLE_TERRITORY_ID = "0bbaebfc-1c51-4ebe-98b4-e2e9697ef33d";

/**
 * Resolve the territory_id to stamp on a new wedding/proposal.
 *
 * Order:
 *   1. Super-admin area switcher (getSuperAdminViewTerritory(), a real id —
 *      not "all"). This is the area the super admin is currently viewing.
 *   2. The logged-in manager's managers.territory_id (if set).
 *
 * If neither is set, returns null — the caller must NOT insert and should
 * toast "Pick an area before adding this." Never stamp the primary /
 * Honeysuckle id just because no area was picked.
 *
 * `managerId` is the auth user id used to look up the managers row.
 */
export async function resolveTerritoryId(
  managerId?: string | null,
): Promise<string | null> {
  // 1. Super-admin area switcher (the area currently being viewed).
  const switcherId = getSuperAdminViewTerritory();
  if (switcherId) return switcherId;

  // Only super admins can have a null switcher ("All Areas"). For everyone
  // else, fall through to their managers.territory_id.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email ?? null;
    const id = managerId ?? user?.id ?? null;

    // 2. Logged-in manager's territory_id (by email, then by id).
    if (email) {
      const { data: mgr } = await supabase
        .from("managers")
        .select("territory_id")
        .ilike("email", email)
        .maybeSingle();
      if (mgr?.territory_id) return mgr.territory_id as string;
    }
    if (id) {
      const { data: mgr } = await supabase
        .from("managers")
        .select("territory_id")
        .eq("id", id)
        .maybeSingle();
      if (mgr?.territory_id) return mgr.territory_id as string;
    }
  } catch {
    // fall through to null
  }

  // No area picked and no manager territory. Do NOT fall back to Honeysuckle.
  return null;
}

/**
 * Resolve a territory by its public apply slug (case-insensitive).
 *
 *  - No slug (plain /apply) → { found: false } — the caller renders the
 *    "Unknown location" page and does NOT insert a contractor.
 *  - "honeysuckle" → the Honeysuckle pipeline (always resolves to the
 *    Honeysuckle territory id, even without a matching territories row).
 *  - Other slug present but no matching row → { found: false }.
 *  - Slug matches → that row's id.
 *
 * Used by the public Apply page to scope a new contractor application to the
 * correct area.
 */
export async function resolveTerritoryBySlug(
  slug?: string,
): Promise<{ id: string; found: true } | { id: null; found: false }> {
  // No slug → Unknown location. Do not insert a contractor.
  if (!slug) return { id: null, found: false };

  // /apply/honeysuckle is the legacy Honeysuckle pipeline.
  if (slug.toLowerCase() === "honeysuckle") {
    return { id: HONEYSUCKLE_TERRITORY_ID, found: true };
  }

  try {
    const { data } = await supabase
      .from("territories")
      .select("id")
      .ilike("slug", slug)
      .limit(1)
      .maybeSingle();
    if (data?.id) return { id: data.id as string, found: true };
    return { id: null, found: false };
  } catch {
    return { id: null, found: false };
  }
}
