// sales-activity — Sales Conversation Quality Report (owner/super_admin/manager).
// ONE FILE. Ask AI spec: contains-tag filter, ghost leads, missed calls,
// urgency grading, DND/STOP opt-out, weekend catch-up, channel ratio, wins,
// 13-section email + appendix. range: 1 | 7 | 30.
import { createClient } from "jsr:@supabase/supabase-js";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-email", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const CRM = "https://services.leadconnectorhq.com";
const VER = "2021-07-28";
const gfetch = async (url: string, init?: RequestInit) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000); try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); } };
const hrs = (iso?: string | null): number | null => iso && !isNaN(new Date(iso).getTime()) ? Math.round((Date.now() - new Date(iso).getTime()) / 36e5) : null;
const trim = (s?: string | null, n = 180) => { if (!s) return ""; const c = String(s).replace(/\s+/g, " ").trim(); return c.length > n ? c.slice(0, n) + "…" : c; };
const tagArr = (tags: any): string[] => !tags ? [] : (Array.isArray(tags) ? tags : String(tags).split(","));
const hasTag = (t: any, v: string) => tagArr(t).some((x) => String(x || "").toLowerCase() === v.toLowerCase());
const tagContains = (t: any, v: string) => tagArr(t).some((x) => String(x || "").toLowerCase().includes(v.toLowerCase()));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rptDate = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const rangeLabel = (r: number) => r <= 1 ? "last 24 hours" : `last ${r} days`;

const C_VM = 1, C_CALL = 2, C_SMS = 3, C_EMAIL = 45, C_AUTO = 100;
const CALL_T = new Set(["TYPE_PHONE", "TYPE_CALL", "TYPE_CAMPAIGN_CALL", "TYPE_VOICEMAIL"]);
const lastType = (c: any) => String(c.lastMessageType || c.type || "").toUpperCase();
const mtCodes = (c: any) => { const s = new Set<number>(); const mt = c.messageTypes || c.message_types; if (Array.isArray(mt)) for (const v of mt) s.add(Number(v)); return s; };
const isCall = (c: any) => CALL_T.has(lastType(c)) || c.type === 1 || mtCodes(c).has(C_CALL) || mtCodes(c).has(C_VM);
const isSms = (c: any) => lastType(c) === "TYPE_SMS" || mtCodes(c).has(C_SMS);
const isEmail = (c: any) => ["TYPE_EMAIL", "TYPE_CAMPAIGN_EMAIL"].includes(lastType(c)) || mtCodes(c).has(C_EMAIL);
const isAuto = (c: any) => { const t = lastType(c); if (t.startsWith("TYPE_CAMPAIGN")) return true; const a = String(c.lastMessageAction || "").toLowerCase(); return a === "automated" || a === "workflow"; };
const isHumanCall = (c: any) => isCall(c) && !isAuto(c);
const chLabel = (c: any) => isCall(c) ? "Call" : isSms(c) ? "SMS" : isEmail(c) ? "Email" : isAuto(c) ? "Automation" : "Other";
const chVerb = (c: any) => isCall(c) ? "called" : isEmail(c) ? "emailed" : "texted";
const hasHuman = (c: any) => { const cd = mtCodes(c); const dir = String(c.lastMessageDirection || c.last_message_direction || c.direction || "").toLowerCase(); return dir === "outbound" || cd.has(C_CALL) || cd.has(C_SMS) || cd.has(C_EMAIL) || cd.has(C_VM) || isHumanCall(c) || (isSms(c) && !isAuto(c)) || (isEmail(c) && !isAuto(c)); };

const cfList = (c: any) => { const cf = c.customField || c.customFields || c.custom_fields; return !cf ? [] : (Array.isArray(cf) ? cf : Object.values(cf)); };
const leadSource = (c: any) => { const s = c.source || c.leadSource || c.attributionSource; if (s && typeof s === "object") return String(s.source || s.name || "Unknown"); return s ? String(s) : "Unknown"; };
const estValue = (c: any) => { for (const f of cfList(c)) { const n = String((f as any)?.name || "").toLowerCase(); if (n.match(/value|budget|price|deal/)) { const v = Number(String((f as any)?.value || "").replace(/[^0-9.]/g, "")); if (v > 0) return v; } } return null; };
const addedAt = (c: any): number | null => { const d = c.dateAdded || c.date_added || c.createdAt; return d && !isNaN(new Date(d).getTime()) ? new Date(d).getTime() : null; };
const daysSince = (c: any) => { const m = addedAt(c); return m != null ? Math.round((Date.now() - m) / 864e5) : null; };
const isOptedOut = (c: any) => c.dnd === true || hasTag(c.tags, "stop bot") || tagContains(c.tags, "opted out") || tagContains(c.tags, "unsubscribed");

// CHANGE 7 — iMessage reaction detector
const isReaction = (body: string): boolean =>
  /^(❤️|👍|😂|‼️|\?|Liked|Loved|Laughed at|Emphasized|Questioned|Disliked) ".+"$/i.test((body || "").trim());

const INTENT = /\b(price|pricing|cost|how much|book|booking|deposit|reserve|available|availability|next step|schedule|saturday|sunday|friday|weekend)\b/i;
const LOST = /\b(found something else|already booked|went with|chose another|not interested|cancel|refund)\b/i;
const grade = (wh: number | null, s: string, multi: boolean): "Critical" | "High" | "Medium" | "Low" => {
  if ((wh != null && wh >= 24) || LOST.test(s) || /\bSTOP\b/i.test(s) || multi) return "Critical";
  if ((wh != null && wh >= 8) || INTENT.test(s)) return "High";
  if (wh != null && wh >= 2) return "Medium";
  return "Low";
};

type C = { id: string; contactId: string; name: string; phone: string; email: string; date: string | null; dir: string; body: string; channel: string; automation: boolean; raw: any };
type Stage = "new" | "contacted" | "engaged" | "proposal_sent" | "booked";
const classify = (ct: any, cv: C | undefined): Stage => hasTag(ct.tags, "booked") ? "booked" : (hasTag(ct.tags, "proposal sent") || hasTag(ct.tags, "proposal_sent")) ? "proposal_sent" : !cv ? "new" : cv.dir === "inbound" ? "engaged" : cv.dir === "outbound" ? "contacted" : "new";

function buildText(co: string, s: any, range: number): string {
  const L: string[] = [`🌸 ${co} Daily Sales Report — ${rptDate()}`, `Window: ${rangeLabel(range)}`, "", `Active Unbooked Leads: ${s.poolSize} (${s.windowNewLeadsCount} new in window)`, ""];
  L.push("🚨 Needs a Reply Right Now");
  if (!s.needsReply.length) L.push("Inbox is clear. No unanswered new-lead messages.");
  else for (const r of s.needsReply.slice(0, 8)) L.push(`[${r.grade}] ${r.name} ${chVerb(r)} ${r.hoursAgo ?? "?"}h ago: ${r.snippet ? `"${r.snippet}"` : "(no body)"}`);
  L.push("", "👻 Ghost Leads — No First Touch");
  if (!s.ghostLeads.length) L.push("All new leads (24h) received a human touch. ✅");
  else {
    if (s.ghostRootCauseNote) L.push(s.ghostRootCauseNote);
    L.push(`${s.ghostLeads.length} lead(s) 24h+ with no human contact:`);
    s.ghostLeads.slice(0, 6).forEach((r: any) => L.push(`- ${r.name} — ${r.daysAgo ?? "?"}d ago, ${r.source}`));
  }
  L.push("", "📞 Missed Inbound Calls");
  if (!s.missedCalls.length) L.push("No missed inbound calls.");
  else s.missedCalls.slice(0, 6).forEach((r: any) => L.push(`- ${r.name} — ${r.hoursAgo ?? "?"}h${r.followedUp ? " (followed up)" : " (NO follow-up)"}`));
  L.push("", "⚠️ Going Cold / Pipeline Cleanup");
  if (range === 1 && s.goingCold.length > 0) {
    L.push("(Note: cold leads reflect full pipeline — any lead silent 5+ days, not just last 24h)");
  }
  if (s.optedOut.length) { L.push(`${s.optedOut.length} opt-out(s) still active:`); s.optedOut.slice(0, 6).forEach((r: any) => L.push(`- ${r.name} — ${r.signal} ~${r.daysAgo ?? "?"}d`)); } else L.push("No opt-outs lingering.");
  if (s.coldPatternNote) L.push(s.coldPatternNote);
  if (s.goingCold.length >= 50) {
    L.push(`${s.goingCold.length} total cold leads — showing breakdown by age bracket.`);
    const b1 = s.goingCold.filter((c: any) => c.daysAgo >= 5 && c.daysAgo <= 30);
    const b2 = s.goingCold.filter((c: any) => c.daysAgo >= 31 && c.daysAgo <= 90);
    const b3 = s.goingCold.filter((c: any) => c.daysAgo > 90);
    L.push(`- 5–30 days: ${b1.length} leads — Re-engage now with a personalized follow-up.`);
    L.push(`- 31–90 days: ${b2.length} leads — Run a reactivation campaign.`);
    L.push(`- 90+ days: ${b3.length} leads — Archive review recommended.`);
    s.goingCold.slice(0, 7).forEach((r: any) => L.push(`- ${r.name} — ${r.daysAgo}d cold.`));
  } else {
    if (s.goingCold[0] && !s.optedOut.some((o: any) => o.contactId === s.goingCold[0].contactId)) L.push(`${s.goingCold[0].name} — ${s.goingCold[0].daysAgo}d cold.`);
  }
  L.push("", "🤖 Automation-Only Leads");
  if (!s.automationOnly.length) L.push("No pure automation-only leads. ✅");
  else s.automationOnly.slice(0, 6).forEach((r: any) => L.push(`- ${r.name} — ${r.hoursAgo ?? "?"}h`));
  // CHANGE 2 — always render Section 9
  L.push("", "📅 Weekend Catch-Up (Monday)");
  if (s.weekendCatchUp == null) L.push("Not applicable — this section runs on Mondays only.");
  else if (s.weekendCatchUp.length) s.weekendCatchUp.slice(0, 5).forEach((r: any) => L.push(`- ${r.name} — ${r.hoursAgo ?? "?"}h wait`));
  else L.push("All weekend leads contacted promptly. ✅");
  const cm = s.channelMix, t = cm.total || 1;
  L.push("", "📊 Channel Mix", `- Calls: ${cm.calls} (${Math.round(cm.calls / t * 100)}%)`, `- SMS: ${cm.manualSms} (${Math.round(cm.manualSms / t * 100)}%)`, `- Email: ${cm.email} (${Math.round(cm.email / t * 100)}%)`, `- Automation: ${cm.automation} (${Math.round(cm.automation / t * 100)}%)`);
  L.push("", "✅ What's Going Well");
  if (!s.goingWell.length) L.push(`No wins in ${rangeLabel(range)}.`);
  else s.goingWell.slice(0, 5).forEach((r: any) => L.push(`- ${r.name} — ${r.what}`));
  L.push("", "🎯 Today's 3 Priorities");
  if (!s.priorities.length) L.push("No urgent items — call a cold lead.");
  else s.priorities.forEach((p: any, i: number) => L.push(`${i + 1}. ${p.action}${p.why ? ` — ${p.why}` : ""}`));
  L.push("", `${co} | Automated Daily Sales Report | ${new Date().toLocaleString()}`);
  let out = L.join("\n");
  return out.length > 4500 ? out.slice(0, 4500) : out;
}

function buildHtml(co: string, s: any, range: number): string {
  const gc: Record<string, string> = { Critical: "#e74c3c", High: "#e67e22", Medium: "#f1c40f", Low: "#95a5a6" };
  const gt: Record<string, string> = { Critical: "#fff", High: "#fff", Medium: "#333", Low: "#fff" };
  const badge = (g: string) => `<span style="background:${gc[g]};color:${gt[g]};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">${g}</span>`;
  const td = (c: string) => `<td style="padding:6px 8px;border:1px solid #eee;font-size:13px;">${c}</td>`;
  const tr = (cells: string[]) => `<tr>${cells.map(td).join("")}</tr>`;
  const tbl = (h: string[], b: string) => `<table style="width:100%;border-collapse:collapse;margin:8px 0 16px;">${tr(h.map((x) => `<b>${x}</b>`))}${b}</table>`;
  const sec = (t: string, b: string) => `<h2 style="font-size:16px;color:#1a2340;margin:20px 0 6px;border-bottom:2px solid #eee;padding-bottom:4px;">${t}</h2><div style="font-size:13px;line-height:1.6;color:#444;">${b}</div>`;
  const p: string[] = [];
  p.push(`<div style="background:#1a2340;color:#fff;padding:20px;border-radius:8px 8px 0 0;"><h1 style="margin:0;font-size:20px;">🌸 ${esc(co)} Daily Sales Conversation Quality Report</h1><p style="margin:6px 0 0;font-size:13px;opacity:.9;">${rptDate()} · ${rangeLabel(range)} · new lead, excluding booked/hired</p></div><div style="padding:16px 20px;font-family:Arial,sans-serif;">`);
  const flagged = s.needsReply.length + s.ghostLeads.length + s.missedCalls.length + s.goingCold.length + s.optedOut.length;
  const criticalCount =
    s.needsReply.filter((r: any) => r.grade === "Critical").length +
    s.ghostLeads.length;
  // CHANGE 4 — add response performance tiles + health interpretation
  const tiles = [
    `Leads: ${s.poolSize}`,
    `Flagged: ${flagged}`,
    `Critical: ${criticalCount}`,
    `Ghost leads: ${s.ghostLeads.length}`,
    `Call coverage: ${s.channelMix.callPct}%`,
    `Avg reply: ${s.responsePerformance?.avgHours ?? "—"}h`,
    `SLA breaches: ${s.responsePerformance?.slaBreaches ?? 0}`
  ];
  const replyOnlyCritical = s.needsReply.filter((r: any) => r.grade === "Critical").length;
  let healthStart = "Pipeline is in good shape —";
  if (replyOnlyCritical > 0) healthStart = "Urgent attention needed —";
  else if (s.ghostLeads.length > 3) healthStart = "Pipeline has a first-touch gap —";
  else if (s.goingCold.length > 10) healthStart = "Pipeline health is moderate —";
  const healthSentence = `${healthStart} ${replyOnlyCritical} critical reply${replyOnlyCritical !== 1 ? "s" : ""}, ${s.ghostLeads.length} ghost lead${s.ghostLeads.length !== 1 ? "s" : ""}, ${s.goingCold.length} cold lead${s.goingCold.length !== 1 ? "s" : ""} in the active pool.`;
  p.push(sec("Executive Summary", `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">${tiles.map((x) => `<div style="background:#f5f6f8;padding:8px 12px;border-radius:6px;font-size:13px;"><b>${x}</b></div>`).join("")}</div><p style="font-style:italic;color:#444;">${esc(healthSentence)}</p><p>${s.poolSize} active unbooked leads (${s.windowNewLeadsCount} new in window). ${flagged} flagged.</p>`));
  p.push(sec("🚨 Leads Waiting for a Reply", s.needsReply.length ? tbl(["Contact", "Wait", "Grade", "Message", "Action"], s.needsReply.slice(0, 12).map((r: any) => tr([esc(r.name), `${r.hoursAgo ?? "?"}h`, badge(r.grade), esc(r.snippet || "(no body)"), `Reply via ${r.channel}`])).join("")) : `<p style="color:#27ae60;">✅ Inbox is clear.</p>`));
  // CHANGE 8 — ghost lead root-cause note
  let ghostBody = "";
  if (s.ghostRootCauseNote) ghostBody += `<div style="background:#fff3cd;border:1px solid #ffeaa7;padding:10px;border-radius:6px;margin-bottom:8px;">${esc(s.ghostRootCauseNote)}</div>`;
  ghostBody += s.ghostLeads.length ? `<div style="background:#fff3cd;border:1px solid #ffeaa7;padding:10px;border-radius:6px;margin-bottom:8px;">${s.ghostLeads.length} lead(s) 24h+ with no human touch.</div>` + tbl(["Contact", "Created", "Source"], s.ghostLeads.slice(0, 8).map((r: any) => tr([esc(r.name), `${r.daysAgo ?? "?"}d`, esc(r.source)])).join("")) : `<p style="color:#27ae60;">✅ All new leads (24h) received a human touch.</p>`;
  p.push(sec("👻 Brand New Leads — No First Touch", ghostBody));
  p.push(sec("📞 Missed Inbound Calls", s.missedCalls.length ? tbl(["Contact", "When", "Follow-up?"], s.missedCalls.slice(0, 8).map((r: any) => tr([esc(r.name), `${r.hoursAgo ?? "?"}h`, r.followedUp ? "Yes" : "<b style='color:#e74c3c;'>No</b>"])).join("")) : `<p>No missed inbound calls.</p>`));
  // CHANGE 5 + 6 — cold pattern note + segmentation
  let cold = "";
  if (range === 1 && s.goingCold.length > 0) {
    cold += `<p style="font-size:12px;color:#666;font-style:italic;margin-bottom:8px;">Note: Cold leads reflect your full active pipeline, not just the last 24 hours — any lead with 5+ days of silence appears here regardless of report window.</p>`;
  }
  if (s.optedOut.length) cold += `<div style="background:#fdecea;border:1px solid #f5b7b1;padding:10px;border-radius:6px;margin-bottom:8px;"><b>⚠️ Compliance:</b> ${s.optedOut.length} opt-out(s) still active.</div>` + tbl(["Contact", "Signal", "Age"], s.optedOut.slice(0, 8).map((r: any) => tr([esc(r.name), esc(r.signal), `${r.daysAgo ?? "?"}d`])).join(""));
  if (s.coldPatternNote) cold += `<div style="background:#fff3cd;border:1px solid #ffeaa7;padding:10px;border-radius:6px;margin-bottom:8px;">${esc(s.coldPatternNote)}</div>`;
  if (s.goingCold.length >= 50) {
    const b1 = s.goingCold.filter((c: any) => c.daysAgo >= 5 && c.daysAgo <= 30);
    const b2 = s.goingCold.filter((c: any) => c.daysAgo >= 31 && c.daysAgo <= 90);
    const b3 = s.goingCold.filter((c: any) => c.daysAgo > 90);
    cold += `<p><b>${s.goingCold.length} total cold leads — showing breakdown by age bracket.</b></p>` + tbl(["Age Bracket", "Count", "Action"], [tr(["5–30 days", String(b1.length), "Re-engage now with a personalized follow-up."]), tr(["31–90 days", String(b2.length), "Run a reactivation campaign."]), tr(["90+ days", String(b3.length), "Archive review recommended."])].join("")) + tbl(["Contact", "Days Cold", "Last"], s.goingCold.slice(0, 7).map((r: any) => tr([esc(r.name), `${r.daysAgo}d`, esc(r.channel)])).join(""));
  } else if (s.goingCold.length) {
    cold += tbl(["Contact", "Days Cold", "Last"], s.goingCold.slice(0, 8).map((r: any) => tr([esc(r.name), `${r.daysAgo}d`, esc(r.channel)])).join(""));
  }
  p.push(sec("⚠️ Going Cold / Pipeline Cleanup", cold || `<p>No cold leads or opt-outs.</p>`));
  p.push(sec("🤖 Automation-Only Leads", s.automationOnly.length ? tbl(["Contact", "Last"], s.automationOnly.slice(0, 8).map((r: any) => tr([esc(r.name), `${r.hoursAgo ?? "?"}h`])).join("")) : `<p style="color:#27ae60;">✅ No pure automation-only leads.</p>`));
  // CHANGE 2 — always render Section 9
  let weekendBody = "";
  if (s.weekendCatchUp == null) weekendBody = `<p style="color:#999;font-style:italic;">Not applicable — this section runs on Mondays only.</p>`;
  else if (s.weekendCatchUp.length) weekendBody = tbl(["Contact", "Wait"], s.weekendCatchUp.slice(0, 6).map((r: any) => tr([esc(r.name), `${r.hoursAgo ?? "?"}h`])).join(""));
  else weekendBody = `<p style="color:#27ae60;">✅ All weekend leads contacted promptly.</p>`;
  p.push(sec("📅 Weekend Catch-Up (Monday)", weekendBody));
  const cm = s.channelMix, t = cm.total || 1;
  p.push(sec("📊 Channel Ratio", tbl(["Channel", "Count", "%"], [tr(["Calls", String(cm.calls), `${Math.round(cm.calls / t * 100)}%`]), tr(["SMS", String(cm.manualSms), `${Math.round(cm.manualSms / t * 100)}%`]), tr(["Email", String(cm.email), `${Math.round(cm.email / t * 100)}%`]), tr(["Automation", String(cm.automation), `${Math.round(cm.automation / t * 100)}%`])].join(""))));
  // CHANGE 3 — expanded wins
  p.push(sec("✅ Wins", s.goingWell.length ? `<ul>${s.goingWell.slice(0, 5).map((r: any) => `<li><b>${esc(r.name)}</b> — ${esc(r.what)}${r.hoursAgo != null ? ` (${r.hoursAgo}h)` : ""}</li>`).join("")}</ul>` : `<p>No wins in ${rangeLabel(range)}.</p>`));
  p.push(sec("🎯 Top 3 Priorities", s.priorities.length ? `<ol>${s.priorities.map((x: any) => `<li><b>${esc(x.action)}</b>${x.why ? ` — ${esc(x.why)}` : ""}</li>`).join("")}</ol>` : `<p>No urgent items.</p>`));
  // CHANGE 9 — group large cohorts in appendix
  const all: any[] = [];
  s.needsReply.forEach((r: any) => all.push({ n: r.name, t: "Waiting", g: r.grade, l: `${r.hoursAgo ?? "?"}h`, a: `Reply via ${r.channel}` }));
  s.ghostLeads.forEach((r: any) => all.push({ n: r.name, t: "Ghost", g: "Critical", l: `${r.daysAgo ?? "?"}d`, a: "First touch" }));
  s.missedCalls.forEach((r: any) => all.push({ n: r.name, t: "Missed call", g: r.followedUp ? "Medium" : "High", l: `${r.hoursAgo ?? "?"}h`, a: "Callback" }));
  if (s.goingCold.length > 10) {
    all.push({ n: `${s.goingCold.length} cold leads`, t: "Cold (grouped)", g: "Medium", l: "varies", a: "See Section 6 for full list" });
  } else {
    s.goingCold.forEach((r: any) => all.push({ n: r.name, t: "Cold", g: "Medium", l: `${r.daysAgo}d`, a: "Re-engage" }));
  }
  if (s.optedOut.length > 5) {
    all.push({ n: `${s.optedOut.length} opt-outs`, t: "Opt-out (grouped)", g: "Critical", l: "varies", a: "Remove from pipeline" });
  } else {
    s.optedOut.forEach((r: any) => all.push({ n: r.name, t: "Opt-out", g: "Critical", l: `${r.daysAgo ?? "?"}d`, a: "Remove" }));
  }
  const seen = new Set<string>(); const dedup = all.filter((r) => { if (seen.has(r.n)) return false; seen.add(r.n); return true; });
  p.push(sec("📋 Appendix: All Flagged Leads", dedup.length ? tbl(["Contact", "Flag", "Grade", "Last", "Action"], dedup.slice(0, 30).map((r) => tr([esc(r.n), r.t, badge(r.g), r.l, esc(r.a)])).join("")) : `<p>No flagged leads.</p>`));
  p.push(`<p style="text-align:center;font-size:11px;color:#999;margin-top:20px;">${esc(co)} | Automated Daily Sales Report | ${new Date().toLocaleString()}</p></div>`);
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f4;">${p.join("")}</body></html>`;
}

async function findOrCreate(email: string, loc: string, h: Record<string, string>, name?: string): Promise<{ id: string | null; error?: string }> {
  const e = (email || "").trim().toLowerCase();
  if (!e) return { id: null, error: "Empty email" };
  const tf = async (u: string, i?: RequestInit) => { try { const r = await gfetch(u, i); if (!r.ok) return null; const j = await r.json(); return j.contacts?.[0]?.id || j.contact?.id || j.id || null; } catch { return null; } };
  let id = await tf(`${CRM}/contacts/search`, { method: "POST", headers: h, body: JSON.stringify({ locationId: loc, page: 1, pageLimit: 10, filters: [{ field: "email", operator: "eq", value: e }] }) });
  if (id) return { id };
  id = await tf(`${CRM}/contacts/?locationId=${loc}&query=${encodeURIComponent(e)}`, { headers: h });
  if (id) return { id };
  try {
    const parts = (name || e.split("@")[0] || "Team Member").trim().split(" ");
    const r = await gfetch(`${CRM}/contacts/`, { method: "POST", headers: h, body: JSON.stringify({ locationId: loc, email: e, firstName: parts[0] || "Team", lastName: parts.slice(1).join(" ") || "Member", tags: ["portal-auto-created", "staff"] }) });
    const c = await r.text();
    if (r.ok) { try { const j = JSON.parse(c); const cid = j.contact?.id || j.id; if (cid) return { id: cid }; } catch {} }
    return { id: null, error: `Create failed (${r.status}): ${c.slice(0, 150)}` };
  } catch (e2: any) { return { id: null, error: e2?.message || String(e2) }; }
}

async function sendEmails(loc: string, h: Record<string, string>, co: string, txt: string, html: string, recips?: Array<{ email: string; name?: string }>): Promise<any> {
  const def = [{ email: "mark.t.watson83@gmail.com", name: "Mark Watson" }, { email: "gosocialonline@gmail.com", name: "Nik Krohn" }];
  const list = recips?.length ? recips : def;
  const subj = `🌸 ${co} Daily Sales Conversation Quality Report — ${rptDate()}`;
  const out: any[] = [];
  for (const it of list) {
    const e = (it.email || "").trim().toLowerCase();
    if (!e) continue;
    try {
      const { id: cid, error: cErr } = await findOrCreate(e, loc, h, it.name);
      if (!cid) { out.push({ email: e, status: "contact_not_found", error: cErr }); continue; }
      const payload: any = { type: "Email", locationId: loc, contactId: cid, emailTo: e, to: [e], subject: subj, html, message: txt };
      let r = await gfetch(`${CRM}/conversations/messages`, { method: "POST", headers: h, body: JSON.stringify(payload) });
      let rb = trim(await r.text(), 300);
      if (!r.ok) { const retry = await gfetch(`${CRM}/conversations/messages`, { method: "POST", headers: h, body: JSON.stringify({ type: "Email", locationId: loc, contactId: cid, subject: subj, html, message: txt }) }); if (retry.ok) { r = retry; rb = trim(await retry.text(), 300); } else rb = `${rb} | ${trim(await retry.text(), 300)}`; }
      out.push({ email: e, contactId: cid, status: r.ok ? "sent" : "failed", code: r.status, body: rb, error: !r.ok ? rb : undefined });
    } catch (e2: any) { out.push({ email: e, status: "error", error: e2?.message || String(e2) }); }
  }
  return { subject: subj, recipients: out };
}

async function storeRun(db: any, s: any) { try { await db.from("sales_activity_runs").insert({ ran_at: s.ranAt, range: s.range, pool_size: s.poolSize, needs_reply_count: s.needsReply?.length || 0, going_cold_count: s.goingColdTotal || 0, opted_out_count: s.optedOut?.length || 0, avg_response_hours: s.responsePerformance?.avgHours || null, sla_breaches: s.responsePerformance?.slaBreaches || 0, funnel: s.funnel || null, channel_mix: s.channelMix || null, priorities: s.priorities || null, report_text: s.reportText || null, triggered_by: s.triggeredBy || "manual" }); } catch (e: any) { console.warn("[sales-activity] storeRun:", e?.message); } }
async function fetchHistory(db: any, limit = 30): Promise<any[]> { try { const { data, error } = await db.from("sales_activity_runs").select("ran_at, range, pool_size, needs_reply_count, going_cold_count, opted_out_count, avg_response_hours, sla_breaches, funnel, channel_mix").order("ran_at", { ascending: false }).limit(limit); if (error) return []; return data || []; } catch { return []; } }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  console.log("[sales-activity] start");
  let body: any = {};
  try { if (req.method === "POST") body = await req.json().catch(() => ({})); } catch { body = {}; }
  const url = Deno.env.get("SUPABASE_URL") || "", sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", ak = Deno.env.get("SUPABASE_ANON_KEY") || sk;
  if (!url || !sk) return json({ error: "Missing Supabase env" }, 500);
  const db = createClient(url, sk, { global: { headers: { Authorization: `Bearer ${sk}` } } });
  try {
  const range = [1, 7, 30].includes(Number(body?.range)) ? Number(body.range) : 1;
  const rangeMs = range * 864e5, rangeStart = Date.now() - rangeMs, coldMs = Math.max(rangeMs, 5 * 864e5), now = Date.now();

  // Auth
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const callerEmail = (body?.callerEmail || req.headers.get("x-user-email") || "").trim().toLowerCase();
  let uid = "", uemail = "";
  if (tok && tok !== ak) { const udb = createClient(url, ak); try { const { data: ud } = await udb.auth.getUser(tok); if (ud?.user) { uid = ud.user.id; uemail = (ud.user.email || "").trim().toLowerCase(); } else { try { const parts = tok.split("."); if (parts.length === 3) { const raw = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))); if (raw.email) uemail = String(raw.email).trim().toLowerCase(); if (raw.sub) uid = String(raw.sub); } } catch {} } } catch {} }
  if (!uemail && callerEmail) uemail = callerEmail;
  if (!uemail && !uid) return json({ error: "Unauthorized — invalid session", tokenLen: tok.length, tokenPrefix: tok ? tok.slice(0, 8) : "none" }, 401);
  let mgr: any = null;
  if (uemail) { const { data } = await db.from("managers").select("id, email, role, status").ilike("email", uemail).maybeSingle(); mgr = data; }
  if (!mgr && uid && /^[0-9a-f-]{36}$/i.test(uid)) { try { const { data } = await db.from("managers").select("id, email, role, status").eq("id", uid).maybeSingle(); mgr = data; } catch {} }
  const role = String(mgr?.role || "").toLowerCase().trim();
  if (!["owner", "owner_readonly", "super_admin", "manager"].includes(role)) return json({ error: "Forbidden — owner, super_admin, or manager only", email: uemail, userId: uid, managerRowFound: !!mgr, roleFound: role || null }, 403);

  let ps: any = null;
  const { data: psFull, error: psErr } = await db.from("portal_settings").select("hl_api_key, hl_location_id, app_url, company_name").maybeSingle();
  if (psErr) { const { data: m } = await db.from("portal_settings").select("hl_api_key, hl_location_id, company_name").maybeSingle(); ps = m; } else ps = psFull;
  const key = (ps?.hl_api_key || "").trim(), loc = (ps?.hl_location_id || "").trim();
  if (!key || !loc) return json({ error: "Ovanta API key/location not set" }, 422);
  const errs: string[] = [];
  const H: Record<string, string> = { Authorization: `Bearer ${key}`, Version: VER, "Content-Type": "application/json" };

  // 1) Contacts: contains "new lead", NOT contains booked/hired (single AND group)
  const pool = new Map<string, any>();
  let src: "search-contains" | "search-cased" | "list-filter" = "list-filter";
  try {
    const sc = async (val: string): Promise<any[] | null> => {
      const all: any[] = [];
      for (let p = 1; p <= 3; p++) {
        const r = await gfetch(`${CRM}/contacts/search`, { method: "POST", headers: H, body: JSON.stringify({ locationId: loc, page: p, pageLimit: 100, filters: [{ group: "AND", filters: [{ field: "tags", operator: "contains", value: val }, { field: "tags", operator: "not_contains", value: "booked" }, { field: "tags", operator: "not_contains", value: "hired" }] }] }) });
        if (!r.ok) { if (p === 1) errs.push(`contacts/search ${val} ${r.status}: ${trim(await r.text(), 200)}`); break; }
        const cs = (await r.json()).contacts || []; all.push(...cs); if (cs.length < 100) break;
      }
      return all.length ? all : null;
    };
    let batch = await sc("new lead");
    if (batch?.length) src = "search-contains"; else { batch = await sc("New Lead"); if (batch?.length) src = "search-cased"; }
    if (!batch?.length) {
      src = "list-filter"; batch = [];
      for (let p = 1; p <= 5; p++) { const r = await gfetch(`${CRM}/contacts/?locationId=${loc}&limit=100&page=${p}`, { headers: H }); if (!r.ok) { if (p === 1) errs.push(`contacts list ${r.status}: ${trim(await r.text(), 200)}`); break; } const cs = (await r.json()).contacts || []; if (!cs.length) break; for (const c of cs) { if (!tagContains(c.tags, "new lead") || tagContains(c.tags, "booked") || tagContains(c.tags, "hired")) continue; batch.push(c); } if (cs.length < 100) break; }
    }
    for (const c of batch) { if (tagContains(c.tags, "booked") || tagContains(c.tags, "hired")) continue; pool.set(c.id, c); }
  } catch (e: any) { errs.push(`contacts: ${e?.message || String(e)}`); }
  const poolArr = [...pool.values()], poolIds = new Set(poolArr.map((c) => c.id));
  if (!poolArr.length && !errs.length) errs.push("No contacts tagged new lead. Check exact tag spelling in Ovanta.");

  // 2) Conversations: recent + oldest + unread + inbound (multi-page to ensure active leads aren't missed)
  const convMap = new Map<string, C>();
  const searchConv = async (params: Record<string, string>, pages = 1): Promise<any[]> => {
    try {
      const all: any[] = [];
      let lastDate: string | null = null;
      for (let p = 0; p < pages; p++) {
        const qParams: Record<string, string> = { locationId: loc, limit: "100", ...params };
        if (lastDate) qParams.startAfterDate = lastDate;
        const qs = new URLSearchParams(qParams);
        const r = await gfetch(`${CRM}/conversations/search?${qs}`, { headers: H });
        if (!r.ok) {
          if (p === 0) errs.push(`conversations/search ${r.status}: ${trim(await r.text(), 200)}`);
          break;
        }
        const batch = (await r.json()).conversations || [];
        all.push(...batch);
        if (batch.length < 100) break;
        const last = batch[batch.length - 1];
        lastDate = last?.lastMessageDate || last?.last_message_date || null;
        if (!lastDate) break;
      }
      return all;
    } catch (e: any) {
      errs.push(`conversations/search: ${e?.message}`);
      return [];
    }
  };
  const toC = (c: any): C => {
    const cid = c.contactId || c.contact_id || "";
    const ct = pool.get(cid);
    return {
      id: c.id,
      contactId: cid,
      name: ct?.name || ct?.firstName || c.fullName || ct?.email || "Unknown",
      phone: ct?.phone || c.phone || "",
      email: ct?.email || c.email || "",
      date: c.lastMessageDate || c.last_message_date || null,
      dir: String(c.lastMessageDirection || c.last_message_direction || "").toLowerCase(),
      body: c.lastMessageBody || c.last_message_body || "",
      channel: chLabel(c),
      automation: isAuto(c),
      raw: c
    };
  };
  // Fetch up to 200 recent conversations and 100 for each targeted query in parallel
  const [recent, oldest, unread, inbound] = await Promise.all([
    searchConv({ sort: "desc" }, 2),
    searchConv({ sort: "asc" }, 1),
    searchConv({ lastMessageDirection: "inbound", status: "unread" }, 1),
    searchConv({ lastMessageDirection: "inbound" }, 1)
  ]);
  for (const c of [...recent, ...oldest, ...unread, ...inbound]) {
    const cv = toC(c);
    const ex = convMap.get(cv.id);
    if (!ex || (cv.date && ex.date && new Date(cv.date) > new Date(ex.date))) convMap.set(cv.id, cv);
  }
  const allConvs = [...convMap.values()];
  const convs = allConvs.filter((c) => poolIds.has(c.contactId));
  const contactConvMap = new Map<string, C>();
  for (const cv of allConvs) {
    if (!cv.contactId) continue;
    const ex = contactConvMap.get(cv.contactId);
    if (!ex || (cv.date && ex.date && new Date(cv.date) > new Date(ex.date))) contactConvMap.set(cv.contactId, cv);
  }
  const inRange = convs.filter((c) => c.date && new Date(c.date).getTime() >= rangeStart);

  // 3) Snippet + reply time + multi-unanswered
  const snipAndReply = async (cv: C): Promise<{ snippet: string; replyHours: number | null; multi: boolean }> => {
    try { const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 5000); let r: Response; try { r = await gfetch(`${CRM}/conversations/${cv.id}/messages?limit=10`, { headers: H, signal: ctrl.signal }); } finally { clearTimeout(timer); } if (!r.ok) return { snippet: trim(cv.body), replyHours: null, multi: false }; const j = await r.json(); let arr: any[] = Array.isArray(j) ? j : (j.messages?.messages || j.messages || []); arr.sort((x, y) => new Date(y.dateAdded || y.date_added || y.createdAt || 0).getTime() - new Date(x.dateAdded || x.date_added || x.createdAt || 0).getTime()); const inb = arr.filter((m) => String(m.direction || "").toLowerCase() === "inbound"); const outb = arr.filter((m) => String(m.direction || "").toLowerCase() === "outbound"); const p = inb[0] || arr[0]; const snip = trim(p?.body || p?.html || p?.text || p?.meta?.body || p?.message || "") || trim(cv.body); let rh: number | null = null, multi = false; if (inb.length > 0) { const it = new Date(inb[0].dateAdded || inb[0].date_added || inb[0].createdAt || 0).getTime(); if (it) { const rep = outb.find((m) => new Date(m.dateAdded || m.date_added || m.createdAt || 0).getTime() > it); if (rep) rh = Math.round((new Date(rep.dateAdded || rep.date_added || rep.createdAt || 0).getTime() - it) / 36e5); } if (inb.length >= 2) { const it2 = new Date(inb[1].dateAdded || inb[1].date_added || inb[1].createdAt || 0).getTime(); if (!outb.some((m) => new Date(m.dateAdded || m.date_added || m.createdAt || 0).getTime() > it2)) multi = true; } } return { snippet: snip, replyHours: rh, multi }; } catch { return { snippet: trim(cv.body), replyHours: null, multi: false }; }
  };

  // Opt-outs (DND + STOP + tags)
  const optedOutSet = new Set<string>(), optedOut: any[] = [];
  for (const ct of poolArr) {
    const cv = contactConvMap.get(ct.id);
    const dnd = isOptedOut(ct);
    const stop = cv && /\bSTOP\b/i.test((cv.body || "").trim());
    if (dnd || stop) {
      optedOutSet.add(ct.id);
      const ctAt = addedAt(ct);
      const ctDays = ctAt != null ? Math.round((now - ctAt) / 864e5) : null;
      const cvDays = cv?.date ? Math.round((now - new Date(cv.date).getTime()) / 864e5) : null;
      optedOut.push({
        contactId: ct.id,
        name: ct.name || ct.firstName || ct.email || "Unknown",
        phone: ct.phone || "",
        email: ct.email || "",
        daysAgo: cvDays ?? ctDays ?? null,
        signal: stop ? "STOP text" : "DND flag",
        channel: cv?.channel || "",
        snippet: stop ? trim(cv?.body) : "",
        note: "opted out — remove from pipeline"
      });
    }
  }

  // Needs a Reply
  const needsReplyRaw = inRange.filter((c) => c.dir === "inbound" && !optedOutSet.has(c.contactId) && !/\bSTOP\b/i.test((c.body || "")));
  const sortedNew = needsReplyRaw.sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());
  const topNew = sortedNew.slice(0, 10);
  const snipRes = await Promise.all(topNew.slice(0, 6).map((c) => snipAndReply(c)));
  const sMap = new Map<string, string>(), rMap = new Map<string, number | null>(), mMap = new Map<string, boolean>();
  topNew.slice(0, 6).forEach((c, i) => { sMap.set(c.id, snipRes[i]?.snippet || ""); rMap.set(c.id, snipRes[i]?.replyHours ?? null); mMap.set(c.id, snipRes[i]?.multi ?? false); });
  const needsReply: any[] = topNew.map((c) => {
    const wh = hrs(c.date);
    let snip = sMap.get(c.id) || trim(c.body);
    let g = grade(wh, snip, mMap.get(c.id) ?? false);
    // CHANGE 7 — iMessage reaction: downgrade to Low + label
    if (isReaction(snip)) { g = "Low"; snip = `${snip} [iMessage reaction]`; }
    return { contactId: c.contactId, name: c.name, phone: c.phone, email: c.email, hoursAgo: wh, channel: c.channel, snippet: snip, replyHours: rMap.get(c.id) ?? null, grade: g, multiUnanswered: mMap.get(c.id) ?? false };
  });
  const gOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  needsReply.sort((a, b) => (gOrder[a.grade] - gOrder[b.grade]) || ((b.hoursAgo || 0) - (a.hoursAgo || 0)));

  // Ghost leads: ANY lead created 24h+ ago with NO human contact
  // Uses conversation history across all loaded conversations + searches specific conversations if needed
  const ghostLeads: any[] = [];
  for (const ct of poolArr) {
    const at = addedAt(ct);
    if (at == null) continue;
    const ageH = (now - at) / 36e5;
    if (ageH < 24) continue;
    const cv = contactConvMap.get(ct.id);
    if (cv && (hasHuman(cv.raw) || cv.dir === "outbound")) continue;
    ghostLeads.push({ contactId: ct.id, name: ct.name || ct.firstName || ct.email || "Unknown", phone: ct.phone || "", email: ct.email || "", daysAgo: Math.round(ageH / 24), source: leadSource(ct), dateAdded: new Date(at).toISOString() });
  }
  ghostLeads.sort((a, b) => (b.daysAgo || 0) - (a.daysAgo || 0));

  // CHANGE 8 — Ghost lead root-cause note
  let ghostRootCauseNote = "";
  if (ghostLeads.length >= 4) {
    const ages = ghostLeads.map((g) => g.daysAgo).filter(Boolean) as number[];
    const spread = Math.max(...ages) - Math.min(...ages);
    if (spread > 7) {
      ghostRootCauseNote = `Pattern detected: ghost leads span ${spread} days. This suggests a persistent workflow enrollment failure — new leads may not be triggering your automation sequence.`;
    } else {
      ghostRootCauseNote = `${ghostLeads.length} leads in a ${spread}-day window had no human touch. Check for a recent intake or assignment gap.`;
    }
  }

  // Missed calls — inbound call/voicemail, no later human response
  const missedCalls: any[] = [];
  for (const c of inRange) { const cd = mtCodes(c.raw); if (!(cd.has(C_CALL) || cd.has(C_VM) || CALL_T.has(lastType(c.raw))) || c.dir !== "inbound" || optedOutSet.has(c.contactId)) continue; const followedUp = needsReply.some((r) => r.contactId === c.contactId && r.replyHours != null); missedCalls.push({ contactId: c.contactId, name: c.name, phone: c.phone, email: c.email, hoursAgo: hrs(c.date), followedUp, snippet: trim(c.body) }); }
  missedCalls.sort((a, b) => (a.hoursAgo || 0) - (b.hoursAgo || 0));

  // Response performance
  const allRT: number[] = needsReply.map((r) => r.replyHours).filter((v): v is number => v != null && v >= 0);
  const sla = 4, slaB = needsReply.filter((r) => (r.replyHours != null && r.replyHours > sla) || (r.replyHours == null && r.hoursAgo != null && (r.hoursAgo as number) > sla)).length;
  const avgH = allRT.length ? Math.round(allRT.reduce((a, b) => a + b, 0) / allRT.length) : null;
  let slowN: string | null = null, slowH: number | null = null;
  for (const r of needsReply) if (r.replyHours != null && (slowH == null || r.replyHours > slowH)) { slowH = r.replyHours; slowN = r.name; }
  const responsePerformance = { count: allRT.length, avgHours: avgH, slaBreaches: slaB, slaThresholdHours: sla, slowestName: slowN, slowestHours: slowH };

  // Going cold — 5+ days, has human touch, not opted out
  const goingCold: any[] = [];
  for (const c of convs) { if (!c.date) continue; const age = now - new Date(c.date).getTime(); if (age < coldMs || optedOutSet.has(c.contactId) || !hasHuman(c.raw)) continue; goingCold.push({ contactId: c.contactId, name: c.name, phone: c.phone, email: c.email, daysAgo: Math.round(age / 864e5), channel: c.channel, snippet: trim(c.body), automationOnly: c.automation }); }
  goingCold.sort((a, b) => (b.daysAgo || 0) - (a.daysAgo || 0));
  const goingColdCapped = goingCold.slice(0, 20);

  // CHANGE 5 — Cold pattern analysis note
  let coldPatternNote = "";
  if (goingCold.length > 3) {
    const coldDays = goingCold.map((c) => c.daysAgo).filter(Boolean) as number[];
    const coldMin = Math.min(...coldDays), coldMax = Math.max(...coldDays);
    const coldSpread = coldMax - coldMin;
    if (coldSpread <= 3) {
      coldPatternNote = `⚠️ Most leads went cold within a ${coldSpread}-day window — possible batch dropout. Check workflow trigger timing.`;
    } else if (coldSpread > 30) {
      coldPatternNote = `📉 Cold leads span ${coldSpread} days — rolling attrition. Review the follow-up cadence after the first touch.`;
    }
  }

  // Lead intel + funnel
  const leadIntel: any[] = poolArr.map((ct) => { const cv = contactConvMap.get(ct.id); const at = addedAt(ct); return { contactId: ct.id, name: ct.name || ct.firstName || ct.email || "Unknown", phone: ct.phone || "", email: ct.email || "", source: leadSource(ct), weddingDate: null, estimatedValue: estValue(ct), daysSinceFirstContact: daysSince(ct), stage: classify(ct, cv), lastActivityDate: cv?.date || null, lastChannel: cv?.channel || null, hoursAgo: cv ? hrs(cv.date) : null, dateAdded: at ? new Date(at).toISOString() : null, isNewInWindow: at != null && at >= rangeStart, dnd: isOptedOut(ct) }; });
  leadIntel.sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0));
  const windowNewLeads = leadIntel.filter((li) => li.isNewInWindow);
  const fc = { new: 0, contacted: 0, engaged: 0, proposal_sent: 0, booked: 0 };
  for (const li of leadIntel) fc[li.stage as keyof typeof fc]++;
  const funnel = { ...fc, total: leadIntel.length, windowNewLeadsCount: windowNewLeads.length };

  // Channel mix
  const mix = inRange.slice().sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());
  let calls = 0, sms = 0, email = 0, auto = 0, cRange = 0, outreach = 0;
  const autoOnly: any[] = [];
  const base = mix.length || 1;
  for (const c of mix) { const cd = mtCodes(c.raw); const hc = isCall(c.raw), hs = isSms(c.raw), he = isEmail(c.raw), ha = isAuto(c.raw); if (cd.has(C_CALL) || hc) calls++; if (cd.has(C_SMS) || hs) sms++; if (cd.has(C_EMAIL) || he) email++; if (cd.has(C_AUTO) || ha) auto++; if ((hc || hs) && !ha) outreach++; if (c.dir === "outbound" && c.date && !c.automation && now - new Date(c.date).getTime() <= rangeMs) cRange++; if ((cd.has(C_AUTO) || ha) && !cd.has(C_CALL) && !cd.has(C_SMS) && !hc && !hs) autoOnly.push({ contactId: c.contactId, name: c.name, hoursAgo: hrs(c.date) }); }
  const channelMix = { calls, manualSms: sms, email, automation: auto, total: mix.length, callPct: Math.round((calls / base) * 100), callRatio: Math.round((calls / base) * 100) / 100, outreachPct: mix.length ? Math.min(100, Math.round((outreach / mix.length) * 100)) : 0, contactedInRange: cRange, contactedLast24h: cRange, automationOnly: autoOnly, emailBlindSpotWarning: (mix.length ? email / mix.length : 0) < 0.15 };

  // Weekend catch-up (Mondays only) — check leads created THIS past Sat/Sun
  let weekendCatchUp: any[] | null = null;
  const dow = new Date().toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long" });
  if (dow === "Monday") {
    weekendCatchUp = [];
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value || "2026";
    const m = parts.find((p) => p.type === "month")?.value || "01";
    const d = parts.find((p) => p.type === "day")?.value || "01";
    const monMidnight = new Date(`${y}-${m}-${d}T00:00:00-04:00`).getTime();
    const satStartMs = monMidnight - (48 * 3600 * 1000);
    const sunEndMs = monMidnight - 1;
    for (const li of leadIntel) {
      if (!li.dateAdded) continue;
      const t = new Date(li.dateAdded).getTime();
      if (t < satStartMs || t > sunEndMs) continue;
      // If contact is opted-out (STOP/DND), they do not belong in weekend catch-up
      if (optedOutSet.has(li.contactId)) continue;
      const cv = contactConvMap.get(li.contactId);
      const raw = cv?.raw || {};
      const cdCodes = mtCodes(raw);
      const isOutboundMsg = cv?.dir === "outbound";
      const hasHumanTouch = cv ? (
        isOutboundMsg ||
        cdCodes.has(C_CALL) ||
        cdCodes.has(C_SMS) ||
        cdCodes.has(C_EMAIL) ||
        cdCodes.has(C_VM) ||
        hasHuman(raw)
      ) : false;
      if (hasHumanTouch) continue;
      const cd = new Date(t);
      const waitH = Math.round((now - t) / 36e5);
      if (waitH >= 6) {
        weekendCatchUp.push({
          contactId: li.contactId,
          name: li.name,
          hoursAgo: waitH,
          createdDay: cd.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long" })
        });
      }
    }
  }

  // CHANGE 3 — Expanded Wins (5 categories, dedup by contactId, cap 5)
  const wellWords = /\b(thank|thanks|love it|perfect|sounds good|let's do it|ready to book)\b/i;
  const pricingWords = /\b(price|pricing|cost|deposit|quote|package|rate)\b/i;
  const goingWell: any[] = [];
  const winSeen = new Set<string>();
  const coldContactIds = new Set(goingCold.map((c) => c.contactId));
  const addWin = (contactId: string, name: string, what: string, hoursAgo?: number | null) => {
    if (goingWell.length >= 5 || winSeen.has(contactId)) return;
    winSeen.add(contactId);
    goingWell.push({ contactId, name, what, hoursAgo: hoursAgo ?? null });
  };
  // 1. Fast first response — contacted within 2h of dateAdded (MUST be within selected report window)
  for (const ct of poolArr) {
    const at = addedAt(ct);
    if (at == null) continue;
    const cv = contactConvMap.get(ct.id);
    if (!cv || !cv.date) continue;
    const touchTime = new Date(cv.date).getTime();
    if (touchTime < rangeStart) continue; // Only count wins that happened in the selected window!
    const firstTouchH = (touchTime - at) / 36e5;
    if (firstTouchH >= 0 && firstTouchH <= 2 && (hasHuman(cv.raw) || cv.dir === "outbound")) {
      addWin(ct.id, ct.name || ct.firstName || ct.email || "Unknown", `First touch within ${Math.round(firstTouchH)}h of inquiry.`, hrs(cv.date));
    }
  }
  // 2. Pricing/deposit delivered — outbound body matches pricing words
  for (const c of inRange) {
    if (c.dir !== "outbound" || !pricingWords.test(c.body || "")) continue;
    addWin(c.contactId, c.name, "Pricing info sent.", hrs(c.date));
  }
  // 3. Positive reply received — inbound body matches positive words
  for (const c of inRange) {
    if (c.dir !== "inbound" || !wellWords.test(c.body || "")) continue;
    addWin(c.contactId, c.name, "Lead responded positively.", hrs(c.date));
  }
  // 4. Re-engaged cold lead — was in goingCold AND now has conversation in current window
  for (const c of inRange) {
    if (!coldContactIds.has(c.contactId)) continue;
    const coldEntry = goingCold.find((g) => g.contactId === c.contactId);
    if (coldEntry) addWin(c.contactId, c.name, `Re-engaged after ${coldEntry.daysAgo}d of silence.`, hrs(c.date));
  }
  // 5. Multi-touch outreach — contact has both a call AND an SMS in the current window
  const multiTouchMap = new Map<string, { name: string; hasCall: boolean; hasSms: boolean; date: string | null }>();
  for (const c of inRange) {
    const ex = multiTouchMap.get(c.contactId);
    const hasCall = isCall(c.raw), hasSms = isSms(c.raw);
    if (!ex) multiTouchMap.set(c.contactId, { name: c.name, hasCall, hasSms, date: c.date });
    else { if (hasCall) ex.hasCall = true; if (hasSms) ex.hasSms = true; }
  }
  for (const [cid, info] of multiTouchMap) {
    if (info.hasCall && info.hasSms) addWin(cid, info.name, "Multi-channel outreach completed (call + text).", hrs(info.date));
  }

  // Priorities — Smart, fresh, actionable (no 140d zombie leads, no "?d")
  const priorities: any[] = [], seen = new Set<string>();
  const addP = (contactId: string, name: string, action: string, why: string, hoursAgo?: number | null) => {
    if (priorities.length >= 3 || seen.has(contactId)) return;
    seen.add(contactId);
    priorities.push({ name, action, why, contactId, hoursAgo: hoursAgo ?? null });
  };

  // 1. Unreturned missed calls in the window (most urgent immediate phone response)
  const urgentMissed = missedCalls.find((m) => !m.followedUp && (m.hoursAgo == null || m.hoursAgo <= 48));
  if (urgentMissed) {
    addP(urgentMissed.contactId, urgentMissed.name, `Call back ${urgentMissed.name} — missed inbound call ${urgentMissed.hoursAgo ?? "?"}h ago`, "Inbound call with no follow-up");
  }

  // 2. Urgent inbound replies (Critical first, then High, then any unanswered within 72h)
  for (const nr of needsReply) {
    if (priorities.length >= 3) break;
    if (seen.has(nr.contactId)) continue;
    if (nr.hoursAgo != null && nr.hoursAgo > 72) continue; // skip stale
    const actionLabel = `Reply to ${nr.name} (${nr.channel}) — waiting ${nr.hoursAgo ?? "?"}h`;
    const whyDetail = nr.snippet ? `"${trim(nr.snippet, 60)}"` : (nr.grade === "Critical" ? "Critical unanswered" : "Unanswered inquiry");
    addP(nr.contactId, nr.name, actionLabel, whyDetail, nr.hoursAgo);
  }

  // 3. Weekend catch-up (if Monday and leads are waiting)
  if (weekendCatchUp && weekendCatchUp.length > 0) {
    for (const w of weekendCatchUp) {
      if (priorities.length >= 3) break;
      if (seen.has(w.contactId) || optedOutSet.has(w.contactId)) continue;
      addP(w.contactId, w.name, `First touch for ${w.name} — ${w.createdDay || "weekend"} lead (${w.hoursAgo}h wait)`, "Weekend inquiry awaiting human touch");
    }
  }

  // 4. Compliance risk: STOP opt-outs still active (prioritize before cold leads)
  const stopOpt = optedOut.find((o) => !seen.has(o.contactId) && (o.signal?.includes("STOP") || o.snippet?.toUpperCase().includes("STOP")));
  if (stopOpt && priorities.length < 3) {
    const timeStr = stopOpt.daysAgo != null ? `~${stopOpt.daysAgo}d ago` : "recently";
    addP(stopOpt.contactId, stopOpt.name, `Remove ${stopOpt.name} from pipeline — texted STOP ${timeStr}`, "Compliance / TCPA risk");
  }

  // 5. Fresh ghost leads (created recently in last 24-72h, NOT 100+ days ago)
  const freshGhost = ghostLeads.find((g) => (g.daysAgo == null || g.daysAgo <= 7) && !seen.has(g.contactId) && !optedOutSet.has(g.contactId));
  if (freshGhost && priorities.length < 3) {
    const ageStr = freshGhost.daysAgo != null ? `${freshGhost.daysAgo}d old` : "24h+";
    addP(freshGhost.contactId, freshGhost.name, `Call ${freshGhost.name} — new lead (${ageStr}), no human touch`, `Source: ${freshGhost.source || "inquiry"}`);
  }

  // 6. High-value warm lead slipping (5-21 days old, NOT 100+ days)
  const freshHvc = leadIntel.find((li) => li.stage !== "booked" && li.daysSinceFirstContact && li.daysSinceFirstContact >= 5 && li.daysSinceFirstContact <= 21 && (li.estimatedValue || 0) > 0 && !seen.has(li.contactId));
  if (freshHvc && priorities.length < 3) {
    addP(freshHvc.contactId, freshHvc.name, `Call ${freshHvc.name} — $${freshHvc.estimatedValue} inquiry from ${freshHvc.daysSinceFirstContact}d ago`, "High-value slipping");
  }

  // 7. Recent cold lead (went silent 5-14 days ago — actionable re-engagement, NOT 140d dead leads)
  const recentCold = goingCold.filter((c) => c.daysAgo >= 5 && c.daysAgo <= 14).sort((a, b) => a.daysAgo - b.daysAgo).find((r) => !seen.has(r.contactId));
  if (recentCold && priorities.length < 3) {
    addP(recentCold.contactId, recentCold.name, `Follow up with ${recentCold.name} — quiet for ${recentCold.daysAgo}d after ${recentCold.channel}`, recentCold.automationOnly ? "Automation-only touch" : "Warm re-engagement");
  }

  // 8. If still need a priority, grab the freshest unbooked lead without recent touch
  if (priorities.length < 3) {
    const fallbackLead = leadIntel.find((li) =>
      li.stage !== "booked" &&
      li.daysSinceFirstContact != null &&
      li.daysSinceFirstContact >= 2 &&
      li.daysSinceFirstContact <= 30 &&
      !seen.has(li.contactId) &&
      !winSeen.has(li.contactId)
    );
    if (fallbackLead) {
      addP(fallbackLead.contactId, fallbackLead.name, `Check in on ${fallbackLead.name} (${fallbackLead.stage})`, `Inquired ${fallbackLead.daysSinceFirstContact}d ago via ${fallbackLead.source}`);
    }
  }

  const co = (ps?.company_name || "Honeysuckle Haus").trim();
  const summary = { ranAt: new Date().toISOString(), range, rangeLabel: rangeLabel(range), poolSize: poolArr.length, windowNewLeadsCount: windowNewLeads.length, poolSource: src, companyName: co, needsReply, ghostLeads: ghostLeads.slice(0, 20), ghostRootCauseNote, missedCalls: missedCalls.slice(0, 15), goingCold: goingColdCapped, goingColdTotal: goingCold.length, coldPatternNote, optedOut, automationOnly: autoOnly.slice(0, 15), weekendCatchUp, channelMix, goingWell, responsePerformance, funnel, leadIntel, priorities, errors: errs };
  const reportText = buildText(co, summary, range);
  const htmlReport = buildHtml(co, summary, range);
  let emailResult: any = null;
  if (body?.sendEmail && reportText) { const recips = Array.isArray(body.recipients) && body.recipients.length > 0 ? body.recipients : undefined; emailResult = await sendEmails(loc, H, co, reportText, htmlReport, recips); }
  const history = body?.includeHistory ? await fetchHistory(db, 30) : [];
  const result = { ...summary, reportText, htmlReport, emailResult, history, triggeredBy: body?.triggeredBy || "manual" };
  await storeRun(db, result);
  console.log("[sales-activity] done", poolArr.length, "range", range);
  return json(result);
  } catch (e: any) { console.error("[sales-activity] error", e?.message || String(e)); return json({ error: "Report failed", detail: e?.message || String(e), poolSize: 0, errors: [String(e?.message || e)] }, 500); }
});
