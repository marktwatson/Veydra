-- Coverage (short-notice) columns — ships with territory Sync.
-- No auto-assign trigger — coverage jobs use the normal application flow;
-- the manager assigns from the applicants list (same as any open job).
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS coverage_request boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS proposal_id uuid;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS contractor_id uuid;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_requested_at timestamptz;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_confirmed_at timestamptz;

-- Proposal send-to-client tracking. sent_at starts the 48-hour clock on
-- "Send to client" (never on generate/copy/preview). expires_at is sent_at +48h.
-- sent_count increments on each resend. Ships with territory Sync.
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS sent_count int DEFAULT 0;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS proposal_expiry_days integer DEFAULT 2;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS last_sales_report_date text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS hl_api_key text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS hl_location_id text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS hl_proposal_link_field_id text;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS contract_status text;
DROP TRIGGER IF EXISTS trg_coverage_auto_assign ON public.applications;
DROP FUNCTION IF EXISTS public.fn_coverage_auto_assign();

-- Coverage confirm backstop: when a contractor_id is written onto a
-- photo/video job (manual assign from Positions), backfill proposal_id from
-- the wedding's latest non-superseded proposal if missing, then stamp
-- coverage_confirmed_at on that proposal once all required roles are
-- assigned. This is the authoritative assign->confirm path; the Realtime
-- watcher in the app is a backup only. Does NOT auto-send or start the
-- expiry clock. Does NOT auto-assign from applications.
CREATE OR REPLACE FUNCTION public.fn_coverage_confirm()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pid uuid;
  need_photo boolean;
  need_video boolean;
  got_photo boolean;
  got_video boolean;
  ctype text;
  wid uuid;
BEGIN
  wid := NEW.wedding_id;
  pid := NEW.proposal_id;
  IF pid IS NULL THEN
    SELECT p.id INTO pid FROM public.proposals p
    WHERE p.wedding_id::text = wid::text
      AND coalesce(p.status,'') <> 'superseded'
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT 1;
    IF pid IS NOT NULL THEN
      UPDATE public.jobs SET proposal_id = pid WHERE id::text = NEW.id::text AND proposal_id IS NULL;
    END IF;
  END IF;
  IF pid IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(coverage_type, 'both') INTO ctype FROM public.proposals WHERE id::text = pid::text;
  need_photo := ctype IN ('photo', 'both');
  need_video := ctype IN ('video', 'both');
  -- A role is covered if the job has contractor_id OR an active assignment.
  SELECT
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.wedding_id::text = wid::text
        AND j.role ILIKE '%photo%'
        AND (
          j.contractor_id IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.job_id::text = j.id::text
              AND lower(coalesce(a.status,'')) IN ('upcoming','accepted','confirmed','assigned')
          )
        )
    ),
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.wedding_id::text = wid::text
        AND j.role ILIKE '%video%'
        AND (
          j.contractor_id IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.job_id::text = j.id::text
              AND lower(coalesce(a.status,'')) IN ('upcoming','accepted','confirmed','assigned')
          )
        )
    )
  INTO got_photo, got_video;
  IF (NOT need_photo OR got_photo) AND (NOT need_video OR got_video) THEN
    UPDATE public.proposals
    SET coverage_confirmed_at = coalesce(coverage_confirmed_at, now())
    WHERE id::text = pid::text AND coverage_confirmed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Wrapper for the assignments trigger: bounce through the jobs trigger via a
-- no-op self-update so fn_coverage_confirm() fires as a TRIGGER function
-- (zero args). Never call fn_coverage_confirm with an argument.
CREATE OR REPLACE FUNCTION public.fn_coverage_confirm_job_assign()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.jobs
  SET proposal_id = proposal_id
  WHERE id::text = NEW.job_id::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coverage_confirm ON public.jobs;
CREATE TRIGGER trg_coverage_confirm
AFTER INSERT OR UPDATE OF contractor_id, proposal_id ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.fn_coverage_confirm();

-- Fire when an assignment's contractor_id changes (the normal Veydra assign
-- path) so coverage confirms even though jobs.contractor_id is never set.
-- NOTE: status is intentionally NOT in the column list — payout approvals
-- update assignments.status and must NOT fire coverage SQL.
DROP TRIGGER IF EXISTS trg_coverage_confirm_assign ON public.assignments;
CREATE TRIGGER trg_coverage_confirm_assign
AFTER INSERT OR UPDATE OF contractor_id ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_coverage_confirm_job_assign();



-- GHL invoice webhook + schedule support.
-- Per-area CRM invoice link domain, webhook secret, and per-wedding
-- invoice/schedule tracking so partial + full invoice payments book the
-- wedding and increment paid_amount without double counting.
--
-- This file is exported as `ghl_invoice_schema` and run by deploy-territory
-- AFTER master_sql on every territory sync, so freshly-synced areas get every
-- column Sign & Pay / the webhook / the audit need — even if the deployed
-- master_sql on that area is stale. All statements are idempotent.

-- ════════════════════════════════════════════════════════════════════════
-- portal_settings
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_invoice_base_url TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS hl_user_id TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_webhook_secret TEXT;

-- ════════════════════════════════════════════════════════════════════════
-- proposals — link a proposal to its wedding + contract tracking.
-- wedding_id is what Sign & Pay passes to ghl-invoice; without it the
-- proposal flow calls ghl-invoice with the proposal id → "Wedding not found".
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS wedding_id UUID;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS original_wedding_id TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS contract_status TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS contract_snapshot TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS custom_contract_snapshot TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS contract_signed_at TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS contract_signed_by TEXT;

-- ════════════════════════════════════════════════════════════════════════
-- weddings — per-wedding CRM invoice + schedule tracking.
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_id TEXT;        -- latest
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_ids JSONB DEFAULT '[]'::jsonb;  -- array of ids
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_url TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_status TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_amount NUMERIC;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_created_date TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_schedule JSONB DEFAULT '[]'::jsonb;  -- [{date, amount, status}]
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_schedule_id TEXT;  -- CRM schedule id for auto-payment

-- weddings — contact + questionnaire + totals (read by ghl-invoice).
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS questionnaire_data JSONB;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS payment_plan JSONB;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS custom_payment_plan JSONB;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS contract_snapshot TEXT;

-- Off-platform (Venmo / Cash App / Zelle) full-balance claim flags.
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS offplatform_status TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS offplatform_method TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS offplatform_amount NUMERIC;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS offplatform_claimed_at TIMESTAMPTZ;

-- Mirror off-platform flags onto proposals so the Proposals list shows badges.
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS offplatform_status TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS offplatform_method TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS offplatform_amount NUMERIC;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS offplatform_claimed_at TIMESTAMPTZ;

-- Allow staff (managers/owners) auth user IDs in notifications.contractor_id
-- so in-app notifications show up for managers, not just contractors.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_contractor_id_fkey;

-- portal_settings — off-platform method toggles + handles.
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS accept_venmo BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS venmo_handle TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS accept_cashapp BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS cashapp_cashtag TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS accept_zelle BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS zelle_target TEXT;

-- ════════════════════════════════════════════════════════════════════════
-- ghl_invoice_payments — per-invoice payment ledger for idempotent running
-- totals. One row per CRM invoice id; amount_paid_on_invoice is the last
-- amountPaid we received from the webhook for that invoice (delta source).
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ghl_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID REFERENCES public.weddings(id) ON DELETE CASCADE,
  ghl_invoice_id TEXT NOT NULL,
  ghl_event_id TEXT UNIQUE,
  amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid_on_invoice NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ghl_invoice_payments_invoice ON public.ghl_invoice_payments(ghl_invoice_id);
CREATE INDEX IF NOT EXISTS idx_ghl_invoice_payments_wedding ON public.ghl_invoice_payments(wedding_id);
ALTER TABLE public.ghl_invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access ghl_invoice_payments" ON public.ghl_invoice_payments;
CREATE POLICY "Public full access ghl_invoice_payments" ON public.ghl_invoice_payments FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════
-- payment_manual_adjustments — ledger for manual Mark Paid / Mark Unpaid and
-- Paid in full (off-platform Venmo / Cash App / Zelle / Cash) overrides in
-- Payment Audit. One row per confirm; positive = marked paid, negative =
-- reversed. Synced to every territory so new areas get it automatically.
-- ════════════════════════════════════════════════════════════════════════
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
DROP POLICY IF EXISTS "pma_auth_insert" ON public.payment_manual_adjustments;
DROP POLICY IF EXISTS "pma_auth_select" ON public.payment_manual_adjustments;
CREATE POLICY "pma_auth_insert" ON public.payment_manual_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pma_auth_select" ON public.payment_manual_adjustments FOR SELECT TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════════════════
-- Royalty payback trigger — single source of truth.
-- Fires on any UPDATE that flips status to 'paid' (Mark Paid, webhook,
-- processor). Idempotent via payback_applied_at guard. Ensures
-- remaining_balance + total_payback_applied move on EVERY paid path.
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS payback_applied_at TIMESTAMPTZ;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS total_payback_applied NUMERIC DEFAULT 0;

CREATE OR REPLACE FUNCTION public.apply_royalty_payback_trigger()
  RETURNS TRIGGER AS $$
  DECLARE terr_id UUID; payback NUMERIC; cur_remaining NUMERIC; cur_total NUMERIC;
  BEGIN
    IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.payback_applied_at IS NULL THEN
      payback := COALESCE(NEW.payback_amount, 0);
      IF payback > 0 THEN
        terr_id := NEW.territory_id;
        SELECT COALESCE(remaining_balance,0), COALESCE(total_payback_applied,0)
          INTO cur_remaining, cur_total
          FROM public.territories WHERE id = terr_id;
        UPDATE public.territories
          SET remaining_balance = GREATEST(0, cur_remaining - payback),
              total_payback_applied = cur_total + payback,
              last_calculated_at = now()
          WHERE id = terr_id;
      END IF;
      NEW.payback_applied_at := now();
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_royalty_payback ON public.royalty_periods;
CREATE TRIGGER trg_royalty_payback
  BEFORE UPDATE ON public.royalty_periods
  FOR EACH ROW EXECUTE FUNCTION public.apply_royalty_payback_trigger();

-- ════════════════════════════════════════════════════════════════════════
-- sales_activity_runs — stores each Sales Activity report run for trend
-- tracking. One row per run (manual or auto). Ships with territory Sync.
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sales_activity_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz DEFAULT now(),
  range int DEFAULT 1,
  pool_size int DEFAULT 0,
  needs_reply_count int DEFAULT 0,
  going_cold_count int DEFAULT 0,
  opted_out_count int DEFAULT 0,
  avg_response_hours numeric,
  sla_breaches int DEFAULT 0,
  funnel jsonb,
  channel_mix jsonb,
  priorities jsonb,
  report_text text,
  triggered_by text DEFAULT 'manual'
);
ALTER TABLE public.sales_activity_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sar_auth_all" ON public.sales_activity_runs;
CREATE POLICY "sar_auth_all" ON public.sales_activity_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_sales_activity_runs_ran_at ON public.sales_activity_runs(ran_at);

-- Reload PostgREST schema cache so the API sees the new columns immediately.
NOTIFY pgrst, 'reload schema';
