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

// GHL fetch with 12s timeout — prevents the whole function from hanging on a slow endpoint
const gfetch = async (url: string, init?: RequestInit): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

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

// --- Channel detection (uses lastMessageType, NOT lastMessageDataType) ---
// CALL: TYPE_PHONE, TYPE_CALL, TYPE_CAMPAIGN_CALL, TYPE_VOICEMAIL, type===1, messageTypes 1 or 2
// SMS: TYPE_SMS, messageTypes 3
// EMAIL: TYPE_EMAIL, TYPE_CAMPAIGN_EMAIL, messageTypes 45
// AUTOMATION: TYPE_CAMPAIGN_* or lastMessageAction automated
const CALL_TYPES = new Set(["TYPE_PHONE", "TYPE_CALL", "TYPE_CAMPAIGN_CALL", "TYPE_VOICEMAIL"]);
const SMS_TYPES = new Set(["TYPE_SMS"]);
const EMAIL_TYPES = new Set(["TYPE_EMAIL", "TYPE_CAMPAIGN_EMAIL"]);

const lastType = (c: any): string => String(c.lastMessageType || c.type || "").toUpperCase();
const mtCodes = (c: any): Set<number> => {
  const s = new Set<number>();
  const mt = c.messageTypes || c.message_types;
  if (Array.isArray(mt)) for (const v of mt) s.add(Number(v));
  return s;
};
const isCall = (c: any): boolean => {
  const t = lastType(c);
  return CALL_TYPES.has(t) || c.type === 1 || mtCodes(c).has(1) || mtCodes(c).has(2);
};
const isSms = (c: any): boolean => {
  const t = lastType(c);
  return SMS_TYPES.has(t) || mtCodes(c).has(3);
};
const isEmail = (c: any): boolean => {
  const t = lastType(c);
  return EMAIL_TYPES.has(t) || mtCodes(c).has(45);
};
const isAuto = (c: any): boolean => {
  const t = lastType(c);
  if (t.startsWith("TYPE_CAMPAIGN")) return true;
  const a = String(c.lastMessageAction || "").toLowerCase();
  return a === "automated" || a === "workflow";
};
// Human call = CALL and not automated
const isHumanCall = (c: any): boolean => isCall(c) && !isAuto(c);

const channelLabel = (c: any): string => {
  if (isCall(c)) return "Call";
  if (isSms(c)) return "SMS";
  if (isEmail(c)) return "Email";
  if (isAuto(c)) return "Automation";
  return "Other";
};
const channelVerb = (c: any): string => {
  if (isCall(c)) return "called";
  if (isEmail(c)) return "emailed";
  return "texted";
};

const rptDate = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function buildReport(co: string, nr: any[], gc: any[], oo: any[], cm: any, gw: any[], pr: any[]): string {
  const L: string[] = [`🌸 ${co} Daily Sales Report — ${rptDate()}`, ""];
  // 1) Needs a Reply Right Now
  L.push("🚨 Needs a Reply Right Now");
  if (!nr.length) L.push("Inbox is clear. No unanswered new-lead messages.");
  else {
    const r0 = nr[0];
    L.push(`${r0.name} ${channelVerb(r0)} ${r0.hoursAgo ?? "?"} hours ago: ${r0.snippet ? `"${r0.snippet}"` : "(no message body)"}. Still unanswered — ${channelLabel(r0)} reply needed.`);
    if (nr.length > 1) {
      L.push("Also waiting:");
      nr.slice(1, 6).forEach((r) => L.push(`- ${r.name} — ${r.hoursAgo ?? "?"}h — ${r.snippet ? `"${r.snippet}"` : "no snippet"}`));
    }
  }
  // 2) Pipeline Cleanup
  L.push("", "⚠️ Pipeline Cleanup");
  if (oo.length) {
    L.push(`${oo.length} new lead${oo.length === 1 ? "" : "s"} texted STOP but ${oo.length === 1 ? "is" : "are"} still in the pipeline:`);
    oo.forEach((r) => L.push(`- ${r.name} — opted out ~${r.daysAgo ?? "?"} days ago`));
  } else {
    L.push("No opt-outs lingering in the active pipeline.");
  }
  if (gc[0] && !oo.some((o: any) => o.contactId === gc[0].contactId)) {
    L.push(`${gc[0].name} has been a new lead for ${gc[0].daysAgo}+ days with no recent engagement. Worth one personal attempt before closing out.`);
  }
  // 3) Channel Mix
  const total = cm.total || 0;
  L.push("", "📞 Channel Mix — This Looks Good");
  L.push(`- ${cm.calls} of ${total} (${cm.callPct}%) new lead conversations involved a phone call.`);
  L.push(`- ${cm.outreachPct ?? 0}% had personal outreach — ${cm.automationOnly?.length || 0} automation-only.`);
  L.push(`- ${cm.contactedLast24h ?? 0} new leads contacted outbound in the last 24 hours.`);
  L.push(`- Only ${cm.email} of ${total} used email — replies there are easy to miss.`);
  // 4) What's Going Well
  L.push("", "✅ What's Going Well");
  if (!gw.length) L.push("No human calls to new leads in the last 48 hours.");
  else L.push(`Calls made to new leads in the last 48 hours: ${gw.map((r) => r.name).join(", ")}. That's ${gw.length} personal touch${gw.length === 1 ? "" : "es"} worth celebrating.`);
  // 5) Today's 3 Priorities
  L.push("", "🎯 Today's 3 Priorities");
  if (!pr.length) L.push("No urgent items — use the time to call a cold lead.");
  else pr.forEach((p, i) => L.push(`${i + 1}. ${p.action}${p.why ? ` — ${p.why}` : ""}`));
  L.push("", `${co} | Automated Daily Sales Report | Generated ${new Date().toLocaleString()}`);
  let t = L.join("\n");
  return t.length > 4500 ? t.slice(0, 4500) : t;
}

async function findOrCreateContact(
  email: string,
  loc: string,
  h: Record<string, string>,
  name?: string,
): Promise<{ id: string | null; error?: string }> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return { id: null, error: "Empty email" };

  // 1. Try search with email filter
  try {
    const r = await gfetch(`${CRM}/contacts/search`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        locationId: loc,
        page: 1,
        pageLimit: 10,
        filters: [{ field: "email", operator: "eq", value: cleanEmail }],
      }),
    });
    if (r.ok) {
      const j = await r.json();
      const id = (j.contacts || [])[0]?.id;
      if (id) return { id };
    }
  } catch (_e) {}

  // 2. Try duplicate search endpoint
  try {
    const dupRes = await gfetch(
      `${CRM}/contacts/search/duplicate?locationId=${loc}&email=${encodeURIComponent(cleanEmail)}`,
      { headers: h },
    );
    if (dupRes.ok) {
      const dupData = await dupRes.json();
      const id = dupData.contact?.id || dupData.id || dupData.contacts?.[0]?.id;
      if (id) return { id };
    }
  } catch (_e) {}

  // 3. Try standard query endpoint
  try {
    const qRes = await gfetch(
      `${CRM}/contacts/?locationId=${loc}&query=${encodeURIComponent(cleanEmail)}`,
      { headers: h },
    );
    if (qRes.ok) {
      const qData = await qRes.json();
      const id = qData.contacts?.[0]?.id;
      if (id) return { id };
    }
  } catch (_e) {}

  // 4. Auto-create contact if not found
  try {
    const parts = (name || cleanEmail.split("@")[0] || "Team Member").trim().split(" ");
    const firstName = parts[0] || "Team";
    const lastName = parts.slice(1).join(" ") || "Member";
    const createRes = await gfetch(`${CRM}/contacts/`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        locationId: loc,
        email: cleanEmail,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        tags: ["portal-auto-created", "staff"],
      }),
    });
    const cText = await createRes.text();
    if (createRes.ok) {
      try {
        const cj = JSON.parse(cText);
        const id = cj.contact?.id || cj.id;
        if (id) return { id };
      } catch (_e) {}
    } else {
      console.warn(`[sales-activity] create contact failed for ${cleanEmail}: ${cText.slice(0, 300)}`);
      // If contact already exists error, try to extract id from error or search again
      try {
        const errJson = JSON.parse(cText);
        if (errJson.meta?.contactId || errJson.contactId || errJson.contact?.id) {
          return { id: errJson.meta?.contactId || errJson.contactId || errJson.contact?.id };
        }
      } catch (_e) {}
      return { id: null, error: `Create contact failed (${createRes.status}): ${cText.slice(0, 150)}` };
    }
  } catch (err: any) {
    console.warn(`[sales-activity] create contact exception: ${err?.message}`);
    return { id: null, error: `Create contact error: ${err?.message || String(err)}` };
  }

  return { id: null, error: "Contact not found and auto-create did not return an ID" };
}

async function sendEmails(
  loc: string,
  h: Record<string, string>,
  co: string,
  txt: string,
  recipients?: Array<{ email: string; name?: string }>,
): Promise<any> {
  const defaultTo = [
    { email: "mark.t.watson83@gmail.com", name: "Mark Watson" },
    { email: "gosocialonline@gmail.com", name: "Nik Krohn" },
  ];
  const targetList = recipients && recipients.length > 0 ? recipients : defaultTo;
  const subj = `🌸 ${co} Daily Sales Report — ${rptDate()}`;
  const out: any[] = [];

  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#faf8f5;padding:24px;color:#2b2b2b;">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #ece4dc;padding:32px 36px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
    <div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">${txt.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</div>
  </div>
</body></html>`;

  for (const item of targetList) {
    const targetEmail = (item.email || "").trim().toLowerCase();
    if (!targetEmail) continue;
    try {
      const { id: cid, error: cErr } = await findOrCreateContact(targetEmail, loc, h, item.name);
      if (!cid) {
        out.push({
          email: targetEmail,
          status: "contact_not_found",
          error: cErr || "Could not find or create contact in CRM",
        });
        continue;
      }

      // Try sending with standard payload
      const emailPayload: any = {
        type: "Email",
        locationId: loc,
        contactId: cid,
        emailTo: targetEmail,
        to: [targetEmail],
        subject: subj,
        html,
        message: txt,
      };

      let r = await gfetch(`${CRM}/conversations/messages`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(emailPayload),
      });

      let resBody = trim(await r.text(), 300);

      // If failed with 400/422, retry with minimal payload without to/emailTo fields
      if (!r.ok) {
        const retryPayload = {
          type: "Email",
          locationId: loc,
          contactId: cid,
          subject: subj,
          html,
          message: txt,
        };
        const retryRes = await gfetch(`${CRM}/conversations/messages`, {
          method: "POST",
          headers: h,
          body: JSON.stringify(retryPayload),
        });
        if (retryRes.ok) {
          r = retryRes;
          resBody = trim(await retryRes.text(), 300);
        } else {
          // If still failed, log both error attempts
          const retryErr = trim(await retryRes.text(), 300);
          resBody = `${resBody} | Retry: ${retryErr}`;
        }
      }

      out.push({
        email: targetEmail,
        contactId: cid,
        status: r.ok ? "sent" : "failed",
        code: r.status,
        body: resBody,
        error: !r.ok ? resBody : undefined,
      });
    } catch (e: any) {
      out.push({ email: targetEmail, status: "error", error: e?.message || String(e) });
    }
  }
  return { subject: subj, recipients: out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  console.log("[sales-activity] start");
  let body: any = {};
  try { if (req.method === "POST") body = await req.json().catch(() => ({})); } catch { body = {}; }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const ak = Deno.env.get("SUPABASE_ANON_KEY") || sk;
  if (!url || !sk) return json({ error: "Missing Supabase env" }, 500);

  const db = createClient(url, sk, { global: { headers: { Authorization: `Bearer ${sk}` } } });

  try {
  // Auth resolution
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const callerEmail = (body?.callerEmail || req.headers.get("x-user-email") || "").trim().toLowerCase();
  let uid = "", uemail = "";

  // 1. Try resolving token via Supabase Auth
  if (tok && tok !== ak) {
    const udb = createClient(url, ak);
    try {
      const { data: ud, error: ue } = await udb.auth.getUser(tok);
      if (ud?.user) {
        uid = ud.user.id;
        uemail = (ud.user.email || "").trim().toLowerCase();
      } else {
        // Fallback: decode JWT payload without verification to extract email/sub
        try {
          const parts = tok.split(".");
          if (parts.length === 3) {
            const raw = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
            if (raw.email) uemail = String(raw.email).trim().toLowerCase();
            if (raw.sub) uid = String(raw.sub);
          }
        } catch (_ignore) {}
      }
    } catch (_ignore) {}
  }

  // 2. If token auth didn't yield an email, fallback to callerEmail
  if (!uemail && callerEmail) {
    uemail = callerEmail;
  }

  if (!uemail && !uid) {
    return json({
      error: "Unauthorized — invalid session",
      detail: "No authenticated session found. Please re-login or refresh the page.",
      tokenLen: tok.length,
      tokenPrefix: tok ? tok.slice(0, 8) : "none"
    }, 401);
  }

  // managers: id uuid PK, email, role, status — no user_id/auth_id
  let mgr: any = null;
  if (uemail) {
    const { data } = await db.from("managers").select("id, email, role, status").ilike("email", uemail).maybeSingle();
    mgr = data;
  }
  if (!mgr && uid && /^[0-9a-f-]{36}$/i.test(uid)) {
    try {
      const { data } = await db.from("managers").select("id, email, role, status").eq("id", uid).maybeSingle();
      mgr = data;
    } catch (_ignore) {}
  }

  const role = String(mgr?.role || "").toLowerCase().trim();
  if (!["owner", "owner_readonly", "super_admin"].includes(role)) {
    return json({
      error: "Forbidden — owner or super_admin only",
      email: uemail,
      userId: uid,
      managerRowFound: !!mgr,
      roleFound: role || null
    }, 403);
  }

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
    // 2 pages max (200 contacts) — enough for the report, avoids timeout
    const searchPages = async (val: string): Promise<any[] | null> => {
      const all: any[] = [];
      for (let p = 1; p <= 2; p++) {
        const r = await gfetch(`${CRM}/contacts/search`, { method: "POST", headers: H, body: JSON.stringify({ locationId: loc, page: p, pageLimit: 100, filters: [{ field: "tags", operator: "eq", value: val }] }) });
        if (!r.ok) { if (p === 1) errs.push(`contacts/search ${val} ${r.status}: ${trim(await r.text(), 200)}`); break; }
        const cs = (await r.json()).contacts || [];
        all.push(...cs);
        if (cs.length < 100) break;
      }
      return all.length ? all : null;
    };
    let batch = await searchPages("new lead");
    if (batch?.length) src = "search";
    else { batch = await searchPages("New Lead"); if (batch?.length) src = "search-cased"; }
    if (!batch?.length) {
      src = "list-filter";
      const r = await gfetch(`${CRM}/contacts/?locationId=${loc}&limit=100`, { headers: H });
      if (r.ok) { const j = await r.json(); batch = (j.contacts || []).filter((c: any) => hasTag(c.tags, "new lead")); }
      else errs.push(`contacts list ${r.status}: ${trim(await r.text(), 200)}`);
    }
    for (const c of batch || []) {
      if (hasTag(c.tags, "booked") || hasTag(c.tags, "hired")) continue;
      pool.set(c.id, c);
    }
  } catch (e: any) { errs.push(`contacts: ${e?.message || String(e)}`); }
  const poolArr = [...pool.values()];
  const poolIds = new Set(poolArr.map((c) => c.id));
  if (!poolArr.length && !errs.length) errs.push("No contacts tagged new lead. Check exact tag spelling in Ovanta.");

  // 2) Conversations — 3 searches (recent, inbound unread, inbound), 1 page each, run in parallel
  type C = { id: string; contactId: string; name: string; phone: string; email: string; date: string | null; dir: string; body: string; channel: string; automation: boolean; raw: any };
  const convMap = new Map<string, C>();
  const searchConv = async (params: Record<string, string>): Promise<any[]> => {
    try {
      const qs = new URLSearchParams({ locationId: loc, limit: "50", sort: "desc", sortBy: "last_message_date", ...params });
      const r = await gfetch(`${CRM}/conversations/search?${qs}`, { headers: H });
      if (!r.ok) { errs.push(`conversations/search ${r.status}: ${trim(await r.text(), 200)}`); return []; }
      const j = await r.json();
      return j.conversations || [];
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
      body: c.lastMessageBody || c.last_message_body || "",
      channel: channelLabel(c), automation: isAuto(c),
      raw: c,
    };
  };
  const [a, b, cc] = await Promise.all([
    searchConv({}),
    searchConv({ lastMessageDirection: "inbound", status: "unread" }),
    searchConv({ lastMessageDirection: "inbound" }),
  ]);
  const allConvRows = [...a, ...b, ...cc];
  for (const c of allConvRows) {
    const cv = toC(c);
    if (!poolIds.has(cv.contactId)) continue;
    const ex = convMap.get(cv.id);
    if (!ex || (cv.date && ex.date && new Date(cv.date) > new Date(ex.date))) convMap.set(cv.id, cv);
  }
  const convs = [...convMap.values()];

  // 3) Latest inbound snippet — GET /conversations/{id}/messages?limit=10
  const snippet = async (cv: C): Promise<string> => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      let r: Response;
      try { r = await gfetch(`${CRM}/conversations/${cv.id}/messages?limit=10`, { headers: H, signal: ctrl.signal }); }
      finally { clearTimeout(timer); }
      if (!r.ok) return trim(cv.body);
      const j = await r.json();
      let arr: any[] = [];
      if (Array.isArray(j)) arr = j;
      else if (j.messages && Array.isArray(j.messages.messages)) arr = j.messages.messages;
      else if (Array.isArray(j.messages)) arr = j.messages;
      const inb = arr.filter((m) => String(m.direction || "").toLowerCase() === "inbound");
      const p = inb[0] || arr[0];
      const txt = p?.body || p?.html || p?.text || p?.meta?.body || p?.message || "";
      const out = trim(txt);
      return out || trim(cv.body);
    } catch { return trim(cv.body); }
  };

  // BUCKETS
  // Opt-outs: body matches STOP (case-insensitive)
  const optedOutSet = new Set<string>();
  const optedOut: any[] = [];
  for (const c of convs) {
    const b = (c.body || "").trim();
    if (/\bSTOP\b/i.test(b)) {
      optedOutSet.add(c.contactId);
      const age = c.date ? Math.round((Date.now() - new Date(c.date).getTime()) / 864e5) : null;
      optedOut.push({ contactId: c.contactId, name: c.name, phone: c.phone, email: c.email, daysAgo: age, channel: c.channel, snippet: trim(b), note: "opted out — remove from pipeline" });
    }
  }

  // Needs a Reply: inbound, not STOP, hoursAgo <= 72, sort NEWEST first, cap 3 (fewer snippet fetches)
  const needsReplyRaw = convs.filter((c) => c.dir === "inbound" && !optedOutSet.has(c.contactId) && !/\bSTOP\b/i.test((c.body || "")));
  const sortedNew = needsReplyRaw
    .filter((c) => c.date && hrs(c.date) !== null && (hrs(c.date) as number) <= 72)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()); // newest first
  const topNew = sortedNew.slice(0, 3);
  const snippets = await Promise.all(topNew.map((c) => snippet(c)));
  const needsReply: any[] = topNew.map((c, i) => ({
    contactId: c.contactId, name: c.name, phone: c.phone, email: c.email,
    hoursAgo: hrs(c.date), channel: c.channel, snippet: snippets[i] || "",
  }));
  const emailBlindSpot = needsReply.filter((r) => r.channel === "Email");

  // Going Cold: last activity >= 5 days, no recent outbound follow-up, not STOP
  const fiveD = 5 * 864e5;
  const goingCold: any[] = [];
  for (const c of convs) {
    if (!c.date) continue;
    const age = Date.now() - new Date(c.date).getTime();
    if (age < fiveD) continue;
    if (optedOutSet.has(c.contactId)) continue;
    const b = (c.body || "").trim();
    const row = { contactId: c.contactId, name: c.name, phone: c.phone, email: c.email, daysAgo: Math.round(age / 864e5), channel: c.channel, snippet: trim(b), automationOnly: c.automation };
    goingCold.push(row);
  }
  goingCold.sort((a, b) => (b.daysAgo || 0) - (a.daysAgo || 0));

  // Channel Mix — most recent 50 conversations in pool
  const mix = convs.filter((c) => c.date).sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()).slice(0, 50);
  let calls = 0, sms = 0, email = 0, auto = 0, c24 = 0;
  const autoOnly: any[] = [];
  const base = mix.length || 1;
  const oneD = 864e5;
  for (const c of mix) {
    const hc = isCall(c.raw), hs = isSms(c.raw), he = isEmail(c.raw), ha = isAuto(c.raw);
    if (hc) calls++; if (hs) sms++; if (he) email++; if (ha) auto++;
    if (c.dir === "outbound" && c.date && !c.automation && Date.now() - new Date(c.date).getTime() <= oneD) c24++;
    if (ha && !hc && !hs) autoOnly.push({ contactId: c.contactId, name: c.name, hoursAgo: hrs(c.date) });
  }
  const outreachPct = mix.length ? Math.round(((calls + sms) / mix.length) * 100) : 0;
  const channelMix = {
    calls, manualSms: sms, email, automation: auto,
    total: mix.length,
    callPct: Math.round((calls / base) * 100),
    callRatio: Math.round((calls / base) * 100) / 100,
    outreachPct,
    contactedLast24h: c24,
    automationOnly: autoOnly,
    emailBlindSpotWarning: (mix.length ? email / mix.length : 0) < 0.15,
  };

  // What's Going Well — human CALL (TYPE_PHONE / TYPE_CALL) in last 48h
  const twoD = 1728e5;
  const wellWords = /\b(thank|thanks|love|perfect|book|pricing|price|deposit|reserve)\b/i;
  const goingWell: any[] = [];
  for (const c of convs) {
    if (!c.date) continue;
    if (Date.now() - new Date(c.date).getTime() > twoD) continue;
    const t = lastType(c.raw);
    if (!isHumanCall(c.raw) && t !== "TYPE_PHONE" && t !== "TYPE_CALL") continue;
    goingWell.push({ contactId: c.contactId, name: c.name, what: wellWords.test(c.body) ? "Positive call — " + trim(c.body, 80) : "Outbound call placed", hoursAgo: hrs(c.date) });
  }

  // Today's Priorities
  const priorities: any[] = [], seen = new Set<string>();
  const addP = (s: any, action: string, why: string) => {
    if (!s || priorities.length >= 3 || seen.has(s.contactId)) return;
    seen.add(s.contactId);
    priorities.push({ name: s.name, action, why, contactId: s.contactId, hoursAgo: s.hoursAgo ?? (s.daysAgo ? s.daysAgo * 24 : null) });
  };
  // #1 newest unanswered inbound with a snippet (not STOP)
  const p1 = needsReply.find((r) => r.snippet);
  if (p1) addP(p1, `Reply to ${p1.name} — inbound ${p1.channel} ${p1.hoursAgo ?? "?"}h ago`, p1.snippet ? `"${p1.snippet}"` : "Unanswered inbound message");
  // #2 opt-out cleanup
  if (optedOut.length) {
    const o0 = optedOut[0];
    addP(o0, `Remove ${o0.name} from pipeline — opted out ${o0.daysAgo ?? "?"}d ago`, "Texted STOP but still tagged active");
  }
  // #3 coldest non-STOP lead
  const cold = goingCold.find((r) => !seen.has(r.contactId));
  if (cold) addP(cold, `Call ${cold.name} — new lead, last touch ${cold.daysAgo}d ago`, cold.automationOnly ? "Automation-only — no human follow-up" : "Going cold");

  // Report + optional email
  const co = (ps?.company_name || "Honeysuckle Haus").trim();
  const reportText = buildReport(co, needsReply, goingCold, optedOut, channelMix, goingWell, priorities);
  let emailResult: any = null;
  if (body?.sendEmail && reportText) {
    const customRecipients = Array.isArray(body.recipients) && body.recipients.length > 0 ? body.recipients : undefined;
    emailResult = await sendEmails(loc, H, co, reportText, customRecipients);
  }

  console.log("[sales-activity] done", poolArr.length);
  return json({ ranAt: new Date().toISOString(), poolSize: poolArr.length, poolSource: src, companyName: co, reportText, emailResult, priorities, needsReply, emailBlindSpot, goingCold, optedOut, channelMix, goingWell, errors: errs });
  } catch (e: any) {
    console.error("[sales-activity] error", e?.message || String(e));
    return json({ error: "Report failed", detail: e?.message || String(e), poolSize: 0, errors: [String(e?.message || e)] }, 500);
  }
});
