-- Per-area invoice link domain for CRM/GHL customer-facing invoice URLs.
-- Each subaccount has its own customer invoice host, e.g.
--   https://links.honeysucklehaus.com
-- Stored host-only (no /invoice/id); the edge function appends /invoice/{id}.
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_invoice_base_url TEXT;

-- Ovanta location user id — required by the invoice send endpoint.
-- Saved from Settings → Integrations. If blank, the edge function looks it up.
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS hl_user_id TEXT;
