import { ChangePendingBadge } from "@/components/ChangePendingBadge";
import { type AuditItem } from "@/components/PaymentAuditModals";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Mail,
  Calendar,
  RotateCcw,
  Ban,
} from "lucide-react";

interface Props {
  isLoading: boolean;
  filteredItems: any[];
  totalItems: number;
  onAutoCharge: (item: AuditItem) => void;
  onManualInvoice: (item: AuditItem) => void;
  onCancelPayment: (item: AuditItem) => void;
  onResendReceipt: (item: AuditItem) => void;
  onMarkUnpaid: (item: AuditItem) => void;
}

export function PaymentAuditTable({
  isLoading,
  filteredItems,
  totalItems,
  onAutoCharge,
  onManualInvoice,
  onCancelPayment,
  onResendReceipt,
  onMarkUnpaid,
}: Props) {
  return (
    <Card className="shadow-sm border-border/40 rounded-2xl overflow-hidden bg-card">
      <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold">
            Scheduled & Historical Payments
          </CardTitle>
          <CardDescription className="text-xs">
            Showing {filteredItems.length} of {totalItems} payment installment
            items
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading payment schedule audit...
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-2">
            <CreditCard className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold text-foreground">
              No matching payments found
            </p>
            <p className="text-xs">
              Try clearing your search query or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-semibold">
                    Client / Wedding
                  </TableHead>
                  <TableHead className="font-semibold">Installment</TableHead>
                  <TableHead className="font-semibold">Plan Type</TableHead>
                  <TableHead className="font-semibold">Due Date</TableHead>
                  <TableHead className="font-semibold text-right">
                    Amount
                  </TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right pr-6">
                    Payment Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item: any) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    {/* Client info */}
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                          {item.clientName}
                        </span>
                        <ChangePendingBadge weddingId={item.weddingId} />
                        <span className="text-xs text-muted-foreground">
                          {item.clientEmail || "No email on file"} • Paid: $
                          {item.paidAmount.toLocaleString()} / Total: $
                          {item.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </TableCell>

                    {/* Installment label */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="rounded-full text-xs font-normal border-border/60"
                      >
                        {item.installmentLabel}
                      </Badge>
                    </TableCell>

                    {/* Payment plan */}
                    <TableCell>
                      <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                        {item.hasCustomPlan ? (
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px]"
                          >
                            Custom Plan
                          </Badge>
                        ) : (
                          item.paymentPlan
                        )}
                      </span>
                    </TableCell>

                    {/* Due Date */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{item.installmentDate}</span>
                      </div>
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="text-right font-bold text-sm">
                      $
                      {item.installmentAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>

                    {/* Status badge */}
                    <TableCell>
                      {item.status === "paid" ? (
                        <Badge
                          variant="outline"
                          className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                        </Badge>
                      ) : item.status === "overdue" ? (
                        <Badge
                          variant="outline"
                          className="rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-bold animate-pulse"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" /> Overdue
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-medium"
                        >
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </TableCell>

                    {/* Action buttons */}
                    <TableCell className="text-right pr-6">
                      {item.status === "paid" ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full text-xs shadow-sm gap-1"
                            onClick={() => onResendReceipt(item)}
                          >
                            <Mail className="h-3.5 w-3.5 text-primary" />
                            Resend Receipt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full text-xs shadow-sm text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1 font-medium"
                            onClick={() => onMarkUnpaid(item)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Mark Unpaid
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {/* Auto-charge saved card button */}
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 rounded-full text-xs shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            onClick={() => onAutoCharge(item)}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Auto-Charge Card
                          </Button>

                          {/* Send manual payment invoice button */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full text-xs shadow-sm gap-1"
                            onClick={() => onManualInvoice(item)}
                          >
                            <Send className="h-3.5 w-3.5 text-primary" />
                            Send Invoice Link
                          </Button>

                          {/* Cancel payment button */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full text-xs shadow-sm text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10 gap-1 font-medium"
                            onClick={() => onCancelPayment(item)}
                            title="Permanently remove this scheduled payment"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Cancel Payment
                          </Button>
                        </div>
                      )}
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
