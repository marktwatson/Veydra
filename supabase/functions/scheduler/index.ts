import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// Scheduler worker — called every ~10 min by a Supabase Scheduled Function
// (cron), and as a backup from the app on page load (idempotent via dedupe_key).
//
// Every invoke: self-heal tables → write heartbeat → claim due jobs → send
// via existing Ovanta SMS/email helpers + portal_settings templates → mark
// sent or retry → backfill missing jobs for upcoming weddings/assignments.
//
// Single-file (no ./_lib import) so the fleet deployer can push it as one
// index.ts without a separate module.
// ─────────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const RETRY_MINUTES = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────
function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function safeJson(req: Request): Promise<any> {
  try {
    const t = await req.text();
    return t ? JSON.parse(t) : {};
  } catch {
    return {};
  }
}

function formatInTz(date: Date, tz: string): string {
  try {
    return date.toLocaleString("en-US", { timeZone: tz });
  } catch {
    return date.toISOString();
  }
}

// ─── Self-heal tables on old snapshot DBs ─────────────────────────────────
async function selfHealTables(sb: any) {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       type TEXT NOT NULL,
       run_at TIMESTAMPTZ NOT NULL,
       timezone TEXT DEFAULT 'America/New_York',
       payload JSONB DEFAULT '{}'::jsonb,
       status TEXT NOT NULL DEFAULT 'pending',
       dedupe_key TEXT,
       related_wedding_id UUID,
       related_assignment_id UUID,
       related_contractor_id UUID,
       attempts INTEGER DEFAULT 0,
       last_error TEXT,
       sent_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ DEFAULT now(),
       updated_at TIMESTAMPTZ DEFAULT now()
     );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS scheduled_jobs_dedupe_active
       ON public.scheduled_jobs (dedupe_key) WHERE status IN ('pending','running');`,
    `CREATE INDEX IF NOT EXISTS scheduled_jobs_claim_idx
       ON public.scheduled_jobs (run_at) WHERE status = 'pending';`,
    `CREATE TABLE IF NOT EXISTS public.scheduler_heartbeats (
       id TEXT PRIMARY KEY DEFAULT 'default',
       last_seen_at TIMESTAMPTZ,
       last_source TEXT,
       last_result JSONB,
       created_at TIMESTAMPTZ DEFAULT now()
     );`,
  ];
  for (const sql of stmts) {
    try {
      await sb.rpc("exec_sql", { sql }).catch(() => {});
    } catch {}
  }
}

async function writeHeartbeat(sb: any, source: string, result: any) {
  try {
    await sb.from("scheduler_heartbeats").upsert(
      {
        id: "default",
        last_seen_at: new Date().toISOString(),
        last_source: source,
        last_result: result,
      },
      { onConflict: "id" },
    );
  } catch {}
}

// ─── Ovanta SMS/Email (same path as daily-reminders) ──────────────────────
async function sendOvantaSms(email: string, message: string, apiKey: string, locationId: string) {
  if (!apiKey || !locationId || !email) return false;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const searchRes = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}`,
    { headers },
  );
  if (!searchRes.ok) return false;
  const searchData = await searchRes.json();
  const contactId = searchData.contacts?.[0]?.id;
  if (!contactId) return false;
  const smsHeaders = { ...headers, Version: "2021-04-15" };
  const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: smsHeaders,
    body: JSON.stringify({ type: "SMS", contactId, message, status: "pending" }),
  });
  return res.ok;
}

async function sendOvantaEmail(email: string, subject: string, message: string, apiKey: string, locationId: string) {
  if (!apiKey || !locationId || !email) return false;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const searchRes = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}`,
    { headers },
  );
  if (!searchRes.ok) return false;
  const searchData = await searchRes.json();
  const contactId = searchData.contacts?.[0]?.id;
  if (!contactId) return false;
  const emailHeaders = { ...headers, Version: "2021-04-15" };
  let html = message;
  if (!html.includes("<!DOCTYPE html>") && !html.includes("<html")) {
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}p{margin-bottom:16px}a{color:#0066cc;text-decoration:none;word-break:break-all}</style></head><body>${message}</body></html>`;
  }
  html = html.replace(/\s+/g, " ").trim();
  const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: emailHeaders,
    body: JSON.stringify({ type: "Email", contactId, subject, message: "Please view this email in an HTML-compatible email client.", html, status: "pending" }),
  });
  return res.ok;
}

function fillTemplate(tpl: string, tokens: any, settings: any): string {
  let out = tpl;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.replace(new RegExp(`{{${k}}}`, "g"), String(v ?? ""));
  }
  out = out.replace(/{{company_name}}/g, settings.company_name || "Veydra");
  out = out.replace(/{{logo_url}}/g, settings.logo_url || "");
  const portal = (settings.app_url || "https://veydra.com").replace(/\/$/, "");
  out = out.replace(/{{portal_link}}/g, portal);
  return out;
}

// ─── Time math ────────────────────────────────────────────────────────────
function civilToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "09:00").split(":").map(Number);
  const utcGuess = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  const offsetMin = tzOffsetMinutes(new Date(utcGuess), tz);
  return new Date(utcGuess - offsetMin * 60 * 1000);
}

function tzOffsetMinutes(date: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts: any = {};
    for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour === 24 ? 0 : +parts.hour, +parts.minute, +parts.second);
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return date.getTimezoneOffset();
  }
}

function computeRunAt(opts: any): Date | null {
  const { weddingDate, tz } = opts;
  if (!weddingDate) return null;
  const datePart = weddingDate.split("T")[0];
  if (!datePart) return null;

  if (opts.offsetHours != null && !Number.isNaN(opts.offsetHours)) {
    const anchorTime = opts.weddingStart || "12:00";
    const anchorUtc = civilToUtc(datePart, anchorTime, tz);
    return new Date(anchorUtc.getTime() - opts.offsetHours * 3600 * 1000);
  }

  const sendHour = opts.sendHour ?? 9;
  const [y, m, d] = datePart.split("-").map(Number);
  const base = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dayDelta = opts.isAfter ? (opts.offsetDays || 0) : -(opts.offsetDays || 0);
  base.setUTCDate(base.getUTCDate() + dayDelta);
  const targetDate = base.toISOString().split("T")[0];
  return civilToUtc(targetDate, `${String(sendHour).padStart(2, "0")}:00`, tz);
}

function extractStartTime(timeline: any): string | null {
  if (!timeline) return null;
  const m = String(timeline).match(/\b((1[0-2]|0?[1-9]):[0-5][0-9]\s*([AaPp][Mm])?|([01]?[0-9]|2[0-3]):[0-5][0-9])\b/);
  return m ? m[0] : null;
}

function resolveBrideEmail(w: any): string {
  let email = w.client_email || "";
  if (!email && w.questionnaire_data) {
    let q = w.questionnaire_data;
    if (typeof q === "string") { try { q = JSON.parse(q); } catch {} }
    if (q?.contact_info?.email) email = q.contact_info.email;
    else if (q?.email) email = q.email;
  }
  if (!email && w.notes) {
    const m = w.notes.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (m) email = m[1];
  }
  return email;
}

async function enqueueJob(sb: any, job: any): Promise<number> {
  try {
    const { error } = await sb.from("scheduled_jobs").insert({
      type: job.type,
      run_at: job.run_at,
      timezone: job.timezone,
      dedupe_key: job.dedupe_key,
      related_wedding_id: job.related_wedding_id || null,
      related_assignment_id: job.related_assignment_id || null,
      related_contractor_id: job.related_contractor_id || null,
      payload: job.payload,
      status: "pending",
    });
    // 23505 = unique_violation on dedupe_key → already exists, skip silently.
    if (error && error.code !== "23505") {
      console.warn("enqueue error:", error.message);
      return 0;
    }
    return error ? 0 : 1;
  } catch {
    return 0;
  }
}

// NOTE: The daily "Payments Need Attention" push alert has been removed per
// request. The scheduler NEVER charges cards and no longer sends payment-due
// push notifications. Subscriptions/deposits are charged by Stripe at booking;
// all other payments are manual via the Payment Audit UI. Check Payment Audit
// directly to see what needs processing.

// ─── Main ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  const body = await safeJson(req);
  const source = body?.source || "cron";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !supabaseKey) return jsonResp({ error: "Missing Supabase configuration" }, 500);
  const sb = createClient(supabaseUrl, supabaseKey);
  await selfHealTables(sb);
  const { data: settings } = await sb.from("portal_settings").select("*").limit(1).maybeSingle();
  if (!settings) { await writeHeartbeat(sb, source, { error: "no portal_settings" }); return jsonResp({ error: "No portal settings" }, 500); }
  const tz = settings.timezone || settings.company_timezone || "America/New_York";
  await writeHeartbeat(sb, source, { ok: true });
  const { claimed, sent, failed } = await processJobs(sb, settings);
  const backfilled = await backfillJobs(sb, settings, tz);
  // Auto-trigger the royalty processor on its configured day/time (portal TZ).
  // The processor self-gates: it only actually runs when the portal day/time
  // match royalty_settings.processing_day_of_week / processing_time, and a
  // unique index guarantees one period per week (no double charge).
  let royaltyTriggered = false;
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/royalty-processor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey },
      body: JSON.stringify({ source: "scheduler", scheduled: true }),
    });
    if (r.ok) { const rd = await r.json(); royaltyTriggered = !rd.skipped; }
  } catch (e) { console.warn("royalty-processor trigger failed:", (e as any)?.message); }
  return jsonResp({ claimed, sent, failed, backfilled, royalty_triggered: royaltyTriggered, server_time: new Date().toISOString(), portal_tz: tz, portal_time_label: formatInTz(new Date(), tz) });
});

// ─── Job processing ──────────────────────────────────────────────────────
async function processJobs(sb: any, settings: any) {
  let claimed = 0, sent = 0, failed = 0;
  const { data: dueJobs } = await sb
    .from("scheduled_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(50);
  if (!dueJobs || dueJobs.length === 0) return { claimed, sent, failed };

  for (const job of dueJobs) {
    const { data: claimedRow, error } = await sb
      .from("scheduled_jobs")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (error || !claimedRow) continue;
    claimed++;
    try {
      const ok = await sendJob(sb, settings, claimedRow);
      if (ok) {
        await sb.from("scheduled_jobs").update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
        sent++;
      } else {
        await retryOrFail(sb, job, "send returned false");
        failed++;
      }
    } catch (e: any) {
      await retryOrFail(sb, job, e?.message || String(e));
      failed++;
    }
  }
  return { claimed, sent, failed };
}

async function retryOrFail(sb: any, job: any, errMsg: string) {
  const attempts = (job.attempts || 0) + 1;
  if (attempts < MAX_ATTEMPTS) {
    const nextRun = new Date(Date.now() + RETRY_MINUTES * 60 * 1000);
    await sb.from("scheduled_jobs").update({ status: "pending", attempts, last_error: errMsg, run_at: nextRun.toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
  } else {
    await sb.from("scheduled_jobs").update({ status: "failed", attempts, last_error: errMsg, updated_at: new Date().toISOString() }).eq("id", job.id);
  }
}

async function sendJob(sb: any, settings: any, job: any): Promise<boolean> {
  const p = job.payload || {};
  const type = job.type;
  const email = p.recipient_email;
  if (!email) return false;
  const apiKey = settings.hl_api_key;
  const locationId = settings.hl_location_id;

  if (type.endsWith("_sms") || type.endsWith("_prep") || type === "sms_reminder") {
    const template = p.template || "";
    if (!template) return false;
    return await sendOvantaSms(email, fillTemplate(template, p.tokens || {}, settings), apiKey, locationId);
  }
  if (type.endsWith("_email") || type === "email_reminder") {
    const template = p.template || "";
    if (!template) return false;
    const subject = fillTemplate(p.subject || "Notification", p.tokens || {}, settings);
    return await sendOvantaEmail(email, subject, fillTemplate(template, p.tokens || {}, settings), apiKey, locationId);
  }
  console.warn("Unknown job type:", type);
  return true;
}

// ─── Backfill ─────────────────────────────────────────────────────────────
async function backfillJobs(sb: any, settings: any, tz: string): Promise<number> {
  let count = 0;
  const active = ["Upcoming","upcoming","Accepted","accepted","Confirmed","confirmed","Assigned","assigned","Action Required","action required"];
  const { data: assignments } = await sb.from("assignments")
    .select(`id, contractor_id, status, jobs (id, role, contractor_todos, weddings(id, client_name, date, location, timeline)), contractors (id, first_name, last_name, email, sms_notifications, email_notifications)`)
    .in("status", active);

  if (assignments) {
    for (const a of assignments) {
      const job = a.jobs as any;
      const c = a.contractors as any;
      if (!job?.weddings?.date || !c?.email) continue;
      const wDate = job.weddings.date.split("T")[0];
      const tokens = { contractor_name: c.first_name, wedding_name: job.weddings.client_name, client_name: job.weddings.client_name, location: job.weddings.location || "TBD", date: job.weddings.date, role: job.role || "" };

      if (settings.sms_contractor_prep_enabled && settings.sms_contractor_prep_template && settings.sms_contractor_prep_days) {
        const runAt = computeRunAt({ weddingDate: wDate, offsetDays: settings.sms_contractor_prep_days, sendHour: 9, tz });
        if (runAt && runAt.getTime() > Date.now()) count += await enqueueJob(sb, { type: "sms_contractor_prep", run_at: runAt.toISOString(), timezone: tz, dedupe_key: `sms_contractor_prep:${a.id}`, related_assignment_id: a.id, related_contractor_id: c.id, related_wedding_id: job.weddings.id, payload: { recipient_email: c.email, recipient_name: c.first_name, template: settings.sms_contractor_prep_template, tokens } });
      }
      if (settings.sms_reminder_enabled && settings.sms_reminder_template && settings.sms_reminder_hours) {
        const st = extractStartTime(job.weddings.timeline);
        const runAt = computeRunAt({ weddingDate: wDate, weddingStart: st, offsetHours: settings.sms_reminder_hours, tz });
        if (runAt && runAt.getTime() > Date.now()) count += await enqueueJob(sb, { type: "sms_reminder", run_at: runAt.toISOString(), timezone: tz, dedupe_key: `sms_reminder:${a.id}`, related_assignment_id: a.id, related_contractor_id: c.id, related_wedding_id: job.weddings.id, payload: { recipient_email: c.email, recipient_name: c.first_name, template: settings.sms_reminder_template, tokens } });
      }
      if (settings.email_reminder_enabled && settings.email_reminder_template && settings.sms_reminder_hours) {
        const st = extractStartTime(job.weddings.timeline);
        const runAt = computeRunAt({ weddingDate: wDate, weddingStart: st, offsetHours: settings.sms_reminder_hours, tz });
        if (runAt && runAt.getTime() > Date.now()) count += await enqueueJob(sb, { type: "email_reminder", run_at: runAt.toISOString(), timezone: tz, dedupe_key: `email_reminder:${a.id}`, related_assignment_id: a.id, related_contractor_id: c.id, related_wedding_id: job.weddings.id, payload: { recipient_email: c.email, recipient_name: c.first_name, subject: settings.email_reminder_subject || "Upcoming Job Reminder", template: settings.email_reminder_template, tokens } });
      }
    }
  }

  const { data: weddings } = await sb.from("weddings").select("*").neq("status", "cancelled");
  if (weddings) {
    for (const w of weddings) {
      if (!w.date) continue;
      const brideEmail = resolveBrideEmail(w);
      if (!brideEmail) continue;
      const wDate = w.date.split("T")[0];
      const portal = (settings.app_url || "https://veydra.com").replace(/\/$/, "");
      const portalLink = `${portal}/bride-portal/${w.id}`;
      const feedbackLink = `${portal}/feedback/${w.id}`;
      const name = w.client_name || "Bride";

      if (settings.sms_bride_pre_wedding_enabled && settings.sms_bride_pre_wedding_template && settings.sms_bride_pre_wedding_hours) {
        const st = extractStartTime(w.timeline);
        const runAt = computeRunAt({ weddingDate: wDate, weddingStart: st, offsetHours: settings.sms_bride_pre_wedding_hours, tz });
        if (runAt && runAt.getTime() > Date.now()) count += await enqueueJob(sb, { type: "sms_bride_pre_wedding", run_at: runAt.toISOString(), timezone: tz, dedupe_key: `sms_bride_pre_wedding:${w.id}`, related_wedding_id: w.id, payload: { recipient_email: brideEmail, recipient_name: name, template: settings.sms_bride_pre_wedding_template, tokens: { bride_name: name } } });
      }
      if (settings.sms_bride_day_after_enabled && settings.sms_bride_day_after_template) {
        const runAt = computeRunAt({ weddingDate: wDate, offsetDays: 1, sendHour: 9, isAfter: true, tz });
        if (runAt && runAt.getTime() > Date.now()) count += await enqueueJob(sb, { type: "sms_bride_day_after", run_at: runAt.toISOString(), timezone: tz, dedupe_key: `sms_bride_day_after:${w.id}`, related_wedding_id: w.id, payload: { recipient_email: brideEmail, recipient_name: name, template: settings.sms_bride_day_after_template, tokens: { bride_name: name, portal_link: portalLink } } });
      }
      if (settings.email_bride_day_after_enabled && settings.email_bride_day_after_template) {
        const runAt = computeRunAt({ weddingDate: wDate, offsetDays: 1, sendHour: 9, isAfter: true, tz });
        if (runAt && runAt.getTime() > Date.now()) count += await enqueueJob(sb, { type: "email_bride_day_after", run_at: runAt.toISOString(), timezone: tz, dedupe_key: `email_bride_day_after:${w.id}`, related_wedding_id: w.id, payload: { recipient_email: brideEmail, recipient_name: name, subject: settings.email_bride_day_after_subject || "Thank you!", template: settings.email_bride_day_after_template, tokens: { bride_name: name, portal_link: portalLink } } });
      }
      if (settings.sms_bride_rating_enabled && settings.sms_bride_rating_template) {
        const runAt = computeRunAt({ weddingDate: wDate, offsetDays: 2, sendHour: 9, isAfter: true, tz });
        if (runAt && runAt.getTime() > Date.now()) count += await enqueueJob(sb, { type: "sms_bride_rating", run_at: runAt.toISOString(), timezone: tz, dedupe_key: `sms_bride_rating:${w.id}`, related_wedding_id: w.id, payload: { recipient_email: brideEmail, recipient_name: name, template: settings.sms_bride_rating_template, tokens: { bride_name: name, feedback_link: feedbackLink } } });
      }
    }
  }
  return count;
}
