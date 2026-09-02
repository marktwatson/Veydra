import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Metrics {
  totalScheduled: number;
  totalPaid: number;
  totalOverdue: number;
  totalPending: number;
  totalRefunded: number;
  overdueCount: number;
  pendingCount: number;
  paidCount: number;
}

interface Props {
  metrics: Metrics;
  totalInstallments: number;
}

export function PaymentAuditStats({ metrics, totalInstallments }: Props) {
  // Net collected = paid minus refunds (refunds are real money returned).
  const netCollected = Math.max(0, metrics.totalPaid - metrics.totalRefunded);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total Contract Volume
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
            ${metrics.totalScheduled.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalInstallments} total installments
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/40 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/20">
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Net Collected
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            ${netCollected.toLocaleString()}
          </div>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
            {metrics.paidCount} paid · ${metrics.totalRefunded.toLocaleString()}{" "}
            refunded
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/40 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/20">
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Overdue Payments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            ${metrics.totalOverdue.toLocaleString()}
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
            {metrics.overdueCount} require attention
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/40 rounded-2xl bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/20">
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Upcoming Scheduled
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            ${metrics.totalPending.toLocaleString()}
          </div>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
            {metrics.pendingCount} pending future dates
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
