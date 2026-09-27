import { supabase } from "./supabase";
import { isSuperAdminEmail } from "./super-admin";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";

/**
 * The territory the current logged-in user is scoped to.
 *
 *  - Super admin (isSuperAdminEmail) → null, meaning "all territories"
 *    (manager list fetches must NOT filter).
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

    // Super admin sees all territories.
    if (isSuperAdminEmail(email)) return null;

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
