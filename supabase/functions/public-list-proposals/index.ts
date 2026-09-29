// public-list-proposals — lets an UNAUTHENTICATED salesperson see the
// proposals THEY built for a specific area, matched by their email.
//
// ONE FILE. No sibling imports.
//
// Gating: if the area's portal_settings.sales_pin is set, the request must
// include a matching `pin`. No pin on the area → open access (still scoped to
// that territory + that salesperson email).
//
// Body:
//   {
//     slug: string,                 // territory slug (required)
//     salespersonEmail: string,     // required — only this person's proposals
//     pin?: string                  // required only if the area has a PIN
//   }
//
// Returns: { success, proposals: [{ id, client_name, wedding_date,
//   total_amount, status, sent_at, expires_at, created_at, link }] }

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

const HONEYSUCKLE_TERRITORY_ID = "0bbaebfc-1c51-4ebe-98b4-e2e9697ef33d";

const HEAL_SQL = `
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS salesperson_email text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS salesperson_name text;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sales_pin text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS app_url text;
NOTIFY pgrst, 'reload schema';
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  let body: any = {};
  try {
    if (req.method === "POST") body = await req.json();
  } catch (_e) {
    return jsonResp({ error: "Invalid JSON body" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ error: "Missing Supabase env" }, 500);
  }

  const db = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${serviceKey}` } },
  });

  try {
    await db.rpc("exec_sql", { sql_text: HEAL_SQL });
  } catch (e: any) {
    console.warn("[public-list-proposals] heal failed (non-fatal):", e?.message);
  }

  const slug = String(body.slug || "").trim().toLowerCase();
  const salespersonEmail = String(body.salespersonEmail || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();

  if (!slug) return jsonResp({ error: "slug is required" }, 400);
  if (!salespersonEmail) return jsonResp({ error: "Your email is required" }, 400);

  // Resolve territory id from slug.
  let territoryId: string | null = null;
  if (slug === "honeysuckle") {
    territoryId = HONEYSUCKLE_TERRITORY_ID;
  } else {
    const { data: terr, error: terrErr } = await db
      .from("territories")
      .select("id")
      .ilike("slug", slug)
      .limit(1)
      .maybeSingle();
    if (terrErr) {
      return jsonResp({ error: "Territory lookup failed", detail: terrErr.message }, 500);
    }
    if (!terr?.id) return jsonResp({ error: "Unknown location" }, 404);
    territoryId = terr.id;
  }

  // Load the area's sales_pin + app_url.
  const { data: settings } = await db
    .from("portal_settings")
    .select("sales_pin, app_url")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();

  const areaPin = (settings?.sales_pin || "").trim();
  if (areaPin && pin !== areaPin) {
    return jsonResp({ error: "Incorrect area PIN" }, 403);
  }

  const appUrl = (settings?.app_url || "").trim();
  const origin = appUrl || new URL(req.url).origin;

  // List this salesperson's proposals for this territory only.
  const { data: rows, error: listErr } = await db
    .from("proposals")
    .select(
      "id, client_name, wedding_date, total_amount, status, sent_at, expires_at, created_at",
    )
    .eq("territory_id", territoryId)
    .ilike("salesperson_email", salespersonEmail)
    .order("created_at", { ascending: false })
    .limit(100);

  if (listErr) {
    return jsonResp({ error: "List failed", detail: listErr.message }, 500);
  }

  const proposals = (rows || []).map((r: any) => ({
    id: r.id,
    client_name: r.client_name,
    wedding_date: r.wedding_date,
    total_amount: Number(r.total_amount) || 0,
    status: r.status,
    sent_at: r.sent_at,
    expires_at: r.expires_at,
    created_at: r.created_at,
    link: `${origin}/proposal/${r.id}`,
  }));

  return jsonResp({ success: true, proposals });
});
