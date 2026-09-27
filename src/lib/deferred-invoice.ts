import { createGhlInvoice } from "./ghl-invoice-api";
import {
  calculateFirstDue,
  bookingInvoiceLabel,
} from "./booking-payment-amount";
import { supabase } from "./supabase";
import { buildInstallments, buildWeddingCustomPlan } from "./booking-schedule";

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
 *
 * Before createGhlInvoice this builds the SAME schedule the bride saw on
 * screen (custom OR standard plan), writes it onto weddings.custom_payment_plan
 * so the PHOTO invoice path and the on-page display agree, and passes the same
 * installments array into createGhlInvoice.
 */
export async function createFirstDueInvoice(
  p: DeferredInvoiceParams,
): Promise<{ invoiceUrl: string; firstDue: number }> {
  const computed = await computeFirstDue(p);
  if (!computed) return { invoiceUrl: "", firstDue: 0 };

  // Load the wedding row to anchor the schedule (date, created_at) and to
  // respect any existing custom plan + already-paid amount.
  let weddingDate: string | undefined;
  let createdAt: string | undefined;
  let paidSoFar = 0;
  let existingCpp: any = null;
  try {
    const { data: w } = await supabase
      .from("weddings")
      .select(
        "date, created_at, paid_amount, custom_payment_plan, payment_plan",
      )
      .eq("id", p.weddingId)
      .maybeSingle();
    weddingDate = w?.date || undefined;
    createdAt = w?.created_at || undefined;
    paidSoFar = Number(w?.paid_amount || 0);
    existingCpp = w?.custom_payment_plan || null;
    // If the wedding already carries a custom payment plan, honor its plan
    // key so the builder uses the custom rows instead of standard rows.
    if (
      existingCpp &&
      (existingCpp as any).enabled &&
      Array.isArray((existingCpp as any).installments)
    ) {
      // keep p.paymentOption as-is only if it isn't already "custom"
    }
  } catch {}

  const scheduleInput = {
    paymentOption: p.paymentOption,
    totalPrice: p.totalPrice,
    paidSoFar,
    weddingDate,
    createdAt,
    customPlan: existingCpp,
  };

  // Build the installments array the bride saw (sum === total - paid).
  const installments = buildInstallments(scheduleInput);

  // Write the same schedule onto weddings.custom_payment_plan so the PHOTO
  // invoice path (which rebuilds rows from the wedding row) and the on-page
  // schedule agree. Only write when there's something to schedule and the
  // wedding doesn't already carry a balanced custom plan for a "custom" pick.
  const weddingPlan = buildWeddingCustomPlan(scheduleInput);
  if (weddingPlan) {
    try {
      await supabase
        .from("weddings")
        .update({ custom_payment_plan: weddingPlan as any })
        .eq("id", p.weddingId);
    } catch (e) {
      console.warn(
        "[deferred-invoice] could not write custom_payment_plan:",
        e,
      );
    }
  }

  const invoice = await createGhlInvoice({
    weddingId: p.weddingId,
    amount: computed.firstDue,
    label: computed.label,
    installments: installments.length > 0 ? installments : undefined,
  });
  return { invoiceUrl: invoice.invoiceUrl, firstDue: computed.firstDue };
}
