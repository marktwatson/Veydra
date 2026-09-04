import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  Loader2,
  DollarSign,
} from "lucide-react";

// Shared status badge used by the summary card and the history table.
export function OwnerRoyaltyStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 rounded-full">
          <Clock className="h-3 w-3 mr-1" />
          Processing
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 rounded-full">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "waived":
      return (
        <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 rounded-full">
          <AlertCircle className="h-3 w-3 mr-1" />
          Waived
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="rounded-full">
          {status}
        </Badge>
      );
  }
}

interface OwnerRoyaltyBodyProps {
  territory: any;
  periods: any[];
  sales: any[];
  upcomingGross: number;
  upcomingSales: any[];
  royaltyPct: number;
  paybackPct: number;
  projectedRoyalty: number;
  rawPayback: number;
  projectedPayback: number;
  projectedTotal: number;
  remainingBalance: number;
  onConnectBank: () => void;
  connectPending: boolean;
}

export function OwnerRoyaltyBody({
  territory,
  periods,
  sales,
  upcomingGross,
  upcomingSales,
  royaltyPct,
  paybackPct,
  projectedRoyalty,
  rawPayback,
  projectedPayback,
  projectedTotal,
  remainingBalance,
  onConnectBank,
  connectPending,
}: OwnerRoyaltyBodyProps) {
  return (
    <>
      {/* Upcoming / Projected Royalty Breakdown (owner view) */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" /> Upcoming Royalty
            Projection
          </CardTitle>
          <CardDescription className="text-xs">
            Sales recorded in the last 7 days that the next weekly run will
            calculate and charge.
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
                {upcomingSales.length} sale
                {upcomingSales.length === 1 ? "" : "s"}
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
              <DollarSign className="h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm">
                No sales recorded in the last 7 days yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Payment Method
          </CardTitle>
          <CardDescription className="text-xs">
            Bank account (ACH) is preferred for automatic weekly collection.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-3">
          {territory.stripe_customer_id ? (
            <>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Stripe Connected
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Customer ID: {territory.stripe_customer_id.substring(0, 12)}
                  ...
                </span>
              </div>
              {territory.primary_payment_method_id ||
              territory.stripe_payment_method_id ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500" /> Payment
                  method on file — automatic weekly collection is active.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertCircle className="h-4 w-4" /> No payment method on file
                  yet. Connect a bank account to enable automatic collection.
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={onConnectBank}
                disabled={connectPending}
              >
                {connectPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : territory.primary_payment_method_id ||
                  territory.stripe_payment_method_id ? (
                  <RotateCcw className="h-4 w-4 mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {territory.primary_payment_method_id ||
                territory.stripe_payment_method_id
                  ? "Update Payment Method"
                  : "Connect Bank Account"}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" /> No payment method on file.
              </div>
              <Button
                size="sm"
                className="rounded-full"
                onClick={onConnectBank}
                disabled={connectPending}
              >
                {connectPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Connect Bank Account
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Period History Table */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/40">
          <CardTitle className="text-lg font-bold">Payment History</CardTitle>
          <CardDescription className="text-xs">
            Every weekly period: gross sales, royalty, payback, and status.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {periods.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <DollarSign className="h-10 w-10 opacity-40 mb-2" />
              <p>
                No royalty periods calculated yet. The first weekly run will
                appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold">Period</TableHead>
                    <TableHead className="font-semibold text-right">
                      Gross Sales
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Royalty
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Payback
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Total
                    </TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((p: any) => (
                    <TableRow key={p.id} className="hover:bg-muted/20">
                      <TableCell className="text-xs font-medium">
                        {p.period_start} → {p.period_end}
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(p.gross_sales || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        ${Number(p.royalty_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        ${Number(p.payback_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${Number(p.total_due || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <OwnerRoyaltyStatusBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contributing Sales */}
      {sales.length > 0 && (
        <Card className="shadow-sm border-border/40 rounded-2xl bg-card overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-border/40">
            <CardTitle className="text-lg font-bold">
              Sales Contributing to Royalty
            </CardTitle>
            <CardDescription className="text-xs">
              Bookings and revenue attributed to your territory.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold text-right">
                      Amount
                    </TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.slice(0, 20).map((s: any) => (
                    <TableRow key={s.id} className="hover:bg-muted/20">
                      <TableCell className="text-xs">{s.sale_date}</TableCell>
                      <TableCell className="text-sm">
                        {s.description || "Booking"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${s.is_refund ? "text-red-600" : ""}`}
                      >
                        ${Number(s.sale_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {s.is_refund ? (
                          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 rounded-full text-xs">
                            Refund
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full text-xs">
                            Sale
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
