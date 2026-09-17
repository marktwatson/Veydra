import { supabase } from "./supabase";

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
): Promise<{
  ok: boolean;
  alreadyCovered?: boolean;
  coverageConfirmed?: boolean;
}> {
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, contractor_id, wedding_id, proposal_id, role")
    .eq("id", jobId)
    .single();
  if (!job) throw new Error("Job not found");
  if (job.status === "cancelled") throw new Error("Job is cancelled");

  // If a manager already assigned someone, it's covered.
  if (job.contractor_id) {
    return { ok: false, alreadyCovered: true };
  }

  // Check for an existing application by this contractor.
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
    throw new Error(appErr.message || "Could not submit application.");
  }

  // Notify staff that an application came in.
  try {
    const { data: contractor } = await supabase
      .from("contractors")
      .select("first_name, last_name")
      .eq("id", contractorId)
      .single();
    const name = contractor
      ? `${contractor.first_name} ${contractor.last_name}`.trim()
      : "A contractor";
    await supabase.from("notifications").insert({
      title: "Coverage application",
      message: `${name} applied for ${job.role || "coverage"} on a short-notice wedding.`,
      type: "job",
      read: false,
    });
  } catch {}

  return { ok: true, coverageConfirmed: false };
}
