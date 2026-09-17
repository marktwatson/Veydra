import { supabase } from "./supabase";
import { api } from "./api";
import { ensureWeddingForProposal } from "./proposal-wedding";
import { packageIncludesVideo, getCoverageStatus } from "./coverage";

/**
 * Request coverage for a proposal's wedding. Creates open jobs for the
 * required roles (Photographer always; Videographer when the package
 * includes video) if they don't already exist, flags them as
 * coverage_request, notifies matching contractors, and stamps the proposal.
 *
 * Does NOT create an invoice or charge Stripe.
 */
export async function requestCoverage(proposal: any): Promise<{
  weddingId: string | null;
  createdJobs: string[];
  notified: number;
}> {
  // Ensure a pending wedding exists so jobs can attach to it.
  const weddingId = await ensureWeddingForProposal(proposal.id);

  const videoNeeded = packageIncludesVideo(proposal);

  // Fetch existing jobs for this wedding.
  let existing: any[] = [];
  if (weddingId) {
    const { data } = await supabase
      .from("jobs")
      .select("id, role, status, contractor_id")
      .eq("wedding_id", weddingId);
    existing = data || [];
  }

  const wantsRole = (role: string, regex: RegExp) =>
    existing.some(
      (j) =>
        regex.test(String(j.role || "").toLowerCase()) &&
        j.status !== "cancelled",
    );

  const createdJobs: string[] = [];
  const rolesToCreate: string[] = [];
  if (!wantsRole("Photographer", /photo/)) rolesToCreate.push("Photographer");
  if (videoNeeded && !wantsRole("Videographer", /video/))
    rolesToCreate.push("Videographer");

  if (weddingId) {
    for (const role of rolesToCreate) {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          wedding_id: weddingId,
          role,
          status: "open",
          pay_rate: 0,
          hours: null,
          contractor_id: null,
          coverage_request: true,
          proposal_id: proposal.id,
        })
        .select()
        .single();
      if (!error && data) {
        createdJobs.push(data.id);
      }
    }

    // Mark any already-existing photo/video jobs as coverage requests too.
    if (existing.length) {
      const ids = existing
        .filter(
          (j) =>
            (/photo|video/.test(String(j.role || "").toLowerCase()) &&
              j.status !== "cancelled") ||
            j.coverage_request !== true,
        )
        .map((j) => j.id);
      if (ids.length) {
        await supabase
          .from("jobs")
          .update({ coverage_request: true, proposal_id: proposal.id })
          .in("id", ids);
      }
    }
  }

  // Stamp the proposal.
  await supabase
    .from("proposals")
    .update({ coverage_requested_at: new Date().toISOString() })
    .eq("id", proposal.id);

  // Notify contractors via the existing job-alert path (SMS/email/in-app +
  // webhook). resendJobAlerts filters by specialty + region automatically and
  // skips bartenders for photo/video roles.
  let notified = 0;
  if (weddingId) {
    const { data: allJobs } = await supabase
      .from("jobs")
      .select("id, role")
      .eq("wedding_id", weddingId)
      .eq("status", "open");
    const openJobs = allJobs || [];
    for (const job of openJobs) {
      if (!/photo|video/i.test(String(job.role || ""))) continue;
      try {
        notified += await api.resendJobAlerts(job.id);
      } catch (e) {
        console.error("coverage notify failed", e);
      }
    }
  }

  return { weddingId, createdJobs, notified };
}

/**
 * Called after a contractor accepts a coverage job. If all required roles
 * now have a contractor_id, stamp coverage_confirmed_at on the proposal so
 * Sign & Pay unlocks.
 */
export async function maybeConfirmCoverage(
  weddingId: string,
  proposalId?: string | null,
): Promise<boolean> {
  let proposal: any = null;
  if (proposalId) {
    const { data } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", proposalId)
      .maybeSingle();
    proposal = data;
  } else if (weddingId) {
    const { data } = await supabase
      .from("proposals")
      .select("*")
      .or(`wedding_id.eq.${weddingId},original_wedding_id.eq.${weddingId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    proposal = data;
  }
  if (!proposal) return false;

  const status = await getCoverageStatus(weddingId, proposal);
  if (!status.required) return true;
  if (status.confirmed) {
    await supabase
      .from("proposals")
      .update({ coverage_confirmed_at: new Date().toISOString() })
      .eq("id", proposal.id);
    return true;
  }
  return false;
}
