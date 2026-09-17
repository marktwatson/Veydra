import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProposalShareModal from "@/components/ProposalShareModal";
import { CoverageRequestModal } from "@/components/CoverageRequestModal";

export interface CreateProposalModalsProps {
  /** The saved proposal row (from the hook). */
  savedProposal: any;
  /** Form data snapshot used to build the coverage modal proposal object. */
  formData: any;
  /** Whether the coverage modal should be open (from the hook). */
  coverageModalOpen: boolean;
  setCoverageModalOpen: (open: boolean) => void;
  /** Whether the share modal should be open (from the hook). */
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  /** The proposal link. */
  proposalLink: string;
  /** coveragePending flag for the share modal. */
  coveragePending: boolean;
  /** Called after coverage is requested successfully. */
  onCoverageDone?: () => void;
}

/**
 * Renders the CoverageRequestModal + ProposalShareModal pair for
 * CreateProposal. Keeps the page file small by owning the regions fetch.
 */
export function CreateProposalModals({
  savedProposal,
  formData,
  coverageModalOpen,
  setCoverageModalOpen,
  shareOpen,
  setShareOpen,
  proposalLink,
  coveragePending,
  onCoverageDone,
}: CreateProposalModalsProps) {
  const [regions, setRegions] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("portal_settings")
      .select("regions")
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (Array.isArray(data?.regions)) setRegions(data.regions);
      });
  }, []);

  // Build the proposal object the coverage modal expects.
  const proposalForModal: any = savedProposal
    ? {
        ...savedProposal,
        wedding_date: formData.weddingDate,
        city: formData.city,
        state: formData.state,
        venue: formData.venue,
        coverage_type: formData.coverageType,
        addons: formData.addons,
        second_shooter_type: formData.secondShooterType,
      }
    : {
        wedding_date: formData.weddingDate,
        city: formData.city,
        state: formData.state,
        venue: formData.venue,
        coverage_type: formData.coverageType,
        addons: formData.addons,
        second_shooter_type: formData.secondShooterType,
      };

  return (
    <>
      <CoverageRequestModal
        open={coverageModalOpen}
        onOpenChange={setCoverageModalOpen}
        proposal={proposalForModal}
        regions={regions}
        onDone={onCoverageDone}
      />
      <ProposalShareModal
        link={proposalLink}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        coveragePending={coveragePending}
      />
    </>
  );
}
