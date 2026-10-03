import { getCompanyTimezone } from "./utils";

/**
 * Shared payment-schedule builder for the Photo Sign & Pay (proposal) and
 * direct Book flows.
 *
 * The bride sees a schedule built by `generatePaymentSchedule`. This module
 * rebuilds that SAME schedule into the GHL invoice "installments" shape
 * (`{ date: "YYYY-MM-DD", amount }`), so the invoice the bride opens matches
 * the schedule she saw on screen — for custom plans AND the standard plans.
 *
 * Only the deposit/first row is "today"; every later row keeps its calendar
 * date. Past dates are clamped to today so the CRM never rejects a due date.
 */

export interface PlanInstallment {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface WeddingCustomPlan {
  enabled: boolean;
  deposit: number;
  installments: PlanInstallment[];
}

export interface BuildScheduleInput {
  /** The on-screen plan key: "deposit" | "half" | "fifty_fifty" | "quarterly" | "full" | "custom". */
  paymentOption: string;
  /** Contract total (package + addons - discounts). */
  totalPrice: number;
  /** Already paid toward the contract. The schedule sums to totalPrice - paid. */
  paidSoFar?: number;
  /** Wedding date (YYYY-MM-DD). Used to anchor 10-days-before final balances. */
  weddingDate?: string;
  /** Contract createdAt ISO, used as "today" anchor (matches the on-screen display). */
  createdAt?: string;
  /** A custom plan already filled in (enabled, deposit, installments). */
  customPlan?: WeddingCustomPlan | null;
}

/**
 * Parse a raw custom_payment_plan value (often a JSON string straight from the
 * DB) into a normalized { enabled, deposit, installments } object. Returns
 * null when there is no plan. Booleans like "true"/1 are coerced so a string
 * payload never leaves `enabled` as a truthy non-boolean.
 */
export function parseCustomPlan(raw: any): WeddingCustomPlan | null {
  if (!raw) return null;
  let plan = raw;
  if (typeof raw === "string") {
    try {
      plan = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!plan || typeof plan !== "object") return null;
  const installments = Array.isArray(plan.installments)
    ? plan.installments
    : [];
  return {
    enabled:
      plan.enabled === true || plan.enabled === "true" || plan.enabled === 1,
    deposit: Number(plan.deposit) || 0,
    installments: installments.map((i: any) => ({
      date: String(i?.date || "").slice(0, 10),
      amount: Number(i?.amount) || 0,
    })),
  };
}

/**
 * A custom plan is "active" — and must win over the $99 standard deposit —
 * when ANY of:
 *  - enabled is true, OR
 *  - the saved payment_plan is "custom", OR
 *  - installments exist (a missing enabled flag must NOT revert to $99).
 */
export function isCustomPlanActive(
  customPlanRaw: any,
  paymentPlan?: string,
): boolean {
  const p = parseCustomPlan(customPlanRaw);
  if (p?.enabled) return true;
  if (paymentPlan === "custom") return true;
  if (p && p.installments.length > 0) return true;
  return false;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startAnchor(createdAt?: string): Date {
  if (createdAt) {
    if (createdAt.includes("T")) {
      const d = new Date(createdAt);
      return new Date(
        d.toLocaleDateString("en-US", { timeZone: getCompanyTimezone() }),
      );
    }
    const [y, m, dd] = createdAt.split("-").map(Number);
    return new Date(y, m - 1, dd);
  }
  return new Date();
}

function tenDaysBefore(weddingDate?: string): Date | null {
  if (!weddingDate) return null;
  const datePart = weddingDate.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const wedding = new Date(year, month - 1, day);
  wedding.setDate(wedding.getDate() - 10);
  return wedding;
}

/** Round to 2dp to avoid float drift. */
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build the installments array (sum === total - paid) for a given plan.
 * Returns [] when nothing remains to collect.
 */
export function buildInstallments(
  input: BuildScheduleInput,
): PlanInstallment[] {
  const total = Math.max(0, Number(input.totalPrice) || 0);
  const paid = Math.max(0, Number(input.paidSoFar) || 0);
  const remaining = Math.max(0, total - paid);
  if (remaining <= 0.01) return [];

  const today = new Date();
  const todayStr = ymd(today);
  const start = startAnchor(input.createdAt);
  const startStr = ymd(start);

  // 1. Custom plan — use its rows directly (clamped/merged). A custom plan is
  //    active when enabled is true, paymentOption is "custom", OR installments
  //    exist. A missing enabled flag must not revert to the $99 standard rows.
  const cpp = parseCustomPlan(input.customPlan);
  const customActive =
    input.paymentOption === "custom" ||
    (cpp?.enabled ?? false) ||
    (cpp?.installments?.length ?? 0) > 0;
  if (cpp && customActive && Array.isArray(cpp.installments)) {
    const deposit = Math.min(money(cpp.deposit || 0), remaining);
    const rows: PlanInstallment[] = [];
    if (deposit > 0) rows.push({ date: startStr, amount: deposit });

    let scheduled = deposit;
    for (const inst of cpp.installments) {
      const amt = money(Number(inst.amount) || 0);
      if (amt <= 0) continue;
      let due = (inst.date || "").slice(0, 10);
      if (!due) continue;
      if (due < todayStr) due = todayStr;
      const rowAmt = Math.min(amt, Math.max(0, remaining - scheduled));
      if (rowAmt <= 0) break;
      rows.push({ date: due, amount: rowAmt });
      scheduled = money(scheduled + rowAmt);
    }

    return mergeAndCap(rows, remaining);
  }

  // 2. Pay in full — single today row.
  if (input.paymentOption === "full") {
    return mergeAndCap([{ date: startStr, amount: remaining }], remaining);
  }

  // 3. 50/50 — half today, half 10 days before wedding.
  if (input.paymentOption === "half" || input.paymentOption === "fifty_fifty") {
    const half = money(remaining / 2);
    const rows: PlanInstallment[] = [{ date: startStr, amount: half }];
    const final = money(remaining - half);
    const tdb = tenDaysBefore(input.weddingDate);
    rows.push({
      date: clampDate(tdb ? ymd(tdb) : startStr, todayStr),
      amount: final,
    });
    return mergeAndCap(rows, remaining);
  }

  // 4. Standard / quarterly / monthly — $99 retainer today, then $250
  //    installments (monthly or quarterly) until the 10-days-before final
  //    balance, identical to generatePaymentSchedule's deposit branch.
  const retainer = Math.min(99, remaining);
  const rows: PlanInstallment[] = [{ date: startStr, amount: retainer }];

  let left = money(remaining - retainer);
  const tdb = tenDaysBefore(input.weddingDate);
  const finalDate = tdb ? ymd(tdb) : startStr;
  let current = new Date(start);
  current.setMonth(current.getMonth() + 1);

  while (left > 0 && tdb && current < tdb) {
    const amount = Math.min(250, left);
    rows.push({ date: ymd(current), amount });
    left = money(left - amount);
    current.setMonth(
      current.getMonth() + (input.paymentOption === "quarterly" ? 3 : 1),
    );
  }
  if (left > 0) {
    rows.push({ date: clampDate(finalDate, todayStr), amount: left });
  }

  return mergeAndCap(rows, remaining);
}

function clampDate(d: string, todayStr: string): string {
  return d < todayStr ? todayStr : d;
}

/** Merge same-day rows into one, clamp past dates to today, cap to remaining. */
function mergeAndCap(
  rows: PlanInstallment[],
  remaining: number,
): PlanInstallment[] {
  const todayStr = ymd(new Date());
  const byDay: Record<string, number> = {};
  const order: string[] = [];
  for (const r of rows) {
    const d = clampDate((r.date || "").slice(0, 10), todayStr);
    if (!byDay[d]) {
      byDay[d] = 0;
      order.push(d);
    }
    byDay[d] = money(byDay[d] + r.amount);
  }
  const merged = order
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((d) => ({ date: d, amount: byDay[d] }));

  let sum = merged.reduce((s, r) => s + r.amount, 0);
  if (sum > remaining + 0.01 && merged.length > 0) {
    const diff = money(sum - remaining);
    merged[merged.length - 1].amount = money(
      merged[merged.length - 1].amount - diff,
    );
    sum = money(sum - diff);
  }
  // Guard: if rounding left a tiny gap, nudge the last row up.
  if (sum < remaining - 0.01 && merged.length > 0) {
    merged[merged.length - 1].amount = money(
      merged[merged.length - 1].amount + (remaining - sum),
    );
  }
  return merged;
}

/**
 * Build the weddings.custom_payment_plan object to persist so the wedding
 * row carries the same schedule the bride saw + the invoice uses.
 *
 * For standard plans this normalizes the plan into the custom-plan shape
 * (enabled, deposit, installments) so the PHOTO invoice path and the on-page
 * schedule agree. For an existing custom plan it returns it as-is.
 */
export function buildWeddingCustomPlan(
  input: BuildScheduleInput,
): WeddingCustomPlan | null {
  const total = Math.max(0, Number(input.totalPrice) || 0);
  const paid = Math.max(0, Number(input.paidSoFar) || 0);
  const remaining = Math.max(0, total - paid);

  // Existing custom plan — keep as-is when active (enabled, paymentOption
  // "custom", or installments present). A missing enabled flag with rows
  // still keeps those exact rows.
  const cpp = parseCustomPlan(input.customPlan);
  const customActive =
    input.paymentOption === "custom" ||
    (cpp?.enabled ?? false) ||
    (cpp?.installments?.length ?? 0) > 0;
  if (cpp && customActive) {
    return {
      enabled: true,
      deposit: money(Number(cpp.deposit) || 0),
      installments: (cpp.installments || []).map((i) => ({
        date: (i.date || "").slice(0, 10),
        amount: money(Number(i.amount) || 0),
      })),
    };
  }

  const rows = buildInstallments(input);
  if (rows.length === 0 || remaining <= 0) {
    return { enabled: true, deposit: 0, installments: [] };
  }

  const todayStr = ymd(new Date());
  const deposit =
    rows.find((r) => r.date <= todayStr)?.amount ?? rows[0].amount;
  const installments = rows
    .filter((r) => r.date > todayStr)
    .map((r) => ({ date: r.date, amount: r.amount }));

  return { enabled: true, deposit: money(deposit), installments };
}
