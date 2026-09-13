/**
 * Specialty ↔ job-role matching for open positions.
 *
 * Bartenders are a first-class specialty: a Bartender only sees Bartender
 * jobs, and Bartender jobs only show to Bartenders. Photo/video/content
 * matching is unchanged.
 *
 * Returns true when the contractor is eligible for the job role.
 */
export function specialtyMatchesJob(
  contractorSpecialty: string | null | undefined,
  jobRole: string | null | undefined,
): boolean {
  const specialty = (contractorSpecialty || "").toLowerCase();
  const role = (jobRole || "").toLowerCase();

  const isBartender = /bartender/i.test(specialty);
  const roleIsBartender = /bartender/i.test(role);

  // Bartenders see only bartender jobs
  if (isBartender) return roleIsBartender;
  // Bartender jobs only show to bartenders
  if (roleIsBartender) return false;

  if (!specialty.includes("both") && !specialty.includes("&")) {
    if (specialty.includes("video") && !role.includes("video")) return false;
    if (specialty.includes("photo") && !role.includes("photo")) return false;
    if (specialty.includes("content") && !role.includes("content"))
      return false;
  }

  return true;
}
