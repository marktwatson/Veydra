import { Fragment, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Users,
  TrendingUp,
  Calendar,
  DollarSign,
  Clock,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import { isBooked, resolveWedding } from "@/lib/proposal-tabs";
import { ProposalCountdownBadge } from "@/components/ProposalCountdownBadge";

interface Props {
  proposals: any[];
}

type RangeKey = "all" | "30" | "90";

interface RepRow {
  key: string; // salesperson_email (lowercased)
  name: string;
  email: string;
  sent: number;
  booked: number;
  totalValue: number;
  bookedValue: number;
  /** Sum of days-to-book across booked proposals (for averaging). */
  daysToBookSum: number;
  daysToBookCount: number;
  proposals: any[];
}

/**
 * Groups public-builder proposals by salesperson (salesperson_email +
 * salesperson_name). Only proposals that came through the public builder
 * (i.e. have a salesperson_email) are shown — internal manager-built
 * proposals have no salesperson and are excluded so this tab tracks the
 * hired-salespeople pipeline only.
 *
 * For each rep: # sent, # booked, close ratio (booked / sent), average deal
 * size, days-to-book (sent → contract signed), and total / booked proposal
 * value. A date-range filter narrows by proposal created_at.
 */
export function ProposalSalesRepsTab({ proposals }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("all");

  const rangeMs = useMemo(() => {
    if (range === "30") return 30 * 24 * 60 * 60 * 1000;
    if (range === "90") return 90 * 24 * 60 * 60 * 1000;
    return 0;
  }, [range]);

  const scoped = useMemo(() => {
    if (!rangeMs) return proposals;
    const cutoff = Date.now() - rangeMs;
    return proposals.filter((p) => {
      const t = new Date(p.created_at || p.sent_at || 0).getTime();
      return t >= cutoff;
    });
  }, [proposals, rangeMs]);

  const reps = useMemo<RepRow[]>(() => {
    const map = new Map<string, RepRow>();
    for (const p of scoped) {
      const email = (p.salesperson_email || "").trim().toLowerCase();
      if (!email) continue; // not a public-builder proposal
      const name = (p.salesperson_name || "").trim() || email;
      let row = map.get(email);
      if (!row) {
        row = {
          key: email,
          name,
          email,
          sent: 0,
          booked: 0,
          totalValue: 0,
          bookedValue: 0,
          daysToBookSum: 0,
          daysToBookCount: 0,
          proposals: [],
        };
        map.set(email, row);
      }
      // Only count proposals that were actually sent (sent_at set) toward
      // the close ratio. Unsent drafts are still listed but don't inflate
      // the denominator.
      if (p.sent_at) row.sent += 1;
      // Pipeline value: only sent, non-superseded, not-yet-booked proposals.
      if (p.sent_at && p.status !== "superseded" && !isBooked(p)) {
        row.totalValue += Number(p.total_amount || 0);
      }
      const booked = isBooked(p);
      if (booked) {
        row.booked += 1;
        row.bookedValue += Number(p.total_amount || 0);
        // Days to book: sent_at → signed date (proposal first, then wedding).
        const w = resolveWedding(p);
        const signedAt =
          p.contract_signed_at ||
          w?.contract_signed_at ||
          w?.contract_date ||
          p.contract_date;
        if (p.sent_at && signedAt) {
          const days =
            (new Date(signedAt).getTime() - new Date(p.sent_at).getTime()) /
            (24 * 60 * 60 * 1000);
          if (days >= 0) {
            row.daysToBookSum += days;
            row.daysToBookCount += 1;
          }
        }
      }
      row.proposals.push(p);
    }
    // Sort reps by sent desc, then booked desc.
    return Array.from(map.values()).sort(
      (a, b) => b.sent - a.sent || b.booked - a.booked,
    );
  }, [scoped]);

  const totals = useMemo(() => {
    const sent = reps.reduce((s, r) => s + r.sent, 0);
    const booked = reps.reduce((s, r) => s + r.booked, 0);
    const totalValue = reps.reduce((s, r) => s + r.totalValue, 0);
    const bookedValue = reps.reduce((s, r) => s + r.bookedValue, 0);
    const daysSum = reps.reduce((s, r) => s + r.daysToBookSum, 0);
    const daysCount = reps.reduce((s, r) => s + r.daysToBookCount, 0);
    return {
      sent,
      booked,
      ratio: sent > 0 ? Math.round((booked / sent) * 100) : 0,
      totalValue,
      bookedValue,
      avgDeal: booked > 0 ? Math.round(bookedValue / booked) : 0,
      avgDays: daysCount > 0 ? Math.round(daysSum / daysCount) : 0,
    };
  }, [reps]);

  if (reps.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No salesperson-built proposals yet. Proposals sent from a public builder
        link will appear here grouped by the salesperson who sent them.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date-range filter */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Period:</span>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Sales Reps</div>
            <div className="text-2xl font-semibold mt-1">{reps.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Sent</div>
            <div className="text-2xl font-semibold mt-1">{totals.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Booked</div>
            <div className="text-2xl font-semibold mt-1 text-green-600 dark:text-green-400">
              {totals.booked}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Close Ratio
            </div>
            <div className="text-2xl font-semibold mt-1">{totals.ratio}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {totals.booked} of {totals.sent} sent
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Avg Days to Book
            </div>
            <div className="text-2xl font-semibold mt-1">
              {totals.avgDays || "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              sent → signed
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales Reps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-center">Sent</TableHead>
                  <TableHead className="text-center">Booked</TableHead>
                  <TableHead className="text-center">Close Ratio</TableHead>
                  <TableHead className="text-right">Avg Deal</TableHead>
                  <TableHead className="text-center">
                    Avg Days to Book
                  </TableHead>
                  <TableHead className="text-right">Booked Value</TableHead>
                  <TableHead className="text-right">Pipeline Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps.map((rep) => {
                  const ratio =
                    rep.sent > 0
                      ? Math.round((rep.booked / rep.sent) * 100)
                      : 0;
                  const avgDeal =
                    rep.booked > 0
                      ? Math.round(rep.bookedValue / rep.booked)
                      : 0;
                  const avgDays =
                    rep.daysToBookCount > 0
                      ? Math.round(rep.daysToBookSum / rep.daysToBookCount)
                      : null;
                  const isOpen = expanded === rep.key;
                  return (
                    <Fragment key={rep.key}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() =>
                          setExpanded((cur) =>
                            cur === rep.key ? null : rep.key,
                          )
                        }
                      >
                        <TableCell>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{rep.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {rep.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {rep.sent}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {rep.booked}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={
                              ratio >= 50
                                ? "bg-green-500/10 text-green-700 border-green-500/20"
                                : ratio >= 25
                                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                  : "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20"
                            }
                          >
                            {ratio}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {avgDeal ? `$${avgDeal.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {avgDays !== null ? (
                            <span className="text-sm font-medium">
                              {avgDays}d
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${rep.bookedValue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${rep.totalValue.toLocaleString()}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${rep.key}-detail`}>
                          <TableCell colSpan={9} className="bg-muted/20 p-0">
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                                <Users className="h-4 w-4" />
                                {rep.name}'s proposals
                              </div>
                              <div className="overflow-x-auto rounded-md border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Client</TableHead>
                                      <TableHead>Wedding Date</TableHead>
                                      <TableHead>Total</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Sent</TableHead>
                                      <TableHead>Created</TableHead>
                                      <TableHead className="text-right">
                                        Link
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {rep.proposals
                                      .sort(
                                        (a, b) =>
                                          new Date(
                                            b.created_at || 0,
                                          ).getTime() -
                                          new Date(a.created_at || 0).getTime(),
                                      )
                                      .map((p) => {
                                        const booked = isBooked(p);
                                        return (
                                          <TableRow key={p.id}>
                                            <TableCell>
                                              <div className="font-medium">
                                                {p.client_name}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                {p.client_email}
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              {formatDisplayDate(
                                                p.wedding_date,
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              $
                                              {Number(
                                                p.total_amount || 0,
                                              ).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex flex-col items-start gap-0.5">
                                                {booked ? (
                                                  <Badge className="bg-green-500/10 text-green-700 border-green-500/20">
                                                    Booked
                                                  </Badge>
                                                ) : p.status ===
                                                  "superseded" ? (
                                                  <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20">
                                                    Superseded
                                                  </Badge>
                                                ) : (
                                                  <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                                                    Pending
                                                  </Badge>
                                                )}
                                                <ProposalCountdownBadge
                                                  proposal={p}
                                                />
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              {p.sent_at ? (
                                                <span className="text-xs text-muted-foreground">
                                                  {new Date(
                                                    p.sent_at,
                                                  ).toLocaleDateString()}
                                                </span>
                                              ) : (
                                                <span className="text-xs text-muted-foreground italic">
                                                  Not sent
                                                </span>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <span className="text-xs text-muted-foreground">
                                                {new Date(
                                                  p.created_at,
                                                ).toLocaleDateString()}
                                              </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs"
                                                onClick={() =>
                                                  window.open(
                                                    `/proposal/${p.id}`,
                                                    "_blank",
                                                  )
                                                }
                                              >
                                                Open
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
