import { api, type DbContractor } from "./api";
import { resolveTerritoryId } from "./territory";

/**
 * Stamp the viewed area's territory_id onto a contractor before insert.
 *
 * If the caller already set one, keep it (Apply.tsx passes the /apply/:slug
 * id). Otherwise resolve from the super-admin switcher area, then the
 * logged-in manager's territory. If no area is picked, throw "Pick an area
 * before adding this." — never insert a blank-area contractor and never
 * fall back to Honeysuckle.
 *
 * Use this instead of api.addContractor in the UI under the one-login-per-area
 * model.
 */
export async function addContractorWithTerritory(
  contractor: Omit<DbContractor, "created_at">,
) {
  const data: any = { ...contractor };
  if (!data.territory_id) {
    const territoryId = await resolveTerritoryId().catch(() => null);
    if (!territoryId) {
      throw new Error("Pick an area before adding this.");
    }
    data.territory_id = territoryId;
  }
  return api.addContractor(data as Omit<DbContractor, "created_at">);
}
