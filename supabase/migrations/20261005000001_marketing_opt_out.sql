-- Bride model-release opt-out. Null/false keeps the existing grant.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS marketing_opt_out boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
