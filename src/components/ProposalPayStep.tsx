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

  // Non-fresh resume (but not signed_changed — that falls through to the
  // normal pay step so the bride can re-sign): show the resume view.
  if (
    proposal &&
    resume.state !== "fresh" &&
    resume.state !== "signed_changed"
  ) {
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
        // Build installments from the proposal's custom_payment_plan (not the
        // stale wedding row) so a revised proposal's GHL invoice uses the new
        // schedule. Merge same-day rows, clamp dates >= today.
        const cpp = proposal?.custom_payment_plan;
        const installments: { date: string; amount: number }[] = [];
        if (cpp?.enabled && Array.isArray(cpp.installments)) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const byDay: Record<string, number> = {};
          const dayOrder: string[] = [];
          for (const inst of cpp.installments) {
            let due = inst.date || inst.dueDate || "";
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
            installments.push({
              date: d,
              amount: Math.round(byDay[d] * 100) / 100,
            });
          installments.sort((a, b) =>
            a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
          );
          const deposit = Number(cpp.deposit) || 0;
          if (deposit > 0 && installments.length > 0) {
            if (installments[0].date === todayStr)
              installments[0].amount += deposit;
            else installments.unshift({ date: todayStr, amount: deposit });
          }
        }
        const isRevised = !isUpgrade && installments.length > 1;
        const invoice = await createGhlInvoice({
          weddingId: deferred.weddingId,
          amount: deferred.firstDue,
          label: deferred.label,
          kind: isUpgrade ? "addon" : undefined,
          forceNew: isUpgrade ? true : isRevised ? true : undefined,
          // Only pass installments on the ADDON/upgrade path. The PHOTO path
          // rebuilds planRows from wedding.custom_payment_plan in the edge
          // function — passing them here would make it treat the rows as addon.
          installments:
            isUpgrade && installments.length > 1 ? installments : undefined,
        });
        return { invoiceUrl: invoice.invoiceUrl, firstDue: deferred.firstDue };
      }}
    />
  );
}
