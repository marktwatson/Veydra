// Daily Sales Conversation Quality Report, v3.
// One Ovanta location per run. Recipients are contacts tagged veydra-sales-report.
// The agency token is never written into the report.
import { createClient } from "jsr:@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const CRM = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";
const RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const PRIMARY = [
  "Urgent Language Unworked",
  "Buying Intent Unworked",
  "Missed Call Without Callback",
  "No First Response",
  "Unanswered Inbound Message",
  "Stalled Thread",
  "Slow First Response",
];
const URGENT = ["as soon as possible", "time sensitive", "time-sensitive", "still waiting", "no one has", "nobody has", "right now", "emergency", "immediately", "unacceptable", "frustrated", "deadline", "third time", "urgent", "asap", "today", "cancel", "refund", "angry"];
const BUYING = ["how much", "ready to start", "when can you", "availability", "interested", "pricing", "estimate", "schedule", "available", "contract", "invoice", "payment", "deposit", "booking", "signup", "sign up", "price", "quote", "cost", "book"];

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    return "&" + "quot;";
  });
}
function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
function phrase(list: string[]) {
  return new RegExp(`\\b(?:${list.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
}
const urgentRe = phrase(URGENT);
const buyingRe = phrase(BUYING);
function stripQuoted(body: string) {
  return body.split(/\nOn [\s\S]{0,80}wrote:/i)[0].split("\n").filter((line) => !line.trim().startsWith(">")).join("\n");
}
function hits(body: string, pattern: RegExp) {
  return pattern.test(stripQuoted(body));
}
function zoned(ms: number, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  const numeric = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return {
    weekday: parts.weekday || "",
    hour: Number(numeric.hour || 0),
    label: `${parts.month} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute}`,
    day: `${numeric.year}-${numeric.month}-${numeric.day}`,
    short: `${numeric.month}/${numeric.day}`,
  };
}
function clock(ms: number | null) {
  if (ms == null) return "not available";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}
function hours1(ms: number | null) {
  if (ms == null) return "not available";
  return (ms / 3600000).toFixed(1);
}
function gradeFor(ms: number | null) {
  if (ms == null) return "Low";
  if (ms >= 86400000) return "Critical";
  if (ms >= 28800000) return "High";
  if (ms >= 7200000) return "Medium";
  return "Low";
}
function escalate(grade: string, body: string, elapsed: number | null) {
  if (hits(body, urgentRe)) return "Critical";
  if (hits(body, buyingRe)) return elapsed != null && elapsed >= 86400000 ? "Critical" : (RANK[grade] >= RANK.High ? grade : "High");
  return grade;
}
function badge(grade: string) {
  const bg = grade === "Critical" ? "#e74c3c" : grade === "High" ? "#e67e22" : grade === "Medium" ? "#f1c40f" : "#95a5a6";
  const color = grade === "Medium" ? "#1a2340" : "#ffffff";
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:bold;text-transform:uppercase;padding:2px 8px;border-radius:10px;letter-spacing:0.5px;">${esc(grade)}</span>`;
}
function kindOf(message: any) {
  const raw = String(message.type || message.messageType || message.lastMessageType || "").toLowerCase();
  if (raw.includes("email")) return "Email";
  if (raw.includes("call") || raw.includes("voicemail") || raw === "1" || raw === "2") return "Call";
  if (raw.includes("auto") || raw.includes("activity") || raw.includes("internal")) return "Automation";
  if (raw.includes("sms") || raw.includes("text") || raw === "3") return "SMS";
  return "SMS";
}
function normalize(message: any) {
  const ms = new Date(message.dateAdded || message.dateCreated || 0).getTime();
  const direction = String(message.direction || "").toLowerCase().includes("inbound") ? "inbound" : "outbound";
  return {
    ms: Number.isFinite(ms) ? ms : 0,
    direction,
    type: kindOf(message),
    body: clean(message.body || message.message || ""),
    userId: String(message.userId || ""),
    status: String(message.status || message.meta?.call?.status || "").toLowerCase(),
  };
}
async function crm(token: string, url: string, init?: RequestInit, attempt = 0): Promise<{ ok: boolean; status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, Version: VERSION, Accept: "application/json", "Content-Type": "application/json" },
    });
    const text = await res.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 400) }; }
    const method = String(init?.method || "GET").toUpperCase();
    if ((res.status >= 500 || res.status === 0) && attempt < 1 && (method === "GET" || url.endsWith("/messages"))) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return crm(token, url, init, attempt + 1);
    }
    return { ok: res.ok, status: res.status, body };
  } catch {
    if (attempt < 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return crm(token, url, init, attempt + 1);
    }
    return { ok: false, status: 0, body: {} };
  } finally {
    clearTimeout(timer);
  }
}
async function pool<T, R>(items: T[], width: number, run: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await run(items[index]);
    }
  }));
  return out;
}
function messageList(body: any) {
  if (Array.isArray(body?.messages?.messages)) return body.messages.messages;
  if (Array.isArray(body?.messages)) return body.messages;
  return [];
}
function table(headers: string[], rows: string[][], empty: string) {
  const head = `<tr>${headers.map((header) => `<th align="left" style="padding:8px 10px;background:#1a2340;color:#ffffff;font-size:12px;">${esc(header)}</th>`).join("")}</tr>`;
  const body = rows.length
    ? rows.map((row, index) => `<tr style="background:${index % 2 ? "#f9fafb" : "#ffffff"};">${row.map((cell) => `<td style="padding:8px 10px;border-bottom:1px solid #e6eaef;vertical-align:top;">${cell}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}" style="padding:8px 10px;">${esc(empty)}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;">${head}${body}</table>`;
}
function section(title: string, inner: string) {
  return `<h2 style="font-size:16px;margin:0 0 8px;color:#1a2340;">${esc(title)}</h2>${inner}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase env" }, 500);
  const db = createClient(supabaseUrl, serviceKey);
  let runId = "";
  try {
    const body = await req.json().catch(() => ({}));
    const territoryId = String(body.territoryId || "").trim();
    if (!territoryId) return json({ error: "Pick an area first." }, 400);
    const tokenHeader = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const fromClock = body.source === "scheduler" && tokenHeader === serviceKey;
    if (!fromClock) {
      const userDb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      const { data: userData } = await userDb.auth.getUser();
      const email = String(userData?.user?.email || "").toLowerCase();
      const userId = userData?.user?.id || "";
      if (!email && !userId) return json({ error: "Not signed in" }, 401);
      let manager: any = null;
      if (email) {
        const { data } = await db.from("managers").select("role, status, territory_id, territory_ids").ilike("email", email).limit(5);
        manager = (data || []).find((row: any) => row.status === "active") || data?.[0];
      }
      if (!manager && userId) {
        const { data } = await db.from("managers").select("role, status, territory_id, territory_ids").eq("id", userId).maybeSingle();
        manager = data;
      }
      const extras = Array.isArray(manager?.territory_ids) ? manager.territory_ids : [];
      const allowed = manager?.role === "super_admin" || manager?.territory_id === territoryId || extras.includes(territoryId);
      if (!["owner", "super_admin"].includes(String(manager?.role || "")) || !allowed) return json({ error: "Only an owner can send this report." }, 403);
    }

    const { data: settings } = await db.from("portal_settings").select("company_name, timezone, hl_api_key, hl_location_id, smtp_from_email").eq("territory_id", territoryId).limit(1).maybeSingle();
    const token = String(settings?.hl_api_key || "").trim();
    const locationId = String(settings?.hl_location_id || "").trim();
    const timeZone = settings?.timezone || "America/New_York";
    const fromEmail = Deno.env.get("FROM_EMAIL") || settings?.smtp_from_email || "";
    if (!token || !locationId) return json({ error: "This area has no Ovanta key or location." }, 422);
    if (!fromEmail) return json({ error: "FROM_EMAIL is not set for this area." }, 422);

    await db.rpc("exec_sql_batch", { sql_texts: [
      `CREATE TABLE IF NOT EXISTS public.report_runs (
        id uuid primary key default gen_random_uuid(),
        location_id text not null,
        territory_id uuid,
        run_date date not null,
        status text not null default 'queued',
        started_at timestamptz default now(),
        finished_at timestamptz,
        error text,
        summary text
      )`,
      "CREATE UNIQUE INDEX IF NOT EXISTS report_runs_location_day ON public.report_runs (location_id, run_date)",
      `CREATE TABLE IF NOT EXISTS public.send_log (
        id uuid primary key default gen_random_uuid(),
        run_id uuid,
        channel text,
        email text,
        message_id text,
        conversation_id text,
        status text,
        error text,
        sent_at timestamptz default now()
      )`,
    ] });

    const now = Date.now();
    const today = zoned(now, timeZone);
    const monday = today.weekday === "Mon";
    const { data: existing } = await db.from("report_runs").select("id, status, started_at").eq("location_id", locationId).eq("run_date", today.day).maybeSingle();
    if (fromClock && existing && (existing.status === "sent" || existing.status === "partial")) return json({ success: true, already: true, status: existing.status });
    if (existing?.id) {
      runId = existing.id;
      await db.from("report_runs").update({ status: "queued", error: null, started_at: new Date().toISOString() }).eq("id", runId);
    } else {
      const { data: created } = await db.from("report_runs").insert({ location_id: locationId, territory_id: territoryId, run_date: today.day, status: "queued" }).select("id").single();
      runId = created?.id || "";
    }

    const recipientsRes = await crm(token, `${CRM}/contacts/search`, {
      method: "POST",
      body: JSON.stringify({ locationId, pageLimit: 50, filters: [{ field: "tags", operator: "contains", value: "veydra-sales-report" }] }),
    });
    if (recipientsRes.status === 401 || recipientsRes.status === 403) {
      await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "AUTH_FAILURE" }).eq("id", runId);
      return json({ error: "AUTH_FAILURE", status: "failed" }, 401);
    }
    if (!recipientsRes.ok) return json({ error: "RECIPIENT_LOOKUP_FAILED", status: "failed" }, 502);
    const recipients = (recipientsRes.body?.contacts || []).map((contact: any) => ({
      contactId: contact.id,
      name: clean(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ")),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email || "")) ? String(contact.email).trim() : "",
      phone: (() => {
        const digits = String(contact.phone || "").replace(/[^\d+]/g, "");
        if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
        const bare = digits.replace(/\D/g, "");
        if (bare.length === 10) return `+1${bare}`;
        if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
        return "";
      })(),
    })).filter((recipient: any) => recipient.contactId && (recipient.email || recipient.phone));
    if (!recipients.length) {
      await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "NO_RECIPIENTS" }).eq("id", runId);
      return json({ error: `NO_RECIPIENTS. Tag the people who should get this with veydra-sales-report in this Ovanta account.`, status: "failed" }, 422);
    }

    const contacts: any[] = [];
    let reportedTotal = 0;
    let contactStatus = 0;
    const pullTagged = async (value: string) => {
      const rows: any[] = [];
      for (let page = 1; page <= 10; page++) {
        const found = await crm(token, `${CRM}/contacts/search`, {
          method: "POST",
          body: JSON.stringify({
            locationId,
            page,
            pageLimit: 100,
            filters: [{
              group: "AND",
              filters: [
                { field: "tags", operator: "contains", value },
                { field: "tags", operator: "not_contains", value: "booked" },
                { field: "tags", operator: "not_contains", value: "hired" },
              ],
            }],
          }),
        });
        if (!found.ok) return { ok: false, status: found.status, rows };
        const batch = found.body?.contacts || [];
        reportedTotal = Number(found.body?.total || found.body?.meta?.total || reportedTotal);
        rows.push(...batch);
        if (batch.length < 100) break;
      }
      return { ok: true, status: 200, rows };
    };
    let searchOk = false;
    for (const value of ["new lead", "New Lead"]) {
      const attempt = await pullTagged(value);
      if (!attempt.ok) { contactStatus = attempt.status; continue; }
      searchOk = true;
      if (attempt.rows.length) { contacts.push(...attempt.rows); break; }
    }
    if (!searchOk) {
      let listedOk = false;
      for (let page = 1; page <= 5; page++) {
        const listed = await crm(token, `${CRM}/contacts/?locationId=${encodeURIComponent(locationId)}&limit=100&page=${page}`);
        if (!listed.ok) { contactStatus = listed.status; break; }
        listedOk = true;
        const batch = listed.body?.contacts || [];
        contacts.push(...batch);
        if (batch.length < 100) break;
      }
      if (!listedOk && contacts.length === 0) {
        return json({ error: `The new-lead pull failed (HTTP ${contactStatus}), so the report was not sent.`, status: "failed" }, 502);
      }
    }
    const inScope = contacts.filter((contact) => {
      const tags = (Array.isArray(contact.tags) ? contact.tags : []).map((tag: string) => String(tag).trim().toLowerCase());
      return tags.some((tag: string) => tag === "new lead") && !tags.includes("booked") && !tags.includes("hired");
    });
    const contactIds = new Set(inScope.map((contact) => contact.id));

    const recent = await crm(token, `${CRM}/conversations/search?locationId=${encodeURIComponent(locationId)}&limit=100&sort=desc`);
    const oldest = await crm(token, `${CRM}/conversations/search?locationId=${encodeURIComponent(locationId)}&limit=100&sort=asc`);
    const partialOldest = !oldest.ok;
    const partialRecent = !recent.ok;
    const merged = new Map<string, any>();
    for (const conversation of [...(recent.body?.conversations || []), ...(oldest.body?.conversations || [])]) {
      if (conversation?.id && !merged.has(conversation.id)) merged.set(conversation.id, conversation);
    }
    const conversations = [...merged.values()];
    const matched = conversations.filter((conversation) => contactIds.has(conversation.contactId || conversation.contact_id));
    let skipped = 0;
    const withMessages = await pool(matched, 6, async (conversation) => {
      const pulled = await crm(token, `${CRM}/conversations/${conversation.id}/messages?limit=100&sort=desc`);
      if (!pulled.ok) { skipped++; return { conversation, messages: [] as any[], failed: true }; }
      return { conversation, failed: false, messages: messageList(pulled.body).map(normalize).filter((row) => row.ms) };
    });

    const usersRes = await crm(token, `${CRM}/users/?locationId=${locationId}`);
    const users = new Map<string, string>();
    for (const user of usersRes.body?.users || []) {
      const name = clean([user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || user.email || "");
      if (user.id) users.set(user.id, name || "Unassigned");
    }
    const repName = (id: string) => users.get(id) || "Unassigned";

    type Flag = { contactId: string; contactName: string; assignedTo: string; category: string; grade: string; elapsedMs: number | null; preview: string; lastType: string; lastAt: string; lastAtMs: number; primary: boolean };
    const flags: Flag[] = [];
    const byContact = new Map<string, any[]>();
    for (const row of withMessages) {
      if (row.failed) continue;
      const id = row.conversation.contactId || row.conversation.contact_id;
      byContact.set(id, [...(byContact.get(id) || []), ...row.messages]);
    }
    let responseSamples: number[] = [];
    for (const contact of inScope) {
      const messages = (byContact.get(contact.id) || []).sort((a, b) => a.ms - b.ms);
      if (!messages.length) continue;
      const name = clean(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown");
      const assigned = repName(contact.assignedTo || "");
      const inbound = messages.filter((row) => row.direction === "inbound");
      const outbound = messages.filter((row) => row.direction === "outbound" && row.type !== "InternalComment");
      const humanOutbound = outbound.filter((row) => row.type !== "Automation");
      const last = messages[messages.length - 1];
      const lastInbound = inbound[inbound.length - 1];
      const elapsed = lastInbound ? now - lastInbound.ms : null;
      const bodyText = lastInbound?.body || "";
      const base = escalate(gradeFor(elapsed), bodyText, elapsed);
      const preview = bodyText.slice(0, 120);
      const lastAt = lastInbound ? zoned(lastInbound.ms, timeZone).label : "not available";
      const push = (category: string, grade: string, age: number | null) => flags.push({
        contactId: contact.id, contactName: name, assignedTo: assigned, category, grade, elapsedMs: age,
        preview, lastType: lastInbound?.type || last?.type || "", lastAt, lastAtMs: lastInbound?.ms || 0, primary: false,
      });
      if (last?.direction === "inbound" && !outbound.some((row) => row.ms > last.ms)) push("Unanswered Inbound Message", base, elapsed);
      if (inbound.length && humanOutbound.length === 0 && elapsed != null && elapsed >= 7200000) push("No First Response", base, elapsed);
      if (outbound.length && last?.direction === "inbound" && elapsed != null && elapsed >= 86400000) {
        const stalled = elapsed >= 172800000 || hits(bodyText, urgentRe) ? "Critical" : "High";
        push("Stalled Thread", escalate(stalled, bodyText, elapsed), elapsed);
      }
      if (inbound.length && outbound.length) {
        const firstResponse = outbound[0].ms - inbound[0].ms;
        if (firstResponse >= 3600000) {
          const slow = firstResponse >= 28800000 ? "Critical" : firstResponse >= 14400000 ? "High" : "Medium";
          push("Slow First Response", escalate(slow, bodyText, elapsed), firstResponse);
          responseSamples.push(firstResponse);
        } else responseSamples.push(firstResponse);
      }
      for (const call of inbound.filter((row) => row.type === "Call" && ["no-answer", "no_answer", "busy", "failed", "canceled", "cancelled", "voicemail", "unanswered"].includes(row.status))) {
        if (outbound.some((row) => row.ms > call.ms)) continue;
        const age = now - call.ms;
        if (age >= 1800000) push("Missed Call Without Callback", escalate(gradeFor(age), bodyText, age), age);
      }
      if (lastInbound && hits(bodyText, buyingRe) && !outbound.some((row) => row.ms > lastInbound.ms)) {
        push("Buying Intent Unworked", elapsed != null && elapsed >= 86400000 ? "Critical" : "High", elapsed);
      }
      if (lastInbound && hits(bodyText, urgentRe) && !outbound.some((row) => row.ms > lastInbound.ms)) push("Urgent Language Unworked", "Critical", elapsed);
    }
    const grouped = new Map<string, Flag[]>();
    for (const flag of flags) grouped.set(flag.contactId, [...(grouped.get(flag.contactId) || []), flag]);
    for (const rows of grouped.values()) {
      rows.sort((a, b) => PRIMARY.indexOf(a.category) - PRIMARY.indexOf(b.category) || RANK[b.grade] - RANK[a.grade]);
      rows[0].primary = true;
    }
    const strongest = [...grouped.values()].map((rows) => rows.slice().sort((a, b) => RANK[b.grade] - RANK[a.grade] || (b.elapsedMs || 0) - (a.elapsedMs || 0))[0]);
    const ofGrade = (grade: string) => strongest.filter((row) => row.grade === grade).sort((a, b) => (b.elapsedMs || 0) - (a.elapsedMs || 0));
    const critical = ofGrade("Critical");
    const high = ofGrade("High");
    const medium = ofGrade("Medium");
    const low = ofGrade("Low");
    const flagRow = (row: Flag) => [esc(row.contactName), esc(row.assignedTo), esc(row.category), clock(row.elapsedMs), esc(row.preview || "not available"), esc(row.lastAt)];

    const reps = new Map<string, { name: string; ids: Set<string>; Critical: number; High: number; Medium: number; Low: number; oldest: number | null; missing: boolean }>();
    for (const row of strongest) {
      const bucket = reps.get(row.assignedTo) || { name: row.assignedTo, ids: new Set<string>(), Critical: 0, High: 0, Medium: 0, Low: 0, oldest: null, missing: false };
      bucket.ids.add(row.contactId);
      (bucket as any)[row.grade]++;
      if (row.elapsedMs == null) bucket.missing = true;
      else bucket.oldest = Math.max(bucket.oldest || 0, row.elapsedMs);
      reps.set(row.assignedTo, bucket);
    }
    const repRows = [...reps.values()].sort((a, b) => b.Critical - a.Critical || b.High - a.High || b.ids.size - a.ids.size || a.name.localeCompare(b.name));
    const worst = repRows[0];

    const channelOrder = ["SMS", "Call", "Email", "Automation"];
    const channelCounts: Record<string, number> = { SMS: 0, Call: 0, Email: 0, Automation: 0 };
    for (const conversation of conversations) {
      const type = kindOf({ type: conversation.lastMessageType || conversation.type });
      channelCounts[channelOrder.includes(type) ? type : "SMS"]++;
    }
    const channelTotal = conversations.length;
    let percents = channelOrder.map((name) => channelTotal ? Math.round((channelCounts[name] / channelTotal) * 1000) / 10 : 0);
    if (channelTotal) {
      const residue = Math.round((100 - percents.reduce((sum, value) => sum + value, 0)) * 10) / 10;
      const largest = percents.indexOf(Math.max(...percents));
      percents[largest] = Math.round((percents[largest] + residue) * 10) / 10;
    }

    const wins: string[] = [];
    for (const contact of inScope) {
      const messages = (byContact.get(contact.id) || []).sort((a, b) => a.ms - b.ms);
      const name = clean(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" "));
      const inbound = messages.filter((row) => row.direction === "inbound");
      const outbound = messages.filter((row) => row.direction === "outbound" && row.type !== "Automation");
      if (inbound.length && outbound.length) {
        const delta = outbound[0].ms - inbound[0].ms;
        if (delta >= 0 && delta < 900000 && outbound[0].ms >= now - 86400000) {
          wins.push(`${repName(outbound[0].userId)} replied to ${name} within ${Math.max(1, Math.round(delta / 60000))} minutes at ${zoned(outbound[0].ms, timeZone).label}.`);
        }
      }
      for (const call of inbound.filter((row) => row.type === "Call")) {
        const back = outbound.find((row) => row.ms > call.ms && row.ms - call.ms <= 1800000 && row.ms >= now - 86400000);
        if (back) wins.push(`${repName(back.userId)} returned ${name}'s missed call within ${Math.max(1, Math.round((back.ms - call.ms) / 60000))} minutes at ${zoned(back.ms, timeZone).label}.`);
      }
    }
    const winLines = wins.slice(0, 5);

    const priorities = strongest.slice().sort((a, b) => RANK[b.grade] - RANK[a.grade] || (b.elapsedMs || 0) - (a.elapsedMs || 0) || (hits(b.preview, buyingRe) ? 1 : 0) - (hits(a.preview, buyingRe) ? 1 : 0)).slice(0, 3);
    const median = responseSamples.length ? responseSamples.slice().sort((a, b) => a - b)[Math.floor((responseSamples.length - 1) / 2)] : null;
    const windowStart = zoned(now - 86400000, timeZone).label;
    const metadata = [
      ["Run", new Date(now).toISOString()],
      ["Location", locationId],
      ["Contacts in scope", String(inScope.length)],
      ["Conversations loaded", String(conversations.length)],
      ["Matched to in-scope contacts", String(matched.length)],
      ["Messages analysed", String([...byContact.values()].reduce((sum, rows) => sum + rows.length, 0))],
      ["Skipped conversations", String(skipped)],
      ["Contact count check", reportedTotal && reportedTotal !== contacts.length ? "CONTACT_COUNT_MISMATCH" : "matched"],
      ["Conversation pull", partialOldest ? "Partial conversation data: oldest slice unavailable" : partialRecent ? "Partial conversation data: recent slice unavailable" : "both slices"],
    ];
    const summary = inScope.length
      ? `${strongest.length} contacts are flagged. ${critical.length} are Critical. ${worst ? `${worst.name} has the most Critical flags (${worst.Critical}).` : "No rep has a Critical flag."} ${priorities[0] ? `The first priority is ${priorities[0].contactName}.` : "There is no urgent item."}`
      : "No contacts matched the new-lead scope today.";
    const blocks = [
      `<div style="background:#1a2340;color:#ffffff;padding:24px;"><h1 style="margin:0;font-size:22px;">Daily Sales Conversation Quality Report</h1><p style="margin:8px 0 0;">${esc(today.label)}</p><p style="margin:4px 0 0;">${esc(windowStart)} through ${esc(today.label)} (${esc(timeZone)})</p></div>`,
      section("Report metadata", table(["Item", "Value"], metadata.map(([label, value]) => [esc(label), esc(value)]), "not available")),
      section("Executive summary", `<p style="margin:0;">${esc(summary)}</p>`),
      section("KPI", `<table style="width:100%;border-collapse:separate;border-spacing:8px;"><tr>${[["Total flagged", strongest.length], ["Critical", critical.length], ["Median first response", median == null ? "not available" : clock(median)], ["Conversations loaded", conversations.length]].map(([label, value]) => `<td style="background:#f4f6f8;border:1px solid #dde3ea;border-radius:6px;padding:16px;width:25%;"><div style="font-size:28px;font-weight:bold;">${esc(value)}</div><div style="font-size:12px;text-transform:uppercase;color:#7f8c8d;">${esc(label)}</div></td>`).join("")}</tr></table>`),
      section("Channel ratio", table(["Channel", "Count", "Percent"], channelOrder.map((name, index) => [esc(name), String(channelCounts[name]), channelTotal ? `${percents[index].toFixed(1)}%` : "not available"]), "No contacts in this band today.")),
      section("Critical flags", table(["Contact", "Assigned rep", "Category", "Elapsed", "Last message", "Last message at"], critical.map(flagRow), "No contacts in this band today.")),
      section("High priority flags", table(["Contact", "Assigned rep", "Category", "Elapsed", "Last message", "Last message at"], high.map(flagRow), "No contacts in this band today.")),
      section("Medium priority flags", table(["Contact", "Assigned rep", "Category", "Elapsed", "Last message", "Last message at"], medium.map(flagRow), "No contacts in this band today.")),
      section("Low priority flags", table(["Contact", "Assigned rep", "Category", "Elapsed", "Last message", "Last message at"], low.map(flagRow), "No contacts in this band today.")),
    ];
    if (monday) {
      const weekendRows: string[][] = [];
      for (const contact of inScope) {
        const messages = (byContact.get(contact.id) || []).sort((a, b) => a.ms - b.ms);
        for (const inbound of messages.filter((row) => row.direction === "inbound")) {
          const when = zoned(inbound.ms, timeZone);
          const inWindow = (when.weekday === "Fri" && when.hour >= 18) || when.weekday === "Sat" || when.weekday === "Sun" || (when.weekday === "Mon" && when.hour < 9);
          const unanswered = !messages.some((row) => row.direction === "outbound" && row.ms > inbound.ms);
          if (!inWindow || !unanswered) continue;
          const name = clean(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" "));
          weekendRows.push([esc(name), esc(repName(contact.assignedTo || "")), "Weekend catch-up", clock(now - inbound.ms), esc(inbound.body.slice(0, 120)), esc(when.label)]);
        }
      }
      blocks.push(section("Weekend catch-up", table(["Contact", "Assigned rep", "Category", "Elapsed", "Last message", "Received"], weekendRows, "No contacts in this band today.")));
    }
    blocks.push(
      section("Wins", winLines.length ? `<ul style="margin:0;padding-left:18px;">${winLines.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>${winLines.length < 3 ? "<p>Fewer than three qualifying wins in this window.</p>" : ""}` : "<p>Fewer than three qualifying wins in this window.</p>"),
      section("Top 3 daily priorities", priorities.length ? priorities.map((row, index) => `<div style="margin:0 0 12px;"><p style="margin:0;font-weight:bold;">${index + 1}. Reply to ${esc(row.contactName)}</p><p style="margin:4px 0;">Why it matters: ${esc(row.contactName)} is ${esc(row.grade)} in ${esc(row.category)} and has waited ${esc(clock(row.elapsedMs))}.</p><p style="margin:4px 0;">Contacts: ${esc(row.contactName)} (${esc(row.contactId)})</p><p style="margin:4px 0;">Owner action: ${esc(row.assignedTo)} replies or calls before the next report.</p></div>`).join("") : "<p>No contacts in this band today.</p>"),
      section("Rep rollup", table(["Rep", "Flagged", "Critical", "High", "Medium", "Low", "Oldest flag"], repRows.map((row) => [esc(row.name), String(row.ids.size), String(row.Critical), String(row.High), String(row.Medium), String(row.Low), `${hours1(row.oldest)}${row.missing ? " (some ages unavailable)" : ""}`]), "No contacts in this band today.")),
      section("Appendix", table(["Contact", "Contact ID", "Assigned rep", "Strongest grade", "Categories", "Elapsed hours", "Last message at"], [...grouped.entries()].map(([, rows]) => rows.slice().sort((a, b) => RANK[b.grade] - RANK[a.grade] || (b.elapsedMs || 0) - (a.elapsedMs || 0))[0]).sort((a, b) => RANK[b.grade] - RANK[a.grade] || (b.elapsedMs || 0) - (a.elapsedMs || 0)).map((best) => {
        const rows = grouped.get(best.contactId) || [];
        return [esc(best.contactName), esc(best.contactId), esc(best.assignedTo), badge(best.grade), esc(rows.map((row) => row.category).join(", ")), hours1(best.elapsedMs), esc(best.lastAt)];
      }), "No contacts in this band today.")),
    );
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Daily Sales Conversation Quality Report</title></head><body style="margin:0;padding:16px;background:#f4f6f8;"><table align="center" style="max-width:620px;width:100%;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#2c3e50;"><tr><td style="padding:16px;">${blocks.join('<hr style="border:none;border-top:1px solid #dde3ea;margin:28px 0;">')}</td></tr></table></body></html>`;
    if (!html.includes("</html>")) return json({ error: "The report did not render completely.", status: "failed" }, 500);

    const top = priorities[0];
    let sms = strongest.length
      ? [`Daily Sales Report — ${today.short}`, `Flagged: ${strongest.length} | Critical: ${critical.length} | High: ${high.length} | Medium: ${medium.length} | Low: ${low.length}`, top ? `Top priority: Reply to ${top.contactName} — ${top.contactName}, ${hours1(top.elapsedMs)}h. Owner: ${top.assignedTo}.` : "Top priority: none.", worst ? `Rep watch: ${worst.name}, ${worst.Critical} critical, oldest ${hours1(worst.oldest)}h.` : "Rep watch: none.", "Full report emailed."].join(" ")
      : `Daily Sales Report — ${today.short}: no flagged conversations in scope. Full report emailed.`;
    const emailed: string[] = [];
    const texted: string[] = [];
    const problems: string[] = [];
    for (const recipient of recipients) {
      let emailFailed = false;
      if (recipient.email) {
        const mail = await crm(token, `${CRM}/conversations/messages`, {
          method: "POST",
          body: JSON.stringify({ type: "Email", locationId, contactId: recipient.contactId, emailFrom: fromEmail, subject: `Daily Sales Conversation Quality Report — ${today.day}`, html, message: sms }),
        });
        await db.from("send_log").insert({ run_id: runId, channel: "email", email: recipient.email, message_id: mail.body?.messageId || mail.body?.id || null, status: mail.ok ? "accepted" : "failed", error: mail.ok ? null : `HTTP ${mail.status}` });
        if (mail.ok) emailed.push(recipient.email);
        else { emailFailed = true; problems.push(`${recipient.email} email failed`); }
      }
      if (recipient.phone) {
        const textBody = emailFailed ? `${sms} Email delivery failed — see logs.` : sms;
        const parts = textBody.length <= 320 ? [textBody] : textBody.split(/(?<=\.)\s+/).reduce((chunks: string[], sentence: string) => {
          const last = chunks[chunks.length - 1] || "";
          if (`${last} ${sentence}`.trim().length <= 300) chunks[chunks.length - 1] = `${last} ${sentence}`.trim();
          else chunks.push(sentence);
          return chunks;
        }, [""]);
        for (let index = 0; index < parts.length; index++) {
          const segment = parts.length > 1 ? `${parts[index]} (${index + 1}/${parts.length})` : parts[index];
          const text = await crm(token, `${CRM}/conversations/messages`, {
            method: "POST",
            body: JSON.stringify({ type: "SMS", locationId, contactId: recipient.contactId, message: segment }),
          });
          await db.from("send_log").insert({ run_id: runId, channel: "sms", email: recipient.email || recipient.phone, message_id: text.body?.messageId || text.body?.id || null, status: text.ok ? "accepted" : "failed", error: text.ok ? null : `HTTP ${text.status}` });
          if (text.ok && index === 0) texted.push(recipient.phone);
          if (!text.ok) problems.push(`${recipient.phone} text failed`);
        }
      }
    }
    const status = emailed.length || texted.length ? (problems.length ? "partial" : "sent") : "failed";
    await db.from("report_runs").update({ status, finished_at: new Date().toISOString(), summary: sms, error: problems.join("; ") || null }).eq("id", runId);
    return json({ success: status !== "failed", status, emailed, texted, problems, summary: sms, company: settings?.company_name || "" });
  } catch (error: any) {
    if (runId) await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "RUN_FAILED" }).eq("id", runId);
    return json({ error: "The report failed before it sent.", status: "failed" }, 500);
  }
});
