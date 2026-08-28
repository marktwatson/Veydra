-- ============================================================
-- Add guest@honeysucklehaus.com as an Owner (Read Only) team member
-- ============================================================
-- The auth user already exists in Supabase Auth (created manually).
-- This links them to the managers table with the owner_readonly role
-- so the app recognizes them and enforces read-only access.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Find the auth user's UUID (so we link the manager row to their auth account)
--    and insert/update the managers row in one idempotent step.
INSERT INTO public.managers (id, email, name, role, status)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Guest Owner'),
  'owner_readonly',
  'active'
FROM auth.users au
WHERE au.email ILIKE 'guest@honeysucklehaus.com'
ON CONFLICT (id) DO UPDATE
SET
  role    = EXCLUDED.role,
  status  = EXCLUDED.status,
  email   = EXCLUDED.email;

-- 2. Verify it was added
SELECT id, email, name, role, status, created_at
FROM public.managers
WHERE email ILIKE 'guest@honeysucklehaus.com';

-- ============================================================
-- After running this:
--   • Log in at /login with guest@honeysucklehaus.com / Money3456@
--     (select "Manager" as the login type)
--   • The user will see the full Owner nav (Dashboard, Weddings,
--     Proposals, Financial Center, Team, Settings, Royalty Dashboard, etc.)
--     but every save / create / edit / delete is blocked at the data layer.
--   • Any write attempt shows: "Your account is read-only..."
-- ============================================================
