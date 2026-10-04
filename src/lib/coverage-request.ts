import { supabase } from "./supabase";
import { api } from "./api";
import { ensureWeddingForProposal } from "./proposal-wedding";
import { resolveTerritoryId } from "./territory";
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

  // ── Load the proposal FRESH from the database ──────────────────────────
  // Never trust the passed-in page object for the wedding id — a stale id
  // on the page is how a proposal gets attached to another couple's jobs.
  // Use ONLY this DB row's wedding_id (never original_wedding_id, never a
  // name/email lookup).
  const { data: dbProposal, error: dbErr } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposal.id)
    .single();
  if (dbErr || !dbProposal) {
    throw new Error(
      `Could not load this proposal: ${dbErr?.message || "not found"}`,
    );
  }
  const proposalId = dbProposal.id;

  // Resolve the wedding id from the DB row only. If empty, create the
  // wedding now and save the new id back onto the proposal before inserting
  // any jobs.
  let weddingId: string | null = dbProposal.wedding_id || null;

  if (!weddingId) {
    // Create a fresh wedding for THIS proposal. ensureWeddingForProposal
    // stamps territory_id from the proposal row and throws if there is no
    // area — it does NOT reuse another wedding.
    const newWeddingId = await ensureWeddingForProposal(proposalId);
    if (!newWeddingId) {
      throw new Error(
        "Could not create the wedding record for this proposal. Please try again or contact support.",
      );
    }
    weddingId = newWeddingId;
  }

  // ── Verify the wedding actually belongs to this proposal ──────────────
  // If the resolved wedding's client does not match the proposal, stop and
  // return the error. Do NOT stamp coverage_requested_at and do NOT touch
  // any jobs.
  const { data: weddingRow } = await supabase
    .from("weddings")
    .select("id, client_name, territory_id")
    .eq("id", weddingId)
    .maybeSingle();
  if (!weddingRow) {
    throw new Error(
      "The wedding record for this proposal could not be found. Please refresh and try again.",
    );
  }
  const sameClient =
    (weddingRow.client_name || "").trim().toLowerCase() ===
    (dbProposal.client_name || "").trim().toLowerCase();
  if (!sameClient) {
    throw new Error(
      `This proposal's wedding does not match the client on record (${weddingRow.client_name || "unknown"}). Coverage was not requested — please refresh the page and try again.`,
    );
  }

  // GUARD: if coverage was already requested, return the existing state.
  if (dbProposal.coverage_requested_at) {
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("wedding_id", weddingId)
      .in("role", [
        "Photographer",
        "Videographer",
        "Lead Photographer",
        "Lead Videographer",
      ])
      .neq("status", "cancelled");
    return {
      weddingId: weddingId,
      createdJobs: [],
      notified: 0,
    };
  }

  // Copy the wedding's territory_id onto any new coverage jobs so they are
  // scoped to the same territory as the wedding/proposal. If the wedding has
  // no territory, fall back to the viewed area (super-admin switcher →
  // manager territory). Never insert a blank-area job.
  let weddingTerritoryId: string | null = weddingRow.territory_id || null;
  if (!weddingTerritoryId) {
    weddingTerritoryId = await resolveTerritoryId().catch(() => null);
  }

  // Determine which roles to create (use the DB-loaded proposal).
  const videoNeeded = packageIncludesVideo(dbProposal);
  const photoCfg = payload?.roles?.photo;
  const videoCfg = payload?.roles?.video;

  const wantPhoto = photoCfg ? photoCfg.enabled && photoCfg.payRate > 0 : true;
  const wantVideo = videoCfg
    ? videoCfg.enabled && videoCfg.payRate > 0
    : videoNeeded;

  const coverageHours = extractCoverageHours(dbProposal);
  const notes = payload?.notes || "";

  // Fetch existing jobs for THIS wedding only. Select proposal_id so we can
  // avoid overwriting a job that already belongs to a different proposal.
  const { data: existingData } = await supabase
    .from("jobs")
    .select("id, role, status, contractor_id, coverage_request, proposal_id")
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
      proposal_id: proposalId,
      requirements: notes || null,
      ...(weddingTerritoryId ? { territory_id: weddingTerritoryId } : {}),
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

  // Mark any already-existing photo/video jobs as coverage requests too —
  // but NEVER overwrite a job that already has a different proposal_id, and
  // only touch jobs whose wedding_id equals this proposal's wedding (the
  // query above is already scoped to weddingId).
  if (existing.length) {
    const ids = existing
      .filter(
        (j) =>
          /photo|video/.test(String(j.role || "").toLowerCase()) &&
          j.status !== "cancelled" &&
          j.coverage_request !== true &&
          // Only adopt jobs that have no proposal_id yet, or already point at
          // THIS proposal. Never steal a job from another proposal.
          (!j.proposal_id || j.proposal_id === proposalId),
      )
      .map((j) => j.id);
    if (ids.length) {
      await supabase
        .from("jobs")
        .update({
          coverage_request: true,
          proposal_id: proposalId,
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
  // contractors by that region. weddings.region is a text array, so wrap the
  // single chosen region in an array. If the write fails, throw before
  // coverage_requested_at is stamped.
  if (payload?.region) {
    const { error: regionErr } = await supabase
      .from("weddings")
      .update({ region: [payload.region] })
      .eq("id", weddingId);
    if (regionErr) {
      throw new Error(
        `Failed to save the region on the wedding: ${regionErr.message || JSON.stringify(regionErr)}`,
      );
    }
  }

  // Stamp the proposal (use the DB-loaded id).
  await supabase
    .from("proposals")
    .update({ coverage_requested_at: new Date().toISOString() })
    .eq("id", proposalId);

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
 * Called after a contractor is assigned to a coverage job. If all required
 * roles now have a contractor_id, stamp coverage_confirmed_at on the proposal
 * so Sign & Pay unlocks.
 *
 * Arg order: (proposalId, weddingId) — NEVER swap. proposalId is primary;
 * weddingId is a fallback used to look up the proposal when proposalId is
 * missing.
 */
export async function maybeConfirmCoverage(
  proposalId?: string | null,
  weddingId?: string | null,
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
