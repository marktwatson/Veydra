import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  runSalesActivityReport,
  type SalesActivityResult,
  type SalesActivityRow,
} from "@/lib/sales-activity-api";
import {
  RefreshCw,
  Target,
  Reply,
  MailWarning,
  Snowflake,
  PieChart,
  ThumbsUp,
  Phone,
  MessageSquare,
  Mail,
  Bot,
  AlertTriangle,
} from "lucide-react";

const channelIcon = (ch?: string) => {
  switch (ch) {
    case "call":
      return <Phone className="h-3.5 w-3.5" />;
    case "sms":
      return <MessageSquare className="h-3.5 w-3.5" />;
    case "email":
      return <Mail className="h-3.5 w-3.5" />;
    case "automation":
      return <Bot className="h-3.5 w-3.5" />;
    default:
      return <MessageSquare className="h-3.5 w-3.5" />;
  }
};

const channelLabel = (ch?: string) =>
  ch === "call"
    ? "Call"
    : ch === "sms"
      ? "SMS"
      : ch === "email"
        ? "Email"
        : ch === "automation"
          ? "Automation"
          : ch || "Other";

function RowList({
  rows,
  emptyMsg,
  renderRight,
}: {
  rows: SalesActivityRow[];
  emptyMsg: string;
  renderRight?: (r: SalesActivityRow) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-3">{emptyMsg}</p>;
  }
  return (
    <div className="divide-y">
      {rows.map((r, i) => (
        <div key={r.contactId || i} className="py-2.5 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{r.name || "Unknown"}</span>
              {r.channel && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  {channelIcon(r.channel)}
                  {channelLabel(r.channel)}
                </Badge>
              )}
              {r.hoursAgo != null && (
                <span className="text-[11px] text-muted-foreground">
                  {r.hoursAgo}h ago
                </span>
              )}
              {r.daysAgo != null && (
                <span className="text-[11px] text-muted-foreground">
                  {r.daysAgo}d ago
                </span>
              )}
              {r.automationOnly && (
                <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]">
                  Automation only
                </Badge>
              )}
            </div>
            {r.snippet && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {r.snippet}
              </p>
            )}
            {r.what && (
              <p className="text-xs text-muted-foreground mt-0.5">{r.what}</p>
            )}
            {r.note && (
              <p className="text-xs text-destructive mt-0.5">{r.note}</p>
            )}
            {(r.phone || r.email) && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {r.phone || r.email}
              </p>
            )}
          </div>
          {renderRight?.(r)}
        </div>
      ))}
    </div>
  );
}

export default function SalesActivity() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [data, setData] = useState<SalesActivityResult | null>(null);

  const run = async (sendEmail = false) => {
    if (sendEmail) setEmailing(true);
    else setLoading(true);
    try {
      const result = await runSalesActivityReport({ sendEmail });
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
              ? `${sent} sent, ${failed} failed — see report.`
              : `Sent to ${sent} recipient(s).`,
          variant: sent > 0 ? "default" : "destructive",
        });
      } else if (result.errors.length) {
        toast({
          title: "Report ran with warnings",
          description: `${result.errors.length} issue(s) — see errors.`,
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

  const cm = data?.channelMix;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">
            Sales Activity
          </h1>
          <p className="text-muted-foreground mt-1">
            New-lead follow-up report from your CRM conversations.
          </p>
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
            onClick={() => run(true)}
            disabled={loading || emailing || !data}
          >
            <Mail className="w-4 h-4 mr-2" />
            {emailing ? "Sending…" : "Email report"}
          </Button>
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">Pool: {data.poolSize} new leads</Badge>
          {data.poolSource && (
            <Badge variant="outline">Source: {data.poolSource}</Badge>
          )}
          {data.errors.length > 0 && (
            <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
              {data.errors.length} warning(s)
            </Badge>
          )}
        </div>
      )}

      {/* 1) Today's Priorities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Today's Priorities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <p className="text-sm text-muted-foreground py-3">
              Run the report to see priorities.
            </p>
          ) : data.priorities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">
              None — inbox is clear.
            </p>
          ) : (
            <div className="space-y-3">
              {data.priorities.map((p, i) => (
                <div
                  key={p.contactId || i}
                  className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.why}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 2) Needs a Reply Right Now */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Reply className="h-5 w-5 text-primary" />
              Needs a Reply Right Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data ? (
              <p className="text-sm text-muted-foreground py-3">
                Run the report.
              </p>
            ) : (
              <RowList
                rows={data.needsReply}
                emptyMsg="None — inbox is clear"
              />
            )}
          </CardContent>
        </Card>

        {/* 3) Email Blind Spot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailWarning className="h-5 w-5 text-amber-600" />
              Email Blind Spot
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data ? (
              <p className="text-sm text-muted-foreground py-3">
                Run the report.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  These hide from the main SMS inbox.
                </p>
                <RowList
                  rows={data.emailBlindSpot}
                  emptyMsg="None — no unanswered emails"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4) Going Cold */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-blue-500" />
            Going Cold
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <p className="text-sm text-muted-foreground py-3">
              Run the report.
            </p>
          ) : (
            <RowList
              rows={data.goingCold}
              emptyMsg="None — all leads are warm"
            />
          )}
        </CardContent>
      </Card>

      {/* 5) Channel Mix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Channel Mix
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data || !cm ? (
            <p className="text-sm text-muted-foreground py-3">
              Run the report.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <Phone className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-semibold">{cm.calls}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Human calls ({cm.callPct}%)
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-semibold">{cm.manualSms}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Manual SMS
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <Mail className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-semibold">{cm.email}</p>
                  <p className="text-[11px] text-muted-foreground">Email</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <Bot className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-semibold">{cm.automation}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Automation
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Call ratio: {cm.callRatio}</Badge>
                {cm.contactedLast24h != null && (
                  <Badge variant="outline">
                    {cm.contactedLast24h} contacted in 24h
                  </Badge>
                )}
                {cm.emailBlindSpotWarning && (
                  <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Low email (&lt;15%)
                  </Badge>
                )}
              </div>

              {cm.automationOnly.length > 0 && (
                <div>
                  <Separator className="my-3" />
                  <p className="text-xs font-medium mb-2">
                    Automation-only leads (no human touch)
                  </p>
                  <RowList rows={cm.automationOnly} emptyMsg="None" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6) What's Going Well */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 text-green-600" />
            What's Going Well
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <p className="text-sm text-muted-foreground py-3">
              Run the report.
            </p>
          ) : (
            <RowList rows={data.goingWell} emptyMsg="None yet" />
          )}
        </CardContent>
      </Card>

      {data && data.optedOut.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Opted Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RowList rows={data.optedOut} emptyMsg="None" />
          </CardContent>
        </Card>
      )}

      {data?.reportText && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Report Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-4 max-h-96 overflow-auto">
              {data.reportText}
            </pre>
          </CardContent>
        </Card>
      )}

      {data?.emailResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Email Delivery — {data.emailResult.subject}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1">
              {data.emailResult.recipients.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      r.status === "sent"
                        ? "border-green-500/30 text-green-700"
                        : "border-destructive/30 text-destructive"
                    }
                  >
                    {r.status}
                  </Badge>
                  <span className="text-muted-foreground">{r.email}</span>
                  {r.code && (
                    <span className="text-muted-foreground">({r.code})</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data && data.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Errors / Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-1">
              {data.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
