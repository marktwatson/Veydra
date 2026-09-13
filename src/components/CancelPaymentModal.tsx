import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Ban, TriangleAlert, Mail, Loader2 } from "lucide-react";
import { type AuditItem } from "@/components/PaymentAuditModals";

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

interface Props {
  cancelPaymentItem: AuditItem | null;
  onCancelPaymentClose: () => void;
  onCancelPaymentConfirm: (item: AuditItem) => void;
  cancelPaymentPending: boolean;
}

export function CancelPaymentModal({
  cancelPaymentItem,
  onCancelPaymentClose,
  onCancelPaymentConfirm,
  cancelPaymentPending,
}: Props) {
  return (
    <Dialog
      open={!!cancelPaymentItem}
      onOpenChange={(open) => !open && onCancelPaymentClose()}
    >
      <DialogContent className="sm:max-w-[500px] rounded-3xl overflow-hidden shadow-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-red-600 dark:text-red-500">
            <Ban className="h-5 w-5" /> Cancel This Payment
          </DialogTitle>
          <DialogDescription>
            This will permanently remove this scheduled payment from{" "}
            <strong>{cancelPaymentItem?.clientName}</strong>'s wedding file.
          </DialogDescription>
        </DialogHeader>

        {cancelPaymentItem && (
          <div className="py-4 space-y-4">
            <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
              <InfoRow label="Client" value={cancelPaymentItem.clientName} />
              <InfoRow
                label="Installment"
                value={cancelPaymentItem.installmentLabel}
              />
              <InfoRow
                label="Due Date"
                value={cancelPaymentItem.installmentDate}
              />
              <div className="flex justify-between border-t border-border/40 pt-2 mt-2">
                <span className="font-bold text-foreground">
                  Amount Being Cancelled:
                </span>
                <span className="font-extrabold text-red-600 text-base">
                  {money(cancelPaymentItem.installmentAmount)}
                </span>
              </div>
            </div>

            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm space-y-3">
              <div className="flex items-start gap-2 text-red-700 dark:text-red-400">
                <TriangleAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">This action is not reversible.</p>
                  <p className="text-xs mt-1">
                    Cancelling removes this installment from the wedding's
                    payment schedule entirely. The 9 AM auto-charge job will no
                    longer attempt to collect it, and it will disappear from the
                    Payment Audit and Bride Portal.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground pt-2 border-t border-red-500/20">
                <Mail className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="text-xs">
                  Need a new payment plan afterward? Use{" "}
                  <strong>Change Payment Plan</strong> from the wedding's
                  Actions menu to propose a fresh schedule to the couple.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={onCancelPaymentClose}
            disabled={cancelPaymentPending}
          >
            Keep Payment
          </Button>
          <Button
            variant="destructive"
            className="rounded-full"
            onClick={() =>
              cancelPaymentItem && onCancelPaymentConfirm(cancelPaymentItem)
            }
            disabled={cancelPaymentPending}
          >
            {cancelPaymentPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Ban className="h-4 w-4 mr-2" />
            )}
            Yes, Cancel Payment Permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
