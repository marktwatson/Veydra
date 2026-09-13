import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PayStepChoice } from "@/components/PayStepChoice";
import type { DeferredInvoice } from "@/lib/use-deferred-invoice";
import { createGhlInvoice } from "@/lib/ghl-invoice-api";
import { useProposalResume } from "@/lib/use-proposal-resume";
import { ProposalResumeView } from "@/components/ProposalResumeView";
import { supabase } from "@/lib/supabase";

/**
 * ProposalReview step-4 payment choice.
 *
 * On mount, checks the proposal resume state. If the proposal has already
 * progressed (signed / invoice / offplatform / confirmed), renders the
 * ProposalResumeView instead of the normal pay step — so a returning bride
 * resumes where she left off instead of restarting.
 *
 * Fresh path: uses the deferred invoice params (weddingId, firstDue, label)
 * from signAndPayProposal({ signOnly: true }). Card/bank creates the invoice;
 * off-platform opens the blocking modal. No GHL invoice on off-platform.
 *
 * If `proposal` is not passed by the parent, it is fetched from the URL
 * param + Supabase so the resume check still works.
 */
export function ProposalPayStep({
  deferred,
  invoiceUrl,
  onInvoiceUrl,
  remaining,
  clientName,
  weddingDate,
  isUpgrade,
  proposal: proposalProp,
}: {
  deferred: DeferredInvoice | null;
  invoiceUrl: string;
  onInvoiceUrl: (url: string) => void;
  remaining: number;
  clientName: string;
  weddingDate?: string;
  isUpgrade?: boolean;
  proposal?: any;
}) {
  const { id } = useParams();
  const [fetchedProposal, setFetchedProposal] = useState<any | null>(
    proposalProp || null,
  );

  // Self-resolve the proposal from the URL if the parent didn't pass it.
  useEffect(() => {
    if (proposalProp) {
      setFetchedProposal(proposalProp);
      return;
    }
    if (!id) return;
    let cancelled = false;
    supabase
      .from("proposals")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setFetchedProposal(data);
      });
    return () => {
      cancelled = true;
    };
  }, [id, proposalProp]);

  const proposal = proposalProp || fetchedProposal;

  // Resume check — only when we have a proposal object to inspect.
  const resume = useProposalResume(proposal?.id, proposal);

  // Non-fresh resume: show the resume view (signed / invoice / offplatform /
  // confirmed). The nonce forces re-eval after "change payment method".
  if (proposal && resume.state !== "fresh") {
    return (
      <ProposalResumeView
        resume={resume}
        proposal={proposal}
        remaining={remaining}
        clientName={clientName}
        weddingDate={weddingDate}
        isUpgrade={isUpgrade}
      />
    );
  }

  // Fresh path — normal pay step.
  if (!deferred) return null;

  return (
    <PayStepChoice
      weddingId={deferred.weddingId}
      remaining={remaining}
      clientName={clientName}
      weddingDate={weddingDate}
      invoiceUrl={invoiceUrl}
      onInvoiceUrl={onInvoiceUrl}
      onCreateInvoice={async () => {
        if (deferred.firstDue <= 0) return { invoiceUrl: "", firstDue: 0 };
        const invoice = await createGhlInvoice({
          weddingId: deferred.weddingId,
          amount: deferred.firstDue,
          label: deferred.label,
          kind: isUpgrade ? "addon" : undefined,
          forceNew: isUpgrade ? true : undefined,
        });
        return { invoiceUrl: invoice.invoiceUrl, firstDue: deferred.firstDue };
      }}
    />
  );
}
