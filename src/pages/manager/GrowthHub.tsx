import { useState, useMemo, lazy, Suspense } from "react";
const MarketMap = lazy(() => import("@/components/MarketMap"));
import { useQuery } from "@tanstack/react-query";
import {
  Megaphone,
  RefreshCw,
  BarChart3,
  Target,
  UserPlus,
  MapPin,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
  computeDateRange,
  makeIsDateInRange,
  computeFunnelData,
  computeSourceDistribution,
  computeChartTrends,
  type DateRangePreset,
  type ChartGranularity,
} from "@/lib/growth-hub-data";
import {
  enrichLeadsWithBookingData,
  computeAvgLeadToBookingDays,
} from "@/lib/lead-correlation";
import { GrowthKpiCards } from "@/components/growth/GrowthKpiCards";
import { GrowthOverviewTab } from "@/components/growth/GrowthOverviewTab";
import { GrowthAdCampaignsTab } from "@/components/growth/GrowthAdCampaignsTab";
import { GrowthLeadsTab } from "@/components/growth/GrowthLeadsTab";

export default function GrowthHub() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [leadTagFilter, setLeadTagFilter] = useState<"all" | "new">("all");
  const [dateRangePreset, setDateRangePreset] =
    useState<DateRangePreset>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [chartGranularity, setChartGranularity] =
    useState<ChartGranularity>("auto");

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
  const { data: weddings = [], refetch: refetchWeddings } = useQuery({
    queryKey: ["growth-weddings"],
    queryFn: api.getWeddings,
  });

  const { data: proposals = [], refetch: refetchProposals } = useQuery({
    queryKey: ["growth-proposals"],
    queryFn: api.getProposals,
  });

  // Date Range Calculation
  const { startDate, endDate, datePresetParam } = useMemo(
    () => computeDateRange(dateRangePreset, customStartDate, customEndDate),
    [dateRangePreset, customStartDate, customEndDate],
  );

  const isDateInRange = useMemo(
    () => makeIsDateInRange(startDate, endDate),
    [startDate, endDate],
  );

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

  // Raw + filtered lists
  const allBookedWeddings = Array.isArray(weddings)
    ? weddings.filter(
        (w) =>
          !w.notes?.includes("[UNPAID_DRAFT]") &&
          w.status !== "draft" &&
          w.status !== "cancelled" &&
          w.status !== "pending" && // pending = proposal awaiting contract/deposit, NOT booked
          (w.status === "upcoming" || w.status === "completed"),
      )
    : [];

  const bookedWeddings = useMemo(
    () =>
      allBookedWeddings.filter((w) =>
        isDateInRange(w.contract_date || w.created_at || w.date),
      ),
    [allBookedWeddings, isDateInRange],
  );

  const filteredProposals = useMemo(
    () =>
      (Array.isArray(proposals) ? proposals : []).filter((p) =>
        isDateInRange(p.created_at || p.wedding_date),
      ),
    [proposals, isDateInRange],
  );

  // Lead correlation + speed (logic in @/lib/lead-correlation)
  const leadsWithBookingData = useMemo(
    () => enrichLeadsWithBookingData(leads, allBookedWeddings, proposals),
    [leads, allBookedWeddings, proposals],
  );

  const leadsList = useMemo(
    () =>
      leadsWithBookingData.filter((l) => isDateInRange(l.date || l.created_at)),
    [leadsWithBookingData, isDateInRange],
  );

  const avgLeadToBookingDays = useMemo(
    () => computeAvgLeadToBookingDays(leadsList),
    [leadsList],
  );

  // Aggregates
  const totalBookedValue = bookedWeddings.reduce(
    (sum, w) => sum + (w.total_amount || 0),
    0,
  );
  const totalCollectedRevenue = bookedWeddings.reduce(
    (s, w: any) =>
      s + Math.max(0, (w.paid_amount || 0) - (w.refunded_amount || 0)),
    0,
  );
  const totalProposalsValue = filteredProposals.reduce(
    (sum, p) => sum + (p.total_amount || 0),
    0,
  );

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

  const leadsCount = leadsList.length;
  const proposalsCount = filteredProposals.length;
  const totalInquiries = Math.max(
    leadsCount + proposalsCount + bookedWeddings.length,
    1,
  );
  const conversionRate =
    bookedWeddings.length > 0
      ? ((bookedWeddings.length / totalInquiries) * 100).toFixed(1)
      : "0.0";

  const avgBookingValue =
    bookedWeddings.length > 0 ? totalBookedValue / bookedWeddings.length : 0;
  const estimatedCAC =
    bookedWeddings.length > 0 && totalAdSpend > 0
      ? totalAdSpend / bookedWeddings.length
      : totalAdConversions > 0
        ? totalAdSpend / totalAdConversions
        : 0;
  const overallROAS =
    totalAdSpend > 0 ? (totalBookedValue / totalAdSpend).toFixed(2) : "N/A";

  const funnelData = useMemo(
    () => computeFunnelData(leadsCount, proposalsCount, bookedWeddings.length),
    [leadsCount, proposalsCount, bookedWeddings.length],
  );
  const sourceDistribution = useMemo(
    () => computeSourceDistribution(leadsList),
    [leadsList],
  );

  const chartTrends = useMemo(
    () =>
      computeChartTrends(
        chartGranularity,
        dateRangePreset,
        startDate,
        endDate,
        bookedWeddings,
        validCampaigns,
        totalAdSpend,
      ),
    [
      chartGranularity,
      dateRangePreset,
      startDate,
      endDate,
      bookedWeddings,
      validCampaigns,
      totalAdSpend,
    ],
  );

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
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-full border border-border/40">
            <MapPin className="w-3.5 h-3.5 ml-2 text-muted-foreground shrink-0" />
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

      <GrowthKpiCards
        totalBookedValue={totalBookedValue}
        bookedCount={bookedWeddings.length}
        totalCollectedRevenue={totalCollectedRevenue}
        totalProposalsValue={totalProposalsValue}
        avgBookingValue={avgBookingValue}
        conversionRate={conversionRate}
        avgLeadToBookingDays={avgLeadToBookingDays}
        estimatedCAC={estimatedCAC}
        overallROAS={overallROAS}
      />

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
            <UserPlus className="w-3.5 h-3.5 mr-2" /> Leads & Pipeline
          </TabsTrigger>
          <TabsTrigger
            value="map"
            className="rounded-full px-5 text-xs font-medium"
          >
            <MapPin className="w-3.5 h-3.5 mr-2" /> Market Map
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className="space-y-6 animate-in fade-in duration-200"
        >
          <GrowthOverviewTab
            chartTrends={chartTrends}
            funnelData={funnelData}
            conversionRate={conversionRate}
            bookedCount={bookedWeddings.length}
            sourceDistribution={sourceDistribution}
            overallROAS={overallROAS}
            chartGranularity={chartGranularity}
            onChartGranularity={setChartGranularity}
          />
        </TabsContent>

        <TabsContent
          value="ads"
          className="space-y-6 animate-in fade-in duration-200"
        >
          <GrowthAdCampaignsTab
            loadingCampaigns={loadingCampaigns}
            rawCampaignsList={rawCampaignsList}
            excludedCampaignIds={excludedCampaignIds}
            onToggleExclusion={toggleCampaignExclusion}
            onRefresh={() => refetchCampaigns()}
          />
        </TabsContent>

        <TabsContent
          value="leads"
          className="space-y-6 animate-in fade-in duration-200"
        >
          <GrowthLeadsTab
            loadingLeads={loadingLeads}
            filteredLeads={filteredLeads}
            leadTagFilter={leadTagFilter}
            onLeadTagFilter={setLeadTagFilter}
            searchTerm={searchTerm}
            onSearchTerm={setSearchTerm}
          />
        </TabsContent>

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
