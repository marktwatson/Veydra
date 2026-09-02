import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import {
  PaymentAuditModals,
  type AuditItem,
} from "@/components/PaymentAuditModals";
import { PaymentAuditStats } from "@/components/PaymentAuditStats";
import { PaymentAuditFilters } from "@/components/PaymentAuditFilters";
import { PaymentAuditTable } from "@/components/PaymentAuditTable";
import { buildAuditScheduleItems } from "@/lib/audit-schedule";
import { syncPaymentsFromStripe } from "@/lib/sync-payments";
import { Button } from "@/components/ui/button";
import { RefreshCw, CloudDownload, FileText } from "lucide-react";
import { SyncReportDialog } from "@/components/SyncReportDialog";
import { usePaymentAuditMutations } from "@/hooks/use-payment-audit-mutations";
import { useToast } from "@/hooks/use-toast";

// Map query param values to the dateFilter dropdown values.
const DATE_PARAM_MAP: Record<string, string> = {
  today: "today",
  past: "past",
  overdue: "past",
  "this-month": "this-month",
  "next-30": "next-30",
  custom: "custom",
};

export default function ManagerPaymentAudit() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTrigger] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "paid" | "overdue" | "pending"
  >("all");
  const [planFilter, setPaymentPlanFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  // Pre-apply the date filter from the query string (?date=today) so the
  // "Go to Payment Audit" modal can deep-link straight into the right view.
  const [dateFilter, setDateFilter] = useState<string>(
    DATE_PARAM_MAP[searchParams.get("date") || ""] || "all",
  );
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
  const [showSyncReport, setShowSyncReport] = useState(false);

  const {
    data: weddings = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  // Force a Stripe paid-amount recompute (no notifications, no charging).
  // Fixes stale paid_amount after refunds without waiting for the daily cron.
  // Shows a per-wedding diagnostic so staff can see exactly what changed (or
  // didn't) instead of a generic "Synced" that hides silent failures.
  const [syncResult, setSyncResult] = useState<any>(null);
  const syncMutation = useMutation({
    mutationFn: syncPaymentsFromStripe,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setSyncResult(data);
      const s = data?.summary;
      if (s?.stripe_key_missing) {
        toast({
          variant: "destructive",
          title: "Stripe key missing",
          description:
            "The STRIPE_SECRET_KEY env var is not set on the daily-reminders edge function. Add it in Supabase → Edge Functions → daily-reminders → Secrets, then redeploy.",
        });
      } else if (s && s.weddings_updated > 0) {
        toast({
          title: "Synced from Stripe",
          description: `Updated ${s.weddings_updated} wedding(s) · Net collected $${s.total_net_collected?.toLocaleString()} · Click "Last Sync Report" to see per-wedding details.`,
        });
      } else if (s && s.weddings_errored > 0) {
        toast({
          variant: "destructive",
          title: "Sync completed with errors",
          description: `${s.weddings_errored} wedding(s) failed. Click "Last Sync Report" to see what went wrong.`,
        });
      } else {
        toast({
          title: "Synced from Stripe",
          description: `All ${s?.total_weddings || 0} weddings already up to date. Net collected $${s?.total_net_collected?.toLocaleString() || 0}.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Stripe sync failed",
        description:
          error?.message ||
          "Could not reach the sync function. Make sure daily-reminders is deployed.",
      });
    },
  });

  const {
    autoChargeMutation,
    sendManualInvoiceMutation,
    markUnpaidMutation,
    resendReceiptMutation,
    cancelPaymentMutation,
  } = usePaymentAuditMutations({
    setAutoChargeModalItem,
    setManualInvoiceModalItem,
    setMarkUnpaidModalItem,
    setResendReceiptModalItem,
    setCancelPaymentModalItem,
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
    let totalScheduled = 0,
      totalPaid = 0,
      totalOverdue = 0,
      totalPending = 0;
    const totalRefunded = weddings.reduce(
      (s: number, w: any) => s + (Number(w.refunded_amount) || 0),
      0,
    );
    auditScheduleItems.forEach((item: any) => {
      totalScheduled += item.installmentAmount;
      if (item.status === "paid") totalPaid += item.installmentAmount;
      else if (item.status === "overdue")
        totalOverdue += item.installmentAmount;
      else totalPending += item.installmentAmount;
    });
    return {
      totalScheduled,
      totalPaid,
      totalOverdue,
      totalPending,
      totalRefunded,
      overdueCount: auditScheduleItems.filter(
        (i: any) => i.status === "overdue",
      ).length,
      pendingCount: auditScheduleItems.filter(
        (i: any) => i.status === "pending",
      ).length,
      paidCount: auditScheduleItems.filter((i: any) => i.status === "paid")
        .length,
    };
  }, [auditScheduleItems, weddings]);

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
          {syncResult && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSyncReport(true)}
              className="rounded-full shadow-sm"
            >
              <FileText className="h-4 w-4 mr-2" /> Last Sync Report
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="rounded-full shadow-sm"
            title="Recompute paid amounts from Stripe (net of refunds). Does not charge anyone or send notifications."
          >
            {syncMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4 mr-2" />
            )}
            Sync from Stripe
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
            scheduleIndex: item.scheduleIndex,
            installmentLabel: item.installmentLabel,
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
            scheduleIndex: item.scheduleIndex,
            wedding: item.weddingObj,
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

      <SyncReportDialog
        open={showSyncReport}
        onOpenChange={setShowSyncReport}
        summary={syncResult?.summary}
        log={syncResult?.log}
      />
    </div>
  );
}
