import { supabase } from "./supabase";

/**
 * Honeysuckle fallback territory id — the legacy single-territory project.
 * Used when no manager territory and no is_primary territory is found.
 */
export const HONEYSUCKLE_TERRITORY_ID = "0bbaebfc-1c51-4ebe-98b4-e2e9697ef33d";

/**
 * Resolve the territory_id to stamp on a new wedding/proposal.
 *
 * Order:
 *   1. Logged-in manager's managers.territory_id (if set).
 *   2. The first territory where is_primary = true (Honeysuckle).
 *   3. The hard-coded Honeysuckle fallback id.
 *
 * `managerId` is the auth user id used to look up the managers row.
 */
export async function resolveTerritoryId(
  managerId?: string | null,
): Promise<string> {
  // 1. Logged-in manager's territory_id.
  if (managerId) {
    try {
      const { data: mgr } = await supabase
        .from("managers")
        .select("territory_id")
        .eq("id", managerId)
        .maybeSingle();
      if (mgr?.territory_id) return mgr.territory_id as string;
    } catch {
      // fall through
    }
  }

  // 2. The is_primary territory (Honeysuckle).
  try {
    const { data: primary } = await supabase
      .from("territories")
      .select("id")
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    if (primary?.id) return primary.id as string;
  } catch {
    // fall through
  }

  // 3. Hard-coded Honeysuckle fallback.
  return HONEYSUCKLE_TERRITORY_ID;
}

/**
 * Resolve a territory by its public apply slug (case-insensitive).
 *
 *  - No slug (plain /apply) → the Honeysuckle territory.
 *  - Slug present but no matching row → { found: false } (caller shows an
 *    "Unknown location" page and does NOT insert a contractor).
 *  - Slug matches → that row's id.
 *
 * Used by the public Apply page to scope a new contractor application to the
 * correct area.
 */
export async function resolveTerritoryBySlug(
  slug?: string,
): Promise<{ id: string; found: true } | { id: null; found: false }> {
  if (!slug) return { id: HONEYSUCKLE_TERRITORY_ID, found: true };
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
