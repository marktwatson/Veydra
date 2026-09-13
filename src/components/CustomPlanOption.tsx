import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { generatePaymentSchedule } from "@/lib/utils";
import { CustomPlanBalanceIndicator } from "@/components/CustomPlanBalanceIndicator";

/**
 * The "Custom Payment Plan" radio option shown on the proposal review page.
 * Extracted from ProposalReview to keep that page under the size limit.
 *
 * Renders the deposit, a live "Scheduled $X of $TOTAL" balance indicator,
 * and the upcoming installment schedule.
 */
export function CustomPlanOption({
  proposal,
  selected,
}: {
  proposal: any;
  selected: boolean;
}) {
  const plan = proposal.custom_payment_plan;
  return (
    <Label
      className={`flex flex-col border-2 rounded-sm p-6 cursor-pointer transition-all duration-300 ${
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border hover:border-primary/50"
      }`}
    >
      <div className="flex justify-between items-start w-full mb-4">
        <div className="flex items-center space-x-3 mt-1">
          <RadioGroupItem value="custom" id="custom" />
          <span className="text-xl font-serif font-semibold">
            Custom Payment Plan
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">
            Total Investment
          </span>
          <span className="text-2xl font-serif font-bold text-primary">
            ${proposal.total_amount.toLocaleString()}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground font-sans ml-7 leading-relaxed">
        Pay a custom deposit today to secure your date. The remaining balance is
        split into a customized schedule.
      </p>
      {selected && (
        <div className="mt-6 space-y-4 border-t border-stone-200 dark:border-stone-800 pt-5 ml-7">
          <div className="flex justify-between items-center bg-primary/10 p-3 rounded-sm border border-primary/20">
            <span className="font-semibold text-primary font-sans text-sm">
              Due Today (Deposit)
            </span>
            <span className="font-bold text-primary text-lg">
              ${(plan.deposit || 0).toLocaleString()}
            </span>
          </div>
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold text-stone-900 dark:text-stone-50 mb-3 uppercase tracking-wider">
              Upcoming Schedule
            </p>
            <CustomPlanBalanceIndicator
              plan={plan}
              total={proposal.total_amount}
            />
            {generatePaymentSchedule(
              proposal.total_amount,
              "custom",
              proposal.wedding_date,
              proposal.created_at,
              0,
              plan,
            ).map((payment: any, i: number) => (
              <div
                key={i}
                className="flex justify-between text-sm text-stone-600 dark:text-stone-400 border-b border-border/50 pb-2 last:border-0 last:pb-0"
              >
                <span>{payment.date}</span>
                <span className="font-medium">
                  $
                  {payment.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Label>
  );
}

export default CustomPlanOption;
