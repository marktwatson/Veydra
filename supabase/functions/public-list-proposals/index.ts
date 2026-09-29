// public-list-proposals — lets an UNAUTHENTICATED salesperson see the
// proposals THEY built for a specific area, matched by their email.
//
// ONE FILE. No sibling imports.
//
// PIN + bot protection (server-side):
//   If the area's portal_settings.sales_pin is set, the request must include a
//   matching `pin`. The PIN is validated HERE, never in the browser. Failed
//   attempts are rate-limited per IP in public_pin_attempts (3 tries → 10 min
//   lockout). One bad IP only locks that IP; real salespeople are unaffected.
//
// verifyOnly:
//   When true, the function ONLY validates the PIN (and applies rate limiting)
//   and returns success with an empty proposals list. Used by the gate modal to
//   unlock the builder without exposing the stored PIN value to the browser.
//
// Body:
//   {
//     slug: string,                 // territory slug (required)
//     salespersonEmail: string,     // required — only this person's proposals
//     pin?: string,                 // required only if the area has a PIN
//     verifyOnly?: boolean          // optional — only validate the PIN
//   }
//
// Returns: { success, proposals: [...] }
//   On wrong/missing PIN: { error, attemptsRemaining } (403)
//   On locked IP: { error, retryAfter } (429)

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

function clientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    (headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

const HEAL_STATEMENTS = [
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS territory_id UUID",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS salesperson_email text",
  "ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS salesperson_name text",
  "ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS slug text",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS territory_id UUID",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sales_pin text",
  "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS app_url text",
  "CREATE TABLE IF NOT EXISTS public.public_pin_attempts (ip text NOT NULL, territory_id uuid NOT NULL, failed_at timestamptz NOT NULL DEFAULT now())",
  "CREATE INDEX IF NOT EXISTS public_pin_attempts_idx ON public.public_pin_attempts (ip, territory_id, failed_at)",
  "NOTIFY pgrst, 'reload schema'",
];

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

  for (const stmt of HEAL_STATEMENTS) {
    try {
      await db.rpc("exec_sql", { sql_text: stmt });
    } catch (e: any) {
      console.warn("[public-list-proposals] heal stmt failed (non-fatal):", stmt, e?.message);
    }
  }

  const slug = String(body.slug || "").trim().toLowerCase();
  const salespersonEmail = String(body.salespersonEmail || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();
  const verifyOnly = !!body.verifyOnly;

  if (!slug) return jsonResp({ error: "slug is required" }, 400);

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

  // ---- Server-side PIN validation + per-IP rate limiting ----
  const areaPin = (settings?.sales_pin || "").trim();
  const ip = clientIp(req);
  if (areaPin) {
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
    if (pin !== areaPin) {
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

  // verifyOnly: PIN checked, nothing else to do.
  if (verifyOnly) {
    return jsonResp({ success: true, proposals: [] });
  }

  if (!salespersonEmail) return jsonResp({ error: "Your email is required" }, 400);

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
