import { supabase } from "./supabase";
import { api } from "./api";
import { saveContractSnapshotOnSign } from "./contract-snapshot";
import { createGhlInvoice } from "./ghl-invoice-api";
import { ensureWeddingForProposal } from "./proposal-wedding";
import { checkCustomPlanBalance } from "./custom-plan-balance";

export interface ProposalLike {
  id: string;
  client_name: string;
  total_amount: number;
  amount_paid_so_far?: number;
  is_upgrade?: boolean;
  wedding_id?: string | null;
  custom_payment_plan?: {
    enabled?: boolean;
    deposit?: number;
    installments?: { amount?: number; date?: string }[];
  } | null;
}

export type PaymentPlanOption =
  "deposit" | "fifty_fifty" | "quarterly" | "full" | "custom";

export interface SignAndPayResult {
  invoiceUrl?: string;
  accepted?: boolean;
}

/**
 * Sign & Pay for a proposal using a GHL invoice (no Stripe).
 *
 * Order:
 *  1. Save signature + plan on the proposal
 *  2. Ensure a weddings row exists (create-or-link) so we have a real
 *     weddings.id — never pass the proposalId as weddingId
 *  3. Create a GHL invoice for the first amount due only, capped at the
 *     remaining balance. If nothing is due, mark accepted with no invoice.
 *
 * Returns the invoice URL (step 4) or { accepted: true } (success screen).
 */
export async function signAndPayProposal(params: {
  proposal: ProposalLike;
  signature: string;
  paymentPlan: PaymentPlanOption;
  calculatePaymentAmount: () => number;
}): Promise<SignAndPayResult> {
  const { proposal, signature, paymentPlan, calculatePaymentAmount } = params;

  if (
    signature.trim().toLowerCase().replace(/\s+/g, "") !==
    proposal.client_name.toLowerCase().replace(/\s+/g, "")
  ) {
    throw new Error(
      "Please type your full name exactly as it appears on the proposal.",
    );
  }

  // 1. Snapshot the rendered contract HTML at sign time.
  await saveContractSnapshotOnSign(proposal.id);

  // 2. Save signature on the proposal.
  await supabase
    .from("proposals")
    .update({
      contract_signature: signature,
      contract_signed_at: new Date().toISOString(),
      payment_plan: paymentPlan,
    })
    .eq("id", proposal.id);

  // 3. Custom plans must schedule the full contract total. Block Sign & Pay
  //    if the deposit + installments don't sum to total_amount so we never
  //    invoice against an under-scheduled plan.
  if (paymentPlan === "custom" && proposal.custom_payment_plan?.enabled) {
    const bal = checkCustomPlanBalance(
      proposal.custom_payment_plan,
      Number(proposal.total_amount) || 0,
    );
    if (!bal.balanced) {
      throw new Error(
        bal.short > 0
          ? `Schedule the remaining $${bal.short.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} before continuing.`
          : `Installments exceed the contract by $${bal.over.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      );
    }
  }

  // 4. First amount due, capped at the remaining balance.
  const firstDue = Math.max(
    0,
    Math.min(
      calculatePaymentAmount(),
      proposal.total_amount - (proposal.amount_paid_so_far || 0),
    ),
  );

  if (firstDue <= 0) {
    await api.updateProposal(proposal.id, {
      status: "accepted",
      payment_plan: paymentPlan,
    } as any);
    return { accepted: true };
  }

  // 4. Ensure a weddings row exists BEFORE invoicing. A proposal often has no
  //    wedding_id yet; ghl-invoice requires a real weddings.id.
  const weddingId = await ensureWeddingForProposal(proposal.id);
  if (!weddingId) {
    throw new Error(
      "Could not create the wedding record for this proposal. Please try again or contact support.",
    );
  }

  // 5. Build the invoice label.
  const label = proposal.is_upgrade
    ? `Wedding Package Upgrade for ${proposal.client_name}`
    : paymentPlan === "custom"
      ? `Custom Payment Plan Deposit for ${proposal.client_name}`
      : paymentPlan === "full"
        ? `Wedding Payment in Full for ${proposal.client_name}`
        : paymentPlan === "fifty_fifty"
          ? `Wedding 50% Deposit for ${proposal.client_name}`
          : `Wedding Deposit for ${proposal.client_name}`;

  // 6. Create the GHL invoice (no Stripe).
  const invoice = await createGhlInvoice({
    weddingId,
    amount: firstDue,
    label,
  });

  return { invoiceUrl: invoice.invoiceUrl };
}
