// Sends Ovanta SMS/email and syncs a new applicant without returning the API key.
// The key is read with the service role and never included in the response.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResp({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ error: "Missing Supabase env" }, 500);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "Invalid JSON" }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user ?? null;

  const action = body.action || body.channel || "sms";

  if (action === "sync-contractor") {
    return syncContractor(db, user, body.contractorId);
  }

  const channel = action === "email" ? "email" : "sms";
  const email = String(body.email || "").trim();
  const message = String(body.message || "");
  const subject = String(body.subject || "");
  const name = body.name ? String(body.name) : "";
  const weddingId = body.weddingId ? String(body.weddingId) : "";
  const contractorId = body.contractorId ? String(body.contractorId) : "";
  let territoryId = body.territoryId ? String(body.territoryId) : "";

  if (!email || !message) return jsonResp({ error: "email and message are required" }, 400);

  if (!user) {
    if (weddingId && channel === "email") {
      const { data: wedding } = await db
        .from("weddings")
        .select("territory_id")
        .eq("id", weddingId)
        .maybeSingle();
      if (!wedding?.territory_id) return jsonResp({ error: "Not allowed" }, 403);
      territoryId = wedding.territory_id;
      const { data: managers } = await db
        .from("managers")
        .select("email")
        .eq("territory_id", territoryId);
      const allowed = (managers || []).some(
        (m: any) => String(m.email || "").toLowerCase() === email.toLowerCase(),
      );
      if (!allowed) return jsonResp({ error: "Not allowed" }, 403);
    } else if (contractorId) {
      const { data: contractor } = await db
        .from("contractors")
        .select("email, territory_id, status, created_at")
        .eq("id", contractorId)
        .maybeSingle();
      const created = contractor?.created_at
        ? new Date(contractor.created_at).getTime()
        : 0;
      const fresh = Date.now() - created < 2 * 60 * 60 * 1000;
      const samePerson =
        String(contractor?.email || "").toLowerCase() === email.toLowerCase();
      if (!contractor || !fresh || !samePerson) {
        return jsonResp({ error: "Not allowed" }, 403);
      }
      territoryId = contractor.territory_id;
    } else {
      return jsonResp({ error: "Not allowed" }, 403);
    }
  } else {
    const emailLower = String(user.email || "").toLowerCase();
    const { data: managerRows } = await db
      .from("managers")
      .select("role, territory_id, territory_ids, status")
      .ilike("email", emailLower);
    const manager = (managerRows || []).find(
      (m: any) => !m.status || m.status === "active",
    );
    const { data: editor } = await db
      .from("editors")
      .select("territory_id, territory_ids")
      .ilike("email", emailLower)
      .limit(1)
      .maybeSingle();
    const { data: contractor } = await db
      .from("contractors")
      .select("territory_id")
      .ilike("email", emailLower)
      .limit(1)
      .maybeSingle();
    if (!manager && !editor && !contractor) {
      return jsonResp({ error: "Not allowed" }, 403);
    }
    if (!territoryId) {
      territoryId =
        manager?.territory_id ||
        editor?.territory_id ||
        contractor?.territory_id ||
        "";
    }
    const superAdmin = manager?.role === "super_admin";
    if (!superAdmin && territoryId) {
      const ids = new Set<string>();
      for (const row of [manager, editor, contractor]) {
        if (!row) continue;
        if (row.territory_id) ids.add(row.territory_id);
        for (const id of row.territory_ids || []) ids.add(id);
      }
      if (!ids.has(territoryId)) return jsonResp({ error: "Not allowed for this area" }, 403);
    }
  }

  if (!territoryId) return jsonResp({ error: "Missing area" }, 400);

  const { data: settings } = await db
    .from("portal_settings")
    .select("hl_api_key, hl_location_id")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();
  if (!settings?.hl_api_key || !settings?.hl_location_id) {
    return jsonResp(
      { error: "This area has no Ovanta connection in Settings → Integrations." },
      400,
    );
  }

  try {
    if (channel === "sms") {
      await sendSms(db, settings, email, message, name);
    } else {
      await sendEmail(settings, email, subject, message, name);
    }
    return jsonResp({ ok: true });
  } catch (e: any) {
    return jsonResp({ error: e?.message || "Send failed" }, 500);
  }
});

async function crmHeaders(apiKey: string, version = "2021-07-28") {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: version,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function findOrCreateContact(settings: any, email: string, name: string, phone?: string | null) {
  const headers = await crmHeaders(settings.hl_api_key);
  const searchRes = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(email)}`,
    { headers },
  );
  let contactId: string | null = null;
  let existingPhone: string | null = null;
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    contactId = searchData.contacts?.[0]?.id || null;
    existingPhone = searchData.contacts?.[0]?.phone || null;
  }
  if (!contactId) {
    const payload: any = {
      locationId: settings.hl_location_id,
      email,
      tags: ["portal-auto-created"],
    };
    if (name) {
      const parts = name.trim().split(" ");
      payload.firstName = parts[0];
      if (parts.length > 1) payload.lastName = parts.slice(1).join(" ");
    }
    if (phone) payload.phone = phone;
    const createRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) {
      throw new Error(`Failed to auto-create contact in CRM: ${await createRes.text()}`);
    }
    const createData = await createRes.json();
    contactId = createData.contact?.id || null;
  } else if (!existingPhone && phone) {
    await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ phone }),
    });
  }
  return contactId;
}

async function lookupPhone(db: any, email: string) {
  const { data: contractor } = await db
    .from("contractors")
    .select("phone")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (contractor?.phone) return contractor.phone;
  const { data: wedding } = await db
    .from("weddings")
    .select("questionnaire_data, client_phone")
    .ilike("client_email", email)
    .limit(1)
    .maybeSingle();
  if (wedding?.client_phone) return wedding.client_phone;
  const info = wedding?.questionnaire_data?.contact_info;
  return info?.phone || info?.phone_bride || info?.phone_groom || null;
}

async function sendSms(db: any, settings: any, email: string, message: string, name: string) {
  const phone = await lookupPhone(db, email);
  const contactId = await findOrCreateContact(settings, email, name, phone);
  if (!contactId) throw new Error("Could not find or create the CRM contact.");
  const sendRes = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: await crmHeaders(settings.hl_api_key, "2021-04-15"),
    body: JSON.stringify({ type: "SMS", contactId, message }),
  });
  if (!sendRes.ok) {
    const errData = await sendRes.text();
    if (errData.includes("CONVERSATIONS_MSG_NO_PHONE") || errData.includes("Missing phone number")) {
      throw new Error("Contact does not have a phone number in the CRM or portal.");
    }
    throw new Error(`Failed to send SMS via CRM: ${errData}`);
  }
}

async function sendEmail(settings: any, email: string, subject: string, html: string, name: string) {
  const contactId = await findOrCreateContact(settings, email, name, null);
  if (!contactId) throw new Error("Could not find or create the CRM contact.");
  const sendRes = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: await crmHeaders(settings.hl_api_key, "2021-04-15"),
    body: JSON.stringify({
      type: "Email",
      contactId,
      subject: subject || "Notification",
      html,
      message: "Please view the HTML version of this email.",
    }),
  });
  if (!sendRes.ok) {
    throw new Error(`Failed to send Email via CRM: ${await sendRes.text()}`);
  }
}

async function syncContractor(db: any, user: any, contractorId: string) {
  if (!contractorId) return jsonResp({ error: "Missing contractor" }, 400);
  const { data: contractor } = await db
    .from("contractors")
    .select("*")
    .eq("id", contractorId)
    .maybeSingle();
  if (!contractor) return jsonResp({ error: "Contractor not found" }, 404);

  if (!user) {
    const created = contractor.created_at ? new Date(contractor.created_at).getTime() : 0;
    const fresh = Date.now() - created < 2 * 60 * 60 * 1000;
    const openStatus = ["applied", "interview", "paperwork"].includes(contractor.status);
    if (!fresh || !openStatus) return jsonResp({ error: "Not allowed" }, 403);
  }

  const territoryId = contractor.territory_id;
  const { data: settings } = await db
    .from("portal_settings")
    .select("hl_api_key, hl_location_id")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();
  if (!settings?.hl_api_key || !settings?.hl_location_id) {
    return jsonResp({ error: "This area has no Ovanta connection." }, 400);
  }

  const headers = await crmHeaders(settings.hl_api_key);
  const payload: any = {
    locationId: settings.hl_location_id,
    email: contractor.email,
    firstName: contractor.first_name,
    lastName: contractor.last_name,
    phone: contractor.phone || undefined,
    website: contractor.portfolio_url || undefined,
    tags: ["applicant"],
  };
  if (["active", "hired"].includes(contractor.status)) payload.tags = ["contractor"];

  const searchRes = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(contractor.email)}`,
    { headers },
  );
  let contactId: string | null = null;
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    contactId = searchData.contacts?.[0]?.id || null;
  }
  if (contactId) {
    const updateRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      { method: "PUT", headers, body: JSON.stringify(payload) },
    );
    if (!updateRes.ok) {
      return jsonResp({ error: `Failed to update contact: ${await updateRes.text()}` }, 500);
    }
  } else {
    const createRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) {
      return jsonResp({ error: `Failed to create contact: ${await createRes.text()}` }, 500);
    }
    const createData = await createRes.json();
    contactId = createData.contact?.id || null;
  }
  return jsonResp({ ok: true, contactId });
}
