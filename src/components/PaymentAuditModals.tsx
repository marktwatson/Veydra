import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Send,
  RotateCcw,
  Mail,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { CancelPaymentModal } from "@/components/CancelPaymentModal";

export interface AuditItem {
  id: string;
  weddingId: string;
  scheduleIndex?: number;
  clientName: string;
  clientEmail: string;
  installmentLabel: string;
  installmentAmount: number;
  installmentDate: string;
  paidAmount: number;
  totalAmount: number;
  stripeCustomerId?: string;
  weddingObj: any;
}

interface Props {
  autoChargeItem: AuditItem | null;
  onAutoChargeClose: () => void;
  onAutoChargeConfirm: (item: AuditItem) => void;
  autoChargePending: boolean;
  onReleaseAndRetry?: (item: AuditItem) => void;
  releaseAndRetryPending?: boolean;

  manualInvoiceItem: AuditItem | null;
  onManualInvoiceClose: () => void;
  onManualInvoiceConfirm: (item: AuditItem) => void;
  manualInvoicePending: boolean;

  markUnpaidItem: AuditItem | null;
  onMarkUnpaidClose: () => void;
  onMarkUnpaidConfirm: (item: AuditItem) => void;
  markUnpaidPending: boolean;

  resendReceiptItem: AuditItem | null;
  onResendReceiptClose: () => void;
  onResendReceiptConfirm: (item: AuditItem) => void;
  resendReceiptPending: boolean;

  cancelPaymentItem: AuditItem | null;
  onCancelPaymentClose: () => void;
  onCancelPaymentConfirm: (item: AuditItem) => void;
  cancelPaymentPending: boolean;
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-semibold ${accent || "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function money(n: number) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function PaymentAuditModals(props: Props) {
  const {
    autoChargeItem,
    onAutoChargeClose,
    onAutoChargeConfirm,
    autoChargePending,
    onReleaseAndRetry,
    releaseAndRetryPending,
    manualInvoiceItem,
    onManualInvoiceClose,
    onManualInvoiceConfirm,
    manualInvoicePending,
    markUnpaidItem,
    onMarkUnpaidClose,
    onMarkUnpaidConfirm,
    markUnpaidPending,
    resendReceiptItem,
    onResendReceiptClose,
    onResendReceiptConfirm,
    resendReceiptPending,
    cancelPaymentItem,
    onCancelPaymentClose,
    onCancelPaymentConfirm,
    cancelPaymentPending,
  } = props;

  return (
    <>
      {/* Modal: Auto-Charge Confirmation */}
      <Dialog
        open={!!autoChargeItem}
        onOpenChange={(open) => !open && onAutoChargeClose()}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <CreditCard className="h-5 w-5 text-emerald-600" /> Auto-Charge
              Saved Card
            </DialogTitle>
            <DialogDescription>
              This will charge the saved payment method on file via Stripe for{" "}
              <strong>{autoChargeItem?.clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {autoChargeItem && (
            <div className="py-4 space-y-4">
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
                <InfoRow label="Client" value={autoChargeItem.clientName} />
                <InfoRow
                  label="Email"
                  value={autoChargeItem.clientEmail || "Not provided"}
                />
                <InfoRow
                  label="Installment"
                  value={autoChargeItem.installmentLabel}
                />
                <div className="flex justify-between border-t border-border/40 pt-2 mt-2">
                  <span className="font-bold text-foreground">
                    Charge Amount:
                  </span>
                  <span className="font-extrabold text-emerald-600 text-base">
                    {money(autoChargeItem.installmentAmount)}
                  </span>
                </div>
              </div>

              {!autoChargeItem.stripeCustomerId ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 shrink-0" /> Stripe Customer
                    ID not directly linked
                  </div>
                  <p>
                    The system will attempt to locate their customer profile via
                    email ({autoChargeItem.clientEmail}) or their saved card
                    tokens on file.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>
                    Stripe Customer Token Active (
                    {autoChargeItem.stripeCustomerId})
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onAutoChargeClose}
              disabled={autoChargePending || releaseAndRetryPending}
            >
              Cancel
            </Button>
            {onReleaseAndRetry && (
              <Button
                variant="outline"
                className="rounded-full border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                onClick={() =>
                  autoChargeItem && onReleaseAndRetry(autoChargeItem)
                }
                disabled={autoChargePending || releaseAndRetryPending}
                title="Clear a stuck pending lock left by a failed attempt, then charge again."
              >
                {releaseAndRetryPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Release lock and retry
              </Button>
            )}
            <Button
              variant="default"
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() =>
                autoChargeItem && onAutoChargeConfirm(autoChargeItem)
              }
              disabled={autoChargePending || releaseAndRetryPending}
            >
              {autoChargePending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Confirm Auto-Charge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Send Manual Payment Invoice */}
      <Dialog
        open={!!manualInvoiceItem}
        onOpenChange={(open) => !open && onManualInvoiceClose()}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Send className="h-5 w-5 text-primary" /> Send Manual Invoice
            </DialogTitle>
            <DialogDescription>
              This will send a direct payment link and formal invoice via email
              & SMS to <strong>{manualInvoiceItem?.clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {manualInvoiceItem && (
            <div className="py-4 space-y-4">
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
                <InfoRow
                  label="Recipient Email"
                  value={manualInvoiceItem.clientEmail || "No email on file"}
                />
                <InfoRow
                  label="Installment Label"
                  value={manualInvoiceItem.installmentLabel}
                />
                <div className="flex justify-between border-t border-border/40 pt-2 mt-2">
                  <span className="font-bold text-foreground">
                    Invoice Amount:
                  </span>
                  <span className="font-extrabold text-primary text-base">
                    {money(manualInvoiceItem.installmentAmount)}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-primary" /> Formal Payment
                  Link Included
                </div>
                <p>
                  The client will receive an interactive link to their Bride
                  Portal where they can complete this payment using any
                  credit/debit card.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onManualInvoiceClose}
              disabled={manualInvoicePending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="rounded-full"
              onClick={() =>
                manualInvoiceItem && onManualInvoiceConfirm(manualInvoiceItem)
              }
              disabled={manualInvoicePending || !manualInvoiceItem?.clientEmail}
            >
              {manualInvoicePending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Invoice Link Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Mark Unpaid Confirmation */}
      <Dialog
        open={!!markUnpaidItem}
        onOpenChange={(open) => !open && onMarkUnpaidClose()}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-600 dark:text-amber-500">
              <RotateCcw className="h-5 w-5" /> Mark Payment Unpaid
            </DialogTitle>
            <DialogDescription>
              This will update <strong>{markUnpaidItem?.clientName}</strong>'s
              wedding ledger and subtract this installment amount from their
              paid balance.
            </DialogDescription>
          </DialogHeader>

          {markUnpaidItem && (
            <div className="py-4 space-y-4">
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
                <InfoRow label="Client" value={markUnpaidItem.clientName} />
                <InfoRow
                  label="Installment"
                  value={markUnpaidItem.installmentLabel}
                />
                <InfoRow
                  label="Current Total Paid"
                  value={`$${markUnpaidItem.paidAmount.toLocaleString()}`}
                  accent="text-emerald-600"
                />
                <InfoRow
                  label="Deducting Amount"
                  value={`-${markUnpaidItem.installmentAmount.toLocaleString()}`}
                  accent="text-red-600"
                />
                <div className="flex justify-between border-t border-border/40 pt-2 mt-2 font-bold">
                  <span>New Total Paid Balance:</span>
                  <span className="text-foreground">
                    $
                    {Math.max(
                      0,
                      markUnpaidItem.paidAmount -
                        markUnpaidItem.installmentAmount,
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  This resets this installment's status back to pending/overdue
                  on your Payment Audit hub and Bride Portal, enabling you to
                  re-invoice or auto-charge if needed.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onMarkUnpaidClose}
              disabled={markUnpaidPending}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() =>
                markUnpaidItem && onMarkUnpaidConfirm(markUnpaidItem)
              }
              disabled={markUnpaidPending}
            >
              {markUnpaidPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Confirm & Mark Unpaid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Resend Receipt Confirmation */}
      <Dialog
        open={!!resendReceiptItem}
        onOpenChange={(open) => !open && onResendReceiptClose()}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Mail className="h-5 w-5 text-primary" /> Resend Payment Receipt
            </DialogTitle>
            <DialogDescription>
              This will send a copy of the formal HTML payment receipt to{" "}
              <strong>{resendReceiptItem?.clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {resendReceiptItem && (
            <div className="py-4 space-y-4">
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
                <InfoRow
                  label="Recipient Email"
                  value={resendReceiptItem.clientEmail || "No email on file"}
                />
                <InfoRow
                  label="Payment Item"
                  value={resendReceiptItem.installmentLabel}
                />
                <div className="flex justify-between border-t border-border/40 pt-2 mt-2">
                  <span className="font-bold text-foreground">
                    Receipt Amount:
                  </span>
                  <span className="font-extrabold text-emerald-600 text-base">
                    {money(resendReceiptItem.installmentAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onResendReceiptClose}
              disabled={resendReceiptPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="rounded-full"
              onClick={() =>
                resendReceiptItem && onResendReceiptConfirm(resendReceiptItem)
              }
              disabled={resendReceiptPending || !resendReceiptItem?.clientEmail}
            >
              {resendReceiptPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Receipt Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Cancel Payment (irreversible) */}
      <CancelPaymentModal
        cancelPaymentItem={cancelPaymentItem}
        onCancelPaymentClose={onCancelPaymentClose}
        onCancelPaymentConfirm={onCancelPaymentConfirm}
        cancelPaymentPending={cancelPaymentPending}
      />
    </>
  );
}
