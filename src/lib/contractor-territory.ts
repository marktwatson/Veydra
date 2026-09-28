import { api, type DbContractor } from "./api";
import { resolveTerritoryId } from "./territory";

/**
 * Stamp territory_id onto a contractor before insert.
 *
 * If the caller already set one, keep it. Otherwise resolve from the
 * logged-in manager's territory (currentTerritoryId-style: manager → primary
 * → Honeysuckle). Super admin (no manager territory) lands on the primary /
 * Honeysuckle territory so the contractor is never inserted blank.
 *
 * Use this instead of api.addContractor in the UI under the one-login-per-area
 * model.
 */
export async function addContractorWithTerritory(
  contractor: Omit<DbContractor, "created_at">,
) {
  const data: any = { ...contractor };
  if (!data.territory_id) {
    data.territory_id = await resolveTerritoryId().catch(() => null);
  }
  return api.addContractor(data as Omit<DbContractor, "created_at">);
}
