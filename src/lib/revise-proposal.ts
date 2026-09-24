import { supabase } from "./supabase";
import { api } from "./api";

export interface ReviseOverrides {
  package_id?: string | null;
  coverage_type?: string;
  addons?: string[];
  second_shooter_hours?: number | null;
  second_shooter_type?: string | null;
  total_amount?: number;
  custom_prices?: any;
  custom_payment_plan?: any;
  notes?: string;
}

export interface ReviseResult {
  newProposalId: string;
  newLink: string;
  oldProposalId: string;
  /** GHL invoice number/id on the old proposal's wedding, if any (for the toast). */
  oldInvoiceNumber?: string | null;
  oldInvoiceId?: string | null;
}

/**
 * Staff-only "Revise package" on a signed or invoiced proposal.
 *
 * Creates a NEW proposal row copied from the old one with the new
 * package/totals, then marks the old proposal superseded.
 *
 * - Does NOT copy contract_signed_at / contract_status onto the new row.
 * - Does NOT copy ghl_invoice_id / ghl_invoice_url / offplatform_* / coverage_*.
 * - Does NOT void the GHL invoice from Veydra (caller toasts the Ovanta number).
 * - Same client gets a new /proposal/{newId} link.
 */
export async function reviseProposal(
  oldProposalId: string,
  overrides: ReviseOverrides,
): Promise<ReviseResult> {
  // 1. Fetch the full old row.
  const { data: old, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", oldProposalId)
    .single();
  if (error || !old) {
    throw new Error("Could not load the original proposal to revise.");
  }

  // 2. Look up the linked wedding's GHL invoice (for the toast only — never copied).
  let oldInvoiceId: string | null = null;
  let oldInvoiceNumber: string | null = null;
  const weddingId = old.is_upgrade ? old.original_wedding_id : old.wedding_id;
  if (weddingId) {
    const { data: w } = await supabase
      .from("weddings")
      .select("ghl_invoice_id, ghl_invoice_ids, ghl_invoice_number")
      .eq("id", weddingId)
      .maybeSingle();
    if (w) {
      oldInvoiceId = w.ghl_invoice_id || (w.ghl_invoice_ids?.[0] ?? null);
      oldInvoiceNumber = w.ghl_invoice_number || null;
    }
  }

  // 3. Build the new payload — copy everything, override package/totals, strip
  //    signed / invoice / off-platform / coverage state so the new row is fresh.
  //
  //    KEY: keep the existing wedding_id (and original_wedding_id for upgrades)
  //    so the revised proposal links to the SAME wedding — preserving the
  //    contractor assignments, coverage, and paid_amount. The bride signs the
  //    new contract and pays the new total against the same wedding row.
  //
  //    Also clear the stale off-platform promise on the wedding so the bride
  //    isn't stuck in "Payment in progress" when she returns to the new link.
  const {
    package_id,
    coverage_type,
    addons,
    second_shooter_hours,
    second_shooter_type,
    total_amount,
    custom_prices,
    custom_payment_plan,
    notes,
  } = overrides;

  const payload: Record<string, any> = {
    client_name: old.client_name,
    client_email: old.client_email,
    client_phone: old.client_phone,
    partner_name: old.partner_name,
    wedding_date: old.wedding_date,
    is_lgbtq: old.is_lgbtq,
    venue: old.venue,
    venue_address: old.venue_address,
    city: old.city,
    state: old.state,
    coverage_type: coverage_type ?? old.coverage_type,
    package_id: package_id !== undefined ? package_id : old.package_id,
    addons: addons !== undefined ? addons : old.addons,
    second_shooter_hours:
      second_shooter_hours !== undefined
        ? second_shooter_hours
        : old.second_shooter_hours,
    second_shooter_type:
      second_shooter_type !== undefined
        ? second_shooter_type
        : old.second_shooter_type,
    total_amount: total_amount !== undefined ? total_amount : old.total_amount,
    notes: notes !== undefined ? notes : old.notes,
    custom_prices: custom_prices ?? old.custom_prices,
    custom_payment_plan: custom_payment_plan ?? old.custom_payment_plan,
    // No expiry until staff clicks Send to client (clock starts on send only).
    expires_at: null,
    sent_at: null,
    sent_count: 0,
    is_upgrade: old.is_upgrade ?? false,
    original_wedding_id: old.original_wedding_id ?? null,
    amount_paid_so_far: old.amount_paid_so_far ?? 0,
    // Explicitly fresh — no signed/invoice/off-platform/coverage state carried.
    status: "pending",
    contract_status: null,
    contract_signed_at: null,
    custom_contract_snapshot: old.custom_contract_snapshot ?? null,
    viewed_at: null,
    offplatform_status: null,
    offplatform_method: null,
    offplatform_amount: null,
    offplatform_claimed_at: null,
    coverage_requested_at: null,
    coverage_confirmed_at: null,
    // Keep the existing wedding link so the revised proposal pays against the
    // same wedding (preserving assignments, coverage, paid_amount).
    wedding_id: old.wedding_id ?? null,
  };

  // 4. Insert the new proposal.
  const { data: created, error: insertError } = await supabase
    .from("proposals")
    .insert([payload])
    .select()
    .single();
  if (insertError || !created) {
    throw new Error(
      insertError?.message || "Could not create the revised proposal.",
    );
  }

  // 5. Mark the old proposal superseded.
  const { error: supError } = await supabase
    .from("proposals")
    .update({ status: "superseded" })
    .eq("id", oldProposalId);
  if (supError) {
    // Non-fatal — the new proposal exists; just log.
    console.warn("Could not mark old proposal superseded:", supError.message);
  }

  // 6. Clear stale off-platform promise + signed/invoice state on the wedding
  //    so the bride sees the FULL sign-and-pay flow on the revised proposal.
  //    Also update total_amount so the resume logic and dashboard reflect the
  //    new package total (prevents a false "confirmed" if she already paid the
  //    old amount via Venmo).
  //
  //    The wedding stays published (status upcoming) — we do NOT unpublish.
  //    Contractor assignments are untouched (they live on the wedding, not the
  //    proposal). paid_amount is preserved so any prior Venmo payment counts
  //    toward the new total.
  const clearWeddingId = old.is_upgrade
    ? old.original_wedding_id
    : old.wedding_id;
  if (clearWeddingId) {
    try {
      await supabase
        .from("weddings")
        .update({
          offplatform_status: null,
          offplatform_method: null,
          offplatform_amount: null,
          offplatform_claimed_at: null,
          // Clear the old invoice so the new proposal's Sign & Pay creates a
          // fresh one for the new total. Staff voids the old invoice in the CRM.
          ghl_invoice_id: null,
          ghl_invoice_url: null,
          ghl_invoice_amount: null,
          ghl_invoice_created_date: null,
          // Sync the revised proposal's custom_payment_plan onto the wedding so
          // that ghl-invoice has the latest installments and doesn't use stale ones.
          custom_payment_plan:
            custom_payment_plan !== undefined
              ? custom_payment_plan
              : old.custom_payment_plan,
          // Clear the old contract sign state so the bride re-signs the new
          // contract (new total / hours). Without this, useProposalResume sees
          // wedding.contract_signed_at and skips the contract pad.
          contract_signed_at: null,
          contract_status: null,
          // Update the wedding total to the new package total so the resume
          // "confirmed" check (paid >= total) uses the right denominator.
          total_amount:
            total_amount !== undefined ? total_amount : old.total_amount,
        })
        .eq("id", clearWeddingId);
    } catch (e: any) {
      console.warn(
        "[revise-proposal] could not clear stale wedding state:",
        e?.message,
      );
    }
  }

  api.logAdminActivity(
    "Proposal Revised",
    `Revised proposal ${oldProposalId} → ${created.id} for ${old.client_name}`,
  );

  return {
    newProposalId: created.id,
    newLink: `${window.location.origin}/proposal/${created.id}`,
    oldProposalId,
    oldInvoiceId,
    oldInvoiceNumber,
  };
}
