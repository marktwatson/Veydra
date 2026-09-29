// public-create-proposal — lets an UNAUTHENTICATED salesperson build a
// proposal for a specific area (territory slug) and save it to the DB.
//
// ONE FILE. No sibling imports. The territory deployer ships index.ts only.
//
// Why a service-role function (not a public RLS policy):
//   proposals RLS is scoped per-tenant (proposals_tenant). An anon user has no
//   territory, so anon insert is blocked. Rather than open a public write
//   surface on the proposals table, this function uses the service role key to
//   insert exactly one row, stamping territory_id resolved from the slug. It
//   never exposes the service key to the browser and writes only the fields a
//   salesperson controls.
//
// Body:
//   {
//     slug: string,            // territory slug (required)
//     salespersonName?: string, // optional, for audit
//     salespersonEmail?: string,// optional, for audit
//     proposal: { ...CreateProposal payload fields... }
//   }
//
// Returns: { success, proposalId, link, territoryId }
//   link = `${app_url || origin}/proposal/${id}`
//
// Does NOT send the proposal (no email/SMS/timer). Sending is a separate,
// gated action that calls the existing send-proposal function.

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

// Self-heal the columns this function touches so a stale Sync still works.
// Run each statement individually so one failure doesn't abort the rest.
const HEAL_STATEMENTS = [
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS territory_id UUID",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS custom_payment_plan JSONB",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS custom_prices JSONB",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS custom_contract_snapshot TEXT",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS salesperson_email text",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS salesperson_name text",
  "ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS slug text",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS territory_id UUID",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sales_pin text",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS app_url text",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS wedding_contract_template text",
  "NOTIFY pgrst, 'reload schema'",
];

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ error: "Missing Supabase env" }, 500);
  }

  const db = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${serviceKey}` } },
  });

  // Heal columns first (non-fatal). Run each statement individually.
  let healOk = true;
  for (const stmt of HEAL_STATEMENTS) {
    try {
      await db.rpc("exec_sql", { sql_text: stmt });
    } catch (e: any) {
      healOk = false;
      console.warn(
        "[public-create-proposal] heal stmt failed (non-fatal):",
        stmt,
        e?.message,
      );
    }
  }
  if (!healOk) {
    console.warn(
      "[public-create-proposal] one or more heal statements failed; insert may fail if a column is missing",
    );
  }

  const slug = String(body.slug || "").trim().toLowerCase();
  if (!slug) {
    return jsonResp({ error: "slug is required" }, 400);
  }

  // Resolve the territory id from the slug (case-insensitive). "honeysuckle"
  // always maps to the Honeysuckle pipeline.
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
      return jsonResp(
        { error: "Territory lookup failed", detail: terrErr.message },
        500,
      );
    }
    if (!terr?.id) {
      return jsonResp({ error: "Unknown location" }, 404);
    }
    territoryId = terr.id;
  }

  // Load the area's portal_settings for app_url + contract template snapshot.
  const { data: settings } = await db
    .from("portal_settings")
    .select("app_url, wedding_contract_template")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();

  const p = body.proposal || {};
  const salespersonName = String(body.salespersonName || "").trim();
  const salespersonEmail = String(body.salespersonEmail || "").trim();

  // Validate the minimum a salesperson must provide.
  const required = [
    "client_name",
    "client_email",
    "client_phone",
    "wedding_date",
    "city",
    "state",
  ];
  for (const k of required) {
    if (!p[k] || String(p[k]).trim() === "") {
      return jsonResp({ error: `Missing field: ${k}` }, 400);
    }
  }
  if (!p.package_id && !(Array.isArray(p.custom_items) && p.custom_items.length)) {
    return jsonResp(
      { error: "A package or at least one custom item is required" },
      400,
    );
  }

  const payload: Record<string, any> = {
    client_name: p.client_name,
    client_email: p.client_email,
    client_phone: p.client_phone,
    partner_name: p.partner_name || null,
    wedding_date: p.wedding_date,
    is_lgbtq: !!p.is_lgbtq,
    venue: p.venue || null,
    venue_address: p.venue_address || null,
    city: p.city,
    state: p.state,
    coverage_type: p.coverage_type || "both",
    package_id: p.package_id || null,
    addons: Array.isArray(p.addons) ? p.addons : [],
    second_shooter_hours: p.second_shooter_hours ?? 3,
    second_shooter_type: p.second_shooter_type || "photo",
    total_amount: Number(p.total_amount) || 0,
    notes: p.notes || null,
    custom_prices: {
      discount: p.custom_discount || 0,
      discountType: p.custom_discount_type || "fixed",
      items: Array.isArray(p.custom_items) ? p.custom_items : [],
    },
    custom_payment_plan:
      p.custom_payment_plan && p.custom_payment_plan.enabled
        ? {
            enabled: true,
            deposit: p.custom_payment_plan.deposit,
            installments: Array.isArray(p.custom_payment_plan.installments)
              ? p.custom_payment_plan.installments
              : [],
          }
        : { enabled: false, deposit: 0, installments: [] },
    status: "draft",
    territory_id: territoryId,
    salesperson_name: salespersonName || null,
    salesperson_email: salespersonEmail || null,
  };

  // Stamp the contract template snapshot if the area has one.
  if (settings?.wedding_contract_template) {
    payload.custom_contract_snapshot = settings.wedding_contract_template;
  }

  // Record who built it (audit only — no auth required).
  if (salespersonName || salespersonEmail) {
    payload.notes = [
      payload.notes || "",
      `[Built by ${salespersonName || "salesperson"}${salespersonEmail ? ` <${salespersonEmail}>` : ""} via public builder]`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const { data: inserted, error: insErr } = await db
    .from("proposals")
    .insert([payload])
    .select("id")
    .single();

  if (insErr) {
    return jsonResp(
      { error: "Failed to create proposal", detail: insErr.message },
      500,
    );
  }
  if (!inserted?.id) {
    return jsonResp({ error: "Proposal insert returned no id" }, 500);
  }

  const appUrl = settings?.app_url || "";
  const origin = appUrl || new URL(req.url).origin;
  const link = `${origin}/proposal/${inserted.id}`;

  return jsonResp({
    success: true,
    proposalId: inserted.id,
    link,
    territoryId,
  });
});
