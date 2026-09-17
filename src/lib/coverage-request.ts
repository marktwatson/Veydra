import { supabase } from "./supabase";
import { api } from "./api";
import { ensureWeddingForProposal } from "./proposal-wedding";
import {
  packageIncludesVideo,
  getCoverageStatus,
  extractCoverageHours,
  healCoverageColumns,
} from "./coverage";

export interface CoverageRoleConfig {
  enabled: boolean;
  payRate: number;
  hours: number;
}

export interface CoverageRequestPayload {
  roles: {
    photo?: CoverageRoleConfig;
    video?: CoverageRoleConfig;
  };
  region: string;
  notes: string;
}

/**
 * Request coverage for a proposal's wedding. Creates open jobs for the
 * selected roles with real pay_rate / hours / requirements, flags them as
 * coverage_request, notifies matching contractors, and stamps the proposal.
 *
 * Never posts a job with pay_rate 0.
 *
 * Does NOT create an invoice or charge Stripe.
 */
export async function requestCoverage(
  proposal: any,
  payload?: CoverageRequestPayload,
): Promise<{
  weddingId: string;
  createdJobs: string[];
  notified: number;
}> {
  if (!proposal?.id) {
    throw new Error("Save the proposal first");
  }

  // Self-heal columns FIRST so a stale PostgREST cache can't fake-fail.
  await healCoverageColumns();

  // GUARD: if coverage was already requested OR an open photo/video job
  // already exists for this wedding, do NOT insert again. Return the
  // existing state so the caller can show state 2.
  const existingWeddingId = await ensureWeddingForProposal(proposal.id);
  if (!existingWeddingId) {
    throw new Error(
      "Could not create the wedding record for this proposal. Please try again or contact support.",
    );
  }
  if (proposal.coverage_requested_at) {
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("wedding_id", existingWeddingId)
      .in("role", [
        "Photographer",
        "Videographer",
        "Lead Photographer",
        "Lead Videographer",
      ])
      .neq("status", "cancelled");
    return {
      weddingId: existingWeddingId,
      createdJobs: [],
      notified: 0,
    };
  }

  const weddingId = existingWeddingId;

  // Determine which roles to create.
  const videoNeeded = packageIncludesVideo(proposal);
  const photoCfg = payload?.roles?.photo;
  const videoCfg = payload?.roles?.video;

  const wantPhoto = photoCfg ? photoCfg.enabled && photoCfg.payRate > 0 : true;
  const wantVideo = videoCfg
    ? videoCfg.enabled && videoCfg.payRate > 0
    : videoNeeded;

  const coverageHours = extractCoverageHours(proposal);
  const notes = payload?.notes || "";

  // Fetch existing jobs for this wedding.
  const { data: existingData } = await supabase
    .from("jobs")
    .select("id, role, status, contractor_id, coverage_request")
    .eq("wedding_id", weddingId);
  const existing: any[] = existingData || [];

  const hasOpenRole = (regex: RegExp) =>
    existing.some(
      (j) =>
        regex.test(String(j.role || "").toLowerCase()) &&
        j.status !== "cancelled",
    );

  const createdJobs: string[] = [];
  const rolesToCreate: { role: string; payRate: number; hours: number }[] = [];

  if (wantPhoto && !hasOpenRole(/photo/)) {
    rolesToCreate.push({
      role: "Photographer",
      payRate: photoCfg?.payRate || 0,
      hours: photoCfg?.hours || coverageHours || 8,
    });
  }
  if (wantVideo && !hasOpenRole(/video/)) {
    rolesToCreate.push({
      role: "Videographer",
      payRate: videoCfg?.payRate || 0,
      hours: videoCfg?.hours || coverageHours || 8,
    });
  }

  for (const r of rolesToCreate) {
    // Never post a job with pay_rate 0.
    if (r.payRate <= 0) continue;
    const insertRow = {
      wedding_id: weddingId,
      role: r.role,
      status: "open",
      pay_rate: r.payRate,
      hours: r.hours || null,
      coverage_request: true,
      proposal_id: proposal.id,
      requirements: notes || null,
    };
    let { data, error } = await supabase
      .from("jobs")
      .insert(insertRow)
      .select()
      .single();
    // If the error is a stale PostgREST schema cache, heal + retry once.
    if (
      error &&
      /schema cache|Could not find|column/i.test(error.message || "")
    ) {
      await new Promise((res) => setTimeout(res, 800));
      // Force re-heal: the cached flag is private to coverage.ts, so we
      // call the public function which re-runs if the cache was stale.
      // We bypass the cache by calling the RPC directly here.
      try {
        await supabase.rpc("exec_sql", {
          sql_text: `
            ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS coverage_request boolean DEFAULT false;
            ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS proposal_id uuid;
            ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS contractor_id uuid;
            ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS region text;
            ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_requested_at timestamptz;
            ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_confirmed_at timestamptz;
            DROP TRIGGER IF EXISTS trg_coverage_auto_assign ON public.applications;
            DROP FUNCTION IF EXISTS public.fn_coverage_auto_assign();
            NOTIFY pgrst, 'reload schema';
          `,
        });
      } catch {
        // non-fatal — try the insert anyway
      }
      const retry = await supabase
        .from("jobs")
        .insert(insertRow)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      throw new Error(
        `Failed to create ${r.role} job: ${error.message || JSON.stringify(error)}`,
      );
    }
    if (data) createdJobs.push(data.id);
  }

  // Mark any already-existing photo/video jobs as coverage requests too.
  if (existing.length) {
    const ids = existing
      .filter(
        (j) =>
          /photo|video/.test(String(j.role || "").toLowerCase()) &&
          j.status !== "cancelled" &&
          j.coverage_request !== true,
      )
      .map((j) => j.id);
    if (ids.length) {
      await supabase
        .from("jobs")
        .update({
          coverage_request: true,
          proposal_id: proposal.id,
          ...(notes ? { requirements: notes } : {}),
        })
        .in("id", ids);
    }
  }

  // If no new jobs were created and there is no existing open photo/video job,
  // something went wrong — surface it instead of a lying success toast.
  const hasExistingOpen = existing.some(
    (j) =>
      /photo|video/.test(String(j.role || "").toLowerCase()) &&
      j.status !== "cancelled",
  );
  if (createdJobs.length === 0 && !hasExistingOpen) {
    throw new Error("No jobs created — check pay rate and region.");
  }

  // If a region was chosen, stamp it on the wedding so sendJobAlerts filters
  // contractors by that region.
  if (payload?.region) {
    await supabase
      .from("weddings")
      .update({ region: payload.region })
      .eq("id", weddingId);
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
