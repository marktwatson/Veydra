// send-proposal — sends a proposal link to the client via CRM email + SMS,
// starts a 48-hour clock on first send, and supports resend + extend.
//
// ONE FILE. No sibling imports. The territory deployer ships index.ts only.
//
// Body: { proposalId: string, resend?: boolean, extend?: boolean }
// portal_settings: hl_api_key, hl_location_id, company_name, app_url, phone
// CRM Version: 2021-07-28
//
// - Find/create contact like ghl-invoice (search email, POST /contacts/).
// - Tag contact "proposal sent".
// - publicUrl = ${app_url || origin}/proposal/${id}
// - First send: sent_at=now(), expires_at=now()+48h, sent_count=1
// - Resend (not expired): email/SMS again, do NOT move expires_at, sent_count++
// - extend: expires_at=now()+48h (optional resend)
// - Block send if coverage_requested_at && !coverage_confirmed_at.
// - Never delete the proposal. Never create a CRM invoice. No Stripe.

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

// Self-heal the columns this function reads/writes so a stale Sync still works.
const HEAL_SQL = `
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS sent_count int DEFAULT 0;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_requested_at timestamptz;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_confirmed_at timestamptz;
NOTIFY pgrst, 'reload schema';
`;

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ error: "Missing Supabase env" }, 500);
  }

  const db = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${serviceKey}` } },
  });

  // Heal columns first (non-fatal).
  try {
    await db.rpc("exec_sql", { sql_text: HEAL_SQL });
  } catch (e: any) {
    console.warn("[send-proposal] heal failed (non-fatal):", e?.message);
  }

  const proposalId = String(body.proposalId || "").trim();
  const resend = !!body.resend;
  const extend = !!body.extend;

  if (!proposalId) {
    return jsonResp({ error: "proposalId is required" }, 400);
  }

  // Load the proposal.
  const { data: proposal, error: propErr } = await db
    .from("proposals")
    .select(
      "id, client_name, client_email, client_phone, wedding_date, total_amount, status, coverage_requested_at, coverage_confirmed_at, sent_at, expires_at, sent_count",
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (propErr) {
    return jsonResp(
      { error: "Proposal lookup failed", detail: propErr.message },
      500,
    );
  }
  if (!proposal) {
    return jsonResp({ error: "Proposal not found" }, 404);
  }

  // Block send if coverage requested but not confirmed.
  const coverageRequested = !!proposal.coverage_requested_at;
  const coverageConfirmed = !!proposal.coverage_confirmed_at;
  if (coverageRequested && !coverageConfirmed && !extend) {
    return jsonResp(
      {
        error:
          "Coverage not confirmed — assign a contractor before sending to the client.",
      },
      422,
    );
  }

  // Do not expire if booked / signed / paid / accepted.
  const isBooked =
    proposal.status === "accepted" ||
    proposal.status === "paid" ||
    proposal.status === "upcoming";

  // Load portal settings.
  const { data: pSettings } = await db
    .from("portal_settings")
    .select(
      "hl_api_key, hl_location_id, company_name, app_url, phone",
    )
    .maybeSingle();

  const hlApiKey = (pSettings?.hl_api_key || "").trim();
  const hlLocationId = (pSettings?.hl_location_id || "").trim();
  const companyName = pSettings?.company_name || "Veydra";
  const appUrl = (pSettings?.app_url || "").trim();
  const companyPhone = pSettings?.phone || "";

  const publicUrl = `${appUrl || supabaseUrl.replace(".supabase.co", "") || "https://veydra.app"}/proposal/${proposal.id}`;

  const now = new Date();
  const existingExpires = proposal.expires_at
    ? new Date(proposal.expires_at)
    : null;
  const alreadySent = !!proposal.sent_at;
  const isExpired =
    alreadySent && existingExpires && now > existingExpires && !isBooked;

  // EXTEND path: push expires_at to now + 48h, optionally resend.
  if (extend) {
    const newExpires = addHours(now, 48);
    const patch: any = { expires_at: newExpires.toISOString() };
    if (resend) patch.sent_count = (proposal.sent_count || 0) + 1;
    await db.from("proposals").update(patch).eq("id", proposalId);

    if (resend && hlApiKey && hlLocationId && proposal.client_email) {
      try {
        await sendCrmMessages({
          hlApiKey,
          hlLocationId,
          proposal,
          companyName,
          companyPhone,
          publicUrl,
        });
      } catch (e: any) {
        console.warn("[send-proposal] extend resend failed:", e?.message);
      }
    }

    return jsonResp({
      success: true,
      action: "extended",
      sent_at: proposal.sent_at,
      expires_at: newExpires.toISOString(),
      sent_count: proposal.sent_count || 0,
      publicUrl,
    });
  }

  // Expired + not booked → block new send (staff should Extend or Revise).
  if (isExpired) {
    return jsonResp(
      {
        error:
          "This proposal has expired. Extend the deadline (adds 48 hours) or revise the package.",
        expired: true,
        expires_at: existingExpires?.toISOString(),
      },
      422,
    );
  }

  // First send vs resend.
  const isFirstSend = !alreadySent;
  const patch: any = {};
  if (isFirstSend) {
    patch.sent_at = now.toISOString();
    patch.expires_at = addHours(now, 48).toISOString();
    patch.sent_count = 1;
  } else if (resend) {
    // Resend while not expired: do NOT move expires_at.
    patch.sent_count = (proposal.sent_count || 0) + 1;
  } else {
    // Already sent, not expired, not resend — nothing to do.
    return jsonResp({
      success: true,
      action: "noop",
      message: "Already sent. Use resend=true to re-send, or extend=true.",
      sent_at: proposal.sent_at,
      expires_at: existingExpires?.toISOString(),
      sent_count: proposal.sent_count || 0,
      publicUrl,
    });
  }

  if (Object.keys(patch).length) {
    const { error: updErr } = await db
      .from("proposals")
      .update(patch)
      .eq("id", proposalId);
    if (updErr) {
      return jsonResp(
        { error: "Failed to update proposal", detail: updErr.message },
        500,
      );
    }
  }

  // Send email + SMS via CRM if configured.
  let messageResult: any = { sent: false };
  if (hlApiKey && hlLocationId && proposal.client_email) {
    try {
      messageResult = await sendCrmMessages({
        hlApiKey,
        hlLocationId,
        proposal,
        companyName,
        companyPhone,
        publicUrl,
      });
    } catch (e: any) {
      messageResult = { sent: false, error: e?.message };
      console.warn("[send-proposal] CRM send failed:", e?.message);
    }
  }

  return jsonResp({
    success: true,
    action: isFirstSend ? "sent" : "resent",
    sent_at: patch.sent_at || proposal.sent_at,
    expires_at: patch.expires_at || existingExpires?.toISOString(),
    sent_count: patch.sent_count || proposal.sent_count || 0,
    publicUrl,
    message: messageResult,
  });
});

// ── CRM email + SMS helper ──────────────────────────────────────────────
async function sendCrmMessages({
  hlApiKey,
  hlLocationId,
  proposal,
  companyName,
  companyPhone,
  publicUrl,
}: {
  hlApiKey: string;
  hlLocationId: string;
  proposal: any;
  companyName: string;
  companyPhone: string;
  publicUrl: string;
}): Promise<any> {
  const crmHeaders: Record<string, string> = {
    Authorization: `Bearer ${hlApiKey}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };

  const email = (proposal.client_email || "").trim();
  const phone = (proposal.client_phone || "").trim();
  const firstName = (proposal.client_name || "").trim().split(" ")[0] || "there";

  // Find or create contact (same pattern as ghl-invoice).
  let contactId: string | null = null;
  try {
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${hlLocationId}&query=${encodeURIComponent(email)}`,
      { headers: crmHeaders },
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      contactId = searchData.contacts?.[0]?.id || null;
    }
  } catch (e: any) {
    console.warn("[send-proposal] contact search failed:", e?.message);
  }

  if (!contactId) {
    const nameParts = (proposal.client_name || "Client").trim().split(" ");
    const createPayload: any = {
      locationId: hlLocationId,
      email,
      firstName: nameParts[0] || "Client",
      lastName: nameParts.slice(1).join(" ") || "",
      tags: ["portal-auto-created"],
    };
    const phoneE164 = toE164(phone);
    if (phoneE164) createPayload.phone = phoneE164;

    const createRes = await fetch(
      "https://services.leadconnectorhq.com/contacts/",
      { method: "POST", headers: crmHeaders, body: JSON.stringify(createPayload) },
    );
    if (createRes.ok) {
      const createData = await createRes.json();
      contactId = createData.contact?.id || null;
    }
  }

  // Tag "proposal sent" (idempotent).
  if (contactId) {
    try {
      await fetch(
        `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
        {
          method: "POST",
          headers: crmHeaders,
          body: JSON.stringify({ tags: ["proposal sent"] }),
        },
      );
    } catch (_e) {
      /* swallow */
    }
  }

  const subject = `Your ${companyName} proposal is ready — 48 hours to review`;
  const html = `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;background:#faf8f5;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #ece4dc;">
    <div style="padding:32px 40px;text-align:center;background:linear-gradient(135deg,#faf8f5,#fff);">
      <h1 style="margin:0 0 8px;font-size:28px;color:#2b2b2b;">Your Proposal is Ready</h1>
      <p style="margin:0;color:#7a7a7a;font-size:15px;">Prepared exclusively for ${proposal.client_name || "you"}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:16px;line-height:1.6;color:#444;">Hi ${firstName},</p>
      <p style="font-size:16px;line-height:1.6;color:#444;">
        Your ${companyName} wedding proposal is ready for review. You can review the package,
        sign your agreement, and secure your date online.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${publicUrl}" style="display:inline-block;padding:14px 32px;background:#2b2b2b;color:#fff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">Review, Sign &amp; Pay</a>
      </div>
      <p style="font-size:13px;color:#999;line-height:1.5;border-top:1px solid #ece4dc;padding-top:16px;">
        Most proposals expire in 48 hours. Need more time? Contact your manager${companyPhone ? ` at ${companyPhone}` : ""}.
      </p>
    </div>
  </div>
</body></html>`;

  const results: any = { email: null, sms: null, contactId };

  // Email via CRM conversations/messages.
  if (contactId) {
    try {
      const emailRes = await fetch(
        "https://services.leadconnectorhq.com/conversations/messages",
        {
          method: "POST",
          headers: crmHeaders,
          body: JSON.stringify({
            locationId: hlLocationId,
            contactId,
            type: "Email",
            subject,
            html,
          }),
        },
      );
      results.email = emailRes.ok ? "sent" : `error:${emailRes.status}`;
      if (!emailRes.ok) {
        const t = await emailRes.text();
        console.warn("[send-proposal] email send failed:", t.slice(0, 300));
      }
    } catch (e: any) {
      results.email = `error:${e?.message}`;
    }
  }

  // SMS via CRM conversations/messages.
  const phoneE164 = toE164(phone);
  if (contactId && phoneE164) {
    const smsBody = `Hi ${firstName}, your ${companyName} proposal is ready: ${publicUrl} — expires in 48 hours.`;
    try {
      const smsRes = await fetch(
        "https://services.leadconnectorhq.com/conversations/messages",
        {
          method: "POST",
          headers: crmHeaders,
          body: JSON.stringify({
            locationId: hlLocationId,
            contactId,
            type: "SMS",
            body: smsBody,
          }),
        },
      );
      results.sms = smsRes.ok ? "sent" : `error:${smsRes.status}`;
    } catch (e: any) {
      results.sms = `error:${e?.message}`;
    }
  }

  return { sent: true, ...results };
}

function toE164(phone: string): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^\d+]/g, "");
  if (!p) return null;
  if (!p.startsWith("+")) {
    if (p.length === 10) p = "+1" + p;
    else if (p.length === 11 && p.startsWith("1")) p = "+" + p;
    else p = "+" + p;
  }
  return p;
}
