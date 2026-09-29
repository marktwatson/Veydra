import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import CustomPlanBalanceIndicator from "@/components/CustomPlanBalanceIndicator";

export interface CustomPlan {
  enabled: boolean;
  deposit: number;
  installments: { date: string; amount: number }[];
}

interface Props {
  plan: CustomPlan;
  setPlan: (p: CustomPlan) => void;
  total: number;
}

export function CustomPaymentPlanCard({ plan, setPlan, total }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Payment Plan</CardTitle>
        <CardDescription>
          Offer a specialized payment schedule in addition to the standard
          options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="pub-enable-custom-plan"
            checked={plan.enabled}
            onCheckedChange={(c) => setPlan({ ...plan, enabled: !!c })}
          />
          <Label htmlFor="pub-enable-custom-plan">
            Enable Custom Payment Plan
          </Label>
        </div>
        {plan.enabled && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/10">
            <div className="space-y-2">
              <Label>Deposit Amount ($)</Label>
              <Input
                type="number"
                value={plan.deposit || ""}
                onChange={(e) =>
                  setPlan({ ...plan, deposit: parseFloat(e.target.value) || 0 })
                }
                placeholder="e.g. 500"
              />
            </div>
            <div className="space-y-4">
              <Label>Future Installments</Label>
              {plan.installments.map((inst, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <Input
                      type="date"
                      value={inst.date}
                      onChange={(e) => {
                        const ni = [...plan.installments];
                        ni[idx].date = e.target.value;
                        setPlan({ ...plan, installments: ni });
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input
                      type="number"
                      value={inst.amount || ""}
                      onChange={(e) => {
                        const ni = [...plan.installments];
                        ni[idx].amount = parseFloat(e.target.value) || 0;
                        setPlan({ ...plan, installments: ni });
                      }}
                      placeholder="Amount ($)"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      const ni = plan.installments.filter((_, i) => i !== idx);
                      setPlan({ ...plan, installments: ni });
                    }}
                  >
                    &times;
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setPlan({
                    ...plan,
                    installments: [
                      ...plan.installments,
                      { date: "", amount: 0 },
                    ],
                  })
                }
              >
                Add Installment
              </Button>
            </div>
            <div className="pt-4 border-t space-y-3">
              <CustomPlanBalanceIndicator plan={plan} total={total} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
