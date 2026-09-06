/**
 * Custom payment plan balance validation.
 *
 * A custom plan's deposit + installments must sum to the contract total
 * (proposal/wedding total_amount = package + addons + custom items - discounts)
 * before it can be saved or used for Sign & Pay.
 *
 * This mirrors the number Financials uses and prevents staff from saving a
 * plan that schedules less (or more) than the contract total.
 */

export interface CustomPlanLike {
  enabled?: boolean;
  deposit?: number;
  installments?: { amount?: number; date?: string }[];
}

export interface PlanBalanceResult {
  planned: number;
  total: number;
  remaining: number; // total - planned (positive = under, negative = over)
  balanced: boolean; // abs(remaining) <= 0.01
  short: number; // max(0, remaining) — how much still needs to be scheduled
  over: number; // max(0, -remaining) — how much the plan exceeds the total
}

/**
 * Sum the deposit + installment amounts for a custom plan.
 */
export function sumCustomPlan(plan: CustomPlanLike | null | undefined): number {
  if (!plan) return 0;
  const deposit = Number(plan.deposit) || 0;
  const installments = Array.isArray(plan.installments)
    ? plan.installments.reduce((s, i) => s + (Number(i?.amount) || 0), 0)
    : 0;
  return deposit + installments;
}

/**
 * Compute the balance of a custom plan against a contract total.
 */
export function checkCustomPlanBalance(
  plan: CustomPlanLike | null | undefined,
  total: number,
): PlanBalanceResult {
  const totalNum = Number(total) || 0;
  const planned = sumCustomPlan(plan);
  const remaining = totalNum - planned;
  const balanced = Math.abs(remaining) <= 0.01;
  return {
    planned,
    total: totalNum,
    remaining,
    balanced,
    short: Math.max(0, remaining),
    over: Math.max(0, -remaining),
  };
}

/**
 * Human-readable status line for the live "Scheduled $X of $TOTAL" indicator.
 */
export function planBalanceStatus(
  plan: CustomPlanLike | null | undefined,
  total: number,
): {
  label: string;
  tone: "balanced" | "short" | "over";
} {
  const r = checkCustomPlanBalance(plan, total);
  if (r.balanced) {
    return {
      label: `Scheduled $${r.planned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of $${r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      tone: "balanced",
    };
  }
  if (r.short > 0) {
    return {
      label: `Schedule the remaining $${r.short.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} before continuing`,
      tone: "short",
    };
  }
  return {
    label: `Installments exceed the contract by $${r.over.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    tone: "over",
  };
}
