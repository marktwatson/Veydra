import { supabase } from "./supabase";

/**
 * Salesperson send-fee payouts.
 *
 * A salesperson earns a fixed fee (portal_settings.salesperson_send_fee,
 * default $25) the FIRST time a proposal they built is sent to a client. The
 * fee attaches to the proposal row via salesperson_paid_at; resending never
 * clears it. Staff (owner/manager/super_admin) batch-pay owed fees from the
 * Sales Reps page or the Payouts page. This is NOT contractor assignments —
 * no jobs/assignments are inserted and no email/SMS is sent to the
 * salesperson.
 */

export const DEFAULT_SALESPERSON_SEND_FEE = 25;

/**
 * Idempotent schema heal. Runs as a single DO block so exec_sql (which
 * executes only the first statement) applies every DDL statement. Safe to
 * call on every Sales Reps / Payouts page load. Mirrors the migration +
 * deploy-territory fallback.
 */
export const SALESPERSON_PAYOUT_HEAL_SQL = `DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS salesperson_paid_at timestamptz';
  EXECUTE 'ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS salesperson_payout_batch_id uuid';
  EXECUTE 'ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS salesperson_send_fee numeric DEFAULT 25';
  EXECUTE 'CREATE TABLE IF NOT EXISTS public.salesperson_payout_batches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salesperson_email text NOT NULL, salesperson_name text, amount numeric NOT NULL, proposal_count int NOT NULL, proposal_ids uuid[] NOT NULL, status text NOT NULL DEFAULT ''paid'', paid_at timestamptz DEFAULT now(), paid_by text, created_at timestamptz DEFAULT now())';
  EXECUTE 'ALTER TABLE public.salesperson_payout_batches ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS spb_auth_insert ON public.salesperson_payout_batches';
  EXECUTE 'DROP POLICY IF EXISTS spb_auth_select ON public.salesperson_payout_batches';
  EXECUTE 'CREATE POLICY spb_auth_insert ON public.salesperson_payout_batches FOR INSERT TO authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY spb_auth_select ON public.salesperson_payout_batches FOR SELECT TO authenticated USING (true)';
END $$;
NOTIFY pgrst, 'reload schema';`;

/** Run the schema heal. Never throws. */
export async function healSalespersonPayoutSchema(): Promise<void> {
  try {
    await supabase.rpc("exec_sql", { sql_text: SALESPERSON_PAYOUT_HEAL_SQL });
  } catch {
    /* ignore — columns may already exist or exec_sql unavailable */
  }
}

/**
 * Batch-load salesperson_send_fee per territory_id. Returns a map keyed by
 * territory_id. Rows without a fee fall back to DEFAULT_SALESPERSON_SEND_FEE
 * at read time (see feeFor).
 */
export async function getSalespersonSendFees(
  territoryIds: (string | null | undefined)[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = Array.from(
    new Set((territoryIds.filter(Boolean) as string[]) || []),
  );
  if (!ids.length) return map;
  try {
    const { data } = await supabase
      .from("portal_settings")
      .select("territory_id, salesperson_send_fee")
      .in("territory_id", ids);
    for (const row of data || []) {
      if (row.territory_id) {
        map.set(
          row.territory_id,
          Number(row.salesperson_send_fee ?? DEFAULT_SALESPERSON_SEND_FEE),
        );
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

/** Resolve the fee for a territory, defaulting to 25 when unknown. */
export function feeFor(
  feeByTerritory: Map<string, number>,
  territoryId: string | null | undefined,
): number {
  if (territoryId && feeByTerritory.has(territoryId)) {
    return feeByTerritory.get(territoryId)!;
  }
  return DEFAULT_SALESPERSON_SEND_FEE;
}

export interface SalespersonPayoutBatch {
  id: string;
  salesperson_email: string;
  salesperson_name: string | null;
  amount: number;
  proposal_count: number;
  proposal_ids: string[];
  status: string;
  paid_at: string;
  paid_by: string | null;
  created_at: string;
}

/** Load payout-batch history, newest first. */
export async function getSalespersonPayoutBatches(): Promise<
  SalespersonPayoutBatch[]
> {
  try {
    const { data, error } = await supabase
      .from("salesperson_payout_batches")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data || []) as SalespersonPayoutBatch[];
  } catch {
    return [];
  }
}

/**
 * Mark a batch of a salesperson's sent proposals as paid.
 *
 * 1. Insert a salesperson_payout_batches row (status 'paid').
 * 2. Idempotently UPDATE only the still-unpaid, matching-email proposals:
 *      SET salesperson_paid_at = now(), salesperson_payout_batch_id = batch.id
 *      WHERE id IN (...) AND salesperson_paid_at IS NULL
 *        AND salesperson_email = email
 * 3. Compute the real amount from the rows that actually flipped (fee per
 *    territory) and patch the batch row. If nothing flipped (already paid),
 *    delete the empty batch so history stays clean.
 *
 * Returns null when nothing was paid (idempotent no-op).
 */
export async function markSalespersonPaid(opts: {
  email: string;
  name: string;
  proposalIds: string[];
  paidBy: string;
  feeByTerritory: Map<string, number>;
}): Promise<{ batchId: string; amount: number; count: number } | null> {
  const { email, name, proposalIds, paidBy, feeByTerritory } = opts;
  if (!proposalIds.length) return null;

  const { data: batch, error: insErr } = await supabase
    .from("salesperson_payout_batches")
    .insert({
      salesperson_email: email,
      salesperson_name: name,
      amount: 0,
      proposal_count: proposalIds.length,
      proposal_ids: proposalIds,
      status: "paid",
      paid_by: paidBy,
    })
    .select()
    .single();
  if (insErr || !batch) return null;

  const { data: updated, error: updErr } = await supabase
    .from("proposals")
    .update({
      salesperson_paid_at: new Date().toISOString(),
      salesperson_payout_batch_id: batch.id,
    })
    .in("id", proposalIds)
    .is("salesperson_paid_at", null)
    .eq("salesperson_email", email)
    .select("id");

  if (updErr) {
    await supabase
      .from("salesperson_payout_batches")
      .delete()
      .eq("id", batch.id);
    return null;
  }

  const paidIds = ((updated as any[]) || []).map((r) => r.id);
  if (!paidIds.length) {
    await supabase
      .from("salesperson_payout_batches")
      .delete()
      .eq("id", batch.id);
    return null;
  }

  // Compute amount from the rows that actually flipped (fee per territory).
  const { data: paidRows } = await supabase
    .from("proposals")
    .select("id, territory_id")
    .in("id", paidIds);
  let amount = 0;
  for (const r of paidRows || []) {
    amount += feeFor(feeByTerritory, r.territory_id);
  }

  await supabase
    .from("salesperson_payout_batches")
    .update({ amount, proposal_count: paidIds.length })
    .eq("id", batch.id);

  return { batchId: batch.id, amount, count: paidIds.length };
}
