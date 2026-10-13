// Daily Sales Conversation Quality Report, v5.
// One Ovanta location per run. Recipients are contacts tagged veydra-sales-report.
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
const LOST_PHRASES = ["went with someone else", "went a different direction", "found someone else", "already booked with", "decided to go with", "going with another", "chose someone else", "remove us from your list", "remove me from your list", "no longer interested", "not interested anymore", "going a different route", "different direction", "found another"];
const REACTION_PREFIXES = ['Liked "', 'Le gustó "', 'Loved "', 'Laughed at "', 'Emphasized "', 'Questioned "'];
const mid = "&" + "middot;";
const ndash = "&" + "ndash;";
const mdash = "&" + "mdash;";
const siren = "&" + "#128680;";
const ldquo = "&" + "ldquo;";
const rdquo = "&" + "rdquo;";

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
function dropGrade(grade: string) {
  if (grade === "Critical") return "High";
  if (grade === "High") return "Medium";
  if (grade === "Medium") return "Low";
  return "Low";
}
function lostPhrase(body: string) {
  const text = body.toLowerCase();
  return LOST_PHRASES.find((item) => text.includes(item)) || "";
}
function isReaction(body: string) {
  return REACTION_PREFIXES.some((prefix) => body.startsWith(prefix));
}
function sectionHead(title: string, color: string) {
  return `<div style="border-left:4px solid ${color};background:#f8f9fb;padding:12px 16px;font-size:17px;font-weight:bold;color:#1a2340;margin:20px 0 8px 0;">${esc(title)}</div>`;
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

    const pullSlice = async (sort: "desc" | "asc", pages: number, stopOutsideWindow: boolean) => {
      const rows: any[] = [];
      let cursor = "";
      let failed = false;
      for (let page = 0; page < pages; page++) {
        const params = new URLSearchParams({ locationId, limit: "100", sort });
        if (cursor) params.set("startAfterDate", cursor);
        const found = await crm(token, `${CRM}/conversations/search?${params}`);
        if (!found.ok) { failed = page === 0; break; }
        const batch = found.body?.conversations || [];
        rows.push(...batch);
        if (batch.length < 100) break;
        const last = batch[batch.length - 1];
        cursor = String(last?.lastMessageDate || last?.last_message_date || "");
        if (!cursor) break;
        if (stopOutsideWindow && new Date(cursor).getTime() < now - 86400000) break;
      }
      return { rows, failed };
    };
    const recent = await pullSlice("desc", 4, true);
    const oldest = await pullSlice("asc", 1, false);
    const partialOldest = oldest.failed;
    const partialRecent = recent.failed;
    const merged = new Map<string, any>();
    for (const conversation of [...recent.rows, ...oldest.rows]) {
      if (conversation?.id && !merged.has(conversation.id)) merged.set(conversation.id, conversation);
    }
    if (partialRecent && partialOldest) {
      await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "CONVERSATION_PULL_FAILED" }).eq("id", runId);
      return json({ error: "Conversation retrieval failed, so the report was not sent.", status: "failed" }, 502);
    }
    const matchedAll = conversations.filter((conversation) => contactIds.has(conversation.contactId || conversation.contact_id));
    const matched = matchedAll
      .slice()
      .sort((a, b) => new Date(b.lastMessageDate || b.last_message_date || 0).getTime() - new Date(a.lastMessageDate || a.last_message_date || 0).getTime())
      .slice(0, 80);
    const messageCap = matchedAll.length > matched.length;
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

    type Flag = { contactId: string; contactName: string; assignedTo: string; category: string; grade: string; elapsedMs: number | null; preview: string; lastAt: string; reaction: boolean };
    const flags: Flag[] = [];
    const lost: { contactId: string; contactName: string; phrase: string; preview: string; assignedTo: string }[] = [];
    const byContact = new Map<string, any[]>();
    const audit: { contactId: string; name: string; assigned: string; channel: string; inbound: number; outbound: number; firstIn: string; firstOut: string; response: string; classification: string; grade: string }[] = [];
    for (const row of withMessages) {
      if (row.failed) continue;
      const id = row.conversation.contactId || row.conversation.contact_id;
      byContact.set(id, [...(byContact.get(id) || []), ...row.messages]);
    }
    const responseByRep = new Map<string, number[]>();
    const qualifying: number[] = [];
    const wins = new Map<string, { name: string; channel: string; ms: number; line: string; assignedTo: string }>();
    const windowStartMs = now - 86400000;
    for (const contact of inScope) {
      const messages = (byContact.get(contact.id) || []).sort((a, b) => a.ms - b.ms);
      if (!messages.length) continue;
      const name = clean(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown");
      const assigned = repName(contact.assignedTo || "");
      const inbound = messages.filter((row) => row.direction === "inbound");
      const outbound = messages.filter((row) => row.direction === "outbound" && row.type !== "Automation");
      const last = messages[messages.length - 1];
      const lastInbound = inbound[inbound.length - 1];
      const bodyText = lastInbound?.body || "";
      const reaction = !!(lastInbound && isReaction(bodyText));
      const phraseHit = lastInbound ? lostPhrase(bodyText) : "";
      const elapsed = lastInbound ? now - lastInbound.ms : null;
      const firstIn = inbound[0];
      const firstOut = outbound.find((row) => firstIn && row.ms > firstIn.ms);
      const responseMs = firstIn && firstOut ? firstOut.ms - firstIn.ms : null;
      if (responseMs != null && responseMs > 0) {
        qualifying.push(responseMs);
        const bucket = responseByRep.get(assigned) || [];
        bucket.push(responseMs);
        responseByRep.set(assigned, bucket);
      }
      let classification = "Clear";
      let grade = "";
      if (phraseHit) {
        classification = "Lost Lead";
        grade = "Critical";
        lost.push({ contactId: contact.id, contactName: name, phrase: phraseHit, preview: bodyText.slice(0, 120), assignedTo: assigned });
      } else if (last?.direction === "outbound" && !inbound.some((row) => row.ms > last.ms)) {
        classification = "Waiting for Reply";
      } else {
        const preview = reaction ? "[iMessage reaction]" : bodyText.slice(0, 120);
        const lastAt = lastInbound ? zoned(lastInbound.ms, timeZone).label : "not available";
        const base = escalate(gradeFor(elapsed), bodyText, elapsed);
        const push = (category: string, nextGrade: string, age: number | null) => flags.push({
          contactId: contact.id, contactName: name, assignedTo: assigned, category, grade: reaction ? dropGrade(nextGrade) : nextGrade,
          elapsedMs: age, preview, lastAt, reaction,
        });
        if (last?.direction === "inbound" && !outbound.some((row) => row.ms > last.ms)) push("Unanswered Inbound Message", base, elapsed);
        if (inbound.length && outbound.length === 0 && elapsed != null && elapsed >= 7200000) push("No First Response", base, elapsed);
        if (outbound.length && last?.direction === "inbound" && elapsed != null && elapsed >= 86400000) {
          const stalled = elapsed >= 172800000 || hits(bodyText, urgentRe) ? "Critical" : "High";
          push("Stalled Thread", escalate(stalled, bodyText, elapsed), elapsed);
        }
        if (responseMs != null && responseMs >= 3600000) {
          const slow = responseMs >= 28800000 ? "Critical" : responseMs >= 14400000 ? "High" : "Medium";
          push("Slow First Response", escalate(slow, bodyText, elapsed), responseMs);
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
      if (firstIn && firstOut && firstOut.ms >= windowStartMs) {
        const delta = firstOut.ms - firstIn.ms;
        if (delta > 0 && delta < 900000) {
          const current = wins.get(contact.id);
          if (!current || delta < current.ms) wins.set(contact.id, { name, channel: firstOut.type, ms: delta, assignedTo: repName(firstOut.userId), line: `${repName(firstOut.userId)} replied after ${name} wrote in. The reply landed at ${zoned(firstOut.ms, timeZone).label}.` });
        }
      }
      for (const call of inbound.filter((row) => row.type === "Call" && row.ms >= windowStartMs)) {
        const back = outbound.find((row) => row.ms > call.ms && row.ms - call.ms <= 1800000 && row.ms >= windowStartMs);
        if (!back) continue;
        const delta = back.ms - call.ms;
        const current = wins.get(contact.id);
        if (!current || delta < current.ms) wins.set(contact.id, { name, channel: "Call", ms: delta, assignedTo: repName(back.userId), line: `${repName(back.userId)} returned ${name}'s call at ${zoned(back.ms, timeZone).label}.` });
      }
      const rows = flags.filter((row) => row.contactId === contact.id);
      const best = rows.slice().sort((a, b) => RANK[b.grade] - RANK[a.grade] || (b.elapsedMs || 0) - (a.elapsedMs || 0))[0];
      audit.push({
        contactId: contact.id, name, assigned, channel: (lastInbound || last)?.type || "SMS",
        inbound: inbound.length, outbound: outbound.length,
        firstIn: firstIn ? zoned(firstIn.ms, timeZone).label : "none",
        firstOut: outbound[0] ? zoned(outbound[0].ms, timeZone).label : "none",
        response: responseMs != null && responseMs > 0 ? clock(responseMs) : "excluded — outbound not after inbound",
        classification: phraseHit ? "Lost Lead" : best?.category || classification,
        grade: phraseHit ? "Critical" : best?.grade || "none",
      });
    }
    const grouped = new Map<string, Flag[]>();
    for (const flag of flags) grouped.set(flag.contactId, [...(grouped.get(flag.contactId) || []), flag]);
    const strongest = [...grouped.values()].map((rows) => rows.slice().sort((a, b) => PRIMARY.indexOf(a.category) - PRIMARY.indexOf(b.category) || RANK[b.grade] - RANK[a.grade])[0]);
    const ofGrade = (grade: string) => strongest.filter((row) => row.grade === grade).sort((a, b) => (b.elapsedMs || 0) - (a.elapsedMs || 0));
    const critical = ofGrade("Critical");
    const high = ofGrade("High");
    const medium = ofGrade("Medium");
    const low = ofGrade("Low");
    const lostIds = new Set(lost.map((row) => row.contactId));
    const reactionNote = " Note: last inbound is an iMessage reaction, not a question — a warm check-in text is appropriate rather than urgent escalation.";
    const priorityPool = [
      ...lost.map((row) => ({ contactName: row.contactName, contactId: row.contactId, assignedTo: row.assignedTo, why: `${row.contactName} said "${row.phrase}" and must be archived.`, action: `${row.assignedTo} archives the contact, removes them from all sequences, and does not follow up.`, reaction: false })),
      ...strongest.filter((row) => !row.reaction).map((row) => ({ contactName: row.contactName, contactId: row.contactId, assignedTo: row.assignedTo, why: `${row.contactName} is ${row.grade} on ${row.category} and has waited ${clock(row.elapsedMs)}.`, action: `${row.assignedTo} replies or calls before the next report.`, reaction: false })),
      ...strongest.filter((row) => row.reaction).map((row) => ({ contactName: row.contactName, contactId: row.contactId, assignedTo: row.assignedTo, why: `${row.contactName} is ${row.grade} on ${row.category} and has waited ${clock(row.elapsedMs)}.`, action: `${row.assignedTo} sends a warm check-in rather than an urgent follow-up.`, reaction: true })),
    ].slice(0, 3);
    const medianLabel = qualifying.length >= 3 ? clock(qualifying.slice().sort((a, b) => a - b)[Math.floor((qualifying.length - 1) / 2)]) : "not enough data";
    const company = settings?.company_name || "This company";
    const channelOrder = ["SMS", "Call", "Email", "Automation"] as const;
    const channelColors: Record<string, string> = { SMS: "#2ecc71", Call: "#3498db", Email: "#9b59b6", Automation: "#95a5a6" };
    const channelCounts: Record<string, number> = { SMS: 0, Call: 0, Email: 0, Automation: 0 };
    for (const rows of byContact.values()) {
      for (const message of rows) {
        if (message.ms < windowStartMs) continue;
        const type = channelOrder.includes(message.type) ? message.type : "SMS";
        channelCounts[type]++;
      }
    }
    const channelTotal = channelOrder.reduce((sum, name) => sum + channelCounts[name], 0);
    let percents = channelOrder.map((name) => channelTotal ? Math.round((channelCounts[name] / channelTotal) * 100) : 0);
    if (channelTotal) {
      const residue = 100 - percents.reduce((sum, value) => sum + value, 0);
      percents[percents.indexOf(Math.max(...percents))] += residue;
    }
    const biggest = channelOrder.slice().sort((a, b) => channelCounts[b] - channelCounts[a])[0];
    const channelNote = channelTotal
      ? `${biggest} is ${percents[channelOrder.indexOf(biggest)]}% of messages in this window (${channelCounts[biggest]} of ${channelTotal}). The other channels are ${channelOrder.filter((name) => name !== biggest).map((name) => `${name} ${percents[channelOrder.indexOf(name)]}%`).join(", ")}. Coverage should follow the channel that actually carried the conversations.`
      : "No messages in window";
    const reps = new Map<string, { name: string; flagged: number; critical: number; wins: number; lost: number }>();
    const touch = (name: string) => reps.get(name) || reps.set(name, { name, flagged: 0, critical: 0, wins: 0, lost: 0 }).get(name)!;
    for (const row of strongest) {
      const bucket = touch(row.assignedTo);
      bucket.flagged++;
      if (row.grade === "Critical") bucket.critical++;
    }
    for (const row of lost) touch(row.assignedTo).lost++;
    for (const win of wins.values()) touch(win.assignedTo).wins++;
    const repRows = [...reps.values()].sort((a, b) => b.critical - a.critical || b.flagged - a.flagged || a.name.localeCompare(b.name));
    const flagTable = (rows: Flag[]) => table(["Contact", "Last message", "Age", "Urgency"], rows.map((row) => [esc(row.contactName), esc(row.preview || "not available"), clock(row.elapsedMs), badge(row.grade)]), "No contacts in this grade.");
    const blocks: string[] = [];
    blocks.push(sectionHead("Report metadata", "#1a2340") + table(["Item", "Value"], [
      ["Sub-account", company],
      ["Generated", today.label],
      ["Timezone", timeZone],
      ["Reporting window", `${zoned(windowStartMs, timeZone).label} to ${today.label}`],
      ["Recipient source", "veydra-sales-report"],
      ["Conversations loaded", String(conversations.length)],
      ["Matched to new leads", String(matched.length)],
      ["Excluded from message pull", String(conversations.length - matchedAll.length)],
      ["Messages analysed", String([...byContact.values()].reduce((sum, rows) => sum + rows.length, 0))],
      ["Skipped conversations", String(skipped)],
      ["Warnings", [partialRecent ? "recent slice unavailable" : "", partialOldest ? "oldest slice unavailable" : "", messageCap ? "message pull capped at 80" : ""].filter(Boolean).join("; ") || "none"],
    ].map(([label, value]) => [esc(label), esc(value)]), "not available"));
    const summary = `${strongest.length} contacts are flagged and ${critical.length} are Critical. Median first response is ${medianLabel}. ${lost.length ? `${lost.length} lost lead${lost.length === 1 ? "" : "s"} must be archived and not followed up.` : "No lost-lead language was found."} ${priorityPool[0] ? `The first thing to do is ${priorityPool[0].action}` : "There is no priority contact in this window."}`;
    blocks.push(sectionHead("Executive summary", "#1a2340") + `<p style="margin:0;color:#1a2340;">${esc(summary)}</p>`);
    const flaggedColor = strongest.length ? "#e74c3c" : "#27ae60";
    blocks.push(sectionHead("KPI", "#1a2340") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;"><tr>
      <td width="25%" style="padding:0 4px;"><div style="background:${flaggedColor};padding:16px;border-radius:8px;text-align:center;"><div style="color:#ffffff;font-size:28px;font-weight:bold;line-height:1.1;">${strongest.length}</div><div style="color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;margin-top:4px;">Total Flagged</div></div></td>
      <td width="25%" style="padding:0 4px;"><div style="background:#c0392b;padding:16px;border-radius:8px;text-align:center;"><div style="color:#ffffff;font-size:28px;font-weight:bold;line-height:1.1;">${critical.length}</div><div style="color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;margin-top:4px;">Critical</div></div></td>
      <td width="25%" style="padding:0 4px;"><div style="background:#2c3e50;padding:16px;border-radius:8px;text-align:center;"><div style="color:#7ec8e3;font-size:28px;font-weight:bold;line-height:1.1;">${esc(medianLabel)}</div><div style="color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;margin-top:4px;">Median Response</div></div></td>
      <td width="25%" style="padding:0 4px;"><div style="background:#1a2340;padding:16px;border-radius:8px;text-align:center;"><div style="color:#7ec8e3;font-size:28px;font-weight:bold;line-height:1.1;">${conversations.length}</div><div style="color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;margin-top:4px;">Conversations Loaded</div></div></td>
    </tr></table>`);
    const bars = channelTotal
      ? channelOrder.map((name, index) => `<div style="font-size:12px;color:#1a2340;font-weight:bold;">${name} ${mdash} ${channelCounts[name]} (${percents[index]}%)</div><div style="background:${channelColors[name]};height:20px;border-radius:4px;width:${Math.max(percents[index], 1)}%;margin:4px 0;"></div>`).join("") + `<p style="margin:8px 0 0;color:#1a2340;">${esc(channelNote)}</p>`
      : `<p style="margin:0;">No messages in window</p>`;
    blocks.push(sectionHead("Channel ratio", "#1a2340") + `<div style="margin:16px 0;">${bars}</div>`);
    if (lost.length) {
      blocks.push(sectionHead("Lost leads", "#e74c3c") + `<div style="border:2px solid #e74c3c;background:#fdecea;border-radius:6px;padding:16px;margin:20px 0;"><div style="color:#e74c3c;font-size:16px;font-weight:bold;text-transform:uppercase;margin-bottom:10px;">${siren} COMPLIANCE / PIPELINE RISK</div><div style="color:#1a2340;font-size:13px;margin-bottom:12px;">Action required for every contact below: archive contact, remove from all sequences, do not follow up.</div>${table(["Contact", "Trigger phrase", "Last inbound"], lost.map((row) => [esc(row.contactName), `${ldquo}${esc(row.phrase)}${rdquo}`, esc(row.preview || "not available")]), "No contacts in this grade.")}</div>`);
    }
    blocks.push(sectionHead("Critical flags", "#c0392b") + flagTable(critical));
    blocks.push(sectionHead("High priority flags", "#e67e22") + flagTable(high));
    blocks.push(sectionHead("Medium priority flags", "#f1c40f") + flagTable(medium));
    blocks.push(sectionHead("Low priority flags", "#95a5a6") + flagTable(low));
    if (monday) {
      const weekendRows: string[][] = [];
      for (const contact of inScope) {
        if (lostIds.has(contact.id)) continue;
        const messages = (byContact.get(contact.id) || []).sort((a, b) => a.ms - b.ms);
        for (const inbound of messages.filter((row) => row.direction === "inbound")) {
          const when = zoned(inbound.ms, timeZone);
          const inWindow = (when.weekday === "Fri" && when.hour >= 18) || when.weekday === "Sat" || when.weekday === "Sun" || (when.weekday === "Mon" && when.hour < 9);
          const unanswered = !messages.some((row) => row.direction === "outbound" && row.type !== "Automation" && row.ms > inbound.ms);
          if (!inWindow || !unanswered) continue;
          weekendRows.push([esc(clean(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" "))), esc(isReaction(inbound.body) ? "[iMessage reaction]" : inbound.body.slice(0, 120)), clock(now - inbound.ms), badge(gradeFor(now - inbound.ms))]);
        }
      }
      blocks.push(sectionHead("Weekend catch-up", "#1a2340") + table(["Contact", "Last message", "Age", "Urgency"], weekendRows, "No contacts in this grade."));
    }
    const winCards = [...wins.values()].map((win) => `<div style="border-left:4px solid #27ae60;background:#eafaf1;border-radius:0 6px 6px 0;padding:12px 14px;margin-bottom:8px;"><div style="font-weight:bold;color:#1a2340;font-size:14px;">${esc(win.name)} ${mid} ${esc(win.channel)} ${mid} replied in ${esc(clock(win.ms))}</div><div style="font-size:13px;color:#444;margin-top:4px;">${esc(win.line)}</div></div>`).join("");
    blocks.push(sectionHead("Wins", "#27ae60") + (winCards || "<p style=\"margin:0;\">No wins recorded in this window.</p>"));
    blocks.push(sectionHead("Top 3 daily priorities", "#1a2340") + (priorityPool.length ? priorityPool.map((row, index) => `<div style="margin:0 0 12px;"><p style="margin:0;font-weight:bold;color:#1a2340;">${index + 1}. ${esc(row.contactName)}</p><p style="margin:4px 0;">${esc(row.why)}</p><p style="margin:4px 0;">Next action: ${esc(row.action)}</p>${row.reaction ? `<p style="margin:4px 0;">${esc(reactionNote.trim())}</p>` : ""}</div>`).join("") : "<p style=\"margin:0;\">No contacts in this grade.</p>"));
    blocks.push(sectionHead("Rep rollup", "#1a2340") + table(["Rep", "Flagged", "Critical", "Wins", "Lost", "Median response"], repRows.map((row) => {
      const samples = responseByRep.get(row.name) || [];
      const label = samples.length >= 3 ? clock(samples.slice().sort((a, b) => a - b)[Math.floor((samples.length - 1) / 2)]) : "not enough data";
      return [esc(row.name), String(row.flagged), String(row.critical), String(row.wins), String(row.lost), esc(label)];
    }), "No contacts in this grade."));
    blocks.push(sectionHead("Appendix", "#1a2340") + table(["Contact", "Contact ID", "Channel", "In", "Out", "First inbound", "First outbound", "First response", "Classification", "Grade"], audit.map((row) => [esc(row.name), esc(row.contactId), esc(row.channel), String(row.inbound), String(row.outbound), esc(row.firstIn), esc(row.firstOut), esc(row.response), esc(row.classification), row.grade === "none" ? "none" : badge(row.grade)]), "No contacts in this grade."));
    const header = `<div style="background:#1a2340;padding:32px;text-align:center;"><div style="color:#ffffff;font-size:24px;font-weight:bold;line-height:1.3;">Daily Sales Conversation Quality Report</div><div style="color:#7ec8e3;font-size:16px;font-weight:bold;margin-top:8px;">${esc(company)}</div><div style="color:#a8b8d8;font-size:13px;margin-top:4px;">${esc(today.label)} ${mid} generated ${esc(today.label)} ${esc(timeZone)}</div><div style="display:inline-block;margin-top:14px;padding:5px 14px;border-radius:14px;background:rgba(255,255,255,0.10);color:#ffffff;font-size:12px;">Reporting window: ${esc(zoned(windowStartMs, timeZone).label)} ${ndash} ${esc(today.label)}</div></div>`;
    const footer = `<div style="background:#1a2340;padding:24px;text-align:center;"><div style="color:#7ec8e3;font-size:14px;font-weight:bold;">${esc(company)}</div><div style="color:#a8b8d8;font-size:12px;margin-top:6px;">Generated ${esc(today.label)} ${esc(timeZone)}</div><div style="color:#a8b8d8;font-size:12px;margin-top:2px;">Reporting window: ${esc(zoned(windowStartMs, timeZone).label)} ${ndash} ${esc(today.label)}</div><div style="color:rgba(255,255,255,0.45);font-size:11px;margin-top:12px;">Powered by Veydra AI</div></div>`;
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Daily Sales Conversation Quality Report</title></head><body style="margin:0;padding:0;background:#f4f6f8;"><div style="max-width:620px;margin:0 auto;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">${header}<div style="padding:8px 16px 16px;">${blocks.join("")}</div>${footer}</div></body></html>`;
    if (!html.includes("</html>")) return json({ error: "The report did not render completely.", status: "failed" }, 500);
    const top = priorityPool[0];
    const risk = lost.length ? ` PIPELINE RISK: ${lost.length} contact(s) require archival — do not follow up.` : "";
    let sms = [
      `${company} — Daily Conversation Quality — ${today.short}`,
      `Flagged: ${strongest.length} (Critical ${critical.length}).${risk}`,
      `Median first response: ${medianLabel}`,
      `Lost leads: ${lost.length}`,
      top ? `Top priority: ${top.contactName} — ${top.action}` : "Top priority: none.",
      `Full report sent to ${recipients.length} recipients.`,
    ].join(" ");

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
