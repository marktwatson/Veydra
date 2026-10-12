// Team invite email from the Veydra mailbox, not an area's Ovanta account.
// A new area can invite an owner before Ovanta, Stripe, or templates exist.
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "a super admin",
  owner: "an owner",
  owner_readonly: "an owner",
  manager: "a manager",
  editor: "an editor",
  read_only: "a read-only user",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResp({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const from =
    Deno.env.get("SYSTEM_FROM_EMAIL") || "Veydra <invites@veydra.app>";
  const appUrl = (Deno.env.get("APP_URL") || "https://veydra.app").replace(
    /\/$/,
    "",
  );
  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ error: "Missing Supabase env" }, 500);
  }
  if (!resendKey) {
    return jsonResp(
      {
        error:
          "System invite email is not configured yet. Add the RESEND_API_KEY secret, and verify veydra.app in Resend.",
      },
      500,
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "Invalid JSON" }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const role = String(body.role || "manager").trim();
  const token = String(body.token || "").trim();
  const territoryId = String(body.territoryId || "").trim();
  if (!email || !name || !token || !territoryId) {
    return jsonResp({ error: "email, name, token, and territoryId are required" }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user?.email) return jsonResp({ error: "Not allowed" }, 403);

  const { data: managerRows } = await db
    .from("managers")
    .select("role, territory_id, territory_ids, status")
    .ilike("email", user.email);
  const manager = (managerRows || []).find(
    (m: any) => !m.status || m.status === "active",
  );
  if (!manager) return jsonResp({ error: "Not allowed" }, 403);
  if (manager.role !== "super_admin") {
    const ids = new Set<string>();
    if (manager.territory_id) ids.add(manager.territory_id);
    for (const id of manager.territory_ids || []) ids.add(id);
    if (!ids.has(territoryId)) {
      return jsonResp({ error: "Not allowed for this area" }, 403);
    }
  }

  const { data: territory } = await db
    .from("territories")
    .select("name")
    .eq("id", territoryId)
    .maybeSingle();
  const { data: settings } = await db
    .from("portal_settings")
    .select("company_name")
    .eq("territory_id", territoryId)
    .maybeSingle();
  const areaName =
    String(settings?.company_name || "").trim() ||
    String(territory?.name || "").trim() ||
    "your area";
  const roleLabel = ROLE_LABEL[role] || "a team member";
  const setupUrl =
    `${appUrl}/setup-password?email=${encodeURIComponent(email)}` +
    `&token=${encodeURIComponent(token)}` +
    `&role=${encodeURIComponent(role)}` +
    `&name=${encodeURIComponent(name)}` +
    `&territory_id=${encodeURIComponent(territoryId)}`;

  const subject = "You're invited to Veydra";
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
  <p style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#78716c;">Veydra</p>
  <p>Hi ${escapeHtml(name.split(" ")[0] || name)},</p>
  <p>You've been added as ${escapeHtml(roleLabel)} for <strong>${escapeHtml(areaName)}</strong>.</p>
  <p>Set your password to open the dashboard. If this area is still being set up, you'll land in the setup wizard.</p>
  <p><a href="${setupUrl}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;">Set up your account</a></p>
  <p style="font-size:13px;color:#78716c;">Or copy this link:<br>${setupUrl}</p>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return jsonResp(
      { error: `Invite email was not sent. ${detail}`.slice(0, 500) },
      502,
    );
  }
  return jsonResp({ ok: true, setupUrl, areaName });
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}
