import { CheckCircle2 } from "lucide-react";
import type { ProposalPackage } from "@/lib/proposal-package";

/**
 * Renders the base-coverage feature lists for a proposal's package.
 *
 * Features come from the proposal's OWN package row (`resolvedPackage`,
 * loaded directly by package_id + territory_id), falling back to the area
 * package list. Never the Honeysuckle fallback catalog — so a bride always
 * sees the right photo/video features for her area's package.
 */
export function ProposalPackageFeatures({
  resolvedPackage,
  PACKAGES,
  packageId,
  coverageType,
  packageString,
}: {
  resolvedPackage: ProposalPackage | null;
  PACKAGES: any[];
  packageId: string;
  coverageType: string;
  packageString: string;
}) {
  if (!packageId) return null;

  // Resolved row wins; fall back to the area list only if it's missing.
  const pkg: ProposalPackage | undefined =
    resolvedPackage ?? PACKAGES.find((p) => p.id === packageId);
  const photoFeatures = pkg?.photoFeatures ?? [];
  const videoFeatures = pkg?.videoFeatures ?? [];

  return (
    <div className="space-y-6 border-b border-border pb-8">
      <div>
        <h3 className="text-xl font-medium">{packageString} Package</h3>
        <p className="text-muted-foreground font-sans mt-1">
          Base coverage includes:
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {(coverageType === "photo" || coverageType === "both") && (
          <div className="space-y-3">
            <h4 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
              Photography
            </h4>
            <ul className="space-y-2">
              {photoFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(coverageType === "video" || coverageType === "both") && (
          <div className="space-y-3">
            <h4 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
              Videography
            </h4>
            <ul className="space-y-2">
              {videoFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
