// sales-activity — builds a Sales Activity report for owner + super_admin only.
//
// ONE FILE. No sibling imports. The territory deployer ships index.ts only.
//
// Pool = CRM contacts tagged "new lead" (case-insensitive).
// EXCLUDE contacts that also have tag "booked" or "hired".
// Pulls conversations + messages from CRM, buckets them, returns JSON.
//
// Auth: requires a logged-in user; only owner / super_admin may run.
// portal_settings: hl_api_key, hl_location_id.
// CRM Version: 2021-07-28.

import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function jsonResp(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CRM_BASE = "https://services.leadconnectorhq.com";
const CRM_VERSION = "2021-07-28";

function hoursAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.round((Date.now() - t) / 36e5);
}

function trimBody(s: string | null | undefined, n = 180): string {
  if (!s) return "";
  const clean = String(s).replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n) + "…" : clean;
}

function hasTag(tags: any, tag: string): boolean {
  if (!tags) return false;
  const needle = tag.toLowerCase();
  const arr = Array.isArray(tags) ? tags : String(tags).split(",");
  return arr.some((t: any) => String(t || "").toLowerCase() === needle);
}

function channelOf(conv: any): string {
  const t = String(conv.lastMessageDataType || conv.type || "").toUpperCase();
  if (t === "TYPE_CALL") return "call";
  if (t === "TYPE_CAMPAIGN_CALL") return "call";
  if (t === "TYPE_SMS") return "sms";
  if (t === "TYPE_EMAIL") return "email";
  if (t === "TYPE_CAMPAIGN_SMS" || t === "TYPE_CAMPAIGN_EMAIL") return "automation";
  return t ? t.toLowerCase() : "other";
}

function isAutomation(conv: any): boolean {
  const t = String(conv.lastMessageDataType || conv.type || "").toUpperCase();
  if (t.startsWith("TYPE_CAMPAIGN")) return true;
  const action = String(conv.lastMessageAction || "").toLowerCase();
  if (action === "automated" || action === "workflow") return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ error: "Missing Supabase env" }, 500);
  }

  const db = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${serviceKey}` } },
  });

  // ── Auth: require a logged-in user; only owner / super_admin ──────────
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResp({ error: "Unauthorized — login required" }, 401);
  }
  let userRole = "";
  try {
    const { data: ud, error: ue } = await db.auth.getUser(token);
    if (ue || !ud?.user) {
      return jsonResp({ error: "Unauthorized — invalid session" }, 401);
    }
    userRole = String(ud.user.user_metadata?.role || ud.user.app_metadata?.role || "").toLowerCase();
  } catch (e: any) {
    return jsonResp({ error: "Unauthorized — " + (e?.message || "session check failed") }, 401);
  }
  if (userRole !== "owner" && userRole !== "super_admin") {
    return jsonResp({ error: "Forbidden — owner or super_admin only" }, 403);
  }

  // ── Load portal settings ─────────────────────────────────────────────
  const settingsCols = "hl_api_key, hl_location_id, app_url";
  let pSettings: any = null;
  const { data: pSettingsFull, error: pSettingsErr } = await db
    .from("portal_settings")
    .select(settingsCols)
    .maybeSingle();
  if (pSettingsErr) {
    const { data: pSettingsMinimal } = await db
      .from("portal_settings")
      .select("hl_api_key, hl_location_id")
      .maybeSingle();
    pSettings = pSettingsMinimal;
  } else {
    pSettings = pSettingsFull;
  }

  const hlApiKey = (pSettings?.hl_api_key || "").trim();
  const hlLocationId = (pSettings?.hl_location_id || "").trim();

  if (!hlApiKey || !hlLocationId) {
    return jsonResp({ error: "Ovanta API key/location not set" }, 422);
  }

  const errors: string[] = [];
  const crmHeaders: Record<string, string> = {
    Authorization: `Bearer ${hlApiKey}`,
    Version: CRM_VERSION,
    "Content-Type": "application/json",
  };

  // ── 1) Contacts tagged "new lead" ────────────────────────────────────
  // Page /contacts with tag filter until we have the new-lead set (cap 500).
  const poolMap = new Map<string, any>(); // contactId -> contact
  try {
    let startAfter = "";
    let hasNext = true;
    let pages = 0;
    while (hasNext && pages < 10 && poolMap.size < 500) {
      pages++;
      let url = `${CRM_BASE}/contacts/?locationId=${hlLocationId}&limit=100&tags=new lead`;
      if (startAfter) url += `&startAfter=${encodeURIComponent(startAfter)}`;
      const res = await fetch(url, { headers: crmHeaders });
      if (!res.ok) {
        errors.push(`contacts fetch ${res.status}: ${trimBody(await res.text(), 200)}`);
        break;
      }
      const json = await res.json();
      const batch: any[] = json.contacts || [];
      if (batch.length === 0) break;
      for (const c of batch) {
        const tags = c.tags || [];
        // Exclude booked / hired.
        if (hasTag(tags, "booked") || hasTag(tags, "hired")) continue;
        poolMap.set(c.id, c);
      }
      if (poolMap.size >= 500) break;
      hasNext = !!json.meta?.nextPageToken;
      startAfter = json.meta?.nextPageToken || "";
    }
  } catch (e: any) {
    errors.push(`contacts: ${e?.message || String(e)}`);
  }

  const pool = Array.from(poolMap.values());
  const poolIds = new Set(pool.map((c) => c.id));

  // ── 2) Conversations ─────────────────────────────────────────────────
  // Search A: most recent 50 (for channel mix + going well)
  // Search B: inbound + unread (for needs-a-reply)
  // Search C: inbound (any) — to catch answered-but-replied-again
  type Conv = {
    id: string;
    contactId: string;
    name: string;
    phone?: string;
    email?: string;
    lastMessageDate: string | null;
    lastMessageDirection: string;
    lastMessageDataType: string;
    lastMessageAction: string;
    lastMessageBody: string;
    unreadCount: number;
    channel: string;
    automation: boolean;
  };

  const convMap = new Map<string, Conv>();

  async function searchConversations(params: Record<string, string>) {
    try {
      const qs = new URLSearchParams({
        locationId: hlLocationId,
        limit: "50",
        sort: "desc",
        sortBy: "last_message_date",
        ...params,
      });
      const res = await fetch(`${CRM_BASE}/conversations/search?${qs}`, {
        headers: crmHeaders,
      });
      if (!res.ok) {
        errors.push(`conversations/search ${res.status}: ${trimBody(await res.text(), 200)}`);
        return [];
      }
      const json = await res.json();
      return (json.conversations || []) as any[];
    } catch (e: any) {
      errors.push(`conversations/search: ${e?.message || String(e)}`);
      return [];
    }
  }

  function toConv(c: any): Conv {
    const contactId = c.contactId || c.contact_id || "";
    const contact = poolMap.get(contactId);
    return {
      id: c.id,
      contactId,
      name: contact?.name || contact?.firstName || c.fullName || contact?.email || "Unknown",
      phone: contact?.phone || c.phone || "",
      email: contact?.email || c.email || "",
      lastMessageDate: c.lastMessageDate || c.last_message_date || null,
      lastMessageDirection: String(c.lastMessageDirection || c.last_message_direction || "").toLowerCase(),
      lastMessageDataType: String(c.lastMessageDataType || c.last_message_data_type || c.type || "").toUpperCase(),
      lastMessageAction: String(c.lastMessageAction || c.last_message_action || "").toLowerCase(),
      lastMessageBody: c.lastMessageBody || c.last_message_body || "",
      unreadCount: Number(c.unreadCount || c.unread_count || 0),
      channel: channelOf(c),
      automation: isAutomation(c),
    };
  }

  // Search A — recent 50
  const recentRaw = await searchConversations({});
  // Search B — inbound unread
  const inboundUnreadRaw = await searchConversations({ lastMessageDirection: "inbound", status: "unread" });
  // Search C — inbound any
  const inboundAnyRaw = await searchConversations({ lastMessageDirection: "inbound" });

  // Merge into one map, keep only conversations whose contact is in the pool.
  for (const c of [...recentRaw, ...inboundUnreadRaw, ...inboundAnyRaw]) {
    const conv = toConv(c);
    if (!poolIds.has(conv.contactId)) continue;
    const existing = convMap.get(conv.id);
    if (!existing || (conv.lastMessageDate && existing.lastMessageDate && new Date(conv.lastMessageDate) > new Date(existing.lastMessageDate))) {
      convMap.set(conv.id, conv);
    }
  }

  const poolConvs = Array.from(convMap.values());

  // ── 3) Latest inbound message snippet for flagged inbound convs ───────
  async function latestInboundSnippet(convId: string): Promise<string> {
    try {
      const res = await fetch(`${CRM_BASE}/conversations/${convId}/messages?limit=5`, {
        headers: crmHeaders,
      });
      if (!res.ok) return "";
      const json = await res.json();
      const msgs = (json.messages || json || []) as any[];
      const arr = Array.isArray(msgs) ? msgs : [];
      const inbound = arr.filter((m) => String(m.direction || m.type || "").toLowerCase().includes("inbound") || String(m.direction || "").toLowerCase() === "inbound");
      const pick = inbound[0] || arr[0];
      return trimBody(pick?.body || pick?.message || pick?.text || "");
    } catch {
      return "";
    }
  }

  // ── BUCKETS ──────────────────────────────────────────────────────────

  // Needs a Reply Right Now: last inbound, in pool, sort oldest first.
  const needsReplyRaw = poolConvs
    .filter((c) => c.lastMessageDirection === "inbound")
    .sort((a, b) => {
      const ta = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
      const tb = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
      return ta - tb; // oldest unanswered first
    });

  // Fetch snippets for needs-reply (cap 30 to limit calls).
  const needsReply: any[] = [];
  for (const c of needsReplyRaw.slice(0, 30)) {
    const snippet = await latestInboundSnippet(c.id);
    needsReply.push({
      contactId: c.contactId,
      name: c.name,
      phone: c.phone,
      email: c.email,
      hoursAgo: hoursAgo(c.lastMessageDate),
      channel: c.channel,
      snippet,
    });
  }

  // Email Blind Spot: subset of needs-reply where lastMessageType is email.
  const emailBlindSpot = needsReply.filter((r) => r.channel === "email");

  // Going Cold: last activity >= 5 days ago AND no manual outbound in window.
  // Also flag STOP opt-outs.
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  const goingCold: any[] = [];
  const optedOut: any[] = [];
  for (const c of poolConvs) {
    if (!c.lastMessageDate) continue;
    const age = Date.now() - new Date(c.lastMessageDate).getTime();
    if (age < fiveDaysMs) continue;
    const body = (c.lastMessageBody || "").trim();
    const stopMatch = /\bSTOP\b/i.test(body);
    const row = {
      contactId: c.contactId,
      name: c.name,
      phone: c.phone,
      email: c.email,
      daysAgo: Math.round(age / (24 * 36e5)),
      channel: c.channel,
      snippet: trimBody(body),
      automationOnly: c.automation,
    };
    if (stopMatch) {
      optedOut.push({ ...row, note: "opted out — remove from pipeline" });
    } else {
      goingCold.push(row);
    }
  }
  goingCold.sort((a, b) => (b.daysAgo || 0) - (a.daysAgo || 0));

  // Channel Mix: most recent 50 conversations in pool.
  const mixBase = poolConvs
    .filter((c) => c.lastMessageDate)
    .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime())
    .slice(0, 50);

  let calls = 0;
  let manualSms = 0;
  let email = 0;
  let automation = 0;
  const automationOnly: any[] = [];
  const humanCallRatioBase = mixBase.length || 1;

  for (const c of mixBase) {
    const t = c.lastMessageDataType;
    if (t === "TYPE_CALL" || t === "TYPE_CAMPAIGN_CALL") {
      calls++;
    } else if (t === "TYPE_SMS" && !c.automation) {
      manualSms++;
    } else if (t === "TYPE_EMAIL") {
      email++;
    }
    if (c.automation || t.startsWith("TYPE_CAMPAIGN")) automation++;

    // Automation-only lead: no human SMS and no call ever in this conv.
    const hasHumanSms = t === "TYPE_SMS" && !c.automation;
    const hasCall = t === "TYPE_CALL" || t === "TYPE_CAMPAIGN_CALL";
    if (!hasHumanSms && !hasCall && (c.automation || t.startsWith("TYPE_CAMPAIGN"))) {
      automationOnly.push({ contactId: c.contactId, name: c.name, hoursAgo: hoursAgo(c.lastMessageDate) });
    }
  }

  const callRatio = Math.round((calls / humanCallRatioBase) * 100) / 100;
  const emailPct = mixBase.length ? email / mixBase.length : 0;
  const emailBlindSpotWarning = emailPct < 0.15;

  const channelMix = {
    calls,
    manualSms,
    email,
    automation,
    callRatio,
    automationOnly,
    emailBlindSpotWarning,
  };

  // What's Going Well: human CALL in last 48h, optional thank/pricing words.
  const twoDaysMs = 48 * 60 * 60 * 1000;
  const wellWords = /\b(thank|thanks|love|perfect|book|pricing|price|deposit|reserve)\b/i;
  const goingWell: any[] = [];
  for (const c of poolConvs) {
    if (!c.lastMessageDate) continue;
    const age = Date.now() - new Date(c.lastMessageDate).getTime();
    if (age > twoDaysMs) continue;
    const t = c.lastMessageDataType;
    const humanCall = (t === "TYPE_CALL") && !c.automation;
    if (!humanCall) continue;
    const body = c.lastMessageBody || "";
    goingWell.push({
      contactId: c.contactId,
      name: c.name,
      what: wellWords.test(body) ? "Positive call — " + trimBody(body, 80) : "Outbound call placed",
      hoursAgo: hoursAgo(c.lastMessageDate),
    });
  }

  // Today's Priorities: 2-3 from this order:
  // 1. Oldest unanswered inbound
  // 2. Unanswered inbound EMAIL (blind spot)
  // 3. Coldest still-active new lead (not STOP)
  const priorities: any[] = [];
  const seen = new Set<string>();

  function addPriority(source: any, action: string, why: string) {
    if (!source || priorities.length >= 3) return;
    if (seen.has(source.contactId)) return;
    seen.add(source.contactId);
    priorities.push({
      name: source.name,
      action,
      why,
      contactId: source.contactId,
      hoursAgo: source.hoursAgo ?? source.daysAgo * 24,
    });
  }

  // 1. Oldest unanswered inbound
  if (needsReply[0]) {
    const r = needsReply[0];
    addPriority(r, `Reply to ${r.name} — inbound ${r.channel} ${r.hoursAgo ?? "?"}h ago`, r.snippet ? `"${r.snippet}"` : "Unanswered inbound message");
  }
  // 2. Unanswered inbound email (blind spot)
  const emailFirst = emailBlindSpot.find((r) => !seen.has(r.contactId));
  if (emailFirst) {
    addPriority(emailFirst, `Email ${emailFirst.name} — unanswered email ${emailFirst.hoursAgo ?? "?"}h ago`, emailFirst.snippet ? `"${emailFirst.snippet}"` : "Hides from SMS inbox");
  }
  // 3. Coldest still-active new lead (not opted out)
  const cold = goingCold.find((r) => !seen.has(r.contactId));
  if (cold) {
    addPriority(cold, `Call ${cold.name} — new lead, last touch ${cold.daysAgo}d ago`, cold.automationOnly ? "Automation-only — no human follow-up" : "Going cold");
  }

  return jsonResp({
    ranAt: new Date().toISOString(),
    poolSize: pool.length,
    priorities,
    needsReply,
    emailBlindSpot,
    goingCold,
    optedOut,
    channelMix,
    goingWell,
    errors,
  });
});
