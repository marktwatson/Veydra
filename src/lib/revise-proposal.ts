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
    // Fresh expiry (7 days from now).
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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
    wedding_id: null,
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
