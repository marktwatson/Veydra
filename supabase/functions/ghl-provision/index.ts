// Super-admin only. Turns a finished Veydra onboarding into an Ovanta
// sub-account. The agency token stays in this function.
import { createClient } from "jsr:@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const CRM = "https://services.leadconnectorhq.com";

function clean(value: unknown, max = 160) {
  return String(value ?? "").replace(/[\u0000-\u001F]/g, "").trim().slice(0, max);
}
function emailOk(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function splitName(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
}
function a2pReady(a2p: any) {
  const ein = String(a2p?.ein || "").replace(/\D/g, "");
  const phone = String(a2p?.phone || "").replace(/\D/g, "");
  return String(a2p?.legal_name || "").trim().length > 1 && ein.length === 9 && String(a2p?.address || "").trim().length > 5 && phone.length >= 10;
}
function onboardingDone(row: any, area: any) {
  const setup = row.owner_setup || {};
  const name = String(row.company_name || "").trim();
  const regions = Array.isArray(row.regions) ? row.regions : [];
  const checks = [
    name.length > 1 && name !== String(area?.name || "").trim(),
    regions.length > 0,
    !!String(row.timezone || "").trim(),
    !!(setup.package?.price8 || setup.package?.price || setup.package_skipped),
    /^https?:\/\//.test(String(row.logo_url || "")),
    (!!setup.ovanta_signed_up || !!(row.hl_api_key && row.hl_location_id)) && a2pReady(setup.a2p),
    !!setup.stripe_ready || !!(area?.contractor_payout_stripe_key && area?.editor_payout_stripe_key),
    !!setup.facebook_ready || !!row.fb_ad_account_id,
  ];
  return checks.every(Boolean);
}

async function ghl(token: string, url: string, version: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  return { ok: res.ok, status: res.status, body };
}

function publicError(status: number) {
  if (status === 401) return "Ovanta refused the agency key.";
  if (status === 403) return "This agency token cannot create a location.";
  if (status === 422 || status === 400) return "Ovanta rejected those details. Check the name, phone, and address.";
  return "Ovanta did not create the location.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Missing Supabase env" }, 500);
  const db = createClient(supabaseUrl, serviceKey);
  try {
    const userDb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: userData } = await userDb.auth.getUser();
    const userId = userData?.user?.id || "";
    const email = String(userData?.user?.email || "").toLowerCase();
    if (!userId && !email) return json({ error: "Not signed in" }, 401);
    let manager: any = null;
    if (email) {
      const { data } = await db.from("managers").select("id, role, status").ilike("email", email).limit(5);
      manager = (data || []).find((row: any) => row.status === "active") || data?.[0];
    }
    if (!manager && userId) {
      const { data } = await db.from("managers").select("id, role, status").eq("id", userId).maybeSingle();
      manager = data;
    }
    if (manager?.role !== "super_admin" || (manager.status && manager.status !== "active")) {
      return json({ error: "Only a super admin can provision an Ovanta account." }, 403);
    }

    await db.rpc("exec_sql_batch", { sql_texts: [
      "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_provisioned_at timestamptz",
      "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_provision_status text",
      "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_provision_error text",
      `CREATE TABLE IF NOT EXISTS public.ghl_provision_log (
        id uuid primary key default gen_random_uuid(),
        admin_id uuid,
        territory_id uuid,
        action text,
        company_name text,
        contact_email text,
        location_id text,
        success boolean,
        error text,
        dry_run boolean default false,
        created_at timestamptz default now()
      )`,
    ] });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");
    const { data: areas } = await db.from("territories").select("id, name, contractor_payout_stripe_key, editor_payout_stripe_key");
    const { data: settings } = await db.from("portal_settings").select("territory_id, company_name, company_state, regions, logo_url, timezone, hl_location_id, hl_api_key, fb_ad_account_id, owner_setup, ghl_provisioned_at, ghl_provision_status, ghl_provision_error, created_at");
    const { data: owners } = await db.from("managers").select("name, email, phone, role, status, territory_id, territory_ids").eq("role", "owner");
    const areaById = new Map((areas || []).map((area: any) => [area.id, area]));
    const ownerFor = (territoryId: string) => (owners || []).find((owner: any) => {
      if (owner.status && owner.status !== "active") return false;
      const extras = Array.isArray(owner.territory_ids) ? owner.territory_ids : [];
      return owner.territory_id === territoryId || extras.includes(territoryId);
    });

    const queue = (settings || []).filter((row: any) => row.territory_id && !row.hl_location_id && onboardingDone(row, areaById.get(row.territory_id))).map((row: any) => {
      const owner = ownerFor(row.territory_id);
      const setup = row.owner_setup || {};
      return {
        territoryId: row.territory_id,
        companyName: row.company_name || "",
        contactName: owner?.name || "",
        contactEmail: owner?.email || "",
        territory: areaById.get(row.territory_id)?.name || "",
        completedAt: setup.completed_at || setup.ovanta_signed_up_at || null,
        status: row.ghl_provision_status === "failed" ? "failed" : "needs_provisioning",
        error: row.ghl_provision_error || "",
      };
    });

    if (action === "list") return json({ items: queue });

    const territoryId = clean(body.territoryId, 80);
    const row = (settings || []).find((item: any) => item.territory_id === territoryId);
    if (!row) return json({ error: "That area was not found." }, 404);
    if (row.hl_location_id) return json({ error: "This area already has an Ovanta location." }, 409);
    const area = areaById.get(territoryId);
    const owner = ownerFor(territoryId);
    const setup = row.owner_setup || {};
    const a2p = setup.a2p || {};
    const names = splitName(owner?.name || "");
    const draft = {
      companyName: clean(body.companyName || row.company_name, 80),
      legalName: clean(body.legalName || a2p.legal_name, 120),
      firstName: clean(body.firstName || names.firstName, 40),
      lastName: clean(body.lastName || names.lastName, 40),
      email: clean(body.email || owner?.email, 120).toLowerCase(),
      phone: clean(body.phone || a2p.phone || owner?.phone, 30),
      address: clean(body.address, 160),
      onboardingAddress: clean(a2p.address, 200),
      city: clean(body.city, 80),
      state: clean(body.state || row.company_state, 40),
      country: clean(body.country || "US", 2).toUpperCase(),
      postalCode: clean(body.postalCode, 20),
      website: clean(body.website, 160),
      timezone: clean(body.timezone || row.timezone, 60),
      logoUrl: String(row.logo_url || ""),
      regions: Array.isArray(row.regions) ? row.regions : [],
      territory: area?.name || "",
    };

    if (action === "detail") return json({ draft, status: row.ghl_provision_status === "failed" ? "failed" : "needs_provisioning", error: row.ghl_provision_error || "" });
    if (action !== "provision") return json({ error: "Unknown action" }, 400);

    if (!draft.companyName) return json({ error: "Company name is required." }, 422);
    if (!emailOk(draft.email)) return json({ error: "A valid contact email is required." }, 422);
    if (!draft.firstName || !draft.lastName) return json({ error: "First and last name are required." }, 422);
    if (draft.country && draft.country.length !== 2) return json({ error: "Country must be a 2-letter code." }, 422);
    if (draft.website && !/^https?:\/\//i.test(draft.website)) return json({ error: "Website must start with http:// or https://." }, 422);

    const token = Deno.env.get("GHL_PRIVATE_INTEGRATION_TOKEN") || "";
    const companyId = Deno.env.get("GHL_COMPANY_ID") || "";
    const agencyLocationId = Deno.env.get("GHL_AGENCY_LOCATION_ID") || "";
    const snapshotId = Deno.env.get("GHL_SNAPSHOT_ID") || "";
    if (!token || !companyId) return json({ error: "The agency Ovanta key is not set on the server yet." }, 503);

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await db.from("ghl_provision_log").select("id", { count: "exact", head: true }).eq("admin_id", manager.id || userId).eq("action", "provision").eq("dry_run", false).gte("created_at", since);
    if ((count || 0) >= 5 && body.dryRun !== true) return json({ error: "Too many provision attempts. Wait a few minutes." }, 429);

    const byEmail = await ghl(token, `${CRM}/locations/search?companyId=${encodeURIComponent(companyId)}&email=${encodeURIComponent(draft.email)}&limit=10`, "v3");
    const emailHits = byEmail.body?.locations || [];
    let nameHit = "";
    if (!emailHits.length) {
      const listed = await ghl(token, `${CRM}/locations/search?companyId=${encodeURIComponent(companyId)}&limit=100`, "v3");
      const found = (listed.body?.locations || []).find((item: any) => String(item.name || "").trim().toLowerCase() === draft.companyName.toLowerCase());
      nameHit = found?.id || "";
    }
    if (emailHits.length || nameHit) {
      return json({ error: "A location already exists for this company name or contact email. Nothing was created." }, 409);
    }

    const payload: Record<string, unknown> = { name: draft.companyName, companyId };
    if (draft.phone) payload.phone = draft.phone;
    if (draft.address) payload.address = draft.address;
    if (draft.city) payload.city = draft.city;
    if (draft.state) payload.state = draft.state;
    if (draft.country) payload.country = draft.country;
    if (draft.postalCode) payload.postalCode = draft.postalCode;
    if (draft.website) payload.website = draft.website;
    if (draft.timezone) payload.timezone = draft.timezone;
    payload.prospectInfo = { firstName: draft.firstName, lastName: draft.lastName, email: draft.email };
    if (snapshotId) payload.snapshotId = snapshotId;

    const preview = { ...payload, companyId, snapshotId: snapshotId ? "set" : "not set" };
    if (body.dryRun === true) {
      await db.from("ghl_provision_log").insert({ admin_id: manager.id || userId, territory_id: territoryId, action: "dry_run", company_name: draft.companyName, contact_email: draft.email, success: true, dry_run: true });
      return json({
        dryRun: true,
        payload: preview,
        skipped: [
          "Logo is not a field on location create, so it is not sent.",
          snapshotId ? "Snapshot id will be sent." : "No snapshot id is set, so no snapshot is loaded.",
        ],
      });
    }

    const created = await ghl(token, `${CRM}/locations/`, "2021-07-28", { method: "POST", body: JSON.stringify(payload) });
    const locationId = created.body?.id || created.body?.location?.id || "";
    if (!created.ok || !locationId) {
      const message = publicError(created.status);
      await db.from("portal_settings").update({ ghl_provision_status: "failed", ghl_provision_error: message }).eq("territory_id", territoryId);
      await db.from("ghl_provision_log").insert({ admin_id: manager.id || userId, territory_id: territoryId, action: "provision", company_name: draft.companyName, contact_email: draft.email, success: false, error: message, dry_run: false });
      return json({ error: message }, 502);
    }

    const warnings: string[] = [];
    if (!snapshotId) warnings.push("No snapshot was loaded. Set GHL_SNAPSHOT_ID if this area should start from a snapshot.");
    warnings.push("The onboarding logo was not sent. Location create has no logo field.");

    const password = `Aa1!${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const userRes = await ghl(token, `${CRM}/users/`, "2021-07-28", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        password,
        phone: draft.phone || undefined,
        type: "account",
        role: "admin",
        locationIds: [locationId],
      }),
    });
    if (!userRes.ok) warnings.push("The location was created, but the Ovanta user was not. Add them from Ovanta.");

    if (agencyLocationId) {
      const found = await ghl(token, `${CRM}/contacts/search`, "2021-07-28", {
        method: "POST",
        body: JSON.stringify({ locationId: agencyLocationId, page: 1, pageLimit: 5, filters: [{ field: "email", operator: "eq", value: draft.email }] }),
      });
      const contact = (found.body?.contacts || []).find((item: any) => String(item.email || "").toLowerCase() === draft.email);
      if (!found.ok || !contact?.id) {
        warnings.push("The welcome tag was not added. The buyer was not found in the agency account.");
      } else {
        const tagged = await ghl(token, `${CRM}/contacts/${contact.id}/tags`, "2021-07-28", {
          method: "POST",
          body: JSON.stringify({ tags: ["onboarding:workspace-ready"] }),
        });
        if (!tagged.ok) warnings.push("The location was created, but the welcome tag was not added.");
      }
    } else {
      warnings.push("GHL_AGENCY_LOCATION_ID is not set, so the welcome tag was not added.");
    }

    await db.from("portal_settings").update({
      hl_location_id: locationId,
      ghl_provisioned_at: new Date().toISOString(),
      ghl_provision_status: "provisioned",
      ghl_provision_error: warnings.join(" "),
    }).eq("territory_id", territoryId);
    await db.from("ghl_provision_log").insert({
      admin_id: manager.id || userId,
      territory_id: territoryId,
      action: "provision",
      company_name: draft.companyName,
      contact_email: draft.email,
      location_id: locationId,
      success: true,
      error: warnings.join(" ") || null,
      dry_run: false,
    });
    return json({ success: true, locationId, companyName: draft.companyName, warnings });
  } catch (error: any) {
    return json({ error: "The provision request failed." }, 500);
  }
});
