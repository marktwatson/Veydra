/**
 * Computes "booked hours" for a wedding as coverage hours, NOT the sum of
 * every job's hours. An 8-hour photo + 8-hour video wedding is 8 hours of
 * coverage, not 16.
 *
 * Rule:
 *  - Consider only lead coverage roles: Lead Photographer, Lead Videographer,
 *    Photographer, Videographer.
 *  - Ignore Second Photographer, Second Videographer, Bartender, and anything
 *    else.
 *  - Booked hours = the MAX of those lead-role hours (never the sum).
 *  - If no lead role has hours, fall back to a single coverage field on the
 *    wedding package if present.
 */

const LEAD_ROLE_MATCHERS: RegExp[] = [
  /^lead\s*photographer$/i,
  /^lead\s*videographer$/i,
  /^photographer$/i,
  /^videographer$/i,
];

export function isLeadCoverageRole(role: string | undefined | null): boolean {
  if (!role) return false;
  const r = String(role).trim();
  return LEAD_ROLE_MATCHERS.some((re) => re.test(r));
}

/**
 * @param jobs  array of job rows (must have `role` and `hours`)
 * @param fallbackHours optional single coverage-hours value (e.g. from the
 *   wedding package) used only when no lead role has hours
 */
export function computeBookedHours(
  jobs: Array<{ role?: string | null; hours?: number | string | null }>,
  fallbackHours?: number | string | null,
): number {
  let maxLead = 0;
  for (const j of jobs) {
    if (!isLeadCoverageRole(j.role)) continue;
    const h = Number(j.hours);
    if (!isNaN(h) && h > maxLead) maxLead = h;
  }
  if (maxLead > 0) return maxLead;
  const f = Number(fallbackHours);
  return !isNaN(f) && f > 0 ? f : 0;
}
