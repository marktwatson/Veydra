import { supabase } from "./supabase";

/**
 * Command page data layer.
 *
 * Reads territories, royalty_periods, royalty_sales, weddings, proposals, jobs.
 * Groups by territory_id. Rows with a null territory_id are left out — we never
 * invent a territory for them.
 *
 * Read-only. Never writes to royalty_periods, weddings, or Stripe.
 */

export interface CommandAreaRow {
  id: string;
  name: string;
  grossThisWeek: number;
  grossThisMonth: number;
  royaltyDue: number;
  paybackDue: number;
  totalDue: number;
  royaltyStatus: "paid" | "processing" | "failed" | "no run this period";
  weddingsBookedThisMonth: number;
  proposalsWaiting: number;
  openCoverageJobs: number;
  lastPeriodStart: string | null;
  lastPeriodEnd: string | null;
  score: number;
  rank: number;
  gap: string;
}

export interface CommandTotals {
  grossSales: number;
  royaltyDue: number;
  royaltyCollected: number;
  paybackCollected: number;
  amountProcessing: number;
}

export interface CommandData {
  totals: CommandTotals;
  areas: CommandAreaRow[];
  empty: boolean;
}

const DEFAULT_TZ = "America/Chicago";

/** Monday–Sunday week window in a given IANA timezone. */
function weekWindow(tz: string, ref = new Date()): { start: Date; end: Date } {
  let parts: { year: string; month: string; day: string; weekday: string };
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const p: any = {};
    for (const x of dtf.formatToParts(ref)) p[x.type] = x.value;
    parts = p;
  } catch {
    const dtf = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const p: any = {};
    for (const x of dtf.formatToParts(ref)) p[x.type] = x.value;
    parts = p;
  }
  const dm: any = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const todayDow = dm[parts.weekday] ?? 1;
  // Monday = 1. Days since Monday.
  const sinceMon = (todayDow - 1 + 7) % 7;
  const monday = new Date(
    `${parts.year}-${parts.month}-${parts.day}T00:00:00Z`,
  );
  monday.setUTCDate(monday.getUTCDate() - sinceMon);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 7);
  return { start: monday, end: sunday };
}

/** First/last of the current calendar month in the given timezone. */
function monthWindow(tz: string, ref = new Date()): { start: Date; end: Date } {
  let parts: { year: string; month: string };
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    });
    const p: any = {};
    for (const x of dtf.formatToParts(ref)) p[x.type] = x.value;
    parts = p as any;
  } catch {
    parts = {
      year: String(ref.getUTCFullYear()),
      month: String(ref.getUTCMonth() + 1).padStart(2, "0"),
    };
  }
  const start = new Date(`${parts.year}-${parts.month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

function toLocalDateStr(d: Date, tz: string): string {
  // Convert the UTC instant to a YYYY-MM-DD in the portal timezone, so the
  // gte/lte date filters match how sale_date / period_start are stored.
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const p: any = {};
    for (const x of dtf.formatToParts(d)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return d.toISOString().split("T")[0];
  }
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function loadCommandData(): Promise<CommandData> {
  // Load all territories + the portal timezone (any row; tz is per-area but we
  // just need one for the week/month window — default America/Chicago).
  const [terrRes, psRes] = await Promise.all([
    supabase
      .from("territories")
      .select("id, name, royalty_percentage, payback_percentage")
      .order("name", { ascending: true }),
    supabase
      .from("portal_settings")
      .select("timezone, company_timezone")
      .limit(1)
      .maybeSingle(),
  ]);

  if (terrRes.error && terrRes.error.code !== "42P01") throw terrRes.error;
  const territories = (terrRes.data || []) as any[];
  const tz = psRes.data?.timezone || psRes.data?.company_timezone || DEFAULT_TZ;

  if (territories.length === 0) {
    return {
      totals: {
        grossSales: 0,
        royaltyDue: 0,
        royaltyCollected: 0,
        paybackCollected: 0,
        amountProcessing: 0,
      },
      areas: [],
      empty: true,
    };
  }

  const terrIds = territories.map((t) => t.id);

  const week = weekWindow(tz);
  const month = monthWindow(tz);
  const weekStartStr = toLocalDateStr(week.start, tz);
  const weekEndStr = toLocalDateStr(week.end, tz);
  const monthStartStr = toLocalDateStr(month.start, tz);
  const monthEndStr = toLocalDateStr(month.end, tz);

  // Pull everything in parallel. Each query scopes by territory_id where the
  // column exists; rows with null territory_id are filtered out in JS.
  const [periodsRes, salesRes, weddingsRes, proposalsRes, jobsRes] =
    await Promise.all([
      supabase
        .from("royalty_periods")
        .select("*")
        .in("territory_id", terrIds)
        .order("period_start", { ascending: false }),
      supabase.from("royalty_sales").select("*").in("territory_id", terrIds),
      supabase
        .from("weddings")
        .select("id, territory_id, status, date, paid_amount, created_at"),
      supabase.from("proposals").select("id, territory_id, status, created_at"),
      supabase
        .from("jobs")
        .select("id, territory_id, coverage_request, contractor_id, status"),
    ]);

  // Tolerate missing columns / RLS — never throw on a soft read failure.
  const periods = (periodsRes.data || []) as any[];
  const sales = (salesRes.data || []) as any[];
  const weddings = (weddingsRes.data || []) as any[];
  const proposals = (proposalsRes.data || []) as any[];
  const jobs = (jobsRes.data || []) as any[];

  const byId = new Map(territories.map((t) => [t.id, t]));

  // ─── Per-territory rollup ───
  const areaMap = new Map<string, CommandAreaRow>();
  for (const t of territories) {
    areaMap.set(t.id, {
      id: t.id,
      name: t.name,
      grossThisWeek: 0,
      grossThisMonth: 0,
      royaltyDue: 0,
      paybackDue: 0,
      totalDue: 0,
      royaltyStatus: "no run this period",
      weddingsBookedThisMonth: 0,
      proposalsWaiting: 0,
      openCoverageJobs: 0,
      lastPeriodStart: null,
      lastPeriodEnd: null,
      score: 0,
      rank: 0,
      gap: "",
    });
  }

  // Sales → gross this week / this month (exclude refunds + test sales).
  for (const s of sales) {
    if (!s.territory_id || !areaMap.has(s.territory_id)) continue;
    if (s.is_refund || s.is_test) continue;
    const row = areaMap.get(s.territory_id)!;
    const day = String(s.sale_date || "").slice(0, 10);
    const amt = num(s.sale_amount);
    if (day >= weekStartStr && day < weekEndStr) row.grossThisWeek += amt;
    if (day >= monthStartStr && day < monthEndStr) row.grossThisMonth += amt;
  }

  // Royalty periods → due / status / last period.
  for (const p of periods) {
    if (!p.territory_id || !areaMap.has(p.territory_id)) continue;
    const row = areaMap.get(p.territory_id)!;
    // Most recent period drives status + last window.
    if (
      !row.lastPeriodStart ||
      String(p.period_start) > String(row.lastPeriodStart)
    ) {
      row.lastPeriodStart = String(p.period_start);
      row.lastPeriodEnd = String(p.period_end);
      const st = String(p.status || "");
      if (st === "paid" || st === "waived") row.royaltyStatus = "paid";
      else if (st === "processing") row.royaltyStatus = "processing";
      else if (st === "failed") row.royaltyStatus = "failed";
      else row.royaltyStatus = "no run this period";
      row.royaltyDue = num(p.royalty_amount);
      row.paybackDue = num(p.payback_amount);
      row.totalDue = num(p.total_due);
    }
  }

  // Weddings booked this month (status upcoming/completed, or paid_amount > 0).
  for (const w of weddings) {
    if (!w.territory_id || !areaMap.has(w.territory_id)) continue;
    const row = areaMap.get(w.territory_id)!;
    const status = String(w.status || "").toLowerCase();
    const paid = num(w.paid_amount);
    const booked = status === "upcoming" || status === "completed" || paid > 0;
    if (!booked) continue;
    // created_at falls in this month.
    const created = String(w.created_at || "").slice(0, 10);
    if (created >= monthStartStr && created < monthEndStr) {
      row.weddingsBookedThisMonth += 1;
    }
  }

  // Proposals waiting (not booked, not superseded, not cancelled).
  for (const pr of proposals) {
    if (!pr.territory_id || !areaMap.has(pr.territory_id)) continue;
    const row = areaMap.get(pr.territory_id)!;
    const status = String(pr.status || "").toLowerCase();
    if (
      status === "booked" ||
      status === "superseded" ||
      status === "cancelled"
    )
      continue;
    row.proposalsWaiting += 1;
  }

  // Open coverage jobs (coverage_request true and contractor_id null).
  for (const j of jobs) {
    if (!j.territory_id || !areaMap.has(j.territory_id)) continue;
    const row = areaMap.get(j.territory_id)!;
    if (j.coverage_request === true && !j.contractor_id) {
      row.openCoverageJobs += 1;
    }
  }

  // ─── Scoring (out of 100) ───
  // 30 sales vs trailing 4-week avg
  // 25 royalty status paid
  // 15 no failed period this week
  // 15 no open coverage jobs
  // 15 no proposals left in draft created this week
  for (const t of territories) {
    const row = areaMap.get(t.id)!;
    let score = 0;
    const gaps: string[] = [];

    // 30 — sales vs trailing 4-week average.
    const fourWeeksAgo = new Date(week.start);
    fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 28);
    const fwStartStr = toLocalDateStr(fourWeeksAgo, tz);
    const priorSales = sales.filter(
      (s) =>
        s.territory_id === t.id &&
        !s.is_refund &&
        !s.is_test &&
        String(s.sale_date || "").slice(0, 10) >= fwStartStr &&
        String(s.sale_date || "").slice(0, 10) < weekStartStr,
    );
    const priorGross = priorSales.reduce(
      (sum, s) => sum + num(s.sale_amount),
      0,
    );
    const priorAvg = priorGross / 4;
    if (row.grossThisWeek >= priorAvg && priorAvg > 0) score += 30;
    else if (priorAvg === 0 && row.grossThisWeek > 0) score += 30;
    else if (priorAvg > 0) {
      const ratio = row.grossThisWeek / priorAvg;
      score += Math.round(30 * Math.min(1, ratio));
      if (row.grossThisWeek < priorAvg)
        gaps.push(
          `sales ${Math.round((row.grossThisWeek / priorAvg) * 100)}% of 4-wk avg`,
        );
    } else {
      gaps.push("no sales this week");
    }

    // 25 — royalty status paid.
    if (row.royaltyStatus === "paid") score += 25;
    else gaps.push(`royalty ${row.royaltyStatus}`);

    // 15 — no failed period this week.
    const failedThisWeek = periods.some(
      (p) =>
        p.territory_id === t.id &&
        p.status === "failed" &&
        String(p.period_start) >= weekStartStr &&
        String(p.period_end) <= weekEndStr,
    );
    if (!failedThisWeek) score += 15;
    else gaps.push("a failed royalty period this week");

    // 15 — no open coverage jobs.
    if (row.openCoverageJobs === 0) score += 15;
    else
      gaps.push(
        `${row.openCoverageJobs} open coverage job${row.openCoverageJobs > 1 ? "s" : ""}`,
      );

    // 15 — no proposals left in draft created this week.
    const draftsThisWeek = proposals.filter(
      (pr) =>
        pr.territory_id === t.id &&
        String(pr.status || "").toLowerCase() === "draft" &&
        String(pr.created_at || "").slice(0, 10) >= weekStartStr &&
        String(pr.created_at || "").slice(0, 10) < weekEndStr,
    );
    if (draftsThisWeek.length === 0) score += 15;
    else
      gaps.push(
        `${draftsThisWeek.length} draft proposal${draftsThisWeek.length > 1 ? "s" : ""} this week`,
      );

    row.score = score;
    row.gap = gaps[0] ? `Biggest gap: ${gaps[0]}.` : "No gaps this week.";
  }

  // Rank by score desc.
  const areas = Array.from(areaMap.values()).sort((a, b) => b.score - a.score);
  areas.forEach((a, i) => (a.rank = i + 1));

  // ─── Totals (all territories, current week) ───
  const totals: CommandTotals = {
    grossSales: 0,
    royaltyDue: 0,
    royaltyCollected: 0,
    paybackCollected: 0,
    amountProcessing: 0,
  };
  for (const p of periods) {
    if (!p.territory_id || !byId.has(p.territory_id)) continue;
    // Only count the most recent period per territory (the current week's run).
    const row = areaMap.get(p.territory_id)!;
    if (String(p.period_start) === row.lastPeriodStart) {
      totals.royaltyDue += num(p.royalty_amount);
      if (p.status === "paid" || p.status === "waived") {
        totals.royaltyCollected += num(p.royalty_amount);
        totals.paybackCollected += num(p.payback_amount);
      } else if (p.status === "processing") {
        totals.amountProcessing += num(p.total_due);
      }
    }
  }
  for (const s of sales) {
    if (!s.territory_id || !byId.has(s.territory_id)) continue;
    if (s.is_refund || s.is_test) continue;
    const day = String(s.sale_date || "").slice(0, 10);
    if (day >= weekStartStr && day < weekEndStr)
      totals.grossSales += num(s.sale_amount);
  }

  return { totals, areas, empty: false };
}
