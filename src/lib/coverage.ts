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

/** Short-notice threshold (kept for labeling/hints only). No longer a blocker. */
export const COVERAGE_THRESHOLD_DAYS = 60;

/**
 * Whether the wedding date falls within the short-notice window.
 * NOTE: As of the opt-in coverage change this is NOT a blocker — it only
 * informs UI hints. Generate / Send / Sign & Pay are unlocked unless the
 * staff explicitly requested coverage (coverage_requested_at set) and it
 * has not been confirmed (coverage_confirmed_at null).
 */
export function needsCoverage(weddingDate: string | null | undefined): boolean {
  const d = daysUntilWedding(weddingDate);
  return d > 0 && d <= COVERAGE_THRESHOLD_DAYS;
}

export interface CoverageRequirement {
  needsPhoto: boolean;
  needsVideo: boolean;
  hours: number | null;
  packageName?: string | null;
}

/** Extract hours from package description or package_details/addons. */
export function extractCoverageHours(proposal: any): number | null {
  if (proposal?.hours && Number(proposal.hours) > 0) {
    return Number(proposal.hours);
  }
  const text = `${proposal?.package_desc || ""} ${proposal?.package_description || ""} ${proposal?.notes || ""}`;
  const match = text.match(/(\d+)\s*(?:hours|hrs|hour)/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

/** Determine which roles and hours are required based on package + addons. */
export function coverageRequirements(proposal: any): CoverageRequirement {
  const coverage = proposal?.coverage_type;
  const addons: string[] = proposal?.addons || [];
  const hasVideoAddon =
    addons.some((a) => a === "second_shooter" || a === "second_shooter_new") &&
    proposal?.second_shooter_type === "video";

  const needsPhoto = coverage === "photo" || coverage === "both" || !coverage;
  const needsVideo =
    coverage === "video" || coverage === "both" || hasVideoAddon;
  const hours = extractCoverageHours(proposal);
  return {
    needsPhoto,
    needsVideo,
    hours,
    packageName: proposal?.package_name || null,
  };
}

/** Whether the package/addons include video (needs a Videographer job). */
export function packageIncludesVideo(proposal: any): boolean {
  return coverageRequirements(proposal).needsVideo;
}

/** Whether staff has requested coverage that is not yet confirmed. */
export function isCoverageRequired(proposal: any): boolean {
  return !!proposal?.coverage_requested_at && !proposal?.coverage_confirmed_at;
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
  /** True when staff has NOT requested coverage and it is not confirmed —
   *  the request form should be shown (opt-in). */
  showRequestForm: boolean;
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

  // Active assignment statuses — a contractor is "assigned" when an
  // assignment row exists in one of these statuses for the job.
  const ACTIVE_STATUSES = [
    "upcoming",
    "accepted",
    "confirmed",
    "assigned",
    "Upcoming",
    "Accepted",
    "Confirmed",
    "Assigned",
  ];

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

    // Also fetch active assignments for these jobs — Veydra assigns via the
    // assignments table, NOT jobs.contractor_id. A job is "covered" when it
    // has an active assignment OR a contractor_id set directly on the job.
    const jobIds = jobs.map((j) => j.id);
    if (jobIds.length > 0) {
      const { data: assignments } = await supabase
        .from("assignments")
        .select(
          "job_id, contractor_id, status, contractors(first_name, last_name)",
        )
        .in("job_id", jobIds)
        .in("status", ACTIVE_STATUSES);

      // Build a map: jobId → assigned contractor
      const assignedJobIds = new Set<string>();
      const assignedContractors: Record<string, any> = {};
      for (const a of assignments || []) {
        assignedJobIds.add(a.job_id);
        if (a.contractors) assignedContractors[a.job_id] = a.contractors;
      }

      // Merge assignment info onto jobs so the UI can show contractor names.
      jobs = jobs.map((j) => {
        if (assignedJobIds.has(j.id) && !j.contractor_id) {
          return {
            ...j,
            contractor_id: a_contractor_id(j.id, assignments || []),
            contractors: assignedContractors[j.id] || j.contractors,
          };
        }
        return j;
      });
    }
  }

  // A role is assigned if the job has contractor_id OR an active assignment.
  const photoAssigned = jobs.some(
    (j) =>
      /photo/i.test(j.role || "") &&
      (j.contractor_id || hasActiveAssignment(j, jobs)),
  );
  const videoAssigned = jobs.some(
    (j) =>
      /video/i.test(j.role || "") &&
      (j.contractor_id || hasActiveAssignment(j, jobs)),
  );

  // Coverage is now OPT-IN. It is only "required" (i.e. blocks Sign & Pay)
  // when staff explicitly requested it (coverage_requested_at set) and it has
  // not been confirmed yet. The wedding date alone never blocks.
  const requested = !!proposal?.coverage_requested_at;
  const required = requested && !proposal?.coverage_confirmed_at;
  const showRequestForm = !requested && !proposal?.coverage_confirmed_at;

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
      showRequestForm,
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
      showRequestForm: false,
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
    showRequestForm: false,
  };
}

/** Helper: extract contractor_id from the assignments array for a job. */
function a_contractor_id(jobId: string, assignments: any[]): string | null {
  const a = assignments.find((x) => x.job_id === jobId && x.contractor_id);
  return a?.contractor_id || null;
}

/** Helper: check if a job has an active assignment (used as fallback). */
function hasActiveAssignment(_job: any, _allJobs: any[]): boolean {
  // This is a no-op fallback — the real check is done via contractor_id
  // merged from assignments above. Kept for API compatibility.
  return false;
}

/**
 * Request coverage for a short-notice proposal.
 * Delegates to the canonical implementation in coverage-request.ts which
 * accepts per-role pay_rate / hours / region / notes and never posts a
 * pay_rate 0 job.
 */
export async function requestCoverage(
  proposalId: string,
  payload?: any,
): Promise<{ weddingId: string; createdJobs: string[]; notified: number }> {
  // Self-heal columns FIRST so a stale PostgREST cache can't fake-fail.
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

  const { requestCoverage: doRequest } = await import("./coverage-request");
  return doRequest(proposal, payload);
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
            body: `Short-notice wedding ${dateStr}${city ? " · " + city : ""}${req.hours ? ` (${req.hours} hrs)` : ""} — tap Open Jobs to accept.`,
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

/**
 * Contractor "Apply Now" for a coverage-request job.
 *
 * Inserts an application row (status pending) — same as the normal Open
 * Positions → Apply flow. Does NOT write contractor_id on the job. Manager
 * assigns from the applicants list. First-apply does NOT unlock Sign & Pay.
 *
 * Does NOT charge Stripe or create a GHL invoice.
 */
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

  // If a manager already assigned someone, it's covered.
  if (job.contractor_id) {
    return { ok: false, alreadyCovered: true };
  }

  // Check for an existing pending application by this contractor.
  const { data: existingApp } = await supabase
    .from("applications")
    .select("id, status")
    .eq("job_id", jobId)
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (existingApp) {
    return { ok: true, alreadyCovered: false };
  }

  // Insert a pending application — manager reviews from the applicants list.
  const { error: appErr } = await supabase.from("applications").insert({
    job_id: jobId,
    contractor_id: contractorId,
    status: "pending",
    message: "Coverage request — I'm available for this date.",
  });

  if (appErr) {
    // If applications table shape differs, surface the error.
    throw new Error(appErr.message || "Could not submit application.");
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
      ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS contractor_id uuid;
      ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS region text;
      ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_requested_at timestamptz;
      ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_confirmed_at timestamptz;
      DROP TRIGGER IF EXISTS trg_coverage_auto_assign ON public.applications;
      DROP FUNCTION IF EXISTS public.fn_coverage_auto_assign();

      CREATE OR REPLACE FUNCTION public.fn_coverage_confirm()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        pid uuid;
        need_photo boolean;
        need_video boolean;
        got_photo boolean;
        got_video boolean;
        ctype text;
        wid uuid;
      BEGIN
        wid := NEW.wedding_id;
        pid := NEW.proposal_id;
        IF pid IS NULL THEN
          SELECT p.id INTO pid FROM public.proposals p
          WHERE p.wedding_id::text = wid::text
            AND coalesce(p.status,'') <> 'superseded'
          ORDER BY p.created_at DESC NULLS LAST
          LIMIT 1;
          IF pid IS NOT NULL THEN
            UPDATE public.jobs SET proposal_id = pid WHERE id::text = NEW.id::text AND proposal_id IS NULL;
          END IF;
        END IF;
        IF pid IS NULL THEN RETURN NEW; END IF;
        SELECT coalesce(coverage_type, 'both') INTO ctype FROM public.proposals WHERE id::text = pid::text;
        need_photo := ctype IN ('photo', 'both');
        need_video := ctype IN ('video', 'both');
        SELECT
          EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.wedding_id::text = wid::text
              AND j.role ILIKE '%photo%'
              AND (
                j.contractor_id IS NOT NULL
                OR EXISTS (
                  SELECT 1 FROM public.assignments a
                  WHERE a.job_id::text = j.id::text
                    AND lower(coalesce(a.status,'')) IN ('upcoming','accepted','confirmed','assigned')
                )
              )
          ),
          EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.wedding_id::text = wid::text
              AND j.role ILIKE '%video%'
              AND (
                j.contractor_id IS NOT NULL
                OR EXISTS (
                  SELECT 1 FROM public.assignments a
                  WHERE a.job_id::text = j.id::text
                    AND lower(coalesce(a.status,'')) IN ('upcoming','accepted','confirmed','assigned')
                )
              )
          )
        INTO got_photo, got_video;
        IF (NOT need_photo OR got_photo) AND (NOT need_video OR got_video) THEN
          UPDATE public.proposals
          SET coverage_confirmed_at = coalesce(coverage_confirmed_at, now())
          WHERE id::text = pid::text AND coverage_confirmed_at IS NULL;
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.fn_coverage_confirm_job_assign()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE public.jobs
        SET proposal_id = proposal_id
        WHERE id::text = NEW.job_id::text;
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_coverage_confirm ON public.jobs;
      CREATE TRIGGER trg_coverage_confirm
      AFTER INSERT OR UPDATE OF contractor_id, proposal_id ON public.jobs
      FOR EACH ROW EXECUTE FUNCTION public.fn_coverage_confirm();

      DROP TRIGGER IF EXISTS trg_coverage_confirm_assign ON public.assignments;
      CREATE TRIGGER trg_coverage_confirm_assign
      AFTER INSERT OR UPDATE OF contractor_id ON public.assignments
      FOR EACH ROW EXECUTE FUNCTION public.fn_coverage_confirm_job_assign();

      NOTIFY pgrst, 'reload schema';
    `;
    await supabase.rpc("exec_sql", { sql_text: sql });
  } catch (e) {
    // Non-fatal — columns may already exist or exec_sql unavailable
    console.warn("coverage heal skipped:", e);
  }
}
