-- Scheduled jobs queue + scheduler heartbeats for the notification scheduler.
-- The scheduler edge function claims pending jobs (run_at <= now) and sends
-- them using the existing SMS/email/push helpers. Idempotent via dedupe_key.

CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  dedupe_key TEXT,
  related_wedding_id UUID,
  related_assignment_id UUID,
  related_contractor_id UUID,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS run_at TIMESTAMPTZ;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS related_wedding_id UUID;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS related_assignment_id UUID;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS related_contractor_id UUID;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Unique partial index so a dedupe_key can only have one pending/running job
-- at a time. This is what makes the queue idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_jobs_dedupe_active
  ON public.scheduled_jobs (dedupe_key)
  WHERE status IN ('pending', 'running');

-- Index for the worker's claim query (run_at <= now AND status = 'pending').
CREATE INDEX IF NOT EXISTS scheduled_jobs_claim_idx
  ON public.scheduled_jobs (run_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.scheduler_heartbeats (
  id TEXT PRIMARY KEY DEFAULT 'default',
  last_seen_at TIMESTAMPTZ,
  last_source TEXT,
  last_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scheduler_heartbeats ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.scheduler_heartbeats ADD COLUMN IF NOT EXISTS last_source TEXT;
ALTER TABLE public.scheduler_heartbeats ADD COLUMN IF NOT EXISTS last_result JSONB;

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access scheduled_jobs" ON public.scheduled_jobs;
CREATE POLICY "Public full access scheduled_jobs" ON public.scheduled_jobs FOR ALL USING (true);

ALTER TABLE public.scheduler_heartbeats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access scheduler_heartbeats" ON public.scheduler_heartbeats;
CREATE POLICY "Public full access scheduler_heartbeats" ON public.scheduler_heartbeats FOR ALL USING (true);

-- NOTE: Automatic scheduling is done via Supabase Scheduled Functions
-- (Edge Functions → Schedules), NOT pg_cron. See the "Clock & Scheduler"
-- card in Settings for the per-project setup steps.

-- ── Per-installment charge lock (prevents double-charging) ──────────────
-- Two staff members can both see the same overdue installment as due. This
-- table + partial unique index ensures only one of them can charge it.
CREATE TABLE IF NOT EXISTS public.payment_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  schedule_index INTEGER,
  installment_label TEXT,
  amount NUMERIC NOT NULL,
  stripe_charge_id TEXT,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  charged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_charges_active_dedupe_idx
  ON public.payment_charges (dedupe_key)
  WHERE status IN ('pending','running');
ALTER TABLE public.payment_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Staff read charges" ON public.payment_charges FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Staff insert charges" ON public.payment_charges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Staff update charges" ON public.payment_charges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
