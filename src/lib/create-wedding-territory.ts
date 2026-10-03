import { supabase } from "./supabase";
import { api, type DbWedding } from "./api";
import { resolveTerritoryId } from "./territory";

/**
 * Wrap api.createWedding so every wedding insert carries the viewed area's
 * territory_id.
 *
 * If the caller already set one, it is kept (a Nik TN wedding stays Nik TN
 * even if the switcher is on North Carolina). Otherwise resolve from the
 * super-admin switcher area, then the logged-in manager's territory. If no
 * area is picked, throw "Pick an area before adding this." — never insert a
 * blank-area wedding and never fall back to Honeysuckle.
 *
 * Use this instead of api.createWedding in the UI so the area stays correct
 * under the one-login-per-area model without touching the (locked) api
 * module.
 */
export async function createWeddingWithTerritory(
  wedding: Omit<DbWedding, "id" | "created_at">,
  syncToCrmOnCreate = false,
) {
  const data: any = { ...wedding };
  if (!data.territory_id) {
    const territoryId = await resolveTerritoryId().catch(() => null);
    if (!territoryId) {
      throw new Error("Pick an area before adding this.");
    }
    data.territory_id = territoryId;
  }
  return api.createWedding(
    data as Omit<DbWedding, "id" | "created_at">,
    syncToCrmOnCreate,
  );
}
