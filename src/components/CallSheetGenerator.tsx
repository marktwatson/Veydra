import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { computeBookedHours } from "@/lib/booked-hours";
import {
  buildCallSheetHtml,
  flattenQuestionnaire,
  escapeHtml,
  type TeamMemberLite,
} from "@/lib/call-sheet-builders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Loader2, Send, Printer, Mail, Users } from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import EmailPreviewModal, {
  EmailPreviewData,
} from "@/components/EmailPreviewModal";

export interface CallSheetGeneratorProps {
  weddingId: string;
  weddingName: string;
  trigger?: React.ReactNode;
}

/** Active assignment statuses that count as "on the team". */
const ACTIVE_STATUSES = [
  "upcoming",
  "accepted",
  "confirmed",
  "assigned",
  "action required",
];

export function CallSheetGenerator({
  weddingId,
  weddingName,
  trigger,
}: CallSheetGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const [emailPreview, setEmailPreview] = useState<EmailPreviewData | null>(
    null,
  );
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewSend, setEmailPreviewSend] = useState<
    (() => Promise<void>) | null
  >(null);

  const { data: wedding, isLoading: isLoadingWedding } = useQuery({
    queryKey: ["wedding", weddingId],
    queryFn: () => api.getPublicWedding(weddingId),
    enabled: isOpen,
  });

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
    enabled: isOpen,
  });

  const isLoading = isLoadingWedding;

  // Build the team list from the nested wedding.jobs.assignments.contractors
  // returned by getPublicWedding — same source of truth as the bride portal.
  const teamMembers: TeamMemberLite[] = (() => {
    if (!wedding) return [];
    const jobs = (wedding as any).jobs;
    if (!Array.isArray(jobs)) return [];
    const members: TeamMemberLite[] = [];
    for (const job of jobs) {
      const assignments = job.assignments;
      if (!Array.isArray(assignments)) continue;
      for (const a of assignments) {
        if (!ACTIVE_STATUSES.includes(String(a.status || "").toLowerCase()))
          continue;
        const c = a.contractors;
        if (!c) continue;
        members.push({
          id: c.id || `${job.role}-${members.length}`,
          role: job.role || "Team Member",
          firstName: c.first_name || "",
          lastName: c.last_name || "",
          email: c.email || undefined,
          phone: c.phone || undefined,
        });
      }
    }
    return members;
  })();

  let parsedTimeline: any[] = [];
  if (wedding?.timeline) {
    try {
      parsedTimeline =
        typeof wedding.timeline === "string"
          ? JSON.parse(wedding.timeline)
          : wedding.timeline;
      if (!Array.isArray(parsedTimeline)) parsedTimeline = [];
    } catch (e) {
      // Ignore
    }
  }

  let questionnaire: any = null;
  if ((wedding as any)?.questionnaire_data) {
    try {
      questionnaire =
        typeof (wedding as any).questionnaire_data === "string"
          ? JSON.parse((wedding as any).questionnaire_data)
          : (wedding as any).questionnaire_data;
    } catch (e) {
      // Ignore
    }
  }

  let highlightSongs: Array<{
    title: string;
    artist: string;
    link: string;
    moment: string;
  }> = [];
  if ((wedding as any)?.highlight_songs) {
    try {
      const raw = (wedding as any).highlight_songs;
      highlightSongs = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(highlightSongs)) highlightSongs = [];
    } catch (e) {
      // Ignore
    }
  }

  const companyName = settings?.company_name || "Veydra";

  // Package booked + booked hours (coverage = max of lead photo/video roles,
  // never the sum of every job).
  const packageName =
    (wedding as any)?.package_name || (wedding as any)?.package || "";
  const totalHoursBooked = (() => {
    if (!wedding) return 0;
    const jobs = (wedding as any).jobs;
    if (!Array.isArray(jobs)) return 0;
    return computeBookedHours(jobs, (wedding as any)?.coverage_hours);
  })();

  const questionnaireRows = flattenQuestionnaire(questionnaire);

  const html = wedding
    ? buildCallSheetHtml({
        wedding,
        weddingName,
        companyName,
        teamMembers,
        parsedTimeline,
        questionnaireRows,
        highlightSongs,
        packageName,
        totalHoursBooked,
      })
    : "";

  const handlePrint = () => {
    const printContent = document.getElementById("call-sheet-content");
    if (!printContent) return;
    const printWindow = window.open("", "", "width=800,height=900");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Call Sheet - ${weddingName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.5; }
            h1 { margin-bottom: 5px; font-size: 24px; }
            h2 { margin-top: 30px; margin-bottom: 10px; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            table { border-collapse: collapse; margin-top: 10px; width: 100%; }
            th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
            th { font-weight: bold; color: #555; }
            .section { margin-bottom: 20px; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const openSendPreview = (
    to: string,
    subject: string,
    bodyHtml: string,
    recipientName: string,
    performSend: () => Promise<void>,
  ) => {
    setEmailPreview({ to, subject, html: bodyHtml, recipientName });
    setEmailPreviewSend(() => performSend);
    setEmailPreviewOpen(true);
  };

  const handleSendToTeam = () => {
    if (teamMembers.length === 0) {
      toast({
        variant: "destructive",
        title: "No Team Assigned",
        description:
          "There are no active contractors assigned to this wedding.",
      });
      return;
    }
    const subject = `Call Sheet: ${wedding?.client_name || weddingName} Wedding`;
    const firstRecipient =
      teamMembers.find((m) => m.email)?.email || "(team — multiple recipients)";
    openSendPreview(
      firstRecipient,
      subject,
      `<p style="margin-bottom:12px;">Hi team,</p><p style="margin-bottom:12px;">Here is the call sheet and schedule for the upcoming <strong>${escapeHtml(wedding?.client_name || weddingName)}</strong> wedding. Please review the timeline and details.</p>${html}<p style="margin-top:16px;">You can also view this anytime in your contractor portal.</p>`,
      "Contractor Team",
      async () => {
        setIsSending(true);
        try {
          let sentCount = 0;
          for (const member of teamMembers) {
            if (!member.email) continue;
            const personalized = `
              <p style="margin-bottom:12px;">Hi ${escapeHtml(member.firstName || "there")},</p>
              <p style="margin-bottom:12px;">Here is the call sheet and schedule for the upcoming <strong>${escapeHtml(wedding?.client_name || weddingName)}</strong> wedding. Please review the timeline and details.</p>
              ${html}
              <p style="margin-top:16px;">You can also view this anytime in your contractor portal.</p>
            `;
            await api.sendOvantaEmail(
              member.email,
              subject,
              personalized,
              `${member.firstName} ${member.lastName}`.trim(),
              true,
            );
            if (member.phone && settings?.sms_reminder_template) {
              const smsMsg = `Hi ${member.firstName}, the Call Sheet for the ${wedding?.client_name || weddingName} wedding has been sent to your email. Please review the timeline and details!`;
              await api
                .sendOvantaSms(
                  member.email,
                  smsMsg,
                  `${member.firstName} ${member.lastName}`.trim(),
                  true,
                )
                .catch(() => {});
            }
            sentCount++;
          }
          toast({
            title: "Call Sheets Sent!",
            description: `Successfully distributed call sheets to ${sentCount} team member${sentCount === 1 ? "" : "s"}.`,
          });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Failed to send call sheets",
            description: error.message || "An error occurred while sending.",
          });
          throw error;
        } finally {
          setIsSending(false);
        }
      },
    );
  };

  const handleSendToBride = () => {
    const brideEmail = (wedding as any)?.client_email;
    if (!brideEmail) {
      toast({
        variant: "destructive",
        title: "No Email on File",
        description: "This wedding does not have a client email address.",
      });
      return;
    }
    const subject = `Your Wedding Call Sheet — ${wedding?.client_name || weddingName}`;
    const brideName = wedding?.client_name || weddingName;
    openSendPreview(
      brideEmail,
      subject,
      `<p style="margin-bottom:12px;">Hi ${escapeHtml(brideName)},</p><p style="margin-bottom:12px;">Here is the call sheet and timeline for your wedding day with <strong>${escapeHtml(companyName)}</strong>. Please review the schedule and share it with your wedding party as needed.</p>${html}<p style="margin-top:16px;">If you have any questions, just reply to this email and we'll take care of you.</p>`,
      brideName,
      async () => {
        setIsSending(true);
        try {
          await api.sendOvantaEmail(
            brideEmail,
            subject,
            `<p style="margin-bottom:12px;">Hi ${escapeHtml(brideName)},</p><p style="margin-bottom:12px;">Here is the call sheet and timeline for your wedding day with <strong>${escapeHtml(companyName)}</strong>. Please review the schedule and share it with your wedding party as needed.</p>${html}<p style="margin-top:16px;">If you have any questions, just reply to this email and we'll take care of you.</p>`,
            brideName,
            true,
          );
          toast({
            title: "Call Sheet Sent!",
            description: `Emailed to ${brideEmail}`,
          });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Failed to send call sheet",
            description: error.message || "An error occurred while sending.",
          });
          throw error;
        } finally {
          setIsSending(false);
        }
      },
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs cursor-pointer"
            >
              <FileText className="mr-2 h-4 w-4" />
              Call Sheet
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Call Sheet Generator
            </DialogTitle>
            <DialogDescription>
              Generate, preview, print, and distribute the wedding day call
              sheet to the assigned team or the bride. Every send is previewed
              before it goes out.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !wedding ? (
            <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
              Wedding not found.
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto bg-muted/30 rounded-md border p-4">
                <div
                  id="call-sheet-content"
                  className="space-y-6 bg-card p-6 rounded-lg shadow-sm border"
                >
                  {/* Header */}
                  <div className="text-center border-b pb-4">
                    <h1 className="text-2xl font-bold mb-1">
                      {wedding.client_name} Wedding
                    </h1>
                    <p className="text-muted-foreground">
                      {wedding.date
                        ? formatDisplayDate(wedding.date)
                        : "Date TBD"}{" "}
                      • {wedding.location || "Location TBD"}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 uppercase tracking-wider">
                      Call Sheet — {companyName}
                    </p>
                  </div>

                  {/* Team */}
                  <div className="section">
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Assigned Team
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {teamMembers.length}
                      </Badge>
                    </h2>
                    {teamMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No team members assigned yet.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {teamMembers.map((m) => (
                          <div
                            key={m.id}
                            className="team-member flex flex-col rounded-md border border-border/50 p-2.5 bg-muted/20"
                          >
                            <span className="team-role text-sm font-medium">
                              {m.role}
                            </span>
                            <span className="team-name text-sm text-muted-foreground">
                              {m.firstName} {m.lastName}
                            </span>
                            {m.phone && (
                              <span className="text-xs text-muted-foreground">
                                {m.phone}
                              </span>
                            )}
                            {m.email && (
                              <span className="text-xs text-muted-foreground truncate">
                                {m.email}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Booking Summary */}
                  {(packageName || totalHoursBooked > 0) && (
                    <div className="section">
                      <h2 className="text-lg font-semibold border-b pb-2 mb-3">
                        Booking Summary
                      </h2>
                      <div className="grid gap-1.5">
                        {packageName && (
                          <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-sm py-1.5 border-b border-muted last:border-0">
                            <div className="sm:w-44 shrink-0 font-medium text-muted-foreground">
                              Package Booked
                            </div>
                            <div>{packageName}</div>
                          </div>
                        )}
                        {totalHoursBooked > 0 && (
                          <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-sm py-1.5 border-b border-muted last:border-0">
                            <div className="sm:w-44 shrink-0 font-medium text-muted-foreground">
                              Booked hours
                            </div>
                            <div>{totalHoursBooked} hrs</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="section">
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3">
                      Schedule / Timeline
                    </h2>
                    {parsedTimeline.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No timeline events added yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {parsedTimeline.map((event: any, i: number) => (
                          <div
                            key={i}
                            className="flex gap-4 text-sm py-1 border-b border-muted last:border-0"
                          >
                            <div className="w-24 font-medium shrink-0">
                              {event.time}
                            </div>
                            <div>{event.event}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="section space-y-4">
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3">
                      Important Details
                    </h2>
                    {wedding.vip_names && (
                      <div>
                        <h3 className="text-sm font-medium mb-1">
                          VIPs / Family
                        </h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {wedding.vip_names}
                        </p>
                      </div>
                    )}
                    {wedding.vendors && (
                      <div>
                        <h3 className="text-sm font-medium mb-1">
                          Other Vendors
                        </h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {wedding.vendors}
                        </p>
                      </div>
                    )}
                    {wedding.special_requests && (
                      <div>
                        <h3 className="text-sm font-medium mb-1">
                          Special Requests / Notes
                        </h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {wedding.special_requests}
                        </p>
                      </div>
                    )}
                    {!wedding.vip_names &&
                      !wedding.vendors &&
                      !wedding.special_requests && (
                        <p className="text-sm text-muted-foreground italic">
                          No additional details provided.
                        </p>
                      )}
                  </div>

                  {/* Bride Questionnaire */}
                  {questionnaireRows.length > 0 && (
                    <div className="section">
                      <h2 className="text-lg font-semibold border-b pb-2 mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Bride Questionnaire
                      </h2>
                      <div className="grid gap-1.5">
                        {questionnaireRows.map((r, i) => (
                          <div
                            key={i}
                            className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-sm py-1.5 border-b border-muted last:border-0"
                          >
                            <div className="sm:w-44 shrink-0 font-medium text-muted-foreground">
                              {r.label}
                            </div>
                            <div className="whitespace-pre-wrap">{r.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Highlight Songs */}
                  {highlightSongs.length > 0 && (
                    <div className="section">
                      <h2 className="text-lg font-semibold border-b pb-2 mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Highlight Songs
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {highlightSongs.length}
                        </Badge>
                      </h2>
                      <div className="space-y-2">
                        {highlightSongs.map((s, i) => (
                          <div
                            key={i}
                            className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-sm py-1 border-b border-muted last:border-0"
                          >
                            <div className="sm:w-32 shrink-0 font-medium">
                              {s.moment || "—"}
                            </div>
                            <div className="flex-1">
                              {s.title || "Untitled"}
                              {s.artist ? ` — ${s.artist}` : ""}
                            </div>
                            {s.link && (
                              <div className="text-xs text-muted-foreground truncate sm:max-w-[180px]">
                                {s.link}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-4 mt-2">
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print / Save PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendToBride}
                  disabled={isSending || !(wedding as any)?.client_email}
                  title={
                    (wedding as any)?.client_email
                      ? "Email call sheet to the bride"
                      : "No client email on file"
                  }
                >
                  {isSending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Email to Bride
                </Button>
                <Button
                  onClick={handleSendToTeam}
                  disabled={isSending || teamMembers.length === 0}
                >
                  {isSending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Distribute to Team
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <EmailPreviewModal
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
        emailData={emailPreview}
        sendLabel="Approve & Send Call Sheet"
        onConfirm={async () => {
          if (emailPreviewSend) {
            await emailPreviewSend();
          }
        }}
      />
    </>
  );
}
