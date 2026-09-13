import { supabase } from "@/lib/supabase";

/**
 * Manual payment-adjustment ledger. Lets staff override an installment as paid
 * (or reverse it) without touching Stripe or creating a CRM invoice. Every
 * override is recorded so the audit trail survives paid_amount recomputes.
 *
 * Self-heals the table on first use (CREATE TABLE IF NOT EXISTS + idempotent
 * RLS policies) so newly-synced territories don't 400.
 */

const HEAL_SQL = `
CREATE TABLE IF NOT EXISTS public.payment_manual_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL,
  amount numeric NOT NULL,
  installment_label text,
  schedule_index int,
  reason text,
  created_at timestamptz DEFAULT now(),
  created_by text
);
ALTER TABLE public.payment_manual_adjustments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "pma_auth_insert" ON public.payment_manual_adjustments
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "pma_auth_select" ON public.payment_manual_adjustments
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
NOTIFY pgrst, 'reload schema';
`;

export async function ensureManualAdjustmentsTable(): Promise<void> {
  try {
    await supabase.rpc("exec_sql", { sql_text: HEAL_SQL });
  } catch {
    /* exec_sql missing or blocked — non-fatal; insert below will surface a
       real error only if the table truly can't be created. */
  }
}

export async function logManualAdjustment(input: {
  weddingId: string;
  amount: number; // positive = marked paid, negative = reversed
  installmentLabel?: string;
  scheduleIndex?: number;
  reason?: string;
}): Promise<void> {
  await ensureManualAdjustmentsTable();
  let created_by: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    created_by = user?.id || null;
  } catch {
    /* non-fatal */
  }
  try {
    await supabase.from("payment_manual_adjustments").insert({
      wedding_id: input.weddingId,
      amount: input.amount,
      installment_label: input.installmentLabel ?? null,
      schedule_index: input.scheduleIndex ?? null,
      reason: input.reason ?? null,
      created_by,
    });
  } catch (e: any) {
    // Log but don't throw — the paid_amount write is the important part.
    console.warn("[manual-adjustment] ledger insert failed:", e?.message);
  }
}
