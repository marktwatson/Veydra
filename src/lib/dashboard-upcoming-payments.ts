import { buildAuditScheduleItems } from "@/lib/audit-schedule";

/**
 * Build the 14-day "Upcoming Revenue" list for the manager Dashboard using the
 * SAME audit-schedule helper as Payment Audit, so the two figures always match.
 *
 * Rules (mirrors Payment Audit):
 *  - Includes weddings with status upcoming OR pending. Cancelled and draft
 *    weddings are already dropped by buildAuditScheduleItems.
 *  - Never skips a wedding because its date is blank or its payment_plan is
 *    "full" when a custom_payment_plan is enabled — the helper handles that.
 *  - Counts only rows whose status is "pending" or "partial".
 *  - Due date is parsed as local noon (YYYY-MM-DD or MM/DD/YYYY) by the helper
 *    (it stores it on `parsedDate`). We compare against the local "today" and
 *    "today + 14 days" passed in by the caller.
 *  - Returns { amount, wedding, parsedDate } shaped like the old
 *    generatePaymentSchedule-based list so the Dashboard card renders
 *    unchanged.
 */
export function buildUpcomingPayments(
  weddings: any[],
  today: Date,
  fourteenDaysFromNow: Date,
) {
  return buildAuditScheduleItems(weddings)
    .filter(
      (item) =>
        (item.status === "pending" || item.status === "partial") &&
        item.parsedDate &&
        item.parsedDate >= today &&
        item.parsedDate <= fourteenDaysFromNow,
    )
    .map((item) => ({
      amount: item.installmentAmount,
      wedding: { client_name: item.clientName } as any,
      parsedDate: item.parsedDate as Date,
    }))
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
}
