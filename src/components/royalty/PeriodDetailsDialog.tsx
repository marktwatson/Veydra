import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";

// ─── Period Details Dialog — full breakdown of a single royalty period ───
export function PeriodDetailsDialog({
  period,
  territoryId,
  onClose,
}: {
  period: any;
  territoryId?: string;
  onClose: () => void;
}) {
  const { data: allSales = [] } = useQuery({
    queryKey: ["royalty-sales", territoryId],
    queryFn: () => api.getRoyaltySales(territoryId!),
    enabled: !!territoryId,
  });

  if (!period) return null;

  const grossSales = Number(period.gross_sales || 0);
  const royaltyAmount = Number(period.royalty_amount || 0);
  const paybackAmount = Number(period.payback_amount || 0);
  const totalDue = Number(period.total_due || 0);
  const royaltyPct = grossSales > 0 ? (royaltyAmount / grossSales) * 100 : 0;
  const paybackPct = grossSales > 0 ? (paybackAmount / grossSales) * 100 : 0;

  // Sales locked to THIS period (processed_period_id match)
  const periodSales = (allSales as any[]).filter(
    (s) => s.processed_period_id === period.id,
  );

  const breakdownRows = [
    {
      label: "Gross Sales",
      sub:
        periodSales.length > 0
          ? `${periodSales.length} sale${periodSales.length === 1 ? "" : "s"} in period`
          : "No individual sales locked",
      value: grossSales,
      color: "text-foreground",
    },
    {
      label: "Royalty",
      sub: `${royaltyPct.toFixed(2)}% of gross`,
      value: royaltyAmount,
      color: "text-blue-600",
    },
    {
      label: "Payback",
      sub: `${paybackPct.toFixed(2)}% of gross`,
      value: paybackAmount,
      color: "text-amber-600",
    },
    {
      label: "Total Charged",
      sub: "Collected via Stripe",
      value: totalDue,
      color: "text-emerald-600",
      bold: true,
    },
  ];

  return (
    <Dialog open={!!period} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] rounded-3xl flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Royalty Period Breakdown
          </DialogTitle>
          <DialogDescription>
            {period.period_start} → {period.period_end}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Status + metadata */}
          <div className="flex items-center justify-between gap-3 bg-muted/30 rounded-xl p-3">
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Status</p>
              <p className="font-semibold capitalize">{period.status}</p>
            </div>
            {period.paid_at && (
              <div className="text-sm text-right">
                <p className="text-muted-foreground text-xs">Paid</p>
                <p className="font-semibold text-sm">
                  {new Date(period.paid_at).toLocaleDateString()}
                </p>
              </div>
            )}
            {period.stripe_payment_intent_id && (
              <div className="text-sm text-right max-w-[140px]">
                <p className="text-muted-foreground text-xs">Stripe PI</p>
                <p className="font-mono text-xs truncate">
                  {period.stripe_payment_intent_id}
                </p>
              </div>
            )}
          </div>

          {/* Charge breakdown */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Charge Breakdown
            </p>
            {breakdownRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0"
              >
                <div>
                  <p
                    className={`text-sm ${row.bold ? "font-bold" : "font-medium"}`}
                  >
                    {row.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.sub}</p>
                </div>
                <p
                  className={`text-base ${row.bold ? "font-bold" : "font-semibold"} ${row.color}`}
                >
                  $
                  {row.value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))}
          </div>

          {/* Contributing sales */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sales in This Period ({periodSales.length})
            </p>
            {periodSales.length > 0 ? (
              <div className="border border-border/40 rounded-xl divide-y divide-border/30 max-h-52 overflow-y-auto">
                {periodSales.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">
                        {s.is_refund ? "Refund" : "Sale"} —{" "}
                        {s.description || "No description"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.sale_date}
                      </span>
                    </div>
                    <span
                      className={`font-semibold shrink-0 ml-2 ${s.is_refund ? "text-red-600" : "text-emerald-600"}`}
                    >
                      {s.is_refund ? "-" : "+"}$
                      {Number(s.sale_amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted/20 rounded-xl p-4 text-center">
                No individual sales were locked to this period. It may have been
                created manually or before sales tracking was enabled.
              </div>
            )}
          </div>

          {period.notes && (
            <div className="bg-muted/30 rounded-xl p-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Notes
              </p>
              <p>{period.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 shrink-0">
          <Button variant="outline" className="rounded-full" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
