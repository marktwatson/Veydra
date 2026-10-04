import { parseRegions } from "@/lib/utils";
import { specialtyMatchesJob } from "@/lib/specialty-job-match";

/**
 * One rule for every contractor job list (home, open positions, nav count).
 *
 * Hard scope is the contractor's territory_id. A job with a blank
 * territory_id, or a different one, is never shown. Region is optional and
 * off unless the caller passes filterRegion. Specialty, drone, and booked
 * dates still apply. An invited contractor skips those extra checks.
 */
export function contractorCanSeeJob(
  job: any,
  contractor: any,
  opts: { filterRegion?: boolean; bookedDates?: Set<string> } = {},
): boolean {
  if (!job || !contractor) return false;
  if (String(job.status || "").trim().toLowerCase() !== "open") return false;

  const jobTerritory = job.territory_id || null;
  const myTerritory = contractor.territory_id || null;
  if (!jobTerritory || !myTerritory || jobTerritory !== myTerritory) {
    return false;
  }

  const booked = opts.bookedDates;
  if (booked && job.weddings?.date && booked.has(job.weddings.date)) {
    return false;
  }

  const invited = Array.isArray(job.invited_contractors)
    ? job.invited_contractors.includes(contractor.id)
    : false;
  if (invited) return true;

  const isPhotoOnly =
    job.role?.toLowerCase().includes("photo") &&
    !job.role?.toLowerCase().includes("video");
  const requiresDrone =
    (job.drone_required === true || job.drone_required === "true") &&
    !isPhotoOnly;
  if (requiresDrone && !contractor.drone_approved) return false;

  if (
    contractor.specialty &&
    !specialtyMatchesJob(contractor.specialty, job.role)
  ) {
    return false;
  }

  if (opts.filterRegion && contractor.region) {
    const regions = parseRegions(contractor.region);
    if (regions.length > 0) {
      const isAllRegions = regions.some(
        (r) => r.toLowerCase() === "all regions",
      );
      if (!isAllRegions) {
        const jobLocation = (job.weddings?.location || "").toLowerCase();
        const weddingRegions = parseRegions(job.weddings?.region);
        const matchesRegion =
          weddingRegions.length > 0
            ? regions.some((r) =>
                weddingRegions.some(
                  (wr) => wr.toLowerCase() === r.toLowerCase(),
                ),
              )
            : regions.some((r) => jobLocation.includes(r.toLowerCase()));
        if (!matchesRegion) return false;
      }
    }
  }

  return true;
}
