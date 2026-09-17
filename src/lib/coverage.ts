import { supabase } from "./supabase";

/**
 * Calendar days from today (date-only, portal TZ ignored — uses local date)
 * to the wedding date. Negative = past.
 */
export function daysUntilWedding(
  weddingDate: string | null | undefined,
): number {
  if (!weddingDate) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(weddingDate + "T12:00:00");
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Short-notice threshold. <= this many days requires coverage first. */
export const COVERAGE_THRESHOLD_DAYS = 60;

export function needsCoverage(weddingDate: string | null | undefined): boolean {
  const d = daysUntilWedding(weddingDate);
  return d > 0 && d <= COVERAGE_THRESHOLD_DAYS;
}

export interface CoverageRequirement {
  needsPhoto: boolean;
  needsVideo: boolean;
}

/** Determine which roles are required based on package + addons. */
export function coverageRequirements(proposal: any): CoverageRequirement {
  const coverage = proposal?.coverage_type;
  const addons: string[] = proposal?.addons || [];
  const hasVideoAddon =
    addons.some((a) => a === "second_shooter" || a === "second_shooter_new") &&
    proposal?.second_shooter_type === "video";

  const needsPhoto = coverage === "photo" || coverage === "both" || !coverage;
  const needsVideo =
    coverage === "video" || coverage === "both" || hasVideoAddon;
  return { needsPhoto, needsVideo };
}

/** Whether the package/addons include video (needs a Videographer job). */
export function packageIncludesVideo(proposal: any): boolean {
  return coverageRequirements(proposal).needsVideo;
}

/** Whether this proposal's date falls within the short-notice window. */
export function isCoverageRequired(proposal: any): boolean {
  return needsCoverage(proposal?.wedding_date);
}

export interface CoverageStatus {
  required: boolean;
  confirmed: boolean;
  missing: string[];
  photoAssigned: boolean;
  videoAssigned: boolean;
  needsPhoto: boolean;
  needsVideo: boolean;
  jobs: any[];
}

/** Short label for a coverage status, or null when coverage isn't required. */
export function coverageBadge(status: CoverageStatus | null): string | null {
  if (!status || !status.required) return null;
  return status.confirmed ? "Covered — ready to book" : "Awaiting coverage";
}

/**
 * Check whether the required coverage jobs exist and are assigned.
 */
export async function getCoverageStatus(
  weddingId: string | null,
  proposal: any,
): Promise<CoverageStatus> {
  const req = coverageRequirements(proposal);
  let jobs: any[] = [];

  if (weddingId) {
    const { data } = await supabase
      .from("jobs")
      .select(
        "*, contractors!jobs_contractor_id_fkey(id, first_name, last_name)",
      )
      .eq("wedding_id", weddingId)
      .in("role", [
        "Photographer",
        "Videographer",
        "Lead Photographer",
        "Lead Videographer",
      ]);
    jobs = data || [];
  }

  const photoAssigned = jobs.some(
    (j) => /photo/i.test(j.role || "") && j.contractor_id,
  );
  const videoAssigned = jobs.some(
    (j) => /video/i.test(j.role || "") && j.contractor_id,
  );

  const required = isCoverageRequired(proposal);

  // If the proposal date isn't short-notice, coverage is not required.
  if (!required) {
    return {
      required: false,
      confirmed: true,
      missing: [],
      photoAssigned: true,
      videoAssigned: true,
      needsPhoto: req.needsPhoto,
      needsVideo: req.needsVideo,
      jobs,
    };
  }

  // Honor an already-stamped coverage_confirmed_at.
  if (proposal?.coverage_confirmed_at) {
    return {
      required: true,
      confirmed: true,
      missing: [],
      photoAssigned: true,
      videoAssigned: true,
      needsPhoto: req.needsPhoto,
      needsVideo: req.needsVideo,
      jobs,
    };
  }

  const missing: string[] = [];
  if (req.needsPhoto && !photoAssigned) missing.push("Photographer");
  if (req.needsVideo && !videoAssigned) missing.push("Videographer");

  const confirmed = missing.length === 0;

  return {
    required: true,
    confirmed,
    missing,
    photoAssigned,
    videoAssigned,
    needsPhoto: req.needsPhoto,
    needsVideo: req.needsVideo,
    jobs,
  };
}

/**
 * Request coverage for a short-notice proposal.
 * Ensures a wedding exists, inserts missing open jobs, and notifies contractors.
 */
export async function requestCoverage(
  proposalId: string,
): Promise<{ weddingId: string; createdJobs: string[]; notified: number }> {
  // Self-heal columns
  await healCoverageColumns();

  // Ensure wedding exists
  const { ensureWeddingForProposal } = await import("./proposal-wedding");
  const weddingId = await ensureWeddingForProposal(proposalId);
  if (!weddingId)
    throw new Error("Could not create wedding for coverage request.");

  const { data: proposal } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  if (!proposal) throw new Error("Proposal not found.");

  const req = coverageRequirements(proposal);

  // Check existing jobs
  const { data: existing } = await supabase
    .from("jobs")
    .select("id, role, contractor_id")
    .eq("wedding_id", weddingId)
    .in("role", [
      "Photographer",
      "Videographer",
      "Lead Photographer",
      "Lead Videographer",
    ]);

  const hasPhotoJob = (existing || []).some((j) => /photo/i.test(j.role));
  const hasVideoJob = (existing || []).some((j) => /video/i.test(j.role));

  const toInsert: any[] = [];
  if (req.needsPhoto && !hasPhotoJob) {
    toInsert.push({
      wedding_id: weddingId,
      role: "Photographer",
      status: "open",
      pay_rate: 0,
      hours: null,
      contractor_id: null,
      coverage_request: true,
      proposal_id: proposalId,
    });
  }
  if (req.needsVideo && !hasVideoJob) {
    toInsert.push({
      wedding_id: weddingId,
      role: "Videographer",
      status: "open",
      pay_rate: 0,
      hours: null,
      contractor_id: null,
      coverage_request: true,
      proposal_id: proposalId,
    });
  }

  let createdJobs: string[] = [];
  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("jobs")
      .insert(toInsert)
      .select("id");
    if (error) throw error;
    createdJobs = (inserted || []).map((j) => j.id);
  }

  // Mark proposal
  await supabase
    .from("proposals")
    .update({ coverage_requested_at: new Date().toISOString() })
    .eq("id", proposalId);

  // Notify matching contractors
  let notified = 0;
  try {
    notified = await notifyCoverageContractors(weddingId, proposal, req);
  } catch (e) {
    console.error("Coverage notify error:", e);
  }

  return { weddingId, createdJobs, notified };
}

async function notifyCoverageContractors(
  weddingId: string,
  proposal: any,
  req: CoverageRequirement,
): Promise<number> {
  const { data: contractors } = await supabase
    .from("contractors")
    .select("id, first_name, last_name, specialty, phone, email, status")
    .eq("status", "active");

  const dateStr = proposal.wedding_date
    ? new Date(proposal.wedding_date + "T12:00:00").toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        },
      )
    : "TBD";
  const city = proposal.city || "";

  let count = 0;
  for (const c of contractors || []) {
    const spec = (c.specialty || "").toLowerCase();
    const isPhoto = /photo/i.test(spec);
    const isVideo = /video/i.test(spec);
    const isBartender = /bartender/i.test(spec);
    if (isBartender) continue;

    const roleMatch =
      (req.needsPhoto && isPhoto) || (req.needsVideo && isVideo);
    if (!roleMatch) continue;

    // Check not already assigned to another job on that date
    const { data: conflict } = await supabase
      .from("jobs")
      .select("id")
      .eq("contractor_id", c.id)
      .not("status", "eq", "cancelled")
      .limit(1);

    count++;

    // Push notification
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/send-push`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              import.meta.env.VITE_SUPABASE_ANON_KEY || ""
            }`,
          },
          body: JSON.stringify({
            contractorId: c.id,
            title: "Coverage request",
            body: `Short-notice wedding ${dateStr}${city ? " · " + city : ""} — tap Open Jobs to accept.`,
            url: "/opportunities",
            tag: `coverage-${weddingId}`,
            category: "coverage",
          }),
        },
      );
      if (!res.ok) console.warn("push failed for", c.id);
    } catch (e) {
      console.warn("push error:", e);
    }

    // SMS/email handled by the job-alert path in coverage-request.ts
    // (api.resendJobAlerts) for the open jobs created here.
  }
  return count;
}

/** Contractor accepts a coverage job. First-accept wins. */
export async function acceptCoverageJob(
  jobId: string,
  contractorId: string,
): Promise<{ ok: boolean; alreadyCovered: boolean }> {
  await healCoverageColumns();

  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, contractor_id, status, wedding_id, proposal_id, role")
    .eq("id", jobId)
    .single();
  if (error || !job) throw new Error("Job not found.");

  if (job.contractor_id) {
    return { ok: false, alreadyCovered: true };
  }

  const { error: updateErr } = await supabase
    .from("jobs")
    .update({
      contractor_id: contractorId,
      status: "assigned",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("contractor_id", null); // race-safe: only if still null

  if (updateErr) {
    // Likely someone else just took it
    return { ok: false, alreadyCovered: true };
  }

  // Check if all required roles are now covered → stamp proposal
  if (job.proposal_id) {
    await maybeConfirmCoverage(job.proposal_id, job.wedding_id);
  }

  return { ok: true, alreadyCovered: false };
}

/** If all required roles have contractors, stamp coverage_confirmed_at. */
export async function maybeConfirmCoverage(
  proposalId: string,
  weddingId: string,
): Promise<boolean> {
  const { data: proposal } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  if (!proposal) return false;

  const status = await getCoverageStatus(weddingId, proposal);
  if (status.confirmed) {
    await supabase
      .from("proposals")
      .update({ coverage_confirmed_at: new Date().toISOString() })
      .eq("id", proposalId);
    return true;
  }
  return false;
}

let healed = false;
export async function healCoverageColumns(): Promise<void> {
  if (healed) return;
  healed = true;
  try {
    const sql = `
      ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS coverage_request boolean DEFAULT false;
      ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS proposal_id uuid;
      ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_requested_at timestamptz;
      ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_confirmed_at timestamptz;
      CREATE OR REPLACE FUNCTION public.fn_coverage_auto_assign()
      RETURNS trigger AS $$
      DECLARE j record;
      BEGIN
        SELECT contractor_id, coverage_request INTO j FROM public.jobs WHERE id = NEW.job_id;
        IF j.coverage_request AND j.contractor_id IS NULL THEN
          UPDATE public.jobs SET contractor_id = NEW.contractor_id, status = 'assigned', accepted_at = now()
            WHERE id = NEW.job_id AND contractor_id IS NULL;
          IF FOUND THEN NEW.status := 'accepted'; END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      DROP TRIGGER IF EXISTS trg_coverage_auto_assign ON public.applications;
      CREATE TRIGGER trg_coverage_auto_assign BEFORE INSERT ON public.applications
        FOR EACH ROW EXECUTE FUNCTION public.fn_coverage_auto_assign();
      NOTIFY pgrst, 'reload schema';
    `;
    await supabase.rpc("exec_sql", { sql_text: sql });
  } catch (e) {
    // Non-fatal — columns may already exist or exec_sql unavailable
    console.warn("coverage heal skipped:", e);
  }
}
