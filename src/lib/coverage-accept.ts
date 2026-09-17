import { supabase } from "./supabase";

/**
 * Contractor "I can take this" for a coverage-request job.
 *
 * Sets contractor_id + status "assigned" + accepted_at on the job, creates or
 * updates an assignment row, and stamps coverage_confirmed_at on the linked
 * proposal when all required roles are now covered. First-accept wins: if the
 * job already has a different contractor_id, returns { alreadyCovered: true }.
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
  if (job.contractor_id && job.contractor_id !== contractorId) {
    return { ok: false, alreadyCovered: true };
  }
  if (job.status === "cancelled") throw new Error("Job is cancelled");

  const acceptedAt = new Date().toISOString();
  const { error: jobErr } = await supabase
    .from("jobs")
    .update({
      contractor_id: contractorId,
      status: "assigned",
      accepted_at: acceptedAt,
    })
    .eq("id", jobId);
  if (jobErr) {
    // accepted_at column may be missing on some areas — retry without it
    const { error: jobErr2 } = await supabase
      .from("jobs")
      .update({ contractor_id: contractorId, status: "assigned" })
      .eq("id", jobId);
    if (jobErr2) throw jobErr2;
  }

  // Create / update assignment row
  try {
    const { data: existingAsg } = await supabase
      .from("assignments")
      .select("id")
      .eq("job_id", jobId)
      .maybeSingle();
    if (existingAsg) {
      await supabase
        .from("assignments")
        .update({ contractor_id: contractorId, status: "Assigned" })
        .eq("id", existingAsg.id);
    } else {
      await supabase.from("assignments").insert({
        job_id: jobId,
        contractor_id: contractorId,
        status: "Assigned",
      });
    }
  } catch (e) {
    console.error("coverage accept assignment insert failed", e);
  }

  // Confirm coverage on the proposal if all required roles are now covered
  let coverageConfirmed = false;
  try {
    const { maybeConfirmCoverage } = await import("./coverage-request");
    if (job.proposal_id) {
      coverageConfirmed = await maybeConfirmCoverage(
        job.wedding_id,
        job.proposal_id,
      );
    } else if (job.wedding_id) {
      coverageConfirmed = await maybeConfirmCoverage(job.wedding_id);
    }
  } catch (e) {
    console.error("maybeConfirmCoverage failed", e);
  }

  // Notify staff
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
      title: "Coverage accepted",
      message: `${name} accepted ${job.role || "coverage"} for a wedding on ${job.wedding_id || ""}`,
      type: "job",
      read: false,
    });
  } catch {}

  return { ok: true, coverageConfirmed };
}
