import { supabase } from "./supabase";
import { api } from "./api";
import { saveContractSnapshotOnSign } from "./contract-snapshot";
import { createGhlInvoice } from "./ghl-invoice-api";
import { ensureWeddingForProposal } from "./proposal-wedding";
import { checkCustomPlanBalance } from "./custom-plan-balance";

export interface ProposalLike {
  id: string;
  client_name: string;
  client_email?: string;
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

  // Build installments from THIS proposal's custom_payment_plan (not a stale
  // wedding row) so the GHL invoice uses the revised schedule. Merge same-day
  // rows and clamp dates >= today. Strip the deposit row if the first
  // installment is already today (deposit is the firstDue).
  const cpp = proposal.custom_payment_plan;
  const installments: { date: string; amount: number }[] = [];
  if (paymentPlan === "custom" && cpp?.enabled) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const insts = Array.isArray(cpp.installments) ? cpp.installments : [];
    const byDay: Record<string, number> = {};
    const dayOrder: string[] = [];
    for (const inst of insts) {
      let due = inst.date || (inst as any).dueDate || "";
      if (!due) continue;
      if (due < todayStr) due = todayStr;
      const amt = Number(inst.amount || 0);
      if (amt <= 0) continue;
      if (!byDay[due]) {
        byDay[due] = 0;
        dayOrder.push(due);
      }
      byDay[due] += amt;
    }
    for (const d of dayOrder)
      installments.push({ date: d, amount: Math.round(byDay[d] * 100) / 100 });
    // Sort ascending, ensure strictly unique dates.
    installments.sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
    // Skip a separate deposit row when the first installment is already today.
    const deposit = Number(cpp.deposit) || 0;
    if (deposit > 0 && installments.length > 0) {
      const first = installments[0];
      if (first.date === todayStr) {
        first.amount += Math.round(deposit * 100) / 100;
      } else {
        installments.unshift({ date: todayStr, amount: deposit });
      }
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
  // reuse check above already returned if one exists). Multi-row custom
  // photography plans reuse today's invoice / existing url via the edge
  // function's skipReuse=false path.
  // NOTE: the edge function PHOTO path rebuilds planRows from
  // wedding.custom_payment_plan — the installments array here is only used
  // to signal addon rows. Do NOT pass installments on the PHOTO path.
  try {
    const invoice = await createGhlInvoice({
      weddingId,
      amount: firstDue,
      label,
      kind: proposal.is_upgrade ? "addon" : undefined,
      forceNew: proposal.is_upgrade ? true : undefined,
      installments:
        proposal.is_upgrade && installments.length > 1
          ? installments
          : undefined,
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
