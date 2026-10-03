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
// PIN + bot protection (server-side):
//   If the area has a portal_settings.sales_pin, the request must include a
//   matching `pin`. The PIN is validated HERE, never in the browser. Failed
//   attempts are rate-limited per IP in public_pin_attempts (3 tries → 10 min
//   lockout). One bad IP only locks that IP; real salespeople are unaffected.
//   The rate-limit table is optional — if it is missing, the function still
//   validates the PIN (fail-open on the table, never fail-open on the PIN).
//
// Body:
//   {
//     slug: string,            // territory slug (required)
//     salespersonName?: string, // optional, for audit
//     salespersonEmail?: string,// optional, for audit
//     pin?: string,             // required only if the area has a PIN
//     proposal: { ...CreateProposal payload fields... }
//   }
//
// Returns: { success, proposalId, link, territoryId }
//   On wrong/missing PIN: { error, attemptsRemaining } (403)
//   On locked IP: { error, retryAfter } (429)
//   link = `${app_url || origin}/proposal/${id}`

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

const MAX_ATTEMPTS = 3;
const LOCK_MS = 10 * 60 * 1000; // 10 minutes

// Best-effort client IP. Supabase edge functions run behind a proxy that
// forwards the real client IP in these headers.
function clientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    (headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

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
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS package_name text",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS photo_features text[] DEFAULT '{}'",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS video_features text[] DEFAULT '{}'",
  "ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS slug text",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS territory_id UUID",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sales_pin text",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS app_url text",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS wedding_contract_template text",
  "CREATE TABLE IF NOT EXISTS public.public_pin_attempts (ip text NOT NULL, territory_id uuid NOT NULL, failed_at timestamptz NOT NULL DEFAULT now())",
  "CREATE INDEX IF NOT EXISTS public_pin_attempts_idx ON public.public_pin_attempts (ip, territory_id, failed_at)",
  "NOTIFY pgrst, 'reload schema'",
];

/** Returns remaining locked milliseconds (0 if not locked). Table-missing
 *  tolerant — treats a missing/errored table as "not locked" (fail-open). */
async function lockedRemaining(db: any, ip: string, territoryId: string): Promise<number> {
  try {
    const since = new Date(Date.now() - LOCK_MS).toISOString();
    const { count, error } = await db
      .from("public_pin_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("territory_id", territoryId)
      .gte("failed_at", since);
    if (error) return 0;
    if ((count ?? 0) < MAX_ATTEMPTS) return 0;
    // Locked — compute how long until the oldest relevant attempt ages out.
    const { data: oldest } = await db
      .from("public_pin_attempts")
      .select("failed_at")
      .eq("ip", ip)
      .eq("territory_id", territoryId)
      .gte("failed_at", since)
      .order("failed_at", { ascending: true })
      .limit(1);
    if (!oldest || oldest.length === 0) return LOCK_MS;
    const unlockAt = new Date(oldest[0].failed_at).getTime() + LOCK_MS;
    return Math.max(0, unlockAt - Date.now());
  } catch {
    return 0;
  }
}

async function clearAttempts(db: any, ip: string, territoryId: string) {
  try {
    await db
      .from("public_pin_attempts")
      .delete()
      .eq("ip", ip)
      .eq("territory_id", territoryId);
  } catch {
    /* ignore */
  }
}

async function countRecentAttempts(db: any, ip: string, territoryId: string): Promise<number> {
  try {
    const since = new Date(Date.now() - LOCK_MS).toISOString();
    const { count } = await db
      .from("public_pin_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("territory_id", territoryId)
      .gte("failed_at", since);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function recordFailedAttempt(db: any, ip: string, territoryId: string) {
  try {
    await db.from("public_pin_attempts").insert([
      { ip, territory_id: territoryId, failed_at: new Date().toISOString() },
    ]);
  } catch {
    /* ignore */
  }
}

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

  // Load the area's portal_settings: app_url + contract template + the PIN.
  const { data: settings } = await db
    .from("portal_settings")
    .select("app_url, wedding_contract_template, sales_pin")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();

  // ---- Server-side PIN validation + per-IP rate limiting ----
  const areaPin = (settings?.sales_pin || "").trim();
  const ip = clientIp(req);
  if (areaPin) {
    // Already locked?
    const left = await lockedRemaining(db, ip, territoryId);
    if (left > 0) {
      return jsonResp(
        {
          error: "Too many failed attempts. Try again later.",
          retryAfter: Math.ceil(left / 1000),
          locked: true,
        },
        429,
      );
    }
    const providedPin = String(body.pin || "").trim();
    if (providedPin !== areaPin) {
      await recordFailedAttempt(db, ip, territoryId);
      const attempts = await countRecentAttempts(db, ip, territoryId);
      if (attempts >= MAX_ATTEMPTS) {
        return jsonResp(
          {
            error: "Too many failed attempts. This IP is locked for 10 minutes.",
            retryAfter: Math.ceil(LOCK_MS / 1000),
            locked: true,
          },
          429,
        );
      }
      const remaining = MAX_ATTEMPTS - attempts;
      return jsonResp(
        {
          error: "Incorrect area PIN.",
          attemptsRemaining: remaining,
        },
        403,
      );
    }
    // Correct PIN — clear this IP's attempts.
    await clearAttempts(db, ip, territoryId);
  }
  // No area pin → open access (no rate limiting needed).

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

  // Snapshot the package name + feature lists from the area's pricing row so
  // the public review page renders them without a client catalog lookup.
  if (p.package_id && territoryId) {
    try {
      const { data: pk } = await db
        .from("pricing_packages")
        .select("name, photo_features, video_features")
        .eq("id", p.package_id)
        .eq("territory_id", territoryId)
        .maybeSingle();
      if (pk) {
        payload.package_name = pk.name || null;
        payload.photo_features = Array.isArray(pk.photo_features) ? pk.photo_features : [];
        payload.video_features = Array.isArray(pk.video_features) ? pk.video_features : [];
      }
    } catch (_e) {
      /* non-fatal — review page falls back to a direct lookup if empty */
    }
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
