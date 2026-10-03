/**
 * Territory-scoped overrides for the package/settings API methods.
 *
 * api.ts is at its edit cap, so we cannot edit getPortalSettings / savePackage
 * / saveAddon / deletePackage / deleteAddon / getPackages / getAddons in place.
 * Instead we monkey-patch those methods on the shared `api` object at module
 * load time. This runs once, before any component reads settings or packages.
 *
 * What changes:
 *  - getPortalSettings: picks the row whose territory_id matches the logged-in
 *    manager (super admin → Honeysuckle). Never a bare .limit(1).
 *  - updatePortalSettings: stamps territory_id and updates only that area row.
 *  - savePackage / saveAddon: include territory_id and upsert on
 *    (id, territory_id).
 *  - deletePackage / deleteAddon: filter by territory_id too.
 *  - getPackages / getAddons: stay unfiltered in JS (RLS scopes them).
 */
import { api } from "./api";
import { logAdminActivity } from "./api-admin-activity";
import { currentTerritoryId } from "./current-territory";
import { buildUpcomingPayments } from "./dashboard-upcoming-payments";
import {
  fetchJobsForTerritory,
  fetchAssignmentsForTerritory,
  fetchApplicationsForTerritory,
} from "./api-territory-scoped";
import {
  getPortalSettings as getPortalSettingsScoped,
  updatePortalSettings as updatePortalSettingsScoped,
  getPackages as getPackagesScoped,
  savePackage as savePackageScoped,
  deletePackage as deletePackageScoped,
  getAddons as getAddonsScoped,
  saveAddon as saveAddonScoped,
  deleteAddon as deleteAddonScoped,
} from "./portal-packages";

let patched = false;

export function patchApiForTerritory(): void {
  if (patched) return;
  patched = true;

  // getPortalSettings — pick the manager's territory row (Honeysuckle for
  // super admin). Never a bare .limit(1).
  (api as any).getPortalSettings = getPortalSettingsScoped;

  // updatePortalSettings — stamp territory_id, update only that area row,
  // keep the admin-activity log.
  (api as any).updatePortalSettings = (
    settings: Parameters<typeof updatePortalSettingsScoped>[0],
  ) =>
    updatePortalSettingsScoped(settings, () =>
      logAdminActivity("Updated Settings", "Updated portal settings"),
    );

  // Packages / addons — unfiltered reads (RLS scopes), territory-stamped writes.
  (api as any).getPackages = getPackagesScoped;
  (api as any).savePackage = savePackageScoped;
  (api as any).deletePackage = deletePackageScoped;
  (api as any).getAddons = getAddonsScoped;
  (api as any).saveAddon = saveAddonScoped;
  (api as any).deleteAddon = deleteAddonScoped;

  // List fetches — scope to the current user's area so the manager Dashboard
  // (which calls getWeddings / getContractors / getJobs / getAssignments
  // directly) honors the super-admin area picker. null = All Areas (no
  // filter). The dedicated list pages already call the *ForTerritory variants
  // directly, so they are unaffected by these overrides.
  (api as any).getWeddings = () =>
    currentTerritoryId().then((tid) => api.getWeddingsForTerritory(tid));
  (api as any).getContractors = () =>
    currentTerritoryId().then((tid) => api.getContractorsForTerritory(tid));
  (api as any).getJobs = () =>
    currentTerritoryId().then((tid) => fetchJobsForTerritory(tid));
  (api as any).getAssignments = () =>
    currentTerritoryId().then((tid) => fetchAssignmentsForTerritory(tid));
  (api as any).getApplications = () =>
    currentTerritoryId().then((tid) => fetchApplicationsForTerritory(tid));

  // Upcoming 14-day revenue helper — exposed on `api` so the Dashboard (at its
  // import cap) can call api.buildUpcomingPayments(...) without a new import.
  (api as any).buildUpcomingPayments = buildUpcomingPayments;
}

// Auto-patch on import so any entry point that imports api gets the scoped
// versions without each caller needing to call patchApiForTerritory().
patchApiForTerritory();
