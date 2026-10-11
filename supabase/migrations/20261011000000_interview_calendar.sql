ALTER TABLE public.portal_settings
  ADD COLUMN IF NOT EXISTS interview_calendar_id text;
