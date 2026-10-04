import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw,
  Loader2,
  Radar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { loadCommandData, type CommandAreaRow } from "@/lib/command-data";

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

type RoyaltyStatus = CommandAreaRow["royaltyStatus"];

function statusPillClass(status: RoyaltyStatus): string {
  switch (status) {
    case "paid":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30";
    case "processing":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30";
    case "failed":
      return "bg-destructive/15 text-destructive ring-1 ring-destructive/30";
    default:
      return "bg-muted text-muted-foreground ring-1 ring-border";
  }
}

function statusLabel(status: RoyaltyStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    default:
      return "No run";
  }
}

/** Insight line built only from data already on the card. */
function buildInsight(row: CommandAreaRow): string {
  const parts: string[] = [];

  if (row.royaltyStatus === "paid") parts.push("Royalty paid.");
  else if (row.royaltyStatus === "processing")
    parts.push("Royalty still processing.");
  else if (row.royaltyStatus === "failed") parts.push("Royalty run failed.");
  else parts.push("No royalty run this period.");

  if (row.openCoverageJobs > 0)
    parts.push(
      `${row.openCoverageJobs} coverage job${row.openCoverageJobs > 1 ? "s" : ""} still open.`,
    );

  if (row.grossThisWeek === 0 && row.royaltyStatus === "no run this period")
    parts.push("No sales this week.");

  return parts.join(" ");
}

function ringColor(score: number, noRun: boolean): string {
  if (noRun) return "text-muted-foreground/40";
  if (score >= 80) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-destructive";
}

function ringTrackColor(noRun: boolean): string {
  return noRun ? "text-muted" : "text-muted/30";
}

function ScoreRing({ score, noRun }: { score: number; noRun: boolean }) {
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = noRun ? 0 : Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;
  const color = ringColor(score, noRun);
  const track = ringTrackColor(noRun);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={track}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-500`}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {noRun ? (
          <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center px-1">
            no run
          </span>
        ) : (
          <>
            <span className={`text-xl font-bold ${color}`}>{score}</span>
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
              / 100
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function rankBadgeClass(rank: number): string {
  if (rank === 1)
    return "bg-amber-400/20 text-amber-600 dark:text-amber-300 ring-1 ring-amber-400/40";
  if (rank === 2)
    return "bg-slate-400/20 text-slate-500 dark:text-slate-300 ring-1 ring-slate-400/40";
  if (rank === 3)
    return "bg-orange-700/20 text-orange-700 dark:text-orange-400 ring-1 ring-orange-700/40";
  return "bg-muted text-muted-foreground ring-1 ring-border";
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber" | "red" | "neutral";
  hint?: string;
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "red"
          ? "text-destructive"
          : "";
  return (
    <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
      <CardHeader className="p-4 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        {hint ? (
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AreaCard({ row }: { row: CommandAreaRow }) {
  const [open, setOpen] = useState(false);
  const noRun = row.royaltyStatus === "no run this period";
  const insight = buildInsight(row);

  return (
    <Card className="shadow-sm border-border/40 rounded-2xl bg-card overflow-hidden">
      <CardContent className="p-5">
        {/* Header: rank + name + ring */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankBadgeClass(row.rank)}`}
            >
              {row.rank}
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-bold tracking-tight truncate">
                {row.name}
              </h3>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusPillClass(row.royaltyStatus)}`}
              >
                {statusLabel(row.royaltyStatus)}
              </span>
            </div>
          </div>
          <ScoreRing score={row.score} noRun={noRun} />
        </div>

        {/* Four figures */}
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Figure label="Gross this week" value={money(row.grossThisWeek)} />
          <Figure
            label="Total due"
            value={money(row.totalDue)}
            tone={row.totalDue > 0 ? "amber" : "neutral"}
          />
          <Figure
            label="Booked this month"
            value={String(row.weddingsBookedThisMonth)}
          />
          <Figure
            label="Open coverage"
            value={String(row.openCoverageJobs)}
            tone={row.openCoverageJobs > 0 ? "red" : "neutral"}
          />
        </div>

        {/* Insight + period */}
        <div className="mt-4 border-t border-border/40 pt-3">
          <p className="text-sm text-foreground/80">{insight}</p>
          {row.lastPeriodStart ? (
            <p className="mt-1 text-xs text-muted-foreground whitespace-nowrap">
              Last period: {row.lastPeriodStart} → {row.lastPeriodEnd}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No royalty period on record.
            </p>
          )}
        </div>

        {/* Details disclosure */}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs text-muted-foreground"
            >
              {open ? (
                <ChevronUp className="h-3.5 w-3.5 mr-1" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
              )}
              Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-muted/30 p-3 text-sm sm:grid-cols-4">
              <DetailItem
                label="Gross this month"
                value={money(row.grossThisMonth)}
              />
              <DetailItem label="Royalty due" value={money(row.royaltyDue)} />
              <DetailItem label="Payback due" value={money(row.paybackDue)} />
              <DetailItem
                label="Proposals waiting"
                value={String(row.proposalsWaiting)}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground italic">
              {row.gap}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber" | "red" | "neutral";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "red"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-base font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

export default function Command() {
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["command-overview"],
    queryFn: loadCommandData,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl border-destructive/30">
        <CardHeader>
          <CardTitle>Could not load Command</CardTitle>
          <CardDescription>{(error as Error).message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data || data.empty) {
    return (
      <div className="space-y-6">
        <CommandHeader onRefresh={() => refetch()} refreshing={isFetching} />
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Radar className="h-10 w-10 opacity-30 mb-3" />
            <p className="font-medium">No areas yet.</p>
            <p className="text-sm mt-1">
              Add an area in Areas to start tracking it here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { totals, areas } = data;
  const anyFailed = areas.some((a) => a.royaltyStatus === "failed");

  return (
    <div className="space-y-6">
      <CommandHeader onRefresh={() => refetch()} refreshing={isFetching} />

      {/* All-territory totals, current week */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          All areas · current week
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Gross Sales" value={money(totals.grossSales)} />
          <StatCard
            label="Royalty Due"
            value={money(totals.royaltyDue)}
            tone="neutral"
          />
          <StatCard
            label="Royalty Collected"
            value={money(totals.royaltyCollected)}
            tone="green"
          />
          <StatCard
            label="Payback Collected"
            value={money(totals.paybackCollected)}
            tone="green"
          />
          <StatCard
            label="Still Processing"
            value={money(totals.amountProcessing)}
            tone={anyFailed ? "red" : "amber"}
            hint={
              anyFailed ? "Includes a failed run" : "ACH pending settlement"
            }
          />
        </div>
      </div>

      {/* Ranked area cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          Area Command · ranked by weekly score
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {areas.map((a) => (
            <AreaCard key={a.id} row={a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CommandHeader({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Radar className="h-7 w-7 text-primary" /> Command
        </h1>
        <p className="text-sm text-muted-foreground">
          Every area at a glance — sales, royalty, coverage, and a weekly health
          score. Read-only.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Refresh
      </Button>
    </div>
  );
}
