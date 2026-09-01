import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cancelPaymentInstallment } from "@/lib/cancel-payment";
import {
  PaymentAuditModals,
  type AuditItem,
} from "@/components/PaymentAuditModals";
import { PaymentAuditStats } from "@/components/PaymentAuditStats";
import { PaymentAuditFilters } from "@/components/PaymentAuditFilters";
import { PaymentAuditTable } from "@/components/PaymentAuditTable";
import { buildAuditScheduleItems } from "@/lib/audit-schedule";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ManagerPaymentAudit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTrigger] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "paid" | "overdue" | "pending"
  >("all");
  const [planFilter, setPaymentPlanFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "date-asc" | "date-desc" | "name-asc" | "name-desc"
  >("date-asc");

  // Modal states for action triggers
  const [autoChargeModalItem, setAutoChargeModalItem] =
    useState<AuditItem | null>(null);
  const [manualInvoiceModalItem, setManualInvoiceModalItem] =
    useState<AuditItem | null>(null);
  const [markUnpaidModalItem, setMarkUnpaidModalItem] =
    useState<AuditItem | null>(null);
  const [resendReceiptModalItem, setResendReceiptModalItem] =
    useState<AuditItem | null>(null);
  const [cancelPaymentModalItem, setCancelPaymentModalItem] =
    useState<AuditItem | null>(null);

  const {
    data: weddings = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  // Calculate all schedule items across every wedding
  const auditScheduleItems = useMemo(
    () => buildAuditScheduleItems(weddings),
    [weddings],
  );

  // Get unique list of clients for the filter dropdown
  const clientOptions = useMemo(() => {
    const clientsMap = new Map<string, string>();
    auditScheduleItems.forEach((item) => {
      if (item.weddingId && item.clientName) {
        clientsMap.set(item.weddingId, item.clientName);
      }
    });
    return Array.from(clientsMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [auditScheduleItems]);

  // Apply search and filtering
  const filteredItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = auditScheduleItems.filter((item: any) => {
      // Search
      const search = searchTerm.toLowerCase().trim();
      if (search) {
        const nameMatch = item.clientName.toLowerCase().includes(search);
        const emailMatch = item.clientEmail.toLowerCase().includes(search);
        const labelMatch = item.installmentLabel.toLowerCase().includes(search);
        if (!nameMatch && !emailMatch && !labelMatch) return false;
      }

      // Client filter
      if (clientFilter !== "all" && item.weddingId !== clientFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      // Payment plan filter
      if (planFilter !== "all") {
        if (planFilter === "custom" && !item.hasCustomPlan) return false;
        if (planFilter !== "custom" && item.paymentPlan !== planFilter)
          return false;
      }

      // Date preset filter
      if (dateFilter !== "all" && item.parsedDate) {
        const itemTime = item.parsedDate.getTime();
        const now = today.getTime();

        if (dateFilter === "past") {
          if (itemTime >= now) return false;
        } else if (dateFilter === "today") {
          const itemDateStr = item.parsedDate.toISOString().split("T")[0];
          const todayStr = today.toISOString().split("T")[0];
          if (itemDateStr !== todayStr) return false;
        } else if (dateFilter === "this-month") {
          const startOfMonth = new Date(
            today.getFullYear(),
            today.getMonth(),
            1,
          ).getTime();
          const endOfMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            0,
            23,
            59,
            59,
          ).getTime();
          if (itemTime < startOfMonth || itemTime > endOfMonth) return false;
        } else if (dateFilter === "next-30") {
          const in30Days = now + 30 * 24 * 60 * 60 * 1000;
          if (itemTime < now || itemTime > in30Days) return false;
        } else if (dateFilter === "custom") {
          if (startDate) {
            const start = new Date(`${startDate}T00:00:00`).getTime();
            if (itemTime < start) return false;
          }
          if (endDate) {
            const end = new Date(`${endDate}T23:59:59`).getTime();
            if (itemTime > end) return false;
          }
        }
      }

      return true;
    });

    // Sorting
    return result.sort((a: any, b: any) => {
      if (sortBy === "date-asc") {
        const timeA = a.parsedDate ? a.parsedDate.getTime() : 0;
        const timeB = b.parsedDate ? b.parsedDate.getTime() : 0;
        return timeA - timeB;
      } else if (sortBy === "date-desc") {
        const timeA = a.parsedDate ? a.parsedDate.getTime() : 0;
        const timeB = b.parsedDate ? b.parsedDate.getTime() : 0;
        return timeB - timeA;
      } else if (sortBy === "name-asc") {
        return a.clientName.localeCompare(b.clientName);
      } else if (sortBy === "name-desc") {
        return b.clientName.localeCompare(a.clientName);
      }
      return 0;
    });
  }, [
    auditScheduleItems,
    searchTerm,
    clientFilter,
    statusFilter,
    planFilter,
    dateFilter,
    startDate,
    endDate,
    sortBy,
  ]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalScheduled = 0;
    let totalPaid = 0;
    let totalOverdue = 0;
    let totalPending = 0;

    auditScheduleItems.forEach((item: any) => {
      totalScheduled += item.installmentAmount;
      if (item.status === "paid") {
        totalPaid += item.installmentAmount;
      } else if (item.status === "overdue") {
        totalOverdue += item.installmentAmount;
      } else {
        totalPending += item.installmentAmount;
      }
    });

    return {
      totalScheduled,
      totalPaid,
      totalOverdue,
      totalPending,
      overdueCount: auditScheduleItems.filter(
        (i: any) => i.status === "overdue",
      ).length,
      pendingCount: auditScheduleItems.filter(
        (i: any) => i.status === "pending",
      ).length,
      paidCount: auditScheduleItems.filter((i: any) => i.status === "paid")
        .length,
    };
  }, [auditScheduleItems]);

  // Mutations
  const autoChargeMutation = useMutation({
    mutationFn: async ({
      weddingId,
      amount,
      description,
    }: {
      weddingId: string;
      amount: number;
      description: string;
    }) => {
      return await api.chargeSavedCard({ weddingId, amount, description });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setAutoChargeModalItem(null);
      toast({
        title: "Payment Charged Successfully!",
        description: `Successfully collected $${data.amountPaid || autoChargeModalItem?.installmentAmount} from client.`,
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
      setManualInvoiceModalItem(null);
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
    }: {
      weddingId: string;
      currentPaidAmount: number;
      installmentAmount: number;
    }) => {
      const newPaidAmount = Math.max(0, currentPaidAmount - installmentAmount);
      await api.updateWedding(weddingId, { paid_amount: newPaidAmount });
      await api.logAdminActivity(
        "Marked Payment Unpaid",
        `Adjusted paid_amount for wedding ${weddingId} to $${newPaidAmount}`,
      );
      return { newPaidAmount };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setMarkUnpaidModalItem(null);
      toast({
        title: "Payment Marked Unpaid",
        description: `Subtracted $${variables.installmentAmount.toLocaleString()} from client's paid balance.`,
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
      setResendReceiptModalItem(null);
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
    onSuccess: (data, item) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setCancelPaymentModalItem(null);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Payment Audit & Invoicing
          </h1>
          <p className="text-sm text-muted-foreground">
            Audit past, present, and custom scheduled payments across all client
            contracts. Auto-charge saved cards or send manual payment invoices
            instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="rounded-full shadow-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh Audit Data
          </Button>
        </div>
      </div>

      <PaymentAuditStats
        metrics={metrics}
        totalInstallments={auditScheduleItems.length}
      />

      <PaymentAuditFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTrigger}
        clientFilter={clientFilter}
        onClientFilterChange={setClientFilter}
        clientOptions={clientOptions}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        planFilter={planFilter}
        onPlanFilterChange={setPaymentPlanFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        totalItems={auditScheduleItems.length}
        metrics={metrics}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
      />

      <PaymentAuditTable
        isLoading={isLoading}
        filteredItems={filteredItems}
        totalItems={auditScheduleItems.length}
        onAutoCharge={setAutoChargeModalItem}
        onManualInvoice={setManualInvoiceModalItem}
        onCancelPayment={setCancelPaymentModalItem}
        onResendReceipt={setResendReceiptModalItem}
        onMarkUnpaid={setMarkUnpaidModalItem}
      />

      <PaymentAuditModals
        autoChargeItem={autoChargeModalItem}
        onAutoChargeClose={() => setAutoChargeModalItem(null)}
        onAutoChargeConfirm={(item) =>
          autoChargeMutation.mutate({
            weddingId: item.weddingId,
            amount: item.installmentAmount,
            description: `${item.installmentLabel} for ${item.clientName} Wedding`,
          })
        }
        autoChargePending={autoChargeMutation.isPending}
        manualInvoiceItem={manualInvoiceModalItem}
        onManualInvoiceClose={() => setManualInvoiceModalItem(null)}
        onManualInvoiceConfirm={(item) =>
          sendManualInvoiceMutation.mutate({
            weddingId: item.weddingId,
            amount: item.installmentAmount,
            label: item.installmentLabel,
          })
        }
        manualInvoicePending={sendManualInvoiceMutation.isPending}
        markUnpaidItem={markUnpaidModalItem}
        onMarkUnpaidClose={() => setMarkUnpaidModalItem(null)}
        onMarkUnpaidConfirm={(item) =>
          markUnpaidMutation.mutate({
            weddingId: item.weddingId,
            currentPaidAmount: item.paidAmount,
            installmentAmount: item.installmentAmount,
          })
        }
        markUnpaidPending={markUnpaidMutation.isPending}
        resendReceiptItem={resendReceiptModalItem}
        onResendReceiptClose={() => setResendReceiptModalItem(null)}
        onResendReceiptConfirm={(item) =>
          resendReceiptMutation.mutate({
            weddingId: item.weddingId,
            amount: item.installmentAmount,
            label: item.installmentLabel,
          })
        }
        resendReceiptPending={resendReceiptMutation.isPending}
        cancelPaymentItem={cancelPaymentModalItem}
        onCancelPaymentClose={() => setCancelPaymentModalItem(null)}
        onCancelPaymentConfirm={(item) => cancelPaymentMutation.mutate(item)}
        cancelPaymentPending={cancelPaymentMutation.isPending}
      />
    </div>
  );
}
