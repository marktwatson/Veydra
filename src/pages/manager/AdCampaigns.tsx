import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  TrendingUp,
  Users,
  MousePointerClick,
  DollarSign,
  Filter,
  RefreshCw,
  AlertCircle,
  Check,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

export default function AdCampaigns() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [datePreset, setDatePreset] = useState<string>("this_year");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: portalSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getPortalSettings,
  });

  const excludedCampaignIds: string[] = useMemo(() => {
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
      ? excludedCampaignIds.filter((x) => x !== id)
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

  // Pulling ad reporting data directly from Ovanta CRM API
  // since the Facebook account is linked there.
  const {
    data: rawCampaigns = [],
    isLoading,
    error,
    refetch,
  } = useQuery<any[]>({
    queryKey: ["fb-ads-campaigns", datePreset],
    queryFn: () => api.getFacebookAdsCampaigns(datePreset),
    retry: false,
  });

  const campaigns = rawCampaigns.filter((c) => {
    if (statusFilter === "all") return true;
    return c.status?.toLowerCase() === statusFilter.toLowerCase();
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const validCampaigns = campaigns.filter(
    (c) => !excludedCampaignIds.includes(c.id),
  );
  const totalSpend = validCampaigns.reduce(
    (sum, camp) => sum + (camp.spend || 0),
    0,
  );
  const totalConversions = validCampaigns.reduce(
    (sum, camp) => sum + (camp.conversions || 0),
    0,
  );
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const totalImpressions = validCampaigns.reduce(
    (sum, camp) => sum + (camp.impressions || 0),
    0,
  );

  const presets = [
    { label: "This Year", value: "this_year" },
    { label: "All Time", value: "maximum" },
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 7 Days", value: "last_7d" },
    { label: "This Month", value: "this_month" },
    { label: "Last 30 Days", value: "last_30d" },
    { label: "Last 90 Days", value: "last_90d" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Campaigns</h1>
          <p className="text-muted-foreground">
            Live performance metrics for your active Facebook Ads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Sync Data
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <Filter className="mr-2 h-4 w-4" />
                Filter (
                {presets.find((p) => p.value === datePreset)?.label || "Custom"}
                )
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Time Horizon</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {presets.map((p) => (
                <DropdownMenuItem
                  key={p.value}
                  onClick={() => setDatePreset(p.value)}
                  className="justify-between cursor-pointer"
                >
                  {p.label}
                  {datePreset === p.value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Campaign Status</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setStatusFilter("all")}
                className="justify-between cursor-pointer"
              >
                All Statuses
                {statusFilter === "all" && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter("ACTIVE")}
                className="justify-between cursor-pointer"
              >
                Active Only
                {statusFilter === "ACTIVE" && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter("PAUSED")}
                className="justify-between cursor-pointer"
              >
                Paused Only
                {statusFilter === "PAUSED" && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error ? (
        <Alert className="bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ad Account Disconnected or Error</AlertTitle>
          <AlertDescription>
            Could not connect to Facebook Graph API: {(error as Error).message}.
            Check your Access Token or Ad Account ID in{" "}
            <a href="/manager/settings" className="underline font-semibold">
              Settings
            </a>
            .
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400">
          <Activity className="h-4 w-4" />
          <AlertTitle>Live Meta Ad Connection Active</AlertTitle>
          <AlertDescription>
            Displaying live data directly from your Meta Ad Account for{" "}
            <strong>ACTIVE</strong> campaigns.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {totalSpend.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Across active campaigns
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Conversions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversions}</div>
            <p className="text-xs text-muted-foreground">Leads & bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Cost per Action
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {avgCpa.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Overall CPA</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Impressions
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalImpressions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Ad views</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Campaigns</CardTitle>
          <CardDescription>
            Detailed performance metrics for your currently running ads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Include</TableHead>
                  <TableHead className="min-w-[200px]">Campaign Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Fetching live data from Facebook...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-destructive"
                    >
                      <AlertCircle className="mx-auto h-8 w-8 opacity-50 mb-2" />
                      <p>{(error as Error).message}</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() =>
                          (window.location.href = "/manager/settings")
                        }
                      >
                        Go to Settings
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      <AlertCircle className="mx-auto h-8 w-8 opacity-50 mb-2" />
                      <p>No active campaigns found.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((campaign) => {
                    const isExcluded = excludedCampaignIds.includes(
                      campaign.id,
                    );
                    return (
                      <TableRow
                        key={campaign.id}
                        className={isExcluded ? "opacity-50 bg-muted/20" : ""}
                      >
                        <TableCell>
                          <Button
                            size="sm"
                            variant={isExcluded ? "outline" : "default"}
                            className="h-7 text-[11px] rounded-full px-2.5 font-medium"
                            onClick={() => toggleCampaignExclusion(campaign.id)}
                          >
                            {isExcluded ? "Excluded" : "Active"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{campaign.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {campaign.objective}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20 dark:text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          $
                          {campaign.spend.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {campaign.clicks.toLocaleString()}
                            <MousePointerClick className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {campaign.conversions}
                        </TableCell>
                        <TableCell className="text-right">
                          $
                          {campaign.cpa.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
