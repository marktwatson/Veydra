import { useState, useCallback } from "react";
import { createGhlInvoice } from "./ghl-invoice-api";

export interface DeferredInvoice {
  weddingId: string;
  firstDue: number;
  label: string;
}

/**
 * Manages the deferred-invoice state for the bride pay step.
 *
 * On Sign & Pay (signOnly), the caller stores { weddingId, firstDue, label }.
 * When the bride picks Card/bank, createInvoiceNow() creates the GHL invoice
 * and returns the URL. The off-platform path never calls this.
 */
export function useDeferredInvoice() {
  const [deferred, setDeferred] = useState<DeferredInvoice | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState("");

  const createInvoiceNow = useCallback(async (): Promise<{
    invoiceUrl: string;
    firstDue: number;
  }> => {
    if (!deferred) return { invoiceUrl: "", firstDue: 0 };
    if (deferred.firstDue <= 0) return { invoiceUrl: "", firstDue: 0 };
    const invoice = await createGhlInvoice({
      weddingId: deferred.weddingId,
      amount: deferred.firstDue,
      label: deferred.label,
    });
    setInvoiceUrl(invoice.invoiceUrl);
    return { invoiceUrl: invoice.invoiceUrl, firstDue: deferred.firstDue };
  }, [deferred]);

  return {
    deferred,
    setDeferred,
    invoiceUrl,
    setInvoiceUrl,
    createInvoiceNow,
  };
}
