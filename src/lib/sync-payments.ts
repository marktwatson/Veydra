import { supabaseUrl, supabaseAnonKey } from "./supabase";

export interface SyncLogEntry {
  wedding_id: string;
  client_name: string;
  client_email: string;
  status: string;
  old_paid_amount: number;
  old_refunded_amount: number;
  new_paid_amount: number | null;
  new_refunded_amount: number | null;
  updated: boolean;
  skipped_reason: string | null;
  error: string | null;
  charge_count?: number;
}

export interface SyncSummary {
  total_weddings: number;
  weddings_updated: number;
  weddings_skipped: number;
  weddings_errored: number;
  stripe_key_missing: boolean;
  total_gross_collected: number;
  total_refunded: number;
  total_net_collected: number;
}

export interface SyncResult {
  message: string;
  syncOnly: boolean;
  summary: SyncSummary;
  log: SyncLogEntry[];
}

/**
 * Force a Stripe paid-amount recompute WITHOUT firing any notifications.
 * Used by the "Sync from Stripe" button on the Payment Audit page so staff
 * can correct paid_amount after refunds without waiting for the daily cron.
 *
 * Calls the daily-reminders edge function with syncOnly: true, which skips
 * the scheduler/notification delegation and only recomputes paid_amount +
 * refunded_amount from Stripe charges (net = gross succeeded minus refunds,
 * minus manual "mark unpaid" adjustments). No charging, ever.
 *
 * Returns a per-wedding diagnostic log so the UI can show EXACTLY what the
 * sync did (or didn't do) for each wedding — including which weddings were
 * skipped and why, and whether the Stripe key was missing.
 */
export async function syncPaymentsFromStripe(): Promise<SyncResult> {
  const res = await fetch(`${supabaseUrl}/functions/v1/daily-reminders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ syncOnly: true }),
  });
  if (!res.ok) throw new Error(`Sync returned ${res.status}`);
  return res.json();
}
