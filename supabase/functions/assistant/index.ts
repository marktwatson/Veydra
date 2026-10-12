import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { ARTICLES } from "./knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function allowedTerritories(db: any, user: any): Promise<Set<string> | "super" | null> {
  const email = String(user?.email || "").toLowerCase();
  if (!email) return null;
  const { data: rows } = await db
    .from("managers")
    .select("role, territory_id, territory_ids, status")
    .ilike("email", email);
  const active = (rows || []).filter((row: any) => !row.status || row.status === "active");
  if (active.some((row: any) => row.role === "super_admin")) return "super";
  const ids = new Set<string>();
  for (const row of active) {
    if (row.territory_id) ids.add(row.territory_id);
    for (const id of row.territory_ids || []) if (id) ids.add(id);
  }
  return ids.size ? ids : null;
}

function isBooked(wedding: any) {
  if (wedding.status === "cancelled" || wedding.status === "draft") return false;
  if (wedding.status === "upcoming" || wedding.status === "completed") return true;
  return Number(wedding.paid_amount) > 0 && wedding.status !== "pending";
}

function dayInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
  };
}

function shiftIso(iso: string, days: number) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const next = date.toISOString().slice(0, 10);
  return next.startsWith("NaN") ? "" : next;
}

function periodRange(period: string, timeZone: string, from?: string, to?: string) {
  const today = dayInZone(new Date(), timeZone).iso;
  if (period === "custom" && from && to) return { from, to, label: `${from} to ${to}` };
  if (period === "this_month") return { from: today.slice(0, 8) + "01", to: today, label: "this month" };
  if (period === "this_week") {
    const weekday = dayInZone(new Date(), timeZone).weekday;
    const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
    const sinceMonday = index === 0 ? 6 : index - 1;
    return { from: shiftIso(today, -sinceMonday), to: today, label: "this week" };
  }
  return { from: null, to: null, label: "all time" };
}

function isoDay(value: unknown, timeZone: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    if (raw.length > 10) {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) return dayInZone(date, timeZone).iso;
    }
    return raw.slice(0, 10);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return dayInZone(parsed, timeZone).iso;
}

function scheduleDay(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw === "TBD") return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parts = raw.split("/");
  if (parts.length === 3) {
    const [month, day, year] = parts;
    if (year && month && day) return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return "";
}

function bookedOn(wedding: any) {
  return String(wedding.contract_signed_at || wedding.booked_on || wedding.created_at || "").slice(0, 10);
}

function auditRowsFor(wedding: any, timeZone: string) {
  const total = Number(wedding.total_amount) || 0;
  const paid = Number(wedding.paid_amount) || 0;
  let plan = wedding.custom_payment_plan;
  if (typeof plan === "string") {
    try {
      plan = JSON.parse(plan);
    } catch {
      plan = null;
    }
  }
  const rows: { date: string; amount: number; label: string }[] = [];
  const start = scheduleDay(isoDay(wedding.contract_date, timeZone) || isoDay(wedding.created_at, timeZone));
  const installments = Array.isArray(plan?.installments) ? plan.installments : [];
  const deposit = Number(plan?.deposit) || 0;
  const schedule = Array.isArray(wedding.ghl_schedule) ? wedding.ghl_schedule : [];
  if (wedding.payment_plan === "custom" || plan?.enabled || installments.length || deposit > 0 || schedule.length) {
    if (deposit > 0 && start) rows.push({ date: start, amount: deposit, label: "Initial Retainer" });
    const source = installments.length ? installments : schedule;
    source.forEach((inst: any, index: number) => {
      rows.push({
        date: scheduleDay(inst?.date || inst?.dueDate),
        amount: Number(inst?.amount) || 0,
        label: inst?.label || `Installment #${index + 1}`,
      });
    });
  }
  if (!rows.length && start) {
    const option = String(wedding.payment_plan || "full");
    const weddingDay = scheduleDay(wedding.date);
    const finalDay = weddingDay ? shiftIso(weddingDay, -10) : "";
    if (option === "half" || option === "fifty_fifty") {
      rows.push({ date: start, amount: total / 2, label: "50% Deposit" });
      if (finalDay) rows.push({ date: finalDay, amount: total / 2, label: "Final Balance" });
    } else if (option === "deposit" || option === "monthly" || option === "quarterly") {
      const retainer = Math.min(99, total);
      rows.push({ date: start, amount: retainer, label: "Initial Retainer" });
      let remaining = total - retainer;
      let current = shiftIso(start, 30);
      const step = option === "quarterly" ? 90 : 30;
      while (finalDay && current < finalDay && remaining > 0) {
        const amount = Math.min(250, remaining);
        rows.push({ date: current, amount, label: "Installment" });
        remaining -= amount;
        current = shiftIso(current, step);
      }
      if (remaining > 0 && finalDay) rows.push({ date: finalDay, amount: remaining, label: "Final Balance" });
    } else {
      rows.push({ date: start, amount: total, label: option === "full" ? "Pay in Full" : "Package Payment" });
    }
  }
  let running = 0;
  return rows.map((row, index) => {
    const coveredBefore = running;
    const status = paid >= running + row.amount - 0.5 ? "paid" : paid > running + 0.5 ? "partial" : "pending";
    running += row.amount;
    const due = status === "paid" ? 0 : Math.max(0, row.amount - Math.max(0, paid - coveredBefore));
    return {
      name: wedding.client_name,
      label: row.label,
      date: row.date,
      amount: Math.round(row.amount * 100) / 100,
      due: Math.round(due * 100) / 100,
      status,
      is_first: index === 0,
      package_total: total,
      paid,
      wedding_status: wedding.status,
    };
  });
}

async function loadAreaWeddings(db: any, territoryId: string) {
  const rows: any[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await db
      .from("weddings")
      .select("id, client_name, date, status, notes, total_amount, paid_amount, payment_plan, custom_payment_plan, ghl_schedule, editing_status, created_at, contract_date")
      .eq("territory_id", territoryId)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) return { rows, error: error.message };
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { rows, error: "" };
}

function summarize(rows: any[]) {
  const value = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const collected = rows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
  return {
    booked_count: rows.length,
    booked_value: Math.round(value * 100) / 100,
    collected: Math.round(collected * 100) / 100,
    still_owed: Math.round(Math.max(0, value - collected) * 100) / 100,
    weddings: rows.slice(0, 12).map((row) => ({
      name: row.client_name,
      wedding_date: row.date,
      booked_on: bookedOn(row),
      total: Number(row.total_amount || 0),
      paid: Number(row.paid_amount || 0),
    })),
  };
}

async function areaSnapshot(db: any, territoryId: string, args: any) {
  const [{ data: area }, { data: settings }, { data: jobs }, { data: proposals }, weddingLoad] = await Promise.all([
    db.from("territories").select("name").eq("id", territoryId).maybeSingle(),
    db.from("portal_settings").select("company_name, timezone").eq("territory_id", territoryId).limit(1).maybeSingle(),
    db.from("jobs").select("role, wedding_id").eq("territory_id", territoryId).eq("status", "open"),
    db.from("proposals").select("client_name, wedding_id, status, total_amount, amount_paid_so_far, contract_signed_at, wedding_date, salesperson_name, salesperson_email, sent_at, created_at").eq("territory_id", territoryId).limit(2000),
    loadAreaWeddings(db, territoryId),
  ]);
  const rows = weddingLoad.rows || [];
  const timeZone = settings?.timezone || "America/New_York";
  const range = periodRange(String(args?.period || "all"), timeZone, args?.from, args?.to);
  const signByWedding = new Map<string, string>();
  for (const proposal of proposals || []) {
    const day = isoDay(proposal.contract_signed_at, timeZone);
    if (proposal.wedding_id && day && !signByWedding.has(proposal.wedding_id)) {
      signByWedding.set(proposal.wedding_id, day);
    }
  }
  const firstPayment = new Map<string, string>();
  const paymentsReceived: any[] = [];
  const weddingIds = rows.map((row: any) => row.id);
  const byId = new Map(rows.map((row: any) => [row.id, row]));
  const inWindow = (day: string) => !!range.from && !!day && day >= range.from && day <= range.to;
  for (let index = 0; index < weddingIds.length; index += 200) {
    const slice = weddingIds.slice(index, index + 200);
    const [{ data: payments }, { data: adjustments }] = await Promise.all([
      db.from("ghl_invoice_payments").select("wedding_id, amount, created_at").in("wedding_id", slice),
      db.from("payment_manual_adjustments").select("wedding_id, amount, created_at, reason").in("wedding_id", slice),
    ]);
    for (const payment of payments || []) {
      const day = isoDay(payment.created_at, timeZone);
      const previous = firstPayment.get(payment.wedding_id);
      if (day && (!previous || day < previous)) firstPayment.set(payment.wedding_id, day);
      if (inWindow(day)) {
        const wedding = byId.get(payment.wedding_id);
        paymentsReceived.push({
          name: wedding?.client_name,
          date: day,
          amount: Number(payment.amount || 0),
          package_total: Number(wedding?.total_amount || 0),
          source: "invoice",
        });
      }
    }
    for (const adjustment of adjustments || []) {
      const day = isoDay(adjustment.created_at, timeZone);
      const amount = Number(adjustment.amount || 0);
      if (amount > 0) {
        const previous = firstPayment.get(adjustment.wedding_id);
        if (day && (!previous || day < previous)) firstPayment.set(adjustment.wedding_id, day);
      }
      if (inWindow(day) && amount !== 0) {
        const wedding = byId.get(adjustment.wedding_id);
        paymentsReceived.push({
          name: wedding?.client_name,
          date: day,
          amount,
          package_total: Number(wedding?.total_amount || 0),
          source: adjustment.reason || "marked in payment audit",
        });
      }
    }
  }
  const sales = rows
    .filter((row: any) => {
      if (row.status === "cancelled" || row.status === "draft") return false;
      if (String(row.notes || "").includes("[UNPAID_DRAFT]")) return false;
      return ["pending", "upcoming", "completed"].includes(row.status) || Number(row.paid_amount) > 0;
    })
    .map((row: any) => {
      const markers = [
        isoDay(row.contract_date, timeZone),
        signByWedding.get(row.id) || "",
        firstPayment.get(row.id) || "",
        isoDay(row.offplatform_claimed_at, timeZone),
      ].filter(Boolean);
      const day = markers[0] || isoDay(row.created_at, timeZone);
      const matched = range.from
        ? markers.some((marker) => marker >= range.from && marker <= range.to) || (!markers.length && day >= range.from && day <= range.to)
        : isBooked(row);
      return { ...row, contract_signed_at: day, date: row.date, matched };
    });
  const inRange = range.from ? sales.filter((row: any) => row.matched) : sales.filter(isBooked);
  const today = dayInZone(new Date(), timeZone).iso;
  const auditRows = rows
    .filter((row: any) => row.status !== "cancelled" && !String(row.notes || "").includes("[UNPAID_DRAFT]"))
    .flatMap((row: any) => auditRowsFor(row, timeZone));
  const auditPaid = auditRows.filter((row: any) => row.status === "paid" && row.date && (!range.from || (row.date >= range.from && row.date <= range.to)));
  const horizon = shiftIso(today, 30);
  const incomingRows = auditRows
    .filter((row: any) => row.due > 0 && row.date >= today && row.date <= horizon)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
  const incomingTotal = Math.round(incomingRows.reduce((sum: number, row: any) => sum + row.due, 0) * 100) / 100;
  const overdueRows = auditRows
    .filter((row: any) => row.wedding_status === "upcoming" && row.status !== "paid" && row.due > 0 && row.date && row.date < today)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
  const overdueTotal = Math.round(overdueRows.reduce((sum: number, row: any) => sum + row.due, 0) * 100) / 100;
  const bookedFromAudit = auditPaid.filter((row: any) => /retainer|deposit|pay in full|package payment/i.test(row.label));
  const summarySource = range.from
    ? bookedFromAudit.map((row: any) => ({
        client_name: row.name,
        date: row.date,
        total_amount: row.package_total,
        paid_amount: row.paid,
        contract_signed_at: row.date,
      }))
    : inRange;
  const editing = ["ready_to_edit", "in_progress", "revisions_requested", "client_review"];
  const editQueue = rows
    .filter((row: any) => {
      if (row.status !== "upcoming" && row.status !== "completed") return false;
      if (String(row.notes || "").includes("[UNPAID_DRAFT]")) return false;
      const status = row.editing_status || "awaiting_raw_media";
      if (status === "delivered") return false;
      if (status === "ready_to_edit" || status === "in_progress") return true;
      return status === "awaiting_raw_media" && row.date && row.date <= today;
    })
    .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 12)
    .map((row: any) => ({
      name: row.client_name,
      date: row.date,
      status: row.editing_status || "awaiting_raw_media",
    }));
  const proposalsWaiting = (proposals || [])
    .filter((row: any) => !["accepted", "archived", "booked", "expired"].includes(String(row.status || "").toLowerCase()))
    .slice(0, 12)
    .map((row: any) => ({
      name: row.client_name,
      status: row.status,
      total: Number(row.total_amount || 0),
      wedding_date: row.wedding_date,
    }));
  const openPositions = (jobs || []).slice(0, 12).map((job: any) => ({
    role: job.role,
    couple: byId.get(job.wedding_id)?.client_name || null,
    date: byId.get(job.wedding_id)?.date || null,
  }));
  const repMap = new Map<string, any>();
  for (const proposal of proposals || []) {
    const email = String(proposal.salesperson_email || "").trim().toLowerCase();
    const name = String(proposal.salesperson_name || "").trim();
    const key = email || name.toLowerCase();
    if (!key) continue;
    const wedding = byId.get(proposal.wedding_id);
    const booked = ["accepted", "paid"].includes(String(proposal.status || "").toLowerCase())
      || Number(proposal.amount_paid_so_far) > 0
      || wedding?.status === "upcoming"
      || wedding?.status === "completed"
      || Number(wedding?.paid_amount) > 0;
    const sentDay = isoDay(proposal.sent_at || proposal.created_at, timeZone);
    const bookedDay = isoDay(proposal.contract_signed_at, timeZone) || (booked ? sentDay : "");
    const inWeek = (day: string) => !!range.from && !!day && day >= range.from && day <= range.to;
    const row = repMap.get(key) || {
      name: name || email,
      sent_this_week: 0,
      booked_this_week: 0,
      booked_value_this_week: 0,
      sent_all: 0,
      booked_all: 0,
      booked_value_all: 0,
    };
    row.sent_all += 1;
    if (inWeek(sentDay)) row.sent_this_week += 1;
    if (booked) {
      row.booked_all += 1;
      row.booked_value_all += Number(proposal.total_amount || 0);
      if (inWeek(bookedDay)) {
        row.booked_this_week += 1;
        row.booked_value_this_week += Number(proposal.total_amount || 0);
      }
    }
    repMap.set(key, row);
  }
  const salespeople = [...repMap.values()]
    .sort((a, b) => b.booked_value_this_week - a.booked_value_this_week || b.booked_value_all - a.booked_value_all)
    .slice(0, 12);
  return {
    area: area?.name || territoryId,
    company: settings?.company_name || null,
    today,
    range: range.label,
    from: range.from,
    to: range.to,
    instruction: weddingLoad.error
      ? `The wedding load failed: ${weddingLoad.error}. Say that. Do not invent a number.`
      : range.from
        ? "overdue is unpaid installments dated before today. Name overdue.rows and add overdue.amount before talking about the future. incoming_30 is only installments due from today through 30 days. Never say nothing is past due when overdue.count is above zero. is_first true is a new booking. Never say is_first to the user."
        : "Booked numbers are all-time. overdue is unpaid installments dated before today. incoming_30 is unpaid installments due in the next 30 days. Name overdue before the future rows.",
    definitions: {
      booked: "Initial retainers, deposits, and pay-in-full rows marked Paid on Payment Audit in the range",
      audit_paid: "every Paid installment on Payment Audit in the range, including later payments",
      booked_value: "package total of the new bookings, not the cash collected",
    },
    ...summarize(summarySource),
    audit_paid: auditPaid.slice(0, 40),
    incoming_30: {
      through: horizon,
      amount: incomingTotal,
      count: incomingRows.length,
      rows: incomingRows.slice(0, 30).map((row: any) => ({
        name: row.name,
        label: row.label,
        date: row.date,
        due: row.due,
      })),
    },
    overdue: {
      amount: overdueTotal,
      count: overdueRows.length,
      rows: overdueRows.slice(0, 30).map((row: any) => ({
        name: row.name,
        label: row.label,
        date: row.date,
        due: row.due,
      })),
    },
    weddings_loaded: rows.length,
    payments_received: paymentsReceived.slice(0, 30),
    payment_audit_collected_all_time: Math.round(sales.reduce((sum: number, row: any) => sum + Number(row.paid_amount || 0), 0) * 100) / 100,
    open_jobs: (jobs || []).length,
    open_positions: openPositions,
    proposals_waiting: proposalsWaiting,
    salespeople,
    edit_queue: editQueue,
    editing_now: sales.filter((row: any) => editing.includes(row.editing_status)).length,
    next_weddings: sales
      .filter((row: any) => row.date >= today && row.status === "upcoming")
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 5)
      .map((row: any) => ({ name: row.client_name, date: row.date })),
  };
}

async function findWedding(db: any, territoryId: string, name: string) {
  const query = name.trim();
  if (query.length < 2) return { matches: [] };
  const { data } = await db
    .from("weddings")
    .select("id, client_name, date, location, status, total_amount, paid_amount, editing_status, package")
    .eq("territory_id", territoryId)
    .ilike("client_name", `%${query}%`)
    .limit(5);
  const weddings = data || [];
  const ids = weddings.map((row: any) => row.id);
  let jobs: any[] = [];
  let assignments: any[] = [];
  if (ids.length) {
    const { data: jobRows } = await db
      .from("jobs")
      .select("id, wedding_id, role, status, pay_rate")
      .eq("territory_id", territoryId)
      .in("wedding_id", ids);
    jobs = jobRows || [];
    const jobIds = jobs.map((job) => job.id);
    if (jobIds.length) {
      const { data: assignmentRows } = await db
        .from("assignments")
        .select("job_id, status, contractors(first_name, last_name)")
        .in("job_id", jobIds);
      assignments = assignmentRows || [];
    }
  }
  return {
    matches: weddings.map((row: any) => ({
      name: row.client_name,
      date: row.date,
      location: row.location,
      status: row.status,
      package: row.package,
      total: Number(row.total_amount || 0),
      paid: Number(row.paid_amount || 0),
      still_owed: Math.max(0, Number(row.total_amount || 0) - Number(row.paid_amount || 0)),
      editing_status: row.editing_status || "awaiting_raw_media",
      positions: jobs
        .filter((job) => job.wedding_id === row.id)
        .map((job) => {
          const people = assignments
            .filter((assignment) => assignment.job_id === job.id && assignment.status !== "Cancelled")
            .map((assignment) => {
              const person = Array.isArray(assignment.contractors) ? assignment.contractors[0] : assignment.contractors;
              return person ? `${person.first_name || ""} ${person.last_name || ""}`.trim() : "Unnamed";
            });
          return { role: job.role, status: job.status, pay: Number(job.pay_rate || 0), assigned: people };
        }),
    })),
  };
}

function countBy(rows: any[], key: string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const label = String(row[key] || "unknown");
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

async function areaRecords(db: any, territoryId: string, kind: string) {
  if (kind === "open_jobs") {
    const { data: jobs } = await db
      .from("jobs")
      .select("role, pay_rate, wedding_id")
      .eq("territory_id", territoryId)
      .eq("status", "open")
      .limit(40);
    const weddingIds = [...new Set((jobs || []).map((job: any) => job.wedding_id).filter(Boolean))];
    const { data: weddings } = weddingIds.length
      ? await db.from("weddings").select("id, client_name, date").in("id", weddingIds)
      : { data: [] };
    const byId = new Map((weddings || []).map((wedding: any) => [wedding.id, wedding]));
    return {
      kind,
      count: (jobs || []).length,
      jobs: (jobs || []).map((job: any) => ({
        role: job.role,
        pay: Number(job.pay_rate || 0),
        couple: byId.get(job.wedding_id)?.client_name || "Unknown",
        date: byId.get(job.wedding_id)?.date || null,
      })),
    };
  }
  if (kind === "owed") {
    const { data } = await db
      .from("weddings")
      .select("client_name, date, status, total_amount, paid_amount")
      .eq("territory_id", territoryId)
      .limit(2000);
    const owed = (data || [])
      .filter((row: any) => isBooked(row) && Number(row.paid_amount || 0) < Number(row.total_amount || 0))
      .map((row: any) => ({
        name: row.client_name,
        date: row.date,
        total: Number(row.total_amount || 0),
        paid: Number(row.paid_amount || 0),
        still_owed: Math.round((Number(row.total_amount || 0) - Number(row.paid_amount || 0)) * 100) / 100,
      }))
      .sort((a: any, b: any) => b.still_owed - a.still_owed)
      .slice(0, 20);
    return { kind, count: owed.length, weddings: owed };
  }
  if (kind === "proposals") {
    const { data } = await db
      .from("proposals")
      .select("client_name, status, total_amount, wedding_date")
      .eq("territory_id", territoryId)
      .limit(2000);
    const open = (data || []).filter((row: any) => !["accepted", "archived", "booked"].includes(String(row.status || "").toLowerCase()));
    return {
      kind,
      by_status: countBy(data || [], "status"),
      still_out: open.slice(0, 20).map((row: any) => ({
        name: row.client_name,
        status: row.status,
        total: Number(row.total_amount || 0),
        wedding_date: row.wedding_date,
      })),
      note: "still_out are not booked. Do not guess that they will book. Accepted proposals are already booked.",
    };
  }
  if (kind === "crew") {
    const { data } = await db.from("contractors").select("status").eq("territory_id", territoryId).limit(2000);
    return { kind, by_status: countBy(data || [], "status"), total: (data || []).length };
  }
  if (kind === "editing") {
    const { data } = await db
      .from("weddings")
      .select("client_name, date, editing_status")
      .eq("territory_id", territoryId)
      .in("editing_status", ["ready_to_edit", "in_progress", "revisions_requested", "client_review"])
      .limit(30);
    return {
      kind,
      weddings: (data || []).map((row: any) => ({
        name: row.client_name,
        date: row.date,
        editing_status: row.editing_status,
      })),
    };
  }
  return { error: "Unknown record type" };
}

function findHelp(query: string) {
  const asked = query.toLowerCase();
  const skip = new Set(["wedding", "weddings", "after", "what", "how", "for", "yet", "but", "with", "from", "this", "area", "you", "the", "and", "not"]);
  const words = asked.split(/\W+/).filter((word) => word.length > 2 && !skip.has(word));
  const expanded = words.flatMap((word) => (/^edit/.test(word) ? [word, "edit", "editing", "edited"] : [word]));
  const ranked = ARTICLES.map((article) => {
    const title = article.title.toLowerCase();
    const screen = article.screen.toLowerCase();
    const keys = article.keywords.toLowerCase();
    const steps = article.steps.toLowerCase();
    let score = expanded.reduce((sum, word) => {
      if (title.includes(word)) return sum + 3;
      if (screen.includes(word) || keys.includes(word)) return sum + 2;
      if (steps.includes(word)) return sum + 1;
      return sum;
    }, 0);
    if (/edit|footage|raw media|drive link|post-production/.test(asked) && title.includes("post-production")) score += 12;
    if (/questionnaire/.test(asked) && !/edit/.test(asked) && title.includes("questionnaire")) score += 12;
    return { article, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => row.article);
  if (!ranked.length) {
    return {
      note: "No written steps matched. Say you do not have steps for that. Do not guess a screen.",
      topics: ARTICLES.map((article) => article.title),
    };
  }
  return {
    note: "Answer from these steps only. Do not add a button that is not written here.",
    articles: ranked,
  };
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "area_snapshot",
      description: "Bookings and the Payment Audit ledger for this area. Pass this_week or this_month when they name a time. The result includes payments_received, which is the cash Payment Audit recorded in that range.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["this_week", "this_month", "all", "custom"] },
          from: { type: "string", description: "YYYY-MM-DD, only with custom" },
          to: { type: "string", description: "YYYY-MM-DD, only with custom" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "payment_audit",
      description: "The Payment Audit screen for this area: cash recorded in the period, and the couples it belongs to. Use this for paid, collected, or what booked.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["this_week", "this_month", "all", "custom"] },
          from: { type: "string" },
          to: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_wedding",
      description: "One couple in this area: date, money, package, and who is assigned to each position.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "area_records",
      description: "Live rows for this area only. open_jobs lists unfilled positions. owed lists couples who still owe. proposals counts proposals by status. crew counts contractors by status. editing lists films currently being edited.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["open_jobs", "owed", "proposals", "crew", "editing"] },
        },
        required: ["kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "help",
      description: "How to use Veydra. Returns the matching help notes and training videos.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ovanta",
      description: "This area's Ovanta account. Use action report to audit pipelines, calendars, and setup. Use action request to read or update anything else in that one location. Never add or edit users. Never send a text or email. Only write when the user explicitly asked for the change.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["report", "request"] },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          path: { type: "string", description: "HighLevel path starting with /, such as /contacts/ or /opportunities/search" },
          body: { type: "object" },
        },
      },
    },
  },
];

function deskLines(rows: any[], render: (row: any) => string, empty: string) {
  if (!rows?.length) return empty;
  return rows.map(render).join("\n");
}

function formatDesk(snap: any) {
  const money = (amount: number) => `$${Number(amount || 0).toLocaleString("en-US")}`;
  const booked = deskLines(
    snap.weddings,
    (row) => `- **${row.name}**, booked ${row.booked_on}, package ${money(row.total)}`,
    "- None",
  );
  const overdue = deskLines(
    (snap.overdue?.rows || []).filter((row: any) => Number(row.due) >= 100),
    (row) => `- **${row.name}**, due ${row.date}, ${money(row.due)} still unpaid`,
    "- No balance over $100",
  );
  const smallOverdue = (snap.overdue?.rows || []).filter((row: any) => Number(row.due) < 100);
  const smallTotal = Math.round(smallOverdue.reduce((sum: number, row: any) => sum + Number(row.due || 0), 0) * 100) / 100;
  const dueSoon = (snap.incoming_30?.rows || []).filter((row: any) => row.date <= shiftIso(snap.today, 7));
  const soon = deskLines(
    dueSoon.slice(0, 6),
    (row) => `- **${row.name}**, ${row.label}, due ${row.date}, ${money(row.due)}`,
    "- None",
  );
  const incoming = deskLines(
    (snap.incoming_30?.rows || []).slice(0, 8),
    (row) => `- **${row.name}**, ${row.label}, due ${row.date}, ${money(row.due)}`,
    "- None",
  );
  const extraIncoming = Math.max(0, Number(snap.incoming_30?.count || 0) - 8);
  const edits = deskLines(
    snap.edit_queue,
    (row) => `- **${row.name}**, ${row.date}, ${String(row.status).replace(/_/g, " ")}`,
    "- None",
  );
  const jobs = deskLines(
    snap.open_positions,
    (row) => `- ${row.role} for **${row.couple || "an unlinked wedding"}**, ${row.date || "no date"}`,
    "- None",
  );
  const proposals = deskLines(
    snap.proposals_waiting,
    (row) => `- **${row.name}**, ${row.status}, ${money(row.total)}`,
    "- None",
  );
  const salespeople = deskLines(
    snap.salespeople,
    (row) => `- **${row.name}**, this week sent ${row.sent_this_week} and booked ${row.booked_this_week} (${money(row.booked_value_this_week)}). All time sent ${row.sent_all} and booked ${row.booked_all} (${money(row.booked_value_all)}).`,
    "- No salesperson is on a proposal yet.",
  );
  return `Desk for ${snap.company || "this company"} in ${snap.area}. Today is ${snap.today}. Answer from this. Do not invent a name or an amount.

When they ask how we are doing, or how the week is going, do not paste this desk. Write four short lines. First, the new bookings and the package value. Second, the past-due total, and name only the balances over $100. Third, what is due in the next 7 days. Fourth, the one thing to do next. Leave every smaller balance as a single total. Never stop in the middle of a name.

When they ask how the salespeople are doing, use the Salespeople lines. Name each person, how many they sent, how many booked, and the package value. Do not say you cannot see who sent a proposal.

Past due on upcoming weddings: ${snap.overdue?.count || 0} payments, ${money(snap.overdue?.amount)}.
${overdue}
${smallOverdue.length ? `- ${smallOverdue.length} smaller balances, ${money(smallTotal)} together. Do not list them.` : ""}

Booked this week (${snap.range}): ${snap.booked_count || 0} new bookings, package value ${money(snap.booked_value)}.
${booked}

Due in the next 7 days:
${soon}

Due in the next 30 days: ${snap.incoming_30?.count || 0} payments, ${money(snap.incoming_30?.amount)}.
${incoming}${extraIncoming ? `\n- and ${extraIncoming} more` : ""}

Waiting on an edit:
${edits}

Open positions: ${snap.open_jobs || 0}.
${jobs}

Proposals still waiting, not booked:
${proposals}

Salespeople. The name is the person who sent the proposal.
${salespeople}

Ovanta is not in this desk. If they ask about Ovanta, leads, calendars, pipelines, or setup, call the ovanta tool.`;
}

async function crmGet(key: string, url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    });
    const text = await res.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { message: text.slice(0, 180) };
    }
    return { ok: res.ok, status: res.status, body };
  } catch (error: any) {
    return { ok: false, status: 0, body: { message: error?.message || "Ovanta timed out" } };
  } finally {
    clearTimeout(timer);
  }
}

async function crmPost(key: string, url: string, payload: any) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        Version: "2021-07-28",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { message: text.slice(0, 180) };
    }
    return { ok: res.ok, status: res.status, body };
  } catch (error: any) {
    return { ok: false, status: 0, body: { message: error?.message || "Ovanta timed out" } };
  } finally {
    clearTimeout(timer);
  }
}

async function searchOpportunities(key: string, locationId: string, startAfter: string, startAfterId: string, style: "legacy" | "v3") {
  const params = new URLSearchParams({ limit: "100", status: "open" });
  params.set(style === "legacy" ? "location_id" : "locationId", locationId);
  if (startAfter) params.set("startAfter", startAfter);
  if (startAfterId) params.set("startAfterId", startAfterId);
  if (style === "legacy") return crmGet(key, `https://services.leadconnectorhq.com/opportunities/search?${params}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://services.leadconnectorhq.com/opportunities/search?${params}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, Version: "v3", Accept: "application/json" },
    });
    const text = await res.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text.slice(0, 180) }; }
    return { ok: res.ok, status: res.status, body };
  } catch (error: any) {
    return { ok: false, status: 0, body: { message: error?.message || "Ovanta timed out" } };
  } finally {
    clearTimeout(timer);
  }
}

async function openOpportunities(key: string, locationId: string) {
  const rows: any[] = [];
  let startAfter = "";
  let startAfterId = "";
  let style: "legacy" | "v3" = "legacy";
  for (let page = 0; page < 3; page++) {
    let res = await searchOpportunities(key, locationId, startAfter, startAfterId, style);
    if (!res.ok && page === 0) {
      const retry = await searchOpportunities(key, locationId, "", "", "v3");
      if (retry.ok) {
        style = "v3";
        res = retry;
      }
    }
    if (!res.ok) return { rows, error: res.body?.message || res.body?.error || `Ovanta returned ${res.status}`, capped: false };
    const batch = res.body?.opportunities || res.body?.data || [];
    rows.push(...batch);
    const meta = res.body?.meta || {};
    if (!meta.startAfterId || batch.length < 100) return { rows, error: null, capped: false };
    startAfter = String(meta.startAfter || "");
    startAfterId = String(meta.startAfterId || "");
  }
  return { rows, error: null, capped: true };
}

async function listWorkflows(db: any, territoryId: string) {
  const { data: settings } = await db
    .from("portal_settings")
    .select("company_name, hl_api_key, hl_location_id")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();
  const key = String(settings?.hl_api_key || "").trim();
  const locationId = String(settings?.hl_location_id || "").trim();
  if (!key || !locationId) {
    return { error: "This company has no Ovanta key. Add it in Settings, Integrations." };
  }
  const res = await crmGet(key, `https://services.leadconnectorhq.com/workflows/?locationId=${locationId}`);
  if (!res.ok) {
    return { error: res.body?.message || res.body?.error || "Ovanta did not return the automations. The key may be missing workflows.readonly." };
  }
  const workflows = (res.body?.workflows || [])
    .map((row: any) => ({ name: row.name || "Untitled", status: row.status || "unknown" }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
  return { company: settings?.company_name || "this company", workflows };
}

function formatWorkflows(company: string, workflows: { name: string; status: string }[]) {
  const published = workflows.filter((row) => String(row.status).toLowerCase() === "published");
  const drafts = workflows.filter((row) => String(row.status).toLowerCase() !== "published");
  const owners = ["Amy", "Jenna", "Haleigh", "Alexis", "Lisa"];
  const ownerOf = (name: string) => owners.find((owner) => name.toLowerCase().startsWith(owner.toLowerCase())) || "Company";
  const groups = new Map<string, typeof workflows>();
  for (const row of published) {
    const key = ownerOf(row.name);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const lines = [
    `Ovanta automations for ${company}.`,
    "",
    `${workflows.length} workflows. ${published.length} are on. ${drafts.length} are draft and not running.`,
    "Ovanta does not share the steps inside a workflow.",
    "",
    "**On**",
  ];
  for (const key of ["Company", ...owners]) {
    const list = groups.get(key);
    if (!list?.length) continue;
    lines.push("", `**${key}**`, "", ...list.map((row) => `- **${row.name}**`));
  }
  if (drafts.length) {
    lines.push("", "**Off**", "");
    for (const row of drafts) {
      const leftover = /copy|v\d+/i.test(row.name) ? ", old copy" : "";
      lines.push(`- **${row.name}**${leftover}`);
    }
  }
  return lines.join("\n");
}

function formatLeadAudit(report: any) {
  const wait = (hours: number | null | undefined) => hours == null ? "unknown wait" : hours < 1 ? "under an hour" : `${hours}h`;
  const lines = [
    `**New leads**`,
    "",
    `${report.poolSize || 0} still open. ${report.windowNewLeadsCount || 0} came in during the last 24 hours.`,
    "",
    "**Needs a reply**",
    "",
  ];
  const replies = report.needsReply || [];
  if (!replies.length) lines.push("- Inbox is clear.");
  for (const row of replies.slice(0, 8)) {
    const quote = String(row.snippet || "").replace(/\s+/g, " ").trim();
    lines.push(`- **${row.name}**, ${row.grade || "Open"}, ${row.channel || "message"}, ${wait(row.hoursAgo)}${quote ? `. "${quote}"` : ""}`);
  }
  const ghosts = report.ghostLeads || [];
  lines.push("", "**No first touch**", "");
  if (!ghosts.length) lines.push("- Every lead from the last day got a person.");
  else {
    lines.push(`${ghosts.length} leads are at least a day old and only a workflow has touched them.`);
    lines.push("");
    for (const row of ghosts.slice(0, 6)) lines.push(`- **${row.name}**, ${row.daysAgo ?? "?"} days, ${(row.source || "unknown").replace(/_/g, " ")}`);
  }
  const missed = report.missedCalls || [];
  lines.push("", "**Missed calls**", "");
  if (!missed.length) lines.push("- None.");
  for (const row of missed.slice(0, 6)) lines.push(`- **${row.name}**, ${wait(row.hoursAgo)}${row.followedUp ? ", someone followed up" : ", no callback"}`);
  const opted = report.optedOut || [];
  lines.push("", "**Opted out, still in the pipeline**", "");
  if (!opted.length) lines.push("- None.");
  for (const row of opted.slice(0, 6)) lines.push(`- **${row.name}**, ${row.signal || "opted out"}, ${row.daysAgo ?? "?"} days ago`);
  const cold = report.goingCold || [];
  lines.push("", "**Going cold**", "");
  if (!cold.length) lines.push("- None past 5 days.");
  else {
    lines.push(`${report.goingColdTotal || cold.length} have been quiet for 5 or more days.`);
    lines.push("");
    for (const row of cold.slice(0, 5)) lines.push(`- **${row.name}**, ${row.daysAgo} days`);
  }
  const autos = report.automationOnly || [];
  lines.push("", "**Automation only**", "");
  if (!autos.length) lines.push("- None. A person reached every one of these.");
  for (const row of autos.slice(0, 6)) lines.push(`- **${row.name}**, ${wait(row.hoursAgo)}`);
  if (report.weekendCatchUp) {
    lines.push("", "**Weekend catch-up**", "");
    if (!report.weekendCatchUp.length) lines.push("- Weekend leads were contacted in time.");
    for (const row of report.weekendCatchUp.slice(0, 5)) lines.push(`- **${row.name}**, waited ${wait(row.hoursAgo)}`);
  }
  const mix = report.channelMix || {};
  lines.push(
    "",
    "**How the last message was sent**",
    "",
    `${mix.calls || 0} calls, ${mix.manualSms || 0} texts, ${mix.email || 0} emails, ${mix.automation || 0} automations.`,
    "",
    "**Going well**",
    "",
  );
  const wins = report.goingWell || [];
  if (!wins.length) lines.push("- Nothing notable in the last day.");
  for (const row of wins.slice(0, 5)) {
    const what = String(row.what || "").replace(/0h/g, "the same hour");
    lines.push(`- **${row.name}**, ${what.charAt(0).toLowerCase()}${what.slice(1)}`);
  }
  lines.push("", "**Do these three**", "");
  const priorities = report.priorities || [];
  if (!priorities.length) lines.push("- No urgent item. Call a lead who has gone quiet.");
  priorities.slice(0, 3).forEach((row: any, index: number) => {
    lines.push(`${index + 1}. ${row.action}${row.why ? `. ${row.why}` : ""}`);
  });
  return lines.join("\n");
}

async function salesAudit(db: any, territoryId: string, authHeader: string) {
  const { data: settings } = await db
    .from("portal_settings")
    .select("company_name, timezone, hl_api_key, hl_location_id")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();
  const company = settings?.company_name || "this company";
  const key = String(settings?.hl_api_key || "").trim();
  const locationId = String(settings?.hl_location_id || "").trim();
  const timeZone = settings?.timezone || "America/New_York";
  const range = periodRange("this_week", timeZone);
  const { data: proposals } = await db
    .from("proposals")
    .select("salesperson_name, salesperson_email, status, total_amount, amount_paid_so_far, contract_signed_at, sent_at, created_at")
    .eq("territory_id", territoryId)
    .limit(2000);
  const reps = new Map<string, any>();
  for (const proposal of proposals || []) {
    const email = String(proposal.salesperson_email || "").trim().toLowerCase();
    const name = String(proposal.salesperson_name || "").trim();
    const id = email || name.toLowerCase();
    if (!id) continue;
    const booked = ["accepted", "paid"].includes(String(proposal.status || "").toLowerCase()) || Number(proposal.amount_paid_so_far) > 0;
    const sentDay = isoDay(proposal.sent_at || proposal.created_at, timeZone);
    const bookedDay = isoDay(proposal.contract_signed_at, timeZone) || (booked ? sentDay : "");
    const inWeek = (day: string) => !!range.from && !!day && day >= range.from && day <= range.to;
    const row = reps.get(id) || { name: name || email, sent: 0, booked: 0, value: 0 };
    if (inWeek(sentDay)) row.sent += 1;
    if (booked && inWeek(bookedDay)) {
      row.booked += 1;
      row.value += Number(proposal.total_amount || 0);
    }
    reps.set(id, row);
  }
  const repLines = [...reps.values()]
    .sort((a, b) => b.value - a.value || b.booked - a.booked)
    .slice(0, 12)
    .map((row) => `- **${row.name}**, sent ${row.sent}, booked ${row.booked}, $${Math.round(row.value).toLocaleString("en-US")}`);
  const lines = [
    `Sales audit for ${company}. This week, ${range.from} to ${range.to}.`,
    "",
    "**Veydra, who sent the proposal**",
    "",
    repLines.length ? repLines.join("\n") : "- No salesperson is on a proposal this week.",
  ];
  if (!key || !locationId) {
    lines.push("", "Ovanta is not connected, so the lead audit is not in this report.");
    return lines.join("\n");
  }
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !authHeader) {
    lines.push("", "The lead audit could not run because this login was not passed through.");
    return lines.join("\n");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50000);
  try {
    const res = await fetch(`${url}/functions/v1/sales-activity`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: authHeader,
        apikey: anon,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ range: 1, territoryId, skipStore: true }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.error) {
      lines.push("", `The lead audit could not run: ${payload?.error || payload?.detail || res.status}.`);
      return lines.join("\n");
    }
    lines.push("", formatLeadAudit(payload));
  } catch (error: any) {
    lines.push("", `The lead audit timed out: ${error?.message || "unknown error"}.`);
  } finally {
    clearTimeout(timer);
  }
  return lines.join("\n");
}

async function ovantaReport(db: any, territoryId: string) {
  const { data: settings } = await db
    .from("portal_settings")
    .select("company_name, hl_api_key, hl_location_id, interview_calendar_id")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();
  const key = String(settings?.hl_api_key || "").trim();
  const locationId = String(settings?.hl_location_id || "").trim();
  if (!key || !locationId) {
    return {
      connected: false,
      error: "This company has no Ovanta key or location id. Add both in Settings, Integrations.",
    };
  }
  const [location, calendars, pipelines, contacts] = await Promise.all([
    crmGet(key, `https://services.leadconnectorhq.com/locations/${locationId}`),
    crmGet(key, `https://services.leadconnectorhq.com/calendars/?locationId=${locationId}`),
    crmGet(key, `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`),
    crmGet(key, `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=20`),
  ]);
  const calendarRows = (calendars.body?.calendars || calendars.body?.data || [])
    .map((row: any) => ({ id: row.id, name: row.name || row.id }))
    .filter((row: any) => row.id)
    .slice(0, 20);
  const savedCalendar = String(settings?.interview_calendar_id || "");
  const interview = calendarRows.find((row: any) => row.id === savedCalendar);
  const opportunities = await openOpportunities(key, locationId);
  const stageById = new Map<string, any>();
  const pipelineRows = (pipelines.body?.pipelines || []).slice(0, 8).map((row: any) => {
    const stages = (row.stages || []).slice(0, 12).map((stage: any) => {
      const bucket = { name: stage.name || "Untitled stage", open: 0, value: 0, stale: 0 };
      if (stage.id) stageById.set(stage.id, bucket);
      return bucket;
    });
    return { name: row.name || "Untitled pipeline", stages };
  });
  const staleBefore = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const deal of opportunities.rows) {
    const bucket = stageById.get(deal.pipelineStageId);
    if (!bucket) continue;
    bucket.open += 1;
    bucket.value += Number(deal.monetaryValue || 0);
    const touched = new Date(deal.lastStatusChangeAt || deal.updatedAt || deal.createdAt || 0).getTime();
    if (touched && touched < staleBefore) bucket.stale += 1;
  }
  const pipelineAudit = pipelineRows.map((row: any) => ({
    name: row.name,
    open: row.stages.reduce((sum: number, stage: any) => sum + stage.open, 0),
    value: Math.round(row.stages.reduce((sum: number, stage: any) => sum + stage.value, 0)),
    stages: row.stages
      .filter((stage: any) => stage.open > 0)
      .map((stage: any) => ({
        name: stage.name,
        open: stage.open,
        value: Math.round(stage.value),
        stale_14_days: stage.stale,
      })),
    empty_stages: row.stages.filter((stage: any) => stage.open === 0).map((stage: any) => stage.name),
  }));
  const recent = (contacts.body?.contacts || []).slice(0, 12).map((row: any) => ({
    name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || row.phone || "Unnamed",
    added: String(row.dateAdded || row.date_added || "").slice(0, 10),
    source: typeof row.source === "string" ? row.source : row.source?.source || "",
    tags: Array.isArray(row.tags) ? row.tags.slice(0, 5) : [],
  }));
  const missing = [
    !location.ok ? "The location did not answer. The key may not match this location." : "",
    !savedCalendar ? "No interview calendar is chosen in Settings, Integrations." : "",
    savedCalendar && !interview ? "The saved interview calendar is not in this Ovanta account." : "",
    !pipelines.ok ? "Pipelines could not be read." : "",
    opportunities.error ? `Open deals could not be counted: ${opportunities.error}` : "",
  ].filter(Boolean);
  return {
    connected: location.ok || calendars.ok || contacts.ok,
    company: settings?.company_name || null,
    location_name: location.body?.location?.name || location.body?.name || null,
    calendars: calendarRows.map((row: any) => row.name),
    interview_calendar: interview?.name || null,
    pipelines: pipelineAudit,
    deals_read: opportunities.rows.length,
    deals_capped: opportunities.capped,
    deals_error: opportunities.error,
    recent_contacts: recent,
    setup_missing: missing,
    cannot: "Cannot add or edit Ovanta users, send a text or email, or touch another location.",
  };
}

async function ovantaRequest(db: any, territoryId: string, args: any) {
  const { data: settings } = await db
    .from("portal_settings")
    .select("hl_api_key, hl_location_id")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();
  const key = String(settings?.hl_api_key || "").trim();
  const locationId = String(settings?.hl_location_id || "").trim();
  if (!key || !locationId) {
    return { error: "This company has no Ovanta key or location id. Add both in Settings, Integrations." };
  }
  const method = String(args?.method || "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return { error: "Method not allowed." };
  let path = String(args?.path || "").trim();
  path = path.replace(/^https?:\/\/services\.leadconnectorhq\.com/i, "");
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.includes("..") || path.includes(" ")) return { error: "Path not allowed." };
  const userWrite = method !== "GET" && /\/users(\/|$|\?)/i.test(path);
  const sendMessage = method !== "GET" && /\/conversations\/messages/i.test(path);
  const otherAccount = /\/(oauth|marketplace|saas)\b/i.test(path) || (method !== "GET" && /^\/locations(\/|$)/i.test(path));
  if (userWrite) return { error: "The assistant cannot add or edit Ovanta users." };
  if (sendMessage) return { error: "The assistant cannot send a text or email from Ovanta." };
  if (otherAccount) return { error: "The assistant can only use this company's location." };
  const locationInPath = path.match(/\/locations\/([^/?]+)/i)?.[1];
  if (locationInPath && locationInPath !== locationId) return { error: "That location is not this company." };
  const url = new URL(`https://services.leadconnectorhq.com${path}`);
  if (url.searchParams.has("locationId")) url.searchParams.set("locationId", locationId);
  else if (method === "GET" && !locationInPath) url.searchParams.set("locationId", locationId);
  const body = args?.body && typeof args.body === "object" ? { ...args.body } : null;
  if (body && "locationId" in body) body.locationId = locationId;
  if (body && "altId" in body) body.altId = locationId;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        Version: "2021-07-28",
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body && method !== "GET" ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const clipped = text.length > 12000 ? `${text.slice(0, 12000)}…` : text;
    let parsed: any = clipped;
    try {
      parsed = clipped ? JSON.parse(clipped) : {};
    } catch {
      parsed = { raw: clipped };
    }
    if (!res.ok) return { ok: false, status: res.status, error: parsed?.message || parsed?.error || "Ovanta refused that request.", detail: parsed };
    return { ok: true, status: res.status, result: parsed };
  } catch (error: any) {
    return { error: error?.message || "Ovanta timed out." };
  } finally {
    clearTimeout(timer);
  }
}

async function runTool(db: any, territoryId: string, name: string, args: any, cache?: Map<string, Promise<any>>) {
  if (name === "area_snapshot" || name === "payment_audit") {
    const period = String(args?.period || "all");
    const key = `${period}|${args?.from || ""}|${args?.to || ""}`;
    if (cache?.has(key)) return cache.get(key);
    const pending = areaSnapshot(db, territoryId, args);
    cache?.set(key, pending);
    return pending;
  }
  if (name === "find_wedding") return findWedding(db, territoryId, String(args?.name || ""));
  if (name === "area_records") return areaRecords(db, territoryId, String(args?.kind || ""));
  if (name === "help") return findHelp(String(args?.query || ""));
  if (name === "ovanta") {
    if (String(args?.action || "report") === "request") return ovantaRequest(db, territoryId, args);
    return ovantaReport(db, territoryId);
  }
  return { error: "Unknown tool" };
}

function isPhoneCall(item: any) {
  const raw = item?.type ?? item?.messageType ?? item?.message_type;
  const label = String(item?.messageType || item?.message_type || "").toUpperCase();
  if (["TYPE_CALL", "TYPE_PHONE", "TYPE_VOICEMAIL", "TYPE_CAMPAIGN_CALL", "TYPE_CAMPAIGN_VOICEMAIL"].includes(label)) return true;
  if (String(raw || "").toUpperCase() === "TYPE_CALL" || String(raw || "").toUpperCase() === "TYPE_PHONE") return true;
  const num = Number(raw);
  if (num === 1) return true;
  const meta = item?.meta || {};
  return num === 2 && !!(meta.duration || meta.callDuration || meta.callTranscriptions || meta.recordingUrl || meta.recording);
}

function messageTime(item: any) {
  return new Date(item?.dateAdded || item?.date_added || item?.createdAt || item?.meta?.date || 0).getTime();
}

function transcriptText(body: any) {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (typeof body.transcript === "string") return body.transcript;
  const rows = Array.isArray(body) ? body : body.transcription || body.sentences || [];
  return rows.map((row: any) => row.text || row.transcript || row.sentence || row.content || "").filter(Boolean).join(" ");
}

async function callAnalysis(db: any, territoryId: string, apiKey: string) {
  const { data: settings } = await db
    .from("portal_settings")
    .select("company_name, timezone, hl_api_key, hl_location_id")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();
  const company = settings?.company_name || "this company";
  const key = String(settings?.hl_api_key || "").trim();
  const locationId = String(settings?.hl_location_id || "").trim();
  const timeZone = settings?.timezone || "America/Chicago";
  if (!key || !locationId) return `${company} has no Ovanta key, so yesterday's calls could not be read.`;
  const today = dayInZone(new Date(), timeZone).iso;
  const day = shiftIso(today, -1);
  const conversations: any[] = [];
  let cursor = "";
  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({ locationId, limit: "100", sort: "desc" });
    if (cursor) params.set("startAfterDate", cursor);
    const res = await crmGet(key, `https://services.leadconnectorhq.com/conversations/search?${params}`);
    if (!res.ok) return `Ovanta would not open the inbox: ${res.body?.message || res.body?.error || res.status}. The key may be missing conversations.readonly.`;
    const batch = res.body?.conversations || [];
    conversations.push(...batch);
    if (batch.length < 100) break;
    const oldest = new Date(batch[batch.length - 1]?.lastMessageDate || batch[batch.length - 1]?.last_message_date || 0).getTime();
    cursor = String(batch[batch.length - 1]?.lastMessageDate || batch[batch.length - 1]?.last_message_date || "");
    if (!cursor || (oldest && dayInZone(new Date(oldest), timeZone).iso < day)) break;
  }
  const onDay = (row: any) => {
    const at = new Date(row.lastMessageDate || row.last_message_date || 0).getTime();
    if (!at) return "";
    try { return dayInZone(new Date(at), timeZone).iso; } catch { return ""; }
  };
  const fromThatDay = conversations.filter((row) => onDay(row) === day).slice(0, 24);
  const calls: any[] = [];
  let unreadable = 0;
  const deadline = Date.now() + 18000;
  for (let index = 0; index < fromThatDay.length; index += 6) {
    if (Date.now() > deadline) break;
    const chunk = fromThatDay.slice(index, index + 6);
    const pages = await Promise.all(chunk.map(async (row) => {
      const res = await crmGet(key, `https://services.leadconnectorhq.com/conversations/${row.id}/messages?limit=40`);
      if (!res.ok) {
        unreadable += 1;
        return [];
      }
      const list = res.body?.messages?.messages || (Array.isArray(res.body?.messages) ? res.body.messages : []);
      return (Array.isArray(list) ? list : [])
        .filter((item: any) => {
          if (!isPhoneCall(item)) return false;
          const at = messageTime(item);
          if (!at) return false;
          try { return dayInZone(new Date(at), timeZone).iso === day; } catch { return false; }
        })
        .map((item: any) => ({ conversation: row, message: item }));
    }));
    for (const page of pages) calls.push(...page);
  }
  calls.sort((a, b) => messageTime(a.message) - messageTime(b.message));
  const detailed = calls.slice(0, 4);
  const cards = await Promise.all(detailed.map(async (row) => {
    const messageId = row.message.id || row.message.messageId;
    const spoken = messageId
      ? await crmGet(key, `https://services.leadconnectorhq.com/conversations/locations/${locationId}/messages/${messageId}/transcription`)
      : { ok: false, body: {} };
    const meta = row.message?.meta || {};
    const duration = Number(meta.duration || meta.callDuration || row.message?.duration || 0);
    const direction = String(row.message?.direction || "unknown");
    const at = messageTime(row.message);
    const when = at ? new Date(at).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" }) : "";
    return {
      name: row.conversation.fullName || row.conversation.contactName || row.conversation.name || "Unknown",
      when,
      direction,
      seconds: duration || null,
      transcript: transcriptText(spoken.ok ? spoken.body : null).replace(/\s+/g, " ").trim().slice(0, 900),
    };
  }));
  if (!cards.length) {
    return `No phone calls were found for ${company} on ${day}. Opened ${fromThatDay.length} conversations from that day. ${unreadable ? `${unreadable} could not be read. ` : ""}A call counts only when Ovanta stored it as a phone call inside the thread.`;
  }
  const facts = {
    company,
    day,
    active_conversations: fromThatDay.length,
    calls_found: calls.length,
    transcribed_here: cards.filter((row) => row.transcript).length,
    omitted: Math.max(0, calls.length - cards.length),
    calls: cards,
  };
  const plain = cards.map((row) => `**${row.name}**\n\n${row.when}, ${row.direction}${row.seconds ? `, ${row.seconds}s` : ""}\n\n${row.transcript || "No transcript."}`).join("\n\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("ASSISTANT_MODEL") || "grok-4.7",
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content: `Write yesterday's call analysis for a phone. Use only the JSON facts. Never invent a call, a name, a time, a duration, or a quote.

Start with **Yesterday**. One line: how many calls, how many inbound, how many outbound, how many had a transcript.

Then one block per call. Bold the contact name. Next line: time, direction, and duration in seconds when it is known. Then the transcript in short sentences. If there is no transcript, say Ovanta did not store one.

Then **Coaching**. One flag per call, taken from the words that were actually said. If the call was a voicemail or a clean call, say that.

Then **Scorecard**. For each call, one line: greeting, offer, next step, and brand name. Mark each Good, Miss, or Unclear. Unclear means the transcript does not show it.

Then **Takeaways**. Three bullets. If some calls were left out, say how many.`,
          },
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
    });
    const payload = await res.json().catch(() => ({}));
    return payload?.choices?.[0]?.message?.content || plain;
  } catch {
    return plain;
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("XAI_API_KEY") || "";
    if (!apiKey) {
      return jsonResp({ error: "The assistant is not set up yet. Add the XAI_API_KEY secret in Supabase." }, 503);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const auth = req.headers.get("Authorization") || "";
    if (!supabaseUrl || !anonKey || !serviceKey || !auth) {
      return jsonResp({ error: "Not signed in" }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResp({ error: "Not signed in" }, 401);

    const body = await req.json().catch(() => ({}));
    const territoryId = String(body.territoryId || "");
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!territoryId) return jsonResp({ error: "Pick an area first." }, 400);

    const db = createClient(supabaseUrl, serviceKey);
    const allowed = await allowedTerritories(db, userData.user);
    if (!allowed) return jsonResp({ error: "Not allowed" }, 403);
    if (allowed !== "super" && !allowed.has(territoryId)) {
      return jsonResp({ error: "That area is not one of yours." }, 403);
    }

    const [{ data: area }, { data: settings }] = await Promise.all([
      db.from("territories").select("name").eq("id", territoryId).maybeSingle(),
      db.from("portal_settings").select("company_name").eq("territory_id", territoryId).limit(1).maybeSingle(),
    ]);

    const history = messages
      .filter((message: any) => message && (message.role === "user" || message.role === "assistant"))
      .slice(-8)
      .map((message: any) => ({
        role: message.role,
        content: String(message.content || "").slice(0, 2000),
      }))
      .filter((message: any) => message.content);

    const chat: any[] = [
      {
        role: "system",
        content: `You are the Veydra assistant for ${settings?.company_name || "this company"} in ${area?.name || "the selected area"}. You are a sharp operations manager, not a report. Today is ${new Date().toISOString().slice(0, 10)}. You can only see this area.

Think, then write for a phone. Short lines. Put a blank line between ideas. When you name people or amounts, use a bullet list, one person per line, as "- **Name**, date, amount". Bold only the name. Do not write a wall of text. No tables. No field names.

Facts still come from the desk below. overdue is already past the due date. Name those people and the amount first. incoming rows are only the next 30 days. A booked row this week is a new booking, the first payment, and the package value is not the cash collected. For how to do something, call help and repeat that article. Do not swap in a different screen. A wedding that is finished but not edited is Post-Production: Drive link, Ready to Edit, then the editor. That is not a portal reminder. If they name one couple, call find_wedding. If they say automation or workflow, those are Ovanta workflows, not pipelines and not a Veydra settings page. Name each one and say published or draft. Do not invent the steps inside a workflow. Do not answer with Settings, job posting, or Messages. If they ask about Ovanta pipelines, calendars, or leads, call ovanta. A pipeline audit names each pipeline, then each stage with open deals, the count, the money, and how many have not moved in 14 days. You cannot add or edit users, send a text or email, or touch another location. Never invent a number, a name, or a date.

You cannot change records, send messages, or pay anyone. You can tell them the next click.`,
      },
      ...history,
    ];

    const question = history[history.length - 1]?.content || "";
    if (/analyze yesterday'?s calls|yesterday'?s call analysis/i.test(question)) {
      try {
        const reply = await callAnalysis(db, territoryId, apiKey);
        return jsonResp({ reply, area: area?.name || null, company: settings?.company_name || null });
      } catch (error: any) {
        return jsonResp({
          reply: `The call analysis stopped before it finished. ${error?.message || "Try it once more."}`,
          area: area?.name || null,
          company: settings?.company_name || null,
        });
      }
    }
    if (/audit our salespeople|sales audit/i.test(question)) {
      const reply = await salesAudit(db, territoryId, req.headers.get("Authorization") || "");
      return jsonResp({ reply, area: area?.name || null, company: settings?.company_name || null });
    }
    if (/automation|workflow/i.test(question)) {
      const listed = await listWorkflows(db, territoryId);
      const reply = listed.error
        ? listed.error
        : listed.workflows.length
          ? formatWorkflows(listed.company, listed.workflows)
          : `Ovanta returned no automations for ${listed.company}.`;
      return jsonResp({ reply, area: area?.name || null, company: settings?.company_name || null });
    }
    const notes = findHelp(question);
    const howTo = /how do|what do i|where do|how to|what happens/i.test(question);
    const aboutOvanta = /ovanta|pipeline|calendar/i.test(question);
    if (howTo && !aboutOvanta && Array.isArray(notes.articles) && notes.articles.length) {
      return jsonResp({
        reply: notes.articles[0].steps,
        area: area?.name || null,
        company: settings?.company_name || null,
      });
    }
    const noteReply = Array.isArray(notes.articles)
      ? notes.articles.map((article: any) => article.steps).join("\n\n")
      : "";

    const cache = new Map<string, Promise<any>>();
    const deskKey = "this_week||";
    cache.set(deskKey, areaSnapshot(db, territoryId, { period: "this_week" }));
    let deskText = "The desk could not load. Say that. Do not invent a number.";
    try {
      deskText = formatDesk(await cache.get(deskKey));
    } catch (deskError: any) {
      deskText = `The desk could not load: ${deskError?.message || "unknown error"}. Say that. Do not invent a number.`;
    }
    chat[0].content += `\n\n${deskText}`;

    const model = Deno.env.get("ASSISTANT_MODEL") || "grok-4.7";
    for (let round = 0; round < 3; round++) {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 700,
          messages: chat,
          tools: TOOLS,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (noteReply && !aboutOvanta) {
          return jsonResp({
            reply: noteReply,
            area: area?.name || null,
            company: settings?.company_name || null,
          });
        }
        const detail = payload?.error?.message || payload?.error || res.statusText || "no detail";
        return jsonResp({ error: `Assistant request failed (${res.status}): ${detail}` }, 502);
      }
      const message = payload.choices?.[0]?.message;
      const calls = message?.tool_calls || [];
      if (!calls.length) {
        return jsonResp({
          reply: message?.content || (!aboutOvanta && noteReply) || "I could not answer that from this area.",
          area: area?.name || null,
          company: settings?.company_name || null,
        });
      }
      chat.push(message);
      for (const call of calls) {
        let args = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch {
          args = {};
        }
        const result = await runTool(db, territoryId, call.function?.name, args, cache);
        chat.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
    return jsonResp({ reply: (!aboutOvanta && noteReply) || "I could not finish that from this area's records." });
  } catch (error: any) {
    return jsonResp({ error: error?.message || "Assistant failed" }, 500);
  }
});
