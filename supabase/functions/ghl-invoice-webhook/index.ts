import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Parse a money-ish value: strip $, commas, spaces, then Number(). */
function parseMoney(v: any): number {
  if (v === null || v === undefined) return 0;
  const s = String(v)
    .replace(/[$,\s]/g, "")
    .replace(/USD/i, "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

const GHL_BASE = "https://services.leadconnectorhq.com";

async function fetchInvoiceList(
  qs: string,
  label: string,
  headers: Record<string, string>,
): Promise<any[]> {
  const url = `${GHL_BASE}/invoices/?${qs}`;
  console.log(`[ghl-invoice-webhook] list call (${label}):`, url);
  try {
    const res = await fetch(url, { headers });
    const rawText = await res.text();
    console.log(
      `[ghl-invoice-webhook] list (${label}) status:`,
      res.status,
      "body:",
      rawText.slice(0, 500),
    );
    if (!res.ok) return [];
    const json: any = JSON.parse(rawText);
    const invs: any[] =
      json?.invoices || json?.data?.invoices || json?.data || [];
    console.log(
      `[ghl-invoice-webhook] list (${label}) invoice count:`,
      Array.isArray(invs) ? invs.length : 0,
    );
    return Array.isArray(invs) ? invs : [];
  } catch (e: any) {
    console.warn(`[ghl-invoice-webhook] list (${label}) failed:`, e?.message);
    return [];
  }
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

    // Shared-secret guard (if configured).
    const expectedSecret = Deno.env.get("GHL_WEBHOOK_SECRET") || "";
    let savedSecret = "";
    let portalSettings: any = null;
    try {
      const { data: ps } = await db
        .from("portal_settings")
        .select("ghl_webhook_secret, hl_api_key, hl_location_id")
        .limit(1)
        .maybeSingle();
      portalSettings = ps;
      savedSecret = (ps?.ghl_webhook_secret || "").trim();
    } catch {}
    const secret = savedSecret || expectedSecret;
    if (secret) {
      const got = req.headers.get("x-webhook-secret") || "";
      if (got !== secret) {
        return jsonResp({ error: "Invalid webhook secret" }, 401);
      }
    }

    const raw = await req.text();
    let payload: any = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      return jsonResp({ error: "Invalid JSON" }, 400);
    }

    console.log(
      "[ghl-invoice-webhook] body top-level keys:",
      Object.keys(payload || {}),
    );

    const eventType: string =
      payload.type || payload.event || payload.eventType || "";

    // ── Flatten every possible location into one object ──
    const sources: any[] = [
      payload,
      payload.customData,
      payload.body,
      payload.body?.customData,
      payload.body?.invoice,
      payload.data,
      payload.data?.object,
      payload.invoice,
      payload.customData?.invoice,
    ];
    const flat: Record<string, any> = {};
    for (const src of sources) {
      if (src && typeof src === "object" && !Array.isArray(src)) {
        for (const k of Object.keys(src)) {
          if (flat[k] === undefined || flat[k] === null || flat[k] === "") {
            flat[k] = src[k];
          }
        }
      }
    }
    // Also flatten contactDetails / contact sub-objects for email/id.
    for (const sub of [
      flat.contactDetails,
      flat.contact,
      payload.contactDetails,
      payload.contact,
    ]) {
      if (sub && typeof sub === "object") {
        for (const k of Object.keys(sub)) {
          if (flat[k] === undefined || flat[k] === null || flat[k] === "") {
            flat[k] = sub[k];
          }
        }
      }
    }

    console.log(
      "[ghl-invoice-webhook] flattened keys:",
      JSON.stringify(Object.keys(flat)),
    );
    console.log(
      "[ghl-invoice-webhook] raw values:",
      JSON.stringify({
        invoice_amount_paid: flat.invoice_amount_paid,
        invoice_status: flat.invoice_status,
        invoice_total_price: flat.invoice_total_price,
        invoice_amount_due: flat.invoice_amount_due,
        invoice_number: flat.invoice_number,
        contact_email: flat.contact_email,
      }),
    );

    // Case-insensitive lookup helper.
    const pick = (...keys: string[]): any => {
      for (const k of keys) {
        if (flat[k] !== undefined && flat[k] !== null && flat[k] !== "") {
          return flat[k];
        }
      }
      const lower = Object.keys(flat).reduce((acc: Record<string, any>, k) => {
        acc[k.toLowerCase()] = flat[k];
        return acc;
      }, {});
      for (const k of keys) {
        const lk = k.toLowerCase();
        if (lower[lk] !== undefined && lower[lk] !== null && lower[lk] !== "") {
          return lower[lk];
        }
      }
      return undefined;
    };

    // ── Resolve the invoice id from every possible field ──
    let invoiceId: string =
      pick("_id", "id", "invoiceId", "invoice_id") || "";

    const invoiceNumber: string =
      pick("invoice_number", "invoiceNumber", "number") || "";

    let status: string = (
      pick("status", "statusType", "invoice_status", "status_type") || ""
    ).toString().toLowerCase();

    let amountPaid = parseMoney(
      pick(
        "invoice_amount_paid",
        "amount_paid",
        "amountPaid",
        "Invoice Amount Paid",
        "paid",
      ) || 0,
    );
    let total = parseMoney(
      pick("invoice_total_price", "total", "amount", "Invoice Total Price") ||
        0,
    );
    let amountDue = parseMoney(
      pick("invoice_amount_due", "amountDue", "amount_due", "Invoice Amount Due") ||
        Math.max(0, total - amountPaid),
    );

    let effectiveAmountPaid =
      amountPaid > 0
        ? amountPaid
        : status === "paid" || status === "partially_paid"
          ? total > 0
            ? total
            : amountDue
          : 0;

    const contactEmail: string = (
      pick("contact_email", "email", "client_email") || ""
    ).toString().toLowerCase().trim();

    const contactId: string =
      pick("contact_id", "contactId", "contactDetails.id") || "";

    console.log(
      "[ghl-invoice-webhook] parsed:",
      JSON.stringify({
        invoiceId,
        invoiceNumber,
        status,
        amountPaid,
        total,
        amountDue,
        effectiveAmountPaid,
        contactEmail,
        eventType,
      }),
    );

    // ── Fallback: GHL workflow may post empty values; fetch the invoice list ──
    if (effectiveAmountPaid <= 0) {
      console.log(
        "[ghl-invoice-webhook] triggerData:",
        JSON.stringify(payload.triggerData || {}).slice(0, 2000),
      );
      console.log(
        "[ghl-invoice-webhook] customData:",
        JSON.stringify(payload.customData || {}).slice(0, 2000),
      );

      const fbApiKey = (portalSettings?.hl_api_key || "").trim();
      const fbLocationId = (portalSettings?.hl_location_id || "").trim();
      if (fbApiKey && fbLocationId) {
        const fbHeaders: Record<string, string> = {
          Authorization: `Bearer ${fbApiKey}`,
          Version: "2021-07-28",
          Accept: "application/json",
        };

        // Three GET attempts in order, each with full debug capture.
        const attempts: {
          label: string;
          qs: string;
        }[] = [];

        if (contactId) {
          attempts.push({
            label: "contactId",
            qs: `altId=${fbLocationId}&altType=location&limit=20&offset=0&contactId=${contactId}`,
          });
        }
        if (contactEmail) {
          attempts.push({
            label: "searchEmail",
            qs: `altId=${fbLocationId}&altType=location&limit=20&offset=0&search=${encodeURIComponent(contactEmail)}`,
          });
        }
        attempts.push({
          label: "recent",
          qs: `altId=${fbLocationId}&altType=location&limit=20&offset=0`,
        });

        let invoices: any[] = [];
        let lastGhlHttp = 0;
        let lastGhlBodyPreview = "";
        let lastGhlUrl = "";
        const tried: string[] = [];

        for (const att of attempts) {
          tried.push(att.label);
          const url = `${GHL_BASE}/invoices/?${att.qs}`;
          lastGhlUrl = url;
          console.log(`[ghl-invoice-webhook] list call (${att.label}):`, url);
          try {
            const res = await fetch(url, { headers: fbHeaders });
            lastGhlHttp = res.status;
            const rawText = await res.text();
            lastGhlBodyPreview = rawText.slice(0, 300);
            console.log(
              `[ghl-invoice-webhook] list (${att.label}) status:`,
              res.status,
              "body:",
              rawText.slice(0, 500),
            );
            if (res.ok) {
              const json: any = JSON.parse(rawText);
              const invs: any[] =
                json?.invoices || json?.data?.invoices || json?.data || [];
              if (Array.isArray(invs) && invs.length > 0) {
                invoices = invs;
                console.log(
                  `[ghl-invoice-webhook] list (${att.label}) invoice count:`,
                  invs.length,
                );
                break;
              }
            }
          } catch (e: any) {
            console.warn(
              `[ghl-invoice-webhook] list (${att.label}) failed:`,
              e?.message,
            );
          }
        }

        if (invoices.length === 0) {
          return jsonResp({
            ignored: "ghl list empty",
            contact_id: contactId,
            contact_email: contactEmail,
            invoice_number: invoiceNumber,
            tried,
            ghlHttp: lastGhlHttp,
            ghlBodyPreview: lastGhlBodyPreview,
            ghlUrl: lastGhlUrl,
          });
        }

        // Match: invoice_number → wedding ghl_invoice_id → contact email → most recent.
        let matched: any = null;

        if (invoiceNumber) {
          matched = invoices.find(
            (inv: any) =>
              inv.number === invoiceNumber ||
              inv.invoiceNumber === invoiceNumber ||
              inv._id === invoiceNumber,
          );
        }

        if (!matched && contactEmail) {
          const { data: byInvId } = await db
            .from("weddings")
            .select("id, ghl_invoice_id, ghl_invoice_ids, client_email")
            .eq("client_email", contactEmail)
            .limit(1)
            .maybeSingle();
          const storedIds: string[] = [];
          if (byInvId?.ghl_invoice_id) storedIds.push(byInvId.ghl_invoice_id);
          if (Array.isArray(byInvId?.ghl_invoice_ids)) {
            storedIds.push(...byInvId.ghl_invoice_ids);
          }
          if (storedIds.length > 0) {
            matched = invoices.find((inv: any) =>
              storedIds.includes(inv._id || inv.id || ""),
            );
          }
        }

        if (!matched && contactEmail) {
          matched = invoices.find((inv: any) => {
            const em = (
              inv.contactDetails?.email ||
              inv.contact?.email ||
              inv.email ||
              ""
            )
              .toString()
              .toLowerCase()
              .trim();
            return em && em === contactEmail;
          });
        }

        if (!matched) {
          matched = [...invoices].sort(
            (a: any, b: any) =>
              new Date(b.updatedAt || b.dateUpdated || 0).getTime() -
              new Date(a.updatedAt || a.dateUpdated || 0).getTime(),
          )[0];
        }

        if (matched) {
          const mPaid = parseMoney(matched.amountPaid ?? matched.amount_paid ?? 0);
          const mTotal = parseMoney(
            matched.total ?? matched.totalPrice ?? matched.total_price ?? 0,
          );
          const mStatus = (matched.status || "").toString().toLowerCase();
          const mId = matched._id || matched.id || "";
          if (mId) invoiceId = mId;
          if (mStatus) status = mStatus;
          total = mTotal || total;
          amountDue = parseMoney(
            matched.amountDue ??
              matched.amount_due ??
              Math.max(0, mTotal - mPaid),
          );
          amountPaid = mPaid;
          effectiveAmountPaid =
            mPaid > 0
              ? mPaid
              : mStatus === "paid" || mStatus === "partially_paid"
                ? mTotal > 0
                  ? mTotal
                  : amountDue
                : 0;
          console.log(
            "[ghl-invoice-webhook] fallback invoice matched:",
            JSON.stringify({ mId, mStatus, mPaid, mTotal, effectiveAmountPaid }),
          );
        }
      }
    }

    // ── Find the wedding ──
    let wedding: any = null;
    const orClauses: string[] = [];
    if (invoiceId) {
      orClauses.push(`ghl_invoice_id.eq.${invoiceId}`);
      orClauses.push(`ghl_invoice_ids.cs.${JSON.stringify([invoiceId])}`);
    }
    if (contactId) {
      orClauses.push(`ghl_contact_id.eq.${contactId}`);
    }
    if (contactEmail) {
      orClauses.push(`client_email.eq.${contactEmail}`);
    }

    let candidates: any[] = [];
    if (orClauses.length > 0) {
      const { data } = await db
        .from("weddings")
        .select(
          "id, client_name, client_email, paid_amount, total_amount, status, notes, ghl_contact_id, ghl_invoice_id, ghl_invoice_ids, ghl_schedule, ghl_amount_paid",
        )
        .or(orClauses.join(","))
        .limit(5);
      candidates = data || [];
    }

    if (candidates.length > 0) {
      wedding =
        (invoiceId
          ? candidates.find((w: any) => w.ghl_invoice_id === invoiceId)
          : null) ||
        (invoiceId
          ? candidates.find((w: any) => {
              const ids: string[] = Array.isArray(w.ghl_invoice_ids)
                ? w.ghl_invoice_ids
                : [];
              return ids.includes(invoiceId);
            })
          : null) ||
        (contactEmail
          ? candidates.find(
              (w: any) =>
                (w.client_email || "").toLowerCase().trim() === contactEmail,
            )
          : null) ||
        candidates[0];
    }

    // Also try matching invoice_number against ghl_schedule rows.
    if (!wedding && invoiceNumber) {
      const { data: numMatches } = await db
        .from("weddings")
        .select(
          "id, client_name, client_email, paid_amount, total_amount, status, notes, ghl_contact_id, ghl_invoice_id, ghl_invoice_ids, ghl_schedule, ghl_amount_paid",
        )
        .not("ghl_schedule", "is", null)
        .limit(50);
      if (numMatches) {
        wedding = numMatches.find((w: any) => {
          const rows: any[] = Array.isArray(w.ghl_schedule) ? w.ghl_schedule : [];
          return rows.some(
            (r) =>
              r.invoiceNumber === invoiceNumber || r.invoice_number === invoiceNumber,
          );
        });
      }
    }

    if (!wedding) {
      return jsonResp({
        ignored: "no wedding",
        invoiceId,
        invoiceNumber,
        contactEmail,
      });
    }

    const weddingId = wedding.id;

    const ledgerKey = invoiceId || invoiceNumber || `email:${contactEmail}`;

    // Idempotent per-invoice running total.
    const { data: existing } = await db
      .from("ghl_invoice_payments")
      .select("id, amount_paid_on_invoice")
      .eq("ghl_invoice_id", ledgerKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const stored = Number(existing?.amount_paid_on_invoice || 0);

    if (effectiveAmountPaid > 0 && effectiveAmountPaid <= stored) {
      return jsonResp({
        ignored: "idempotent",
        invoiceId: ledgerKey,
        weddingId,
        stored,
        incoming: effectiveAmountPaid,
      });
    }

    if (effectiveAmountPaid <= 0 && stored <= 0) {
      return jsonResp({
        ignored: "no payment amount",
        invoiceId: ledgerKey,
        weddingId,
        status,
        keys: Object.keys(flat),
        rawPaid: flat.invoice_amount_paid,
        rawStatus: flat.invoice_status,
        rawTotal: flat.invoice_total_price,
        rawDue: flat.invoice_amount_due,
      });
    }

    const delta = Math.max(0, effectiveAmountPaid - stored);

    if (existing?.id) {
      await db
        .from("ghl_invoice_payments")
        .update({
          amount_paid_on_invoice: effectiveAmountPaid,
          amount: total,
        })
        .eq("id", existing.id);
    } else {
      const eventId: string =
        payload.id ||
        payload.eventId ||
        payload.event_id ||
        `ghl:${ledgerKey}:${effectiveAmountPaid}`;
      try {
        await db.from("ghl_invoice_payments").insert({
          wedding_id: weddingId,
          ghl_invoice_id: ledgerKey,
          ghl_event_id: eventId,
          amount: total,
          amount_paid_on_invoice: effectiveAmountPaid,
        });
      } catch {
        // ghl_event_id unique may collide on retries — ledger already updated.
      }
    }

    const newPaid = Math.max(0, (Number(wedding.paid_amount) || 0) + delta);

    let scheduleRows: any[] = Array.isArray(wedding.ghl_schedule)
      ? wedding.ghl_schedule
      : [];
    const ps = pick("paymentSchedule", "payment_schedule", "schedule") || [];
    if (Array.isArray(ps) && ps.length > 0) {
      scheduleRows = ps.map((row: any) => ({
        date: row.date || row.dueDate || "",
        amount: Number(row.amount || 0),
        status: (
          row.status ||
          (Number(row.amount) <= effectiveAmountPaid ? "paid" : "upcoming")
        )
          .toString()
          .toLowerCase(),
        invoiceId: ledgerKey,
        invoiceNumber: invoiceNumber || undefined,
      }));
    } else if (scheduleRows.length === 0) {
      scheduleRows = [
        {
          date: new Date().toISOString().split("T")[0],
          amount: total,
          status:
            status === "paid"
              ? "paid"
              : effectiveAmountPaid > 0
                ? "partially_paid"
                : status || "upcoming",
          invoiceId: ledgerKey,
          invoiceNumber: invoiceNumber || undefined,
        },
      ];
    }

    let booked = false;
    const isCancelled = wedding.status === "cancelled";
    // Do NOT change wedding status (no pending → upcoming/booked activation).
    // Only strip the [UNPAID_DRAFT] tag from notes and flag for staff review.
    if (newPaid > 0 && !isCancelled) {
      const hadDraftTag = (wedding.notes || "").includes("[UNPAID_DRAFT]");
      const cleanedNotes = (wedding.notes || "")
        .replace("[UNPAID_DRAFT]\n", "")
        .replace("[UNPAID_DRAFT]", "")
        .trim();
      const reviewTag = "GHL deposit posted — review before activating";
      const notesHasReview = cleanedNotes.includes(reviewTag);
      if (hadDraftTag || !notesHasReview) {
        const up: any = {
          notes: notesHasReview
            ? cleanedNotes
            : `${cleanedNotes}${cleanedNotes ? " " : ""}${reviewTag}`,
        };
        await db.from("weddings").update(up).eq("id", weddingId);
      }
      booked = false; // status left untouched; staff activates manually
    }

    try {
      const { data: primaryTerr } = await db
        .from("territories")
        .select("id")
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle();
      let territoryId = primaryTerr?.id;
      if (!territoryId) {
        const { data: anyTerr } = await db
          .from("territories")
          .select("id")
          .limit(1)
          .maybeSingle();
        territoryId = anyTerr?.id;
      }
      if (territoryId && delta > 0) {
        const chargeKey = `ghl:${ledgerKey}:${effectiveAmountPaid}`;
        const { data: dup } = await db
          .from("royalty_sales")
          .select("id")
          .eq("stripe_charge_id", chargeKey)
          .maybeSingle();
        if (!dup) {
          await db.from("royalty_sales").insert({
            territory_id: territoryId,
            wedding_id: weddingId,
            sale_amount: delta,
            sale_date: new Date().toISOString().split("T")[0],
            description: `GHL invoice payment — ${wedding.client_name || "client"}`,
            is_refund: false,
            stripe_charge_id: chargeKey,
          });
        }
      }
    } catch (e: any) {
      console.warn("[ghl-invoice-webhook] royalty sale failed:", e?.message);
    }

    const update: any = {
      paid_amount: newPaid,
      ghl_amount_paid: newPaid,
      ghl_invoice_status: status,
      ghl_schedule: scheduleRows,
    };
    if (invoiceId) update.ghl_invoice_id = invoiceId;
    if (contactId && !wedding.ghl_contact_id) {
      update.ghl_contact_id = contactId;
    }
    update.final_payment_verified =
      newPaid >= (Number(wedding.total_amount) || 0) - 0.01;
    await db.from("weddings").update(update).eq("id", weddingId);

    return jsonResp({
      weddingId,
      invoiceId: ledgerKey,
      invoiceNumber,
      delta,
      paid_amount: newPaid,
      booked,
      invoiceStatus: status,
    });
  } catch (err: any) {
    console.error("[ghl-invoice-webhook] unhandled:", err);
    return jsonResp({ error: err?.message || "Unexpected server error" }, 500);
  }
});
