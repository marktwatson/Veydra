import {
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Megaphone,
  Calendar as CalendarIcon,
  Layers,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (val: number) =>
  (val || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface KpiCardsProps {
  totalBookedValue: number;
  bookedCount: number;
  totalCollectedRevenue: number;
  totalProposalsValue: number;
  avgBookingValue: number;
  conversionRate: string;
  avgLeadToBookingDays: number | null;
  estimatedCAC: number;
  overallROAS: string;
}

export function GrowthKpiCards(props: KpiCardsProps) {
  const {
    totalBookedValue,
    bookedCount,
    totalCollectedRevenue,
    totalProposalsValue,
    avgBookingValue,
    conversionRate,
    avgLeadToBookingDays,
    estimatedCAC,
    overallROAS,
  } = props;

  return (
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
                {bookedCount}
              </span>{" "}
              {bookedCount === 1 ? "Booked Contract" : "Booked Contracts"}
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
  );
}
