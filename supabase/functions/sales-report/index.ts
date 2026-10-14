// Veydra sales report. One Ovanta location, one window: 24h, 7d, or 30d.
// The area key stays on the territory. It is never written into the email.
import { createClient } from "jsr:@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const CRM_FALLBACK = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";
const WINDOWS: Record<string, { ms: number; days: number; label: string; noun: string }> = {
  "24h": { ms: 86400000, days: 1, label: "24-Hour Pulse", noun: "24-Hour Sales Pulse" },
  "7d": { ms: 604800000, days: 7, label: "7-Day Digest", noun: "7-Day Sales Digest" },
  "30d": { ms: 2592000000, days: 30, label: "30-Day Overview", noun: "30-Day Sales Overview" },
};
const LOST = ["went with someone else", "went elsewhere", "no thank you", "not interested", "do not contact", "don't contact", "wrong number", "already booked", "already have", "too expensive", "can't afford", "cannot afford", "no thanks", "unsubscribe", "remove me", "cancel", "stop", "sold", "spam"];
const TAP = ["Liked ", "Loved ", "Laughed at ", "Emphasized ", "Questioned ", "Disliked "];
const QUOTES = ['"', "\u201c", "\u201d"];

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"]/g, (ch) => ch === "&" ? "&" : ch === "<" ? "<" : ch === ">" ? ">" : """);
}
function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
function tagsOf(contact: any) {
  return (Array.isArray(contact?.tags) ? contact.tags : []).map((tag: string) => String(tag).trim().toLowerCase());
}
function stamp(ms: number) {
  const n = Number(ms);
  return Number.isFinite(n) ? n : 0;
}
function when(value: unknown) {
  const ms = new Date(String(value || "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
function parts(ms: number, timeZone: string) {
  const bag = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  const day = String(bag.day || "").padStart(2, "0");
  return {
    weekday: bag.weekday || "",
    label: `${bag.weekday} ${day} ${bag.month} ${bag.year} ${bag.hour}:${bag.minute}`,
    short: `${day} ${bag.month} ${bag.year}`,
    day: new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)),
  };
}
function human(ms: number | null) {
  if (ms == null) return "not enough data";
  if (ms <= 0) return "excluded — outbound not after inbound";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${Math.max(1, totalMin)} min`;
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours < 24) return mins ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
function gradeFor(ms: number) {
  if (ms >= 86400000) return "Critical";
  if (ms >= 28800000) return "High";
  if (ms >= 7200000) return "Medium";
  return "Low";
}
function dropGrade(grade: string) {
  if (grade === "Critical") return "High";
  if (grade === "High") return "Medium";
  if (grade === "Medium") return "Low";
  return "Low";
}
function lostPhrase(body: string) {
  const text = ` ${clean(body).toLowerCase()} `;
  return LOST.find((phrase) => new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) || "";
}
function isReaction(message: any, body: string) {
  const type = String(message?.messageType || message?.type || "").toLowerCase();
  const tap = TAP.some((prefix) => QUOTES.some((quote) => body.startsWith(prefix + quote) || body.startsWith(prefix.trim() + " " + quote)));
  return (type.includes("imessage") && tap) || !!(message?.reaction || message?.meta?.reaction);
}
function kindOf(message: any) {
  const raw = String(message?.messageType || message?.type || "").toLowerCase();
  if (raw.includes("email") || raw === "45") return "Email";
  if (raw.includes("call") || raw.includes("voicemail") || raw === "1" || raw === "2") return "Call";
  if (raw.includes("auto") || raw.includes("activity") || raw === "100") return "Automation";
  if (raw.includes("imessage")) return "iMessage";
  return "SMS";
}
function badge(grade: string) {
  const bg = grade === "Critical" ? "#e74c3c" : grade === "High" ? "#e67e22" : grade === "Medium" ? "#f1c40f" : "#95a5a6";
  const color = grade === "Medium" ? "#1a2340" : "#ffffff";
  return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;background:${bg};font:700 11px Arial,sans-serif;color:${color};letter-spacing:.5px;">${esc(grade.toUpperCase())}</span>`;
}
function heading(title: string) {
  return `<h2 style="font:700 18px Arial,sans-serif;color:#1a2340;border-bottom:2px solid #e8ecf3;padding-bottom:8px;margin:30px 0 12px;">${esc(title)}</h2>`;
}
function table(headers: string[], rows: string[][], headerBg = "#1a2340", headerColor = "#ffffff") {
  const head = `<tr style="background:${headerBg};">${headers.map((header) => `<th align="left" style="padding:8px 10px;font:700 12px Arial,sans-serif;color:${headerColor};border-bottom:1px solid #e8ecf3;">${esc(header)}</th>`).join("")}</tr>`;
  const body = rows.map((row, index) => `<tr style="background:${index % 2 ? "#f7f8fb" : "#ffffff"};">${row.map((cell) => `<td style="padding:10px;border-bottom:1px solid #e8ecf3;font:400 13px Arial,sans-serif;color:#1a2340;vertical-align:top;">${cell}</td>`).join("")}</tr>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${head}${body}</table>`;
}
function tile(value: string, label: string, bg: string, size = "28px") {
  const labelColor = bg === "#1a2340" || bg === "#2c3e50" ? "#c7d3e8" : "#ffffff";
  return `<td width="20%" style="background:${bg};border-radius:6px;padding:16px 10px;text-align:center;"><div style="font:700 ${size} Arial,sans-serif;color:#ffffff;line-height:1.1;">${esc(value)}</div><div style="font:600 11px Arial,sans-serif;color:${labelColor};letter-spacing:1px;text-transform:uppercase;margin-top:4px;">${esc(label)}</div></td>`;
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
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 300) }; }
    if ((res.status === 429 || res.status >= 500) && attempt < 2 && String(init?.method || "GET").toUpperCase() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      return crm(token, url, init, attempt + 1);
    }
    return { ok: res.ok, status: res.status, body };
  } catch {
    if (attempt < 1) return crm(token, url, init, attempt + 1);
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
function phoneOf(value: unknown) {
  const digits = String(value || "").replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const base = (Deno.env.get("API_BASE_URL") || CRM_FALLBACK).replace(/\/$/, "");
  if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase env" }, 500);
  const db = createClient(supabaseUrl, serviceKey);
  let runId = "";
  let resolvedWindow = "24h";
  let resolvedLocation = "";
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "ABORT: malformed payload", status: "failed" }, 400);
    if (body.trigger && body.trigger !== "RUN_REPORT") return json({ error: "ABORT: unexpected trigger value", status: "failed" }, 400);
    resolvedWindow = WINDOWS[String(body.window || "")] ? String(body.window) : "24h";
    const spec = WINDOWS[resolvedWindow];
    const territoryId = String(body.territoryId || "").trim();
    resolvedLocation = String(body.locationId || "").trim();
    if (!territoryId && !resolvedLocation) return json({ error: "ABORT: missing locationId", status: "failed" }, 400);

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
      const allowed = manager?.role === "super_admin" || (territoryId && (manager?.territory_id === territoryId || extras.includes(territoryId)));
      if (!["owner", "super_admin"].includes(String(manager?.role || "")) || !allowed) return json({ error: "Only an owner can send this report." }, 403);
    }

    let settingsQuery = db.from("portal_settings").select("company_name, timezone, hl_api_key, hl_location_id, smtp_from_email, territory_id").limit(1);
    settingsQuery = territoryId ? settingsQuery.eq("territory_id", territoryId) : settingsQuery.eq("hl_location_id", resolvedLocation);
    const { data: settings } = await settingsQuery.maybeSingle();
    const token = String(settings?.hl_api_key || "").trim();
    const locationId = String(settings?.hl_location_id || resolvedLocation).trim();
    const areaId = String(settings?.territory_id || territoryId || "").trim();
    resolvedLocation = locationId;
    const timeZone = settings?.timezone || "America/New_York";
    const company = settings?.company_name || "This company";
    const fromEmail = Deno.env.get("FROM_EMAIL") || settings?.smtp_from_email || "";
    if (!token || !locationId) return json({ error: "This area has no Ovanta key or location." }, 422);
    if (!fromEmail) return json({ error: "FROM_EMAIL is not set for this area." }, 422);

    const NOW = Date.now();
    const WINDOW_START = NOW - spec.ms;
    const today = parts(NOW, timeZone);
    const monday = today.weekday === "Mon";
    await db.rpc("exec_sql_batch", { sql_texts: [
      `CREATE TABLE IF NOT EXISTS public.report_runs (
        id uuid primary key default gen_random_uuid(), location_id text not null, territory_id uuid,
        run_date date not null, status text not null default 'queued', started_at timestamptz default now(),
        finished_at timestamptz, error text, summary text, report_window text
      )`,
      "ALTER TABLE public.report_runs ADD COLUMN IF NOT EXISTS report_window text",
      "DROP INDEX IF EXISTS public.report_runs_location_day",
      "CREATE UNIQUE INDEX IF NOT EXISTS report_runs_location_day_window ON public.report_runs (location_id, run_date, report_window)",
      `CREATE TABLE IF NOT EXISTS public.send_log (
        id uuid primary key default gen_random_uuid(), run_id uuid, channel text, email text,
        message_id text, conversation_id text, status text, error text, sent_at timestamptz default now()
      )`,
    ] });
    const { data: existing } = await db.from("report_runs").select("id, status, started_at").eq("location_id", locationId).eq("run_date", today.day).eq("report_window", resolvedWindow).maybeSingle();
    if (fromClock && existing && (existing.status === "sent" || existing.status === "partial")) {
      return json({ success: true, already: true, status: existing.status, window: resolvedWindow });
    }
    if (fromClock && existing?.status === "queued" && existing.started_at && NOW - new Date(existing.started_at).getTime() < 180000) {
      return json({ success: true, already: true, status: "queued", window: resolvedWindow });
    }
    if (existing?.id) {
      runId = existing.id;
      await db.from("report_runs").update({ status: "queued", error: null, started_at: new Date(NOW).toISOString(), report_window: resolvedWindow }).eq("id", runId);
    } else {
      const { data: created } = await db.from("report_runs").insert({ location_id: locationId, territory_id: areaId || null, run_date: today.day, status: "queued", report_window: resolvedWindow }).select("id").single();
      runId = created?.id || "";
    }

    const flags: string[] = [];
    const recipientsRes = await crm(token, `${base}/contacts/search`, {
      method: "POST",
      body: JSON.stringify({ locationId, pageLimit: 50, filters: [{ field: "tags", operator: "contains", value: "veydra-sales-report" }] }),
    });
    if (recipientsRes.status === 401 || recipientsRes.status === 403) {
      await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "ABORT: auth failure" }).eq("id", runId);
      return json({ error: "ABORT: auth failure", status: "failed" }, 401);
    }
    const recipients = (recipientsRes.ok ? recipientsRes.body?.contacts || [] : []).map((contact: any) => ({
      contactId: contact.id,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email || "")) ? String(contact.email).trim() : "",
      phone: phoneOf(contact.phone),
    })).filter((row: any) => row.contactId && (row.email || row.phone));
    if (!recipients.length) {
      await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: `ABORT: no recipients tagged veydra-sales-report for location ${locationId}` }).eq("id", runId);
      return json({ error: `ABORT: no recipients tagged veydra-sales-report for location ${locationId}`, status: "failed", window: resolvedWindow }, 422);
    }

    const contacts: any[] = [];
    const seenContacts = new Set<string>();
    let contactMode = "list";
    for (let page = 0; page < 20; page++) {
      const found = await crm(token, `${base}/contacts/?locationId=${encodeURIComponent(locationId)}&limit=100&skip=${page * 100}`);
      if (!found.ok) {
        if (found.status === 401 || found.status === 403) return json({ error: "ABORT: auth failure", status: "failed" }, 401);
        if (page === 0) contactMode = "search";
        else flags.push("PARTIAL");
        break;
      }
      const batch = found.body?.contacts || [];
      const fresh = batch.filter((row: any) => row?.id && !seenContacts.has(row.id));
      fresh.forEach((row: any) => seenContacts.add(row.id));
      contacts.push(...fresh);
      if (batch.length < 100) break;
      if (!fresh.length) { contactMode = "search"; break; }
      if (page === 19) flags.push("PARTIAL");
    }
    if (contactMode === "search") {
      contacts.length = 0;
      seenContacts.clear();
      for (let page = 1; page <= 20; page++) {
        const found = await crm(token, `${base}/contacts/search`, {
          method: "POST",
          body: JSON.stringify({
            locationId, page, pageLimit: 100,
            filters: [{ group: "AND", filters: [
              { field: "tags", operator: "contains", value: "new lead" },
              { field: "tags", operator: "not_contains", value: "booked" },
              { field: "tags", operator: "not_contains", value: "hired" },
            ] }],
          }),
        });
        if (!found.ok) { flags.push("PARTIAL"); break; }
        const batch = found.body?.contacts || [];
        const fresh = batch.filter((row: any) => row?.id && !seenContacts.has(row.id));
        fresh.forEach((row: any) => seenContacts.add(row.id));
        contacts.push(...fresh);
        if (batch.length < 100 || !fresh.length) break;
      }
    }
    const inScope = contacts.filter((contact) => {
      const tags = tagsOf(contact);
      const lead = tags.some((tag: string) => tag.includes("new lead"));
      const closed = tags.some((tag: string) => tag === "booked" || tag === "hired" || tag.includes("booked") || tag.includes("hired"));
      const added = when(contact.dateAdded || contact.date_added);
      const active = when(contact.lastActivity || contact.last_activity || contact.dateUpdated);
      return lead && !closed && ((added && added >= WINDOW_START) || (active && active >= WINDOW_START));
    });

    const conversations: any[] = [];
    const seenConvos = new Set<string>();
    for (let page = 0; page < 20; page++) {
      const found = await crm(token, `${base}/conversations/search?locationId=${encodeURIComponent(locationId)}&limit=100&skip=${page * 100}&sort=desc`);
      if (!found.ok) {
        if (page === 0) {
          await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "ABORT: conversation retrieval failed" }).eq("id", runId);
          return json({ error: "Conversation retrieval failed, so the report was not sent.", status: "failed" }, 502);
        }
        flags.push("PARTIAL");
        break;
      }
      const batch = found.body?.conversations || [];
      const fresh = batch.filter((row: any) => row?.id && !seenConvos.has(row.id));
      fresh.forEach((row: any) => seenConvos.add(row.id));
      conversations.push(...fresh);
      if (batch.length < 100 || !fresh.length) break;
      const oldest = when(batch[batch.length - 1]?.lastMessageDate || batch[batch.length - 1]?.last_message_date);
      if (oldest && oldest < WINDOW_START) break;
      if (page === 19) flags.push("PARTIAL");
    }
    const loaded = conversations.filter((row) => when(row.lastMessageDate || row.last_message_date) >= WINDOW_START);
    const scopeIds = new Set(inScope.map((contact) => contact.id));
    const matchedAll = loaded.filter((row) => scopeIds.has(row.contactId || row.contact_id));
    const matched = matchedAll.slice().sort((a, b) => when(b.lastMessageDate || b.last_message_date) - when(a.lastMessageDate || a.last_message_date)).slice(0, resolvedWindow === "24h" ? 80 : 120);
    if (matchedAll.length > matched.length) flags.push("PARTIAL");
    const withMessages = await pool(matched, 6, async (conversation) => {
      const pulled = await crm(token, `${base}/conversations/${conversation.id}/messages?limit=100`);
      if (!pulled.ok) return { conversation, messages: [] as any[], failed: true };
      return {
        conversation,
        failed: false,
        messages: messageList(pulled.body).map((message: any) => {
          const ms = when(message.dateAdded || message.dateCreated);
          return {
            ms, raw: message,
            direction: String(message.direction || "").toLowerCase().includes("inbound") ? "inbound" : "outbound",
            type: kindOf(message),
            body: clean(message.body || message.message || ""),
            userId: String(message.userId || ""),
          };
        }).filter((row) => row.ms),
      };
    });
    const byContact = new Map<string, any[]>();
    let messagesAnalyzed = 0;
    for (const row of withMessages) {
      if (row.failed) { flags.push("PARTIAL"); continue; }
      messagesAnalyzed += row.messages.length;
      const id = row.conversation.contactId || row.conversation.contact_id;
      byContact.set(id, [...(byContact.get(id) || []), ...row.messages]);
    }
    const usersRes = await crm(token, `${base}/users/?locationId=${encodeURIComponent(locationId)}`);
    const users = new Map<string, string>();
    for (const user of usersRes.body?.users || []) {
      const name = clean([user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || user.email || "");
      if (user.id) users.set(user.id, name || "Unassigned");
    }
    const repName = (id: string) => users.get(String(id || "")) || "Unassigned";

    type Lead = {
      id: string; name: string; assigned: string; source: string; added: number; active: number;
      inbound: any[]; outbound: any[]; humanOut: any[]; firstIn: any; firstOut: any; responseMs: number | null;
      lastIn: any; windowOut: any[]; waiting: boolean; waitMs: number; grade: string; reaction: boolean;
      phrase: string; preview: string; untouched: boolean; contacted: boolean;
    };
    const leads: Lead[] = inScope.map((contact) => {
      const messages = (byContact.get(contact.id) || []).slice().sort((a, b) => a.ms - b.ms);
      const inbound = messages.filter((row) => row.direction === "inbound");
      const outbound = messages.filter((row) => row.direction === "outbound");
      const humanOut = outbound.filter((row) => row.type !== "Automation" && row.userId);
      const firstIn = inbound[0];
      const firstOut = outbound.find((row) => firstIn && row.ms > firstIn.ms);
      const responseMs = firstIn && firstOut ? firstOut.ms - firstIn.ms : null;
      const lastIn = inbound[inbound.length - 1];
      const windowOut = outbound.filter((row) => row.ms >= WINDOW_START);
      const phrase = lastIn ? lostPhrase(lastIn.body) : "";
      const reaction = !!(lastIn && isReaction(lastIn.raw, lastIn.body));
      const waiting = !phrase && !!(lastIn && lastIn.ms >= WINDOW_START && !outbound.some((row) => row.ms > lastIn.ms));
      const waitMs = waiting ? NOW - lastIn.ms : 0;
      const grade = waiting ? (reaction ? dropGrade(gradeFor(waitMs)) : gradeFor(waitMs)) : "";
      return {
        id: contact.id,
        name: clean(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"),
        assigned: repName(contact.assignedTo || ""),
        source: clean(contact.source || contact.attributionSource || "not available") || "not available",
        added: when(contact.dateAdded || contact.date_added),
        active: when(contact.lastActivity || contact.last_activity || contact.dateUpdated),
        inbound, outbound, humanOut, firstIn, firstOut, responseMs, lastIn, windowOut,
        waiting, waitMs, grade, reaction, phrase,
        preview: lastIn ? (reaction ? "[iMessage reaction]" : lastIn.body.slice(0, 140)) : "",
        untouched: outbound.length === 0,
        contacted: windowOut.length > 0,
      };
    });
    const lost = leads.filter((lead) => lead.phrase);
    const waiting = leads.filter((lead) => lead.waiting).sort((a, b) => b.waitMs - a.waitMs);
    const critical = waiting.filter((lead) => lead.grade === "Critical");
    const untouched = leads.filter((lead) => lead.untouched);
    const contacted = leads.filter((lead) => lead.contacted);
    const qualifying = leads.map((lead) => lead.responseMs).filter((ms): ms is number => ms != null && ms > 0);
    const medianLabel = qualifying.length >= 3 ? human(qualifying.slice().sort((a, b) => a - b)[Math.floor((qualifying.length - 1) / 2)]) : "not enough data";
    const flagged = leads.filter((lead) => lead.phrase || lead.grade === "Critical" || (lead.untouched && lead.added && NOW - lead.added >= 86400000));

    const wins = new Map<string, { lead: Lead; ms: number; line: string; at: number; rep: string }>();
    for (const lead of leads) {
      if (lead.responseMs && lead.responseMs > 0 && lead.responseMs < 300000 && lead.firstOut?.ms >= WINDOW_START) {
        wins.set(lead.id, { lead, ms: lead.responseMs, at: lead.firstOut.ms, rep: repName(lead.firstOut.userId), line: `Replied in ${human(lead.responseMs)}.` });
      }
      for (const call of lead.inbound.filter((row) => row.type === "Call" && row.ms >= WINDOW_START)) {
        const back = lead.humanOut.find((row) => row.type === "Call" && row.ms > call.ms && row.ms <= call.ms + 1800000);
        if (!back) continue;
        const delta = back.ms - call.ms;
        const current = wins.get(lead.id);
        if (!current || delta < current.ms) wins.set(lead.id, { lead, ms: delta, at: back.ms, rep: repName(back.userId), line: `Called back in ${human(delta)}.` });
      }
    }

    const channelCounts = { SMS: 0, Call: 0, Email: 0, Automation: 0 };
    let typed = 0;
    for (const conversation of loaded) {
      const raw = conversation.messageTypes || conversation.message_types || [];
      const codes = (Array.isArray(raw) ? raw : []).map((item: any) => Number(typeof item === "object" ? item?.type ?? item?.code : item)).filter((code: number) => Number.isFinite(code));
      if (!codes.length) continue;
      typed++;
      if (codes.includes(3)) channelCounts.SMS++;
      if (codes.includes(2) || codes.includes(1)) channelCounts.Call++;
      if (codes.includes(45)) channelCounts.Email++;
      if (codes.includes(100)) channelCounts.Automation++;
    }
    const pct = (count: number) => loaded.length ? Math.round((count / loaded.length) * 1000) / 10 : 0;

    const worst = [...critical.reduce((map, lead) => map.set(lead.assigned, (map.get(lead.assigned) || 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
    const topReps = worst.filter((row, _, all) => row[1] === all[0]?.[1]).map((row) => row[0]);
    const oldestUntouched = untouched.filter((lead) => lead.added).sort((a, b) => a.added - b.added)[0];
    const priorities = [
      ...lost.slice(0, 3).map((lead) => ({ name: lead.name, why: `${lead.name} said "${lead.phrase}" and should come off the active list.`, action: `${lead.assigned} archives ${lead.name}`, reaction: false })),
      ...critical.filter((lead) => !lost.some((row) => row.id === lead.id)).map((lead) => ({ name: lead.name, why: `${lead.name} has waited ${human(lead.waitMs)} for a reply.`, action: `${lead.assigned} replies to ${lead.name}`, reaction: lead.reaction })),
      ...(oldestUntouched ? [{ name: oldestUntouched.name, why: `${oldestUntouched.name} has had no outbound message.`, action: `${oldestUntouched.assigned} makes first contact`, reaction: false }] : []),
    ].slice(0, 3);
    const urgent = priorities[0];
    const summaryBits = [
      inScope.length ? `${flagged.length} leads are flagged and ${critical.length} of those are Critical.` : "No new leads fell inside the window.",
      `${lost.length} lost ${lost.length === 1 ? "lead was" : "leads were"} detected.`,
      topReps.length ? `${topReps.join(" and ")} ${topReps.length > 1 ? "are" : "is"} carrying the most Critical flags (${worst[0]?.[1] || 0}).` : "No rep is carrying a Critical flag.",
      urgent ? `${urgent.action}.` : "There is no urgent action in this window.",
    ];
    if (flags.includes("PARTIAL")) summaryBits.push("Coverage is incomplete because a page of data did not load.");

    const blocks: string[] = [];
    blocks.push(`<div style="background:#1a2340;padding:26px 28px 22px;border-radius:6px 6px 0 0;"><div style="font:700 11px Arial,sans-serif;color:#8fa3c8;letter-spacing:2px;text-transform:uppercase;">Veydra AI</div><h1 style="font:700 26px Arial,sans-serif;color:#ffffff;margin:8px 0 6px;line-height:1.25;">Veydra Sales Report — ${esc(spec.label)} — ${esc(company)}</h1><div style="font:400 14px Arial,sans-serif;color:#c7d3e8;">Sub-account: ${esc(company)}</div><div style="display:inline-block;margin-top:14px;padding:6px 14px;border-radius:20px;background:#2c3e50;font:600 12px Arial,sans-serif;color:#ffffff;">${esc(parts(WINDOW_START, timeZone).label)} → ${esc(today.label)}</div></div>`);
    const metaRows: string[][] = [
      ["Sub-account", company], ["Window", spec.label], ["Generated at", today.label],
      ["Contacts in scope", String(inScope.length)], ["Conversations loaded", String(loaded.length)],
      ["Matched conversations", String(matchedAll.length)], ["Messages analyzed", String(messagesAnalyzed)],
      ["Recipients", String(recipients.length)],
    ].map(([label, value]) => [esc(label), esc(value)]);
    if (flags.includes("PARTIAL")) metaRows.push([esc("Data completeness"), esc("PARTIAL (pagination cap reached; counts may understate)")]);
    blocks.push(heading("2. Report Metadata") + table(["Item", "Value"], metaRows));
    blocks.push(heading("3. Executive Summary") + `<p style="font:400 14px Arial,sans-serif;color:#1a2340;line-height:1.5;margin:0;">${esc(summaryBits.slice(0, resolvedWindow === "24h" ? 4 : resolvedWindow === "7d" ? 4 : 5).join(" "))}</p>`);

    const tiles = resolvedWindow === "24h"
      ? [
          tile(String(inScope.length), "New Leads", "#1a2340"),
          tile(String(contacted.length), "Contacted Today", "#2c3e50"),
          tile(String(untouched.length), "Not Yet Touched", untouched.length ? "#e74c3c" : "#27ae60"),
          tile(String(waiting.length), "Waiting for Reply", "#e67e22"),
          tile(String(lost.length), "Lost Leads", "#c0392b"),
        ]
      : [
          tile(String(inScope.length), "Total Leads in Window", "#1a2340"),
          tile(String(flagged.length), "Flagged", flagged.length ? "#e74c3c" : "#27ae60"),
          tile(String(critical.length), "Critical", "#c0392b"),
          tile(String(lost.length), "Lost Leads", "#c0392b"),
          tile(medianLabel, "Median First Response", "#2c3e50", medianLabel === "not enough data" ? "15px" : "20px"),
        ];
    blocks.push(heading("4. KPI Stat Tiles") + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:14px 0 6px;"><tr>${tiles.join("")}</tr></table>`);

    if (resolvedWindow === "24h") {
      const contactedRows = contacted.map((lead) => [esc(lead.name), esc(lead.assigned), esc(lead.windowOut[0]?.type || "—"), lead.responseMs && lead.responseMs > 0 ? esc(human(lead.responseMs)) : "—"]);
      const quietRows = untouched.map((lead) => [esc(lead.name), lead.added ? (Math.round(((NOW - lead.added) / 3600000) * 10) / 10).toFixed(1) : "not available", esc(lead.source)]);
      blocks.push(heading("5. New Leads — Contact Status")
        + `<div style="font:700 14px Arial,sans-serif;color:#1e8449;margin:8px 0;">Contacted</div>`
        + (contactedRows.length ? table(["Contact", "Assigned Rep", "Channel Used", "Response Time"], contactedRows, "#27ae60") : `<p style="margin:0 0 12px;">No contacts in this grade.</p>`)
        + `<div style="font:700 14px Arial,sans-serif;color:#c0392b;margin:16px 0 8px;">Not Yet Touched</div>`
        + (quietRows.length ? table(["Contact", "Hours Since Added", "Source"], quietRows, "#e74c3c") : `<p style="margin:0;">No contacts in this grade.</p>`));
    } else {
      const rows = leads.slice().sort((a, b) => b.added - a.added).map((lead) => [
        esc(lead.name), lead.added ? esc(parts(lead.added, timeZone).short) : "not available", esc(lead.assigned),
        esc(lead.firstOut ? `${lead.firstOut.type} ${parts(lead.firstOut.ms, timeZone).label}` : "Not yet contacted"),
        lead.responseMs && lead.responseMs > 0 ? esc(human(lead.responseMs)) : "Not yet contacted",
      ]);
      blocks.push(heading("5. New Leads — Contact Status") + (rows.length ? table(["Contact", "Added", "Assigned Rep", "First Touch", "Response Time"], rows) : `<p style="margin:0;">No contacts in this grade.</p>`));
    }

    if (lost.length) {
      const rows = lost.map((lead) => `<tr><td style="padding:10px;border-bottom:1px solid #f5c6c0;">${esc(lead.name)}</td><td style="padding:10px;border-bottom:1px solid #f5c6c0;">"${esc(lead.phrase)}"</td><td style="padding:10px;border-bottom:1px solid #f5c6c0;">${esc(lead.assigned)}</td><td style="padding:10px;border-bottom:1px solid #f5c6c0;">${esc(lead.preview)}${lead.lastIn && lead.lastIn.body.length > 140 ? "…" : ""}</td></tr>`).join("");
      blocks.push(`<div style="border:1px solid #e74c3c;border-left:6px solid #e74c3c;background:#fdecea;border-radius:6px;padding:18px 20px;margin:18px 0;"><div style="font:700 15px Arial,sans-serif;color:#c0392b;margin-bottom:12px;">Lost Leads — ${lost.length} ${lost.length === 1 ? "contact" : "contacts"}</div><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;font:400 13px Arial,sans-serif;color:#1a2340;"><tr style="background:#f5c6c0;"><th align="left" style="padding:8px 10px;font:700 12px Arial,sans-serif;color:#7b241c;border-bottom:1px solid #e74c3c;">Contact</th><th align="left" style="padding:8px 10px;font:700 12px Arial,sans-serif;color:#7b241c;border-bottom:1px solid #e74c3c;">Matched Phrase</th><th align="left" style="padding:8px 10px;font:700 12px Arial,sans-serif;color:#7b241c;border-bottom:1px solid #e74c3c;">Assigned Rep</th><th align="left" style="padding:8px 10px;font:700 12px Arial,sans-serif;color:#7b241c;border-bottom:1px solid #e74c3c;">Last Inbound</th></tr>${rows}</table></div>`);
    }

    const waitRows = waiting.map((lead) => [esc(lead.name) + (lead.reaction ? " [iMessage reaction]" : ""), esc(lead.assigned), esc(lead.preview || "not available"), esc(human(lead.waitMs)), badge(lead.grade)]);
    blocks.push(heading("7. Waiting for Reply") + (waitRows.length ? table(["Contact", "Assigned Rep", "Last Message", "Wait Time", "Urgency"], waitRows) : `<p style="margin:0;">No contacts in this grade.</p>`));

    if (resolvedWindow !== "24h") {
      const coldStart = NOW - spec.days * 86400000;
      const coldEnd = NOW - (spec.days - 5) * 86400000;
      const cold = leads.filter((lead) => lead.humanOut.length && lead.active >= coldStart && lead.active <= coldEnd)
        .map((lead) => ({ lead, silent: Math.floor((NOW - lead.active) / 86400000) }))
        .sort((a, b) => b.silent - a.silent);
      const rows = cold.map((row) => [esc(row.lead.name), esc(parts(row.lead.active, timeZone).label), String(row.silent), esc(row.lead.assigned)]);
      blocks.push(heading("8. Going Cold") + (rows.length ? table(["Contact", "Last Activity", "Days Silent", "Assigned Rep"], rows) : `<p style="margin:0;">No contacts in this grade.</p>`));
    }

    const winCards = [...wins.values()].map((win) => `<div style="border-left:6px solid #27ae60;background:#eafaf1;border-radius:6px;padding:16px 18px;margin:12px 0;"><div style="font:700 14px Arial,sans-serif;color:#1e8449;margin-bottom:6px;">${esc(win.rep)} → ${esc(win.lead.name)}</div><div style="font:400 13px Arial,sans-serif;color:#1a2340;line-height:1.5;">${esc(win.line)}</div><div style="font:400 11px Arial,sans-serif;color:#7f8c8d;margin-top:8px;">${esc(parts(win.at, timeZone).label)}</div></div>`).join("");
    blocks.push(heading("9. Wins") + (winCards || `<p style="margin:0;">No wins recorded in this window.</p>`));

    if (resolvedWindow !== "24h") {
      const dominant = (Object.entries(channelCounts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
      const colors: Record<string, string> = { SMS: "#2ecc71", Call: "#3498db", Email: "#9b59b6", Automation: "#95a5a6" };
      const bars = loaded.length && typed
        ? (Object.keys(channelCounts) as (keyof typeof channelCounts)[]).map((name) => `<div style="margin:10px 0 14px;"><div style="font:600 13px Arial,sans-serif;color:#1a2340;margin-bottom:5px;">${name} — ${pct(channelCounts[name])}% (${channelCounts[name]} of ${loaded.length} conversations)</div><div style="background:#e8ecf3;border-radius:4px;height:18px;width:100%;"><div style="background:${colors[name]};height:18px;width:${Math.min(100, pct(channelCounts[name]))}%;border-radius:4px;"></div></div></div>`).join("")
          + `<p style="font:400 12px Arial,sans-serif;color:#555;margin:0 0 8px;">Percentages can total more than 100% because one conversation can contain several message types. Each percentage uses the same denominator, the conversations loaded in this window.</p>`
          + `<p style="font:400 14px Arial,sans-serif;color:#1a2340;line-height:1.5;">${esc(`${dominant[0]} is the largest share at ${pct(dominant[1])}% (${dominant[1]} of ${loaded.length}). Automation appears in ${pct(channelCounts.Automation)}% of loaded conversations.`)}</p>`
        : `<p style="margin:0;">${loaded.length ? "Channel data unavailable — messageTypes field not present in API response." : "No messages in window"}</p>`;
      blocks.push(heading("10. Channel Ratio") + bars);

      const reps = new Map<string, { name: string; flagged: number; critical: number; wins: number; lost: number; oldest: number; samples: number[] }>();
      const touch = (name: string) => reps.get(name) || reps.set(name, { name, flagged: 0, critical: 0, wins: 0, lost: 0, oldest: 0, samples: [] }).get(name)!;
      for (const lead of leads) {
        const bucket = touch(lead.assigned);
        if (lead.responseMs && lead.responseMs > 0) bucket.samples.push(lead.responseMs);
        if (flagged.some((row) => row.id === lead.id)) bucket.flagged++;
        if (lead.grade === "Critical") {
          bucket.critical++;
          bucket.oldest = Math.max(bucket.oldest, lead.waitMs);
        }
        if (lead.phrase) bucket.lost++;
      }
      for (const win of wins.values()) touch(win.lead.assigned).wins++;
      const rows = [...reps.values()].sort((a, b) => b.critical - a.critical || b.flagged - a.flagged).map((row) => {
        const samples = row.samples.slice().sort((a, b) => a - b);
        const mid = samples.length >= 3 ? human(samples[Math.floor((samples.length - 1) / 2)]) : "not enough data";
        return [esc(row.name), String(row.flagged), String(row.critical), String(row.wins), String(row.lost), row.oldest ? (row.oldest / 3600000).toFixed(1) : "0.0", esc(mid)];
      });
      blocks.push(heading("11. Rep Rollup") + (rows.length ? table(["Rep", "Flagged", "Critical", "Wins", "Lost Leads", "Oldest Flag (hrs)", "Median First Response"], rows) : `<p style="margin:0;">No contacts in this grade.</p>`));
    }

    if (monday) {
      const weekend = leads.filter((lead) => {
        if (!lead.added) return false;
        const day = parts(lead.added, timeZone).weekday;
        if (day !== "Sat" && day !== "Sun") return false;
        if (NOW - lead.added > 4 * 86400000) return false;
        return !lead.outbound.some((row) => row.ms >= lead.added && row.ms - lead.added <= 21600000);
      });
      const rows = weekend.map((lead) => {
        const reply = lead.outbound.find((row) => row.ms > lead.added);
        return [esc(lead.name), esc(parts(lead.added, timeZone).label), reply ? esc(human(reply.ms - lead.added)) : "none", esc(lead.assigned)];
      });
      blocks.push(heading("12. Weekend Catch-Up") + (rows.length ? table(["Contact", "Arrived", "Hours to First Reply", "Assigned Rep"], rows) : `<p style="margin:0;">No contacts in this grade.</p>`));
    }

    blocks.push(heading("13. Top 3 Daily Priorities") + (priorities.length ? priorities.map((row, index) => `<div style="margin:0 0 12px;"><p style="margin:0;font:700 14px Arial,sans-serif;color:#1a2340;">${index + 1}. ${esc(row.name)}</p><p style="margin:4px 0;font:400 13px Arial,sans-serif;color:#1a2340;">${esc(row.why)}</p><p style="margin:4px 0;font:400 13px Arial,sans-serif;color:#1a2340;">${esc(row.action)}.${row.reaction ? " [iMessage reaction]" : ""}</p></div>`).join("") : `<p style="margin:0;">No contacts in this grade.</p>`));

    if (resolvedWindow === "30d") {
      const winLeader = [...wins.values()].reduce((map, win) => map.set(win.lead.assigned, (map.get(win.lead.assigned) || 0) + 1), new Map<string, number>());
      const best = [...winLeader.entries()].sort((a, b) => b[1] - a[1])[0];
      const dominant = (Object.entries(channelCounts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
      const trend = `${inScope.length} leads fell in this 30-day window. Median first response is ${medianLabel}. ${lost.length} lost leads is ${inScope.length ? Math.round((lost.length / inScope.length) * 1000) / 10 : 0}% of the leads in scope. ${best ? `${best[0]} has the most wins (${best[1]}).` : "No wins were recorded."} ${dominant && loaded.length ? `${dominant[0]} is the largest channel share at ${pct(dominant[1])}%.` : "Channel mix was not available."} Prior-period data is not in this run, so there is no comparison to the previous 30 days.`;
      blocks.push(heading("14. Trend Summary") + `<p style="font:400 14px Arial,sans-serif;color:#1a2340;line-height:1.5;margin:0;">${esc(trend)}</p>`);
      const rows = leads.map((lead) => [
        esc(lead.id), esc(lead.lastIn?.type || lead.firstOut?.type || "—"), String(lead.inbound.length), String(lead.outbound.length),
        lead.firstIn ? esc(parts(lead.firstIn.ms, timeZone).label) : "none",
        lead.outbound[0] ? esc(parts(lead.outbound[0].ms, timeZone).label) : "none",
        lead.responseMs && lead.responseMs > 0 ? esc(human(lead.responseMs)) : "excluded — outbound not after inbound",
        esc(lead.phrase ? "lost" : lead.waiting ? "waiting" : lead.untouched ? "not yet contacted" : "contacted"),
        lead.grade ? badge(lead.grade) : "—",
      ]);
      blocks.push(heading("15. Appendix") + (rows.length ? table(["contactId", "channel", "messages in", "messages out", "first inbound", "first outbound", "first response time", "classification", "grade"], rows) : `<p style="margin:0;">No contacts in this grade.</p>`));
    }

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(spec.noun)}</title></head><body style="margin:0;padding:0;background:#f4f6f8;"><div style="max-width:620px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;">${blocks.join("")}<div style="background:#1a2340;padding:18px 28px;border-radius:0 0 6px 6px;text-align:center;font:400 12px Arial,sans-serif;color:#c7d3e8;">Powered by Veydra AI</div></div></body></html>`;
    if (!html.includes("Powered by Veydra AI") || !html.includes("</html>")) {
      await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "ABORT: malformed HTML" }).eq("id", runId);
      return json({ error: "ABORT: malformed HTML", status: "failed" }, 500);
    }

    const action = (urgent?.action || "none").slice(0, 40);
    const sms = resolvedWindow === "24h"
      ? `${company} Pulse ${today.short} | ${inScope.length} leads, ${untouched.length} untouched, ${waiting.length} waiting | Top: ${urgent?.name || "none"} — ${action}`
      : resolvedWindow === "7d"
        ? `${company} Weekly ${today.short} | ${inScope.length} leads, ${flagged.length} flagged, ${critical.length} critical, ${lost.length} lost | Top: ${urgent?.name || "none"} — ${action}`
        : `${company} Monthly ${today.short} | ${inScope.length} leads, ${flagged.length} flagged, ${lost.length} lost | Median response: ${medianLabel} | Full report sent`;
    const subject = `${spec.noun} — ${company} — ${today.short}`;
    const emailed: string[] = [];
    const texted: string[] = [];
    const problems: string[] = [];
    for (const recipient of recipients) {
      if (recipient.email) {
        const mail = await crm(token, `${base}/conversations/messages`, {
          method: "POST",
          body: JSON.stringify({ type: "Email", locationId, contactId: recipient.contactId, emailFrom: fromEmail, subject, html, message: sms }),
        });
        await db.from("send_log").insert({ run_id: runId, channel: "email", message_id: mail.body?.messageId || mail.body?.id || null, status: mail.ok ? "accepted" : "failed", error: mail.ok ? null : `HTTP ${mail.status}` });
        if (mail.ok) emailed.push(recipient.email);
        else problems.push("email failed");
      }
      if (recipient.phone) {
        const text = await crm(token, `${base}/conversations/messages`, {
          method: "POST",
          body: JSON.stringify({ type: "SMS", locationId, contactId: recipient.contactId, message: sms.slice(0, 320) }),
        });
        await db.from("send_log").insert({ run_id: runId, channel: "sms", message_id: text.body?.messageId || text.body?.id || null, status: text.ok ? "accepted" : "failed", error: text.ok ? null : `HTTP ${text.status}` });
        if (text.ok) texted.push("sent");
        else problems.push("text failed");
      }
    }
    const status = emailed.length || texted.length ? (problems.length || flags.includes("PARTIAL") ? "partial" : "sent") : "failed";
    await db.from("report_runs").update({ status, finished_at: new Date().toISOString(), summary: sms.slice(0, 500), error: problems.join("; ") || null }).eq("id", runId);
    return json({ success: status !== "failed", status, window: resolvedWindow, subject, emailed, texted, problems, flags: [...new Set(flags)], summary: sms, company });
  } catch (error: any) {
    const reason = String(error?.message || "unknown").slice(0, 180);
    if (runId) await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: `ABORT: ${reason} ${resolvedWindow} ${resolvedLocation}`.slice(0, 240) }).eq("id", runId);
    return json({ error: `The report failed before it sent. ${reason}`, status: "failed" }, 500);
  }
});
