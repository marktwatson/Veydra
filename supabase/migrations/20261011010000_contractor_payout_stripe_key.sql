ALTER TABLE public.territories
  ADD COLUMN IF NOT EXISTS contractor_payout_stripe_key text;
