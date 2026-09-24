import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  runSalesActivityReport,
  type SalesActivityResult,
  type SalesRecipientChoice,
  type SalesRange,
  type SalesGrade,
} from "@/lib/sales-activity-api";
import {
  RefreshCw,
  Mail,
  Clock,
  TrendingDown,
  Phone,
  AlertTriangle,
} from "lucide-react";
import { SendReportEmailModal } from "@/components/SendReportEmailModal";
import {
  SalesTrendChart,
  SalesFunnelChart,
  SALES_COLORS,
} from "@/components/SalesCharts";
import { LeadIntelTable } from "@/components/LeadIntelTable";

const RANGE_OPTIONS: { value: SalesRange; label: string }[] = [
  { value: 1, label: "24 hours" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
];

const channelVerb = (ch?: string) =>
  ch === "Call" ? "called" : ch === "Email" ? "emailed" : "texted";

const GRADE_STYLE: Record<SalesGrade, string> = {
  Critical: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  High: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  Medium:
    "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Low: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
};

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-lg border-l-4 p-4 md:p-5 bg-card"
      style={{ borderLeftColor: accent }}
    >
      <h2 className="font-serif text-lg md:text-xl text-foreground mb-2">
        {title}
      </h2>
      <div className="text-sm leading-relaxed text-foreground/90 space-y-1.5">
        {children}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      className="rounded-lg border p-3 bg-card flex items-start gap-3"
      style={{ borderColor: `${accent}40` }}
    >
      {icon && (
        <div
          className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-2xl font-bold text-foreground tabular-nums">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && (
          <div className="text-[11px] text-muted-foreground/80 mt-0.5">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function GradeBadge({ grade }: { grade: SalesGrade }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${GRADE_STYLE[grade]}`}
    >
      {grade}
    </span>
  );
}

export default function SalesActivity() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [data, setData] = useState<SalesActivityResult | null>(null);
  const [range, setRange] = useState<SalesRange>(1);

  const run = async (
    sendEmail = false,
    recipients?: SalesRecipientChoice[],
  ) => {
    if (sendEmail) setEmailing(true);
    else setLoading(true);
    try {
      const result = await runSalesActivityReport({
        sendEmail,
        recipients,
        range,
        includeHistory: true,
      });
      setData(result);
      if (sendEmail && result.emailResult) {
        const sent = result.emailResult.recipients.filter(
          (r) => r.status === "sent",
        ).length;
        const failed = result.emailResult.recipients.length - sent;
        toast({
          title: sent > 0 ? "Report emailed" : "Email failed",
          description:
            failed > 0
              ? `${sent} sent, ${failed} failed — check delivery logs below.`
              : `Successfully sent to ${sent} recipient(s).`,
          variant: sent > 0 ? "default" : "destructive",
        });
        setEmailModalOpen(false);
      } else if (result.errors.length) {
        toast({
          title: "Report ran with warnings",
          description: `${result.errors.length} issue(s) — see footer.`,
          variant: "default",
        });
      }
    } catch (e: any) {
      toast({
        title: "Report failed",
        description: e?.message || "Could not run the report.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setEmailing(false);
    }
  };

  const company = data?.companyName || "Veydra";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const cm = data?.channelMix;
  const mixN = cm?.total ?? 0;
  const rp = data?.responsePerformance;
  const fn = data?.funnel;
  const C = SALES_COLORS;
  const flagged = data
    ? (data.needsReply?.length || 0) +
      (data.ghostLeads?.length || 0) +
      (data.missedCalls?.length || 0) +
      (data.goingCold?.length || 0) +
      (data.optedOut?.length || 0)
    : 0;
  const criticalCount =
    data?.needsReply?.filter((r) => r.grade === "Critical").length || 0;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-foreground">
              🌸 {company} Sales Conversation Quality Report
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            {data?.ranAt && (
              <span className="text-xs text-muted-foreground">
                Last run: {new Date(data.ranAt).toLocaleString()}
              </span>
            )}
            <Button onClick={() => run(false)} disabled={loading || emailing}>
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Running…" : "Run report"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setEmailModalOpen(true)}
              disabled={loading || emailing || !data}
            >
              <Mail className="w-4 h-4 mr-2" />
              {emailing ? "Sending…" : "Email report"}
            </Button>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">
            Window:
          </span>
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                disabled={loading || emailing}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${range === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {data?.rangeLabel && (
            <Badge variant="outline" className="text-[11px]">
              Showing {data.rangeLabel}
            </Badge>
          )}
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
          <Badge variant="secondary">
            Active Pool: {data.poolSize} unbooked leads
          </Badge>
          <Badge
            variant="outline"
            className="border-primary/40 text-primary font-medium"
          >
            New in {data.rangeLabel || "window"}:{" "}
            {data.windowNewLeadsCount ?? 0} leads
          </Badge>
          <Badge variant="outline">Flagged: {flagged}</Badge>
          {criticalCount > 0 && (
            <Badge variant="outline" className="border-red-500/40 text-red-600">
              Critical: {criticalCount}
            </Badge>
          )}
          {data.poolSource && (
            <Badge variant="outline">Source: {data.poolSource}</Badge>
          )}
        </div>
      )}

      {!data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Run the report to generate today's sales conversation quality
            report.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* KPI Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Leads Reviewed"
              value={data.poolSize}
              sub={`${data.windowNewLeadsCount ?? 0} new in window`}
              icon={<Clock className="w-4 h-4" />}
              accent={C.blue}
            />
            <StatCard
              label="Flagged"
              value={flagged}
              sub="across all categories"
              icon={<AlertTriangle className="w-4 h-4" />}
              accent={C.red}
            />
            <StatCard
              label="Critical"
              value={criticalCount}
              sub="urgent replies needed"
              icon={<TrendingDown className="w-4 h-4" />}
              accent={C.red}
            />
            <StatCard
              label="Call Coverage"
              value={`${cm?.callPct ?? 0}%`}
              sub={`${cm?.calls ?? 0} of ${mixN} convs`}
              icon={<Phone className="w-4 h-4" />}
              accent={C.purple}
            />
          </div>

          {/* Trend Charts */}
          {data.history && data.history.length > 0 && (
            <SalesTrendChart history={data.history} />
          )}

          {/* Funnel */}
          {fn && <SalesFunnelChart funnel={fn} />}

          {/* 1) Needs a Reply Right Now */}
          <Section title="🚨 Leads Waiting for a Reply" accent={C.red}>
            {data.needsReply.length === 0 ? (
              <p style={{ color: C.green }}>
                ✅ Inbox is clear. No unanswered new-lead messages.
              </p>
            ) : (
              <div className="space-y-2">
                {data.needsReply.slice(0, 8).map((r, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 pb-2 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <GradeBadge grade={r.grade || "Low"} />
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {channelVerb(r.channel)} {r.hoursAgo ?? "?"}h ago
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-right sm:flex-shrink-0">
                      {r.snippet ? `"${r.snippet}"` : "(no body)"}
                      {r.replyHours != null && (
                        <span className="ml-2">
                          (last reply: {r.replyHours}h)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {data.needsReply.length > 8 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    +{data.needsReply.length - 8} more waiting…
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* 2) Ghost Leads */}
          <Section title="👻 Brand New Leads — No First Touch" accent={C.amber}>
            {(data.ghostLeads?.length || 0) === 0 ? (
              <p style={{ color: C.green }}>
                ✅ All new leads (last 24h) received a human touch.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">
                  {data.ghostLeads?.length} lead(s) in active pool (created 24h+
                  ago) with no human contact (automation only or nothing).
                </p>
                {data.ghostLeads?.slice(0, 8).map((r, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>{r.name}</span>
                    <span>
                      {r.daysAgo ?? "?"}d ago · {r.source}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 3) Missed Calls */}
          <Section title="📞 Missed Inbound Calls" accent={C.purple}>
            {(data.missedCalls?.length || 0) === 0 ? (
              <p>No missed inbound calls detected.</p>
            ) : (
              <div className="space-y-1">
                {data.missedCalls?.slice(0, 8).map((r, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground">
                      {r.hoursAgo ?? "?"}h ago ·{" "}
                      {r.followedUp ? (
                        "followed up"
                      ) : (
                        <span className="text-red-600 font-medium">
                          NO follow-up
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 4) Going Cold / Pipeline Cleanup */}
          <Section title="⚠️ Going Cold / Pipeline Cleanup" accent={C.amber}>
            {data.optedOut.length > 0 && (
              <div className="mb-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-xs">
                <span className="font-medium text-red-700 dark:text-red-400">
                  ⚠️ Compliance risk:
                </span>{" "}
                {data.optedOut.length} opt-out(s) still tagged active.
              </div>
            )}
            {data.optedOut.length > 0 && (
              <div className="space-y-1 mb-2">
                {data.optedOut.slice(0, 6).map((r, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>{r.name}</span>
                    <span>
                      {r.signal} · {r.daysAgo ?? "?"}d
                    </span>
                  </div>
                ))}
              </div>
            )}
            {data.goingCold[0] &&
              !data.optedOut.some(
                (o) => o.contactId === data.goingCold[0].contactId,
              ) && (
                <p className="text-xs">
                  <span className="font-medium">{data.goingCold[0].name}</span>{" "}
                  — {data.goingCold[0].daysAgo}d cold, last:{" "}
                  {data.goingCold[0].channel}.
                </p>
              )}
            {data.optedOut.length === 0 && data.goingCold.length === 0 && (
              <p>No cold leads or opt-outs.</p>
            )}
          </Section>

          {/* 5) Automation-Only */}
          <Section
            title="🤖 Single-Touch Leads (Automation Only)"
            accent={C.blue}
          >
            {(data.automationOnly?.length || 0) === 0 ? (
              <p style={{ color: C.green }}>
                ✅ No pure automation-only leads.
              </p>
            ) : (
              <div className="space-y-1">
                {data.automationOnly?.slice(0, 6).map((r, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>{r.name}</span>
                    <span>{r.hoursAgo ?? "?"}h ago</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 6) Weekend Catch-Up (Mondays only) */}
          {data.weekendCatchUp != null && (
            <Section title="📅 Weekend Catch-Up (Monday)" accent={C.green}>
              {data.weekendCatchUp.length === 0 ? (
                <p style={{ color: C.green }}>
                  ✅ All weekend leads contacted promptly.
                </p>
              ) : (
                <div className="space-y-1">
                  <p>
                    {data.weekendCatchUp.length} weekend lead(s) waited 6h+ for
                    a human response:
                  </p>
                  {data.weekendCatchUp.slice(0, 5).map((r, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-xs text-muted-foreground"
                    >
                      <span>{r.name}</span>
                      <span>{r.hoursAgo ?? "?"}h wait</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* 7) Channel Mix */}
          {cm && (
            <Section title="📊 Channel Ratio" accent={C.blue}>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>
                  Calls: {cm.calls} (
                  {Math.round((cm.calls / (mixN || 1)) * 100)}%)
                </li>
                <li>
                  SMS: {cm.manualSms} (
                  {Math.round((cm.manualSms / (mixN || 1)) * 100)}%)
                </li>
                <li>
                  Email: {cm.email} (
                  {Math.round((cm.email / (mixN || 1)) * 100)}%)
                </li>
                <li>
                  Automation: {cm.automation} (
                  {Math.round((cm.automation / (mixN || 1)) * 100)}%)
                </li>
                <li className="pt-1">
                  {cm.outreachPct ?? 0}% had personal outreach —{" "}
                  {cm.automationOnly.length} automation-only.
                </li>
                <li>
                  {cm.contactedInRange ?? 0} contacted outbound in{" "}
                  {data.rangeLabel || "window"}.
                </li>
              </ul>
            </Section>
          )}

          {/* 8) Response Performance */}
          {rp && (
            <Section title="⏱️ Response Performance" accent={C.purple}>
              {rp.count === 0 ? (
                <p>No reply-time data in this window yet.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>
                    Average response time: {rp.avgHours ?? "?"}h across{" "}
                    {rp.count} replies.
                  </li>
                  <li>
                    {rp.slaBreaches} breached the {rp.slaThresholdHours}h SLA.
                  </li>
                  {rp.slowestName && (
                    <li>
                      Slowest: {rp.slowestName} waited {rp.slowestHours}h.
                    </li>
                  )}
                </ul>
              )}
            </Section>
          )}

          {/* 9) What's Going Well */}
          <Section title="✅ Wins" accent={C.green}>
            {data.goingWell.length === 0 ? (
              <p>
                No human calls to new leads in {data.rangeLabel || "window"}.
              </p>
            ) : (
              <div className="space-y-1">
                {data.goingWell.slice(0, 5).map((r, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium">{r.name}</span> — {r.what} (
                    {r.hoursAgo ?? "?"}h ago)
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 10) Today's 3 Priorities */}
          <Section title="🎯 Top 3 Priorities" accent={C.purple}>
            {data.priorities.length === 0 ? (
              <p>No urgent items — use the time to call a cold lead.</p>
            ) : (
              <ol className="list-decimal pl-5 space-y-1">
                {data.priorities.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium">{p.action}</span>
                    {p.why ? ` — ${p.why}` : ""}
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {/* 11) Lead Intelligence Table */}
          {data.leadIntel && data.leadIntel.length > 0 && (
            <LeadIntelTable leads={data.leadIntel} />
          )}

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center pt-2">
            {company} | Automated Daily Sales Report | Generated{" "}
            {new Date().toLocaleString()}
          </p>

          {/* Email delivery status */}
          {data.emailResult && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="text-xs font-medium text-muted-foreground text-center">
                Email Delivery Status:
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-center items-center">
                {data.emailResult.recipients.map((r, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center sm:items-start text-xs max-w-sm"
                  >
                    <Badge
                      variant="outline"
                      className={
                        r.status === "sent"
                          ? "border-green-500/30 text-green-700 bg-green-50/50 dark:bg-green-950/20"
                          : "border-destructive/30 text-destructive bg-destructive/5"
                      }
                    >
                      {r.email}: {r.status} {r.code ? `(${r.code})` : ""}
                    </Badge>
                    {r.error && (
                      <span className="text-[11px] text-destructive/80 mt-0.5 max-w-xs truncate text-center sm:text-left">
                        {r.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {data.errors.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {data.errors.length} warning(s): {data.errors.join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* Recipient Selection Modal */}
      <SendReportEmailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        onSend={async (recipients) => {
          await run(true, recipients);
        }}
        isSending={emailing}
        companyName={company}
      />
    </div>
  );
}
