import ProposalShareModal from "@/components/ProposalShareModal";

export interface CreateProposalModalsProps {
  /** The saved proposal row (from the hook). */
  savedProposal: any;
  /** Form data snapshot (kept for API compatibility). */
  formData: any;
  /** Whether the share modal should be open (from the hook). */
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  /** The proposal link. */
  proposalLink: string;
  /** coveragePending flag for the share modal. */
  coveragePending: boolean;
  /** Called after coverage is requested successfully. */
  onCoverageDone?: () => void;
  /** Called after a successful Send to client. */
  onSent?: () => void;
}

/**
 * Renders the ProposalShareModal for CreateProposal.
 * Coverage is now requested directly from the hook (no modal).
 */
export function CreateProposalModals({
  savedProposal,
  formData,
  shareOpen,
  setShareOpen,
  proposalLink,
  coveragePending,
  onSent,
}: CreateProposalModalsProps) {
  return (
    <ProposalShareModal
      link={proposalLink}
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      proposalId={savedProposal?.id}
      clientEmail={savedProposal?.client_email || formData?.clientEmail}
      clientPhone={savedProposal?.client_phone || formData?.clientPhone}
      coveragePending={coveragePending}
      onSent={onSent}
    />
  );
}
