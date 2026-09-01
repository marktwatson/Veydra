import { supabase } from "@/lib/supabase";
import { generatePaymentSchedule } from "@/lib/utils";

/**
 * Permanently cancel (remove) a single scheduled payment installment from a
 * wedding's payment plan. For custom plans the installment is removed from the
 * custom_payment_plan.installments array. For standard plans the wedding is
 * converted to a custom plan containing only the remaining future unpaid
 * installments minus the cancelled one — this prevents the 9 AM auto-charge
 * job from ever billing it again. paid_amount is never touched.
 */
export async function cancelPaymentInstallment({
  weddingId,
  installmentLabel,
  installmentAmount,
  installmentDate,
  scheduleIndex,
}: {
  weddingId: string;
  installmentLabel: string;
  installmentAmount: number;
  installmentDate: string;
  scheduleIndex?: number;
}) {
  const { data: wedding, error: wErr } = await supabase
    .from("weddings")
    .select("*")
    .eq("id", weddingId)
    .single();
  if (wErr || !wedding) throw new Error("Wedding not found");

  const total = Number(wedding.total_amount) || 0;
  const paid = Number(wedding.paid_amount) || 0;
  const plan = wedding.payment_plan || "full";
  let customPlan = wedding.custom_payment_plan;
  if (typeof customPlan === "string") {
    try {
      customPlan = JSON.parse(customPlan);
    } catch {
      customPlan = null;
    }
  }

  // Normalize the target date to YYYY-MM-DD for matching
  let targetDate = installmentDate;
  if (targetDate && targetDate.includes("/")) {
    const parts = targetDate.split("/");
    if (parts.length === 3) {
      targetDate = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
    }
  }

  const fullSchedule = generatePaymentSchedule(
    total,
    plan,
    wedding.date || "",
    wedding.contract_date || wedding.created_at || "",
    paid,
    customPlan,
  );

  // Annotate every schedule row with its paid status and normalized date
  let cumulative = 0;
  const annotated = fullSchedule.map((inst: any) => {
    cumulative += Number(inst.amount) || 0;
    const isPaid = paid >= cumulative - 0.5 || inst.status === "paid";
    let isoDate = inst.date;
    if (isoDate && isoDate.includes("/")) {
      const parts = isoDate.split("/");
      if (parts.length === 3) {
        isoDate = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
      }
    }
    return {
      date: isoDate,
      amount: Number(inst.amount) || 0,
      label: inst.label || "",
      isPaid,
    };
  });

  // Primary match: exact schedule position (most reliable — avoids drift from
  // date/label formatting differences between renders).
  let targetIdx = -1;
  if (
    typeof scheduleIndex === "number" &&
    annotated[scheduleIndex] &&
    Math.abs(annotated[scheduleIndex].amount - installmentAmount) < 0.5
  ) {
    targetIdx = scheduleIndex;
  }

  // Fallback: fuzzy match by date + amount + label (first unpaid match)
  if (targetIdx === -1) {
    targetIdx = annotated.findIndex((inst) => {
      if (inst.isPaid) return false;
      const matchDate = !targetDate || inst.date === targetDate;
      const matchAmount = Math.abs(inst.amount - installmentAmount) < 0.5;
      const matchLabel =
        !installmentLabel ||
        inst.label === installmentLabel ||
        inst.label.includes(installmentLabel) ||
        installmentLabel.includes(inst.label);
      return matchDate && matchAmount && matchLabel;
    });
  }

  if (targetIdx === -1) {
    throw new Error(
      "Could not match this installment to the wedding's current schedule. The plan may have changed — refresh and try again.",
    );
  }

  if (annotated[targetIdx].isPaid) {
    throw new Error(
      "This installment has already been paid and cannot be cancelled.",
    );
  }

  const remaining = annotated
    .filter((_, idx) => idx !== targetIdx)
    .filter((inst) => !inst.isPaid)
    .map((inst) => ({
      date: inst.date,
      amount: inst.amount,
      label: inst.label,
    }));

  // Write as a custom plan with only the remaining installments.
  // deposit: 0 so the retainer is never re-billed (paid history stays in paid_amount).
  const newCustomPlan = {
    enabled: true,
    deposit: 0,
    installments: remaining.map((inst, idx) => ({
      date: inst.date,
      amount: inst.amount,
      label: inst.label || `Installment #${idx + 1}`,
    })),
  };

  const { error: updateErr } = await supabase
    .from("weddings")
    .update({
      payment_plan: "custom",
      custom_payment_plan: newCustomPlan,
    })
    .eq("id", weddingId);
  if (updateErr) throw updateErr;

  // Log admin activity if the helper exists
  try {
    const { api } = await import("@/lib/api");
    await api.logAdminActivity(
      "Cancelled Payment Installment",
      `Permanently removed "${installmentLabel}" (${installmentDate}) of $${installmentAmount} from ${wedding.client_name}'s payment plan.`,
    );
  } catch {
    // logging is best-effort
  }

  return {
    success: true,
    removedInstallment: installmentLabel,
    remainingCount: remaining.length,
  };
}
