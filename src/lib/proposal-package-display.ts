import type { ProposalPackage } from "./proposal-package";

/**
 * Resolve the package title + feature lists for the public proposal review
 * page, preferring the SAVED snapshot on the proposal row over any catalog
 * lookup.
 *
 * The snapshot (package_name, photo_features, video_features) is stamped onto
 * the proposal at create + send time so the review page never depends on a
 * client-side catalog lookup — which falls back to the wrong area on a phone
 * or private tab. Only when the saved fields are empty do we fall back to the
 * directly-loaded package row (`resolvedPackage`) or the area list.
 *
 * If package_id is set, never returns "Custom" and never returns the raw id.
 */
export function resolveProposalPackageDisplay(
  proposal: any,
  resolvedPackage: ProposalPackage | null,
  PACKAGES: any[],
) {
  // Never throw on a null/undefined proposal — the public proposal path calls
  // this before the null-proposal guard in ProposalReview renders.
  const safeProposal = proposal ?? {};
  const safePackages = Array.isArray(PACKAGES) ? PACKAGES.filter(Boolean) : [];

  const savedPackageName = (safeProposal.package_name || "").trim();
  const savedPhotoFeatures: string[] = Array.isArray(
    safeProposal.photo_features,
  )
    ? safeProposal.photo_features
    : [];
  const savedVideoFeatures: string[] = Array.isArray(
    safeProposal.video_features,
  )
    ? safeProposal.video_features
    : [];

  const hasPackageId = !!safeProposal.package_id;

  // Name: saved snapshot → resolved row → area list → "Custom" (only if no id).
  const packageName = hasPackageId
    ? savedPackageName ||
      resolvedPackage?.name ||
      safePackages.find((p) => p.id === safeProposal.package_id)?.name ||
      "Custom"
    : "Custom";

  // Features: saved snapshot wins; else resolved row; else area list.
  const areaPkg =
    resolvedPackage ??
    safePackages.find((p) => p.id === safeProposal.package_id);
  const photoFeatures =
    savedPhotoFeatures.length > 0
      ? savedPhotoFeatures
      : (areaPkg?.photoFeatures ?? []);
  const videoFeatures =
    savedVideoFeatures.length > 0
      ? savedVideoFeatures
      : (areaPkg?.videoFeatures ?? []);

  return { packageName, photoFeatures, videoFeatures, hasPackageId };
}
