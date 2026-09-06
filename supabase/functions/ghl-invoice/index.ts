import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalize a phone to E.164 (+1...). Return null if not valid. */
function toE164(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    const rest = digits.slice(1);
    if (rest.length >= 10 && rest.length <= 15) return "+" + rest;
    return null;
  }
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return null;
}

/** Format today (+offsetDays) as YYYY-MM-DD (local, not UTC). */
function ymd(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface PlanRow {
  date: string;
  amount: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const su = Deno.env.get("SUPABASE_URL") || "";
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!su || !sk) {
      return jsonResp({ error: "Missing Supabase environment variables" }, 500);
    }
    const db = createClient(su, sk);

    let body: any = {};
    try {
      body = await req.json();
    } catch (_e) {
      return jsonResp({ error: "Invalid JSON body" }, 400);
    }

    const { weddingId, amount, label, action } = body;
    if (!weddingId) {
      return jsonResp({ error: "Missing weddingId" }, 400);
    }
    const numAmount = Number(amount);
    if (!action && (!numAmount || numAmount <= 0)) {
      return jsonResp({ error: "Amount must be a positive number" }, 400);
    }

    // 1. Fetch wedding details (incl. existing invoice columns if present)
    const { data: wedding, error: weddingErr } = await db
      .from("weddings")
      .select(
        "id, client_name, client_email, client_phone, questionnaire_data, total_amount, paid_amount, custom_payment_plan, payment_plan, ghl_contact_id, ghl_invoice_id, ghl_invoice_ids, ghl_invoice_url, ghl_invoice_status, ghl_amount_paid, ghl_schedule, ghl_invoice_amount, ghl_invoice_created_date",
      )
      .eq("id", weddingId)
      .maybeSingle();

    if (weddingErr || !wedding) {
      return jsonResp({ error: "Wedding not found" }, 404);
    }

    const email =
      wedding.client_email ||
      wedding.questionnaire_data?.contact_info?.email;
    if (!email) {
      return jsonResp(
        { error: "Client email is missing on this wedding record." },
        400,
      );
    }

    const rawPhone =
      wedding.client_phone ||
      wedding.questionnaire_data?.contact_info?.phone ||
      wedding.questionnaire_data?.contact_info?.phone_bride ||
      wedding.questionnaire_data?.contact_info?.phone_groom ||
      "";
    const phoneE164 = toE164(rawPhone);

    const clientName = wedding.client_name || "Client";

    // 2. Self-heal: ensure the ghl_invoice_base_url column exists so the
    //    read below doesn't silently come back empty on a freshly synced area.
    try {
      await db.rpc("exec_sql", {
        sql_text:
          "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_invoice_base_url TEXT; ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS hl_user_id TEXT; NOTIFY pgrst, 'reload schema';",
      });
    } catch (_e) {
      // exec_sql may not exist on some areas — not fatal; we still attempt
      // the read and fall back to the default domain below.
    }

    // Re-fetch after the (possible) schema reload so PostgREST sees the column.
    const { data: pSettings, error: settingsErr } = await db
      .from("portal_settings")
      .select("hl_api_key, hl_location_id, company_name, ghl_invoice_base_url, hl_user_id")
      .limit(1)
      .maybeSingle();

    if (settingsErr) {
      console.error("[ghl-invoice] portal_settings query error:", settingsErr.message);
    }

    // Trim whitespace — treat blank strings as missing.
    const hlApiKey = (pSettings?.hl_api_key || "").trim();
    const hlLocationId = (pSettings?.hl_location_id || "").trim();

    if (!hlApiKey || !hlLocationId) {
      return jsonResp(
        {
          error:
            "CRM API key or Location ID is not configured in Global Settings.",
          has_hl_api_key: !!hlApiKey,
          has_hl_location_id: !!hlLocationId,
          settings_row_found: !!pSettings,
        },
        400,
      );
    }

    const apiKey = hlApiKey;
    const locationId = hlLocationId;
    const companyName = pSettings.company_name || "Veydra";

    const crmHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Resolve the GHL location user id — required by the send endpoint.
    const savedUserId = (pSettings?.hl_user_id || "").trim();
    let userId = savedUserId;
    if (!userId) {
      console.log("[ghl-invoice] no saved hl_user_id, searching users...");
      for (const endpoint of [
        `https://services.leadconnectorhq.com/users/search?locationId=${locationId}`,
        `https://services.leadconnectorhq.com/users/?locationId=${locationId}`,
      ]) {
        try {
          const uRes = await fetch(endpoint, { headers: crmHeaders });
          if (uRes.ok) {
            const uData = await uRes.json();
            userId =
              uData.users?.[0]?.id ||
              uData.id ||
              uData.userId ||
              null;
            if (userId) {
              console.log("[ghl-invoice] found userId via search:", userId);
              break;
            }
          }
        } catch (e: any) {
          console.warn("[ghl-invoice] user search failed:", e?.message);
        }
      }
    } else {
      console.log("[ghl-invoice] using saved hl_user_id:", userId);
    }

    const savedBaseUrl = (pSettings?.ghl_invoice_base_url || "").trim();
    const baseUrl = savedBaseUrl || "https://links.msgsndr.com";
    console.log("[ghl-invoice] resolved baseUrl:", baseUrl, "saved?", !!savedBaseUrl);

    // ── SYNC action ──
    if (action === "sync") {
      const contactId = wedding.ghl_contact_id || "";
      let invoices: any[] = [];
      if (contactId) {
        try {
          const invRes = await fetch(
            `https://services.leadconnectorhq.com/invoices/?altId=${locationId}&altType=location&contactId=${contactId}&limit=50`,
            { headers: crmHeaders },
          );
          if (invRes.ok) {
            const invData = await invRes.json();
            invoices = invData.invoices || invData.data || [];
          }
        } catch (e: any) {
          console.warn("[ghl-invoice] sync list invoices failed:", e?.message);
        }
      }

      let totalPaidDelta = 0;
      const scheduleRows: any[] = [];
      for (const inv of invoices) {
        const invId = inv._id || inv.id;
        const status = (inv.status || inv.statusType || "").toLowerCase();
        const amountPaid = Number(inv.amountPaid || inv.amount_paid || 0);
        const total = Number(inv.total || inv.amount || 0);

        const { data: existing } = await db
          .from("ghl_invoice_payments")
          .select("id, amount_paid_on_invoice")
          .eq("ghl_invoice_id", invId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const stored = Number(existing?.amount_paid_on_invoice || 0);
        if (amountPaid > stored) {
          totalPaidDelta += amountPaid - stored;
          if (existing?.id) {
            await db.from("ghl_invoice_payments").update({ amount_paid_on_invoice: amountPaid, amount: total }).eq("id", existing.id);
          } else {
            await db.from("ghl_invoice_payments").insert({ wedding_id: weddingId, ghl_invoice_id: invId, amount: total, amount_paid_on_invoice: amountPaid });
          }
        }

        const ps = inv.paymentSchedule || inv.payment_schedule || [];
        if (Array.isArray(ps) && ps.length > 0) {
          for (const row of ps) {
            scheduleRows.push({
              date: row.date || row.dueDate || "",
              amount: Number(row.amount || 0),
              status: (row.status || (Number(row.amount) <= amountPaid ? "paid" : "upcoming")).toLowerCase(),
              invoiceId: invId,
            });
          }
        } else {
          scheduleRows.push({
            date: inv.issueDate || inv.issue_date || "",
            amount: total,
            status: status === "paid" ? "paid" : amountPaid > 0 ? "partially_paid" : status || "upcoming",
            invoiceId: invId,
          });
        }
      }

      const newPaid = Math.max(0, (Number(wedding.paid_amount) || 0) + totalPaidDelta);
      const latest = invoices[0];
      const latestId = latest?._id || latest?.id || wedding.ghl_invoice_id || "";
      const update: any = {
        paid_amount: newPaid,
        ghl_amount_paid: newPaid,
        ghl_schedule: scheduleRows,
      };
      if (latestId) {
        update.ghl_invoice_id = latestId;
        update.ghl_invoice_status = (latest?.status || latest?.statusType || "").toLowerCase();
        update.ghl_invoice_url = `${baseUrl}/invoice/${latestId}`;
      }
      await db.from("weddings").update(update).eq("id", weddingId);

      return jsonResp({
        success: true,
        synced: true,
        invoiceCount: invoices.length,
        totalPaidDelta,
        paid_amount: newPaid,
        scheduleRows: scheduleRows.length,
      });
    }

    // Helper: send an invoice by id. Tries send_manually, then "email".
    async function sendInvoice(invId: string) {
      const actions = ["send_manually", "email"];
      for (const act of actions) {
        const sendBody: any = {
          altId: locationId,
          altType: "location",
          action: act,
          liveMode: true,
        };
        if (userId) sendBody.userId = userId;
        try {
          const sRes = await fetch(
            `https://services.leadconnectorhq.com/invoices/${invId}/send`,
            { method: "POST", headers: crmHeaders, body: JSON.stringify(sendBody) },
          );
          const sText = await sRes.text();
          console.log(`[ghl-invoice] send action=${act} status=${sRes.status} body=${sText.slice(0, 300)}`);
          if (sRes.ok) return { ok: true, status: sRes.status, body: sText, action: act };
        } catch (e: any) {
          console.warn(`[ghl-invoice] send action=${act} failed:`, e?.message);
        }
      }
      return { ok: false, status: 0, body: "all send actions failed", action: "" };
    }

    // Helper: GET invoice and return its status field.
    async function getInvoiceStatus(invId: string): Promise<string | null> {
      try {
        const gRes = await fetch(`https://services.leadconnectorhq.com/invoices/${invId}`, { headers: crmHeaders });
        if (gRes.ok) {
          const gData = await gRes.json();
          const inv = gData.invoice || gData;
          return inv.status || inv.statusType || null;
        }
      } catch (e: any) {
        console.warn("[ghl-invoice] GET invoice failed:", e?.message);
      }
      return null;
    }

    // Compute hasMultiPlan early so idempotency can skip reuse for multi-row
    // plans (which create a full-balance invoice, not a firstDue-only one).
    const _totalAmt = Number(wedding.total_amount) || 0;
    const _paid = Number(wedding.paid_amount) || 0;
    const _remaining = Math.max(0, _totalAmt - _paid);
    let hasMultiPlan = false;
    try {
      const _cppRaw = wedding.custom_payment_plan || {};
      const _cpp = typeof _cppRaw === "string" ? JSON.parse(_cppRaw) : _cppRaw;
      const _en = _cpp.enabled === true || _cpp.enabled === "true" || _cpp.enabled === 1;
      const _insts = Array.isArray(_cpp.installments) ? _cpp.installments : Array.isArray(_cpp) ? _cpp : [];
      if (_en && _insts.length > 0 && _remaining > 0) {
        const _dep = Math.min(Number(_cpp.deposit) || numAmount, _remaining);
        let _cnt = _dep > 0 ? 1 : 0, _run = 0;
        for (const _i of _insts) { _run += Number(_i.amount || 0); if (_run <= _paid) continue; _cnt++; }
        hasMultiPlan = _cnt >= 2;
      }
    } catch (_e) {}

    // 2b. Idempotency — reuse today's draft/sent invoice for same amount.
    // Skip reuse for multi-row plans: they build a full-balance invoice, so an
    // old firstDue-only draft (e.g. $0.50) must never be resurrected.
    const today = ymd(0);
    const existingId = wedding.ghl_invoice_id;
    const existingAmount = Number(wedding.ghl_invoice_amount);
    const existingDate = wedding.ghl_invoice_created_date;
    if (!hasMultiPlan && existingId && existingDate === today && existingAmount === numAmount) {
      const reuseUrl = `${baseUrl}/invoice/${existingId}`;
      console.log("[ghl-invoice] reusing today's draft invoice:", existingId);
      const sendResult = await sendInvoice(existingId);
      const statusAfter = await getInvoiceStatus(existingId);
      if (statusAfter && statusAfter.toLowerCase() === "draft") {
        return jsonResp({
          error: "Invoice still draft",
          invoiceId: existingId,
          invoiceUrl: reuseUrl,
          sendStatus: sendResult.status,
          sendBody: sendResult.body,
          statusAfter,
          reused: true,
        }, 500);
      }
      return jsonResp({
        success: true,
        invoiceId: existingId,
        invoiceUrl: reuseUrl,
        contactId: "",
        clientName,
        amount: numAmount,
        reused: true,
        statusAfter,
      });
    }

    // 3. Contact Upsert: search contact by email + locationId
    let contactId: string | null = null;
    try {
      const searchRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}`,
        { headers: crmHeaders },
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        contactId = searchData.contacts?.[0]?.id || null;
      }
    } catch (e: any) {
      console.warn("[ghl-invoice] Contact search failed:", e?.message);
    }

    if (!contactId) {
      const nameParts = clientName.trim().split(" ");
      const firstName = nameParts[0] || "Client";
      const lastName = nameParts.slice(1).join(" ") || "";

      const createPayload: any = {
        locationId,
        email,
        firstName,
        lastName,
        tags: ["portal-auto-created"],
      };
      if (phoneE164) createPayload.phone = phoneE164;

      const createRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
        method: "POST",
        headers: crmHeaders,
        body: JSON.stringify(createPayload),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("[ghl-invoice] contact create error:", errText);
        return jsonResp({ error: `Failed to create CRM contact: ${errText}` }, 500);
      }
      const createData = await createRes.json();
      contactId = createData.contact?.id || null;
      if (!contactId) {
        return jsonResp({ error: "Created CRM contact but received no ID" }, 500);
      }
    }

    // 4. Build unpaid-installment rows from the custom payment plan.
    const invoiceTitle = label || `Payment for ${clientName}`;
    const businessDetails: any = { name: companyName };
    const contactDetails: any = { id: contactId, name: clientName, email };
    if (phoneE164) contactDetails.phone = phoneE164;

    const totalAmount = Number(wedding.total_amount) || 0;
    const paidSoFar = Number(wedding.paid_amount) || 0;
    const remaining = Math.max(0, totalAmount - paidSoFar);

    let planRows: PlanRow[] = [];
    hasMultiPlan = false;
    try {
      const cppRaw = wedding.custom_payment_plan || {};
      const cpp = typeof cppRaw === "string" ? JSON.parse(cppRaw) : cppRaw;
      const cppEnabled = cpp.enabled === true || cpp.enabled === "true" || cpp.enabled === 1;
      const installments: any[] = Array.isArray(cpp.installments)
        ? cpp.installments
        : Array.isArray(cpp) ? cpp : [];

      if (cppEnabled && installments.length > 0 && remaining > 0) {
        const installmentsSum = installments.reduce(
          (s: number, i: any) => s + Number(i.amount || 0), 0,
        );
        const deposit = Math.min(Number(cpp.deposit) || 0, remaining);
        const rows: PlanRow[] = [];
        // Only add the deposit as a separate row if the installments do NOT
        // already sum to the full remaining balance (i.e. deposit is not
        // already included in the installment rows).
        const depositIncluded = installmentsSum >= remaining - 0.01 || deposit <= 0;
        if (!depositIncluded) {
          rows.push({ date: ymd(0), amount: deposit });
        }
        let running = 0;
        let scheduled = depositIncluded ? 0 : deposit;
        for (const inst of installments) {
          const amt = Number(inst.amount || 0);
          running += amt;
          if (running <= paidSoFar) continue;
          const due = inst.date || inst.dueDate || "";
          if (!due) continue;
          const rowAmt = Math.min(amt, Math.max(0, remaining - scheduled));
          if (rowAmt <= 0) break;
          rows.push({ date: due, amount: rowAmt });
          scheduled += rowAmt;
        }
        planRows = rows;
        hasMultiPlan = rows.length >= 2;
      }
    } catch (_e) {
      planRows = [];
      hasMultiPlan = false;
    }

    // ── GHL API helper ──
    // plain = true  → no paymentSchedule, no discount (single payable line).
    // plain = false → paymentSchedule { type: "fixed", schedules: [{dueDate,value}] }
    //                 with real dollar rows; items.amount MUST equal their sum.
    // Never uses type "amount" or invented percentages. Never calls /invoices/schedule.
    const money = (n: number) => Number(Number(n).toFixed(2));

    async function postInvoice(payload: any): Promise<{ ok: boolean; status: number; data: any; body: string }> {
      const res = await fetch("https://services.leadconnectorhq.com/invoices/", {
        method: "POST", headers: { ...crmHeaders, Version: "2021-07-28" }, body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch (_e) {}
      return { ok: res.ok, status: res.status, data, body: text };
    }

    async function createInvoice(
      lineAmount: number,
      sched?: PlanRow[],
      plain = false,
    ): Promise<{ ok: boolean; status: number; data: any; body: string }> {
      // When a multi-row schedule is present, the invoice dueDate MUST be the
      // latest schedule row date (GHL rejects schedules past the due date).
      // issueDate stays today.
      const latestDue = sched && sched.length > 1
        ? sched.reduce((latest, r) => (r.date > latest ? r.date : latest), sched[0].date)
        : ymd(7);

      const basePayload: any = {
        altId: locationId,
        altType: "location",
        name: invoiceTitle,
        title: "INVOICE",
        currency: "USD",
        liveMode: true,
        issueDate: ymd(0),
        dueDate: latestDue,
        sentTo: { email: [email], phone: phoneE164 ? [phoneE164] : [] },
        businessDetails,
        contactDetails,
        items: [{ name: label || "Wedding Payment", qty: 1, amount: money(lineAmount), currency: "USD" }],
      };

      // Plain (single payable line) — no paymentSchedule.
      if (plain || !sched || sched.length <= 1) {
        console.log(`[ghl-invoice] create invoice (plain=${plain}) payload:`, JSON.stringify(basePayload, null, 2));
        const r = await postInvoice(basePayload);
        console.log("[ghl-invoice] create status:", r.status, "body:", r.body.slice(0, 800));
        return r;
      }

      // Multi-row schedule: items.amount = sum of rows (2dp), value as NUMBER.
      const sumAmt = money(sched.reduce((s, r) => s + r.amount, 0));
      const payload = {
        ...basePayload,
        items: [{ name: label || "Wedding Payment", qty: 1, amount: sumAmt, currency: "USD" }],
        paymentSchedule: {
          type: "fixed",
          schedules: sched.map((r) => ({ dueDate: r.date, value: money(r.amount) })),
        },
      };
      console.log("[ghl-invoice] create invoice (fixed schedule) payload:", JSON.stringify(payload, null, 2));
      const res = await postInvoice(payload);
      console.log("[ghl-invoice] create status:", res.status, "body:", res.body.slice(0, 800));
      return res;
    }

    // Self-heal: add ghl_schedule_id column if missing so we can persist it.
    try {
      await db.rpc("exec_sql", {
        sql_text: "ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_schedule_id TEXT; NOTIFY pgrst, 'reload schema';",
      });
    } catch (_e) {}

    let scheduleId: string | null = null;
    let invoiceId: string | null = null;
    let invoiceUrl = "";
    let path: "schedule" | "invoice+paymentSchedule" = "invoice+paymentSchedule";
    let invoiceTotal = numAmount;
    let autoPayBody = "";
    let scheduleError = "";

    if (hasMultiPlan) {
      // ONE invoice = full remaining balance + paymentSchedule (fixed, real $ rows).
      // items[0].amount MUST equal the sum of the schedule rows.
      // Try exactly once with the fixed schedule shape.
      invoiceTotal = planRows.reduce((s, r) => s + r.amount, 0);
      const invRes = await createInvoice(invoiceTotal, planRows, false);

      if (invRes.ok) {
        path = "invoice+paymentSchedule";
        invoiceId = invRes.data?._id || invRes.data?.invoice?._id || invRes.data?.id || null;
      } else {
        // Schedule create failed — capture GHL's real message, then fall back to
        // a PLAIN invoice for the first due amount only so Sign & Pay still
        // opens a payable link.
        const ghlMessage =
          (invRes.data && (invRes.data.message || (Array.isArray(invRes.data.errors) ? invRes.data.errors.join("; ") : invRes.data.error))) ||
          invRes.body.slice(0, 500);
        console.log("[ghl-invoice] schedule invoice failed, falling back to plain first-due. error:", ghlMessage);
        scheduleError = String(ghlMessage);

        const firstDue = planRows[0]?.amount || numAmount;
        const plainRes = await createInvoice(firstDue, planRows, true);
        if (plainRes.ok) {
          invoiceId = plainRes.data?._id || plainRes.data?.invoice?._id || plainRes.data?.id || null;
          invoiceTotal = firstDue;
          path = "plain-firstDue";
        } else {
          const plainMsg =
            (plainRes.data && (plainRes.data.message || (Array.isArray(plainRes.data.errors) ? plainRes.data.errors.join("; ") : plainRes.data.error))) ||
            plainRes.body.slice(0, 500);
          return jsonResp({
            error: `Failed to create GHL invoice (${plainRes.status}): ${plainMsg}`,
            path,
            ghlStatus: plainRes.status,
            ghlBodyPreview: plainRes.body.slice(0, 800),
            ghlFull: plainRes.body,
            scheduleAttempt: { status: invRes.status, message: ghlMessage },
          }, 500);
        }
      }
    } else {
      invoiceTotal = numAmount;
      const invRes = await createInvoice(invoiceTotal);
      if (!invRes.ok) {
        const msg =
          (invRes.data && (invRes.data.message || (Array.isArray(invRes.data.errors) ? invRes.data.errors.join("; ") : invRes.data.error))) ||
          invRes.body.slice(0, 500);
        return jsonResp({
          error: `Failed to create GHL invoice (${invRes.status}): ${msg}`,
          path, ghlStatus: invRes.status, ghlBodyPreview: invRes.body.slice(0, 800), ghlFull: invRes.body,
        }, 500);
      }
      invoiceId = invRes.data?._id || invRes.data?.invoice?._id || invRes.data?.id || null;
    }

    if (!invoiceId) {
      return jsonResp({ error: "CRM invoice created but no invoice ID returned", scheduleId, path }, 500);
    }

    invoiceUrl = `${baseUrl}/invoice/${invoiceId}`;

    // 5. Send Invoice — ALWAYS send after create.
    const sendResult = await sendInvoice(invoiceId);

    // 6. GET the invoice to verify it's no longer in draft status.
    const statusAfter = await getInvoiceStatus(invoiceId);
    console.log("[ghl-invoice] invoice status after send:", statusAfter);

    if (statusAfter && statusAfter.toLowerCase() === "draft") {
      return jsonResp({
        error: "Invoice still draft",
        invoiceId, invoiceUrl, scheduleId, path,
        sendStatus: sendResult.status, sendBody: sendResult.body, statusAfter,
      }, 500);
    }

    // 7. Persist tracking on the wedding.
    try {
      const existingIds: string[] = Array.isArray(wedding.ghl_invoice_ids) ? wedding.ghl_invoice_ids : [];
      const ids = Array.from(new Set([...existingIds, invoiceId]));
      const scheduleRows = (hasMultiPlan && planRows.length > 0
        ? planRows
        : [{ date: ymd(0), amount: invoiceTotal }]
      ).map((r) => ({
        ...r,
        invoiceId,
        status: r.date === ymd(0) ? (statusAfter || "sent").toLowerCase() : "upcoming",
      }));
      const update: any = {
        ghl_invoice_id: invoiceId,
        ghl_invoice_ids: ids,
        ghl_invoice_url: invoiceUrl,
        ghl_invoice_status: (statusAfter || "sent").toLowerCase(),
        ghl_contact_id: contactId,
        ghl_schedule: scheduleRows,
        ghl_invoice_amount: invoiceTotal,
        ghl_invoice_created_date: today,
      };
      if (scheduleId) update.ghl_schedule_id = scheduleId;
      await db.from("weddings").update(update).eq("id", weddingId);
    } catch (e: any) {
      console.warn("[ghl-invoice] could not store ghl tracking:", e?.message);
    }

    return jsonResp({
      success: true,
      invoiceId,
      invoiceUrl,
      scheduleId,
      path,
      contactId,
      clientName,
      amount: invoiceTotal,
      firstDue: numAmount,
      baseUrlUsed: baseUrl,
      savedBaseUrl: savedBaseUrl,
      statusAfter,
      autoPayBodyPreview: autoPayBody || undefined,
      scheduleError: scheduleError || undefined,
    });
  } catch (err: any) {
    console.error("[ghl-invoice] unhandled:", err);
    return jsonResp({ error: err?.message || "Unexpected server error" }, 500);
  }
});
