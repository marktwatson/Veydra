import { useState, useEffect } from "react";
import { loadProposalAndBranding } from "./proposal-review-data";
import { FALLBACK_PACKAGES, FALLBACK_ADDONS } from "./booking-fallbacks";
import type { ProposalPackage, ProposalAddon } from "./proposal-package";
import { useToast } from "@/hooks/use-toast";

/**
 * Loads the proposal, territory-scoped branding, area packages/addons, and
 * the EXACT package row for this proposal (by package_id + territory_id) for
 * the public /proposal/:id review page.
 *
 * `resolvedPackage` is authoritative for the package title + feature lists —
 * it is loaded directly and never falls back to the Honeysuckle catalog, so a
 * bride always sees "The Celebration Package (Photo & Video)" with the right
 * photo/video features regardless of whether the area list load succeeds.
 */
export function useProposalReviewData(id?: string) {
  const [proposal, setProposal] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [PACKAGES, setPackages] = useState<any[]>(FALLBACK_PACKAGES);
  const [ADDONS, setAddons] = useState<any[]>(FALLBACK_ADDONS);
  const [resolvedPackage, setResolvedPackage] =
    useState<ProposalPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const {
          proposal: proposalData,
          branding: brandingData,
          packages: areaPackages,
          addons: areaAddons,
          resolvedPackage: resolvedPkg,
          notFound,
        } = await loadProposalAndBranding(id);
        if (notFound) {
          toast({
            title: "Error",
            description: "Proposal not found or expired.",
            variant: "destructive",
          });
        } else {
          setProposal(proposalData);
        }
        if (brandingData) setBranding(brandingData);
        if (areaPackages.length) setPackages(areaPackages);
        if (areaAddons.length) setAddons(areaAddons);
        if (resolvedPkg) setResolvedPackage(resolvedPkg);
      } catch (err) {
        console.error("Error loading portal data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  return {
    proposal,
    setProposal,
    branding,
    setBranding,
    PACKAGES,
    setPackages,
    ADDONS,
    setAddons,
    resolvedPackage,
    setResolvedPackage,
    loading,
    setLoading,
  };
}
