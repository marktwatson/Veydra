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
