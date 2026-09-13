import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { api, DbWedding } from "@/lib/api";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";

interface CancelWeddingModalProps {
  wedding: DbWedding;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelWeddingModal({
  wedding,
  open,
  onOpenChange,
}: CancelWeddingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reason, setReason] = useState("");
  const [refundProcessed, setRefundProcessed] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundDate, setRefundDate] = useState("");
  const [notes, setNotes] = useState("");
  const [notifyContractors, setNotifyContractors] = useState(true);
  const [notifyBride, setNotifyBride] = useState(false);
  const [cancelPayments, setCancelPayments] = useState(true);
  const [cancellingPayments, setCancellingPayments] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const resetForm = () => {
    setReason("");
    setRefundProcessed(false);
    setRefundAmount(0);
    setRefundDate("");
    setNotes("");
    setNotifyContractors(true);
    setNotifyBride(false);
    setCancelPayments(true);
    setConfirmText("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const canSubmit = reason.trim().length > 0 && confirmText === "CANCEL";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      // Cancel all future Stripe payments (subscription + open invoices) unless opted out
      if (
        cancelPayments &&
        (wedding.stripe_subscription_id || wedding.stripe_customer_id)
      ) {
        setCancellingPayments(true);
        try {
          let {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.access_token) {
            const { data } = await supabase.auth.refreshSession();
            session = data.session;
          }
          const token = session?.access_token;
          if (token && token.startsWith("eyJ")) {
            const res = await fetch(
              `${supabaseUrl}/functions/v1/stripe-cancel-subscription`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                  apikey: supabaseAnonKey,
                },
                body: JSON.stringify({
                  subscriptionId: wedding.stripe_subscription_id,
                  customerId: wedding.stripe_customer_id,
                  weddingId: wedding.id,
                }),
              },
            );
            if (res.ok) {
              const data = await res.json();
              const cancelled = data?.cancelledSubscriptions?.length || 0;
              const voided = data?.voidedInvoices?.length || 0;
              if (cancelled || voided) {
                toast({
                  title: "Future payments cancelled",
                  description: `${cancelled} subscription(s) cancelled, ${voided} open invoice(s) voided in Stripe.`,
                });
              }
            }
          }
        } catch (cancelErr: any) {
          console.error("Failed to cancel Stripe payments:", cancelErr);
          toast({
            variant: "destructive",
            title: "Could not cancel Stripe payments",
            description:
              cancelErr.message ||
              "The wedding was cancelled but future Stripe charges may still run. Cancel them manually in Stripe.",
          });
        } finally {
          setCancellingPayments(false);
        }
      }

      await api.archiveWedding(wedding.id, {
        reason: reason.trim(),
        refundProcessed,
        refundAmount: refundProcessed ? refundAmount : 0,
        refundDate: refundProcessed ? refundDate : undefined,
        cancelledBy: "manager",
        notes: notes.trim() || undefined,
        notifyContractors,
        notifyBride,
      });
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast({
        title: "Wedding Cancelled & Archived",
        description: `${wedding.client_name}'s wedding has been archived. You can view it in the Cancelled tab.`,
      });
      handleOpenChange(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to cancel wedding",
        description: err.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle>Cancel & Archive Wedding</DialogTitle>
          </div>
          <DialogDescription>
            This will cancel <strong>{wedding.client_name}</strong>'s wedding,
            release all contractor assignments, and move it to the Cancelled
            tab. The wedding will not be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              Reason for Cancellation{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Client cancelled due to venue change, mutual agreement, etc."
              className="min-h-[80px]"
            />
          </div>

          {/* Refund Section */}
          <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="refund-processed"
                checked={refundProcessed}
                onCheckedChange={(c) => setRefundProcessed(!!c)}
              />
              <Label
                htmlFor="refund-processed"
                className="font-normal cursor-pointer"
              >
                A refund was processed
              </Label>
            </div>

            {refundProcessed && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refund-amount" className="text-xs">
                    Refund Amount ($)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      id="refund-amount"
                      type="number"
                      step="0.01"
                      value={refundAmount || ""}
                      onChange={(e) =>
                        setRefundAmount(parseFloat(e.target.value) || 0)
                      }
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refund-date" className="text-xs">
                    Refund Date
                  </Label>
                  <Input
                    id="refund-date"
                    type="date"
                    value={refundDate}
                    onChange={(e) => setRefundDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cancellation Notes */}
          <div className="space-y-2">
            <Label htmlFor="cancel-notes">Additional Notes (optional)</Label>
            <Textarea
              id="cancel-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any internal notes about this cancellation..."
              className="min-h-[60px]"
            />
          </div>

          {/* Notifications */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <Label className="text-sm font-semibold">Notifications</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-contractors"
                checked={notifyContractors}
                onCheckedChange={(c) => setNotifyContractors(!!c)}
              />
              <Label
                htmlFor="notify-contractors"
                className="font-normal cursor-pointer text-sm"
              >
                Notify assigned contractors (releases all assignments)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-bride"
                checked={notifyBride}
                onCheckedChange={(c) => setNotifyBride(!!c)}
              />
              <Label
                htmlFor="notify-bride"
                className="font-normal cursor-pointer text-sm"
              >
                Send cancellation email/SMS to client
              </Label>
            </div>
            <div className="flex items-start space-x-2 pt-2 border-t border-border">
              <Checkbox
                id="cancel-payments"
                checked={cancelPayments}
                onCheckedChange={(c) => setCancelPayments(!!c)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor="cancel-payments"
                  className="font-normal cursor-pointer text-sm"
                >
                  Cancel all future Stripe payments
                </Label>
                <p className="text-xs text-muted-foreground">
                  Cancels the recurring subscription and voids any open invoices
                  so the card is not charged again. Uncheck only if payments
                  should continue.
                </p>
              </div>
            </div>
          </div>

          {/* Type CANCEL Confirmation */}
          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm font-semibold">
              Type <span className="text-destructive font-bold">CANCEL</span> to
              confirm
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type CANCEL here"
              className={
                confirmText && confirmText !== "CANCEL"
                  ? "border-destructive"
                  : ""
              }
            />
            {confirmText && confirmText !== "CANCEL" && (
              <p className="text-xs text-destructive">
                Please type CANCEL exactly to proceed.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Go Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit || cancellingPayments}
          >
            {cancellingPayments
              ? "Cancelling payments..."
              : "Cancel & Archive Wedding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
