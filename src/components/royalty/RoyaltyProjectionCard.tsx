import { Clock, Receipt } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export interface UpcomingSale {
  id: string;
  is_refund: boolean;
  description: string | null;
  sale_date: string;
  sale_amount: number | string;
}

/** Upcoming / Projected Royalty Breakdown card. */
export function RoyaltyProjectionCard({
  upcomingSales,
  upcomingGross,
  royaltyPct,
  paybackPct,
  projectedRoyalty,
  projectedPayback,
  rawPayback,
  remainingBalance,
  projectedTotal,
}: {
  upcomingSales: UpcomingSale[];
  upcomingGross: number;
  royaltyPct: number;
  paybackPct: number;
  projectedRoyalty: number;
  projectedPayback: number;
  rawPayback: number;
  remainingBalance: number;
  projectedTotal: number;
}) {
  return (
    <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" /> Upcoming Royalty
          Projection
        </CardTitle>
        <CardDescription className="text-xs">
          Kept sales in the last 7 days that the next processor run will
          calculate and charge. Refunds and test sales are excluded.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/30 rounded-xl p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Gross Sales (7d)
            </p>
            <p className="text-xl font-bold">
              ${upcomingGross.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {upcomingSales.length} sale{upcomingSales.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="bg-blue-500/5 rounded-xl p-3">
            <p className="text-xs text-blue-600 uppercase tracking-wider">
              Royalty ({royaltyPct.toFixed(2)}%)
            </p>
            <p className="text-xl font-bold text-blue-600">
              ${projectedRoyalty.toLocaleString()}
            </p>
          </div>
          <div className="bg-amber-500/5 rounded-xl p-3">
            <p className="text-xs text-amber-600 uppercase tracking-wider">
              Payback ({paybackPct.toFixed(2)}%)
            </p>
            <p className="text-xl font-bold text-amber-600">
              ${projectedPayback.toLocaleString()}
            </p>
            {rawPayback > remainingBalance && remainingBalance > 0 && (
              <p className="text-xs text-amber-600">
                Capped at remaining balance
              </p>
            )}
          </div>
          <div className="bg-emerald-500/5 rounded-xl p-3">
            <p className="text-xs text-emerald-600 uppercase tracking-wider">
              Projected Total
            </p>
            <p className="text-xl font-bold text-emerald-600">
              ${projectedTotal.toLocaleString()}
            </p>
          </div>
        </div>

        {upcomingSales.length > 0 ? (
          <div className="border-t border-border/40 pt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Sales in this window:
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {upcomingSales.map((s) => (
                <div
                  key={s.id}
                  className="flex justify-between items-center text-sm py-1.5 px-2 rounded-lg hover:bg-muted/30"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {s.is_refund ? "Refund" : "Sale"} —{" "}
                      {s.description || "No description"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.sale_date}
                    </span>
                  </div>
                  <span
                    className={`font-semibold ${s.is_refund ? "text-red-600" : "text-emerald-600"}`}
                  >
                    {s.is_refund ? "-" : "+"}$
                    {Number(s.sale_amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Receipt className="h-8 w-8 opacity-40 mb-2" />
            <p className="text-sm">
              No sales recorded in the last 7 days. Use "Seed Test Sale" to add
              one.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
