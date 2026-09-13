// Business-time helpers shared by the Layout header clock and the scheduler
// worker. All portal-local time math goes through these so the browser and
// the server agree on what "9:00 AM portal time" means.

export const DEFAULT_TZ = "America/New_York";

/** Resolve the portal timezone from settings/localStorage with a safe fallback. */
export function resolveTimezone(settings?: any): string {
  if (settings?.timezone) return settings.timezone;
  if (settings?.company_timezone) return settings.company_timezone;
  try {
    return localStorage.getItem("veydra_timezone") || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Format a Date as the portal-local clock string: "9:11 AM EDT". */
export function formatPortalClock(date: Date, tz: string): string {
  try {
    return date.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
}

/** Format a Date as the portal-local date string: "Tue, Sep 1". */
export function formatPortalDate(date: Date, tz: string): string {
  try {
    return date.toLocaleDateString("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * Convert a civil date+time in a given timezone to a UTC Date.
 * e.g. civilToUtc("2026-09-10", "09:00", "America/New_York") -> the UTC instant
 * of 9:00 AM New York time on Sep 10 2026.
 */
export function civilToUtc(dateStr: string, timeStr: string, tz: string): Date {
  // Build an ISO string with the timezone offset resolved via Intl.
  // Use the Intl API to compute the offset for the given date.
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "09:00").split(":").map(Number);
  // Construct as if UTC, then apply the timezone offset.
  const utcGuess = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  const guess = new Date(utcGuess);
  // Compute the timezone offset at that instant.
  const offsetMin = tzOffsetMinutes(guess, tz);
  return new Date(utcGuess - offsetMin * 60 * 1000);
}

/** Returns the timezone offset (in minutes) for a given date in a given tz. */
export function tzOffsetMinutes(date: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date).reduce((acc: any, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    const asUtc = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour === 24 ? 0 : +parts.hour,
      +parts.minute,
      +parts.second,
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return date.getTimezoneOffset();
  }
}

/**
 * Compute the UTC run_at instant for an offset notification.
 * - weddingDate: ISO/date string of the wedding (date-only is fine).
 * - weddingStart: optional real start time "HH:mm" (24h). Defaults to "12:00".
 * - offsetHours: hours before the wedding (negative = after). If provided,
 *   the instant is exact: weddingStart - offsetHours.
 * - offsetDays: days before the wedding (positive). Send at sendHour portal time.
 * - sendHour: hour (0-23) in portal time for day-based offsets. Defaults to 9.
 * - isAfter: if true, offsetDays is treated as days AFTER the wedding.
 */
export function computeRunAt(opts: {
  weddingDate: string;
  weddingStart?: string | null;
  offsetHours?: number | null;
  offsetDays?: number | null;
  sendHour?: number;
  isAfter?: boolean;
  tz: string;
}): Date | null {
  const { weddingDate, tz } = opts;
  if (!weddingDate) return null;
  const datePart = weddingDate.split("T")[0];
  if (!datePart) return null;

  // Hours-based offset → exact instant from ceremony anchor.
  if (opts.offsetHours != null && !Number.isNaN(opts.offsetHours)) {
    const anchorTime = opts.weddingStart || "12:00";
    const anchorUtc = civilToUtc(datePart, anchorTime, tz);
    return new Date(anchorUtc.getTime() - opts.offsetHours * 3600 * 1000);
  }

  // Days-based offset → send at sendHour portal time on the computed day.
  const sendHour = opts.sendHour ?? 9;
  const [y, m, d] = datePart.split("-").map(Number);
  const base = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dayDelta = opts.isAfter
    ? opts.offsetDays || 0
    : -(opts.offsetDays || 0);
  base.setUTCDate(base.getUTCDate() + dayDelta);
  const targetDate = base.toISOString().split("T")[0];
  return civilToUtc(targetDate, `${String(sendHour).padStart(2, "0")}:00`, tz);
}

/** Relative "Xm ago" / "Xh ago" / "Xd ago" label from a timestamp. */
export function relativeFromNow(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Health dot color based on heartbeat age (minutes). */
export function heartbeatHealth(lastSeenIso: string | null | undefined): {
  color: string;
  label: string;
} {
  if (!lastSeenIso) return { color: "bg-red-500", label: "never" };
  const diff = Date.now() - new Date(lastSeenIso).getTime();
  const min = diff / 60000;
  if (min < 20) return { color: "bg-emerald-500", label: "healthy" };
  if (min < 120) return { color: "bg-amber-500", label: "stale" };
  return { color: "bg-red-500", label: "down" };
}
