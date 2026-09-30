import { Card, CardContent } from "@/components/ui/card";

/**
 * Minimal structural shape of a rep row — kept local so this file has no
 * circular dependency on ProposalSalesRepsTab. TypeScript's structural typing
 * accepts the richer RepRow from the tab.
 */
export interface RepRowLike {
  key: string;
  name: string;
  sent: number;
  booked: number;
  bookedValue: number;
  totalValue: number;
  daysToBookSum: number;
  daysToBookCount: number;
}

export type AwardId = "volume" | "closer" | "ratio" | "fast" | "pipeline";

export interface Award {
  id: AwardId;
  emoji: string;
  label: string;
  winnerKey: string;
  winnerName: string;
  stat: string;
  description: string;
}

/**
 * Compute the five gamified awards from the rep rows. Sent is the primary
 * metric (volume leader is the hero). Same rep can win more than one. Empty
 * awards are omitted.
 */
export function computeAwards(reps: RepRowLike[]): Award[] {
  const awards: Award[] = [];
  if (reps.length === 0) return awards;

  // 🔥 Most sent — highest volume. Tie → bookedValue.
  const volumeWinner = [...reps].sort(
    (a, b) => b.sent - a.sent || b.bookedValue - a.bookedValue,
  )[0];
  if (volumeWinner && volumeWinner.sent > 0) {
    awards.push({
      id: "volume",
      emoji: "🔥",
      label: "Most Sent",
      winnerKey: volumeWinner.key,
      winnerName: volumeWinner.name,
      stat: `${volumeWinner.sent} sent`,
      description: "Highest proposal volume this period",
    });
  }

  // 🥇 Top closer — highest booked revenue.
  const closerWinner = [...reps].sort(
    (a, b) => b.bookedValue - a.bookedValue,
  )[0];
  if (closerWinner && closerWinner.bookedValue > 0) {
    awards.push({
      id: "closer",
      emoji: "🥇",
      label: "Top Closer",
      winnerKey: closerWinner.key,
      winnerName: closerWinner.name,
      stat: `$${closerWinner.bookedValue.toLocaleString()} booked`,
      description: "Most booked revenue this period",
    });
  }

  // 📈 Best ratio — highest booked/sent among sent >= 3 (fallback sent >= 1).
  const ratioPool = reps.filter((r) => r.sent >= 3);
  const ratioFallback =
    ratioPool.length > 0 ? ratioPool : reps.filter((r) => r.sent >= 1);
  if (ratioFallback.length > 0) {
    const ratioWinner = [...ratioFallback].sort(
      (a, b) => b.booked / b.sent - a.booked / a.sent,
    )[0];
    const pct = Math.round((ratioWinner.booked / ratioWinner.sent) * 100);
    awards.push({
      id: "ratio",
      emoji: "📈",
      label: "Best Ratio",
      winnerKey: ratioWinner.key,
      winnerName: ratioWinner.name,
      stat: `${pct}% of ${ratioWinner.sent} sent`,
      description: "Highest close ratio this period",
    });
  }

  // ⚡ Fastest book — lowest avg days among daysToBookCount >= 2.
  const fastPool = reps.filter((r) => r.daysToBookCount >= 2);
  if (fastPool.length > 0) {
    const fastWinner = [...fastPool].sort(
      (a, b) =>
        a.daysToBookSum / a.daysToBookCount -
        b.daysToBookSum / b.daysToBookCount,
    )[0];
    const avg = Math.round(
      fastWinner.daysToBookSum / fastWinner.daysToBookCount,
    );
    awards.push({
      id: "fast",
      emoji: "⚡",
      label: "Fastest Book",
      winnerKey: fastWinner.key,
      winnerName: fastWinner.name,
      stat: `${avg}d avg`,
      description: "Shortest time from sent to signed",
    });
  }

  // 💼 Pipeline — largest open (unbooked, sent) pipeline value.
  const pipelineWinner = [...reps].sort(
    (a, b) => b.totalValue - a.totalValue,
  )[0];
  if (pipelineWinner && pipelineWinner.totalValue > 0) {
    awards.push({
      id: "pipeline",
      emoji: "💼",
      label: "Top Pipeline",
      winnerKey: pipelineWinner.key,
      winnerName: pipelineWinner.name,
      stat: `$${pipelineWinner.totalValue.toLocaleString()} open`,
      description: "Largest open pipeline value",
    });
  }

  return awards;
}

/**
 * Hero strip of award winners, rendered above the stat cards. The volume
 * leader is the largest / first card; the rest are equal-width. Omitted
 * awards simply don't render.
 */
export function SalesRepPodium({ reps }: { reps: RepRowLike[] }) {
  const awards = computeAwards(reps);
  if (awards.length === 0) return null;

  const volume = awards.find((a) => a.id === "volume");
  const rest = awards.filter((a) => a.id !== "volume");

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {volume && (
        <Card className="md:col-span-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <span className="text-2xl leading-none">{volume.emoji}</span>
              <span className="text-sm font-semibold uppercase tracking-wide">
                {volume.label}
              </span>
            </div>
            <div className="mt-2 text-4xl font-bold text-foreground">
              {volume.stat}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {volume.winnerName}
            </div>
            <div className="text-xs text-muted-foreground">
              {volume.description}
            </div>
          </CardContent>
        </Card>
      )}
      {rest.map((a) => (
        <Card key={a.id} className="border-primary/15">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xl leading-none">{a.emoji}</span>
              <span className="text-xs font-semibold uppercase tracking-wide">
                {a.label}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {a.stat}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground truncate">
              {a.winnerName}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {a.description}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
