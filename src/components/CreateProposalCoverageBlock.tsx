import { useMemo } from "react";
export { ProposalCoverageBlock } from "@/components/ProposalCoverageBlock";
import { ProposalCoverageBlock } from "@/components/ProposalCoverageBlock";
import { needsCoverage } from "@/lib/coverage";
import type { CreateProposalArgs } from "@/lib/use-create-proposal";

/**
 * Thin wrapper that wires ProposalCoverageBlock into CreateProposal without
 * growing that page. Computes the sticky proposal id (url id || savedProposal.id)
 * and passes an ensureSaved callback (saveDraft) so Request Coverage Now can
 * save a brand-new proposal before posting jobs.
 */
export function CreateProposalCoverageBlock({
  id,
  savedProposal,
  formData,
  coverageConfirmed,
  loadCoverageState,
  saveDraft,
  createArgs,
}: {
  id?: string;
  savedProposal: any;
  formData: any;
  coverageConfirmed: boolean;
  loadCoverageState: (proposalId: string) => Promise<void>;
  saveDraft: (args: CreateProposalArgs) => Promise<any>;
  createArgs: CreateProposalArgs;
}) {
  const shortNotice = needsCoverage(formData.weddingDate);

  const proposal = useMemo(
    () => ({
      id: id || savedProposal?.id,
      wedding_date: formData.weddingDate,
      coverage_type: formData.coverageType,
      addons: formData.addons,
      second_shooter_type: formData.secondShooterType,
      city: formData.city,
      coverage_confirmed_at: coverageConfirmed
        ? new Date().toISOString()
        : null,
    }),
    [
      id,
      savedProposal?.id,
      formData.weddingDate,
      formData.coverageType,
      formData.addons,
      formData.secondShooterType,
      formData.city,
      coverageConfirmed,
    ],
  );

  if (!shortNotice) return null;

  return (
    <ProposalCoverageBlock
      proposal={proposal}
      ensureSaved={async () => saveDraft(createArgs)}
      onChanged={() => {
        const pid = id || savedProposal?.id;
        if (pid) loadCoverageState(pid);
      }}
    />
  );
}
