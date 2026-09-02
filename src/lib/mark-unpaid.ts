import { generatePaymentSchedule } from "@/lib/utils";

/**
 * Mark Unpaid helper — computes the correct new paid_amount for a wedding when
 * the user wants to flip a specific installment back to pending/overdue.
 *
 * generatePaymentSchedule uses a CUMULATIVE model: an installment is "paid"
 * only when paid_amount >= the running total up to that installment. So simply
 * subtracting one installment's amount from paid_amount only flips the LAST
 * paid installment — not the one the user clicked.
 *
 * Instead, we rebuild the full schedule, sum all installment amounts BEFORE the
 * target index, and set paid_amount to that sum. This correctly flips the
 * clicked installment (and everything after it) back to pending/overdue.
 */
export function computeMarkUnpaidAmount(
  wedding: any,
  currentPaidAmount: number,
  scheduleIndex?: number,
): { newPaidAmount: number; adjustmentAmount: number } {
  const total = Number(wedding.total_amount) || 0;
  const plan = wedding.payment_plan || "full";
  const customPlan = wedding.custom_payment_plan;
  const weddingDate = wedding.date || "";
  const createdAt = wedding.contract_date || wedding.created_at || "";

  const fullSchedule = generatePaymentSchedule(
    total,
    plan,
    weddingDate,
    createdAt,
    currentPaidAmount,
    customPlan,
  );

  let newPaidAmount = 0;
  const targetIdx = scheduleIndex ?? 0;
  for (let i = 0; i < targetIdx && i < fullSchedule.length; i++) {
    newPaidAmount += Number(fullSchedule[i]?.amount) || 0;
  }

  const adjustmentAmount = Math.max(0, currentPaidAmount - newPaidAmount);
  return { newPaidAmount, adjustmentAmount };
}
