import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { ARTICLES } from "./knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function allowedTerritories(db: any, user: any): Promise<Set<string> | "super" | null> {
  const email = String(user?.email || "").toLowerCase();
  if (!email) return null;
  const { data: rows } = await db
    .from("managers")
    .select("role, territory_id, territory_ids, status")
    .ilike("email", email);
  const active = (rows || []).filter((row: any) => !row.status || row.status === "active");
  if (active.some((row: any) => row.role === "super_admin")) return "super";
  const ids = new Set<string>();
  for (const row of active) {
    if (row.territory_id) ids.add(row.territory_id);
    for (const id of row.territory_ids || []) if (id) ids.add(id);
  }
  return ids.size ? ids : null;
}

function isBooked(wedding: any) {
  if (wedding.status === "cancelled" || wedding.status === "draft") return false;
  if (wedding.status === "upcoming" || wedding.status === "completed") return true;
  return Number(wedding.paid_amount) > 0 && wedding.status !== "pending";
}

function dayInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
  };
}

function shiftIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function periodRange(period: string, timeZone: string, from?: string, to?: string) {
  const today = dayInZone(new Date(), timeZone).iso;
  if (period === "custom" && from && to) return { from, to, label: `${from} to ${to}` };
  if (period === "this_month") return { from: today.slice(0, 8) + "01", to: today, label: "this month" };
  if (period === "this_week") {
    const weekday = dayInZone(new Date(), timeZone).weekday;
    const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
    const sinceMonday = index === 0 ? 6 : index - 1;
    return { from: shiftIso(today, -sinceMonday), to: today, label: "this week" };
  }
  return { from: null, to: null, label: "all time" };
}

function isoDay(value: unknown, timeZone: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    if (raw.length > 10) {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) return dayInZone(date, timeZone).iso;
    }
    return raw.slice(0, 10);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return dayInZone(parsed, timeZone).iso;
}

function bookedOn(wedding: any) {
  return String(wedding.contract_signed_at || wedding.created_at || "").slice(0, 10);
}

function summarize(rows: any[]) {
  const value = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const collected = rows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
  return {
    booked_count: rows.length,
    booked_value: Math.round(value * 100) / 100,
    collected: Math.round(collected * 100) / 100,
    still_owed: Math.round(Math.max(0, value - collected) * 100) / 100,
    weddings: rows.slice(0, 12).map((row) => ({
      name: row.client_name,
      wedding_date: row.date,
      booked_on: bookedOn(row),
      total: Number(row.total_amount || 0),
      paid: Number(row.paid_amount || 0),
    })),
  };
}

async function areaSnapshot(db: any, territoryId: string, args: any) {
  const [{ data: area }, { data: settings }, { data: weddings }, { data: jobs }, { data: proposals }] = await Promise.all([
    db.from("territories").select("name").eq("id", territoryId).maybeSingle(),
    db.from("portal_settings").select("company_name, timezone").eq("territory_id", territoryId).limit(1).maybeSingle(),
    db.from("weddings").select("id, client_name, date, status, notes, total_amount, paid_amount, editing_status, created_at, contract_signed_at, contract_date").eq("territory_id", territoryId).limit(2000),
    db.from("jobs").select("role").eq("territory_id", territoryId).eq("status", "open"),
    db.from("proposals").select("client_name, wedding_id, status, total_amount, amount_paid_so_far, contract_signed_at, wedding_date").eq("territory_id", territoryId).limit(2000),
  ]);
  const rows = weddings || [];
  const timeZone = settings?.timezone || "America/New_York";
  const range = periodRange(String(args?.period || "all"), timeZone, args?.from, args?.to);
  const signByWedding = new Map<string, string>();
  for (const proposal of proposals || []) {
    const day = isoDay(proposal.contract_signed_at, timeZone);
    if (proposal.wedding_id && day && !signByWedding.has(proposal.wedding_id)) {
      signByWedding.set(proposal.wedding_id, day);
    }
  }
  const firstPayment = new Map<string, string>();
  const weddingIds = rows.map((row: any) => row.id);
  for (let index = 0; index < weddingIds.length; index += 200) {
    const { data: payments } = await db
      .from("ghl_invoice_payments")
      .select("wedding_id, created_at")
      .in("wedding_id", weddingIds.slice(index, index + 200));
    for (const payment of payments || []) {
      const day = isoDay(payment.created_at, timeZone);
      const previous = firstPayment.get(payment.wedding_id);
      if (day && (!previous || day < previous)) firstPayment.set(payment.wedding_id, day);
    }
  }
  const sales = rows
    .filter((row: any) => {
      if (row.status === "cancelled" || row.status === "draft") return false;
      if (String(row.notes || "").includes("[UNPAID_DRAFT]")) return false;
      return ["pending", "upcoming", "completed"].includes(row.status) || Number(row.paid_amount) > 0;
    })
    .map((row: any) => {
      const day = isoDay(row.contract_date, timeZone) || signByWedding.get(row.id) || firstPayment.get(row.id) || isoDay(row.created_at, timeZone);
      return { ...row, contract_signed_at: day, date: row.date };
    });
  const inRange = range.from ? sales.filter((row: any) => row.contract_signed_at >= range.from && row.contract_signed_at <= range.to) : sales.filter(isBooked);
  const editing = ["ready_to_edit", "in_progress", "revisions_requested", "client_review"];
  const today = dayInZone(new Date(), timeZone).iso;
  return {
    area: area?.name || territoryId,
    company: settings?.company_name || null,
    range: range.label,
    from: range.from,
    to: range.to,
    instruction: range.from
      ? "booked_count is only this range. Name those couples. open_jobs is every open job, not this week, so do not mention it unless they asked."
      : "These numbers are all booked weddings, not a week or a month. Say that they are all-time.",
    definitions: {
      booked: "pending, upcoming, or completed weddings, excluding unpaid drafts",
      booked_on: "contract date, otherwise the proposal signature, otherwise the first payment, otherwise the day the file was created",
      booked_value: "package total, not cash collected",
    },
    ...summarize(inRange),
    open_jobs: (jobs || []).length,
    editing_now: sales.filter((row: any) => editing.includes(row.editing_status)).length,
    next_weddings: sales
      .filter((row: any) => row.date >= today && row.status === "upcoming")
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 5)
      .map((row: any) => ({ name: row.client_name, date: row.date })),
  };
}

async function findWedding(db: any, territoryId: string, name: string) {
  const query = name.trim();
  if (query.length < 2) return { matches: [] };
  const { data } = await db
    .from("weddings")
    .select("id, client_name, date, location, status, total_amount, paid_amount, editing_status, package")
    .eq("territory_id", territoryId)
    .ilike("client_name", `%${query}%`)
    .limit(5);
  const weddings = data || [];
  const ids = weddings.map((row: any) => row.id);
  let jobs: any[] = [];
  let assignments: any[] = [];
  if (ids.length) {
    const { data: jobRows } = await db
      .from("jobs")
      .select("id, wedding_id, role, status, pay_rate")
      .eq("territory_id", territoryId)
      .in("wedding_id", ids);
    jobs = jobRows || [];
    const jobIds = jobs.map((job) => job.id);
    if (jobIds.length) {
      const { data: assignmentRows } = await db
        .from("assignments")
        .select("job_id, status, contractors(first_name, last_name)")
        .in("job_id", jobIds);
      assignments = assignmentRows || [];
    }
  }
  return {
    matches: weddings.map((row: any) => ({
      name: row.client_name,
      date: row.date,
      location: row.location,
      status: row.status,
      package: row.package,
      total: Number(row.total_amount || 0),
      paid: Number(row.paid_amount || 0),
      still_owed: Math.max(0, Number(row.total_amount || 0) - Number(row.paid_amount || 0)),
      editing_status: row.editing_status || "awaiting_raw_media",
      positions: jobs
        .filter((job) => job.wedding_id === row.id)
        .map((job) => {
          const people = assignments
            .filter((assignment) => assignment.job_id === job.id && assignment.status !== "Cancelled")
            .map((assignment) => {
              const person = Array.isArray(assignment.contractors) ? assignment.contractors[0] : assignment.contractors;
              return person ? `${person.first_name || ""} ${person.last_name || ""}`.trim() : "Unnamed";
            });
          return { role: job.role, status: job.status, pay: Number(job.pay_rate || 0), assigned: people };
        }),
    })),
  };
}

function countBy(rows: any[], key: string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const label = String(row[key] || "unknown");
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

async function areaRecords(db: any, territoryId: string, kind: string) {
  if (kind === "open_jobs") {
    const { data: jobs } = await db
      .from("jobs")
      .select("role, pay_rate, wedding_id")
      .eq("territory_id", territoryId)
      .eq("status", "open")
      .limit(40);
    const weddingIds = [...new Set((jobs || []).map((job: any) => job.wedding_id).filter(Boolean))];
    const { data: weddings } = weddingIds.length
      ? await db.from("weddings").select("id, client_name, date").in("id", weddingIds)
      : { data: [] };
    const byId = new Map((weddings || []).map((wedding: any) => [wedding.id, wedding]));
    return {
      kind,
      count: (jobs || []).length,
      jobs: (jobs || []).map((job: any) => ({
        role: job.role,
        pay: Number(job.pay_rate || 0),
        couple: byId.get(job.wedding_id)?.client_name || "Unknown",
        date: byId.get(job.wedding_id)?.date || null,
      })),
    };
  }
  if (kind === "owed") {
    const { data } = await db
      .from("weddings")
      .select("client_name, date, status, total_amount, paid_amount")
      .eq("territory_id", territoryId)
      .limit(2000);
    const owed = (data || [])
      .filter((row: any) => isBooked(row) && Number(row.paid_amount || 0) < Number(row.total_amount || 0))
      .map((row: any) => ({
        name: row.client_name,
        date: row.date,
        total: Number(row.total_amount || 0),
        paid: Number(row.paid_amount || 0),
        still_owed: Math.round((Number(row.total_amount || 0) - Number(row.paid_amount || 0)) * 100) / 100,
      }))
      .sort((a: any, b: any) => b.still_owed - a.still_owed)
      .slice(0, 20);
    return { kind, count: owed.length, weddings: owed };
  }
  if (kind === "proposals") {
    const { data } = await db.from("proposals").select("status").eq("territory_id", territoryId).limit(2000);
    return { kind, by_status: countBy(data || [], "status"), total: (data || []).length };
  }
  if (kind === "crew") {
    const { data } = await db.from("contractors").select("status").eq("territory_id", territoryId).limit(2000);
    return { kind, by_status: countBy(data || [], "status"), total: (data || []).length };
  }
  if (kind === "editing") {
    const { data } = await db
      .from("weddings")
      .select("client_name, date, editing_status")
      .eq("territory_id", territoryId)
      .in("editing_status", ["ready_to_edit", "in_progress", "revisions_requested", "client_review"])
      .limit(30);
    return {
      kind,
      weddings: (data || []).map((row: any) => ({
        name: row.client_name,
        date: row.date,
        editing_status: row.editing_status,
      })),
    };
  }
  return { error: "Unknown record type" };
}

function findHelp(query: string) {
  const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const ranked = ARTICLES.map((article) => {
    const title = article.title.toLowerCase();
    const screen = article.screen.toLowerCase();
    const keys = article.keywords.toLowerCase();
    const steps = article.steps.toLowerCase();
    const score = words.reduce((sum, word) => {
      if (title.includes(word)) return sum + 3;
      if (screen.includes(word) || keys.includes(word)) return sum + 2;
      if (steps.includes(word)) return sum + 1;
      return sum;
    }, 0);
    return { article, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((row) => row.article);
  if (!ranked.length) {
    return {
      note: "No written steps matched. Say you do not have steps for that. Do not guess a screen.",
      topics: ARTICLES.map((article) => article.title),
    };
  }
  return {
    note: "Answer from these steps only. Do not add a button that is not written here.",
    articles: ranked,
  };
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "area_snapshot",
      description: "Money and counts for the selected area. Pass this_week or this_month when the question names a time. Use all only when they ask for everything.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["this_week", "this_month", "all", "custom"] },
          from: { type: "string", description: "YYYY-MM-DD, only with custom" },
          to: { type: "string", description: "YYYY-MM-DD, only with custom" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_wedding",
      description: "One couple in this area: date, money, package, and who is assigned to each position.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "area_records",
      description: "Live rows for this area only. open_jobs lists unfilled positions. owed lists couples who still owe. proposals counts proposals by status. crew counts contractors by status. editing lists films currently being edited.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["open_jobs", "owed", "proposals", "crew", "editing"] },
        },
        required: ["kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "help",
      description: "How to use Veydra. Returns the matching help notes and training videos.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
];

async function runTool(db: any, territoryId: string, name: string, args: any) {
  if (name === "area_snapshot") return areaSnapshot(db, territoryId, args);
  if (name === "find_wedding") return findWedding(db, territoryId, String(args?.name || ""));
  if (name === "area_records") return areaRecords(db, territoryId, String(args?.kind || ""));
  if (name === "help") return findHelp(String(args?.query || ""));
  return { error: "Unknown tool" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("XAI_API_KEY") || "";
    if (!apiKey) {
      return jsonResp({ error: "The assistant is not set up yet. Add the XAI_API_KEY secret in Supabase." }, 503);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const auth = req.headers.get("Authorization") || "";
    if (!supabaseUrl || !anonKey || !serviceKey || !auth) {
      return jsonResp({ error: "Not signed in" }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResp({ error: "Not signed in" }, 401);

    const body = await req.json().catch(() => ({}));
    const territoryId = String(body.territoryId || "");
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!territoryId) return jsonResp({ error: "Pick an area first." }, 400);

    const db = createClient(supabaseUrl, serviceKey);
    const allowed = await allowedTerritories(db, userData.user);
    if (!allowed) return jsonResp({ error: "Not allowed" }, 403);
    if (allowed !== "super" && !allowed.has(territoryId)) {
      return jsonResp({ error: "That area is not one of yours." }, 403);
    }

    const [{ data: area }, { data: settings }] = await Promise.all([
      db.from("territories").select("name").eq("id", territoryId).maybeSingle(),
      db.from("portal_settings").select("company_name").eq("territory_id", territoryId).limit(1).maybeSingle(),
    ]);

    const history = messages
      .filter((message: any) => message && (message.role === "user" || message.role === "assistant"))
      .slice(-8)
      .map((message: any) => ({
        role: message.role,
        content: String(message.content || "").slice(0, 2000),
      }))
      .filter((message: any) => message.content);

    const chat: any[] = [
      {
        role: "system",
        content: `You are the Veydra assistant for ${settings?.company_name || "this company"} in ${area?.name || "the selected area"}. You are a sharp operations manager, not a report. Today is ${new Date().toISOString().slice(0, 10)}. You can only see this area.

Think. After you have the rows, say what they mean: who is uncovered, what is late, what to do next, and how this week compares with a normal week if the rows support it. Talk like a person. A few sentences, not a spreadsheet.

Facts still come from tools. Call help before explaining a screen, and do not invent a button. Call area_snapshot for money, and pass this_week or this_month when they name a period. Call find_wedding or area_records before you name a couple, a contractor, an open job, or a balance. If the tool returns nothing, say so. Never invent a number, a name, or a date.

You cannot change records, send messages, or pay anyone. You can tell them the next click.`,
      },
      ...history,
    ];

    const model = Deno.env.get("ASSISTANT_MODEL") || "grok-3";
    for (let round = 0; round < 3; round++) {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 700,
          messages: chat,
          tools: TOOLS,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = payload?.error?.message || payload?.error || "The assistant could not answer.";
        return jsonResp({ error: String(detail) }, 502);
      }
      const message = payload.choices?.[0]?.message;
      const calls = message?.tool_calls || [];
      if (!calls.length) {
        return jsonResp({
          reply: message?.content || "I could not answer that from this area.",
          area: area?.name || null,
          company: settings?.company_name || null,
        });
      }
      chat.push(message);
      for (const call of calls) {
        let args = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch {
          args = {};
        }
        const result = await runTool(db, territoryId, call.function?.name, args);
        chat.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
    return jsonResp({ reply: "I could not finish that from this area's records." });
  } catch (error: any) {
    return jsonResp({ error: error?.message || "Assistant failed" }, 500);
  }
});
