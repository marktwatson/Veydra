import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";

/**
 * Per-installment charge lock.
 *
 * Prevents two staff members from double-charging the same installment when
 * both have stale data showing it as due. We insert a pending row into
 * `payment_charges` with a unique dedupe_key per wedding+installment. The
 * partial unique index (only over pending/running rows) rejects the second
 * insert, so only one charge proceeds.
 *
 * On success the lock row is marked 'sent' (which releases the unique
 * constraint, allowing a legitimate future re-charge after Mark Unpaid).
 * On failure the pending row is deleted so the charge can be retried.
 */
export async function chargeSavedCardWithLock({
  weddingId,
  amount,
  description,
  scheduleIndex,
  installmentLabel,
}: {
  weddingId: string;
  amount: number;
  description: string;
  scheduleIndex?: number;
  installmentLabel?: string;
}) {
  const dedupeKey = `charge:${weddingId}:${scheduleIndex ?? "x"}:${installmentLabel ?? description}`;

  // Try to claim the lock.
  let lockId: string | null = null;
  try {
    const { data: lockRow, error: lockErr } = await supabase
      .from("payment_charges")
      .insert({
        wedding_id: weddingId,
        schedule_index: scheduleIndex ?? null,
        installment_label: installmentLabel ?? null,
        amount,
        dedupe_key: dedupeKey,
        status: "pending",
        charged_by:
          localStorage.getItem("veydra_user_email") ||
          localStorage.getItem("veydra_manager_email") ||
          null,
      })
      .select("id")
      .single();
    if (lockErr) {
      throw new Error(
        "This payment is already being processed by another team member. Refresh the audit list to see the updated status.",
      );
    }
    lockId = lockRow?.id ?? null;
  } catch (e: any) {
    throw new Error(
      e?.message?.includes("already being processed")
        ? e.message
        : "Could not lock this payment for processing. Please refresh and try again.",
    );
  }

  // Run the actual charge via the existing path.
  try {
    const result = await api.chargeSavedCard({
      weddingId,
      amount,
      description,
    });

    // Mark the lock as sent (releases the unique constraint).
    if (lockId) {
      try {
        await supabase
          .from("payment_charges")
          .update({
            status: "sent",
            stripe_charge_id:
              result?.data?.chargeId || result?.data?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lockId);
      } catch {
        // non-critical — lock cleanup best-effort
      }
    }
    return result;
  } catch (err: any) {
    // Charge failed — release the lock so it can be retried.
    if (lockId) {
      try {
        await supabase.from("payment_charges").delete().eq("id", lockId);
      } catch {
        // non-critical
      }
    }
    throw err;
  }
}
