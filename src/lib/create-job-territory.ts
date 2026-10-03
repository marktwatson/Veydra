import { supabase } from "./supabase";
import { api, type DbJob } from "./api";
import { resolveTerritoryId } from "./territory";

/**
 * Wrap api.createJob so every job insert carries a territory_id.
 *
 * If the caller already set one, it is kept. Otherwise the wedding's
 * territory_id is loaded (weddings.territory_id) and copied onto the job
 * (child rows inherit the parent). If that wedding has none, fall back to
 * the viewed area (super-admin switcher → manager territory). If no area is
 * picked, throw — never insert a blank-area job.
 *
 * Use this instead of api.createJob in the UI so the area stays correct under
 * the one-login-per-area model without touching the (locked) api module.
 */
export async function createJobWithTerritory(
  job: Omit<DbJob, "id" | "created_at">,
) {
  const jobData: any = { ...job };
  if (!jobData.territory_id && jobData.wedding_id) {
    const { data: wRow, error: wErr } = await supabase
      .from("weddings")
      .select("territory_id")
      .eq("id", jobData.wedding_id)
      .maybeSingle();
    if (wErr) throw wErr;
    if (wRow?.territory_id) {
      jobData.territory_id = wRow.territory_id as string;
    } else {
      // Wedding has no territory — fall back to the viewed area.
      const viewedArea = await resolveTerritoryId().catch(() => null);
      if (!viewedArea) {
        throw new Error(
          "Cannot create a job without an area — pick an area before adding this.",
        );
      }
      jobData.territory_id = viewedArea;
    }
  } else if (!jobData.territory_id && !jobData.wedding_id) {
    // No wedding to inherit from — use the viewed area.
    const viewedArea = await resolveTerritoryId().catch(() => null);
    if (!viewedArea) {
      throw new Error("Pick an area before adding this.");
    }
    jobData.territory_id = viewedArea;
  }
  return api.createJob(jobData as Omit<DbJob, "id" | "created_at">);
}
