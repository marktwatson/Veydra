-- Nullable territory_id on core business tables.
-- Links weddings / proposals / jobs / contractors / managers / portal_settings
-- to a row in public.territories so a multi-territory instance can scope records.
-- Added nullable only — NO NOT NULL, NO foreign keys yet. Idempotent so it is
-- safe to re-run on every territory sync. Mirrors the ALTER list embedded in
-- 20260905000001_ghl_invoice_webhook.sql and the deploy-territory fallback so
-- Sync never drops these columns.
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS territory_id UUID;
-- One or more areas a manager can switch between with a single login.
-- territory_id stays their home/default area; territory_ids is the full
-- allowed list (always includes territory_id). Super admins bypass this
-- and see every area.
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS territory_ids UUID[] DEFAULT '{}';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS territory_id UUID;

-- Public apply slug on territories — /apply/:slug routes a contractor
-- application to the correct area. Idempotent so it is safe to re-run.
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS slug text;

-- Per-area PIN that gates the public proposal builder's "Send to client"
-- action. Nullable: if null/empty the public builder requires only the
-- salesperson's name + email before sending.
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sales_pin text;

-- Per-area editor payout Stripe secret. An owner/super admin pastes the
-- Stripe secret for THIS area; editor onboarding + payouts use it instead of
-- the shared Veydra edge secret. Null until set. Never stored in portal_settings.
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS editor_payout_stripe_key text;

-- editors.territory_id so an editor row can be scoped to an area. Nullable:
-- legacy editors have none. One editor email may edit multiple areas via
-- separate editor_payout_accounts rows (below).
ALTER TABLE public.editors ADD COLUMN IF NOT EXISTS territory_id UUID;

-- Per-(editor, territory) connected Stripe account. An editor who edits two
-- areas keeps two rows, each with its own acct_ created under that area's
-- Stripe key. Prevents reusing an acct_ from another territory.
CREATE TABLE IF NOT EXISTS public.editor_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id uuid NOT NULL,
  territory_id uuid NOT NULL,
  stripe_account_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (editor_id, territory_id)
);
ALTER TABLE public.editor_payout_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "epa_auth_all" ON public.editor_payout_accounts;
CREATE POLICY "epa_auth_all" ON public.editor_payout_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_payout_accounts TO authenticated;

NOTIFY pgrst, 'reload schema';
