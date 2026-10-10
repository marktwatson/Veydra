import { Fragment, useEffect, useMemo, useState } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronDown,
  ChevronRight,
  Users,
  TrendingUp,
  Calendar,
  DollarSign,
  Clock,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import { isBooked, resolveWedding } from "@/lib/proposal-tabs";
import { ProposalCountdownBadge } from "@/components/ProposalCountdownBadge";
import {
  SalesRepPodium,
  computeAwards,
  type AwardId,
} from "@/components/SalesRepPodium";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  healSalespersonPayoutSchema,
  getSalespersonSendFees,
  markSalespersonPaid,
  feeFor,
  DEFAULT_SALESPERSON_SEND_FEE,
} from "@/lib/salesperson-payouts";

const AWARD_LABELS: Record<AwardId, string> = {
  volume: "Volume",
  closer: "Closer",
  ratio: "Ratio",
  fast: "Fast",
  pipeline: "Pipeline",
};

interface Props {
  proposals: any[];
  onRefresh?: () => void;
}
type RangeKey = "all" | "30" | "90" | "month";

interface RepRow {
  key: string;
  name: string;
  email: string;
  sent: number;
  booked: number;
  totalValue: number;
  bookedValue: number;
  daysToBookSum: number;
  daysToBookCount: number;
  proposals: any[];
  owed: number;
  paidCount: number;
  paidAmount: number;
  unpaidProposalIds: string[];
  unpaidClientNames: string[];
}

/** Staff-only salesperson send-fee payouts. First send only; not visible to
 *  salespeople. Owed fees can be batch-marked paid (idempotent). */
export function ProposalSalesRepsTab({ proposals, onRefresh }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("all");
  const [feeByTerritory, setFeeByTerritory] = useState<Map<string, number>>(
    new Map(),
  );
  const [confirmRep, setConfirmRep] = useState<RepRow | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    healSalespersonPayoutSchema();
  }, []);
  useEffect(() => {
    const ids = Array.from(
      new Set(proposals.map((p) => p.territory_id).filter(Boolean) as string[]),
    );
    getSalespersonSendFees(ids).then(setFeeByTerritory);
  }, [proposals]);

  const rangeMs = useMemo(() => {
    if (range === "30") return 30 * 86400000;
    if (range === "90") return 90 * 86400000;
    return 0;
  }, [range]);

  const scoped = useMemo(() => {
    if (range === "month") {
      const now = new Date();
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).getTime();
      return proposals.filter(
        (p) => new Date(p.created_at || p.sent_at || 0).getTime() >= monthStart,
      );
    }
    if (!rangeMs) return proposals;
    const cutoff = Date.now() - rangeMs;
    return proposals.filter(
      (p) => new Date(p.created_at || p.sent_at || 0).getTime() >= cutoff,
    );
  }, [proposals, rangeMs, range]);

  const reps = useMemo<RepRow[]>(() => {
    const map = new Map<string, RepRow>();
    for (const p of scoped) {
      const email = (p.salesperson_email || "").trim().toLowerCase();
      if (!email) continue;
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
          owed: 0,
          paidCount: 0,
          paidAmount: 0,
          unpaidProposalIds: [],
          unpaidClientNames: [],
        };
        map.set(email, row);
      }
      if (p.sent_at) row.sent += 1;
      if (p.sent_at && p.status !== "superseded" && !isBooked(p))
        row.totalValue += Number(p.total_amount || 0);
      if (p.sent_at) {
        const fee = feeFor(feeByTerritory, p.territory_id);
        if (p.salesperson_paid_at) {
          row.paidCount += 1;
          row.paidAmount += fee;
        } else {
          row.owed += fee;
          row.unpaidProposalIds.push(p.id);
          if (p.client_name) row.unpaidClientNames.push(p.client_name);
        }
      }
      if (isBooked(p)) {
        row.booked += 1;
        row.bookedValue += Number(p.total_amount || 0);
        const w = resolveWedding(p);
        const signedAt =
          p.contract_signed_at ||
          w?.contract_signed_at ||
          w?.contract_date ||
          p.contract_date;
        if (p.sent_at && signedAt) {
          const days =
            (new Date(signedAt).getTime() - new Date(p.sent_at).getTime()) /
            86400000;
          if (days >= 0) {
            row.daysToBookSum += days;
            row.daysToBookCount += 1;
          }
        }
      }
      row.proposals.push(p);
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.sent - a.sent || b.bookedValue - a.bookedValue || b.booked - a.booked,
    );
  }, [scoped, feeByTerritory]);

  const totals = useMemo(() => {
    const sent = reps.reduce((s, r) => s + r.sent, 0);
    const booked = reps.reduce((s, r) => s + r.booked, 0);
    const daysSum = reps.reduce((s, r) => s + r.daysToBookSum, 0);
    const daysCount = reps.reduce((s, r) => s + r.daysToBookCount, 0);
    return {
      sent,
      booked,
      owed: reps.reduce((s, r) => s + r.owed, 0),
      ratio: sent > 0 ? Math.round((booked / sent) * 100) : 0,
      avgDays: daysCount > 0 ? Math.round(daysSum / daysCount) : 0,
    };
  }, [reps]);

  const awards = useMemo(() => computeAwards(reps), [reps]);
  const awardByRep = useMemo(() => {
    const m = new Map<string, AwardId[]>();
    for (const a of awards) {
      const arr = m.get(a.winnerKey) || [];
      arr.push(a.id);
      m.set(a.winnerKey, arr);
    }
    return m;
  }, [awards]);

  const { toast } = useToast();
  const handleConfirmPay = async () => {
    if (!confirmRep) return;
    setPaying(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const res = await markSalespersonPaid({
        email: confirmRep.email,
        name: confirmRep.name,
        proposalIds: confirmRep.unpaidProposalIds,
        paidBy: user?.email || "staff",
        feeByTerritory,
      });
      if (res) {
        toast({
          title: "Sales rep paid",
          description: `Recorded $${res.amount.toLocaleString()} for ${res.count} proposal${res.count === 1 ? "" : "s"}.`,
        });
        setConfirmRep(null);
        onRefresh?.();
      } else {
        toast({
          title: "Nothing to pay",
          description: "These proposals were already marked paid.",
        });
        setConfirmRep(null);
        onRefresh?.();
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to mark paid",
        description: e?.message || "Unknown error",
      });
    } finally {
      setPaying(false);
    }
  };

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
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Period:</span>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="h-8 w-full flex-1 md:w-[180px] md:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <SalesRepPodium reps={reps} />

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
        <Card className="col-span-2 border-amber-500/20 md:col-span-1">
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              Owed (send fees)
            </div>
            <div className="text-2xl font-semibold mt-1 text-amber-600 dark:text-amber-400">
              ${totals.owed.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              ${DEFAULT_SALESPERSON_SEND_FEE}/first send · staff only
            </div>
          </CardContent>
        </Card>
      </div>

      {reps.some((r) => r.bookedValue > 0) && (
        <div className="text-sm text-muted-foreground">
          Leading this period:{" "}
          <span className="font-medium text-foreground">{reps[0].name}</span> ·
          ${reps[0].bookedValue.toLocaleString()} booked
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {reps.map((rep, rankIndex) => {
          const ratio = rep.sent > 0 ? Math.round((rep.booked / rep.sent) * 100) : 0;
          const isOpen = expanded === rep.key;
          const rank = rankIndex + 1;
          const proposalsSorted = [...rep.proposals].sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime(),
          );
          return (
            <div key={rep.key} className="space-y-3 rounded-xl border bg-card p-4">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() =>
                  setExpanded((cur) => (cur === rep.key ? null : rep.key))
                }
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{rank}</span>
                    <span className="truncate text-lg font-semibold">{rep.name}</span>
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{rep.email}</div>
                </div>
                {isOpen ? (
                  <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {(awardByRep.get(rep.key) || []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(awardByRep.get(rep.key) || []).map((aid) => (
                    <span
                      key={aid}
                      className="inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                    >
                      {AWARD_LABELS[aid]}
                    </span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Sent</div>
                  <div className="font-semibold">{rep.sent}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Booked</div>
                  <div className="font-semibold text-green-600">{rep.booked}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Close ratio</div>
                  <div className="font-semibold">{ratio}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Booked value</div>
                  <div className="font-semibold">${rep.bookedValue.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pipeline</div>
                  <div className="font-semibold">${rep.totalValue.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Owed</div>
                  <div className="font-semibold text-amber-600">${rep.owed.toLocaleString()}</div>
                </div>
              </div>
              <Button
                className={
                  rep.owed === 0
                    ? "h-11 w-full bg-muted text-muted-foreground"
                    : "h-11 w-full bg-green-600 text-white hover:bg-green-700"
                }
                disabled={rep.owed === 0}
                onClick={() => setConfirmRep(rep)}
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                {rep.owed > 0 ? `Mark $${rep.owed.toLocaleString()} paid` : "Paid"}
              </Button>
              {isOpen && (
                <div className="space-y-2 border-t pt-3">
                  <div className="text-sm font-medium text-muted-foreground">
                    {rep.name}'s proposals
                  </div>
                  {proposalsSorted.map((p) => {
                    const booked = isBooked(p);
                    return (
                      <div key={p.id} className="space-y-1 rounded-lg border p-3">
                        <div className="font-medium">{p.client_name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.client_email}
                        </div>
                        <div className="text-sm">
                          {formatDisplayDate(p.wedding_date)} · $
                          {Number(p.total_amount || 0).toLocaleString()}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {booked ? (
                            <Badge className="border-green-500/20 bg-green-500/10 text-green-700">
                              Booked
                            </Badge>
                          ) : p.status === "superseded" ? (
                            <Badge className="border-slate-500/20 bg-slate-500/10 text-slate-600">
                              Superseded
                            </Badge>
                          ) : (
                            <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-700">
                              Pending
                            </Badge>
                          )}
                          <ProposalCountdownBadge proposal={p} />
                        </div>
                        <Button
                          variant="outline"
                          className="h-10 w-full"
                          onClick={() => window.open(`/proposal/${p.id}`, "_blank")}
                        >
                          Open
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Sales Reps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="w-12 text-center">Rank</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-center">Sent</TableHead>
                  <TableHead className="text-center">Booked</TableHead>
                  <TableHead className="text-center">Close Ratio</TableHead>
                  <TableHead className="text-right">Booked Value</TableHead>
                  <TableHead className="text-right">Pipeline</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps.map((rep, rankIndex) => {
                  const ratio =
                    rep.sent > 0
                      ? Math.round((rep.booked / rep.sent) * 100)
                      : 0;
                  const avgDays =
                    rep.daysToBookCount > 0
                      ? Math.round(rep.daysToBookSum / rep.daysToBookCount)
                      : null;
                  const isOpen = expanded === rep.key;
                  const rank = rankIndex + 1;
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
                        <TableCell className="text-center">
                          {rank <= 3 ? (
                            <Badge
                              className={
                                rank === 1
                                  ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                                  : rank === 2
                                    ? "bg-slate-400/15 text-slate-600 dark:text-slate-300 border-slate-400/30"
                                    : "bg-amber-700/15 text-amber-800 dark:text-amber-300 border-amber-700/30"
                              }
                            >
                              {rank}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {rank}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{rep.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {rep.email}
                          </div>
                          {(awardByRep.get(rep.key) || []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(awardByRep.get(rep.key) || []).map((aid) => (
                                <span
                                  key={aid}
                                  className="inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                                >
                                  {AWARD_LABELS[aid]}
                                </span>
                              ))}
                            </div>
                          )}
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
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={
                                ratio >= 50
                                  ? "h-full bg-green-500"
                                  : ratio >= 25
                                    ? "h-full bg-amber-500"
                                    : "h-full bg-slate-400"
                              }
                              style={{ width: `${Math.min(ratio, 100)}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${rep.bookedValue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${rep.totalValue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">
                          ${rep.owed.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={rep.owed === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmRep(rep);
                            }}
                            className={
                              rep.owed === 0
                                ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                                : "bg-green-600 hover:bg-green-700 text-white"
                            }
                          >
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                            {rep.owed > 0
                              ? `Mark $${rep.owed.toLocaleString()}`
                              : "Paid"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${rep.key}-detail`}>
                          <TableCell colSpan={10} className="bg-muted/20 p-0">
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

      <AlertDialog
        open={!!confirmRep}
        onOpenChange={(open) => {
          if (!open) setConfirmRep(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark sales rep paid</AlertDialogTitle>
            <AlertDialogDescription>
              Record a ${confirmRep?.owed.toLocaleString()} send-fee payout for{" "}
              {confirmRep?.unpaidProposalIds.length} proposal
              {confirmRep?.unpaidProposalIds.length === 1 ? "" : "s"} sent by{" "}
              {confirmRep?.name} ({confirmRep?.email}). First send only. Not
              visible to the salesperson.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmRep && confirmRep.unpaidClientNames.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                Proposals
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {confirmRep.unpaidClientNames.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmPay();
              }}
              disabled={paying}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {paying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Yes, mark paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
