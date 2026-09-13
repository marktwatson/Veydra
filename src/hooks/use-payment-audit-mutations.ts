import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { cancelPaymentInstallment } from "@/lib/cancel-payment";
import { chargeSavedCardWithLock, releaseStaleLock } from "@/lib/charge-lock";
import { logManualAdjustment } from "@/lib/payment-manual-adjustments";
import type { AuditItem } from "@/components/PaymentAuditModals";
import { useToast } from "@/hooks/use-toast";

interface Setters {
  setAutoChargeModalItem: (v: AuditItem | null) => void;
  setManualInvoiceModalItem: (v: AuditItem | null) => void;
  setMarkUnpaidModalItem: (v: AuditItem | null) => void;
  setMarkPaidModalItem: (v: AuditItem | null) => void;
  setResendReceiptModalItem: (v: AuditItem | null) => void;
  setCancelPaymentModalItem: (v: AuditItem | null) => void;
}

export function usePaymentAuditMutations(setters: Setters) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const autoChargeMutation = useMutation({
    mutationFn: async ({
      weddingId,
      amount,
      description,
      scheduleIndex,
      installmentLabel,
    }: {
      weddingId: string;
      amount: number;
      description: string;
      scheduleIndex?: number;
      installmentLabel?: string;
    }) => {
      return await chargeSavedCardWithLock({
        weddingId,
        amount,
        description,
        scheduleIndex,
        installmentLabel,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setters.setAutoChargeModalItem(null);
      toast({
        title: "Payment Charged Successfully!",
        description: `Successfully collected $${data.amountPaid} from client.`,
      });
    },
    onError: (error: any) => {
      const msg =
        typeof error === "string"
          ? error
          : error?.message ||
            "Failed to process card charge. You can send a manual invoice link instead.";
      // If this is a lock-blocked error, tell the user they can release+retry.
      const isLockBlocked = /already being processed|Release lock/i.test(msg);
      toast({
        variant: "destructive",
        title: isLockBlocked ? "Payment Locked" : "Auto-Charge Failed",
        description: isLockBlocked
          ? `${msg} Click "Release lock and retry" to clear the stuck lock and charge again.`
          : msg,
      });
    },
  });

  // Release a stuck pending lock and immediately retry the charge. Used by the
  // "Release lock and retry" button that appears when auto-charge is blocked
  // by a stale pending row (teammate's failed attempt that didn't clean up).
  const releaseAndRetryMutation = useMutation({
    mutationFn: async (item: {
      weddingId: string;
      amount: number;
      description: string;
      scheduleIndex?: number;
      installmentLabel?: string;
    }) => {
      // Force-release the lock regardless of age, then retry the charge.
      await releaseStaleLock(
        item.weddingId,
        item.scheduleIndex,
        item.installmentLabel,
        item.description,
        true,
      );
      return await chargeSavedCardWithLock({
        weddingId: item.weddingId,
        amount: item.amount,
        description: item.description,
        scheduleIndex: item.scheduleIndex,
        installmentLabel: item.installmentLabel,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setters.setAutoChargeModalItem(null);
      toast({
        title: "Lock Released — Payment Charged!",
        description: `Cleared the stuck lock and collected $${data.amountPaid} from client.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Retry Failed",
        description:
          error?.message ||
          "Could not release the lock and retry. Refresh and try again.",
      });
    },
  });

  const sendManualInvoiceMutation = useMutation({
    mutationFn: async ({
      weddingId,
      amount,
      label,
    }: {
      weddingId: string;
      amount: number;
      label: string;
    }) => {
      return await api.sendManualPaymentInvoice({ weddingId, amount, label });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setters.setManualInvoiceModalItem(null);
      toast({
        title: "Invoice Sent!",
        description:
          "An email and SMS invoice notification has been sent directly to the client.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Send Invoice",
        description: error.message,
      });
    },
  });

  // Mark Paid — staff manually overrides an installment as paid (e.g. a CRM
  // or bank payment that Sync found 0 for). No Stripe, no invoice create.
  const markPaidMutation = useMutation({
    mutationFn: async ({
      weddingId,
      installmentAmount,
      totalAmount,
      installmentLabel,
      scheduleIndex,
      clientName,
    }: {
      weddingId: string;
      installmentAmount: number;
      totalAmount: number;
      installmentLabel?: string;
      scheduleIndex?: number;
      clientName?: string;
    }) => {
      const { data: wedding } = await supabase
        .from("weddings")
        .select("paid_amount")
        .eq("id", weddingId)
        .maybeSingle();
      const currentPaid = Number(wedding?.paid_amount) || 0;
      const newPaidAmount = Math.min(
        Number(totalAmount) || 0,
        currentPaid + Number(installmentAmount),
      );
      await api.updateWedding(weddingId, {
        paid_amount: newPaidAmount,
        final_payment_verified:
          newPaidAmount >= (Number(totalAmount) || 0) - 0.01,
      });
      await logManualAdjustment({
        weddingId,
        amount: Number(installmentAmount),
        installmentLabel,
        scheduleIndex,
        reason: `Manual mark paid — ${clientName || "client"}`,
      });
      await api.logAdminActivity(
        "Marked Payment Paid",
        `Manually marked ${installmentLabel || "installment"} paid for ${clientName || weddingId}: $${Number(installmentAmount).toLocaleString()} → paid_amount $${newPaidAmount.toLocaleString()}`,
      );
      return { newPaidAmount, installmentAmount };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setters.setMarkPaidModalItem(null);
      toast({
        title: "Payment Marked Paid",
        description: `+$${variables.installmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} → paid_amount now $${data.newPaidAmount.toLocaleString()}. Confirm this posted in CRM or the bank before relying on it.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Mark Paid",
        description: error.message || "Could not update wedding record.",
      });
    },
  });

  const markUnpaidMutation = useMutation({
    mutationFn: async ({
      weddingId,
      currentPaidAmount,
      installmentAmount,
      scheduleIndex,
      wedding,
    }: {
      weddingId: string;
      currentPaidAmount: number;
      installmentAmount: number;
      scheduleIndex?: number;
      wedding: any;
    }) => {
      const newPaidAmount = Math.max(0, currentPaidAmount - installmentAmount);
      await api.updateWedding(weddingId, {
        paid_amount: newPaidAmount,
        final_payment_verified: false,
      });
      await logManualAdjustment({
        weddingId,
        amount: -Number(installmentAmount),
        installmentLabel: wedding?.installmentLabel,
        scheduleIndex,
        reason: "Manual mark unpaid reversal",
      });
      await api.logAdminActivity(
        "Marked Payment Unpaid",
        `Adjusted paid_amount for wedding ${weddingId} from $${currentPaidAmount} to $${newPaidAmount}`,
      );
      return { newPaidAmount, adjustmentAmount: installmentAmount };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setters.setMarkUnpaidModalItem(null);
      toast({
        title: "Payment Marked Unpaid",
        description: `Adjusted by -$${(data?.adjustmentAmount ?? variables.installmentAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}. This reverses a manual (or synced) paid mark — it does not refund CRM or Stripe.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Mark Unpaid",
        description: error.message || "Could not update wedding record.",
      });
    },
  });

  const resendReceiptMutation = useMutation({
    mutationFn: async ({
      weddingId,
      amount,
      label,
    }: {
      weddingId: string;
      amount: number;
      label?: string;
    }) => {
      return await api.sendPaymentReceipt({ weddingId, amount, label });
    },
    onSuccess: () => {
      setters.setResendReceiptModalItem(null);
      toast({
        title: "Receipt Sent!",
        description: "Payment receipt has been emailed to the client.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Send Receipt",
        description: error.message || "Could not send receipt email.",
      });
    },
  });

  const cancelPaymentMutation = useMutation({
    mutationFn: async (item: AuditItem & { scheduleIndex?: number }) => {
      return await cancelPaymentInstallment({
        weddingId: item.weddingId,
        installmentLabel: item.installmentLabel,
        installmentAmount: item.installmentAmount,
        installmentDate: item.installmentDate,
        scheduleIndex: item.scheduleIndex,
      });
    },
    onSuccess: (_data, item) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setters.setCancelPaymentModalItem(null);
      toast({
        title: "Payment Cancelled",
        description: `"${item.installmentLabel}" was permanently removed from ${item.clientName}'s payment plan. Use Change Payment Plan to set up a new one if needed.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Could Not Cancel Payment",
        description:
          error.message ||
          "Something went wrong removing this installment. Refresh and try again.",
      });
    },
  });

  return {
    autoChargeMutation,
    releaseAndRetryMutation,
    sendManualInvoiceMutation,
    markUnpaidMutation,
    markPaidMutation,
    resendReceiptMutation,
    cancelPaymentMutation,
  };
}
