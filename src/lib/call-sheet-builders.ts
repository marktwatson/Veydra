import { formatDisplayDate } from "@/lib/utils";

/* ---------- shared call-sheet HTML helpers ---------- */

export function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Pulls the brand primary color from the design tokens for email styling. */
export function primaryColor(): string {
  if (typeof window === "undefined") return "#6366f1";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  if (!raw) return "#6366f1";
  if (raw.includes("%") && !raw.startsWith("#")) {
    return `hsl(${raw})`;
  }
  return raw.startsWith("#") ? raw : `hsl(${raw})`;
}

export interface TeamMemberLite {
  id: string;
  role: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface CallSheetContext {
  wedding: any;
  weddingName: string;
  companyName: string;
  teamMembers: TeamMemberLite[];
  parsedTimeline: any[];
  questionnaireRows: Array<{ label: string; value: string }>;
  highlightSongs: Array<{
    title: string;
    artist: string;
    link: string;
    moment: string;
  }>;
  packageName: string;
  totalHoursBooked: number;
}

/** Flattens the bride questionnaire into labeled rows for display. */
export function flattenQuestionnaire(questionnaire: any): Array<{
  label: string;
  value: string;
}> {
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
}

/** Builds the shared HTML body used for both the on-screen preview and emails. */
export function buildCallSheetHtml(ctx: CallSheetContext): string {
  const {
    wedding,
    weddingName,
    companyName,
    teamMembers,
    parsedTimeline,
    questionnaireRows,
    highlightSongs,
    packageName,
    totalHoursBooked,
  } = ctx;

  const dateStr = wedding?.date ? formatDisplayDate(wedding.date) : "Date TBD";
  const location = wedding?.location || "Location TBD";

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
      ${wedding?.vip_names ? `<p style="margin:0 0 12px;"><strong>VIPs / Family:</strong><br/>${escapeHtml(wedding.vip_names).replace(/\n/g, "<br/>")}</p>` : ""}
      ${wedding?.vendors ? `<p style="margin:0 0 12px;"><strong>Other Vendors:</strong><br/>${escapeHtml(wedding.vendors).replace(/\n/g, "<br/>")}</p>` : ""}
      ${wedding?.special_requests ? `<p style="margin:0 0 12px;"><strong>Special Requests / Notes:</strong><br/>${escapeHtml(wedding.special_requests).replace(/\n/g, "<br/>")}</p>` : ""}
      ${!wedding?.vip_names && !wedding?.vendors && !wedding?.special_requests ? `<p style="color:#999;font-style:italic;">No additional details provided.</p>` : ""}
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
          ${packageName ? `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;width:40%;">Package Booked</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(packageName)}</td></tr>` : ""}
          ${totalHoursBooked > 0 ? `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;">Booked hours</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">${totalHoursBooked} hrs</td></tr>` : ""}
          ${!packageName && totalHoursBooked === 0 ? `<tr><td colspan="2" style="padding:8px;color:#999;font-style:italic;">No package or hours recorded.</td></tr>` : ""}
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
}
