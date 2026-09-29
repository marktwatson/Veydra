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

-- Public apply slug on territories — /apply/:slug routes a contractor
-- application to the correct area. Idempotent so it is safe to re-run.
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS slug text;

-- Per-area PIN that gates the public proposal builder's "Send to client"
-- action. Nullable: if null/empty the public builder requires only the
-- salesperson's name + email before sending.
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sales_pin text;

NOTIFY pgrst, 'reload schema';
