// sales-activity — Sales Activity report for owner + super_admin only.
// ONE FILE. No sibling imports. Pool = CRM contacts tagged "new lead"
// (exclude booked/hired). Parses conversations + messageTypes, buckets,
// builds a plain-text report, optionally emails it to owners.
import { createClient } from "jsr:@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const CRM = "https://services.leadconnectorhq.com";
const VER = "2021-07-28";

const hrs = (iso?: string | null): number | null =>
  iso && !isNaN(new Date(iso).getTime()) ? Math.round((Date.now() - new Date(iso).getTime()) / 36e5) : null;
const trim = (s?: string | null, n = 180): string => {
  if (!s) return "";
  const c = String(s).replace(/\s+/g, " ").trim();
  return c.length > n ? c.slice(0, n) + "…" : c;
};
const hasTag = (tags: any, t: string): boolean => {
  if (!tags) return false;
  const n = t.toLowerCase();
  return (Array.isArray(tags) ? tags : String(tags).split(",")).some((x: any) => String(x || "").toLowerCase() === n);
};
const chanOf = (c: any): string => {
  const t = String(c.lastMessageDataType || c.type || "").toUpperCase();
  if (t === "TYPE_CALL" || t === "TYPE_CAMPAIGN_CALL") return "call";
  if (t === "TYPE_SMS") return "sms";
  if (t === "TYPE_EMAIL") return "email";
  if (t.startsWith("TYPE_CAMPAIGN")) return "automation";
  return t ? t.toLowerCase() : "other";
};
const isAuto = (c: any): boolean => {
  const t = String(c.lastMessageDataType || c.type || "").toUpperCase();
  if (t.startsWith("TYPE_CAMPAIGN")) return true;
  const a = String(c.lastMessageAction || "").toLowerCase();
  return a === "automated" || a === "workflow";
};
// messageTypes codes: 2=call, 3=manual SMS, 45=email, 100=automation, 1=voicemail
const mtCodes = (c: any): Set<number> => {
  const s = new Set<number>();
  const mt = c.messageTypes || c.message_types;
  if (Array.isArray(mt)) for (const v of mt) s.add(Number(v));
  return s;
};
const rptDate = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function buildReport(co: string, nr: any[], gc: any[], oo: any[], cm: any, gw: any[], pr: any[]): string {
  const L: string[] = [`🌸 ${co} Daily Sales Report — ${rptDate()}`, "", "🚨 Needs a Reply Right Now"];
  if (!nr.length) L.push("None — inbox is clear. That's a win worth noting.");
  else nr.slice(0, 10).forEach((r) => L.push(`${r.name} — ${r.channel} ${r.hoursAgo ?? "?"}h ago: ${r.snippet || "(no snippet)"}`));
  L.push("", "⚠️ Going Cold / Pipeline Cleanup");
  if (!gc.length && !oo.length) L.push("No cold leads — everyone is still warm.");
  else {
    gc.forEach((r) => L.push(`${r.name} — last touch ${r.daysAgo}d ago${r.automationOnly ? " (automation only)" : ""}.`));
    oo.forEach((r) => L.push(`${r.name} — opted out (STOP) but still tagged active. Mark lost.`));
  }
  L.push("", "📞 Channel Mix");
  L.push(`${cm.callPct}% of recent new-lead conversations included a call. ${cm.manualSms} manual SMS, ${cm.email} email, ${cm.automation} automation. ${cm.contactedLast24h} leads contacted in the last 24h.`);
  if (cm.emailBlindSpotWarning) L.push("Low email usage — replies are easy to miss.");
  if (cm.automationOnly?.length) L.push(`${cm.automationOnly.length} leads are automation-only — they need a personal touch.`);
  L.push("", "✅ What's Going Well");
  if (!gw.length) L.push("No calls logged in the last 48h — make one today.");
  else gw.forEach((r) => L.push(`${r.name} — ${r.what} (${r.hoursAgo ?? "?"}h ago).`));
  L.push("", "🎯 Today's 3 Priorities");
  if (!pr.length) L.push("No urgent items — use the time to call a cold lead.");
  else pr.forEach((p, i) => L.push(`${i + 1}. ${p.action}`));
  L.push("");
  let t = L.join("\n");
  return t.length > 4500 ? t.slice(0, 4500) : t;
}

async function findContact(email: string, loc: string, h: Record<string, string>): Promise<string | null> {
  try {
    const r = await fetch(`${CRM}/contacts/search`, { method: "POST", headers: h, body: JSON.stringify({ locationId: loc, page: 1, pageLimit: 10, filters: [{ field: "email", operator: "eq", value: email }] }) });
    if (!r.ok) return null;
    return ((await r.json()).contacts || [])[0]?.id || null;
  } catch { return null; }
}

async function sendEmails(loc: string, h: Record<string, string>, co: string, txt: string): Promise<any> {
  const to = ["mark.t.watson83@gmail.com", "gosocialonline@gmail.com"];
  const subj = `🌸 ${co} Daily Sales Report — ${rptDate()}`;
  const out: any[] = [];
  for (const email of to) {
    try {
      const cid = await findContact(email, loc, h);
      if (!cid) { out.push({ email, status: "contact_not_found" }); continue; }
      const r = await fetch(`${CRM}/conversations/messages`, { method: "POST", headers: h, body: JSON.stringify({ type: "Email", locationId: loc, contactId: cid, subject, html: txt.replace(/\n/g, "<br>"), message: txt }) });
      out.push({ email, contactId: cid, status: r.ok ? "sent" : "failed", code: r.status, body: trim(await r.text(), 200) });
    } catch (e: any) { out.push({ email, status: "error", error: e?.message || String(e) }); }
  }
  return { subject: subj, recipients: out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  let body: any = {};
  try { if (req.method === "POST") body = await req.json().catch(() => ({})); } catch { body = {}; }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const ak = Deno.env.get("SUPABASE_ANON_KEY") || sk;
  if (!url || !sk) return json({ error: "Missing Supabase env" }, 500);

  const db = createClient(url, sk, { global: { headers: { Authorization: `Bearer ${sk}` } } });

  // Auth — user client (no service header) for getUser
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return json({ error: "Unauthorized — login required" }, 401);
  const udb = createClient(url, ak);
  let uid = "", uemail = "";
  try {
    const { data: ud, error: ue } = await udb.auth.getUser(tok);
    if (ue || !ud?.user) return json({ error: "Unauthorized — invalid session", detail: ue?.message || null, tokenLen: tok.length, tokenPrefix: tok.slice(0, 8) }, 401);
    uid = ud.user.id; uemail = ud.user.email || "";
  } catch (e: any) { return json({ error: "Unauthorized — " + (e?.message || "session check failed") }, 401); }

  // managers: id uuid PK, email, role, status — no user_id/auth_id
  const le = uemail.trim();
  let mgr: any = null;
  if (le) { const { data } = await db.from("managers").select("id, email, role, status").ilike("email", le).maybeSingle(); mgr = data; }
  if (!mgr && uid) { const { data } = await db.from("managers").select("id, email, role, status").eq("id", uid).maybeSingle(); mgr = data; }
  const role = String(mgr?.role || "").toLowerCase().trim();
  if (!["owner", "owner_readonly", "super_admin"].includes(role))
    return json({ error: "Forbidden — owner or super_admin only", email: le, userId: uid, managerRowFound: !!mgr, roleFound: role || null }, 403);

  // portal_settings
  let ps: any = null;
  const { data: psFull, error: psErr } = await db.from("portal_settings").select("hl_api_key, hl_location_id, app_url, company_name").maybeSingle();
  if (psErr) { const { data: m } = await db.from("portal_settings").select("hl_api_key, hl_location_id, company_name").maybeSingle(); ps = m; }
  else ps = psFull;
  const key = (ps?.hl_api_key || "").trim(), loc = (ps?.hl_location_id || "").trim();
  if (!key || !loc) return json({ error: "Ovanta API key/location not set" }, 422);

  const errs: string[] = [];
  const H: Record<string, string> = { Authorization: `Bearer ${key}`, Version: VER, "Content-Type": "application/json" };

  // 1) Contacts tagged "new lead" (exclude booked/hired)
  const pool = new Map<string, any>();
  let src: "search" | "search-cased" | "list-filter" = "list-filter";
  try {
    const search = async (val: string): Promise<any[] | null> => {
      const all: any[] = [];
      for (let pg = 1; pg <= 5 && all.length < 500; pg++) {
        const r = await fetch(`${CRM}/contacts/search`, { method: "POST", headers: H, body: JSON.stringify({ locationId: loc, page: pg, pageLimit: 100, filters: [{ field: "tags", operator: "eq", value: val }] }) });
        if (!r.ok) { errs.push(`contacts/search ${val} ${r.status}: ${trim(await r.text(), 200)}`); return null; }
        const b = (await r.json()).contacts || [];
        if (!b.length) break;
        all.push(...b);
      }
      return all;
    };
    let batch = await search("new lead");
    if (batch?.length) src = "search";
    else { batch = await search("New Lead"); if (batch?.length) src = "search-cased"; }
    if (!batch?.length) {
      src = "list-filter";
      const all: any[] = [];
      let after = "";
      for (let p = 0; p < 5 && all.length < 500; p++) {
        let u = `${CRM}/contacts/?locationId=${loc}&limit=100`;
        if (after) u += `&startAfter=${encodeURIComponent(after)}`;
        const r = await fetch(u, { headers: H });
        if (!r.ok) { errs.push(`contacts list ${r.status}: ${trim(await r.text(), 200)}`); break; }
        const j = await r.json();
        const rows: any[] = j.contacts || [];
        if (!rows.length) break;
        all.push(...rows);
        after = j.meta?.nextPageToken || "";
        if (!after) break;
      }
      batch = all.filter((c) => hasTag(c.tags, "new lead"));
    }
    for (const c of batch || []) {
      if (hasTag(c.tags, "booked") || hasTag(c.tags, "hired")) continue;
      pool.set(c.id, c);
      if (pool.size >= 500) break;
    }
  } catch (e: any) { errs.push(`contacts: ${e?.message || String(e)}`); }
  const poolArr = [...pool.values()];
  const poolIds = new Set(poolArr.map((c) => c.id));
  if (!poolArr.length && !errs.length) errs.push("No contacts tagged new lead. Check exact tag spelling in Ovanta.");

  // 2) Conversations — recent 50, inbound unread, inbound any
  type C = { id: string; contactId: string; name: string; phone: string; email: string; date: string | null; dir: string; type: string; body: string; channel: string; automation: boolean };
  const convMap = new Map<string, C>();
  const searchConv = async (params: Record<string, string>): Promise<any[]> => {
    try {
      const qs = new URLSearchParams({ locationId: loc, limit: "50", sort: "desc", sortBy: "last_message_date", ...params });
      const r = await fetch(`${CRM}/conversations/search?${qs}`, { headers: H });
      if (!r.ok) { errs.push(`conversations/search ${r.status}: ${trim(await r.text(), 200)}`); return []; }
      return (await r.json()).conversations || [];
    } catch (e: any) { errs.push(`conversations/search: ${e?.message || String(e)}`); return []; }
  };
  const toC = (c: any): C => {
    const cid = c.contactId || c.contact_id || "";
    const ct = pool.get(cid);
    return {
      id: c.id, contactId: cid,
      name: ct?.name || ct?.firstName || c.fullName || ct?.email || "Unknown",
      phone: ct?.phone || c.phone || "", email: ct?.email || c.email || "",
      date: c.lastMessageDate || c.last_message_date || null,
      dir: String(c.lastMessageDirection || c.last_message_direction || "").toLowerCase(),
      type: String(c.lastMessageDataType || c.last_message_data_type || c.type || "").toUpperCase(),
      body: c.lastMessageBody || c.last_message_body || "",
      channel: chanOf(c), automation: isAuto(c),
    };
  };
  for (const c of [...await searchConv({}), ...await searchConv({ lastMessageDirection: "inbound", status: "unread" }), ...await searchConv({ lastMessageDirection: "inbound" })]) {
    const cv = toC(c);
    if (!poolIds.has(cv.contactId)) continue;
    const ex = convMap.get(cv.id);
    if (!ex || (cv.date && ex.date && new Date(cv.date) > new Date(ex.date))) convMap.set(cv.id, cv);
  }
  const convs = [...convMap.values()];

  // 3) Latest inbound snippet
  const snippet = async (id: string): Promise<string> => {
    try {
      const r = await fetch(`${CRM}/conversations/${id}/messages?limit=5`, { headers: H });
      if (!r.ok) return "";
      const ms = (await r.json()).messages || [];
      const arr = Array.isArray(ms) ? ms : [];
      const inb = arr.filter((m) => String(m.direction || "").toLowerCase() === "inbound");
      const p = inb[0] || arr[0];
      return trim(p?.body || p?.message || p?.text || "");
    } catch { return ""; }
  };

  // BUCKETS
  const needsReplyRaw = convs.filter((c) => c.dir === "inbound").sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0));
  const needsReply: any[] = [];
  for (const c of needsReplyRaw.slice(0, 30)) needsReply.push({ contactId: c.contactId, name: c.name, phone: c.phone, email: c.email, hoursAgo: hrs(c.date), channel: c.channel, snippet: await snippet(c.id) });
  const emailBlindSpot = needsReply.filter((r) => r.channel === "email");

  const fiveD = 5 * 864e5;
  const goingCold: any[] = [], optedOut: any[] = [];
  for (const c of convs) {
    if (!c.date) continue;
    const age = Date.now() - new Date(c.date).getTime();
    if (age < fiveD) continue;
    const b = (c.body || "").trim();
    const row = { contactId: c.contactId, name: c.name, phone: c.phone, email: c.email, daysAgo: Math.round(age / 864e5), channel: c.channel, snippet: trim(b), automationOnly: c.automation };
    if (/\bSTOP\b/i.test(b)) optedOut.push({ ...row, note: "opted out — remove from pipeline" });
    else goingCold.push(row);
  }
  goingCold.sort((a, b) => (b.daysAgo || 0) - (a.daysAgo || 0));

  // Channel Mix — messageTypes codes: 2=call, 3=SMS, 45=email, 100=automation, 1=voicemail
  const mix = convs.filter((c) => c.date).sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()).slice(0, 50);
  let calls = 0, sms = 0, email = 0, auto = 0, vm = 0, c24 = 0;
  const autoOnly: any[] = [];
  const base = mix.length || 1;
  const oneD = 864e5;
  for (const c of mix) {
    const cd = mtCodes(c), t = c.type;
    const hc = cd.has(2) || t === "TYPE_CALL" || t === "TYPE_CAMPAIGN_CALL";
    const hs = cd.has(3) || (t === "TYPE_SMS" && !c.automation);
    const he = cd.has(45) || t === "TYPE_EMAIL";
    const ha = cd.has(100) || c.automation || t.startsWith("TYPE_CAMPAIGN");
    if (hc) calls++; if (hs) sms++; if (he) email++; if (ha) auto++; if (cd.has(1)) vm++;
    if (c.dir === "outbound" && c.date && !c.automation && Date.now() - new Date(c.date).getTime() <= oneD) c24++;
    if (ha && !hc && !hs) autoOnly.push({ contactId: c.contactId, name: c.name, hoursAgo: hrs(c.date) });
  }
  const channelMix = { calls, manualSms: sms, email, automation: auto, voicemail: vm, callPct: Math.round((calls / base) * 100), callRatio: Math.round((calls / base) * 100) / 100, contactedLast24h: c24, automationOnly: autoOnly, emailBlindSpotWarning: (mix.length ? email / mix.length : 0) < 0.15 };

  // What's Going Well — human call in last 48h
  const twoD = 1728e5;
  const wellWords = /\b(thank|thanks|love|perfect|book|pricing|price|deposit|reserve)\b/i;
  const goingWell: any[] = [];
  for (const c of convs) {
    if (!c.date) continue;
    if (Date.now() - new Date(c.date).getTime() > twoD) continue;
    if (c.type !== "TYPE_CALL" || c.automation) continue;
    goingWell.push({ contactId: c.contactId, name: c.name, what: wellWords.test(c.body) ? "Positive call — " + trim(c.body, 80) : "Outbound call placed", hoursAgo: hrs(c.date) });
  }

  // Today's Priorities
  const priorities: any[] = [], seen = new Set<string>();
  const addP = (s: any, action: string, why: string) => {
    if (!s || priorities.length >= 3 || seen.has(s.contactId)) return;
    seen.add(s.contactId);
    priorities.push({ name: s.name, action, why, contactId: s.contactId, hoursAgo: s.hoursAgo ?? s.daysAgo * 24 });
  };
  if (needsReply[0]) { const r = needsReply[0]; addP(r, `Reply to ${r.name} — inbound ${r.channel} ${r.hoursAgo ?? "?"}h ago`, r.snippet ? `"${r.snippet}"` : "Unanswered inbound message"); }
  const ef = emailBlindSpot.find((r) => !seen.has(r.contactId));
  if (ef) addP(ef, `Email ${ef.name} — unanswered email ${ef.hoursAgo ?? "?"}h ago`, ef.snippet ? `"${ef.snippet}"` : "Hides from SMS inbox");
  const cold = goingCold.find((r) => !seen.has(r.contactId));
  if (cold) addP(cold, `Call ${cold.name} — new lead, last touch ${cold.daysAgo}d ago`, cold.automationOnly ? "Automation-only — no human follow-up" : "Going cold");

  // Report + optional email
  const co = (ps?.company_name || "Honeysuckle Haus").trim();
  const reportText = buildReport(co, needsReply, goingCold, optedOut, channelMix, goingWell, priorities);
  let emailResult: any = null;
  if (body?.sendEmail && reportText) emailResult = await sendEmails(loc, H, co, reportText);

  return json({ ranAt: new Date().toISOString(), poolSize: poolArr.length, poolSource: src, reportText, emailResult, priorities, needsReply, emailBlindSpot, goingCold, optedOut, channelMix, goingWell, errors: errs });
});
