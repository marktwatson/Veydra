import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDisplayDate } from "@/lib/utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Download,
  Plus,
  Trash2,
  Calendar,
  Receipt,
  FileText,
  PieChart as PieIcon,
  Briefcase,
  Building,
  Users,
  Tag,
  Megaphone,
  Sparkles,
  Loader2,
  Filter,
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export interface ManualExpense {
  id: string;
  date: string;
  category:
    | "Marketing"
    | "Software/Tools"
    | "Travel/Mileage"
    | "Equipment"
    | "Office/Admin"
    | "Other";
  vendor: string;
  description: string;
  amount: number;
  is_recurring?: boolean;
  start_date?: string;
  end_date?: string | null;
  created_at: string;
}

export default function ManagerAccounting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters & State
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedPeriod, setSelectedYearPeriod] = useState<
    "all" | "Q1" | "Q2" | "Q3" | "Q4"
  >("all");
  const [activeTab, setActiveTab] = useState<
    "overview" | "pnl" | "expenses" | "contractors" | "refunds"
  >("overview");

  // Modal State for Adding Expenses
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<{
    date: string;
    category: ManualExpense["category"];
    vendor: string;
    description: string;
    amount: string;
    is_recurring: boolean;
    start_date: string;
    end_date: string;
  }>({
    date: new Date().toISOString().split("T")[0],
    category: "Software/Tools",
    vendor: "",
    description: "",
    amount: "",
    is_recurring: false,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
  });

  // Queries
  const { data: weddings = [], isLoading: isLoadingWeddings } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["portal_settings"],
    queryFn: () => api.getPortalSettings(),
  });

  // Royalty periods — used to fold royalty + payback collections into the P&L
  // so net income reflects real money that left the business.
  const { data: royaltyTerritory } = useQuery({
    queryKey: ["own-royalty-territory"],
    queryFn: () => api.getOwnRoyaltyTerritory(),
    retry: false,
  });

  const { data: royaltyPeriods = [] } = useQuery({
    queryKey: ["royalty-periods", royaltyTerritory?.id],
    queryFn: () => api.getRoyaltyPeriods(royaltyTerritory!.id),
    enabled: !!royaltyTerritory?.id,
    retry: false,
  });

  const { data: fbCampaigns = [] } = useQuery({
    queryKey: ["facebookAdsCampaigns", selectedYear, selectedPeriod],
    queryFn: () => {
      // Map year and period to Meta date range params
      const yearNum = parseInt(selectedYear, 10);
      let startDate = `${selectedYear}-01-01`;
      let endDate = `${selectedYear}-12-31`;

      if (selectedPeriod === "Q1") {
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-03-31`;
      } else if (selectedPeriod === "Q2") {
        startDate = `${selectedYear}-04-01`;
        endDate = `${selectedYear}-06-30`;
      } else if (selectedPeriod === "Q3") {
        startDate = `${selectedYear}-07-01`;
        endDate = `${selectedYear}-09-30`;
      } else if (selectedPeriod === "Q4") {
        startDate = `${selectedYear}-10-01`;
        endDate = `${selectedYear}-12-31`;
      }

      // If viewing current year and 'all', use maximum or date range
      return api.getFacebookAdsCampaigns(null, startDate, endDate);
    },
    retry: 1,
  });

  // Parse manual expenses from portal_settings
  const manualExpenses: ManualExpense[] = useMemo(() => {
    if (!settings || !settings.manual_expenses) return [];
    if (Array.isArray(settings.manual_expenses))
      return settings.manual_expenses;
    try {
      return JSON.parse(settings.manual_expenses);
    } catch (e) {
      return [];
    }
  }, [settings]);

  // Mutation to save manual expense
  const updateSettingsMutation = useMutation({
    mutationFn: (updatedExpenses: ManualExpense[]) => {
      return api.updatePortalSettings({
        manual_expenses: updatedExpenses,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal_settings"] });
      toast({
        title: "Expenses Updated",
        description: "Your financial ledger has been updated.",
      });
      setIsAddExpenseOpen(false);
      setNewExpense({
        date: new Date().toISOString().split("T")[0],
        category: "Software/Tools",
        vendor: "",
        description: "",
        amount: "",
        is_recurring: false,
        start_date: new Date().toISOString().split("T")[0],
        end_date: "",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Failed to save expense",
        description: err.message || "An error occurred while saving.",
      });
    },
  });

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid expense amount.",
      });
      return;
    }

    const item: ManualExpense = {
      id:
        "exp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      date: newExpense.is_recurring ? newExpense.start_date : newExpense.date,
      category: newExpense.category,
      vendor: newExpense.vendor || "N/A",
      description: newExpense.description || "",
      amount: parseFloat(newExpense.amount),
      is_recurring: newExpense.is_recurring,
      start_date: newExpense.is_recurring ? newExpense.start_date : undefined,
      end_date:
        newExpense.is_recurring && newExpense.end_date
          ? newExpense.end_date
          : null,
      created_at: new Date().toISOString(),
    };

    const updated = [item, ...manualExpenses];
    updateSettingsMutation.mutate(updated);
  };

  const handleDeleteExpense = (id: string) => {
    const updated = manualExpenses.filter((e) => e.id !== id);
    updateSettingsMutation.mutate(updated);
  };

  // Financial Ledger Calculation Engine
  const ledger = useMemo(() => {
    // Helper to check if a date string falls in the selected year and period
    const isInPeriod = (dateStr?: string | null) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;

      const yearStr = d.getFullYear().toString();
      if (yearStr !== selectedYear) return false;

      if (selectedPeriod === "all") return true;
      const month = d.getMonth(); // 0-indexed
      if (selectedPeriod === "Q1") return month >= 0 && month <= 2;
      if (selectedPeriod === "Q2") return month >= 3 && month <= 5;
      if (selectedPeriod === "Q3") return month >= 6 && month <= 8;
      if (selectedPeriod === "Q4") return month >= 9 && month <= 11;
      return true;
    };

    // 1. Gross Revenue (Stripe payments & wedding records)
    let grossRevenue = 0;
    const clientRevenueRows: {
      id: string;
      client: string;
      date: string;
      amount: number;
      type: string;
    }[] = [];

    weddings.forEach((w: any) => {
      if (w.notes?.includes("[UNPAID_DRAFT]")) return;

      const paid = Number(w.paid_amount) || 0;
      const contractDate = w.contract_date || w.created_at || w.date;

      if (paid > 0 && isInPeriod(contractDate)) {
        grossRevenue += paid;
        clientRevenueRows.push({
          id: w.id,
          client: w.client_name || "Client",
          date: contractDate ? formatDisplayDate(contractDate) : "N/A",
          amount: paid,
          type: w.payment_plan === "full" ? "Pay in Full" : "Client Payments",
        });
      }
    });

    // 1b. Refunds (from cancelled weddings) — contra-revenue
    let totalRefunds = 0;
    const refundRows: {
      id: string;
      client: string;
      date: string;
      amount: number;
      reason: string;
    }[] = [];

    weddings.forEach((w: any) => {
      if (w.notes?.includes("[UNPAID_DRAFT]")) return;
      if (w.status !== "cancelled") return;
      if (!w.refund_processed) return;

      const refundAmount = Number(w.refund_amount) || 0;
      if (refundAmount <= 0) return;

      const refundDateStr = w.refund_date || w.cancelled_at;
      if (isInPeriod(refundDateStr)) {
        totalRefunds += refundAmount;
        refundRows.push({
          id: w.id,
          client: w.client_name || "Client",
          date: refundDateStr ? formatDisplayDate(refundDateStr) : "N/A",
          amount: refundAmount,
          reason: w.cancellation_reason || "N/A",
        });
      }
    });

    const netRevenue = grossRevenue - totalRefunds;

    // 2. Cost of Goods Sold (COGS)
    // A. Contractor Shooter Pay
    let contractorCogs = 0;
    const contractorRows: {
      id: string;
      name: string;
      role: string;
      date: string;
      amount: number;
      wedding: string;
    }[] = [];

    assignments.forEach((a: any) => {
      const isPaid = ["completed", "payment received", "paid"].includes(
        (a.status || "").toLowerCase(),
      );
      if (!isPaid) return;

      const dateStr = a.jobs?.weddings?.date || a.created_at;
      if (isInPeriod(dateStr)) {
        const payRate = Number(a.jobs?.pay_rate) || 0;
        contractorCogs += payRate;

        const cName = a.contractors
          ? `${a.contractors.first_name} ${a.contractors.last_name || ""}`.trim()
          : "Contractor";
        contractorRows.push({
          id: a.id,
          name: cName,
          role: a.jobs?.role || "Shooter",
          date: dateStr ? formatDisplayDate(dateStr) : "N/A",
          amount: payRate,
          wedding: a.jobs?.weddings?.client_name || "Wedding",
        });
      }
    });

    // B. Editor Invoices
    let editorCogs = 0;
    const editorRows: {
      id: string;
      client: string;
      date: string;
      amount: number;
    }[] = [];

    weddings.forEach((w: any) => {
      const isPaid = (w.editor_invoice_status || "").toLowerCase() === "paid";
      const amount = Number(w.editor_payout_amount) || 0;
      const dateStr = w.date || w.created_at;

      if (isPaid && amount > 0 && isInPeriod(dateStr)) {
        editorCogs += amount;
        editorRows.push({
          id: w.id,
          client: w.client_name,
          date: dateStr ? formatDisplayDate(dateStr) : "N/A",
          amount: amount,
        });
      }
    });

    const totalCogs = contractorCogs + editorCogs;
    const grossProfit = netRevenue - totalCogs;

    // 3. Operating Expenses (OPEX)
    // A. Meta Ad Spend
    let metaAdSpend = 0;
    // Exclude campaigns checked off in settings
    const excludedIds = settings?.excluded_campaign_ids || [];
    fbCampaigns.forEach((c: any) => {
      if (excludedIds.includes(c.id)) return;
      metaAdSpend += Number(c.spend) || 0;
    });

    // B. Manual Expenses (One-time and Recurring)
    let manualOpexTotal = 0;
    const expandedManualExpensesList: (ManualExpense & {
      displayDate: string;
    })[] = [];

    manualExpenses.forEach((e) => {
      if (e.is_recurring) {
        const startDateStr = e.start_date || e.date;
        const startD = new Date(startDateStr);
        if (isNaN(startD.getTime())) return;

        const endDateD = e.end_date ? new Date(e.end_date) : null;

        // Loop through all 12 months of selectedYear
        for (let m = 0; m < 12; m++) {
          const occDate = new Date(
            parseInt(selectedYear, 10),
            m,
            startD.getDate() || 1,
          );
          // ensure valid date if original date was say 31st and target month has 30 days
          if (occDate.getMonth() !== m) {
            occDate.setDate(0); // last day of target month
          }

          const occDateStr = occDate.toISOString().split("T")[0];

          // Check if occurrence is on or after start_date
          const startCheck = new Date(startDateStr);
          startCheck.setHours(0, 0, 0, 0);

          if (occDate >= startCheck) {
            if (!endDateD || occDate <= endDateD) {
              if (isInPeriod(occDateStr)) {
                manualOpexTotal += e.amount;
                expandedManualExpensesList.push({
                  ...e,
                  displayDate: occDateStr,
                });
              }
            }
          }
        }
      } else {
        if (isInPeriod(e.date)) {
          manualOpexTotal += e.amount;
          expandedManualExpensesList.push({
            ...e,
            displayDate: e.date,
          });
        }
      }
    });

    const totalOpex = metaAdSpend + manualOpexTotal;

    // 3b. Royalty & Payback — real money collected from the business.
    // Only count periods that were actually charged (paid or failed-but-charged),
    // and only those whose paid_at (or period_end fallback) falls in the selected
    // year/period. This keeps the P&L honest about cash that left the business.
    let royaltyPaid = 0;
    let paybackPaid = 0;
    const royaltyRows: {
      id: string;
      period: string;
      date: string;
      royalty: number;
      payback: number;
      total: number;
      status: string;
    }[] = [];

    (royaltyPeriods as any[]).forEach((p) => {
      // Only count periods where money actually moved.
      const charged =
        p.status === "paid" || p.status === "failed" || !!p.paid_at;
      if (!charged) return;

      const dateStr = p.paid_at || p.period_end || p.period_start;
      if (!isInPeriod(dateStr)) return;

      const r = Number(p.royalty_amount) || 0;
      const pb = Number(p.payback_amount) || 0;
      royaltyPaid += r;
      paybackPaid += pb;
      royaltyRows.push({
        id: p.id,
        period: `${p.period_start ? formatDisplayDate(p.period_start) : ""} – ${p.period_end ? formatDisplayDate(p.period_end) : ""}`,
        date: dateStr ? formatDisplayDate(dateStr) : "N/A",
        royalty: r,
        payback: pb,
        total: r + pb,
        status: p.status || "pending",
      });
    });

    const totalRoyaltyPayback = royaltyPaid + paybackPaid;

    // 4. Net Income & Margins
    const netIncome = grossProfit - totalOpex - totalRoyaltyPayback;
    const netMargin = netRevenue > 0 ? (netIncome / netRevenue) * 100 : 0;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // 5. Monthly Breakdown Chart Data for selected year
    const monthlyMap: Record<
      string,
      {
        month: string;
        revenue: number;
        cogs: number;
        opex: number;
        royalty: number;
        profit: number;
      }
    > = {};
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    monthNames.forEach((m, idx) => {
      monthlyMap[idx] = {
        month: m,
        revenue: 0,
        cogs: 0,
        opex: 0,
        royalty: 0,
        profit: 0,
      };
    });

    // Map revenue
    weddings.forEach((w: any) => {
      if (w.notes?.includes("[UNPAID_DRAFT]")) return;
      const paid = Number(w.paid_amount) || 0;
      const d = new Date(w.contract_date || w.created_at || w.date);
      if (!isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear) {
        const m = d.getMonth();
        monthlyMap[m].revenue += paid;
      }
    });

    // Subtract refunds from monthly revenue
    weddings.forEach((w: any) => {
      if (w.notes?.includes("[UNPAID_DRAFT]")) return;
      if (w.status !== "cancelled" || !w.refund_processed) return;
      const refundAmount = Number(w.refund_amount) || 0;
      if (refundAmount <= 0) return;
      const d = new Date(w.refund_date || w.cancelled_at);
      if (!isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear) {
        const m = d.getMonth();
        monthlyMap[m].revenue -= refundAmount;
      }
    });

    // Map COGS
    assignments.forEach((a: any) => {
      const isPaid = ["completed", "payment received", "paid"].includes(
        (a.status || "").toLowerCase(),
      );
      if (!isPaid) return;
      const d = new Date(a.jobs?.weddings?.date || a.created_at);
      if (!isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear) {
        const m = d.getMonth();
        monthlyMap[m].cogs += Number(a.jobs?.pay_rate) || 0;
      }
    });

    weddings.forEach((w: any) => {
      const isPaid = (w.editor_invoice_status || "").toLowerCase() === "paid";
      const amount = Number(w.editor_payout_amount) || 0;
      const d = new Date(w.date || w.created_at);
      if (
        isPaid &&
        amount > 0 &&
        !isNaN(d.getTime()) &&
        d.getFullYear().toString() === selectedYear
      ) {
        const m = d.getMonth();
        monthlyMap[m].cogs += amount;
      }
    });

    // Map Meta Ad Spend to monthly breakdown (non-excluded campaigns)
    fbCampaigns.forEach((c: any) => {
      if (excludedIds.includes(c.id)) return;
      if (Array.isArray(c.dailyBreakdown) && c.dailyBreakdown.length > 0) {
        c.dailyBreakdown.forEach((daily: any) => {
          if (!daily.date) return;
          const d = new Date(daily.date);
          if (
            !isNaN(d.getTime()) &&
            d.getFullYear().toString() === selectedYear
          ) {
            const m = d.getMonth();
            monthlyMap[m].opex += Number(daily.spend) || 0;
          }
        });
      } else {
        const campSpend = Number(c.spend) || 0;
        if (campSpend > 0) {
          const nowMonth = new Date().getMonth();
          monthlyMap[nowMonth].opex += campSpend;
        }
      }
    });

    // Map Manual OPEX (including recurring months)
    expandedManualExpensesList.forEach((e) => {
      const d = new Date(e.displayDate);
      if (!isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear) {
        const m = d.getMonth();
        monthlyMap[m].opex += e.amount;
      }
    });

    // Map Royalty & Payback to monthly breakdown
    (royaltyPeriods as any[]).forEach((p) => {
      const charged =
        p.status === "paid" || p.status === "failed" || !!p.paid_at;
      if (!charged) return;
      const d = new Date(p.paid_at || p.period_end || p.period_start);
      if (!isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear) {
        const m = d.getMonth();
        monthlyMap[m].royalty +=
          (Number(p.royalty_amount) || 0) + (Number(p.payback_amount) || 0);
      }
    });

    // Compute net profit per month
    const chartData = Object.values(monthlyMap).map((m) => ({
      ...m,
      profit: m.revenue - m.cogs - m.opex - m.royalty,
    }));

    return {
      grossRevenue,
      totalRefunds,
      netRevenue,
      contractorCogs,
      editorCogs,
      totalCogs,
      grossProfit,
      grossMargin,
      metaAdSpend,
      manualOpexTotal,
      totalOpex,
      royaltyPaid,
      paybackPaid,
      totalRoyaltyPayback,
      royaltyRows,
      netIncome,
      netMargin,
      clientRevenueRows,
      refundRows,
      contractorRows,
      editorRows,
      filteredManualExpenses: expandedManualExpensesList,
      chartData,
    };
  }, [
    weddings,
    assignments,
    settings,
    fbCampaigns,
    manualExpenses,
    selectedYear,
    selectedPeriod,
    royaltyPeriods,
  ]);

  // Export CSV Ledger
  const handleExportCSV = () => {
    const rows = [
      ["FINANCIAL STATEMENT", `${selectedYear} ${selectedPeriod}`],
      ["Generated On", new Date().toLocaleDateString()],
      [""],
      ["INCOME / REVENUE", ""],
      ["Client Collections", ledger.grossRevenue.toFixed(2)],
      [
        "Less: Client Refunds (Cancelled Weddings)",
        `(-${ledger.totalRefunds.toFixed(2)})`,
      ],
      ["NET REVENUE", ledger.netRevenue.toFixed(2)],
      [""],
      ["COST OF GOODS SOLD (COGS)", ""],
      ["Contractor Shooter Pay", ledger.contractorCogs.toFixed(2)],
      ["Post-Production Editor Invoices", ledger.editorCogs.toFixed(2)],
      ["TOTAL COGS", ledger.totalCogs.toFixed(2)],
      ["GROSS PROFIT", ledger.grossProfit.toFixed(2)],
      [""],
      ["OPERATING EXPENSES (OPEX)", ""],
      ["Meta / Facebook Ad Spend", ledger.metaAdSpend.toFixed(2)],
      ["Manual Operational Expenses", ledger.manualOpexTotal.toFixed(2)],
      ["TOTAL OPERATING EXPENSES", ledger.totalOpex.toFixed(2)],
      [""],
      ["ROYALTY & PAYBACK", ""],
      ["Royalty (Franchise)", ledger.royaltyPaid.toFixed(2)],
      ["Payback (Territory Buyback)", ledger.paybackPaid.toFixed(2)],
      ["TOTAL ROYALTY & PAYBACK", ledger.totalRoyaltyPayback.toFixed(2)],
      [""],
      ["NET OPERATING INCOME", ledger.netIncome.toFixed(2)],
      ["NET PROFIT MARGIN", `${ledger.netMargin.toFixed(1)}%`],
    ];

    const csvContent = rows
      .map((e) => e.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Veydra_Accounting_Ledger_${selectedYear}_${selectedPeriod}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading =
    isLoadingWeddings || isLoadingAssignments || isLoadingSettings;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-emerald-600" /> Accounting &
            Profit Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Enterprise Profit & Loss (P&L), Cost of Goods Sold (COGS),
            contractor payouts, and operating expenses. Restricted to Owners and
            Super Admins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[110px] rounded-full text-xs font-semibold shadow-sm">
              <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent rounded-xl>
              {["2026", "2025", "2024"].map((yr) => (
                <SelectItem key={yr} value={yr}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Period Selector */}
          <Select
            value={selectedPeriod}
            onValueChange={(v: any) => setSelectedYearPeriod(v)}
          >
            <SelectTrigger className="w-[120px] rounded-full text-xs font-semibold shadow-sm">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent rounded-xl>
              <SelectItem value="all">Full Year</SelectItem>
              <SelectItem value="Q1">Q1 (Jan–Mar)</SelectItem>
              <SelectItem value="Q2">Q2 (Apr–Jun)</SelectItem>
              <SelectItem value="Q3">Q3 (Jul–Sep)</SelectItem>
              <SelectItem value="Q4">Q4 (Oct–Dec)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-full shadow-sm"
          >
            <Download className="h-4 w-4 mr-1.5" /> Export Ledger CSV
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setIsAddExpenseOpen(true)}
            className="rounded-full shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Log Expense
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Gross Revenue */}
        <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Gross Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              $
              {ledger.netRevenue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ledger.totalRefunds > 0
                ? `Net of $${ledger.totalRefunds.toLocaleString()} refunds`
                : "Client deposits & collections"}
            </p>
          </CardContent>
        </Card>

        {/* Cost of Goods Sold */}
        <Card className="shadow-sm border-border/40 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/20">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              COGS (Labor)
            </CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
              $
              {ledger.totalCogs.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              Shooter pay + editor invoices
            </p>
          </CardContent>
        </Card>

        {/* Operating Expenses */}
        <Card className="shadow-sm border-border/40 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/20">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              OPEX (Ad Spend & Ops)
            </CardTitle>
            <Receipt className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-purple-600 dark:text-purple-400">
              $
              {ledger.totalOpex.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">
              Meta Ads + software & ops
            </p>
          </CardContent>
        </Card>

        {/* Net Income */}
        <Card
          className={`shadow-sm border-border/40 rounded-2xl ${
            ledger.netIncome >= 0
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
          }`}
        >
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider">
              Net Operating Income
            </CardTitle>
            {ledger.netIncome >= 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              $
              {ledger.netIncome.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs font-semibold mt-1 opacity-90">
              Net Margin: {ledger.netMargin.toFixed(1)}% | Gross Margin:{" "}
              {ledger.grossMargin.toFixed(1)}%
            </p>
            {ledger.totalRoyaltyPayback > 0 && (
              <p className="text-[11px] mt-0.5 opacity-75">
                After ${ledger.totalRoyaltyPayback.toLocaleString()} royalty &
                payback
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(v: any) => setActiveTab(v)}
        className="space-y-6"
      >
        <TabsList className="bg-muted/50 p-1 rounded-full border border-border/40 inline-flex">
          <TabsTrigger
            value="overview"
            className="rounded-full text-xs font-semibold px-4"
          >
            <PieIcon className="h-3.5 w-3.5 mr-1.5" /> Profit Overview & Chart
          </TabsTrigger>
          <TabsTrigger
            value="pnl"
            className="rounded-full text-xs font-semibold px-4"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" /> P&L Statement
          </TabsTrigger>
          <TabsTrigger
            value="expenses"
            className="rounded-full text-xs font-semibold px-4"
          >
            <Receipt className="h-3.5 w-3.5 mr-1.5" /> Operating Expenses (
            {ledger.filteredManualExpenses.length +
              (ledger.metaAdSpend > 0 ? 1 : 0)}
            )
          </TabsTrigger>
          <TabsTrigger
            value="contractors"
            className="rounded-full text-xs font-semibold px-4"
          >
            <Users className="h-3.5 w-3.5 mr-1.5" /> Contractor & Editor COGS
          </TabsTrigger>
          {ledger.totalRoyaltyPayback > 0 && (
            <TabsTrigger
              value="royalty"
              className="rounded-full text-xs font-semibold px-4"
            >
              <Briefcase className="h-3.5 w-3.5 mr-1.5" /> Royalty & Payback (
              {ledger.royaltyRows.length})
            </TabsTrigger>
          )}
          {ledger.totalRefunds > 0 && (
            <TabsTrigger
              value="refunds"
              className="rounded-full text-xs font-semibold px-4"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Refunds (
              {ledger.refundRows.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Visual Profit Chart Overview */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
            <CardHeader className="p-5 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">
                  Monthly Revenue vs. Costs Breakdown ({selectedYear})
                </CardTitle>
                <CardDescription className="text-xs">
                  Compare gross client revenue against labor (COGS) and
                  operating expenses (OPEX) month by month.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ledger.chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(val) => `$${val}`}
                      />
                      <RechartsTooltip
                        formatter={(value: any) => [
                          `$${Number(value).toLocaleString()}`,
                          "",
                        ]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }}
                      />
                      <Bar
                        dataKey="revenue"
                        name="Gross Revenue"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="cogs"
                        name="COGS (Labor)"
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="opex"
                        name="OPEX (Ads & Software)"
                        fill="#a855f7"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="royalty"
                        name="Royalty & Payback"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="profit"
                        name="Net Operating Profit"
                        fill="#0ea5e9"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Formal Profit & Loss Statement */}
        <TabsContent value="pnl">
          <Card className="shadow-sm border-border/40 rounded-2xl overflow-hidden bg-card">
            <CardHeader className="p-5 pb-3 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-lg font-bold">
                Income & Expense Statement (P&L)
              </CardTitle>
              <CardDescription className="text-xs">
                Detailed financial statement for {selectedYear} (
                {selectedPeriod === "all" ? "Full Year" : selectedPeriod})
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold text-foreground">
                      Category / Line Item
                    </TableHead>
                    <TableHead className="font-bold text-foreground text-right pr-8">
                      Amount ($)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-sm">
                  {/* GROSS REVENUE */}
                  <TableRow className="bg-emerald-500/5 font-bold">
                    <TableCell className="text-emerald-700 dark:text-emerald-400">
                      1. GROSS REVENUE (Client Collections)
                    </TableCell>
                    <TableCell className="text-right pr-8 text-emerald-700 dark:text-emerald-400 text-base">
                      $
                      {ledger.grossRevenue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground text-xs">
                      Direct Client Deposits & Contract Payments
                    </TableCell>
                    <TableCell className="text-right pr-8 text-xs font-medium">
                      $
                      {ledger.grossRevenue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  {ledger.totalRefunds > 0 && (
                    <>
                      <TableRow>
                        <TableCell className="pl-8 text-red-600 dark:text-red-400 text-xs">
                          Less: Client Refunds (Cancelled Weddings)
                        </TableCell>
                        <TableCell className="text-right pr-8 text-xs font-medium text-red-600 dark:text-red-400">
                          -$
                          {ledger.totalRefunds.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-emerald-500/5 font-bold border-t">
                        <TableCell className="text-emerald-700 dark:text-emerald-400">
                          NET REVENUE
                        </TableCell>
                        <TableCell className="text-right pr-8 text-emerald-700 dark:text-emerald-400">
                          $
                          {ledger.netRevenue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    </>
                  )}

                  {/* COGS */}
                  <TableRow className="bg-amber-500/5 font-bold">
                    <TableCell className="text-amber-700 dark:text-amber-400">
                      2. COST OF GOODS SOLD (COGS / Labor)
                    </TableCell>
                    <TableCell className="text-right pr-8 text-amber-700 dark:text-amber-400 text-base">
                      $
                      {ledger.totalCogs.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground text-xs">
                      Contractor Shooter Payouts (Lead & 2nd Shooters)
                    </TableCell>
                    <TableCell className="text-right pr-8 text-xs font-medium">
                      $
                      {ledger.contractorCogs.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground text-xs">
                      Post-Production Editor Invoices
                    </TableCell>
                    <TableCell className="text-right pr-8 text-xs font-medium">
                      $
                      {ledger.editorCogs.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>

                  {/* GROSS PROFIT */}
                  <TableRow className="bg-muted/30 font-extrabold border-t border-b">
                    <TableCell className="text-foreground">
                      GROSS OPERATING PROFIT
                    </TableCell>
                    <TableCell className="text-right pr-8 text-foreground text-base">
                      $
                      {ledger.grossProfit.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>

                  {/* OPEX */}
                  <TableRow className="bg-purple-500/5 font-bold">
                    <TableCell className="text-purple-700 dark:text-purple-400">
                      3. OPERATING EXPENSES (OPEX)
                    </TableCell>
                    <TableCell className="text-right pr-8 text-purple-700 dark:text-purple-400 text-base">
                      $
                      {ledger.totalOpex.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground text-xs">
                      Meta / Facebook Marketing & Ad Spend
                    </TableCell>
                    <TableCell className="text-right pr-8 text-xs font-medium">
                      $
                      {ledger.metaAdSpend.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground text-xs">
                      Software, Travel, Gear & Manual Expenses
                    </TableCell>
                    <TableCell className="text-right pr-8 text-xs font-medium">
                      $
                      {ledger.manualOpexTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>

                  {/* ROYALTY & PAYBACK */}
                  <TableRow className="bg-blue-500/5 font-bold">
                    <TableCell className="text-blue-700 dark:text-blue-400">
                      4. ROYALTY & PAYBACK (Franchise Collections)
                    </TableCell>
                    <TableCell className="text-right pr-8 text-blue-700 dark:text-blue-400 text-base">
                      $
                      {ledger.totalRoyaltyPayback.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground text-xs">
                      Royalty (Franchise Fee % of Sales)
                    </TableCell>
                    <TableCell className="text-right pr-8 text-xs font-medium">
                      $
                      {ledger.royaltyPaid.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground text-xs">
                      Payback (Territory Buyback)
                    </TableCell>
                    <TableCell className="text-right pr-8 text-xs font-medium">
                      $
                      {ledger.paybackPaid.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>

                  {/* NET INCOME */}
                  <TableRow className="bg-primary/10 font-extrabold text-base border-t border-b">
                    <TableCell className="text-foreground">
                      NET OPERATING INCOME
                    </TableCell>
                    <TableCell className="text-right pr-8 text-foreground text-lg">
                      $
                      {ledger.netIncome.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Royalty & Payback Breakdown */}
        <TabsContent value="royalty" className="space-y-4">
          <Card className="shadow-sm border-border/40 rounded-2xl overflow-hidden bg-card">
            <CardHeader className="p-5 pb-3 border-b border-border/40 bg-muted/20">
              <CardTitle className="text-lg font-bold">
                Royalty & Payback Collections
              </CardTitle>
              <CardDescription className="text-xs">
                Real money collected from the business for franchise royalty and
                territory buyback, by period. Only charged periods are shown.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold text-foreground">
                      Period
                    </TableHead>
                    <TableHead className="font-bold text-foreground">
                      Collected On
                    </TableHead>
                    <TableHead className="font-bold text-foreground text-right">
                      Royalty
                    </TableHead>
                    <TableHead className="font-bold text-foreground text-right">
                      Payback
                    </TableHead>
                    <TableHead className="font-bold text-foreground text-right pr-8">
                      Total
                    </TableHead>
                    <TableHead className="font-bold text-foreground text-right pr-8">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-sm">
                  {ledger.royaltyRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No royalty or payback collected in this period yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledger.royaltyRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">
                          {r.period}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.date}
                        </TableCell>
                        <TableCell className="text-right">
                          $
                          {r.royalty.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          $
                          {r.payback.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right pr-8 font-semibold">
                          $
                          {r.total.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <Badge
                            variant={
                              r.status === "paid"
                                ? "default"
                                : r.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Operating Expenses List & Manual Entries */}
        <TabsContent value="expenses" className="space-y-4">
          <Card className="shadow-sm border-border/40 rounded-2xl overflow-hidden bg-card">
            <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">
                  Operating Expenses & Vendor Receipts
                </CardTitle>
                <CardDescription className="text-xs">
                  Includes live Meta Ad spend and logged operational expenses
                  for {selectedYear}.
                </CardDescription>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsAddExpenseOpen(true)}
                className="rounded-full shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Custom Expense
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">
                      Vendor / Source
                    </TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold text-right pr-6">
                      Amount
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Meta Ad Spend Row */}
                  {fbCampaigns.length > 0 ? (
                    fbCampaigns.map((camp: any) => {
                      const isExcluded = (
                        settings?.excluded_campaign_ids || []
                      ).includes(camp.id);
                      return (
                        <TableRow
                          key={camp.id}
                          className={
                            isExcluded
                              ? "opacity-50 bg-muted/10"
                              : "bg-purple-500/5"
                          }
                        >
                          <TableCell className="font-medium text-xs">
                            Live Meta Sync
                          </TableCell>
                          <TableCell className="font-semibold text-xs flex items-center gap-1.5">
                            <Megaphone className="h-3.5 w-3.5 text-purple-600" />{" "}
                            {camp.name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="rounded-full text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20"
                            >
                              Marketing
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {isExcluded
                              ? "Campaign excluded in Settings"
                              : `Status: ${camp.status} | Clicks: ${camp.clicks || 0} | Leads: ${camp.conversions || 0}`}
                          </TableCell>
                          <TableCell className="text-right pr-6 font-bold text-xs">
                            $
                            {(Number(camp.spend) || 0).toLocaleString(
                              undefined,
                              { minimumFractionDigits: 2 },
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] rounded-full ${isExcluded ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}
                            >
                              {isExcluded ? "Excluded" : "Auto-Synced"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : settings?.fb_access_token ? (
                    <TableRow className="bg-purple-500/5">
                      <TableCell
                        colSpan={6}
                        className="text-center p-4 text-xs text-muted-foreground"
                      >
                        Connected to Meta Ad Account. Fetching campaigns for{" "}
                        {selectedYear}...
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow className="bg-amber-500/5">
                      <TableCell
                        colSpan={6}
                        className="text-center p-4 text-xs text-amber-700 dark:text-amber-400"
                      >
                        Meta Ad Account is not connected. Add your Meta Access
                        Token and Ad Account ID in <strong>Settings</strong> to
                        auto-sync live ad spend.
                      </TableCell>
                    </TableRow>
                  )}

                  {ledger.filteredManualExpenses.map((exp, idx) => (
                    <TableRow
                      key={`${exp.id}_${exp.displayDate}_${idx}`}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <TableCell className="font-medium text-xs">
                        {formatDisplayDate(exp.displayDate)}
                      </TableCell>
                      <TableCell className="font-semibold text-xs flex items-center gap-1.5">
                        {exp.vendor}
                        {exp.is_recurring && (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/20 px-1.5 py-0 rounded-md"
                          >
                            Monthly Recurring
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-full text-[10px]"
                        >
                          {exp.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {exp.description || "N/A"}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-bold text-xs">
                        $
                        {exp.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteExpense(exp.id)}
                          title="Delete expense entry"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600 rounded-full"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {ledger.metaAdSpend === 0 &&
                    ledger.filteredManualExpenses.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center p-8 text-muted-foreground text-xs"
                        >
                          No operating expenses logged for this period. Click
                          "Add Custom Expense" above to add software, travel,
                          gear, or office costs.
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Contractor & Editor COGS Breakdown */}
        <TabsContent value="contractors" className="space-y-4">
          <Card className="shadow-sm border-border/40 rounded-2xl overflow-hidden bg-card">
            <CardHeader className="p-5 pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold">
                Contractor & Editor Pay (COGS)
              </CardTitle>
              <CardDescription className="text-xs">
                Direct cost of labor associated with weddings in {selectedYear}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">
                      Recipient / Name
                    </TableHead>
                    <TableHead className="font-semibold">
                      Role / Wedding
                    </TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold text-right pr-6">
                      Paid Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.contractorRows.map((c) => (
                    <TableRow
                      key={c.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-full text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20"
                        >
                          Shooter Payout
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-xs">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.role} — {c.wedding}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.date}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-bold text-xs text-amber-600">
                        $
                        {c.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}

                  {ledger.editorRows.map((e) => (
                    <TableRow
                      key={e.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-full text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20"
                        >
                          Editor Invoice
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-xs">
                        Post-Production Editor
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Video Editing — {e.client}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.date}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-bold text-xs text-blue-600">
                        $
                        {e.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}

                  {ledger.contractorRows.length === 0 &&
                    ledger.editorRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center p-8 text-muted-foreground text-xs"
                        >
                          No contractor or editor payouts recorded for{" "}
                          {selectedYear}.
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Refunds from Cancelled Weddings */}
        <TabsContent value="refunds" className="space-y-4">
          <Card className="shadow-sm border-border/40 rounded-2xl overflow-hidden bg-card">
            <CardHeader className="p-5 pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-red-500" /> Client Refunds
                (Cancelled Weddings)
              </CardTitle>
              <CardDescription className="text-xs">
                Refunds processed for cancelled weddings in {selectedYear}.
                These reduce gross revenue in the P&L.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold">Client</TableHead>
                    <TableHead className="font-semibold">Refund Date</TableHead>
                    <TableHead className="font-semibold">Reason</TableHead>
                    <TableHead className="font-semibold text-right pr-6">
                      Refund Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.refundRows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <TableCell className="font-semibold text-xs">
                        {r.client}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.date}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {r.reason}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-bold text-xs text-red-600">
                        -$
                        {r.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {ledger.refundRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center p-8 text-muted-foreground text-xs"
                      >
                        No refunds processed for {selectedYear}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {ledger.refundRows.length > 0 && (
                <div className="p-4 border-t border-border/40 flex justify-between items-center bg-red-500/5">
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    Total Refunds
                  </span>
                  <span className="text-lg font-extrabold text-red-600 dark:text-red-400">
                    -$
                    {ledger.totalRefunds.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Add Expense */}
      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Plus className="h-5 w-5 text-primary" /> Log Operational Expense
            </DialogTitle>
            <DialogDescription>
              Record manual business expenses such as software tools, travel,
              equipment, or office supplies.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddExpense} className="space-y-4 py-2">
            {/* Recurring Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/40">
              <div>
                <label className="text-xs font-bold text-foreground block">
                  Monthly Recurring Expense
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Applies automatically every month on or after the start date.
                </p>
              </div>
              <input
                type="checkbox"
                checked={newExpense.is_recurring}
                onChange={(e) =>
                  setNewExpense({
                    ...newExpense,
                    is_recurring: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
            </div>

            {newExpense.is_recurring ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={newExpense.start_date}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        start_date: e.target.value,
                      })
                    }
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    End Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={newExpense.end_date}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, end_date: e.target.value })
                    }
                    className="rounded-xl"
                    placeholder="Leave empty for ongoing"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Expense Date
                </label>
                <Input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, date: e.target.value })
                  }
                  className="rounded-xl"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Category
              </label>
              <Select
                value={newExpense.category}
                onValueChange={(val: any) =>
                  setNewExpense({ ...newExpense, category: val })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent rounded-xl>
                  <SelectItem value="Software/Tools">
                    Software / SaaS / Subscriptions
                  </SelectItem>
                  <SelectItem value="Marketing">
                    Marketing / Ads / Branding
                  </SelectItem>
                  <SelectItem value="Travel/Mileage">
                    Travel / Mileage / Gas
                  </SelectItem>
                  <SelectItem value="Equipment">
                    Camera & Production Gear
                  </SelectItem>
                  <SelectItem value="Office/Admin">
                    Office & Administrative
                  </SelectItem>
                  <SelectItem value="Other">Other Expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Vendor / Payee
              </label>
              <Input
                placeholder="e.g. Adobe, Google Workspace, Airlines, Best Buy"
                value={newExpense.vendor}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, vendor: e.target.value })
                }
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Expense Amount ($)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newExpense.amount}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, amount: e.target.value })
                }
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Description (Optional)
              </label>
              <Input
                placeholder="Details or receipt notes"
                value={newExpense.description}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, description: e.target.value })
                }
                className="rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddExpenseOpen(false)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={updateSettingsMutation.isPending}
                className="rounded-full"
              >
                {updateSettingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Save Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
