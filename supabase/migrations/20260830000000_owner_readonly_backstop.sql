-- ============================================================================
-- Server-side backstop for the "Owner (Read Only)" role.
--
-- The frontend (src/lib/supabase.ts) already blocks writes for owner_readonly
-- users by intercepting the client. But that check trusts localStorage, which
-- a savvy user can edit to bypass it. This migration adds the REAL protection
-- at the database layer: a BEFORE trigger on every business table that raises
-- an exception if the acting database role belongs to an owner_readonly
-- manager.
--
-- How it works:
--   1. A helper function is_owner_readonly() resolves the authenticated user
--      (auth.uid() or auth.jwt()->>'email') and looks them up in managers.
--      If their role is 'owner_readonly', it returns true.
--   2. A trigger function block_if_readonly() calls is_owner_readonly() and,
--      if true, raises an exception that aborts the INSERT/UPDATE/DELETE.
--   3. The trigger is attached to every business table.
--
-- This is intentionally additive — it does NOT enable RLS on any table, so it
-- cannot break existing public/booking/portal/apply flows that rely on the
-- anon key. It only stops owner_readonly accounts from mutating data.
--
-- Service-role / edge functions bypass this because they don't set auth.uid()
-- (is_owner_readonly() returns false when there's no authenticated user), so
-- cron jobs, the royalty processor, and the webhook keep working.
-- ============================================================================

-- Helper: is the current authenticated user an owner_readonly manager?
CREATE OR REPLACE FUNCTION public.is_owner_readonly()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_role TEXT;
BEGIN
  -- No authenticated user (service role / edge function) → never block.
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    -- Fall back to JWT email claim (some flows pass email without uid).
    v_email := auth.jwt() ->> 'email';
    IF v_email IS NULL THEN
      RETURN false;
    END IF;
  END IF;

  SELECT role INTO v_role
  FROM public.managers
  WHERE (v_uid IS NOT NULL AND id = v_uid)
     OR (v_email IS NOT NULL AND email ILIKE v_email)
  LIMIT 1;

  IF v_role = 'owner_readonly' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Trigger function: abort the mutation if the actor is read-only.
CREATE OR REPLACE FUNCTION public.block_if_readonly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.is_owner_readonly() THEN
    RAISE EXCEPTION 'Your account is read-only. You can view data but cannot make changes. Contact a Super Admin if you need edit access.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- RETURN NEW for INSERT/UPDATE; for DELETE the return value is ignored
  -- but the function still runs and can raise before the row is removed.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach the trigger to every business table.
-- Using DROP IF EXISTS first so re-running the migration is idempotent.
DO $$
DECLARE
  t TEXT;
  business_tables TEXT[] := ARRAY[
    'portal_settings',
    'managers',
    'editors',
    'contractors',
    'weddings',
    'jobs',
    'applications',
    'assignments',
    'notifications',
    'blackout_dates',
    'expenses',
    'activity_logs',
    'sms_logs',
    'api_logs',
    'proposals',
    'messages',
    'coupons',
    'notification_queue',
    'territories',
    'edge_function_sources',
    'royalty_settings',
    'royalty_secrets',
    'royalty_periods',
    'royalty_audit_log',
    'royalty_sales',
    'payment_plan_change_requests',
    'push_settings',
    'push_subscriptions',
    'push_preferences',
    'venue_geocodes',
    'pricing_packages',
    'pricing_addons'
  ];
BEGIN
  FOREACH t IN ARRAY business_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS owner_readonly_block ON public.%I;', t);
      EXECUTE format(
        'CREATE TRIGGER owner_readonly_block BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.block_if_readonly();',
        t
      );
    END IF;
  END LOOP;
END;
$$;
