import { supabase } from "./supabase";
import { api, type DbJob } from "./api";

/**
 * Wrap api.createJob so every job insert carries a territory_id.
 *
 * If the caller already set one, it is kept. Otherwise the wedding's
 * territory_id is loaded (weddings.territory_id) and copied onto the job. If
 * that wedding has none, throw — never insert a blank-area job.
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
      throw new Error(
        "Cannot create a job without an area — the linked wedding has no territory_id.",
      );
    }
  }
  return api.createJob(jobData as Omit<DbJob, "id" | "created_at">);
}
