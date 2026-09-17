import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type ProposalResumeState =
  | "fresh"
  | "signed"
  | "signed_changed"
  | "invoice"
  | "offplatform"
  | "confirmed"
  | "expired";

export interface ProposalResume {
  state: ProposalResumeState;
  weddingId: string | null;
  invoiceUrl: string | null;
  offplatformStatus: string | null;
  offplatformMethod: string | null;
  offplatformAmount: number | null;
  offplatformClaimedAt: string | null;
  /** True when the contract was signed but the currently-rendered contract
   *  HTML no longer matches the stored snapshot — the pad should re-show. */
  contractSnapshotChanged: boolean;
}

const EMPTY: ProposalResume = {
  state: "fresh",
  weddingId: null,
  invoiceUrl: null,
  offplatformStatus: null,
  offplatformMethod: null,
  offplatformAmount: null,
  offplatformClaimedAt: null,
  contractSnapshotChanged: false,
};

/**
 * Compares the currently-rendered contract HTML in the DOM against the
 * stored `custom_contract_snapshot` on the proposal. If they differ, the
 * contract was changed after signing and the bride should re-sign.
 *
 * Returns true when the snapshot has changed (pad should re-show).
 */
function hasContractSnapshotChanged(proposal: any): boolean {
  if (!proposal) return false;
  if (!proposal.contract_signed_at && proposal.contract_status !== "signed")
    return false;
  // If there's no stored snapshot, we can't compare — assume unchanged.
  if (!proposal.custom_contract_snapshot) return false;
  const el = document.querySelector(".contract-content") as HTMLElement | null;
  if (!el) return false;
  return (
    el.innerHTML.trim() !== String(proposal.custom_contract_snapshot).trim()
  );
}

/**
 * Detects the resume state of a proposal so ProposalReview can skip
 * already-completed steps instead of restarting from scratch.
 *
 * States:
 * - confirmed:    off-platform confirmed OR paid_amount >= total - 0.01
 * - offplatform:   offplatform_status is promised or claimed
 * - invoice:       GHL invoice exists (ghl_invoice_id or ghl_invoice_url)
 * - signed_changed: signed but snapshot !== current render → re-show pad
 * - signed:        signed, snapshot matches → pay step only (no pad)
 * - fresh:         nothing yet — show the normal 4-step flow
 */
export function useProposalResume(
  proposalId: string | undefined,
  proposal: any | null,
): ProposalResume {
  const [resume, setResume] = useState<ProposalResume>(EMPTY);

  useEffect(() => {
    if (!proposalId || !proposal) {
      setResume(EMPTY);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const snapshotChanged = hasContractSnapshotChanged(proposal);

        // Expired proposal (sent + past expires_at) and not booked → expired
        // overlay. Checked first so the bride sees it before sign/pay.
        if (
          proposal.sent_at &&
          proposal.expires_at &&
          new Date(proposal.expires_at) < new Date() &&
          proposal.status !== "accepted" &&
          proposal.status !== "paid" &&
          proposal.status !== "upcoming"
        ) {
          setResume({
            state: "expired",
            weddingId: proposal.is_upgrade
              ? proposal.original_wedding_id
              : proposal.wedding_id,
            invoiceUrl: null,
            offplatformStatus: null,
            offplatformMethod: null,
            offplatformAmount: null,
            offplatformClaimedAt: null,
            contractSnapshotChanged: snapshotChanged,
          });
          return;
        }

        // Resolve the wedding id for this proposal.
        let weddingId: string | null = proposal.is_upgrade
          ? proposal.original_wedding_id
          : proposal.wedding_id;

        // If no wedding id on the proposal, try to find one by proposal id.
        if (!weddingId) {
          const { data: wByProposal } = await supabase
            .from("weddings")
            .select("id")
            .eq("proposal_id", proposalId)
            .limit(1)
            .maybeSingle();
          if (wByProposal?.id) weddingId = wByProposal.id;
        }

        // Also check proposal-level off-platform flags (self-healed columns).
        const propOffStatus = proposal.offplatform_status || null;

        // If we have a wedding, load its payment / invoice / off-platform state.
        if (weddingId) {
          const { data: wedding } = await supabase
            .from("weddings")
            .select(
              "id, paid_amount, total_amount, ghl_invoice_id, ghl_invoice_url, ghl_invoice_ids, offplatform_status, offplatform_method, offplatform_amount, offplatform_claimed_at, contract_signed_at, contract_status",
            )
            .eq("id", weddingId)
            .maybeSingle();

          if (cancelled) return;

          if (wedding) {
            const paid = Number(wedding.paid_amount || 0);
            const total = Number(
              wedding.total_amount || proposal.total_amount || 0,
            );
            const ofStatus =
              wedding.offplatform_status || propOffStatus || null;

            // Confirmed: off-platform confirmed OR paid in full.
            if (
              ofStatus === "confirmed" ||
              (total > 0 && paid >= total - 0.01)
            ) {
              setResume({
                state: "confirmed",
                weddingId,
                invoiceUrl: wedding.ghl_invoice_url || null,
                offplatformStatus: ofStatus,
                offplatformMethod: wedding.offplatform_method || null,
                offplatformAmount:
                  wedding.offplatform_amount != null
                    ? Number(wedding.offplatform_amount)
                    : null,
                offplatformClaimedAt: wedding.offplatform_claimed_at || null,
                contractSnapshotChanged: snapshotChanged,
              });
              return;
            }

            // Off-platform promised / claimed.
            if (ofStatus === "promised" || ofStatus === "claimed") {
              setResume({
                state: "offplatform",
                weddingId,
                invoiceUrl: wedding.ghl_invoice_url || null,
                offplatformStatus: ofStatus,
                offplatformMethod: wedding.offplatform_method || null,
                offplatformAmount:
                  wedding.offplatform_amount != null
                    ? Number(wedding.offplatform_amount)
                    : null,
                offplatformClaimedAt: wedding.offplatform_claimed_at || null,
                contractSnapshotChanged: snapshotChanged,
              });
              return;
            }

            // GHL invoice exists.
            if (wedding.ghl_invoice_id || wedding.ghl_invoice_url) {
              setResume({
                state: "invoice",
                weddingId,
                invoiceUrl: wedding.ghl_invoice_url || null,
                offplatformStatus: null,
                offplatformMethod: null,
                offplatformAmount: null,
                offplatformClaimedAt: null,
                contractSnapshotChanged: snapshotChanged,
              });
              return;
            }

            // Signed but no invoice / no off-platform.
            const signed =
              wedding.contract_signed_at ||
              wedding.contract_status === "signed" ||
              proposal.contract_signed_at ||
              proposal.contract_status === "signed";
            if (signed) {
              setResume({
                state: snapshotChanged ? "signed_changed" : "signed",
                weddingId,
                invoiceUrl: null,
                offplatformStatus: null,
                offplatformMethod: null,
                offplatformAmount: null,
                offplatformClaimedAt: null,
                contractSnapshotChanged: snapshotChanged,
              });
              return;
            }
          }
        }

        // No wedding row yet — check proposal-level signed / off-platform.
        if (propOffStatus === "promised" || propOffStatus === "claimed") {
          setResume({
            state: "offplatform",
            weddingId,
            invoiceUrl: null,
            offplatformStatus: propOffStatus,
            offplatformMethod: proposal.offplatform_method || null,
            offplatformAmount:
              proposal.offplatform_amount != null
                ? Number(proposal.offplatform_amount)
                : null,
            offplatformClaimedAt: proposal.offplatform_claimed_at || null,
            contractSnapshotChanged: snapshotChanged,
          });
          return;
        }

        if (propOffStatus === "confirmed") {
          setResume({
            state: "confirmed",
            weddingId,
            invoiceUrl: null,
            offplatformStatus: propOffStatus,
            offplatformMethod: proposal.offplatform_method || null,
            offplatformAmount:
              proposal.offplatform_amount != null
                ? Number(proposal.offplatform_amount)
                : null,
            offplatformClaimedAt: proposal.offplatform_claimed_at || null,
            contractSnapshotChanged: snapshotChanged,
          });
          return;
        }

        const propSigned =
          proposal.contract_signed_at || proposal.contract_status === "signed";
        if (propSigned) {
          setResume({
            state: snapshotChanged ? "signed_changed" : "signed",
            weddingId,
            invoiceUrl: null,
            offplatformStatus: null,
            offplatformMethod: null,
            offplatformAmount: null,
            offplatformClaimedAt: null,
            contractSnapshotChanged: snapshotChanged,
          });
          return;
        }

        setResume(EMPTY);
      } catch (err) {
        console.error("useProposalResume error:", err);
        setResume(EMPTY);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [proposalId, proposal]);

  return resume;
}
