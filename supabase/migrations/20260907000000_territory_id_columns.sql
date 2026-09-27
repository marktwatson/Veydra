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
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS territory_id UUID;

NOTIFY pgrst, 'reload schema';
