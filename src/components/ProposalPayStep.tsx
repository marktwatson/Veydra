import { PayStepChoice } from "@/components/PayStepChoice";
import type { DeferredInvoice } from "@/lib/use-deferred-invoice";
import { createGhlInvoice } from "@/lib/ghl-invoice-api";

/**
 * ProposalReview step-4 payment choice.
 *
 * Uses the deferred invoice params (weddingId, firstDue, label) from
 * signAndPayProposal({ signOnly: true }). Card/bank creates the invoice;
 * off-platform opens the blocking modal. No GHL invoice on off-platform.
 */
export function ProposalPayStep({
  deferred,
  invoiceUrl,
  onInvoiceUrl,
  remaining,
  clientName,
  weddingDate,
  isUpgrade,
}: {
  deferred: DeferredInvoice | null;
  invoiceUrl: string;
  onInvoiceUrl: (url: string) => void;
  remaining: number;
  clientName: string;
  weddingDate?: string;
  isUpgrade?: boolean;
}) {
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
