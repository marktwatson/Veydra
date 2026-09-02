import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { cancelPaymentInstallment } from "@/lib/cancel-payment";
import { computeMarkUnpaidAmount } from "@/lib/mark-unpaid";
import { chargeSavedCardWithLock } from "@/lib/charge-lock";
import type { AuditItem } from "@/components/PaymentAuditModals";
import { useToast } from "@/hooks/use-toast";

interface Setters {
  setAutoChargeModalItem: (v: AuditItem | null) => void;
  setManualInvoiceModalItem: (v: AuditItem | null) => void;
  setMarkUnpaidModalItem: (v: AuditItem | null) => void;
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
      toast({
        variant: "destructive",
        title: "Auto-Charge Failed",
        description: msg,
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
      const { newPaidAmount, adjustmentAmount } = computeMarkUnpaidAmount(
        wedding,
        currentPaidAmount,
        scheduleIndex,
      );
      await api.updateWedding(weddingId, {
        paid_amount: newPaidAmount,
        final_payment_verified: false,
      });
      try {
        await supabase.from("payment_refunds").insert({
          wedding_id: weddingId,
          stripe_charge_id: `manual_${weddingId}_${Date.now()}`,
          amount: adjustmentAmount,
          reason: "manual_unpaid",
        });
      } catch (e: any) {
        console.warn("manual_unpaid log failed:", e?.message);
      }
      await api.logAdminActivity(
        "Marked Payment Unpaid",
        `Adjusted paid_amount for wedding ${weddingId} from $${currentPaidAmount} to $${newPaidAmount}`,
      );
      return { newPaidAmount, adjustmentAmount };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setters.setMarkUnpaidModalItem(null);
      toast({
        title: "Payment Marked Unpaid",
        description: `Adjusted by -$${(data?.adjustmentAmount ?? variables.installmentAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}. Installment is now pending — you can auto-charge or re-invoice it.`,
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
    sendManualInvoiceMutation,
    markUnpaidMutation,
    resendReceiptMutation,
    cancelPaymentMutation,
  };
}
