import { useMemo } from "react";
import {
  checkCustomPlanBalance,
  planBalanceStatus,
  type CustomPlanLike,
  type PlanBalanceResult,
} from "./custom-plan-balance";

export interface CustomPlanGuard {
  balance: PlanBalanceResult | null;
  status: { label: string; tone: "balanced" | "short" | "over" } | null;
  blocked: boolean;
}

/**
 * Compute the custom-payment-plan balance guard for a proposal/wedding.
 *
 * Returns null fields when the custom plan is not enabled or not selected,
 * so callers can render a live "Scheduled $X of $TOTAL" indicator and block
 * Sign & Pay / save when the deposit + installments don't sum to the
 * contract total.
 */
export function useCustomPlanGuard(opts: {
  enabled: boolean;
  plan: CustomPlanLike | null | undefined;
  total: number;
}): CustomPlanGuard {
  const { enabled, plan, total } = opts;

  return useMemo(() => {
    if (!enabled || !plan) {
      return { balance: null, status: null, blocked: false };
    }
    const balance = checkCustomPlanBalance(plan, total);
    const status = planBalanceStatus(plan, total);
    return { balance, status, blocked: !balance.balanced };
  }, [enabled, plan, total]);
}
