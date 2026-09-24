import { api } from "@/lib/api";
import { formatDisplayDate } from "@/lib/utils";

export const DEFAULT_LOGO_URL = "";

/**
 * Returns the list of overdue readiness items for a wedding.
 * Mirrors the 6-check readiness logic used across the app.
 */
export function getMissingItems(
  wedding: any,
  jobs: any[],
  assignments: any[],
): string[] {
  const missing: string[] = [];
  const w = wedding as any;
  if (
    !w.questionnaire_completed &&
    !(
      w.questionnaire_data && Object.keys(w.questionnaire_data || {}).length > 0
    )
  ) {
    missing.push("Questionnaire");
  }
  if (!w.timeline || w.timeline.length === 0 || w.timeline === "[]") {
    missing.push("Timeline");
  }
  if (!w.drive_link) {
    missing.push("Drive Link");
  }
  const weddingJobs = jobs.filter(
    (j) => j.wedding_id === wedding.id && j.status !== "cancelled",
  );
  const filledJobs = weddingJobs.filter(
    (j) => j.status === "filled" || j.status === "completed",
  );
  if (weddingJobs.length === 0) {
    missing.push("No positions posted");
  } else if (weddingJobs.length !== filledJobs.length) {
    const unfilled = weddingJobs.length - filledJobs.length;
    missing.push(`${unfilled} unfilled position${unfilled > 1 ? "s" : ""}`);
  }
  const allAssignments = (assignments as any[]).filter(
    (a) => a.jobs?.wedding_id === wedding.id,
  );
  const activeAssignments = allAssignments.filter((a) =>
    ["upcoming", "accepted", "confirmed", "assigned"].includes(
      a.status?.toLowerCase(),
    ),
  );
  const unconfirmedAssignments = activeAssignments.filter(
    (a) => !a.attendance_confirmed,
  );
  if (activeAssignments.length === 0) {
    missing.push("No assignments");
  } else if (unconfirmedAssignments.length > 0) {
    missing.push(
      `${unconfirmedAssignments.length} unconfirmed assignment${unconfirmedAssignments.length > 1 ? "s" : ""}`,
    );
  }
  if (!w.final_payment_verified) {
    missing.push("Final payment not verified");
  }
  return missing;
}

/**
 * Sends a prep reminder (SMS + email + in-app notification) to contractors
 * assigned to a wedding who still have incomplete to-dos.
 * Returns the number of reminders sent.
 */
export async function sendPrepReminder(
  wedding: any,
  jobs: any[],
  assignments: any[],
  settings: any,
): Promise<number> {
  const s = settings as any;
  const portalLink = (s?.app_url || "https://veydra.com").replace(/\/$/, "");
  const daysUntil = wedding.date
    ? getDaysUntil(wedding.date).replace(" days", "")
    : "soon";

  const weddingJobs = jobs.filter(
    (j) => j.wedding_id === wedding.id && j.status === "filled",
  );
  const weddingAssignments = (assignments as any[]).filter((a) =>
    weddingJobs.some((j) => j.id === a.job_id),
  );

  let sent = 0;
  for (const assignment of weddingAssignments) {
    const contractor = assignment.contractors;
    if (!contractor?.email) continue;

    const job = weddingJobs.find((j) => j.id === assignment.job_id);
    const todos = job?.contractor_todos || [];
    let hasPendingTodos = false;
    if (Array.isArray(todos) && todos.length > 0) {
      hasPendingTodos = todos.some((t: any) => !t.completed);
    } else if (!todos || todos.length === 0) {
      hasPendingTodos = true;
    }
    if (!hasPendingTodos) continue;

    if (s?.sms_contractor_prep_enabled && s?.sms_contractor_prep_template) {
      const msg = s.sms_contractor_prep_template
        .replace(/{{company_name}}/g, s.company_name || "Veydra")
        .replace(/{{contractor_name}}/g, contractor.first_name)
        .replace(/{{wedding_name}}/g, wedding.client_name)
        .replace(/{{days}}/g, daysUntil)
        .replace(/{{location}}/g, wedding.location || "TBD")
        .replace(
          /{{date}}/g,
          wedding.date ? formatDisplayDate(wedding.date) : "TBD",
        )
        .replace(/{{portal_link}}/g, portalLink);
      await api
        .sendOvantaSms(
          contractor.email,
          msg,
          `${contractor.first_name} ${contractor.last_name || ""}`,
          true,
        )
        .catch(() => {});
      sent++;
    }

    if (s?.email_contractor_prep_enabled && s?.email_contractor_prep_template) {
      const subject = (
        s.email_contractor_prep_subject ||
        "Action Items Due for {{wedding_name}} Wedding"
      )
        .replace(/{{company_name}}/g, s.company_name || "Veydra")
        .replace(/{{contractor_name}}/g, contractor.first_name)
        .replace(/{{wedding_name}}/g, wedding.client_name)
        .replace(/{{days}}/g, daysUntil);
      const msg = s.email_contractor_prep_template
        .replace(/{{company_name}}/g, s.company_name || "Veydra")
        .replace(/{{logo_url}}/g, s.logo_url || DEFAULT_LOGO_URL)
        .replace(/{{contractor_name}}/g, contractor.first_name)
        .replace(/{{wedding_name}}/g, wedding.client_name)
        .replace(/{{days}}/g, daysUntil)
        .replace(/{{location}}/g, wedding.location || "TBD")
        .replace(
          /{{date}}/g,
          wedding.date ? formatDisplayDate(wedding.date) : "TBD",
        )
        .replace(/{{portal_link}}/g, portalLink);
      await api
        .sendOvantaEmail(
          contractor.email,
          subject,
          msg,
          `${contractor.first_name} ${contractor.last_name || ""}`,
          true,
        )
        .catch(() => {});
      sent++;
    }

    await api
      .createNotification({
        contractor_id: contractor.id,
        title: "Action Items Due",
        message: `You have incomplete action items for ${wedding.client_name}'s wedding. Please log in to complete them.`,
        type: "assignment",
      })
      .catch(() => {});
  }

  return sent;
}

/**
 * Sends a reminder specifically for unconfirmed attendance to all contractors
 * assigned to this wedding who have not yet confirmed attendance.
 */
export async function sendAttendanceReminder(
  wedding: any,
  jobs: any[],
  assignments: any[],
  settings?: any,
): Promise<number> {
  const weddingJobs = jobs.filter(
    (j) => j.wedding_id === wedding.id && j.status !== "cancelled",
  );
  const weddingAssignments = (assignments as any[]).filter(
    (a) =>
      weddingJobs.some((j) => j.id === a.job_id) &&
      ["upcoming", "accepted", "confirmed", "assigned"].includes(
        a.status?.toLowerCase(),
      ) &&
      !a.attendance_confirmed,
  );

  let sent = 0;
  for (const a of weddingAssignments) {
    const contractor = a.contractors;
    if (!contractor?.email && !contractor?.phone) continue;

    const contractorName = contractor.first_name || "there";
    const msg = `Hi ${contractorName}, please log in to the portal to confirm your attendance for ${wedding.client_name}'s wedding. Failure to confirm by the 7-day mark will result in automatic removal.`;

    if (contractor.email && contractor.sms_notifications !== false) {
      await api
        .sendOvantaSms(
          contractor.email,
          msg,
          `${contractor.first_name || ""} ${contractor.last_name || ""}`.trim(),
          true,
        )
        .catch(() => {});
      sent++;
    }

    await api
      .createNotification({
        contractor_id: contractor.id,
        title: "Confirm Attendance Required",
        message: `Please confirm your attendance for ${wedding.client_name}'s wedding in your assignments.`,
        type: "assignment",
      })
      .catch(() => {});
  }

  return sent;
}

function getDaysUntil(dateStr: string): string {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return `${diff} days`;
}
