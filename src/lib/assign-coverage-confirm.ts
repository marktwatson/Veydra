import { supabase } from "./supabase";
import { maybeConfirmCoverage } from "./coverage-request";

/**
 * After a contractor is assigned to a photo/video job from the Positions
 * save path, backfill proposal_id on the job (if missing) and stamp
 * coverage_confirmed_at when all required roles are now assigned.
 *
 * Arg order for maybeConfirmCoverage: (proposalId, weddingId) — never swap.
 *
 * This is the authoritative assign→confirm path. The Realtime watcher is a
 * backup only; this runs on every Positions save so it stamps even when
 * Realtime is off. The DB trigger trg_coverage_confirm is the final backstop.
 */
export async function confirmCoverageOnAssign(
  jobId: string,
  role: string,
  weddingId: string,
  proposalId?: string | null,
): Promise<void> {
  if (!/photo|video/i.test(String(role || ""))) return;
  try {
    let pid: string | null = proposalId || null;
    if (!pid) {
      const { data: pRow } = await supabase
        .from("proposals")
        .select("id")
        .or(`wedding_id.eq.${weddingId},original_wedding_id.eq.${weddingId}`)
        .neq("status", "superseded")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      pid = pRow?.id || null;
      // Backfill proposal_id on the job so the DB trigger / watcher can
      // find it on future updates. Use a raw update — proposal_id is not
      // on the DbJob type but exists on the table.
      if (pid) {
        await supabase
          .from("jobs")
          .update({ proposal_id: pid })
          .eq("id", jobId);
      }
    }
    if (pid) {
      await maybeConfirmCoverage(pid, weddingId);
    }
  } catch (e) {
    console.warn("confirmCoverageOnAssign failed:", e);
  }
}
