import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Loader2,
  Send,
  Printer,
  Mail,
  Eye,
  Users,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
// DropdownMenuItem removed — using Button instead for standalone rendering
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

  // Preview-before-send state
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
  // returned by getPublicWedding — this guarantees we use the same source of
  // truth as the bride portal and includes contractor email + phone.
  const teamMembers: Array<{
    id: string;
    role: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
  }> = (() => {
    if (!wedding) return [];
    const jobs = (wedding as any).jobs;
    if (!Array.isArray(jobs)) return [];
    const members: Array<any> = [];
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
          avatarUrl: c.avatar_url || undefined,
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

  // Parse the bride questionnaire so we can surface all of it on the call sheet.
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

  // Highlight songs (separate column on the wedding record)
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

  // Package booked + total hours booked (sum across all jobs/positions).
  const packageName =
    (wedding as any)?.package_name || (wedding as any)?.package || "";
  const totalHoursBooked = (() => {
    if (!wedding) return 0;
    const jobs = (wedding as any).jobs;
    if (!Array.isArray(jobs)) return 0;
    let total = 0;
    for (const job of jobs) {
      const h = Number(job.hours);
      if (!isNaN(h) && h > 0) total += h;
    }
    return total;
  })();

  /** Flattens the questionnaire into labeled rows for display. */
  const questionnaireRows: Array<{ label: string; value: string }> = (() => {
    if (!questionnaire) return [];
    const rows: Array<{ label: string; value: string }> = [];
    const push = (label: string, value: any) => {
      if (value === undefined || value === null) return;
      const s = String(value).trim();
      if (!s) return;
      rows.push({ label, value: s });
    };
    const c = questionnaire.contact_info || {};
    push("Bride Name", c.bride_full_name);
    push("Groom/Partner Name", c.groom_full_name);
    push("Bride Phone", c.phone_bride);
    push("Groom/Partner Phone", c.phone_groom);
    push("Preferred Contact", c.preferred_contact_method);
    push("Best Contact Time", c.best_contact_time);
    push(
      "Emergency Contact",
      (questionnaire.family_details || {}).emergency_contact,
    );

    const sv = questionnaire.style_vibe || {};
    push("Wedding Theme", sv.wedding_theme);
    push("Dress Code", sv.dress_code);
    push("Florist", sv.florist_name);
    push("Decor Style", sv.decor_style);
    push("Pinterest Link", sv.pinterest_link);

    const pv = questionnaire.photo_video || {};
    push("First Look", pv.first_look);
    push("Must-Have Photos", pv.must_have_photos);
    push("Must-Have Video Moments", pv.must_have_video_moments);
    push("Audio Vows/Toasts", pv.audio_vows_toasts);
    push("Photography Restrictions", pv.photography_restrictions);
    push("Special Photo Locations", pv.special_photo_locations);
    push("Don't Want Captured", pv.dont_want_captured);

    const fd = questionnaire.family_details || {};
    push("Bride's Parents", fd.bride_parents_names);
    push("Groom's Parents", fd.groom_parents_names);
    push("Family to Prioritize", fd.family_members_to_prioritize);
    push("Sensitive Family Situations", fd.sensitive_family_situations);

    const wp = questionnaire.wedding_party || {};
    push("Wedding Party Size", wp.wedding_party_size);
    push("Special Traditions / Events", wp.special_traditions_events);

    return rows;
  })();

  /** Builds the shared HTML body used for both the on-screen preview and emails. */
  const buildCallSheetHtml = (): string => {
    const dateStr = wedding?.date
      ? formatDisplayDate(wedding.date)
      : "Date TBD";
    const location = (wedding as any)?.location || "Location TBD";

    const teamRows = teamMembers.length
      ? teamMembers
          .map(
            (m) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${escapeHtml(m.role)}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(`${m.firstName} ${m.lastName}`.trim() || "Unnamed")}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;color:#555;">${escapeHtml(m.phone || "")}</td>
              <td style="padding:8px;border-bottom:1px solid #eee;color:#555;">${escapeHtml(m.email || "")}</td>
            </tr>`,
          )
          .join("")
      : `<tr><td colspan="4" style="padding:8px;color:#999;font-style:italic;">No team members assigned yet.</td></tr>`;

    const timelineRows = parsedTimeline.length
      ? parsedTimeline
          .map(
            (ev) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;white-space:nowrap;width:90px;">${escapeHtml(ev.time || "")}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(ev.event || "")}</td>
            </tr>`,
          )
          .join("")
      : `<tr><td colspan="2" style="padding:8px;color:#999;font-style:italic;">No timeline events added yet.</td></tr>`;

    const detailsBlock = `
      <h2 style="margin-top:24px;margin-bottom:10px;font-size:18px;border-bottom:1px solid #eee;padding-bottom:5px;">Important Details</h2>
      ${
        (wedding as any)?.vip_names
          ? `<p style="margin:0 0 12px;"><strong>VIPs / Family:</strong><br/>${escapeHtml((wedding as any).vip_names).replace(/\n/g, "<br/>")}</p>`
          : ""
      }
      ${
        (wedding as any)?.vendors
          ? `<p style="margin:0 0 12px;"><strong>Other Vendors:</strong><br/>${escapeHtml((wedding as any).vendors).replace(/\n/g, "<br/>")}</p>`
          : ""
      }
      ${
        (wedding as any)?.special_requests
          ? `<p style="margin:0 0 12px;"><strong>Special Requests / Notes:</strong><br/>${escapeHtml((wedding as any).special_requests).replace(/\n/g, "<br/>")}</p>`
          : ""
      }
      ${
        !(wedding as any)?.vip_names &&
        !(wedding as any)?.vendors &&
        !(wedding as any)?.special_requests
          ? `<p style="color:#999;font-style:italic;">No additional details provided.</p>`
          : ""
      }
    `;

    const questionnaireRowsHtml = questionnaireRows.length
      ? questionnaireRows
          .map(
            (r) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;width:40%;vertical-align:top;">${escapeHtml(r.label)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;white-space:pre-wrap;">${escapeHtml(r.value).replace(/\n/g, "<br/>")}</td>
            </tr>`,
          )
          .join("")
      : "";

    const questionnaireBlock = questionnaireRows.length
      ? `
        <h2 style="margin-top:24px;margin-bottom:10px;font-size:18px;border-bottom:1px solid #eee;padding-bottom:5px;">Bride Questionnaire</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
          <tbody>${questionnaireRowsHtml}</tbody>
        </table>
      `
      : "";

    const songsRowsHtml = highlightSongs.length
      ? highlightSongs
          .map(
            (s) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;">${escapeHtml(s.moment || "")}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(s.title || "")}${s.artist ? ` — ${escapeHtml(s.artist)}` : ""}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#555;">${escapeHtml(s.link || "")}</td>
            </tr>`,
          )
          .join("")
      : "";

    const songsBlock = highlightSongs.length
      ? `
        <h2 style="margin-top:24px;margin-bottom:10px;font-size:18px;border-bottom:1px solid #eee;padding-bottom:5px;">Highlight Songs</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;color:#555;">Moment</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;color:#555;">Song</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #eee;color:#555;">Link</th>
            </tr>
          </thead>
          <tbody>${songsRowsHtml}</tbody>
        </table>
      `
      : "";

    const bookingSummaryBlock = `
      <h2 style="margin-top:24px;margin-bottom:10px;font-size:18px;border-bottom:1px solid #eee;padding-bottom:5px;">Booking Summary</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <tbody>
          ${
            packageName
              ? `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;width:40%;">Package Booked</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(packageName)}</td></tr>`
              : ""
          }
          ${
            totalHoursBooked > 0
              ? `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;">Total Hours Booked</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">${totalHoursBooked} hrs</td></tr>`
              : ""
          }
          ${
            !packageName && totalHoursBooked === 0
              ? `<tr><td colspan="2" style="padding:8px;color:#999;font-style:italic;">No package or hours recorded.</td></tr>`
              : ""
          }
        </tbody>
      </table>
    `;

    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#333;line-height:1.5;">
        <div style="text-align:center;border-bottom:2px solid ${primaryColor()};padding-bottom:16px;margin-bottom:20px;">
          <h1 style="margin:0 0 4px;font-size:26px;">${escapeHtml(wedding?.client_name || weddingName)} Wedding</h1>
          <p style="margin:0;color:#666;">${escapeHtml(dateStr)} • ${escapeHtml(location)}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#999;letter-spacing:1px;text-transform:uppercase;">Call Sheet — ${escapeHtml(companyName)}</p>
        </div>

        <h2 style="margin:0 0 10px;font-size:18px;border-bottom:1px solid #eee;padding-bottom:5px;">Assigned Team</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #eee;color:#555;">Role</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #eee;color:#555;">Name</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #eee;color:#555;">Phone</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #eee;color:#555;">Email</th>
            </tr>
          </thead>
          <tbody>${teamRows}</tbody>
        </table>

        ${bookingSummaryBlock}

        <h2 style="margin-top:24px;margin-bottom:10px;font-size:18px;border-bottom:1px solid #eee;padding-bottom:5px;">Schedule / Timeline</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${timelineRows}</tbody>
        </table>

        ${detailsBlock}

        ${questionnaireBlock}

        ${songsBlock}

        <hr style="border:0;border-top:1px solid #eee;margin:24px 0;" />
        <p style="font-size:12px;color:#999;text-align:center;">Generated by ${escapeHtml(companyName)} • ${new Date().toLocaleDateString()}</p>
      </div>
    `;
  };

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
            .meta { color: #666; margin-bottom: 30px; }
            table { border-collapse: collapse; margin-top: 10px; width: 100%; }
            th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
            th { font-weight: bold; color: #555; }
            .team-member { margin-bottom: 10px; }
            .team-role { font-weight: bold; }
            .team-name { color: #555; }
            .section { margin-bottom: 20px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  /** Open the preview modal for a given recipient set, deferring the actual send. */
  const openSendPreview = (
    to: string,
    subject: string,
    html: string,
    recipientName: string,
    performSend: () => Promise<void>,
  ) => {
    setEmailPreview({ to, subject, html, recipientName });
    setEmailPreviewSend(() => performSend);
    setEmailPreviewOpen(true);
  };

  /** Distribute call sheet to the assigned contractor team (email + optional SMS). */
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

    const html = buildCallSheetHtml();
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
            // Optional SMS nudge
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

  /** Email the call sheet to the bride. */
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

    const html = buildCallSheetHtml();
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
                              Total Hours Booked
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

/* ---------- helpers ---------- */

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Pulls the brand primary color from the design tokens for email styling. */
function primaryColor(): string {
  if (typeof window === "undefined") return "#6366f1";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  if (!raw) return "#6366f1";
  // tokens are stored as raw HSL channels (e.g. "222.2 47.4% 11.2%")
  if (raw.includes("%") && !raw.startsWith("#")) {
    return `hsl(${raw})`;
  }
  return raw.startsWith("#") ? raw : `hsl(${raw})`;
}
