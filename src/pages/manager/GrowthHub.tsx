import { useState, useMemo, lazy, Suspense } from "react";
const MarketMap = lazy(() => import("@/components/MarketMap"));
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Megaphone,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Activity,
  Calendar as CalendarIcon,
  BarChart3,
  PieChart as PieChartIcon,
  UserPlus,
  Award,
  Filter,
  Layers,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  MousePointerClick,
  Info,
  MapPin,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { formatDisplayDate } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function GrowthHub() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [leadTagFilter, setLeadTagFilter] = useState<"all" | "new">("all");
  const [dateRangePreset, setDateRangePreset] = useState<
    | "all"
    | "today"
    | "yesterday"
    | "last_7"
    | "this_month"
    | "last_30"
    | "last_90"
    | "this_year"
    | "custom"
  >("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [chartGranularity, setChartGranularity] = useState<
    "auto" | "daily" | "weekly" | "monthly"
  >("auto");
  const { data: portalSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getPortalSettings,
  });

  const excludedCampaignIds = useMemo(() => {
    if (
      portalSettings?.excluded_campaign_ids &&
      Array.isArray(portalSettings.excluded_campaign_ids)
    ) {
      return portalSettings.excluded_campaign_ids;
    }
    try {
      const saved = localStorage.getItem("veydra_excluded_campaign_ids");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [portalSettings]);

  const toggleCampaignExclusion = async (id: string) => {
    const updated = excludedCampaignIds.includes(id)
      ? excludedCampaignIds.filter((x: string) => x !== id)
      : [...excludedCampaignIds, id];
    try {
      localStorage.setItem(
        "veydra_excluded_campaign_ids",
        JSON.stringify(updated),
      );
    } catch (e) {}
    try {
      await api.updatePortalSettings({ excluded_campaign_ids: updated });
    } catch (e) {
      console.error("Failed to save excluded campaigns to database", e);
    }
  };

  // Queries
  const {
    data: weddings = [],
    isLoading: loadingWeddings,
    refetch: refetchWeddings,
  } = useQuery({
    queryKey: ["growth-weddings"],
    queryFn: api.getWeddings,
  });

  const {
    data: proposals = [],
    isLoading: loadingProposals,
    refetch: refetchProposals,
  } = useQuery({
    queryKey: ["growth-proposals"],
    queryFn: api.getProposals,
  });

  // Date Range Calculation
  const { startDate, endDate, datePresetParam } = useMemo(() => {
    const now = new Date();
    if (dateRangePreset === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, datePresetParam: "today" };
    }
    if (dateRangePreset === "yesterday") {
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, datePresetParam: "yesterday" };
    }
    if (dateRangePreset === "last_7") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, datePresetParam: "last_7d" };
    }
    if (dateRangePreset === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
      return { startDate: start, endDate: end, datePresetParam: "this_month" };
    }
    if (dateRangePreset === "last_30") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, datePresetParam: "last_30d" };
    }
    if (dateRangePreset === "last_90") {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, datePresetParam: "last_90d" };
    }
    if (dateRangePreset === "this_year") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { startDate: start, endDate: end, datePresetParam: "this_year" };
    }
    if (dateRangePreset === "custom") {
      const start = customStartDate
        ? new Date(customStartDate + "T00:00:00")
        : null;
      const end = customEndDate ? new Date(customEndDate + "T23:59:59") : null;
      return { startDate: start, endDate: end, datePresetParam: null };
    }
    return { startDate: null, endDate: null, datePresetParam: "maximum" };
  }, [dateRangePreset, customStartDate, customEndDate]);

  const {
    data: campaigns = [],
    isLoading: loadingCampaigns,
    error: campaignsError,
    refetch: refetchCampaigns,
  } = useQuery({
    queryKey: [
      "fb-ads-campaigns",
      dateRangePreset,
      customStartDate,
      customEndDate,
    ],
    queryFn: () =>
      api.getFacebookAdsCampaigns(
        datePresetParam,
        startDate ? startDate.toISOString().split("T")[0] : undefined,
        endDate ? endDate.toISOString().split("T")[0] : undefined,
      ),
    retry: false,
  });

  const {
    data: leads = [],
    isLoading: loadingLeads,
    error: leadsError,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ["ovanta-leads", leadTagFilter],
    queryFn: () =>
      api.getOvantaLeads(leadTagFilter === "new" ? "new lead" : undefined),
    retry: false,
  });

  const handleSyncAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchWeddings(),
      refetchProposals(),
      refetchCampaigns(),
      refetchLeads(),
    ]);
    setIsRefreshing(false);
  };

  const isDateInRange = (dateVal?: string | Date | null) => {
    if (!startDate && !endDate) return true;
    if (!dateVal) return false;
    let d: Date;
    if (
      typeof dateVal === "string" &&
      dateVal.length === 10 &&
      dateVal.includes("-")
    ) {
      const [y, m, dayNum] = dateVal.split("-").map(Number);
      d = new Date(y, m - 1, dayNum);
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return false;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // Raw list
  const allBookedWeddings = Array.isArray(weddings)
    ? weddings.filter(
        (w) =>
          !w.notes?.includes("[UNPAID_DRAFT]") &&
          w.status !== "draft" &&
          w.status !== "cancelled" &&
          (w.status === "upcoming" ||
            w.status === "completed" ||
            w.status === "pending"),
      )
    : [];

  // Filtered lists by Date Range
  const bookedWeddings = useMemo(() => {
    return allBookedWeddings.filter((w) =>
      isDateInRange(w.contract_date || w.created_at || w.date),
    );
  }, [allBookedWeddings, startDate, endDate]);

  const filteredProposals = useMemo(() => {
    return (Array.isArray(proposals) ? proposals : []).filter((p) =>
      isDateInRange(p.created_at || p.wedding_date),
    );
  }, [proposals, startDate, endDate]);

  // Dynamic Lead Correlation with Weddings & Speed Calculation
  const leadsWithBookingData = useMemo(() => {
    const rawList = Array.isArray(leads) ? leads : [];
    return rawList.map((lead) => {
      // Find matching booked wedding by email or client name
      const matchedWedding = allBookedWeddings.find((w) => {
        const leadEmail = (lead.email || "").toLowerCase().trim();
        const weddingEmail = ((w as any).email || "").toLowerCase().trim();
        if (leadEmail && weddingEmail && leadEmail === weddingEmail)
          return true;

        const leadName = (lead.name || "").toLowerCase().trim();
        const clientName = (w.client_name || "").toLowerCase().trim();
        if (
          leadName &&
          clientName &&
          (leadName.includes(clientName) || clientName.includes(leadName))
        )
          return true;

        return false;
      });

      const matchedProposal = (proposals || []).find((p) => {
        const leadEmail = (lead.email || "").toLowerCase().trim();
        const propEmail = (p.email || "").toLowerCase().trim();
        if (leadEmail && propEmail && leadEmail === propEmail) return true;

        const leadName = (lead.name || "").toLowerCase().trim();
        const propName = (p.couple_names || "").toLowerCase().trim();
        if (leadName && propName && propName.includes(leadName)) return true;

        return false;
      });

      let status = lead.status;
      let leadToBookingDays: number | null = null;
      let bookedAmount = 0;

      if (matchedWedding) {
        status = "Booked";
        bookedAmount = matchedWedding.total_amount || 0;

        const leadDate = new Date(lead.date || lead.created_at);
        const bookedDate = new Date(
          matchedWedding.contract_date ||
            matchedWedding.created_at ||
            matchedWedding.date,
        );
        if (!isNaN(leadDate.getTime()) && !isNaN(bookedDate.getTime())) {
          const diffTime = bookedDate.getTime() - leadDate.getTime();
          leadToBookingDays = Math.max(
            0,
            Math.round(diffTime / (1000 * 60 * 60 * 24)),
          );
        }
      } else if (matchedProposal) {
        status = "Proposal Sent";
      }

      return {
        ...lead,
        status,
        matchedWedding,
        matchedProposal,
        leadToBookingDays,
        bookedAmount,
      };
    });
  }, [leads, allBookedWeddings, proposals]);

  const leadsList = useMemo(() => {
    return leadsWithBookingData.filter((l) =>
      isDateInRange(l.date || l.created_at),
    );
  }, [leadsWithBookingData, startDate, endDate]);

  // Average Lead-to-Booking Time
  const bookedLeadsWithDays = leadsWithBookingData.filter(
    (l) => l.status === "Booked" && l.leadToBookingDays !== null,
  );
  const avgLeadToBookingDays =
    bookedLeadsWithDays.length > 0
      ? Math.round(
          bookedLeadsWithDays.reduce(
            (acc, curr) => acc + (curr.leadToBookingDays || 0),
            0,
          ) / bookedLeadsWithDays.length,
        )
      : null;

  const totalBookedValue = bookedWeddings.reduce(
    (sum, w) => sum + (w.total_amount || 0),
    0,
  );
  const totalCollectedRevenue = bookedWeddings.reduce(
    (sum, w) => sum + (w.paid_amount || 0),
    0,
  );
  const totalProposalsValue = filteredProposals.reduce(
    (sum, p) => sum + (p.total_amount || 0),
    0,
  );

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
  const rawCampaignsList = Array.isArray(campaigns) ? campaigns : [];
  const validCampaigns = rawCampaignsList.filter(
    (c) => !excludedCampaignIds.includes(c.id),
  );
  const totalAdSpend = validCampaigns.reduce(
    (sum, c) => sum + (c.spend || 0),
    0,
  );
  const totalAdConversions = validCampaigns.reduce(
    (sum, c) => sum + (c.conversions || 0),
    0,
  );

  // Conversion rate: Booked Weddings / Total Inquiries (Leads + Proposals + Weddings)
  // Conversion rate & Funnel — use REAL filtered counts, not raw array lengths
  const leadsCount = leadsList.length; // already filtered by date range
  const proposalsCount = filteredProposals.length;
  const totalInquiries = Math.max(
    leadsCount + proposalsCount + bookedWeddings.length,
    1,
  );
  const conversionRate =
    bookedWeddings.length > 0
      ? ((bookedWeddings.length / totalInquiries) * 100).toFixed(1)
      : "0.0";

  // Average Booking Value
  const avgBookingValue =
    bookedWeddings.length > 0 ? totalBookedValue / bookedWeddings.length : 0;

  // Estimated Customer Acquisition Cost (CAC)
  const estimatedCAC =
    bookedWeddings.length > 0 && totalAdSpend > 0
      ? totalAdSpend / bookedWeddings.length
      : totalAdConversions > 0
        ? totalAdSpend / totalAdConversions
        : 0;

  // Overall Marketing ROAS
  const overallROAS =
    totalAdSpend > 0 ? (totalBookedValue / totalAdSpend).toFixed(2) : "N/A";

  // Chart Data: Funnel Breakdown — show actual numbers or 0 (never fake minimum of 1)
  const funnelData = [
    { stage: "New Inquiries", count: leadsCount || 0, fill: "#3b82f6" },
    { stage: "Proposals Sent", count: proposalsCount || 0, fill: "#8b5cf6" },
    {
      stage: "Contracts Booked",
      count: bookedWeddings.length || 0,
      fill: "#10b981",
    },
  ];

  // Dynamic Lead Sources Breakdown from CRM Leads
  const sourceCounts: Record<string, number> = {};
  leadsList.forEach((l) => {
    const src = l.source || "Direct / Website";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  const colorPalette = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ec4899",
    "#8b5cf6",
    "#06b6d4",
  ];
  const sourceDistribution =
    Object.keys(sourceCounts).length > 0
      ? Object.entries(sourceCounts).map(([name, value], idx) => ({
          name,
          value,
          color: colorPalette[idx % colorPalette.length],
        }))
      : [{ name: "Direct / Website", value: 1, color: "#10b981" }];

  // Dynamic Chart Trends grouped by date range selection and granularity
  const chartTrends = useMemo(() => {
    // Collect real daily ad spend breakdown from Meta API insights if available
    const dailyAdSpendMap: Record<string, number> = {};
    validCampaigns.forEach((c: any) => {
      if (Array.isArray(c.dailyBreakdown)) {
        c.dailyBreakdown.forEach((item: any) => {
          if (item.date) {
            dailyAdSpendMap[item.date] =
              (dailyAdSpendMap[item.date] || 0) + (item.spend || 0);
          }
        });
      }
    });

    // Determine actual effective granularity:
    // If granularity is 'auto':
    // - Today/Yesterday/Last 7: Daily
    // - Custom range or presets where date span <= 60 days: Daily
    // - Spans 61 - 180 days: Weekly
    // - Spans > 180 days or All Time/This Year: Monthly
    let effectiveGranularity = chartGranularity;
    if (chartGranularity === "auto") {
      if (
        dateRangePreset === "today" ||
        dateRangePreset === "yesterday" ||
        dateRangePreset === "last_7"
      ) {
        effectiveGranularity = "daily";
      } else if (startDate && endDate) {
        const diffDays = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays <= 62) {
          effectiveGranularity = "daily";
        } else if (diffDays <= 180) {
          effectiveGranularity = "weekly";
        } else {
          effectiveGranularity = "monthly";
        }
      } else if (
        dateRangePreset === "this_month" ||
        dateRangePreset === "last_30"
      ) {
        effectiveGranularity = "daily";
      } else if (dateRangePreset === "last_90") {
        effectiveGranularity = "weekly";
      } else {
        effectiveGranularity = "monthly";
      }
    }

    // --- DAILY GROUPING ---
    if (effectiveGranularity === "daily") {
      const dayMap: Record<
        string,
        { label: string; revenue: number; count: number; adSpend: number }
      > = {};

      // Determine date bounds
      let startD: Date;
      let endD: Date;

      if (startDate && endDate) {
        startD = new Date(startDate);
        startD.setHours(0, 0, 0, 0);
        endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
      } else {
        // Fallback for preset short ranges
        const now = new Date();
        endD = new Date(now);
        endD.setHours(23, 59, 59, 999);
        const numDays =
          dateRangePreset === "today" || dateRangePreset === "yesterday"
            ? 1
            : 7;
        const offsetStart = dateRangePreset === "yesterday" ? 1 : 0;
        startD = new Date(
          now.getTime() - (numDays - 1 + offsetStart) * 24 * 60 * 60 * 1000,
        );
        startD.setHours(0, 0, 0, 0);
      }

      const totalDaysInSpan = Math.max(
        Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)),
        1,
      );

      let curr = new Date(startD);
      while (curr <= endD) {
        const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}-${String(curr.getDate()).padStart(2, "0")}`;
        const label = curr.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
        });
        dayMap[key] = {
          label,
          revenue: 0,
          count: 0,
          adSpend:
            dailyAdSpendMap[key] !== undefined
              ? dailyAdSpendMap[key]
              : totalAdSpend > 0
                ? totalAdSpend / totalDaysInSpan
                : 0,
        };
        curr.setDate(curr.getDate() + 1);
      }

      bookedWeddings.forEach((w) => {
        const rawDate = w.contract_date || w.created_at || w.date;
        if (!rawDate) return;
        let d: Date;
        if (
          typeof rawDate === "string" &&
          rawDate.length === 10 &&
          rawDate.includes("-")
        ) {
          const [y, m, dayNum] = rawDate.split("-").map(Number);
          d = new Date(y, m - 1, dayNum);
        } else {
          d = new Date(rawDate);
        }
        if (isNaN(d.getTime())) return;

        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (dayMap[key]) {
          dayMap[key].revenue += w.total_amount || 0;
          dayMap[key].count += 1;
        }
      });

      return Object.entries(dayMap).map(([_, item]) => ({
        label: item.label,
        revenue: item.revenue,
        adSpend: item.adSpend,
        bookings: item.count,
      }));
    }

    // --- WEEKLY GROUPING ---
    if (effectiveGranularity === "weekly") {
      const weekMap: Record<
        string,
        { label: string; revenue: number; count: number; adSpend: number }
      > = {};
      let startD = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      let endD = endDate ? new Date(endDate) : new Date();

      let curr = new Date(startD);
      while (curr <= endD) {
        const weekStart = new Date(curr);
        const weekEnd = new Date(curr.getTime() + 6 * 24 * 60 * 60 * 1000);
        const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
        const label = `${weekStart.toLocaleString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleString("en-US", { month: "short", day: "numeric" })}`;
        weekMap[key] = { label, revenue: 0, count: 0, adSpend: 0 };
        curr.setDate(curr.getDate() + 7);
      }

      // Aggregate ad spend by week
      Object.entries(dailyAdSpendMap).forEach(([dateStr, spendVal]) => {
        const [y, m, dayNum] = dateStr.split("-").map(Number);
        const itemD = new Date(y, m - 1, dayNum);
        Object.keys(weekMap).forEach((k) => {
          const [wy, wm, wd] = k.split("-").map(Number);
          const wStart = new Date(wy, wm - 1, wd);
          const wEnd = new Date(wStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          if (itemD >= wStart && itemD < wEnd) {
            weekMap[k].adSpend += spendVal;
          }
        });
      });

      bookedWeddings.forEach((w) => {
        const rawDate = w.contract_date || w.created_at || w.date;
        if (!rawDate) return;
        let d: Date;
        if (
          typeof rawDate === "string" &&
          rawDate.length === 10 &&
          rawDate.includes("-")
        ) {
          const [y, m, dayNum] = rawDate.split("-").map(Number);
          d = new Date(y, m - 1, dayNum);
        } else {
          d = new Date(rawDate);
        }
        if (isNaN(d.getTime())) return;

        Object.keys(weekMap).forEach((k) => {
          const [wy, wm, wd] = k.split("-").map(Number);
          const wStart = new Date(wy, wm - 1, wd);
          const wEnd = new Date(wStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          if (d >= wStart && d < wEnd) {
            weekMap[k].revenue += w.total_amount || 0;
            weekMap[k].count += 1;
          }
        });
      });

      const keys = Object.keys(weekMap);
      return Object.entries(weekMap).map(([_, item]) => ({
        label: item.label,
        revenue: item.revenue,
        adSpend:
          item.adSpend > 0
            ? item.adSpend
            : totalAdSpend > 0
              ? totalAdSpend / Math.max(keys.length, 1)
              : 0,
        bookings: item.count,
      }));
    }

    // --- MONTHLY GROUPING ---
    const bookingRevenueMap: Record<
      string,
      { label: string; revenue: number; count: number; adSpend: number }
    > = {};
    const todayDate = new Date();

    if (startDate && endDate) {
      let curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      while (curr <= endMonth) {
        const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`;
        const label = curr.toLocaleString("en-US", {
          month: "short",
          year:
            startDate.getFullYear() !== endDate.getFullYear()
              ? "2-digit"
              : undefined,
        });
        bookingRevenueMap[key] = { label, revenue: 0, count: 0, adSpend: 0 };
        curr.setMonth(curr.getMonth() + 1);
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth() - i,
          1,
        );
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("en-US", { month: "short" });
        bookingRevenueMap[key] = { label, revenue: 0, count: 0, adSpend: 0 };
      }
    }

    // Sum daily ad spend into months if daily breakdown exists
    Object.entries(dailyAdSpendMap).forEach(([dateStr, spendVal]) => {
      const monthKey = dateStr.substring(0, 7);
      if (bookingRevenueMap[monthKey]) {
        bookingRevenueMap[monthKey].adSpend += spendVal;
      }
    });

    bookedWeddings.forEach((w) => {
      const rawDate = w.contract_date || w.created_at || w.date;
      if (!rawDate) return;

      let d: Date;
      if (
        typeof rawDate === "string" &&
        rawDate.length === 10 &&
        rawDate.includes("-")
      ) {
        const [y, m, dayNum] = rawDate.split("-").map(Number);
        d = new Date(y, m - 1, dayNum);
      } else {
        d = new Date(rawDate);
      }
      if (isNaN(d.getTime())) return;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (bookingRevenueMap[key]) {
        bookingRevenueMap[key].revenue += w.total_amount || 0;
        bookingRevenueMap[key].count += 1;
      }
    });

    const keys = Object.keys(bookingRevenueMap);
    return Object.entries(bookingRevenueMap)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_, item]) => ({
        label: item.label,
        revenue: item.revenue,
        adSpend:
          item.adSpend > 0
            ? item.adSpend
            : totalAdSpend > 0
              ? totalAdSpend / Math.max(keys.length, 1)
              : 0,
        bookings: item.count,
      }));
  }, [
    dateRangePreset,
    chartGranularity,
    bookedWeddings,
    startDate,
    endDate,
    totalAdSpend,
    validCampaigns,
  ]);

  const filteredLeads = leadsList.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Connection Status Warnings */}
      {(leadsError || campaignsError) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {leadsError && (
            <Alert className="rounded-2xl border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertTitle className="text-xs font-bold flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-600" /> CRM Leads
                Disconnected
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                To load live leads directly, save your API Key and Location ID
                under{" "}
                <Link
                  to="/manager/settings"
                  className="underline font-semibold"
                >
                  Settings
                </Link>
                .
              </AlertDescription>
            </Alert>
          )}
          {campaignsError && (
            <Alert className="rounded-2xl border-blue-500/20 bg-blue-500/10 text-blue-900 dark:text-blue-200">
              <AlertTitle className="text-xs font-bold flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-blue-600" /> Meta Ad
                Account Alert
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                {(campaignsError as Error).message.includes(
                  "Missing Credentials",
                ) ? (
                  <>
                    Connect your Meta Access Token and Ad Account ID under{" "}
                    <Link
                      to="/manager/settings"
                      className="underline font-semibold"
                    >
                      Settings
                    </Link>{" "}
                    to sync live ad spend.
                  </>
                ) : (
                  <>
                    {(campaignsError as Error).message} Check{" "}
                    <Link
                      to="/manager/settings"
                      className="underline font-semibold"
                    >
                      Settings
                    </Link>
                    .
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight">
                Intelligence Workspace
              </h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 font-bold px-2.5 py-0.5 uppercase tracking-tighter text-[10px]">
                Global Command
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 font-medium">
              Unified command center for performance metrics, lead acquisition,
              and ad efficiency.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Filter Controls */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-full border border-border/40">
            <CalendarIcon className="w-3.5 h-3.5 ml-2 text-muted-foreground shrink-0" />
            <Select
              value={dateRangePreset}
              onValueChange={(val: any) => setDateRangePreset(val)}
            >
              <SelectTrigger className="h-7 border-none bg-transparent text-xs font-medium focus:ring-0 focus:ring-offset-0 px-2 min-w-[120px]">
                <SelectValue placeholder="Select Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last_7">Last 7 Days</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_30">Last 30 Days</SelectItem>
                <SelectItem value="last_90">Last 90 Days</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateRangePreset === "custom" && (
            <div className="flex items-center gap-1.5 bg-muted/30 p-1 px-2.5 rounded-full border border-border/50">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-7 text-xs rounded-lg w-[125px] sm:w-[135px] border-border/60 bg-background px-2 py-0"
              />
              <span className="text-xs text-muted-foreground font-medium px-0.5">
                to
              </span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-7 text-xs rounded-lg w-[125px] sm:w-[135px] border-border/60 bg-background px-2 py-0"
              />
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={isRefreshing}
            className="rounded-full shadow-sm h-8 text-xs"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Sync Metrics
          </Button>
          <Button
            size="sm"
            asChild
            className="rounded-full shadow-sm h-8 text-xs"
          >
            <Link to="/manager/proposals">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              New Proposal
            </Link>
          </Button>
        </div>
      </div>

      {/* Top Level KPIs - Organized in 2 Rows */}
      <div className="space-y-4">
        {/* Row 1: Financial & Revenue Performance */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Booked Value
              </CardTitle>
              <div className="p-1.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Award className="w-3.5 h-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                ${formatCurrency(totalBookedValue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                <span className="font-semibold text-foreground">
                  {bookedWeddings.length}
                </span>{" "}
                {bookedWeddings.length === 1
                  ? "Booked Contract"
                  : "Booked Contracts"}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Collected Revenue
              </CardTitle>
              <div className="p-1.5 rounded-full bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
                ${formatCurrency(totalCollectedRevenue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                $
                {formatCurrency(
                  Math.max(totalBookedValue - totalCollectedRevenue, 0),
                )}{" "}
                Outstanding
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Pipeline Value
              </CardTitle>
              <div className="p-1.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-xl sm:text-2xl font-bold tracking-tight">
                ${formatCurrency(totalBookedValue + totalProposalsValue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                Booked + Open Proposals
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Avg. Booking
              </CardTitle>
              <div className="p-1.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-xl sm:text-2xl font-bold tracking-tight">
                ${formatCurrency(avgBookingValue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Per signed client
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Marketing & Sales Efficiency */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Lead Conversion
              </CardTitle>
              <div className="p-1.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <Target className="w-3.5 h-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-xl sm:text-2xl font-bold tracking-tight">
                {conversionRate}%
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Inquiry to Contract
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Lead-to-Booking Speed
              </CardTitle>
              <div className="p-1.5 rounded-full bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400">
                <CalendarIcon className="w-3.5 h-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-cyan-600 dark:text-cyan-400">
                {avgLeadToBookingDays !== null
                  ? `${avgLeadToBookingDays} Days`
                  : "N/A"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Avg time from lead to signed contract
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Acquisition Cost (CAC)
              </CardTitle>
              <div className="p-1.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Users className="w-3.5 h-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-xl sm:text-2xl font-bold tracking-tight">
                ${formatCurrency(estimatedCAC)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Ad spend per booking
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Marketing ROAS
              </CardTitle>
              <div className="p-1.5 rounded-full bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
                {overallROAS !== "N/A" ? `${overallROAS}x` : "N/A"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Return on ad spend
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="bg-muted/40 p-1 rounded-full border border-border/40">
          <TabsTrigger
            value="overview"
            className="rounded-full px-5 text-xs font-medium"
          >
            <BarChart3 className="w-3.5 h-3.5 mr-2" /> Overview & Trends
          </TabsTrigger>
          <TabsTrigger
            value="ads"
            className="rounded-full px-5 text-xs font-medium"
          >
            <Megaphone className="w-3.5 h-3.5 mr-2" /> Ad Campaigns
          </TabsTrigger>
          <TabsTrigger
            value="leads"
            className="rounded-full px-5 text-xs font-medium"
          >
            <Users className="w-3.5 h-3.5 mr-2" /> Leads & Pipeline
          </TabsTrigger>
          <TabsTrigger
            value="map"
            className="rounded-full px-5 text-xs font-medium"
          >
            <MapPin className="w-3.5 h-3.5 mr-2" /> Market Map
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW & TRENDS */}
        <TabsContent
          value="overview"
          className="space-y-6 animate-in fade-in duration-200"
        >
          <div className="grid gap-6 md:grid-cols-12">
            {/* Revenue & Ad Spend Chart */}
            <Card className="md:col-span-8 rounded-3xl border-border/40 shadow-sm bg-card">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 gap-2">
                <div>
                  <CardTitle className="text-lg font-bold">
                    Revenue & Marketing Spend Trends
                  </CardTitle>
                  <CardDescription>
                    Booked contract value vs ad expenditure for selected period
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-full border border-border/40 shrink-0">
                  <span className="text-[11px] font-medium text-muted-foreground ml-2 mr-1">
                    View:
                  </span>
                  <Select
                    value={chartGranularity}
                    onValueChange={(val: any) => setChartGranularity(val)}
                  >
                    <SelectTrigger className="h-6 border-none bg-transparent text-xs font-semibold focus:ring-0 focus:ring-offset-0 px-2 min-w-[90px]">
                      <SelectValue placeholder="Granularity" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartTrends}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorRev"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorSpend"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="label"
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        tickFormatter={(val) => `$${val / 1000}k`}
                      />
                      <Tooltip
                        formatter={(value: any) => [
                          `$${Number(value).toLocaleString()}`,
                          "",
                        ]}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderRadius: "12px",
                          border: "1px solid var(--border)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Booked Revenue"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRev)"
                      />
                      <Area
                        type="monotone"
                        dataKey="adSpend"
                        name="Ad Spend"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorSpend)"
                      />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Funnel Conversion Breakdown */}
            <Card className="md:col-span-4 rounded-3xl border-border/40 shadow-sm bg-card flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">
                  Booking Funnel
                </CardTitle>
                <CardDescription>
                  Conversion efficiency through stages
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 flex-1 flex flex-col justify-center space-y-4">
                <div className="space-y-3">
                  {funnelData.map((item, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">
                          {item.stage}
                        </span>
                        <span className="font-bold">{item.count}</span>
                      </div>
                      {item.count > 0 && (
                        <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-border/30">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min((item.count / Math.max(...funnelData.map((f) => f.count), 1)) * 100, 100)}%`,
                              backgroundColor: item.fill,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-muted/30 border border-border/40 rounded-2xl p-4 mt-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted-foreground">
                      Inquiry-to-Booked Ratio:
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {conversionRate}%
                    </span>
                  </div>
                  {bookedWeddings.length > 0 && (
                    <Progress
                      value={parseFloat(conversionRate) || 0}
                      className="h-1.5 mt-2"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-12">
            {/* Lead Sources Distribution */}
            <Card className="md:col-span-6 rounded-3xl border-border/40 shadow-sm bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">
                  Inquiry Sources
                </CardTitle>
                <CardDescription>
                  Where your top leads and bookings are coming from
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="h-[200px] w-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {sourceDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [`${value} Leads`, "Volume"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full space-y-2.5">
                  {sourceDistribution.map((src, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-muted/20 border border-border/30"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: src.color }}
                        />
                        <span className="font-medium text-foreground">
                          {src.name}
                        </span>
                      </div>
                      <span className="font-bold">{src.value} leads</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Strategic Growth Actions */}
            <Card className="md:col-span-6 rounded-3xl border-border/40 shadow-sm bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">
                  Growth Recommendations
                </CardTitle>
                <CardDescription>
                  Automated insights to maximize your ROI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                      High Meta Ad Conversion
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {overallROAS !== "N/A"
                        ? `Active ad campaigns are yielding an average ROAS of ${overallROAS}x.`
                        : "Connect your Meta Ad Account in Settings to view live ROAS metrics."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                      Fast Response Opportunity
                    </h4>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                      Leads responded to within 15 minutes convert at 3x higher
                      rate. All incoming leads are automatically synced to
                      Ovanta.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="rounded-full text-xs"
                  >
                    <Link to="/manager/ad-campaigns">
                      View Ad Campaign Manager{" "}
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: AD CAMPAIGNS */}
        <TabsContent
          value="ads"
          className="space-y-6 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">
                Meta / Facebook Ad Performance
              </h3>
              <p className="text-xs text-muted-foreground">
                Live ad tracking synced with your marketing account
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchCampaigns()}
              className="rounded-full"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Ads
            </Button>
          </div>

          <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[100px]">Include</TableHead>
                  <TableHead className="min-w-[200px]">Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCampaigns ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Fetching campaign data...
                    </TableCell>
                  </TableRow>
                ) : rawCampaignsList.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No ad campaigns found. Connect your Meta Ad Account in
                      Settings.
                    </TableCell>
                  </TableRow>
                ) : (
                  rawCampaignsList.map((c) => {
                    const isExcluded = excludedCampaignIds.includes(c.id);
                    return (
                      <TableRow
                        key={c.id}
                        className={isExcluded ? "opacity-50 bg-muted/20" : ""}
                      >
                        <TableCell>
                          <Button
                            size="sm"
                            variant={isExcluded ? "outline" : "default"}
                            className="h-7 text-[10px] rounded-full px-2.5"
                            onClick={() => toggleCampaignExclusion(c.id)}
                          >
                            {isExcluded ? "Excluded" : "Active"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.objective}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          $
                          {c.spend?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.clicks?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {c.conversions}
                        </TableCell>
                        <TableCell className="text-right">
                          ${c.cpa ? c.cpa.toFixed(2) : "0.00"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className="text-emerald-600 border-emerald-600/30"
                          >
                            {c.roas ? `${c.roas}x` : "N/A"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 3: LEADS & PIPELINE */}
        <TabsContent
          value="leads"
          className="space-y-6 animate-in fade-in duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">Leads & Inquiries Pipeline</h3>
              <p className="text-xs text-muted-foreground">
                Incoming prospective clients synced with Ovanta CRM
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/40 p-0.5 rounded-full border border-border/40">
                <Button
                  size="sm"
                  variant={leadTagFilter === "all" ? "default" : "ghost"}
                  onClick={() => setLeadTagFilter("all")}
                  className="rounded-full h-7 text-[11px] px-3"
                >
                  All CRM Contacts
                </Button>
                <Button
                  size="sm"
                  variant={leadTagFilter === "new" ? "default" : "ghost"}
                  onClick={() => setLeadTagFilter("new")}
                  className="rounded-full h-7 text-[11px] px-3"
                >
                  New Leads Only
                </Button>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs rounded-full border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="rounded-full text-xs"
              >
                <Link to="/manager/leads">Full Leads List</Link>
              </Button>
            </div>
          </div>

          <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLeads ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Loading leads...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No matching leads found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="font-semibold text-sm">{lead.name}</div>
                        {lead.leadToBookingDays !== null && (
                          <div className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> Booked in{" "}
                            {lead.leadToBookingDays} days
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>{lead.email}</div>
                          <div>{lead.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            lead.status === "Booked"
                              ? "default"
                              : lead.status === "New"
                                ? "secondary"
                                : "outline"
                          }
                          className={`rounded-full px-2.5 text-[10px] ${lead.status === "Booked" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : ""}`}
                        >
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{lead.source}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDisplayDate(lead.date)}
                      </TableCell>
                      <TableCell className="text-right">
                        {lead.status === "Booked" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            className="rounded-full h-8 text-xs text-emerald-600 hover:text-emerald-700"
                          >
                            <Link to="/manager/weddings">
                              View Project{" "}
                              <ChevronRight className="w-3 h-3 ml-1" />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            className="rounded-full h-8 text-xs"
                          >
                            <Link to="/manager/proposals">
                              Build Proposal{" "}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 4: MARKET MAP */}
        <TabsContent
          value="map"
          className="space-y-6 animate-in fade-in duration-200"
        >
          <Suspense
            fallback={
              <div className="h-[480px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <MarketMap isActive={activeTab === "map"} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
