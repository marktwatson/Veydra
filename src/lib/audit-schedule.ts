import { generatePaymentSchedule } from "@/lib/utils";
import { type AuditItem } from "@/components/PaymentAuditModals";

export type AuditScheduleItem = AuditItem & {
  parsedDate: Date | null;
  status: string;
  paymentPlan: string;
  hasCustomPlan: boolean;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
};

/**
 * Build the full list of payment-installment audit rows across every wedding.
 * Extracted from PaymentAudit.tsx so the page stays under the file-size limit.
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

    const total = Number(wedding.total_amount) || 0;
    const paid = Number(wedding.paid_amount) || 0;
    const plan = wedding.payment_plan || "full";
    const customPlan = wedding.custom_payment_plan;
    const weddingDate = wedding.date || "";
    const createdAt = wedding.contract_date || wedding.created_at || "";

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

    // Map schedule items into structured records
    schedule.forEach((inst: any, index: number) => {
      let isPaid = inst.status === "paid";

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

      let isOverdue = false;
      if (!isPaid && parsedDate) {
        isOverdue = parsedDate < todayDate;
      }

      let computedStatus: "paid" | "overdue" | "pending" = "pending";
      if (isPaid) computedStatus = "paid";
      else if (isOverdue) computedStatus = "overdue";

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
        installmentAmount: Number(inst.amount) || 0,
        installmentDate: inst.date,
        parsedDate,
        status: computedStatus,
        paymentPlan: plan,
        hasCustomPlan: plan === "custom" || customPlan?.enabled,
        stripeCustomerId: wedding.stripe_customer_id,
        stripeSubscriptionId: wedding.stripe_subscription_id,
        stripeSubscriptionStatus: wedding.stripe_subscription_status,
        weddingObj: wedding,
      } as AuditScheduleItem);
    });
  });

  return items;
}
