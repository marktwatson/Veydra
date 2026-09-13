import { useEffect, useRef } from "react";
import { useProposalResume } from "@/lib/use-proposal-resume";

/**
 * Auto-advances the ProposalReview step based on the proposal resume state.
 *
 * When a bride returns to a proposal that has already progressed past "fresh",
 * this hook jumps her directly to step 3 (Contract) — which already renders
 * ProposalResumeView for non-fresh states. This avoids making her click through
 * the review + payment-plan steps again.
 *
 * - fresh      → no jump (stay on current step)
 * - signed     → step 3 (ProposalContractStep renders the PayStepChoice)
 * - invoice    → step 3 (ProposalContractStep renders "Open invoice")
 * - offplatform → step 3 (ProposalContractStep renders method/amount/state)
 * - confirmed  → step 3 (ProposalContractStep renders thank-you)
 *
 * Only jumps once per mount (guarded by a ref) so manual navigation still works.
 */
export function useProposalResumeStep(
  proposalId: string | undefined,
  proposal: any | null,
  step: number,
  setStep: (s: 1 | 2 | 3 | 4) => void,
) {
  const resume = useProposalResume(proposalId, proposal);
  const jumped = useRef(false);

  useEffect(() => {
    if (jumped.current) return;
    if (!proposal) return;
    if (resume.state === "fresh") return;

    // Jump to step 3 — ProposalContractStep already handles all non-fresh
    // resume states by rendering ProposalResumeView.
    jumped.current = true;
    if (step !== 3) {
      setStep(3);
    }
  }, [resume.state, proposal, step, setStep]);

  return resume;
}
