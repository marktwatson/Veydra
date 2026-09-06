/**
 * Booking payment-amount helpers.
 *
 * Mirrors ProposalReview.calculatePaymentAmount so the direct booking flow
 * and the proposal review flow invoice the same first-due amount.
 */

export interface BookingPaymentInput {
  paymentOption: string;
  totalPrice: number;
  discountedPrice: number;
  halfDepositPrice: number;
}

/**
 * Base first-due amount for a given payment option (before capping at the
 * remaining balance).
 */
export function calculateBookingPaymentAmount({
  paymentOption,
  totalPrice,
  discountedPrice,
  halfDepositPrice,
}: BookingPaymentInput): number {
  if (paymentOption === "full") return discountedPrice;
  if (paymentOption === "half") return halfDepositPrice;
  if (paymentOption === "quarterly") return totalPrice / 4;
  return 99; // standard deposit
}

/**
 * First amount due, capped at the remaining balance so a re-submit never
 * over-invoices. Returns 0 when there is nothing left to collect.
 */
export function calculateFirstDue(
  input: BookingPaymentInput,
  paidSoFar: number,
): number {
  const base = calculateBookingPaymentAmount(input);
  const remaining = Math.max(0, input.totalPrice - (Number(paidSoFar) || 0));
  return Math.max(0, Math.min(base, remaining));
}

/**
 * Human-readable invoice label for the first-due charge.
 */
export function bookingInvoiceLabel(
  paymentOption: string,
  clientName: string,
): string {
  const name = clientName.trim();
  switch (paymentOption) {
    case "full":
      return `Wedding Payment in Full for ${name}`;
    case "half":
      return `Wedding 50% Deposit for ${name}`;
    case "quarterly":
      return `Wedding Quarterly Deposit for ${name}`;
    default:
      return `Wedding Deposit for ${name}`;
  }
}
