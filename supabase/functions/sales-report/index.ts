// Daily Sales Conversation Quality Report.
// One run per Ovanta location. Reads that location, grades the new-lead
// cohort, emails the 13-section report, and texts the short summary.
// The 8:00 AM clock and a manual assistant command use this same path.
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
const CAP = 100;

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    return "&" + "quot;";
  });
}

const badgeCss: Record<string, string> = {
  Critical: "background:#FDECEA;color:#B00020;border:1px solid #F5C2C0;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;white-space:nowrap;",
  High: "background:#FFF4E5;color:#B25E00;border:1px solid #F0D6B0;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;white-space:nowrap;",
  Medium: "background:#FFFBE6;color:#8A6D00;border:1px solid #EFE3A8;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;white-space:nowrap;",
  Low: "background:#E8F5E9;color:#1B5E20;border:1px solid #BFE3C2;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;white-space:nowrap;",
};
const score: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const OPT_OUT = /\b(stop all|stop|unsubscribe|cancel|quit|remove me|do not contact|wrong number|not interested)\b/i;

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, Version: VERSION, "Content-Type": "application/json", Accept: "application/json" };
}

async function crm(token: string, url: string, init?: RequestInit, attempt = 0): Promise<{ ok: boolean; status: number; body: any; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { ...init, headers: { ...headers(token), ...(init?.headers || {}) }, signal: controller.signal });
    const text = await res.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 300) }; }
    const method = String(init?.method || "GET").toUpperCase();
    if (res.status === 429 && attempt < 1) {
      const wait = Math.min(15000, Number(res.headers.get("Retry-After") || 2) * 1000);
      await new Promise((resolve) => setTimeout(resolve, wait));
      return crm(token, url, init, attempt + 1);
    }
    if (method === "GET" && res.status >= 500 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      return crm(token, url, init, attempt + 1);
    }
    return { ok: res.ok, status: res.status, body, text: text.slice(0, 300) };
  } catch (error: any) {
    if (attempt < 2 && String(init?.method || "GET").toUpperCase() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return crm(token, url, init, attempt + 1);
    }
    return { ok: false, status: 0, body: {}, text: error?.message || "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T, R>(items: T[], width: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await run(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

function tagsOf(contact: any): string[] {
  const tags = contact?.tags;
  const list = Array.isArray(tags) ? tags : String(tags || "").split(",");
  return list.map((tag: unknown) => String(tag || "").trim().toLowerCase()).filter(Boolean);
}

function zoned(ms: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]),
  );
  return {
    weekday: parts.weekday || "",
    hour: Number(parts.hour || 0),
    label: `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute}`,
    day: `${parts.year}-${parts.month}-${parts.day}`,
    short: `${parts.month}/${parts.day}`,
  };
}

function messagePage(body: any) {
  if (Array.isArray(body?.messages?.messages)) {
    return { messages: body.messages.messages, nextPage: !!body.messages.nextPage, lastMessageId: body.messages.lastMessageId || "" };
  }
  if (Array.isArray(body?.messages)) return { messages: body.messages, nextPage: false, lastMessageId: "" };
  return { messages: [], nextPage: false, lastMessageId: "" };
}

function kindOf(message: any) {
  const raw = String(message.messageType || message.type || "").toLowerCase();
  if (raw.includes("sms") || raw === "3" || raw === "type_sms") return "SMS";
  if (raw.includes("email") || raw === "45") return "Email";
  if (raw.includes("call") || raw.includes("voicemail") || raw === "1" || raw === "2" || raw === "type_call") return "Call";
  return "Activity";
}

function normalize(message: any) {
  const ms = new Date(message.dateAdded || message.dateCreated || message.createdAt || 0).getTime();
  const direction = String(message.direction || "").toLowerCase().includes("inbound") ? "inbound" : "outbound";
  return {
    ms: Number.isFinite(ms) ? ms : 0,
    direction,
    messageType: kindOf(message),
    body: String(message.body || message.message || "").replace(/\s+/g, " ").trim(),
    userId: String(message.userId || ""),
    callStatus: String(message.meta?.call?.status || message.callStatus || "").toLowerCase(),
  };
}

function waitGrade(ms: number) {
  if (ms >= 28800000) return "Critical";
  if (ms >= 14400000) return "High";
  if (ms >= 7200000) return "Medium";
  return "Low";
}

function badge(grade: string) {
  return `<span style="${badgeCss[grade] || badgeCss.Low}">${esc(grade)}</span>`;
}

function table(headers: string[], rows: string[][], empty: string) {
  const head = `<tr>${headers.map((header) => `<th align="left" style="padding:8px;border-bottom:1px solid #E3E6EB;font-size:12px;color:#5C6570;">${esc(header)}</th>`).join("")}</tr>`;
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td style="padding:8px;border-bottom:1px solid #F0F2F5;font-size:13px;vertical-align:top;">${cell}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}" style="padding:8px;font-size:13px;color:#5C6570;">${esc(empty)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${head}${body}</table>`;
}

function section(title: string, inner: string) {
  return `<tr><td style="padding:8px 24px 4px;font-size:16px;font-weight:700;">${esc(title)}</td></tr><tr><td style="padding:0 24px 16px;">${inner}</td></tr>`;
}

function unavailable(label: string) {
  return `<p style="margin:0;font-size:13px;color:#B00020;">Data unavailable for this section — ${esc(label)}</p>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase env" }, 500);
  const db = createClient(supabaseUrl, serviceKey);
  let runId = "";
  let locationId = "";
  try {
    const body = await req.json().catch(() => ({}));
    const territoryId = String(body.territoryId || "").trim();
    if (!territoryId) return json({ error: "Pick an area first." }, 400);
    const tokenHeader = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const fromClock = body.source === "scheduler" && tokenHeader.length > 0 && tokenHeader === serviceKey;
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
      const role = String(manager?.role || "");
      const extras = Array.isArray(manager?.territory_ids) ? manager.territory_ids : [];
      const allowed = role === "super_admin" || manager?.territory_id === territoryId || extras.includes(territoryId);
      if (!["owner", "super_admin"].includes(role) || !allowed) return json({ error: "Only an owner can send this report." }, 403);
    }

    const { data: settings } = await db
      .from("portal_settings")
      .select("company_name, timezone, hl_api_key, hl_location_id")
      .eq("territory_id", territoryId)
      .limit(1)
      .maybeSingle();
    const token = String(settings?.hl_api_key || "").trim();
    locationId = String(settings?.hl_location_id || "").trim();
    if (!token || !locationId) return json({ error: "This area has no Ovanta key or location." }, 422);

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
      `CREATE UNIQUE INDEX IF NOT EXISTS report_runs_location_day ON public.report_runs (location_id, run_date)`,
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
      `CREATE TABLE IF NOT EXISTS public.conversation_cache (
        location_id text not null,
        contact_id text not null,
        run_date date not null,
        payload jsonb,
        primary key (location_id, contact_id, run_date)
      )`,
    ] });

    const location = await crm(token, `${CRM}/locations/${locationId}`);
    if (location.status === 401) return json({ error: "Ovanta refused the key for this area." }, 401);
    const timeZone = location.body?.location?.timezone || location.body?.timezone || settings?.timezone || "America/New_York";
    const business = String(location.body?.location?.name || location.body?.name || settings?.company_name || "This studio").trim();
    const now = Date.now();
    const today = zoned(now, timeZone);
    const runDate = today.day;

    const { data: existing } = await db.from("report_runs").select("id, status, started_at").eq("location_id", locationId).eq("run_date", runDate).maybeSingle();
    const queuedFresh = existing?.status === "queued" && existing.started_at && Date.now() - new Date(existing.started_at).getTime() < 15 * 60 * 1000;
    if (existing && (existing.status === "sent" || existing.status === "partial" || queuedFresh)) {
      return json({ success: true, already: true, status: existing.status, company: business });
    }
    if (existing?.id) {
      runId = existing.id;
      await db.from("report_runs").update({ status: "queued", error: null, started_at: new Date().toISOString() }).eq("id", runId);
    } else {
      const { data: created, error: createError } = await db
        .from("report_runs")
        .insert({ location_id: locationId, territory_id: territoryId, run_date: runDate, status: "queued" })
        .select("id")
        .single();
      if (createError || !created) return json({ error: "Could not lock today's report. It may already be running." }, 409);
      runId = created.id;
    }

    const userRes = await crm(token, `${CRM}/users/?locationId=${locationId}`);
    const users = new Map<string, string>();
    for (const user of userRes.body?.users || []) {
      const name = user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unassigned";
      if (user.id) users.set(user.id, name);
    }
    const usersFailed = !userRes.ok;

    const contacts: any[] = [];
    let contactsFailed = false;
    let truncated = false;
    for (let page = 1; page <= 3 && contacts.length < CAP; page++) {
      const found = await crm(token, `${CRM}/contacts/search`, {
        method: "POST",
        body: JSON.stringify({
          locationId,
          pageLimit: 100,
          page,
          filters: [{ field: "tags", operator: "contains", value: "new lead" }],
          sort: [{ field: "dateAdded", direction: "desc" }],
        }),
      });
      if (!found.ok) {
        contactsFailed = true;
        break;
      }
      const batch = found.body?.contacts || [];
      for (const contact of batch) {
        const names = tagsOf(contact);
        if (!names.some((tag) => tag.includes("new lead"))) continue;
        if (names.some((tag) => tag === "booked" || tag === "hired" || tag === "dnc" || tag.includes("unsubscribed") || tag === "wrong number")) continue;
        contacts.push(contact);
        if (contacts.length >= CAP) {
          truncated = (found.body?.total || batch.length) > CAP;
          break;
        }
      }
      if (batch.length < 100) break;
      if ((found.body?.total || 0) > CAP) truncated = true;
    }
    if (contactsFailed && contacts.length === 0) {
      await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "Contact pull failed" }).eq("id", runId);
      return json({ error: "Data unavailable for this section — pull failed", status: "failed" }, 502);
    }

    let conversationFailures = 0;
    const threads = await pool(contacts, 8, async (contact) => {
      const found = await crm(token, `${CRM}/conversations/search?locationId=${locationId}&contactId=${contact.id}&limit=1`);
      if (!found.ok) {
        conversationFailures++;
        return { contact, failed: true, conversationId: "", messages: [] as any[] };
      }
      const conversationId = found.body?.conversations?.[0]?.id || "";
      if (!conversationId) return { contact, failed: false, conversationId: "", messages: [] as any[] };
      const first = await crm(token, `${CRM}/conversations/${conversationId}/messages?limit=100`);
      if (!first.ok) {
        conversationFailures++;
        return { contact, failed: true, conversationId, messages: [] as any[] };
      }
      const page = messagePage(first.body);
      return { contact, failed: false, conversationId, messages: page.messages.map(normalize).filter((row) => row.ms) };
    });
    if (contacts.length && conversationFailures / contacts.length > 0.2) {
      await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "More than 20 percent of conversation pulls failed" }).eq("id", runId);
      return json({ error: "The conversation pull failed for too many leads, so the report was not sent.", status: "failed" }, 502);
    }

    type Flag = { category: string; grade: string; contactId: string; name: string; phone: string; assigned: string; when: string; age: string; detail: string; elapsed: number; action: string };
    const flags: Flag[] = [];
    const seen = new Map<string, Flag>();
    const keep = (flag: Flag) => {
      const key = `${flag.category}:${flag.contactId}`;
      const prior = seen.get(key);
      if (!prior || score[flag.grade] > score[prior.grade] || (flag.grade === prior.grade && flag.elapsed > prior.elapsed)) seen.set(key, flag);
    };
    for (const thread of threads) {
      if (thread.failed) continue;
      const contact = thread.contact;
      const name = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "Unknown";
      const phone = contact.phone || "";
      const assigned = users.get(contact.assignedTo) || "Unassigned";
      const added = new Date(contact.dateAdded || 0).getTime();
      const messages = [...thread.messages].sort((a, b) => a.ms - b.ms);
      const inbound = messages.filter((row) => row.direction === "inbound");
      const outbound = messages.filter((row) => row.direction === "outbound");
      const last = messages[messages.length - 1];
      if (!thread.conversationId && added && now - added >= 300000) {
        const elapsed = now - added;
        keep({ category: "Ghost", grade: elapsed >= 86400000 ? "Critical" : "High", contactId: contact.id, name, phone, assigned, when: zoned(added, timeZone).label, age: elapsed >= 86400000 ? "24h+" : "5m+", detail: "No conversation", elapsed, action: "Call them. Nobody has spoken to this lead." });
      }
      if (inbound.length && outbound.length === 0 && now - inbound[0].ms >= 300000) {
        const elapsed = now - inbound[0].ms;
        keep({ category: "Ghost", grade: elapsed >= 86400000 ? "Critical" : "High", contactId: contact.id, name, phone, assigned, when: zoned(inbound[0].ms, timeZone).label, age: elapsed >= 86400000 ? "24h+" : "5m+", detail: "Inbound with no reply", elapsed, action: "Call them. Their message has no human reply." });
      }
      if (last?.direction === "inbound" && now - last.ms >= 1800000) {
        const elapsed = now - last.ms;
        const grade = waitGrade(elapsed);
        const label = grade === "Critical" ? "Waiting 8h+" : grade === "High" ? "Waiting 4h+" : grade === "Medium" ? "Waiting 2h+" : "Waiting 30m+";
        keep({ category: "Waiting", grade, contactId: contact.id, name, phone, assigned, when: zoned(last.ms, timeZone).label, age: label, detail: last.body.slice(0, 120), elapsed, action: "Reply to their last message." });
      }
      for (const call of inbound.filter((row) => row.messageType === "Call" && ["no-answer", "no_answer", "busy", "failed", "canceled", "cancelled", "voicemail"].includes(row.callStatus))) {
        const followed = messages.some((row) => row.ms > call.ms && row.ms - call.ms <= 3600000 && row.direction === "outbound");
        if (followed) continue;
        const elapsed = now - call.ms;
        keep({ category: "Missed", grade: elapsed >= 86400000 ? "Critical" : "High", contactId: contact.id, name, phone, assigned, when: zoned(call.ms, timeZone).label, age: `${Math.round(elapsed / 60000)} min`, detail: call.callStatus || "missed", elapsed, action: "Call them back." });
      }
      if (last && now - last.ms >= 259200000 && now - last.ms <= 1209600000) {
        const elapsed = now - last.ms;
        keep({ category: "Cold", grade: "Medium", contactId: contact.id, name, phone, assigned, when: zoned(last.ms, timeZone).label, age: `${Math.round(elapsed / 86400000)} days`, detail: "No activity", elapsed, action: "Send a check-in." });
      }
      for (const row of inbound) {
        if (now - row.ms > 1209600000) continue;
        const match = row.body.match(OPT_OUT);
        if (!match) continue;
        keep({ category: "Opt-out", grade: "Critical", contactId: contact.id, name, phone, assigned, when: zoned(row.ms, timeZone).label, age: match[1].toLowerCase(), detail: "Remove from every sequence", elapsed: now - row.ms, action: "Remove them from every sequence." });
      }
      if (outbound.length === 1 && inbound.filter((row) => row.ms > outbound[0].ms).length === 0 && added && outbound[0].ms - added <= 86400000 && now - outbound[0].ms >= 172800000) {
        const elapsed = now - outbound[0].ms;
        keep({ category: "Single-touch", grade: "Medium", contactId: contact.id, name, phone, assigned, when: zoned(outbound[0].ms, timeZone).label, age: `${Math.round(elapsed / 3600000)}h`, detail: "One outbound, no reply", elapsed, action: "Make a second human contact." });
      }
      for (const row of inbound) {
        const when = zoned(row.ms, timeZone);
        const weekend = (when.weekday === "Fri" && when.hour >= 17) || when.weekday === "Sat" || when.weekday === "Sun" || (when.weekday === "Mon" && when.hour < 9);
        if (!weekend) continue;
        const replied = messages.some((item) => item.direction === "outbound" && item.ms > row.ms && item.ms - row.ms <= 3600000);
        keep({ category: "Weekend", grade: replied ? "Low" : "High", contactId: contact.id, name, phone, assigned, when: when.label, age: replied ? "Replied" : "Still unanswered", detail: replied ? "Replied" : "Still unanswered", elapsed: now - row.ms, action: replied ? "No action. It was answered." : "Reply to the weekend message." });
      }
      try {
        await db.from("conversation_cache").upsert({
          location_id: locationId,
          contact_id: contact.id,
          run_date: runDate,
          payload: { inbound: inbound.length, outbound: outbound.length },
        }, { onConflict: "location_id,contact_id,run_date" });
      } catch { /* the report still sends if the cache table is missing */ }
    }
    for (const flag of seen.values()) flags.push(flag);
    const of = (category: string) => flags.filter((flag) => flag.category === category).sort((a, b) => score[b.grade] - score[a.grade] || b.elapsed - a.elapsed);
    const ghost = of("Ghost");
    const waiting = of("Waiting");
    const missed = of("Missed");
    const cold = of("Cold");
    const opted = of("Opt-out");
    const single = of("Single-touch");
    const weekend = of("Weekend");
    const cell = (rows: Flag[], failed: boolean) => failed ? "Data unavailable" : String(rows.length);
    const highest = (rows: Flag[]) => rows[0]?.grade || "None";

    const byUser = new Map<string, { name: string; total: number; Critical: number; High: number; Medium: number; Low: number; oldest: number }>();
    for (const flag of flags) {
      const row = byUser.get(flag.assigned) || { name: flag.assigned, total: 0, Critical: 0, High: 0, Medium: 0, Low: 0, oldest: 0 };
      row.total++;
      (row as any)[flag.grade]++;
      row.oldest = Math.max(row.oldest, flag.elapsed);
      byUser.set(flag.assigned, row);
    }
    const reps = [...byUser.values()].sort((a, b) => b.Critical - a.Critical || b.total - a.total);
    const actions = [...flags].filter((flag) => flag.action && !flag.action.startsWith("No action")).sort((a, b) => score[b.grade] - score[a.grade] || b.elapsed - a.elapsed).slice(0, 10);

    const windowEnd = today.label;
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Daily Sales Conversation Quality Report — ${esc(runDate)}</title></head><body style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2430;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:24px 12px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E3E6EB;border-radius:8px;overflow:hidden;">
<tr><td style="background:#1F2430;color:#FFFFFF;padding:24px;"><p style="margin:0;font-size:13px;letter-spacing:.04em;">${esc(business)}</p><h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Daily Sales Conversation Quality Report</h1><p style="margin:8px 0 0;font-size:13px;">${esc(runDate)} · through ${esc(windowEnd)} · ${contacts.length} contacts evaluated${usersFailed ? " · user list unavailable" : ""}</p></td></tr>
${section("Executive summary", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${[["Ghost", ghost], ["Waiting", waiting], ["Missed calls", missed], ["Going cold", cold], ["Opt-outs", opted], ["Single-touch", single], ["Weekend", weekend]].map(([label, rows]) => `<td style="padding:8px;border:1px solid #E3E6EB;font-size:13px;"><b>${esc(label)}</b><br>${esc(cell(rows as Flag[], false))}<br>${esc(highest(rows as Flag[]))}</td>`).join("")}
</tr></table>`)}
${section("Urgency", `<p style="margin:0 0 8px;font-size:13px;">${badge("Critical")} 8h or more &nbsp; ${badge("High")} 4h or more &nbsp; ${badge("Medium")} 2h or more &nbsp; ${badge("Low")} 30m or more</p>`)}
${section("Ghost leads", table(["Contact", "Phone", "First inbound", "Age", "Assigned"], ghost.map((row) => [esc(row.name), esc(row.phone), esc(row.when), badge(row.grade), esc(row.assigned)]), "No ghost leads."))}
${section("Waiting for a reply", table(["Contact", "Assigned", "Last inbound", "Waiting", "Snippet"], waiting.map((row) => [esc(row.name), esc(row.assigned), esc(row.when), badge(row.grade), esc(row.detail)]), "No one is waiting."))}
${section("Missed calls", table(["Contact", "When", "Status", "Since", "Age", "Assigned"], missed.map((row) => [esc(row.name), esc(row.when), esc(row.detail), esc(row.age), badge(row.grade), esc(row.assigned)]), "No missed calls."))}
${section("Going cold", table(["Contact", "Last activity", "Silent", "Age", "Assigned"], cold.map((row) => [esc(row.name), esc(row.when), esc(row.age), badge(row.grade), esc(row.assigned)]), "No leads are going cold."))}
${section("Opt-outs", `${table(["Contact", "Matched", "When", "Age", "Assigned"], opted.map((row) => [esc(row.name), esc(row.age), esc(row.when), badge(row.grade), esc(row.assigned)]), "No opt-outs.")}<p style="margin:8px 0 0;font-size:13px;">These contacts must be removed from all sequences.</p>`)}
${section("Single-touch automation", table(["Contact", "First outbound", "Since", "Age", "Assigned"], single.map((row) => [esc(row.name), esc(row.when), esc(row.age), badge(row.grade), esc(row.assigned)]), "No single-touch leads."))}
${section("Weekend catch-up", table(["Contact", "Inbound", "Reply", "Age", "Assigned"], weekend.map((row) => [esc(row.name), esc(row.when), esc(row.detail), badge(row.grade), esc(row.assigned)]), "No weekend messages."))}
${section("Rep rollup", usersFailed ? unavailable("user pull failed") : table(["User", "Flags", "Critical", "High", "Medium", "Low", "Oldest"], reps.map((row) => [esc(row.name), String(row.total), String(row.Critical), String(row.High), String(row.Medium), String(row.Low), row.oldest ? `${Math.round(row.oldest / 3600000)}h` : ""]), "No flags."))}
${section("Recommended actions", actions.length ? `<ol style="margin:0;padding-left:18px;font-size:13px;">${actions.map((row) => `<li style="margin:0 0 6px;"><b>${esc(row.name)}</b> — ${esc(row.category)} — ${esc(row.age)}. ${esc(row.action)}</li>`).join("")}</ol>` : `<p style="margin:0;font-size:13px;">No urgent action.</p>`)}
${section("Footer", `<p style="margin:0;font-size:12px;color:#5C6570;">Run ${esc(runId)} · ${esc(new Date().toISOString())} UTC · location ${esc(locationId)} · ${esc(contacts.length)} contacts${truncated ? " · truncated to the 100 most recently added" : ""}${contactsFailed ? " · contact pull was partial" : ""}. Generated automatically. Reply to this message to reach the sales operations team.</p>`)}
</table></td></tr></table></body></html>`;

    const critWaiting = waiting.filter((row) => row.grade === "Critical").length;
    const top = reps[0];
    const counts = {
      Ghost: contactsFailed ? "?" : String(ghost.length),
      Waiting: String(waiting.length),
      crit: String(critWaiting),
      Missed: String(missed.length),
      Cold: String(cold.length),
      Opt: String(opted.length),
      Single: String(single.length),
      Weekend: String(weekend.length),
    };
    let smsLines = [
      `DAILY SALES QA — ${today.short}`,
      business.slice(0, 24),
      `Ghost ${counts.Ghost} · Waiting ${counts.Waiting} (${counts.crit} crit)`,
      `Missed calls ${counts.Missed} · Going cold ${counts.Cold}`,
      `Opt-outs ${counts.Opt} · Single-touch ${counts.Single}`,
      `Weekend ${counts.Weekend}`,
      top ? `Top: ${top.name} — ${top.total} flags` : "Top: none — 0 flags",
      "Reply STOP to opt out.",
    ];
    const drop = [6, 5, 4];
    while (smsLines.join("\n").length > 320 && drop.length) smsLines.splice(drop.shift() as number, 1);
    if (contactsFailed || usersFailed) smsLines.push("DATA PARTIAL");
    const sms = smsLines.join("\n").slice(0, 320);

    const { data: managers } = await db.from("managers").select("email, name, role, status, territory_id, territory_ids").in("role", ["owner", "super_admin"]);
    const recipients = new Map<string, string>();
    for (const manager of managers || []) {
      if (manager.status && manager.status !== "active") continue;
      const email = String(manager.email || "").trim().toLowerCase();
      if (!email) continue;
      const extras = Array.isArray(manager.territory_ids) ? manager.territory_ids : [];
      const inArea = manager.role === "super_admin" || manager.territory_id === territoryId || extras.includes(territoryId);
      if (inArea) recipients.set(email, manager.name || email);
    }
    const emailed: string[] = [];
    const texted: string[] = [];
    const missing: string[] = [];
    const problems: string[] = [];
    for (const [email, name] of recipients) {
      const found = await crm(token, `${CRM}/contacts/search`, {
        method: "POST",
        body: JSON.stringify({ locationId, page: 1, pageLimit: 5, filters: [{ field: "email", operator: "eq", value: email }] }),
      });
      const contact = (found.body?.contacts || []).find((row: any) => String(row.email || "").toLowerCase() === email);
      if (!found.ok || !contact?.id) {
        missing.push(email);
        await db.from("send_log").insert({ run_id: runId, channel: "email", email, status: "missing_contact", error: "Not a contact in this Ovanta account" });
        continue;
      }
      const mail = await crm(token, `${CRM}/conversations/messages`, {
        method: "POST",
        body: JSON.stringify({
          type: "Email",
          contactId: contact.id,
          subject: `Daily Sales Conversation Quality Report — ${runDate}`,
          html,
          emailTo: email,
        }),
      });
      const mailId = mail.body?.messageId || mail.body?.id || mail.body?.message?.id || "";
      await db.from("send_log").insert({ run_id: runId, channel: "email", email, message_id: mailId, conversation_id: mail.body?.conversationId || null, status: mail.ok ? "accepted" : "failed", error: mail.ok ? null : mail.text });
      if (mail.ok) emailed.push(email);
      else problems.push(`${email} email ${mail.status}`);
      if (!contact.phone) {
        await db.from("send_log").insert({ run_id: runId, channel: "sms", email, status: "no_phone", error: "Contact has no phone" });
        problems.push(`${name} has no phone in Ovanta`);
        continue;
      }
      const text = await crm(token, `${CRM}/conversations/messages`, {
        method: "POST",
        body: JSON.stringify({ type: "SMS", contactId: contact.id, message: sms }),
      });
      const textId = text.body?.messageId || text.body?.id || text.body?.message?.id || "";
      await db.from("send_log").insert({ run_id: runId, channel: "sms", email, message_id: textId, conversation_id: text.body?.conversationId || null, status: text.ok ? "accepted" : "failed", error: text.ok ? null : text.text });
      if (text.ok) texted.push(email);
      else problems.push(`${email} text ${text.status}`);
    }
    const status = emailed.length && (texted.length || !problems.length) ? "sent" : emailed.length || texted.length ? "partial" : "failed";
    await db.from("report_runs").update({
      status,
      finished_at: new Date().toISOString(),
      summary: sms,
      error: problems.concat(missing.map((email) => `${email} is not a contact in this Ovanta account`)).join("; ") || null,
    }).eq("id", runId);
    return json({ success: status !== "failed", status, company: business, emailed, texted, missing, problems, summary: sms, runId });
  } catch (error: any) {
    if (runId) await db.from("report_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: error?.message || "failed" }).eq("id", runId);
    return json({ error: error?.message || "The report failed", status: "failed" }, 500);
  }
});
