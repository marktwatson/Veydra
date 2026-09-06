-- GHL invoice webhook + schedule support.
-- Per-area CRM invoice link domain, webhook secret, and per-wedding
-- invoice/schedule tracking so partial + full invoice payments book the
-- wedding and increment paid_amount without double counting.

-- portal_settings: webhook shared secret (sent as x-webhook-secret header).
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_webhook_secret TEXT;

-- weddings: per-wedding CRM invoice tracking.
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_id TEXT;        -- latest
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_ids JSONB DEFAULT '[]'::jsonb;  -- array of ids
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_url TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_invoice_status TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_schedule JSONB DEFAULT '[]'::jsonb;  -- [{date, amount, status}]
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS ghl_schedule_id TEXT;  -- CRM schedule id for auto-payment

-- Per-invoice payment ledger for idempotent running totals.
-- One row per CRM invoice id; amount_paid_on_invoice is the last amountPaid
-- we received from the webhook for that invoice (used to compute the delta).
CREATE TABLE IF NOT EXISTS public.ghl_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID REFERENCES public.weddings(id) ON DELETE CASCADE,
  ghl_invoice_id TEXT NOT NULL,
  ghl_event_id TEXT UNIQUE,
  amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid_on_invoice NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ghl_invoice_payments_invoice ON public.ghl_invoice_payments(ghl_invoice_id);
CREATE INDEX IF NOT EXISTS idx_ghl_invoice_payments_wedding ON public.ghl_invoice_payments(wedding_id);
ALTER TABLE public.ghl_invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access ghl_invoice_payments" ON public.ghl_invoice_payments;
CREATE POLICY "Public full access ghl_invoice_payments" ON public.ghl_invoice_payments FOR ALL USING (true) WITH CHECK (true);
