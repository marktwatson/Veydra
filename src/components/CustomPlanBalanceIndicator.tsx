import {
  checkCustomPlanBalance,
  type CustomPlanLike,
} from "@/lib/custom-plan-balance";

/**
 * Live "Scheduled $X of $TOTAL" indicator for a custom payment plan.
 *
 * Shows a green line when the deposit + installments sum to the contract
 * total, a red "Schedule the remaining $Y before continuing" line when
 * under, and an orange "Installments exceed the contract by $Z" line when
 * over. Used on the bride-facing proposal review so an under-scheduled plan
 * is visible before Sign & Pay.
 */
export function CustomPlanBalanceIndicator({
  plan,
  total,
}: {
  plan: CustomPlanLike | null | undefined;
  total: number;
}) {
  if (!plan) return null;
  const bal = checkCustomPlanBalance(plan, total);
  if (bal.balanced) {
    return (
      <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">
        Scheduled $
        {bal.planned.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}{" "}
        of ${bal.total.toLocaleString()}
      </p>
    );
  }
  return (
    <p
      className={`text-xs mb-3 ${bal.short > 0 ? "text-destructive" : "text-orange-600 dark:text-orange-400"}`}
    >
      {bal.short > 0
        ? `Schedule the remaining $${bal.short.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} before continuing`
        : `Installments exceed the contract by $${bal.over.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
    </p>
  );
}

export default CustomPlanBalanceIndicator;
