import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";

/**
 * Apply payback for a single royalty period via the shared edge-function
 * helper (royalty-processor action=apply_payback).
 *
 * This is the SAME helper the Stripe royalty webhook calls, so manual
 * "Mark Paid" and automatic Stripe settlement use identical idempotent
 * logic to decrement remaining_balance + increment total_payback_applied.
 *
 * Safe to call multiple times — the helper guards on payback_applied_at.
 */
export async function applyRoyaltyPayback(periodId: string): Promise<{
  success: boolean;
  applied: boolean;
  payback_amount: number;
  new_remaining_balance: number | null;
  reason?: string;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const r = await fetch(`${supabaseUrl}/functions/v1/royalty-processor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ action: "apply_payback", period_id: periodId }),
  });
  if (!r.ok) {
    const txt = await r.text();
    console.error("[royalty-payback] apply failed:", r.status, txt);
    return {
      success: false,
      applied: false,
      payback_amount: 0,
      new_remaining_balance: null,
      reason: txt,
    };
  }
  return r.json();
}

/**
 * One-time reconcile: find every paid royalty_periods row with payback_amount > 0
 * that never had its payback applied (payback_applied_at is null) and run the
 * shared helper on each. Fixes historical periods that were marked paid
 * manually but never decremented remaining_balance.
 */
export async function reconcileRoyaltyPayback(): Promise<{
  success: boolean;
  reconciled: number;
  total_applied: number;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const r = await fetch(`${supabaseUrl}/functions/v1/royalty-processor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ action: "reconcile_payback" }),
  });
  if (!r.ok) {
    const txt = await r.text();
    console.error("[royalty-payback] reconcile failed:", r.status, txt);
    return { success: false, reconciled: 0, total_applied: 0 };
  }
  return r.json();
}
