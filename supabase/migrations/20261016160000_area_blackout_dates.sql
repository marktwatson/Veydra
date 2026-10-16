-- Area blackout dates. Separate from contractor blackout_dates.
-- One list per territory. Salespeople can read it. Only signed-in staff can change it.

CREATE TABLE IF NOT EXISTS public.area_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT area_blackout_dates_range CHECK (end_date >= start_date)
);

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS blackout_verified_at timestamptz;

ALTER TABLE public.area_blackout_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS area_blackout_read ON public.area_blackout_dates;
CREATE POLICY area_blackout_read ON public.area_blackout_dates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS area_blackout_write ON public.area_blackout_dates;
CREATE POLICY area_blackout_write ON public.area_blackout_dates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT ON public.area_blackout_dates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.area_blackout_dates TO authenticated;

NOTIFY pgrst, 'reload schema';
