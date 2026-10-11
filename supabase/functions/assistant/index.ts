import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HELP = [
  {
    title: "How to add an event to an existing wedding",
    where: "Weddings → open the wedding → Events",
    text: "Add the extra date (engagement, bartending, sangeet, or another day) on the wedding. Then add the position on that date. Saving an unassigned position posts it like any other open job for that area and region. Training video: How to add an event to an existing wedding.",
  },
  {
    title: "How to build a proposal",
    where: "Proposals",
    text: "Create the proposal, pick the package and add-ons, and send the share link. Do not delete a proposal. Archive it. Archived proposals stay in the Archive tab for that area and can be restored. The client name needs a first and last name. Training video: How to build a proposal in Veydra.",
  },
  {
    title: "How to read the dashboard",
    where: "Home",
    text: "The home dashboard is action items for the area selected in the header. The area picker does not have an All Areas total. Training video: How to read the dashboard in Veydra.",
  },
  {
    title: "Post-production",
    where: "Post Production",
    text: "Rows are sorted with the next date first. A wedding moves from awaiting raw media, to ready to edit, in progress, client review, revisions, then delivered. An extra event that needs an early edit gets its own row. Training video: How to process a wedding post production.",
  },
  {
    title: "Bartending upsell",
    where: "The booked wedding",
    text: "Offer bartending from the booked wedding. It sends its own invoice and adds the bartender job. Training video: Bartending Upsell Tutorial.",
  },
  {
    title: "Area picker and branding",
    where: "Header area picker, then Settings → Branding",
    text: "Each area has its own company name, logo, and Public App URL. Select the area first, then save. The Public App URL box only shows the selected area.",
  },
  {
    title: "Contractor Stripe",
    where: "Settings → Contractor Payout Stripe Secret",
    text: "Select the area, then paste that company's Stripe secret. Contractors in that area connect from their own profile. Until the key is saved, Connect Stripe refuses instead of opening another company's Stripe. Honeysuckle is the only area that still falls back to the shared key.",
  },
  {
    title: "Ovanta connection",
    where: "Settings → Integrations",
    text: "The Ovanta key stays on the server. Test Connection checks the selected area and shows the company and area name. Texts, tags, and applicant sync use that area's key.",
  },
];

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

async function areaSnapshot(db: any, territoryId: string) {
  const [{ data: area }, { data: settings }, { data: weddings }, { data: jobs }] = await Promise.all([
    db.from("territories").select("name").eq("id", territoryId).maybeSingle(),
    db.from("portal_settings").select("company_name").eq("territory_id", territoryId).limit(1).maybeSingle(),
    db.from("weddings").select("client_name, date, status, total_amount, paid_amount, editing_status").eq("territory_id", territoryId).limit(2000),
    db.from("jobs").select("role").eq("territory_id", territoryId).eq("status", "open"),
  ]);
  const rows = weddings || [];
  const booked = rows.filter(isBooked);
  const bookedValue = booked.reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0);
  const collected = booked.reduce((sum: number, row: any) => sum + Number(row.paid_amount || 0), 0);
  const editing = ["ready_to_edit", "in_progress", "revisions_requested", "client_review"];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = booked
    .filter((row: any) => row.date >= today && row.status !== "completed")
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 5)
    .map((row: any) => ({ name: row.client_name, date: row.date, location_status: row.status }));
  return {
    area: area?.name || territoryId,
    company: settings?.company_name || null,
    definitions: {
      booked: "upcoming or completed weddings in this area, excluding drafts and cancelled",
      booked_value: "sum of package total_amount, not the amount collected",
      collected: "sum of paid_amount on those booked weddings",
    },
    booked_count: booked.length,
    booked_value: Math.round(bookedValue * 100) / 100,
    collected: Math.round(collected * 100) / 100,
    still_owed: Math.round(Math.max(0, bookedValue - collected) * 100) / 100,
    open_jobs: (jobs || []).length,
    editing_now: booked.filter((row: any) => editing.includes(row.editing_status)).length,
    awaiting_files: booked.filter((row: any) => !row.editing_status || row.editing_status === "awaiting_raw_media").length,
    next_weddings: upcoming,
  };
}

async function findWedding(db: any, territoryId: string, name: string) {
  const query = name.trim();
  if (query.length < 2) return { matches: [] };
  const { data } = await db
    .from("weddings")
    .select("client_name, date, location, status, total_amount, paid_amount, editing_status, package")
    .eq("territory_id", territoryId)
    .ilike("client_name", `%${query}%`)
    .limit(5);
  return {
    matches: (data || []).map((row: any) => ({
      name: row.client_name,
      date: row.date,
      location: row.location,
      status: row.status,
      package: row.package,
      total: Number(row.total_amount || 0),
      paid: Number(row.paid_amount || 0),
      editing_status: row.editing_status || "awaiting_raw_media",
    })),
  };
}

function findHelp(query: string) {
  const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const ranked = HELP.map((article) => {
    const hay = `${article.title} ${article.where} ${article.text}`.toLowerCase();
    const score = words.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
    return { article, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => row.article);
  return { articles: ranked.length ? ranked : HELP.slice(0, 3) };
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "area_snapshot",
      description: "Counts and money for the selected area only. Use this before stating any number.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "find_wedding",
      description: "Find up to 5 weddings in this area by couple name.",
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
  if (name === "area_snapshot") return areaSnapshot(db, territoryId);
  if (name === "find_wedding") return findWedding(db, territoryId, String(args?.name || ""));
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
        content: `You are the Veydra assistant for ${settings?.company_name || "this company"} in ${area?.name || "the selected area"}. You can only see this area. Never claim to know another area. Never invent a number, a name, or a date. Call area_snapshot before any count or dollar amount, find_wedding before talking about a couple, and help before giving steps. If a tool returns nothing, say you do not know. You cannot change records, send messages, or pay anyone. Tell the person which screen to use instead. Keep the answer short.`,
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
          temperature: 0.2,
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
