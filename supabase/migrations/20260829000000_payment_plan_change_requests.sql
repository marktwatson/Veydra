-- Payment Plan Change Requests
-- Allows staff to propose a new remaining payment schedule, email/SMS the couple
-- a unique approval link, and only write custom_payment_plan after they approve.

CREATE TABLE IF NOT EXISTS public.payment_plan_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  requested_by UUID,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | declined | expired | cancelled
  current_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  staff_note TEXT,
  customer_token TEXT UNIQUE NOT NULL,
  customer_responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_plan_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access payment_plan_change_requests" ON public.payment_plan_change_requests;
CREATE POLICY "Public full access payment_plan_change_requests"
  ON public.payment_plan_change_requests FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ppcr_wedding_id ON public.payment_plan_change_requests(wedding_id);
CREATE INDEX IF NOT EXISTS idx_ppcr_status ON public.payment_plan_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_ppcr_customer_token ON public.payment_plan_change_requests(customer_token);
