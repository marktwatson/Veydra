import { supabase } from "./supabase";
import { api } from "./api";
import { saveContractSnapshotOnSign } from "./contract-snapshot";
import { createGhlInvoice } from "./ghl-invoice-api";
import { ensureWeddingForProposal } from "./proposal-wedding";
import { checkCustomPlanBalance } from "./custom-plan-balance";
import { buildInstallments, buildWeddingCustomPlan } from "./booking-schedule";

export interface ProposalLike {
  id: string;
  client_name: string;
  client_email?: string;
  total_amount: number;
  amount_paid_so_far?: number;
  is_upgrade?: boolean;
  wedding_id?: string | null;
  wedding_date?: string;
  created_at?: string;
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
  weddingId?: string;
  firstDue?: number;
  label?: string;
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
  /** When true, save signature + ensure wedding but do NOT create a GHL
   *  invoice. Returns { weddingId, firstDue, label } so the caller can
   *  create the invoice later only if the bride picks Card/bank. */
  signOnly?: boolean;
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

  // First amount due, capped at the remaining balance.
  const firstDue = Math.max(
    0,
    Math.min(
      calculatePaymentAmount(),
      proposal.total_amount - (proposal.amount_paid_so_far || 0),
    ),
  );

  // Ensure a weddings row exists BEFORE invoicing. A proposal often has no
  // wedding_id yet; ghl-invoice requires a real weddings.id.
  const weddingId = await ensureWeddingForProposal(proposal.id);
  if (!weddingId) {
    throw new Error(
      "Could not create the wedding record for this proposal. Please try again or contact support.",
    );
  }

  // Check if the wedding already has a primary GHL invoice. If it does AND
  // this is NOT an addon/upgrade (which creates a second invoice), return
  // the existing invoice URL instead of creating a duplicate. The original
  // photography invoice is never re-created.
  const isAddon = proposal.is_upgrade;
  if (!isAddon && firstDue > 0) {
    const { data: existingWedding } = await supabase
      .from("weddings")
      .select("ghl_invoice_id, ghl_invoice_url")
      .eq("id", weddingId)
      .maybeSingle();

    if (existingWedding?.ghl_invoice_url) {
      return {
        invoiceUrl: existingWedding.ghl_invoice_url,
        weddingId,
        firstDue,
        label: "",
      };
    }
  }

  if (firstDue <= 0) {
    await api.updateProposal(proposal.id, {
      status: "accepted",
      payment_plan: paymentPlan,
    } as any);
    return { accepted: true };
  }

  // Build the invoice label.
  const label = proposal.is_upgrade
    ? `Wedding Package Upgrade for ${proposal.client_name}`
    : paymentPlan === "custom"
      ? `Custom Payment Plan Deposit for ${proposal.client_name}`
      : paymentPlan === "full"
        ? `Wedding Payment in Full for ${proposal.client_name}`
        : paymentPlan === "fifty_fifty"
          ? `Wedding 50% Deposit for ${proposal.client_name}`
          : `Wedding Deposit for ${proposal.client_name}`;

  // Build the SAME schedule the bride saw on screen, using the shared builder
  // so the GHL invoice matches the on-page schedule for custom AND standard
  // plans (Standard / 50-50 / Full / Quarterly). Sum === total - paid.
  const remaining = Math.max(
    0,
    proposal.total_amount - (proposal.amount_paid_so_far || 0),
  );
  const scheduleInput = {
    paymentOption: paymentPlan,
    totalPrice: proposal.total_amount,
    paidSoFar: proposal.amount_paid_so_far || 0,
    weddingDate: proposal.wedding_date,
    createdAt: proposal.created_at,
    customPlan: proposal.custom_payment_plan as any,
  };
  const installments = isAddon ? [] : buildInstallments(scheduleInput);

  // Persist the same schedule onto weddings.custom_payment_plan so the PHOTO
  // invoice path (which rebuilds rows from the wedding row) and the on-page
  // display agree. For addons we leave the existing plan untouched.
  if (!isAddon && remaining > 0) {
    const weddingPlan = buildWeddingCustomPlan(scheduleInput);
    if (weddingPlan) {
      await supabase
        .from("weddings")
        .update({ custom_payment_plan: weddingPlan as any })
        .eq("id", weddingId);
    }
  }

  // signOnly: defer invoice creation. Return the params so the caller can
  // create the invoice only when the bride picks Card/bank.
  if (params.signOnly) {
    return { weddingId, firstDue, label };
  }

  // Create the GHL invoice (no Stripe).
  // forceNew is ONLY for addon/upgrade invoices (a SECOND GHL invoice for
  // the unpaid delta). A normal or revised photo proposal must NEVER pass
  // forceNew — it reuses the existing ghl_invoice_url when present (the
  // reuse check above already returned if one exists). Multi-row photography
  // plans reuse today's invoice / existing url via the edge function's
  // skipReuse=false path.
  // The same installments array (built above from the on-screen plan) is
  // passed on the PHOTO path too — the edge function still rebuilds planRows
  // from wedding.custom_payment_plan, but passing installments keeps the
  // payload consistent with what the bride saw.
  try {
    const invoice = await createGhlInvoice({
      weddingId,
      amount: firstDue,
      label,
      kind: proposal.is_upgrade ? "addon" : undefined,
      forceNew: proposal.is_upgrade ? true : undefined,
      installments: installments.length > 0 ? installments : undefined,
      proposalEmail: proposal.client_email,
    });
    return { invoiceUrl: invoice.invoiceUrl };
  } catch (e: any) {
    // Signature + contract_signed_at are already saved. Do NOT clear them.
    // The bride can tap Sign & Pay again — the resume hook will see
    // contract_signed_at and skip straight to the pay step.
    throw new Error(
      "Contract saved. Could not open invoice — tap Sign & Pay again.",
    );
  }
}
