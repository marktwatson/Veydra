import { supabase } from "./supabase";
import { api } from "./api";
import { resolveTerritoryId } from "./territory";

/**
 * Resolve the territory_id to stamp on a child row (application / assignment)
 * that belongs to a job.
 *
 * Order:
 *   1. The parent job's jobs.territory_id (child rows inherit the job).
 *   2. resolveTerritoryId() — the viewed area (super-admin switcher → manager
 *      territory).
 *
 * If both are null, throw "Pick an area before adding this." — never insert a
 * blank-area child row and never fall back to Honeysuckle.
 */
export async function resolveJobTerritoryId(
  jobId?: string | null,
): Promise<string> {
  if (jobId) {
    try {
      const { data: job } = await supabase
        .from("jobs")
        .select("territory_id")
        .eq("id", jobId)
        .maybeSingle();
      if ((job as any)?.territory_id) return (job as any).territory_id;
    } catch {
      // fall through
    }
  }
  const tid = await resolveTerritoryId().catch(() => null);
  if (!tid) throw new Error("Pick an area before adding this.");
  return tid;
}

/**
 * Stamp territory_id onto an application payload before insert. Mutates and
 * returns the payload. Throws if no territory can be resolved.
 */
export async function stampApplicationTerritory<T extends Record<string, any>>(
  payload: T,
): Promise<T> {
  const p = payload as any;
  if (p.territory_id) return payload;
  const tid = await resolveJobTerritoryId(p.job_id);
  p.territory_id = tid;
  return payload;
}

/**
 * Stamp territory_id onto an assignment payload before insert. Mutates and
 * returns the payload. Throws if no territory can be resolved. Falls back to
 * the job's territory via job_id, then the viewed area.
 */
export async function stampAssignmentTerritory<T extends Record<string, any>>(
  payload: T,
): Promise<T> {
  const p = payload as any;
  if (p.territory_id) return payload;
  const tid = await resolveJobTerritoryId(p.job_id);
  p.territory_id = tid;
  return payload;
}

/**
 * Wrappers around api.applyForJob / api.createAssignment that stamp
 * territory_id from the parent job before insert. Use these instead of the
 * raw api methods so child rows inherit the job's area.
 */
export async function applyForJobWithTerritory(
  application: Parameters<typeof api.applyForJob>[0],
) {
  return api.applyForJob(
    await stampApplicationTerritory({ ...application } as any),
  );
}

export async function createAssignmentWithTerritory(
  assignment: Parameters<typeof api.createAssignment>[0],
) {
  return api.createAssignment(
    await stampAssignmentTerritory({ ...assignment } as any),
  );
}
