import { createGhlInvoice } from "./ghl-invoice-api";
import {
  calculateFirstDue,
  bookingInvoiceLabel,
} from "./booking-payment-amount";
import { supabase } from "./supabase";

export interface DeferredInvoiceParams {
  weddingId: string;
  paymentOption: string;
  totalPrice: number;
  discountedPrice: number;
  halfDepositPrice: number;
  clientName: string;
}

/**
 * Compute the first amount due (capped at remaining) WITHOUT creating an
 * invoice. Returns { firstDue, label } or null if nothing is due.
 */
export async function computeFirstDue(
  p: DeferredInvoiceParams,
): Promise<{ firstDue: number; label: string } | null> {
  let paidSoFar = 0;
  try {
    const { data: w } = await supabase
      .from("weddings")
      .select("paid_amount")
      .eq("id", p.weddingId)
      .maybeSingle();
    paidSoFar = Number(w?.paid_amount || 0);
  } catch {}

  const firstDue = calculateFirstDue(
    {
      paymentOption: p.paymentOption,
      totalPrice: p.totalPrice,
      discountedPrice: p.discountedPrice,
      halfDepositPrice: p.halfDepositPrice,
    },
    paidSoFar,
  );

  if (firstDue <= 0) return null;

  const label = bookingInvoiceLabel(p.paymentOption, p.clientName);
  return { firstDue, label };
}

/**
 * Create the GHL invoice for the first amount due (Card/bank path).
 * Called only when the bride picks Card/bank on the pay step.
 */
export async function createFirstDueInvoice(
  p: DeferredInvoiceParams,
): Promise<{ invoiceUrl: string; firstDue: number }> {
  const computed = await computeFirstDue(p);
  if (!computed) return { invoiceUrl: "", firstDue: 0 };

  const invoice = await createGhlInvoice({
    weddingId: p.weddingId,
    amount: computed.firstDue,
    label: computed.label,
  });
  return { invoiceUrl: invoice.invoiceUrl, firstDue: computed.firstDue };
}
