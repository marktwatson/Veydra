// daily-digest — fires once per day (via the app heartbeat, the first time an
// owner/super_admin opens the app after 9 AM company timezone) to send a single
// morning push structured as a daily owner business report:
//
//   Leads: 3 new · Bookings: 2 signed ($5,400) · Outstanding: 4 payments, 1 overdue edit
//
// Every section always appears (even when zero) so the owner gets a consistent
// daily snapshot. A manual test can bypass the once-per-day guard by sending
// { force: true } — used by the "Send Digest Now" button in Settings.
//
// Queries weddings + portal_settings directly and calls the CRM contacts API
// for new leads, then calls send-push with category="daily_digest" + roles
// resolution so only users with that category enabled receive it.

import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_e) {
    body = {};
  }
  const force: boolean = body?.force === true;

  try {
    const su = Deno.env.get("SUPABASE_URL") || "";
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!su || !sk) {
      return new Response(JSON.stringify({ error: "Missing Supabase env", success: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const db = createClient(su, sk);

    // ── Once-per-day guard (fail-closed) ─────────────────────────────────
    // Select * (not specific columns) so the read never errors if the
    // last_digest_date column is absent after a partial sync. Then atomically
    // claim today's date. If the column is missing the update errors → we
    // skip instead of spamming on every call. This is the ONLY thing
    // preventing duplicate digests when both the heartbeat and a cron call
    // this function the same day. A manual `force: true` bypasses the guard
    // entirely so the owner can test the digest at any time.
    const { data: pSettings, error: psError } = await db
      .from("portal_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (psError || !pSettings?.id) {
      return new Response(
        JSON.stringify({ success: true, skipped: "no portal_settings row" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const tz = pSettings.timezone || "America/New_York";
    const tzNow = new Date().toLocaleString("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const [tm, td, ty] = tzNow.split("/");
    const todayTz = `${ty}-${tm}-${td}`;

    if (!force) {
      if (pSettings.last_digest_date === todayTz) {
        return new Response(JSON.stringify({ success: true, skipped: "already sent today" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Atomic claim: only one concurrent caller wins (the .neq filter ensures
      // the row still has a different/empty last_digest_date at write time).
      const { data: claimed, error: claimError } = await db
        .from("portal_settings")
        .update({ last_digest_date: todayTz })
        .eq("id", pSettings.id)
        .neq("last_digest_date", todayTz)
        .select("id")
        .maybeSingle();
      if (claimError || !claimed) {
        return new Response(
          JSON.stringify({ success: true, skipped: "race lost or column missing" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const hourStr = new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false });
      const currentHour = parseInt(hourStr, 10);
      if (currentHour < 9) {
        return new Response(JSON.stringify({ success: true, skipped: "before 9 AM" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // ── LEADS: new leads in the last 24h (via CRM contacts API) ─────────
    // Reads the CRM API key + location from portal_settings and paginates the
    // contacts endpoint. CRM contacts are returned newest-first, so we stop
    // paging as soon as we hit a contact older than 24h.
    let newLeads24h = 0;
    const hlApiKey = pSettings.hl_api_key;
    const hlLocationId = pSettings.hl_location_id;
    if (hlApiKey && hlLocationId) {
      try {
        const crmHeaders = {
          Authorization: `Bearer ${hlApiKey}`,
          Version: "v3",
          "Content-Type": "application/json",
        };
        const cutoff = new Date(yesterday).getTime();
        let startAfter = "";
        let hasNext = true;
        let pages = 0;
        while (hasNext && pages < 5) {
          pages++;
          let url = `https://services.leadconnectorhq.com/contacts/?locationId=${hlLocationId}&limit=100`;
          if (startAfter) url += `&startAfter=${encodeURIComponent(startAfter)}`;
          const res = await fetch(url, { headers: crmHeaders });
          if (!res.ok) break;
          const json = await res.json();
          const batch: any[] = json.contacts || [];
          let stop = false;
          for (const c of batch) {
            const d = c.dateAdded || c.createdAt || "";
            if (d && new Date(d).getTime() >= cutoff) {
              newLeads24h++;
            } else if (d) {
              // Older than 24h — contacts are newest-first, so we can stop.
              stop = true;
              break;
            }
          }
          if (stop || batch.length === 0) break;
          hasNext = !!json.meta?.nextPageToken;
          startAfter = json.meta?.nextPageToken || "";
        }
      } catch (e) {
        console.warn("[daily-digest] CRM leads fetch failed:", e);
      }
    }

    // ── BOOKINGS: weddings that crossed into a booked state in the last 24h ─
    // A "booking" = a wedding that moved to active/confirmed (signed contract)
    // within the last 24h. Sum their total_amount for signed revenue.
    const { data: recentBookings } = await db
      .from("weddings")
      .select("client_name, total_amount, status, created_at")
      .in("status", ["active", "confirmed"])
      .gte("created_at", yesterday);

    const bookingsList = (recentBookings || []).filter(
      (w: any) => w.status === "active" || w.status === "confirmed",
    );
    const bookingsCount = bookingsList.length;
    const bookingsRevenue = bookingsList.reduce(
      (sum: number, w: any) => sum + (Number(w.total_amount) || 0),
      0,
    );

    // ── OUTSTANDING: payments needing attention + overdue edits ──────────
    // Payments needing attention: active/pending/confirmed weddings with an
    // outstanding balance > $1 and final_payment_verified not set.
    const { data: actionItems } = await db
      .from("weddings")
      .select("client_name, total_amount, paid_amount, final_payment_verified")
      .in("status", ["active", "pending", "confirmed"]);

    let overdueCount = 0;
    (actionItems || []).forEach((w: any) => {
      const outstanding = (Number(w.total_amount) || 0) - (Number(w.paid_amount) || 0);
      if (outstanding > 1 && !w.final_payment_verified) overdueCount++;
    });

    // Overdue post-production: weddings in upcoming/completed status whose
    // editing deadline has passed and aren't delivered yet. Deadline =
    // editor_due_date if set, else wedding date + 21 days (28 in busy season
    // Sep–Nov), matching the PostProduction board's calculateDeadline logic.
    const { data: postProd } = await db
      .from("weddings")
      .select("date, editor_due_date, editing_status")
      .in("status", ["upcoming", "completed"]);

    let postProdOverdue = 0;
    const nowMs = Date.now();
    (postProd || []).forEach((w: any) => {
      const es = w.editing_status || "awaiting_raw_media";
      if (es === "delivered") return;
      let deadline: Date;
      if (w.editor_due_date) {
        deadline = new Date(w.editor_due_date);
      } else {
        deadline = new Date(w.date);
        const month = deadline.getMonth(); // 0 = Jan, 8 = Sep, 10 = Nov
        const isBusySeason = month >= 8 && month <= 10;
        deadline.setDate(deadline.getDate() + (isBusySeason ? 28 : 21));
      }
      if (deadline.getTime() < nowMs) postProdOverdue++;
    });

    // Also surface upcoming weddings this week inside Outstanding (things to
    // act on soon).
    const { data: upcoming } = await db
      .from("weddings")
      .select("client_name, date, status")
      .gte("date", todayStr)
      .lte("date", weekAhead)
      .in("status", ["active", "pending", "confirmed"])
      .order("date", { ascending: true })
      .limit(50);
    const upcomingCount = (upcoming || []).filter(
      (w: any) => w.status === "active" || w.status === "confirmed",
    ).length;

    // ── UPCOMING PAYMENTS due in the next 7 days ─────────────────────────
    // Scans custom_payment_plan installments for dates in [today, today+7]
    // that are still owed. Custom plans store explicit due dates in the DB;
    // standard plan dates are derived client-side so only custom is reliable
    // here. Counts the number + dollar total due this week.
    const { data: planRows } = await db
      .from("weddings")
      .select("paid_amount, custom_payment_plan")
      .in("status", ["active", "pending", "confirmed"]);

    let upcomingPaymentsCount = 0;
    let upcomingPaymentsTotal = 0;
    (planRows || []).forEach((w: any) => {
      const cpp = w.custom_payment_plan;
      if (!cpp || cpp.enabled !== true) return;
      const installments = Array.isArray(cpp.installments) ? cpp.installments : [];
      installments.forEach((inst: any) => {
        const d = inst.date ? String(inst.date).slice(0, 10) : null;
        if (!d) return;
        if (d >= todayStr && d <= weekAhead) {
          upcomingPaymentsCount++;
          upcomingPaymentsTotal += Number(inst.amount) || 0;
        }
      });
    });

    // ── Build the digest body (structured owner report) ──────────────────
    // Always show all three sections so the report is consistent day to day.
    // Push bodies are short (~100-200 chars), so keep each line tight.
    const leadsLine = `Leads: ${newLeads24h} new in 24h`;
    const bookingsLine = bookingsCount > 0
      ? `Bookings: ${bookingsCount} signed (${formatCurrency(bookingsRevenue)})`
      : "Bookings: 0 signed today";
    const outstandingParts: string[] = [];
    if (overdueCount > 0) outstandingParts.push(`${overdueCount} overdue payment${overdueCount > 1 ? "s" : ""}`);
    if (upcomingPaymentsCount > 0) outstandingParts.push(`${upcomingPaymentsCount} due this week (${formatCurrency(upcomingPaymentsTotal)})`);
    if (postProdOverdue > 0) outstandingParts.push(`${postProdOverdue} overdue edit${postProdOverdue > 1 ? "s" : ""}`);
    if (upcomingCount > 0) outstandingParts.push(`${upcomingCount} wedding${upcomingCount > 1 ? "s" : ""} this week`);
    const outstandingLine = `Outstanding: ${outstandingParts.length ? outstandingParts.join(", ") : "all caught up"}`;

    const digestBody = `${leadsLine} · ${bookingsLine} · ${outstandingLine}`;

    // ── Send the push ───────────────────────────────────────────────────
    const pushRes = await fetch(`${su}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sk}`,
        apikey: sk,
      },
      body: JSON.stringify({
        action: "send",
        roles: ["owner", "super_admin"],
        category: "daily_digest",
        title: force ? "Veydra — Digest (Test)" : "Veydra — Daily Owner Report",
        body: digestBody,
        url: "/manager",
        tag: force ? "daily-digest-test" : "daily-digest",
      }),
    });
    const pushData = await pushRes.json().catch(() => ({}));

    return new Response(
      JSON.stringify({
        success: true,
        digest: {
          leads: newLeads24h,
          bookings: bookingsCount,
          bookingsRevenue,
          paymentsNeedingAttention: overdueCount,
          overdueEdits: postProdOverdue,
          upcomingThisWeek: upcomingCount,
          upcomingPaymentsDue: upcomingPaymentsCount,
          upcomingPaymentsTotal,
        },
        body: digestBody,
        forced: force,
        push: pushData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
