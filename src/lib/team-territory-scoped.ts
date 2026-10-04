import { supabase } from "./supabase";
import { currentTerritoryId } from "./current-territory";

/**
 * Loads managers + editors scoped to the current user's active territory.
 *
 *  - Super admin with an area picked in the header switcher → only managers
 *    whose managers.territory_id matches that area. Editors have no
 *    territory_id column, so they are only returned when viewing "All Areas".
 *  - Super admin on "All Areas" (null) → every manager + editor (no filter).
 *  - Manager / owner → only their own area's managers.
 *
 * Mirrors the dedupe + invited-reconcile logic from Team.tsx so the Team page
 * can swap its queryFn for this without changing any rendering.
 */
export async function loadTeamForTerritory(): Promise<any[]> {
  const territoryId = await currentTerritoryId();

  // Managers: scope by territory_id OR territory_ids contains the area, so a
  // multi-area manager shows up under every area they can access.
  let mgrQuery = supabase
    .from("managers")
    .select("*")
    .order("created_at", { ascending: true });
  if (territoryId) {
    // PostgREST: territory_id = X OR territory_ids contains X. Use .or() with
    // cs (contains) for the array column.
    mgrQuery = mgrQuery.or(
      `territory_id.eq.${territoryId},territory_ids.cs.{${territoryId}}`,
    );
  }
  const { data: m, error: mErr } = await mgrQuery;
  if (mErr) throw mErr;

  // Editors: no territory_id column exists, so only include them when not
  // filtering to a single area (i.e. All Areas). When an area is picked,
  // editors are hidden since we cannot tell which area they belong to.
  let editors: any[] = [];
  if (!territoryId) {
    const { data: e, error: eErr } = await supabase
      .from("editors")
      .select("*")
      .order("created_at", { ascending: true });
    if (eErr && eErr.code !== "42P01") throw eErr;
    if (!eErr) editors = (e || []).map((ed) => ({ ...ed, role: "editor" }));
  }

  const all = [...(m || []), ...editors];

  // Clean up duplicates by email, giving priority to active accounts.
  const uniqueMap = new Map();
  all.forEach((u) => {
    const email = u.email?.trim().toLowerCase();
    if (!email) {
      uniqueMap.set(u.id, u);
      return;
    }
    if (uniqueMap.has(email)) {
      const existing = uniqueMap.get(email);
      if (existing.status === "invited" && u.status === "active")
        uniqueMap.set(email, u);
      else if (existing.status !== "active" && u.status === "active")
        uniqueMap.set(email, u);
      else if (u.role === "editor" && existing.role !== "editor")
        uniqueMap.set(email, u);
    } else {
      uniqueMap.set(email, u);
    }
  });

  const list = Array.from(uniqueMap.values());

  // Auto-reconcile remaining invited status if the user has an active record.
  for (const item of list) {
    if (item.status === "invited" && item.email) {
      const emailLower = item.email.trim().toLowerCase();
      const [mRes, eRes, cRes] = await Promise.all([
        supabase
          .from("managers")
          .select("id, status")
          .ilike("email", emailLower)
          .neq("status", "invited")
          .maybeSingle(),
        supabase
          .from("editors")
          .select("id, status")
          .ilike("email", emailLower)
          .neq("status", "invited")
          .maybeSingle(),
        supabase
          .from("contractors")
          .select("id, status")
          .ilike("email", emailLower)
          .eq("status", "active")
          .maybeSingle(),
      ]);

      if (mRes.data || eRes.data || cRes.data) {
        item.status = "active";
        await supabase
          .from("managers")
          .update({ status: "active" })
          .ilike("email", emailLower);
        await supabase
          .from("managers")
          .delete()
          .ilike("email", emailLower)
          .eq("status", "invited")
          .neq("id", item.id);
      }
    }
  }

  return list.sort(
    (a, b) =>
      new Date(a.created_at || "").getTime() -
      new Date(b.created_at || "").getTime(),
  );
}
