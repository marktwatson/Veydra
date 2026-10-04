import { supabase } from "./supabase";
import type { DbContractor } from "./api";

/** DbContractor plus the territory_id column (added after the interface). */
export type ContractorWithEmail = DbContractor & {
  territory_id?: string | null;
};

function parseRegionsArray(regions: any): string[] {
  if (!regions) return [];
  if (Array.isArray(regions)) return regions.filter(Boolean) as string[];
  if (typeof regions === "string") {
    try {
      const parsed = JSON.parse(regions);
      if (Array.isArray(parsed)) return parsed.filter(Boolean) as string[];
    } catch {
      /* fall through to comma split */
    }
    return regions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Load the logged-in contractor by their auth email, case-insensitive, with NO
 * territory filter. This is the contractor's own profile lookup — it must not
 * depend on the manager area switcher or getContractors() (which is scoped to
 * the manager's area). A contractor can live in any area.
 *
 * Returns null if no row matches.
 */
export async function getContractorByEmail(
  email: string,
): Promise<ContractorWithEmail | null> {
  if (!email) return null;
  const { data, error } = await supabase
    .from("contractors")
    .select("*")
    .ilike("email", email.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    region:
      typeof data.region === "string"
        ? parseRegionsArray(data.region)
        : data.region,
    tags:
      typeof data.tags === "string" ? parseRegionsArray(data.tags) : data.tags,
  } as ContractorWithEmail;
}
