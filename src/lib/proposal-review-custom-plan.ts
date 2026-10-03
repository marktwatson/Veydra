import { isCustomPlanActive, parseCustomPlan } from "@/lib/booking-schedule";

/**
 * ProposalReview custom-plan helpers.
 *
 * ProposalReview.tsx is at its edit cap, so the custom-plan detection +
 * first-due logic lives here and is imported as a single line. A custom plan
 * is active when enabled is true, payment_plan is "custom", OR installments
 * exist — a missing enabled flag must not revert to the $99 standard deposit.
 */

/** True when this proposal should use its custom plan over the $99 deposit. */
export function proposalHasCustomPlan(proposal: any | null): boolean {
  if (!proposal) return false;
  return isCustomPlanActive(
    proposal.custom_payment_plan,
    proposal.payment_plan,
  );
}

/** First amount due for a proposal. Custom plan → its deposit; else the
 *  standard-plan amount (full / 50-50 / quarterly / $99). */
export function proposalFirstDue(
  proposal: any | null,
  paymentPlan: string,
): number {
  if (!proposal) return 0;
  const customActive = proposalHasCustomPlan(proposal);
  if (proposal.is_upgrade) {
    if (customActive)
      return parseCustomPlan(proposal.custom_payment_plan)?.deposit || 0;
    return Math.max(
      0,
      proposal.total_amount - (proposal.amount_paid_so_far || 0),
    );
  }
  if (customActive)
    return parseCustomPlan(proposal.custom_payment_plan)?.deposit || 0;
  if (paymentPlan === "full") return proposal.total_amount;
  if (paymentPlan === "fifty_fifty") return proposal.total_amount / 2;
  if (paymentPlan === "quarterly") return proposal.total_amount / 4;
  return 99;
}

export { isCustomPlanActive, parseCustomPlan };
