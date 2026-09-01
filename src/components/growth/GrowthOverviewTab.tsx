import { Link } from "react-router-dom";
import { TrendingUp, Users, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type {
  TrendPoint,
  FunnelItem,
  SourceItem,
  ChartGranularity,
} from "@/lib/growth-hub-data";

interface OverviewTabProps {
  chartTrends: TrendPoint[];
  funnelData: FunnelItem[];
  conversionRate: string;
  bookedCount: number;
  sourceDistribution: SourceItem[];
  overallROAS: string;
  chartGranularity: ChartGranularity;
  onChartGranularity: (v: ChartGranularity) => void;
}

export function GrowthOverviewTab(props: OverviewTabProps) {
  const {
    chartTrends,
    funnelData,
    conversionRate,
    bookedCount,
    sourceDistribution,
    overallROAS,
    chartGranularity,
    onChartGranularity,
  } = props;

  return (
    <>
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
                onValueChange={(val: any) => onChartGranularity(val)}
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
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
            <CardTitle className="text-lg font-bold">Booking Funnel</CardTitle>
            <CardDescription>
              Conversion efficiency through stages
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 flex-1 flex flex-col justify-center space-y-4">
            <div className="space-y-3">
              {funnelData.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">{item.stage}</span>
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
              {bookedCount > 0 && (
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
            <CardTitle className="text-lg font-bold">Inquiry Sources</CardTitle>
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
                  rate. All incoming leads are automatically synced to Ovanta.
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
    </>
  );
}
