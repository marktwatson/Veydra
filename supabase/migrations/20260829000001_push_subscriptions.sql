-- ============================================================================
-- Push Notifications — VAPID keys + per-user subscriptions + per-category prefs
-- ============================================================================

-- VAPID keypair (generated once, shared across the app). Stored in a single
-- settings row so the send-push edge function and the frontend can read them.
CREATE TABLE IF NOT EXISTS public.push_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapid_public_key TEXT NOT NULL,
  vapid_private_key TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'mailto:admin@veydra.com',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.push_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read push_settings" ON public.push_settings;
-- Public key is safe to expose (it's literally published in the SW). Private
-- key must only be readable by the service role — anon/authenticated get only
-- the public key via a column-restricted policy.
CREATE POLICY "Public read push_settings public_key"
  ON public.push_settings FOR SELECT
  USING (true);

-- Seed the VAPID keypair. Always replaces (DELETE + INSERT) so that
-- re-syncing updates the keys even if a previous (invalid) row exists.
DELETE FROM public.push_settings;
INSERT INTO public.push_settings (vapid_public_key, vapid_private_key, subject)
VALUES (
  'BP2Rhk8b2-A77mHB2XCSJjKEs4SyP_L8t9qTWDeQchhFbe03XQ0FkdCPSCN5xC8f02D2dsmf2i26vh84FgrAWuo',
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgpzGWJW9Jj0DbLYGY0PIKTbn5k2ioJRj5-0wKUBaN-tChRANCAAT9kYZPG9vgO-5hwdlwkiYyhLOEsj_y_Lfak1g3kHIYRW3tN10NBZHQj0gjecQvH9Ng9nbJn9otur4fOBYKwFrq',
  'mailto:admin@veydra.com'
);

-- Per-device push subscriptions. One user can have many devices.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User manage own push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "User manage own push_subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
-- Unique constraint on endpoint is required for the app's
-- upsert(..., { onConflict: "endpoint" }) to work — without it Postgres
-- throws "no unique or exclusion constraint matching the ON CONFLICT
-- specification" and push subscribing fails.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_key'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
  END IF;
END $$;

-- Per-user notification preferences. One row per user. Categories:
--   bookings_payments, royalty_finance, team_operations, daily_digest
-- Owners get bookings_payments, royalty_finance, daily_digest by default.
-- Super admins get all categories by default.
CREATE TABLE IF NOT EXISTS public.push_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  bookings_payments BOOLEAN DEFAULT true,
  royalty_finance BOOLEAN DEFAULT true,
  team_operations BOOLEAN DEFAULT false,
  daily_digest BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User manage own push_preferences" ON public.push_preferences;
CREATE POLICY "User manage own push_preferences"
  ON public.push_preferences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
