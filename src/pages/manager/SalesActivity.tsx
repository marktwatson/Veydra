import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  runSalesActivityReport,
  type SalesActivityResult,
  type SalesRecipientChoice,
} from "@/lib/sales-activity-api";
import { RefreshCw, Mail } from "lucide-react";
import { SendReportEmailModal } from "@/components/SendReportEmailModal";

const channelVerb = (ch?: string) =>
  ch === "call" ? "called" : ch === "email" ? "emailed" : "texted";

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
      className="rounded-lg border-l-4 p-4 md:p-5"
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

export default function SalesActivity() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [data, setData] = useState<SalesActivityResult | null>(null);

  const run = async (
    sendEmail = false,
    recipients?: SalesRecipientChoice[],
  ) => {
    if (sendEmail) setEmailing(true);
    else setLoading(true);
    try {
      const result = await runSalesActivityReport({ sendEmail, recipients });
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
              ? `${sent} sent, ${failed} failed — check CRM delivery logs below.`
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
  const outreachPct = cm?.outreachPct ?? 0;

  // red / amber / blue / green / purple
  const C = {
    red: "hsl(0 84% 60%)",
    amber: "hsl(38 92% 50%)",
    blue: "hsl(217 91% 60%)",
    green: "hsl(142 71% 45%)",
    purple: "hsl(262 60% 60%)",
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-foreground">
            🌸 {company} Daily Sales Report
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

      {data && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">Pool: {data.poolSize} new leads</Badge>
          {data.poolSource && (
            <Badge variant="outline">Source: {data.poolSource}</Badge>
          )}
        </div>
      )}

      {!data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Run the report to generate today's sales memo.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 1) Needs a Reply Right Now */}
          <Section title="🚨 Needs a Reply Right Now" accent={C.red}>
            {data.needsReply.length === 0 ? (
              <p>Inbox is clear. No unanswered new-lead messages.</p>
            ) : (
              <>
                {data.needsReply.slice(0, 1).map((r, i) => (
                  <p key={i}>
                    <span className="font-medium">{r.name}</span>{" "}
                    {channelVerb(r.channel)} {r.hoursAgo ?? "?"} hours ago:{" "}
                    {r.snippet ? `“${r.snippet}”` : "(no message body)"}. Still
                    unanswered —{" "}
                    {r.channel === "email"
                      ? "email"
                      : r.channel === "call"
                        ? "call"
                        : "SMS"}{" "}
                    reply needed.
                  </p>
                ))}
                {data.needsReply.length > 1 && (
                  <div className="pt-1.5 space-y-1">
                    {data.needsReply.slice(1, 6).map((r, i) => (
                      <p key={i} className="text-muted-foreground">
                        {r.name} — {r.hoursAgo ?? "?"}h —{" "}
                        {r.snippet ? `“${r.snippet}”` : "no snippet"}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
          </Section>

          {/* 2) Pipeline Cleanup */}
          <Section title="⚠️ Pipeline Cleanup" accent={C.amber}>
            {data.optedOut.length > 0 ? (
              <>
                <p>
                  {data.optedOut.length} new lead
                  {data.optedOut.length === 1 ? "" : "s"} texted STOP but{" "}
                  {data.optedOut.length === 1 ? "is" : "are"} still in the
                  pipeline:
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {data.optedOut.map((r, i) => (
                    <li key={i}>
                      {r.name} — opted out ~{r.daysAgo ?? "?"} days ago
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No opt-outs lingering in the active pipeline.</p>
            )}
            {data.goingCold[0] &&
              !data.optedOut.some(
                (o) => o.contactId === data.goingCold[0].contactId,
              ) && (
                <p className="pt-1.5">
                  <span className="font-medium">{data.goingCold[0].name}</span>{" "}
                  has been a new lead for {data.goingCold[0].daysAgo}+ days with
                  no recent engagement. Worth one personal attempt before
                  closing out.
                </p>
              )}
          </Section>

          {/* 3) Channel Mix */}
          {cm && (
            <Section title="📞 Channel Mix — This Looks Good" accent={C.blue}>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>
                  {cm.calls} of {mixN} ({cm.callPct}%) new lead conversations
                  involved a phone call.
                </li>
                <li>
                  {outreachPct}% had personal outreach —{" "}
                  {cm.automationOnly.length} automation-only.
                </li>
                <li>
                  {cm.contactedLast24h ?? 0} new leads contacted outbound in the
                  last 24 hours.
                </li>
                <li>
                  Only {cm.email} of {mixN} used email — replies there are easy
                  to miss.
                </li>
              </ul>
            </Section>
          )}

          {/* 4) What's Going Well */}
          <Section title="✅ What's Going Well" accent={C.green}>
            {data.goingWell.length === 0 ? (
              <p>No human calls to new leads in the last 48 hours.</p>
            ) : (
              <p>
                Calls made to new leads in the last 48 hours:{" "}
                {data.goingWell.map((r) => r.name).join(", ")}. That's{" "}
                {data.goingWell.length} personal touch
                {data.goingWell.length === 1 ? "" : "es"} worth celebrating.
              </p>
            )}
          </Section>

          {/* 5) Today's 3 Priorities */}
          <Section title="🎯 Today's 3 Priorities" accent={C.purple}>
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
