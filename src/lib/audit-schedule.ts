import { generatePaymentSchedule } from "@/lib/utils";
import { type AuditItem } from "@/components/PaymentAuditModals";

export type AuditScheduleItem = AuditItem & {
  parsedDate: Date | null;
  status: "paid" | "partial" | "overdue" | "pending";
  paymentPlan: string;
  hasCustomPlan: boolean;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
};

/**
 * Recompute a schedule row's payment status from the wedding's cumulative
 * `paid_amount` (Stripe history + GHL invoice payments merged by the webhook /
 * sync — never replaced).
 *
 * Running-total model: a row is Paid when paid_amount covers the sum of that
 * row and every earlier row. Partial when paid_amount lands between the row's
 * running start and its running end (but does not fully cover it). Otherwise
 * Pending, or Overdue if past due and not pending-only.
 *
 * `runningStart` = cumulative amount of all rows before this one.
 * `runningEnd`   = runningStart + this row's amount.
 */
function rowStatusFromPaid(
  paid: number,
  runningStart: number,
  rowAmount: number,
): "paid" | "partial" | "pending" {
  const tol = 0.5; // $0.50 tolerance for floating-point / rounding drift
  const runningEnd = runningStart + rowAmount;
  if (paid >= runningEnd - tol) return "paid";
  if (paid > runningStart + tol) return "partial";
  return "pending";
}

/**
 * Build the full list of payment-installment audit rows across every wedding.
 * Extracted from PaymentAudit.tsx so the page stays under the file-size limit.
 *
 * Row status is recomputed from cumulative `paid_amount` (Stripe + GHL) so a
 * GHL invoice payment correctly marks retainer + earlier installments Paid /
 * Partial instead of staying "Overdue". The old `inst.status` string from
 * generatePaymentSchedule is ignored for status purposes.
 *
 * IMPORTANT: when a wedding is on a deliberately-set custom plan (enabled ===
 * true) that yields zero installments — e.g. staff cancelled every future
 * payment — we must NOT fall back to a phantom "full total" payment. That
 * fallback only applies to non-custom plans that failed to generate a schedule
 * (e.g. missing wedding date).
 */
export function buildAuditScheduleItems(weddings: any[]): AuditScheduleItem[] {
  const items: AuditScheduleItem[] = [];

  const todayStr = new Date().toISOString().split("T")[0];
  const todayDate = new Date(todayStr + "T12:00:00");

  weddings.forEach((wedding: any) => {
    // Skip draft or unpaid draft records
    if (wedding.notes?.includes("[UNPAID_DRAFT]")) return;

    // Skip cancelled weddings entirely — they should never show as overdue.
    if (wedding.status === "cancelled") return;

    const total = Number(wedding.total_amount) || 0;
    const paid = Number(wedding.paid_amount) || 0;
    const plan = wedding.payment_plan || "full";
    const customPlan = wedding.custom_payment_plan;
    const weddingDate = wedding.date || "";
    const createdAt = wedding.contract_date || wedding.created_at || "";
    // Pending (unsigned proposal) weddings only show installments that are
    // already paid (e.g. a deposit collected before the contract was signed).
    // Their future-dated installments are NOT "overdue" — the contract isn't
    // signed yet — so we never mark them overdue. This stops unsigned
    // proposals with past retainer dates from inflating the overdue count.
    const isPending = wedding.status === "pending";

    // Generate expected payment breakdown
    let schedule = generatePaymentSchedule(
      total,
      plan,
      weddingDate,
      createdAt,
      paid,
      customPlan,
    );

    // A custom plan that returns [] means staff intentionally cancelled all
    // future payments — respect that and show nothing. Only fall back to a
    // single full-total entry for non-custom plans that failed to generate.
    const hasCustomPlan =
      plan === "custom" ||
      (customPlan && (customPlan as any)?.enabled === true);
    if ((!schedule || schedule.length === 0) && !hasCustomPlan) {
      const isPaidInFull =
        paid > 0 && (paid >= total - 1 || paid >= total * 0.945);
      schedule = [
        {
          date: weddingDate
            ? new Date(weddingDate + "T12:00:00").toLocaleDateString("en-US")
            : "TBD",
          amount: total,
          label: plan === "full" ? "Pay in Full" : "Package Balance",
          status: isPaidInFull ? "paid" : "pending",
        },
      ];
    }

    // ── Recompute row statuses from cumulative paid_amount ──
    // Running total across the installments so a later payment covers the
    // retainer and earlier rows too (paid_amount is cumulative, not per-row).
    let runningStart = 0;

    // Map schedule items into structured records
    schedule.forEach((inst: any, index: number) => {
      const rowAmount = Number(inst.amount) || 0;
      const computed = rowStatusFromPaid(paid, runningStart, rowAmount);
      const isPaid = computed === "paid";
      const isPartial = computed === "partial";

      // Parse payment date
      let parsedDate: Date | null = null;
      if (inst.date && inst.date !== "TBD") {
        const parts = inst.date.split("/");
        if (parts.length === 3) {
          parsedDate = new Date(
            `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}T12:00:00`,
          );
        } else {
          parsedDate = new Date(inst.date);
        }
      }

      // Overdue only applies to rows that are not yet covered by paid_amount.
      // Paid and Partial rows are never overdue. Pending unsigned-proposal
      // weddings never go overdue either.
      let isOverdue = false;
      if (!isPaid && !isPartial && parsedDate && !isPending) {
        isOverdue = parsedDate < todayDate;
      }

      let finalStatus: AuditScheduleItem["status"] = "pending";
      if (isPaid) finalStatus = "paid";
      else if (isPartial) finalStatus = "partial";
      else if (isOverdue) finalStatus = "overdue";

      items.push({
        id: `${wedding.id}-${index}`,
        weddingId: wedding.id,
        scheduleIndex: index,
        clientName: wedding.client_name || "Unknown Client",
        clientEmail:
          wedding.client_email ||
          wedding.questionnaire_data?.contact_info?.email ||
          "",
        weddingDate: weddingDate,
        totalAmount: total,
        paidAmount: paid,
        installmentLabel: inst.label || `Installment #${index + 1}`,
        installmentAmount: rowAmount,
        installmentDate: inst.date,
        parsedDate,
        status: finalStatus,
        paymentPlan: plan,
        hasCustomPlan: plan === "custom" || customPlan?.enabled,
        stripeCustomerId: wedding.stripe_customer_id,
        stripeSubscriptionId: wedding.stripe_subscription_id,
        stripeSubscriptionStatus: wedding.stripe_subscription_status,
        weddingObj: wedding,
      } as AuditScheduleItem);

      runningStart += rowAmount;
    });
  });

  return items;
}
