import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { generatePaymentSchedule, formatDisplayDate } from "@/lib/utils";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Search,
  CreditCard,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Filter,
  RefreshCw,
  Mail,
  ExternalLink,
  ShieldCheck,
  Building,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const [autoChargeModalItem, setAutoChargeModalItem] = useState<any>(null);
  const [manualInvoiceModalItem, setManualInvoiceModalItem] =
    useState<any>(null);
  const [markUnpaidModalItem, setMarkUnpaidModalItem] = useState<any>(null);
  const [resendReceiptModalItem, setResendReceiptModalItem] =
    useState<any>(null);

  const {
    data: weddings = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  // Calculate all schedule items across every wedding
  const auditScheduleItems = useMemo(() => {
    const items: any[] = [];

    const todayStr = new Date().toISOString().split("T")[0];
    const todayDate = new Date(todayStr + "T12:00:00");

    weddings.forEach((wedding: any) => {
      // Skip draft or unpaid draft records unless explicitly desired
      if (wedding.notes?.includes("[UNPAID_DRAFT]")) return;

      const total = Number(wedding.total_amount) || 0;
      const paid = Number(wedding.paid_amount) || 0;
      const plan = wedding.payment_plan || "full";
      const customPlan = wedding.custom_payment_plan;
      const weddingDate = wedding.date || "";
      const createdAt = wedding.contract_date || wedding.created_at || "";

      // Generate expected payment breakdown
      let schedule = generatePaymentSchedule(
        total,
        plan,
        weddingDate,
        createdAt,
        paid,
        customPlan,
      );

      // If no schedule items were generated (e.g. missing wedding date), fallback to single entry
      if (!schedule || schedule.length === 0) {
        const isPaidInFull =
          paid > 0 && (paid >= total - 1 || paid >= total * 0.945);
        schedule = [
          {
            date: weddingDate
              ? new Date(weddingDate + "T12:00:00").toLocaleDateString("en-US")
              : "TBD",
            amount: total,
            label: plan === "full" ? "Pay in Full" : "Package Balance",
            status: isPaidInFull ? "paid" : "pending",
          },
        ];
      }

      // Map schedule items into structured records
      schedule.forEach((inst: any, index: number) => {
        let isPaid = inst.status === "paid";

        // Parse payment date
        let parsedDate: Date | null = null;
        if (inst.date && inst.date !== "TBD") {
          const parts = inst.date.split("/");
          if (parts.length === 3) {
            parsedDate = new Date(
              `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}T12:00:00`,
            );
          } else {
            parsedDate = new Date(inst.date);
          }
        }

        let isOverdue = false;
        if (!isPaid && parsedDate) {
          isOverdue = parsedDate < todayDate;
        }

        let computedStatus: "paid" | "overdue" | "pending" = "pending";
        if (isPaid) computedStatus = "paid";
        else if (isOverdue) computedStatus = "overdue";

        items.push({
          id: `${wedding.id}-${index}`,
          weddingId: wedding.id,
          clientName: wedding.client_name || "Unknown Client",
          clientEmail:
            wedding.client_email ||
            wedding.questionnaire_data?.contact_info?.email ||
            "",
          weddingDate: weddingDate,
          totalAmount: total,
          paidAmount: paid,
          installmentLabel: inst.label || `Installment #${index + 1}`,
          installmentAmount: Number(inst.amount) || 0,
          installmentDate: inst.date,
          parsedDate,
          status: computedStatus,
          paymentPlan: plan,
          hasCustomPlan: plan === "custom" || customPlan?.enabled,
          stripeCustomerId: wedding.stripe_customer_id,
          stripeSubscriptionId: wedding.stripe_subscription_id,
          stripeSubscriptionStatus: wedding.stripe_subscription_status,
          weddingObj: wedding,
        });
      });
    });

    return items;
  }, [weddings]);

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

    const result = auditScheduleItems.filter((item) => {
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
    return result.sort((a, b) => {
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

    auditScheduleItems.forEach((item) => {
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
      overdueCount: auditScheduleItems.filter((i) => i.status === "overdue")
        .length,
      pendingCount: auditScheduleItems.filter((i) => i.status === "pending")
        .length,
      paidCount: auditScheduleItems.filter((i) => i.status === "paid").length,
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

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Contract Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
              ${metrics.totalScheduled.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {auditScheduleItems.length} total installments
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/40 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/20">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Collected Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              ${metrics.totalPaid.toLocaleString()}
            </div>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
              {metrics.paidCount} paid installments
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/40 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/20">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Overdue Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              ${metrics.totalOverdue.toLocaleString()}
            </div>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              {metrics.overdueCount} require attention
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/40 rounded-2xl bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/20">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Upcoming Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              ${metrics.totalPending.toLocaleString()}
            </div>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
              {metrics.pendingCount} pending future dates
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Toolbar */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search client name, email, or payment label..."
                value={searchTerm}
                onChange={(e) => setSearchTrigger(e.target.value)}
                className="pl-9 rounded-full"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter by Client Name */}
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[170px] rounded-full text-xs">
                  <SelectValue placeholder="Filter by Client" />
                </SelectTrigger>
                <SelectContent rounded-xl className="max-h-60">
                  <SelectItem value="all">
                    All Clients ({clientOptions.length})
                  </SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filter by Date */}
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[160px] rounded-full text-xs">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent rounded-xl>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="past">Past Due & Historical</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="next-30">Next 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(v: any) => setStatusFilter(v)}
              >
                <SelectTrigger className="w-[140px] rounded-full text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent rounded-xl>
                  <SelectItem value="all">
                    All Statuses ({auditScheduleItems.length})
                  </SelectItem>
                  <SelectItem value="overdue">
                    Overdue ({metrics.overdueCount})
                  </SelectItem>
                  <SelectItem value="pending">
                    Pending ({metrics.pendingCount})
                  </SelectItem>
                  <SelectItem value="paid">
                    Paid ({metrics.paidCount})
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Payment Plan Filter */}
              <Select value={planFilter} onValueChange={setPaymentPlanFilter}>
                <SelectTrigger className="w-[150px] rounded-full text-xs">
                  <SelectValue placeholder="All Payment Plans" />
                </SelectTrigger>
                <SelectContent rounded-xl>
                  <SelectItem value="all">All Payment Plans</SelectItem>
                  <SelectItem value="custom">Custom Plan</SelectItem>
                  <SelectItem value="full">Pay in Full</SelectItem>
                  <SelectItem value="half">50/50 Split</SelectItem>
                  <SelectItem value="monthly">Monthly Plan</SelectItem>
                  <SelectItem value="quarterly">Quarterly Plan</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Order */}
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[150px] rounded-full text-xs">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent rounded-xl>
                  <SelectItem value="date-asc">Date: Earliest First</SelectItem>
                  <SelectItem value="date-desc">Date: Latest First</SelectItem>
                  <SelectItem value="name-asc">Client: A to Z</SelectItem>
                  <SelectItem value="name-desc">Client: Z to A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Inputs if Custom Date selected */}
          {dateFilter === "custom" && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">
                  Start:
                </span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 rounded-full text-xs w-[140px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">End:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 rounded-full text-xs w-[140px]"
                />
              </div>
              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="h-8 text-xs rounded-full text-muted-foreground hover:text-foreground"
                >
                  Clear Custom Dates
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Audit Schedule Table */}
      <Card className="shadow-sm border-border/40 rounded-2xl overflow-hidden bg-card">
        <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">
              Scheduled & Historical Payments
            </CardTitle>
            <CardDescription className="text-xs">
              Showing {filteredItems.length} of {auditScheduleItems.length}{" "}
              payment installment items
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
                  {filteredItems.map((item) => (
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
                              onClick={() => setResendReceiptModalItem(item)}
                            >
                              <Mail className="h-3.5 w-3.5 text-primary" />
                              Resend Receipt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full text-xs shadow-sm text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1 font-medium"
                              onClick={() => setMarkUnpaidModalItem(item)}
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
                              onClick={() => setAutoChargeModalItem(item)}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Auto-Charge Card
                            </Button>

                            {/* Send manual payment invoice button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full text-xs shadow-sm gap-1"
                              onClick={() => setManualInvoiceModalItem(item)}
                            >
                              <Send className="h-3.5 w-3.5 text-primary" />
                              Send Invoice Link
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

      {/* Modal: Auto-Charge Confirmation */}
      <Dialog
        open={!!autoChargeModalItem}
        onOpenChange={(open) => !open && setAutoChargeModalItem(null)}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <CreditCard className="h-5 w-5 text-emerald-600" /> Auto-Charge
              Saved Card
            </DialogTitle>
            <DialogDescription>
              This will charge the saved payment method on file via Stripe for{" "}
              <strong>{autoChargeModalItem?.clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {autoChargeModalItem && (
            <div className="py-4 space-y-4">
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-semibold text-foreground">
                    {autoChargeModalItem.clientName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground">
                    {autoChargeModalItem.clientEmail || "Not provided"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Installment:</span>
                  <span className="font-medium text-foreground">
                    {autoChargeModalItem.installmentLabel}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2 mt-2">
                  <span className="font-bold text-foreground">
                    Charge Amount:
                  </span>
                  <span className="font-extrabold text-emerald-600 text-base">
                    $
                    {autoChargeModalItem.installmentAmount.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}
                  </span>
                </div>
              </div>

              {!autoChargeModalItem.stripeCustomerId ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 shrink-0" /> Stripe Customer
                    ID not directly linked
                  </div>
                  <p>
                    The system will attempt to locate their customer profile via
                    email ({autoChargeModalItem.clientEmail}) or their saved
                    card tokens on file.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>
                    Stripe Customer Token Active (
                    {autoChargeModalItem.stripeCustomerId})
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setAutoChargeModalItem(null)}
              disabled={autoChargeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (autoChargeModalItem) {
                  autoChargeMutation.mutate({
                    weddingId: autoChargeModalItem.weddingId,
                    amount: autoChargeModalItem.installmentAmount,
                    description: `${autoChargeModalItem.installmentLabel} for ${autoChargeModalItem.clientName} Wedding`,
                  });
                }
              }}
              disabled={autoChargeMutation.isPending}
            >
              {autoChargeMutation.isPending ? (
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
        open={!!manualInvoiceModalItem}
        onOpenChange={(open) => !open && setManualInvoiceModalItem(null)}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Send className="h-5 w-5 text-primary" /> Send Manual Invoice
            </DialogTitle>
            <DialogDescription>
              This will send a direct payment link and formal invoice via email
              & SMS to <strong>{manualInvoiceModalItem?.clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {manualInvoiceModalItem && (
            <div className="py-4 space-y-4">
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Recipient Email:
                  </span>
                  <span className="font-semibold text-foreground">
                    {manualInvoiceModalItem.clientEmail || "No email on file"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Installment Label:
                  </span>
                  <span className="font-medium text-foreground">
                    {manualInvoiceModalItem.installmentLabel}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2 mt-2">
                  <span className="font-bold text-foreground">
                    Invoice Amount:
                  </span>
                  <span className="font-extrabold text-primary text-base">
                    $
                    {manualInvoiceModalItem.installmentAmount.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}
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
              onClick={() => setManualInvoiceModalItem(null)}
              disabled={sendManualInvoiceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="rounded-full"
              onClick={() => {
                if (manualInvoiceModalItem) {
                  sendManualInvoiceMutation.mutate({
                    weddingId: manualInvoiceModalItem.weddingId,
                    amount: manualInvoiceModalItem.installmentAmount,
                    label: manualInvoiceModalItem.installmentLabel,
                  });
                }
              }}
              disabled={
                sendManualInvoiceMutation.isPending ||
                !manualInvoiceModalItem?.clientEmail
              }
            >
              {sendManualInvoiceMutation.isPending ? (
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
        open={!!markUnpaidModalItem}
        onOpenChange={(open) => !open && setMarkUnpaidModalItem(null)}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-600 dark:text-amber-500">
              <RotateCcw className="h-5 w-5" /> Mark Payment Unpaid
            </DialogTitle>
            <DialogDescription>
              This will update{" "}
              <strong>{markUnpaidModalItem?.clientName}</strong>'s wedding
              ledger and subtract this installment amount from their paid
              balance.
            </DialogDescription>
          </DialogHeader>

          {markUnpaidModalItem && (
            <div className="py-4 space-y-4">
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-semibold text-foreground">
                    {markUnpaidModalItem.clientName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Installment:</span>
                  <span className="font-medium text-foreground">
                    {markUnpaidModalItem.installmentLabel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Current Total Paid:
                  </span>
                  <span className="font-semibold text-emerald-600">
                    ${markUnpaidModalItem.paidAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Deducting Amount:
                  </span>
                  <span className="font-semibold text-red-600">
                    -${markUnpaidModalItem.installmentAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2 mt-2 font-bold">
                  <span>New Total Paid Balance:</span>
                  <span className="text-foreground">
                    $
                    {Math.max(
                      0,
                      markUnpaidModalItem.paidAmount -
                        markUnpaidModalItem.installmentAmount,
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
              onClick={() => setMarkUnpaidModalItem(null)}
              disabled={markUnpaidMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="rounded-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                if (markUnpaidModalItem) {
                  markUnpaidMutation.mutate({
                    weddingId: markUnpaidModalItem.weddingId,
                    currentPaidAmount: markUnpaidModalItem.paidAmount,
                    installmentAmount: markUnpaidModalItem.installmentAmount,
                  });
                }
              }}
              disabled={markUnpaidMutation.isPending}
            >
              {markUnpaidMutation.isPending ? (
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
        open={!!resendReceiptModalItem}
        onOpenChange={(open) => !open && setResendReceiptModalItem(null)}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Mail className="h-5 w-5 text-primary" /> Resend Payment Receipt
            </DialogTitle>
            <DialogDescription>
              This will send a copy of the formal HTML payment receipt to{" "}
              <strong>{resendReceiptModalItem?.clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {resendReceiptModalItem && (
            <div className="py-4 space-y-4">
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Recipient Email:
                  </span>
                  <span className="font-semibold text-foreground">
                    {resendReceiptModalItem.clientEmail || "No email on file"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Item:</span>
                  <span className="font-medium text-foreground">
                    {resendReceiptModalItem.installmentLabel}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2 mt-2">
                  <span className="font-bold text-foreground">
                    Receipt Amount:
                  </span>
                  <span className="font-extrabold text-emerald-600 text-base">
                    $
                    {resendReceiptModalItem.installmentAmount.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setResendReceiptModalItem(null)}
              disabled={resendReceiptMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="rounded-full"
              onClick={() => {
                if (resendReceiptModalItem) {
                  resendReceiptMutation.mutate({
                    weddingId: resendReceiptModalItem.weddingId,
                    amount: resendReceiptModalItem.installmentAmount,
                    label: resendReceiptModalItem.installmentLabel,
                  });
                }
              }}
              disabled={
                resendReceiptMutation.isPending ||
                !resendReceiptModalItem?.clientEmail
              }
            >
              {resendReceiptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Receipt Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
