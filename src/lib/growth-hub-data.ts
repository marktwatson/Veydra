// Pure data-computation helpers for the Growth Hub.
//
// Extracted from GrowthHub.tsx so the page stays under the per-file line limit
// and the date-range / chart-trend / funnel logic is testable in isolation.
// These functions take already-fetched raw data + the active filters and
// return derived values. No React, no side effects.

export type DateRangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "last_7"
  | "this_month"
  | "last_30"
  | "last_90"
  | "this_year"
  | "custom";

export type ChartGranularity = "auto" | "daily" | "weekly" | "monthly";

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
  datePresetParam: string | null;
}

/** Resolve the active date-range preset (and optional custom dates) to a window. */
export function computeDateRange(
  preset: DateRangePreset,
  customStart: string,
  customEnd: string,
): DateRange {
  const now = new Date();
  if (preset === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, datePresetParam: "today" };
  }
  if (preset === "yesterday") {
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, datePresetParam: "yesterday" };
  }
  if (preset === "last_7") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, datePresetParam: "last_7d" };
  }
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { startDate: start, endDate: end, datePresetParam: "this_month" };
  }
  if (preset === "last_30") {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, datePresetParam: "last_30d" };
  }
  if (preset === "last_90") {
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, datePresetParam: "last_90d" };
  }
  if (preset === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return { startDate: start, endDate: end, datePresetParam: "this_year" };
  }
  if (preset === "custom") {
    const start = customStart ? new Date(customStart + "T00:00:00") : null;
    const end = customEnd ? new Date(customEnd + "T23:59:59") : null;
    return { startDate: start, endDate: end, datePresetParam: null };
  }
  return { startDate: null, endDate: null, datePresetParam: "maximum" };
}

/** Build a date-range predicate (closure) for the active window. */
export function makeIsDateInRange(
  startDate: Date | null,
  endDate: Date | null,
) {
  return (dateVal?: string | Date | null): boolean => {
    if (!startDate && !endDate) return true;
    if (!dateVal) return false;
    let d: Date;
    if (
      typeof dateVal === "string" &&
      dateVal.length === 10 &&
      dateVal.includes("-")
    ) {
      const [y, m, dayNum] = dateVal.split("-").map(Number);
      d = new Date(y, m - 1, dayNum);
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return false;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };
}

const COLOR_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
];

export interface FunnelItem {
  stage: string;
  count: number;
  fill: string;
}

export function computeFunnelData(
  leadsCount: number,
  proposalsCount: number,
  bookedCount: number,
): FunnelItem[] {
  return [
    { stage: "New Inquiries", count: leadsCount || 0, fill: "#3b82f6" },
    { stage: "Proposals Sent", count: proposalsCount || 0, fill: "#8b5cf6" },
    { stage: "Contracts Booked", count: bookedCount || 0, fill: "#10b981" },
  ];
}

export interface SourceItem {
  name: string;
  value: number;
  color: string;
}

export function computeSourceDistribution(leads: any[]): SourceItem[] {
  const sourceCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const src = l.source || "Direct / Website";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  return Object.keys(sourceCounts).length > 0
    ? Object.entries(sourceCounts).map(([name, value], idx) => ({
        name,
        value,
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      }))
    : [{ name: "Direct / Website", value: 1, color: "#10b981" }];
}

export interface TrendPoint {
  label: string;
  revenue: number;
  adSpend: number;
  bookings: number;
}

/** Build the revenue/ad-spend trend series grouped by the chosen granularity. */
export function computeChartTrends(
  granularity: ChartGranularity,
  preset: DateRangePreset,
  startDate: Date | null,
  endDate: Date | null,
  bookedWeddings: any[],
  validCampaigns: any[],
  totalAdSpend: number,
): TrendPoint[] {
  // Collect real daily ad spend breakdown from Meta API insights if available
  const dailyAdSpendMap: Record<string, number> = {};
  validCampaigns.forEach((c: any) => {
    if (Array.isArray(c.dailyBreakdown)) {
      c.dailyBreakdown.forEach((item: any) => {
        if (item.date) {
          dailyAdSpendMap[item.date] =
            (dailyAdSpendMap[item.date] || 0) + (item.spend || 0);
        }
      });
    }
  });

  let effectiveGranularity = granularity;
  if (granularity === "auto") {
    if (preset === "today" || preset === "yesterday" || preset === "last_7") {
      effectiveGranularity = "daily";
    } else if (startDate && endDate) {
      const diffDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays <= 62) effectiveGranularity = "daily";
      else if (diffDays <= 180) effectiveGranularity = "weekly";
      else effectiveGranularity = "monthly";
    } else if (preset === "this_month" || preset === "last_30") {
      effectiveGranularity = "daily";
    } else if (preset === "last_90") {
      effectiveGranularity = "weekly";
    } else {
      effectiveGranularity = "monthly";
    }
  }

  const parseDate = (rawDate: string) => {
    let d: Date;
    if (
      typeof rawDate === "string" &&
      rawDate.length === 10 &&
      rawDate.includes("-")
    ) {
      const [y, m, dayNum] = rawDate.split("-").map(Number);
      d = new Date(y, m - 1, dayNum);
    } else {
      d = new Date(rawDate);
    }
    return d;
  };

  // --- DAILY ---
  if (effectiveGranularity === "daily") {
    const dayMap: Record<
      string,
      { label: string; revenue: number; count: number; adSpend: number }
    > = {};
    let startD: Date;
    let endD: Date;
    if (startDate && endDate) {
      startD = new Date(startDate);
      startD.setHours(0, 0, 0, 0);
      endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      endD = new Date(now);
      endD.setHours(23, 59, 59, 999);
      const numDays = preset === "today" || preset === "yesterday" ? 1 : 7;
      const offsetStart = preset === "yesterday" ? 1 : 0;
      startD = new Date(
        now.getTime() - (numDays - 1 + offsetStart) * 24 * 60 * 60 * 1000,
      );
      startD.setHours(0, 0, 0, 0);
    }
    const totalDaysInSpan = Math.max(
      Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)),
      1,
    );
    let curr = new Date(startD);
    while (curr <= endD) {
      const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}-${String(curr.getDate()).padStart(2, "0")}`;
      const label = curr.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
      });
      dayMap[key] = {
        label,
        revenue: 0,
        count: 0,
        adSpend:
          dailyAdSpendMap[key] !== undefined
            ? dailyAdSpendMap[key]
            : totalAdSpend > 0
              ? totalAdSpend / totalDaysInSpan
              : 0,
      };
      curr.setDate(curr.getDate() + 1);
    }
    bookedWeddings.forEach((w) => {
      const rawDate = w.contract_date || w.created_at || w.date;
      if (!rawDate) return;
      const d = parseDate(rawDate);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dayMap[key]) {
        dayMap[key].revenue += w.total_amount || 0;
        dayMap[key].count += 1;
      }
    });
    return Object.entries(dayMap).map(([_, item]) => ({
      label: item.label,
      revenue: item.revenue,
      adSpend: item.adSpend,
      bookings: item.count,
    }));
  }

  // --- WEEKLY ---
  if (effectiveGranularity === "weekly") {
    const weekMap: Record<
      string,
      { label: string; revenue: number; count: number; adSpend: number }
    > = {};
    let startD = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let endD = endDate ? new Date(endDate) : new Date();
    let curr = new Date(startD);
    while (curr <= endD) {
      const weekStart = new Date(curr);
      const weekEnd = new Date(curr.getTime() + 6 * 24 * 60 * 60 * 1000);
      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
      const label = `${weekStart.toLocaleString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleString("en-US", { month: "short", day: "numeric" })}`;
      weekMap[key] = { label, revenue: 0, count: 0, adSpend: 0 };
      curr.setDate(curr.getDate() + 7);
    }
    Object.entries(dailyAdSpendMap).forEach(([dateStr, spendVal]) => {
      const [y, m, dayNum] = dateStr.split("-").map(Number);
      const itemD = new Date(y, m - 1, dayNum);
      Object.keys(weekMap).forEach((k) => {
        const [wy, wm, wd] = k.split("-").map(Number);
        const wStart = new Date(wy, wm - 1, wd);
        const wEnd = new Date(wStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (itemD >= wStart && itemD < wEnd) weekMap[k].adSpend += spendVal;
      });
    });
    bookedWeddings.forEach((w) => {
      const rawDate = w.contract_date || w.created_at || w.date;
      if (!rawDate) return;
      const d = parseDate(rawDate);
      if (isNaN(d.getTime())) return;
      Object.keys(weekMap).forEach((k) => {
        const [wy, wm, wd] = k.split("-").map(Number);
        const wStart = new Date(wy, wm - 1, wd);
        const wEnd = new Date(wStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (d >= wStart && d < wEnd) {
          weekMap[k].revenue += w.total_amount || 0;
          weekMap[k].count += 1;
        }
      });
    });
    const keys = Object.keys(weekMap);
    return Object.entries(weekMap).map(([_, item]) => ({
      label: item.label,
      revenue: item.revenue,
      adSpend:
        item.adSpend > 0
          ? item.adSpend
          : totalAdSpend > 0
            ? totalAdSpend / Math.max(keys.length, 1)
            : 0,
      bookings: item.count,
    }));
  }

  // --- MONTHLY ---
  const bookingRevenueMap: Record<
    string,
    { label: string; revenue: number; count: number; adSpend: number }
  > = {};
  const todayDate = new Date();
  if (startDate && endDate) {
    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (curr <= endMonth) {
      const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`;
      const label = curr.toLocaleString("en-US", {
        month: "short",
        year:
          startDate.getFullYear() !== endDate.getFullYear()
            ? "2-digit"
            : undefined,
      });
      bookingRevenueMap[key] = { label, revenue: 0, count: 0, adSpend: 0 };
      curr.setMonth(curr.getMonth() + 1);
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short" });
      bookingRevenueMap[key] = { label, revenue: 0, count: 0, adSpend: 0 };
    }
  }
  Object.entries(dailyAdSpendMap).forEach(([dateStr, spendVal]) => {
    const monthKey = dateStr.substring(0, 7);
    if (bookingRevenueMap[monthKey])
      bookingRevenueMap[monthKey].adSpend += spendVal;
  });
  bookedWeddings.forEach((w) => {
    const rawDate = w.contract_date || w.created_at || w.date;
    if (!rawDate) return;
    const d = parseDate(rawDate);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (bookingRevenueMap[key]) {
      bookingRevenueMap[key].revenue += w.total_amount || 0;
      bookingRevenueMap[key].count += 1;
    }
  });
  const keys = Object.keys(bookingRevenueMap);
  return Object.entries(bookingRevenueMap)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([_, item]) => ({
      label: item.label,
      revenue: item.revenue,
      adSpend:
        item.adSpend > 0
          ? item.adSpend
          : totalAdSpend > 0
            ? totalAdSpend / Math.max(keys.length, 1)
            : 0,
      bookings: item.count,
    }));
}
