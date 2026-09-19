import ProposalShareModal from "@/components/ProposalShareModal";
import { CreateProposalCoverageBlock } from "@/components/CreateProposalCoverageBlock";
import { supabase } from "@/lib/supabase";

export interface CreateProposalModalsProps {
  /** The saved proposal row (from the hook). */
  savedProposal: any;
  /** Form data snapshot. */
  formData: any;
  /** Whether the share modal should be open (from the hook). */
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  /** The proposal link. */
  proposalLink: string;
  /** coveragePending flag for the share modal. */
  coveragePending: boolean;
  /** Called after a successful Send to client. */
  onSent?: () => void;
  /** Called after coverage is requested successfully. */
  onCoverageDone?: () => void;
  /** Route id (edit mode). */
  id?: string;
}

/**
 * Minimal save used only by the coverage block's ensureSaved when the
 * proposal hasn't been saved yet. Inserts or updates the proposals row and
 * returns it with an id so requestCoverage can post jobs.
 *
 * This mirrors the essential fields from use-create-proposal.saveDraft
 * without depending on the hook instance (the page is at the edit cap and
 * cannot pass saveDraft down).
 */
async function ensureProposalSaved(
  id: string | undefined,
  formData: any,
): Promise<any> {
  const payload = {
    client_name: formData.clientName,
    client_email: formData.clientEmail,
    client_phone: formData.clientPhone,
    partner_name: formData.partnerName,
    wedding_date: formData.weddingDate,
    is_lgbtq: formData.isLgbtq,
    venue: formData.venue,
    venue_address: formData.venueAddress,
    city: formData.city,
    state: formData.state,
    coverage_type: formData.coverageType,
    package_id: formData.packageId,
    addons: formData.addons,
    second_shooter_hours: formData.secondShooterHours,
    second_shooter_type: formData.secondShooterType,
    total_amount: formData.totalPrice ?? 0,
    notes: formData.notes,
    custom_prices: {
      discount: formData.customDiscount,
      discountType: formData.customDiscountType,
      items: formData.customItems || [],
    },
    custom_payment_plan: formData.customPaymentPlan?.enabled
      ? {
          enabled: true,
          deposit: formData.customPaymentPlan.deposit,
          installments: formData.customPaymentPlan.installments,
        }
      : { enabled: false, deposit: 0, installments: [] },
  };

  if (id) {
    const { data, error } = await supabase
      .from("proposals")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message || JSON.stringify(error));
    return data;
  }
  const { data, error } = await supabase
    .from("proposals")
    .insert([payload])
    .select()
    .single();
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
}

/**
 * Renders the ProposalShareModal for CreateProposal AND the opt-in
 * CreateProposalCoverageBlock. The coverage block is self-contained — its
 * ensureSaved calls ensureProposalSaved so a brand-new proposal gets a real
 * id before jobs are posted, without needing extra props from the page.
 */
export function CreateProposalModals({
  savedProposal,
  formData,
  shareOpen,
  setShareOpen,
  proposalLink,
  coveragePending,
  onSent,
  onCoverageDone,
  id,
}: CreateProposalModalsProps) {
  return (
    <>
      <CreateProposalCoverageBlock
        id={id}
        savedProposal={savedProposal}
        formData={formData}
        coverageConfirmed={!!savedProposal?.coverage_confirmed_at}
        loadCoverageState={async (_proposalId: string) => {}}
        saveDraft={async (_args: any) => ensureProposalSaved(id, formData)}
        createArgs={{} as any}
        onChanged={onCoverageDone}
      />
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
    </>
  );
}
