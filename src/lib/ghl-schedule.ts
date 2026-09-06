/**
 * GHL invoice schedule builder helpers.
 *
 * Shared by supabase/functions/ghl-invoice (compiled into the function) and
 * the frontend so both sides compute the same unpaid-installment rows.
 */

export interface PlanRow {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface BuildScheduleResult {
  rows: PlanRow[];
  hasMultiPlan: boolean;
  remaining: number;
}

/** Format today (+offsetDays) as YYYY-MM-DD (local, not UTC). */
export function ymd(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Build the unpaid-installment list for a wedding's custom payment plan.
 *
 * - Deposit = firstDue today (capped to the remaining balance).
 * - Future installments skip those already covered by paid_amount.
 * - hasMultiPlan is true only when there are 2+ rows (deposit + installments).
 */
export function buildPlanRows(
  customPaymentPlan: any,
  totalAmount: number,
  paidSoFar: number,
  firstDueFallback: number,
): BuildScheduleResult {
  const remaining = Math.max(0, Number(totalAmount) - Number(paidSoFar));
  if (remaining <= 0) return { rows: [], hasMultiPlan: false, remaining: 0 };

  let cpp = customPaymentPlan || {};
  if (typeof cpp === "string") {
    try {
      cpp = JSON.parse(cpp);
    } catch (_e) {
      cpp = {};
    }
  }
  const cppEnabled =
    cpp.enabled === true || cpp.enabled === "true" || cpp.enabled === 1;
  const installments: any[] = Array.isArray(cpp.installments)
    ? cpp.installments
    : Array.isArray(cpp)
      ? cpp
      : [];

  if (!cppEnabled || installments.length === 0) {
    return { rows: [], hasMultiPlan: false, remaining };
  }

  const deposit = Math.min(Number(cpp.deposit) || firstDueFallback, remaining);
  const rows: PlanRow[] = [];
  if (deposit > 0) rows.push({ date: ymd(0), amount: deposit });

  let running = 0;
  let scheduled = deposit;
  for (const inst of installments) {
    const amt = Number(inst.amount || 0);
    running += amt;
    if (running <= Number(paidSoFar)) continue; // already covered
    const due = inst.date || inst.dueDate || "";
    if (!due) continue;
    const rowAmt = Math.min(amt, Math.max(0, remaining - scheduled));
    if (rowAmt <= 0) break;
    rows.push({ date: due, amount: rowAmt });
    scheduled += rowAmt;
  }

  return { rows, hasMultiPlan: rows.length >= 2, remaining };
}
