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
 *
 * Stale-lock handling: a pending row older than 2 minutes is treated as dead
 * (teammate's tab closed, network error, Stripe failure that didn't clean up).
 * We mark it 'failed' and claim a fresh lock so staff can retry without SQL.
 * Two clicks within 2 minutes are still blocked (real concurrency guard).
 */

const STALE_MS = 2 * 60 * 1000; // 2 minutes

export interface ChargeLockError {
  kind: "locked" | "stale" | "error";
  message: string;
  chargedBy?: string | null;
  ageSeconds?: number;
}

function isUniqueViolation(err: any): boolean {
  return (
    err?.code === "23505" ||
    err?.code === "PGRST116" ||
    /unique|duplicate|violates/i.test(err?.message || "")
  );
}

// Table not synced to this instance's DB yet (schema migration ran in code
// but hasn't been pushed/synced to this Supabase project). Detect it so we
// can degrade gracefully instead of blocking every charge.
function isMissingTable(err: any): boolean {
  return (
    err?.code === "PGRST205" ||
    /could not find the table/i.test(err?.message || "")
  );
}

export function buildDedupeKey(
  weddingId: string,
  scheduleIndex?: number,
  installmentLabel?: string,
  description?: string,
): string {
  return `charge:${weddingId}:${scheduleIndex ?? "x"}:${installmentLabel ?? description}`;
}

/**
 * Release a stuck pending/running lock so a charge can be retried.
 * Only clears rows older than the stale threshold OR explicitly forced.
 * Returns true if a row was cleared.
 */
export async function releaseStaleLock(
  weddingId: string,
  scheduleIndex?: number,
  installmentLabel?: string,
  description?: string,
  force = false,
): Promise<{ cleared: boolean; reason?: string }> {
  const dedupeKey = buildDedupeKey(
    weddingId,
    scheduleIndex,
    installmentLabel,
    description,
  );
  const { data: existing } = await supabase
    .from("payment_charges")
    .select("id, status, created_at, charged_by")
    .eq("dedupe_key", dedupeKey)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) return { cleared: false, reason: "No pending lock found" };

  const ageMs = Date.now() - new Date(existing.created_at).getTime();
  if (!force && ageMs < STALE_MS) {
    return {
      cleared: false,
      reason: `Lock is only ${Math.round(ageMs / 1000)}s old — wait until 2 min or force release.`,
    };
  }

  const { error } = await supabase
    .from("payment_charges")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { cleared: false, reason: error.message };
  return { cleared: true };
}

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
  const dedupeKey = buildDedupeKey(
    weddingId,
    scheduleIndex,
    installmentLabel,
    description,
  );

  // 1. Look up an existing pending/running lock for this installment.
  const { data: existing, error: lookupErr } = await supabase
    .from("payment_charges")
    .select("id, status, created_at, charged_by")
    .eq("dedupe_key", dedupeKey)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // The payment_charges table hasn't been synced to this Supabase project
  // yet. Don't block the charge on a missing safety table — charge directly
  // and warn so staff know to sync the schema for duplicate-charge protection.
  if (lookupErr && isMissingTable(lookupErr)) {
    console.warn(
      "payment_charges table not found — charging without duplicate-lock protection. Sync your database schema (Territories → Sync) to enable it.",
    );
    return await api.chargeSavedCard({ weddingId, amount, description });
  }

  if (existing) {
    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    if (ageMs >= STALE_MS) {
      // Stale — clear it and continue to claim a fresh lock below.
      await supabase
        .from("payment_charges")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      // Active lock held by someone else (or a recent failed attempt that
      // hasn't aged out). Block — do NOT charge.
      const secs = Math.round(ageMs / 1000);
      const who = existing.charged_by ? ` by ${existing.charged_by}` : "";
      throw new Error(
        `This payment is already being processed${who} (started ${secs}s ago). Wait 2 minutes or click "Release lock and retry".`,
      );
    }
  }

  // 2. Claim the lock.
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
    if (lockErr) throw lockErr;
    lockId = lockRow?.id ?? null;
  } catch (e: any) {
    if (isUniqueViolation(e)) {
      // Another insert won the race in the same instant.
      throw new Error(
        "This payment is already being processed by another team member. Refresh the audit list to see the updated status.",
      );
    }
    if (isMissingTable(e)) {
      // Table not synced to this instance yet — charge directly rather than
      // blocking the payment on a missing safety table.
      console.warn(
        "payment_charges table not found — charging without duplicate-lock protection. Sync your database schema (Territories → Sync) to enable it.",
      );
      return await api.chargeSavedCard({ weddingId, amount, description });
    }
    // Any other error (RLS, etc.) — show the real message.
    throw new Error(
      `Could not lock this payment for processing: ${e?.message || e}. Check that the payment_charges table exists and RLS allows inserts.`,
    );
  }

  // 3. Run the actual charge via the existing path.
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
        await supabase
          .from("payment_charges")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", lockId);
      } catch {
        // non-critical
      }
    }
    throw err;
  }
}
