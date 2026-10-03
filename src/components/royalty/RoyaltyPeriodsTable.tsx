import { Loader2, Receipt, CheckCircle, XCircle } from "lucide-react";
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

function statusBadge(status: string) {
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
          <Loader2 className="h-3 w-3 mr-1" />
          Processing
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full">
          <Loader2 className="h-3 w-3 mr-1" />
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
          <XCircle className="h-3 w-3 mr-1" />
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

/** Payment History tab — the royalty periods ledger table. */
export function RoyaltyPeriodsTable({
  periods,
  loadingPeriods,
  onDetails,
  onMarkPaid,
  onWaive,
}: {
  periods: any[];
  loadingPeriods: boolean;
  onDetails: (p: any) => void;
  onMarkPaid: (p: any) => void;
  onWaive: (p: any) => void;
}) {
  return (
    <Card className="shadow-sm border-border/40 rounded-2xl bg-card overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40">
        <CardTitle className="text-lg font-bold">Royalty Periods</CardTitle>
        <CardDescription className="text-xs">
          Complete ledger of every weekly calculation for this territory.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loadingPeriods ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : periods.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Receipt className="h-10 w-10 opacity-40 mb-2" />
            <p>No royalty periods calculated yet.</p>
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
                    Total Due
                  </TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p: any) => (
                  <TableRow key={p.id} className="hover:bg-muted/20">
                    <TableCell className="text-xs">
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
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full text-xs"
                          onClick={() => onDetails(p)}
                        >
                          <Receipt className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>
                        {p.status !== "paid" && p.status !== "waived" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full text-xs text-emerald-600"
                              onClick={() => onMarkPaid(p)}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Mark Paid
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full text-xs text-purple-600"
                              onClick={() => onWaive(p)}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Waive
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
