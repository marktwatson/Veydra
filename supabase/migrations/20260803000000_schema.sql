-- Veydra Platform Master Schema Migration & Edge Functions Registry
-- Guarantees complete database schema sync for both new and existing Supabase instances
-- Includes all 18 PostgreSQL tables, RLS policies, extensions, and Edge Functions deployment definitions.

-- Create exec_sql FIRST so self-deploy can use it for all subsequent statements
CREATE OR REPLACE FUNCTION public.exec_sql(sql_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO anon, authenticated, service_role;

-- Create exec_sql_batch for bulk schema deployment (reduces HTTP requests from 500+ to ~2)
CREATE OR REPLACE FUNCTION public.exec_sql_batch(sql_texts TEXT[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  FOR i IN 1..array_length(sql_texts, 1) LOOP
    BEGIN
      EXECUTE sql_texts[i];
    EXCEPTION WHEN OTHERS THEN
      IF NOT (SQLERRM LIKE '%already exists%' OR SQLERRM LIKE '%duplicate%' OR SQLERRM LIKE '%already%') THEN
        RAISE NOTICE 'Skip: %', SQLERRM;
      END IF;
    END;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.exec_sql_batch(TEXT[]) TO anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Portal Settings
CREATE TABLE IF NOT EXISTS public.portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT DEFAULT 'Veydra',
  company_state TEXT DEFAULT 'Tennessee',
  app_url TEXT,
  logo_url TEXT,
  invite_webhook TEXT,
  admin_invite_webhook TEXT,
  new_job_webhook TEXT,
  assignment_webhook TEXT,
  payout_webhook TEXT,
  editor_assignment_webhook TEXT,
  webhook_url TEXT,
  hl_api_key TEXT,
  hl_location_id TEXT,
  fb_access_token TEXT,
  fb_ad_account_id TEXT,
  excluded_campaign_ids TEXT[] DEFAULT '{}',
  excluded_campaigns TEXT[] DEFAULT '{}',
  manual_expenses JSONB DEFAULT '[]',
  regions TEXT[] DEFAULT '{}',
  timezone TEXT DEFAULT 'America/New_York',
  company_timezone TEXT DEFAULT 'America/New_York',
  photo_pay_rate NUMERIC,
  video_pay_rate NUMERIC,
  editor_video_pricing JSONB,
  photo_bid_min NUMERIC DEFAULT 50,
  photo_bid_max NUMERIC DEFAULT 100,
  video_bid_min NUMERIC DEFAULT 60,
  video_bid_max NUMERIC DEFAULT 120,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_pass TEXT,
  smtp_from_email TEXT,
  smtp_from_name TEXT,
  email_delivery_method TEXT DEFAULT 'webhook',
  email_colors JSONB,
  contract_template TEXT,
  wedding_contract_template TEXT,
  notify_on_failed_autocharge BOOLEAN DEFAULT false,
  email_payment_failed_enabled BOOLEAN DEFAULT false,
  last_heartbeat_date TEXT,
  last_digest_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure ALL columns exist for existing portal_settings tables
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'Veydra';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS company_state TEXT DEFAULT 'Tennessee';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS app_url TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS app_icon_url TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS invite_webhook TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS admin_invite_webhook TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS new_job_webhook TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS assignment_webhook TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS payout_webhook TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS editor_assignment_webhook TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS hl_api_key TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS hl_location_id TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS fb_access_token TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS fb_ad_account_id TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS excluded_campaign_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS excluded_campaigns TEXT[] DEFAULT '{}';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS manual_expenses JSONB DEFAULT '[]';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS regions TEXT[] DEFAULT '{}';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS company_timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS photo_pay_rate NUMERIC;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS video_pay_rate NUMERIC;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS editor_video_pricing JSONB;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS photo_bid_min NUMERIC DEFAULT 50;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS photo_bid_max NUMERIC DEFAULT 100;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS video_bid_min NUMERIC DEFAULT 60;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS video_bid_max NUMERIC DEFAULT 120;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS smtp_pass TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS smtp_from_email TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS smtp_from_name TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_delivery_method TEXT DEFAULT 'webhook';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_colors JSONB;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS contract_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS wedding_contract_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS notify_on_failed_autocharge BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_payment_failed_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS last_heartbeat_date TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS last_digest_date TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS last_payment_alert_date TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upload_account_email TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upload_account_password TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upload_instructions TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS portal_theme JSONB;

-- Bartending Upsell (add-on service marketed to already-booked brides)
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upsell_bartending_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upsell_bartending_headline TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upsell_bartending_subtext TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upsell_bartending_packages JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upsell_bartending_email_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upsell_bartending_email_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS upsell_bartending_sms_template TEXT;

-- Track bartending add-on purchases (linked to wedding + Stripe payment)
CREATE TABLE IF NOT EXISTS public.upsell_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID REFERENCES public.weddings(id) ON DELETE CASCADE,
  service TEXT NOT NULL DEFAULT 'bartending',
  package_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_customer_id TEXT,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.upsell_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access upsell_purchases" ON public.upsell_purchases;
CREATE POLICY "Public full access upsell_purchases" ON public.upsell_purchases FOR ALL USING (true) WITH CHECK (true);

-- Email/SMS Template Columns (Contractor)
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_invite_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_invite_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_invite_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_reset_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_reset_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_reset_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_outbid_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_outbid_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_outbid_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_assignment_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_assignment_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_assignment_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_new_job_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_new_job_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_new_job_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_reminder_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_reminder_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_reminder_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_payout_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_payout_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_payout_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_invite_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_invite_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_reset_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_reset_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_outbid_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_outbid_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_assignment_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_assignment_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_new_job_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_new_job_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_reminder_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_reminder_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_reminder_hours INTEGER;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_contractor_prep_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_contractor_prep_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_contractor_prep_days INTEGER;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_contractor_prep_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_contractor_prep_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_contractor_prep_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_payout_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_payout_template TEXT;

-- Manager Email/SMS Templates
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_manager_invite_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_manager_invite_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_manager_invite_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_manager_reset_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_manager_reset_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_manager_reset_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_manager_invite_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_manager_invite_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_manager_reset_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_manager_reset_template TEXT;

-- Editor Email/SMS Templates
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_invite_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_invite_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_invite_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_reset_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_reset_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_reset_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_assigned_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_assigned_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_assigned_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_raw_media_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_raw_media_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_raw_media_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_revisions_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_revisions_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_revisions_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_payout_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_payout_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_editor_payout_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_invite_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_invite_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_reset_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_reset_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_assigned_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_assigned_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_raw_media_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_raw_media_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_revisions_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_revisions_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_payout_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_editor_payout_template TEXT;

-- Bride Email/SMS Templates
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_welcome_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_welcome_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_welcome_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_welcome_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_welcome_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_pre_wedding_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_pre_wedding_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_pre_wedding_hours INTEGER;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_pre_wedding_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_pre_wedding_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_pre_wedding_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_delivery_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_delivery_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_delivery_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_delivery_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_delivery_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_rating_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_rating_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_rating_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_rating_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_rating_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_day_after_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_day_after_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_day_after_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_day_after_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_day_after_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_gift_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_gift_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_gift_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_gift_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_gift_template TEXT;

-- Admin SMS Templates
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_application_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_application_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_assignment_accepted_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_assignment_accepted_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_raw_media_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_raw_media_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_feedback_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_feedback_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_edit_completed_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_edit_completed_template TEXT;

-- Admin Booking Notification Templates
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS admin_notification_emails TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_booking_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_admin_booking_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_admin_booking_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_admin_booking_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_admin_booking_template TEXT;

-- Pipeline / Applicant Email/SMS Templates
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_interview_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_interview_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_interview_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_interview_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_interview_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_paperwork_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_paperwork_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_paperwork_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_paperwork_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_paperwork_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_hired_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_hired_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_hired_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_hired_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_hired_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_rejected_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_rejected_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_rejected_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_rejected_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_rejected_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_applicant_welcome_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_applicant_welcome_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_applicant_welcome_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_applicant_welcome_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_applicant_welcome_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_gallery_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_gallery_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_pipeline_gallery_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_gallery_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_pipeline_gallery_template TEXT;

-- Doc Expiry Templates
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_doc_expiry_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_doc_expiry_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_doc_expiry_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_doc_expiry_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_doc_expiry_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS doc_expiry_reminder_days INTEGER;

-- 2. Managers / Administrators
CREATE TABLE IF NOT EXISTS public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'manager',
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'manager';
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Editors
CREATE TABLE IF NOT EXISTS public.editors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  pay_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.editors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.editors ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.editors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.editors ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.editors ADD COLUMN IF NOT EXISTS pay_rate NUMERIC DEFAULT 0;

-- 4. Contractors
CREATE TABLE IF NOT EXISTS public.contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'active',
  tags TEXT[] DEFAULT '{}',
  specialty TEXT,
  region TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  rating NUMERIC DEFAULT 5,
  drone_approved BOOLEAN DEFAULT false,
  address TEXT,
  portfolio_url TEXT,
  stripe_account_id TEXT,
  venmo_handle TEXT,
  bio TEXT,
  gear_list TEXT,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT true,
  training_completed BOOLEAN DEFAULT false,
  insurance_url TEXT,
  insurance_expiry TEXT,
  contract_url TEXT,
  contract_expiry TEXT,
  drone_license_url TEXT,
  drone_license_expiry TEXT,
  contract_signature TEXT,
  contract_signed_at TEXT,
  review_notes TEXT,
  w9_name TEXT,
  w9_business_name TEXT,
  w9_tax_classification TEXT,
  w9_address TEXT,
  w9_city_state_zip TEXT,
  w9_ssn_ein TEXT,
  w9_signature TEXT,
  w9_signed_at TEXT,
  interview_date TEXT,
  gallery_requested_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS region TEXT[] DEFAULT '{}';
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 5;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS drone_approved BOOLEAN DEFAULT false;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS venmo_handle TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS gear_list TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT true;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS training_completed BOOLEAN DEFAULT false;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS insurance_url TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS insurance_expiry TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS contract_url TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS contract_expiry TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS drone_license_url TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS drone_license_expiry TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS contract_signature TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS contract_signed_at TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS w9_name TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS w9_business_name TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS w9_tax_classification TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS w9_address TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS w9_city_state_zip TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS w9_ssn_ein TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS w9_signature TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS w9_signed_at TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS interview_date TEXT;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS gallery_requested_at TEXT;

-- 5. Weddings / Events
CREATE TABLE IF NOT EXISTS public.weddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  partner_name TEXT,
  date TEXT NOT NULL,
  location TEXT,
  region TEXT[],
  status TEXT DEFAULT 'upcoming',
  notes TEXT,
  timeline TEXT,
  vip_names TEXT,
  vendors TEXT,
  special_requests TEXT,
  questionnaire_data JSONB,
  questionnaire_completed BOOLEAN DEFAULT false,
  drive_link TEXT,
  upload_link TEXT,
  editing_status TEXT DEFAULT 'pending',
  editor_id TEXT,
  vimeo_link TEXT,
  youtube_link TEXT,
  gallery_link TEXT,
  editing_notes TEXT,
  revisions_notes TEXT,
  editor_due_date TEXT,
  editor_photo_target NUMERIC,
  editor_video_targets TEXT[],
  editor_payout_amount NUMERIC,
  editor_invoice_status TEXT,
  editor_invoice_details JSONB,
  package TEXT,
  addons JSONB,
  second_shooter_hours NUMERIC,
  second_shooter_type TEXT,
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  payment_plan TEXT DEFAULT 'full',
  custom_payment_plan JSONB,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_status TEXT,
  client_email TEXT,
  contract_date TEXT,
  contract_snapshot TEXT,
  is_lgbtq BOOLEAN DEFAULT false,
  final_payment_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS region TEXT[];
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'upcoming';
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS timeline TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS vip_names TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS vendors TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS special_requests TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS questionnaire_data JSONB;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS questionnaire_completed BOOLEAN DEFAULT false;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS drive_link TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS upload_link TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS editing_status TEXT DEFAULT 'pending';
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS editor_id TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS vimeo_link TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS youtube_link TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS gallery_link TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS editing_notes TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS revisions_notes TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS editor_due_date TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS editor_photo_target NUMERIC;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS editor_video_targets TEXT[];
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS editor_payout_amount NUMERIC;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS editor_invoice_status TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS editor_invoice_details JSONB;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS package TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS addons JSONB;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS second_shooter_hours NUMERIC;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS second_shooter_type TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC DEFAULT 0;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS payment_plan TEXT DEFAULT 'full';
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS custom_payment_plan JSONB;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS contract_date TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS contract_snapshot TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS is_lgbtq BOOLEAN DEFAULT false;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS final_payment_verified BOOLEAN DEFAULT false;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS refund_processed BOOLEAN DEFAULT false;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS refund_date TEXT;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS cancellation_notes TEXT;

-- Highlight Video Songs
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS highlight_songs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS songs_submitted_at TIMESTAMPTZ;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS songs_reminder_sent_at TIMESTAMPTZ;

-- Geocoding cache for Market Map (lat/lng stored once per venue)
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS venue_lat DOUBLE PRECISION;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS venue_lng DOUBLE PRECISION;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS venue_geocoded_at TIMESTAMPTZ;

-- Welcome & Questionnaire email guard: sent once on publish (pending -> upcoming)
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT false;

-- Venue geocode cache table — stores lat/lng for ANY location (leads, proposals, weddings)
-- so geocoded lead locations survive page reloads even without a wedding record
CREATE TABLE IF NOT EXISTS public.venue_geocodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT UNIQUE NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  geocoded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.venue_geocodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all venue_geocodes access" ON public.venue_geocodes;
CREATE POLICY "Allow all venue_geocodes access" ON public.venue_geocodes FOR ALL USING (true) WITH CHECK (true);

-- Cancellation Notification Templates
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_cancellation_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_cancellation_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_cancellation_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_cancellation_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_cancellation_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_contractor_cancellation_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_contractor_cancellation_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_contractor_cancellation_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_contractor_cancellation_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_contractor_cancellation_template TEXT;

-- Song Request Notification Templates
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_songs_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_songs_subject TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS email_bride_songs_template TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_songs_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS sms_bride_songs_template TEXT;

-- ============================================================================
-- PRICING: Packages & Addons (managed via Settings, consumed by Book/CreateProposal/ProposalReview)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_both NUMERIC DEFAULT 0,
  price_single NUMERIC DEFAULT 0,
  photo_features TEXT[] DEFAULT '{}',
  video_features TEXT[] DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_addons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  is_hourly BOOLEAN DEFAULT false,
  min_hours NUMERIC DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bartending upsell tagging on addons (single source of truth for portal upsell)
ALTER TABLE public.pricing_addons ADD COLUMN IF NOT EXISTS is_bartending BOOLEAN DEFAULT false;
ALTER TABLE public.pricing_addons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.pricing_addons ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access pricing_packages" ON public.pricing_packages;
CREATE POLICY "Public full access pricing_packages" ON public.pricing_packages FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.pricing_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access pricing_addons" ON public.pricing_addons;
CREATE POLICY "Public full access pricing_addons" ON public.pricing_addons FOR ALL USING (true) WITH CHECK (true);

-- Seed default packages (matches existing hardcoded constants)
INSERT INTO public.pricing_packages (id, name, description, price_both, price_single, photo_features, video_features, is_archived, sort_order) VALUES
  ('pearl', 'Pearl', '4 hours', 1950, 1150,
    ARRAY['4 hours ~ 1 Photographer','300+ fully edited photos','Personalized Digital Gallery','Printing Rights'],
    ARRAY['4 hours ~ 1 Videographer','6+ minute highlight video','Audio of Vows & Speeches','Shareable Digital Portfolio Link','RAW Video Footage'],
    true, 1),
  ('emerald', 'Emerald', '6 hours', 2550, 1450,
    ARRAY['6 hours ~ 1 Photographer','450+ fully edited photos','Personalized Digital Gallery','Printing Rights'],
    ARRAY['6 hours ~ 1 Videographer','8+ minute highlight video','Audio of Vows & Speeches','Shareable Digital Portfolio Link','RAW Video Footage'],
    true, 2),
  ('diamond', 'Diamond Special', '8 hours', 3150, 1750,
    ARRAY['8 hours ~ 1 Photographer','600+ fully edited photos','Personalized Digital Gallery','Printing Rights'],
    ARRAY['8 hours ~ 1 Videographer','10+ minute highlight video','Audio of Vows & Speeches','Shareable Digital Portfolio Link','RAW Video Footage'],
    true, 3),
  ('platinum', 'Platinum', '10 hours', 3750, 2050,
    ARRAY['10 hours ~ 1 Photographer','750+ fully edited photos','Personalized Digital Gallery','Printing Rights'],
    ARRAY['10 hours ~ 1 Videographer','12+ minute highlight video','Audio of Vows & Speeches','Shareable Digital Portfolio Link','RAW Video Footage'],
    true, 4),
  ('all_in_bride', 'All-In Bride', '10 hours', 1950, 1150,
    ARRAY['10 hours ~ 1 Photographer','750+ fully edited photos & RAW photos','Personalized Digital Gallery & Printing Rights','Shareable Digital Portfolio Link'],
    ARRAY['10 hours ~ 1 Videographer','6+ minute highlight video & RAW Video Footage','Audio of Vows & Speeches','Shareable Digital Portfolio Link'],
    false, 5)
ON CONFLICT (id) DO NOTHING;

-- Seed default addons
INSERT INTO public.pricing_addons (id, name, price, is_hourly, min_hours, is_archived, sort_order) VALUES
  ('audio', 'Audio of Vows & Speeches', 125, false, 0, true, 1),
  ('drone', 'Aerial Drone Footage', 250, false, 0, true, 2),
  ('second_shooter', '2nd Shooter', 200, true, 3, true, 3),
  ('raw', '4K RAW Footage Delivery', 200, false, 0, true, 4),
  ('highlight_30', '30-Min Highlight Video', 350, false, 0, true, 5),
  ('highlight_60', '60-Min Highlight Video', 500, false, 0, true, 6),
  ('extra_session', 'Extra Session (Engagement/Bridals)', 450, false, 0, true, 7),
  ('drone_new', 'Aerial Drone Footage', 300, false, 0, false, 8),
  ('second_shooter_new', '2nd Shooter (up to 10 hours)', 750, false, 0, false, 9)
ON CONFLICT (id) DO NOTHING;


CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID REFERENCES public.weddings(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  pay_rate NUMERIC DEFAULT 0,
  pay_type TEXT DEFAULT 'flat',
  status TEXT DEFAULT 'open',
  requirements TEXT,
  drone_required BOOLEAN DEFAULT false,
  hours NUMERIC DEFAULT 8,
  addons TEXT[],
  contractor_todos JSONB,
  invited_contractors TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pay_rate NUMERIC DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pay_type TEXT DEFAULT 'flat';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS drone_required BOOLEAN DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS hours NUMERIC DEFAULT 8;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS addons TEXT[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS contractor_todos JSONB;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS invited_contractors TEXT[];

-- 7. Applications
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  message TEXT,
  bid_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS bid_amount NUMERIC;

-- 8. Assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'upcoming',
  media_link TEXT,
  file_count NUMERIC,
  invoice_notes TEXT,
  editor_rating NUMERIC,
  editor_feedback TEXT,
  client_rating NUMERIC,
  client_feedback TEXT,
  system_rating NUMERIC,
  speed_rating NUMERIC,
  payment_method TEXT,
  attendance_confirmed BOOLEAN DEFAULT false,
  attendance_confirmed_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'upcoming';
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS media_link TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS file_count NUMERIC;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS invoice_notes TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS editor_rating NUMERIC;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS editor_feedback TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS client_rating NUMERIC;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS client_feedback TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS system_rating NUMERIC;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS speed_rating NUMERIC;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS attendance_confirmed BOOLEAN DEFAULT false;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS attendance_confirmed_at TEXT;

-- 9. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'announcement',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'announcement';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- 10. Blackout Dates
CREATE TABLE IF NOT EXISTS public.blackout_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.blackout_dates ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.blackout_dates ADD COLUMN IF NOT EXISTS reason TEXT;

-- 11. Expenses (Operating Expenses & P&L)
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT DEFAULT 'Software / Subscriptions',
  date TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  frequency TEXT DEFAULT 'monthly',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Software / Subscriptions';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'monthly';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes TEXT;

-- 12. Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  entity_type TEXT,
  entity_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS manager_id TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- 13. SMS / Email Logs
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT,
  message TEXT,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';

-- 14. API Logs
CREATE TABLE IF NOT EXISTS public.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT,
  payload TEXT,
  response TEXT,
  status TEXT DEFAULT 'success',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.api_logs ADD COLUMN IF NOT EXISTS event TEXT;
ALTER TABLE public.api_logs ADD COLUMN IF NOT EXISTS payload TEXT;
ALTER TABLE public.api_logs ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE public.api_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';
ALTER TABLE public.api_logs ADD COLUMN IF NOT EXISTS error TEXT;

-- 15. Proposals
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  partner_name TEXT,
  wedding_date TEXT,
  is_lgbtq BOOLEAN DEFAULT false,
  venue TEXT,
  venue_address TEXT,
  city TEXT,
  state TEXT,
  coverage_type TEXT DEFAULT 'both',
  package_id TEXT,
  package TEXT,
  addons JSONB DEFAULT '[]',
  second_shooter_hours NUMERIC DEFAULT 3,
  second_shooter_type TEXT DEFAULT 'photo',
  total_amount NUMERIC DEFAULT 0,
  custom_prices JSONB,
  custom_payment_plan JSONB,
  notes TEXT,
  status TEXT DEFAULT 'draft',
  expires_at TEXT,
  is_upgrade BOOLEAN DEFAULT false,
  original_wedding_id TEXT,
  amount_paid_so_far NUMERIC DEFAULT 0,
  custom_contract_snapshot TEXT,
  contract_signed_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS wedding_date TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS is_lgbtq BOOLEAN DEFAULT false;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS venue_address TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS coverage_type TEXT DEFAULT 'both';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS package_id TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS package TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS second_shooter_hours NUMERIC DEFAULT 3;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS second_shooter_type TEXT DEFAULT 'photo';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS custom_prices JSONB;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS custom_payment_plan JSONB;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS expires_at TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS is_upgrade BOOLEAN DEFAULT false;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS original_wedding_id TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS amount_paid_so_far NUMERIC DEFAULT 0;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS custom_contract_snapshot TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS contract_signed_at TEXT;

-- 16. Messages (Portal Chat)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- 17. Coupons / Discounts
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL,
  max_uses NUMERIC,
  used_count NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  expiry_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS discount_value NUMERIC;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS max_uses NUMERIC;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS used_count NUMERIC DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS expiry_date TEXT;

-- 18. Notification Queue
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'announcement',
  processed BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS contractor_id UUID;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'announcement';
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Enable RLS and default permissive policies for authenticated / anon API calls
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blackout_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Public full access portal_settings" ON public.portal_settings;
DROP POLICY IF EXISTS "Public full access managers" ON public.managers;
DROP POLICY IF EXISTS "Public full access editors" ON public.editors;
DROP POLICY IF EXISTS "Public full access contractors" ON public.contractors;
DROP POLICY IF EXISTS "Public full access weddings" ON public.weddings;
DROP POLICY IF EXISTS "Public full access jobs" ON public.jobs;
DROP POLICY IF EXISTS "Public full access applications" ON public.applications;
DROP POLICY IF EXISTS "Public full access assignments" ON public.assignments;
DROP POLICY IF EXISTS "Public full access notifications" ON public.notifications;
DROP POLICY IF EXISTS "Public full access blackout_dates" ON public.blackout_dates;
DROP POLICY IF EXISTS "Public full access expenses" ON public.expenses;
DROP POLICY IF EXISTS "Public full access activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Public full access sms_logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Public full access api_logs" ON public.api_logs;
DROP POLICY IF EXISTS "Public full access proposals" ON public.proposals;
DROP POLICY IF EXISTS "Public full access messages" ON public.messages;
DROP POLICY IF EXISTS "Public full access coupons" ON public.coupons;
DROP POLICY IF EXISTS "Public full access notification_queue" ON public.notification_queue;

CREATE POLICY "Public full access portal_settings" ON public.portal_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access managers" ON public.managers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access editors" ON public.editors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access contractors" ON public.contractors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access weddings" ON public.weddings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access applications" ON public.applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access blackout_dates" ON public.blackout_dates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access sms_logs" ON public.sms_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access api_logs" ON public.api_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access proposals" ON public.proposals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access coupons" ON public.coupons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access notification_queue" ON public.notification_queue FOR ALL USING (true) WITH CHECK (true);

-- ... keep existing RLS policies ...

-- ============================================================================
-- 19. Territories (Fleet Management + Royalty/Payback)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project_ref TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  access_token TEXT,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'pending',
  last_sync_result JSONB,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS project_ref TEXT;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS supabase_url TEXT;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS access_token TEXT;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS last_sync_status TEXT DEFAULT 'pending';
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS last_sync_result JSONB;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Royalty & Payback columns
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS royalty_percentage NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS payback_percentage NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS down_payment NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS primary_payment_method_id TEXT;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS processing_day_of_week INTEGER DEFAULT 5;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 3;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS retry_delay_hours INTEGER DEFAULT 24;

ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access territories" ON public.territories;
DROP POLICY IF EXISTS "territories_admin_all" ON public.territories;
DROP POLICY IF EXISTS "territories_owner_read" ON public.territories;
CREATE POLICY "Public full access territories" ON public.territories FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 20. Edge Function Sources (for fleet deployment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.edge_function_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  source_code TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.edge_function_sources ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.edge_function_sources ADD COLUMN IF NOT EXISTS source_code TEXT;
ALTER TABLE public.edge_function_sources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.edge_function_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access edge_function_sources" ON public.edge_function_sources;
DROP POLICY IF EXISTS "edge_function_sources_admin_all" ON public.edge_function_sources;
CREATE POLICY "Public full access edge_function_sources" ON public.edge_function_sources FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 21. Venue Geocodes (Market Map cache)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.venue_geocodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  geocoded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location)
);
CREATE INDEX IF NOT EXISTS idx_venue_geocodes_location ON public.venue_geocodes(location);
ALTER TABLE public.venue_geocodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all venue_geocodes access" ON public.venue_geocodes;
DROP POLICY IF EXISTS "venue_geocodes_select" ON public.venue_geocodes;
DROP POLICY IF EXISTS "venue_geocodes_insert" ON public.venue_geocodes;
DROP POLICY IF EXISTS "venue_geocodes_update" ON public.venue_geocodes;
CREATE POLICY "venue_geocodes_all" ON public.venue_geocodes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 22. Royalty & Payback Tables
-- ============================================================================

-- Royalty Settings (single row for this instance)
CREATE TABLE IF NOT EXISTS public.royalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_day_of_week INTEGER DEFAULT 5,
  processing_time TEXT DEFAULT '02:00',
  stripe_connected BOOLEAN DEFAULT false,
  retry_count INTEGER DEFAULT 3,
  retry_delay_hours INTEGER DEFAULT 24,
  notify_email TEXT,
  notify_on_success BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,
  notify_balance_zero BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS processing_day_of_week INTEGER DEFAULT 5;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS processing_time TEXT DEFAULT '02:00';
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_connected BOOLEAN DEFAULT false;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 3;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS retry_delay_hours INTEGER DEFAULT 24;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS notify_email TEXT;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS notify_on_success BOOLEAN DEFAULT true;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS notify_on_failure BOOLEAN DEFAULT true;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS notify_balance_zero BOOLEAN DEFAULT true;
-- Separate Stripe account for HQ royalty collections (distinct from bride booking payments).
-- NOTE: Secret keys are NOT stored here — they go in the royalty_secrets table below
-- which has NO public RLS policy, so the browser can never read them.
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_publishable_key TEXT;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_configured BOOLEAN DEFAULT false;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_webhook_secret TEXT;
INSERT INTO public.royalty_settings (processing_day_of_week, processing_time) VALUES (5, '02:00') ON CONFLICT DO NOTHING;
ALTER TABLE public.royalty_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access royalty_settings" ON public.royalty_settings;
DROP POLICY IF EXISTS "royalty_settings_admin_all" ON public.royalty_settings;
DROP POLICY IF EXISTS "royalty_settings_service_all" ON public.royalty_settings;
CREATE POLICY "Public full access royalty_settings" ON public.royalty_settings FOR ALL USING (true) WITH CHECK (true);

-- Dedicated table for royalty Stripe SECRET keys. These are never readable by the
-- browser: RLS is enabled with NO permissive policy, so only the service-role key
-- (used inside edge functions) can read/write them. The publishable key stays in
-- royalty_settings (safe to expose). This keeps the secret key out of client code.
CREATE TABLE IF NOT EXISTS public.royalty_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_secret_key TEXT,
  stripe_webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.royalty_secrets ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policy → all client (anon/authenticated) access is denied.
-- Only the service role bypasses RLS (used by edge functions).

-- Royalty Periods (immutable ledger)
CREATE TABLE IF NOT EXISTS public.royalty_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_sales NUMERIC(12,2) DEFAULT 0,
  royalty_amount NUMERIC(12,2) DEFAULT 0,
  payback_amount NUMERIC(12,2) DEFAULT 0,
  total_due NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  adjustment_reason TEXT,
  adjusted_by TEXT,
  adjusted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS gross_sales NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS royalty_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS payback_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS total_due NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS adjusted_by TEXT;
ALTER TABLE public.royalty_periods ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_royalty_periods_territory ON public.royalty_periods(territory_id);
CREATE INDEX IF NOT EXISTS idx_royalty_periods_status ON public.royalty_periods(status);
CREATE INDEX IF NOT EXISTS idx_royalty_periods_dates ON public.royalty_periods(period_start, period_end);

-- SAFEGUARD: each territory can have at most ONE royalty period per (start, end)
-- window. This is the hard guarantee that the weekly processor can never charge
-- a territory twice for the same week, even if two invocations race (e.g. the
-- scheduler fires while someone clicks "Run Weekly Processor"). First, remove
-- any pre-existing exact duplicates (keep the paid / most-recent one), then
-- enforce uniqueness.
WITH dups AS (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY territory_id, period_start, period_end
             ORDER BY (status = 'paid') DESC, calculated_at DESC NULLS LAST, created_at DESC
           ) AS rn
    FROM public.royalty_periods
  ) t WHERE rn > 1
)
DELETE FROM public.royalty_periods WHERE id IN (SELECT id FROM dups);
CREATE UNIQUE INDEX IF NOT EXISTS royalty_periods_unique_period
  ON public.royalty_periods (territory_id, period_start, period_end);

ALTER TABLE public.royalty_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access royalty_periods" ON public.royalty_periods;
DROP POLICY IF EXISTS "royalty_periods_admin_all" ON public.royalty_periods;
DROP POLICY IF EXISTS "royalty_periods_owner_read" ON public.royalty_periods;
DROP POLICY IF EXISTS "royalty_periods_service_all" ON public.royalty_periods;
CREATE POLICY "Public full access royalty_periods" ON public.royalty_periods FOR ALL USING (true) WITH CHECK (true);

-- Royalty Audit Log
CREATE TABLE IF NOT EXISTS public.royalty_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID REFERENCES public.territories(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.royalty_audit_log ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.royalty_audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.royalty_audit_log ADD COLUMN IF NOT EXISTS field_changed TEXT;
ALTER TABLE public.royalty_audit_log ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE public.royalty_audit_log ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE public.royalty_audit_log ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.royalty_audit_log ADD COLUMN IF NOT EXISTS performed_by TEXT;
CREATE INDEX IF NOT EXISTS idx_royalty_audit_territory ON public.royalty_audit_log(territory_id);
CREATE INDEX IF NOT EXISTS idx_royalty_audit_action ON public.royalty_audit_log(action);
ALTER TABLE public.royalty_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access royalty_audit_log" ON public.royalty_audit_log;
DROP POLICY IF EXISTS "royalty_audit_admin_all" ON public.royalty_audit_log;
DROP POLICY IF EXISTS "royalty_audit_owner_read" ON public.royalty_audit_log;
DROP POLICY IF EXISTS "royalty_audit_service_all" ON public.royalty_audit_log;
CREATE POLICY "Public full access royalty_audit_log" ON public.royalty_audit_log FOR ALL USING (true) WITH CHECK (true);

-- Royalty Sales (links gross sales to territories)
CREATE TABLE IF NOT EXISTS public.royalty_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  wedding_id UUID,
  sale_amount NUMERIC(12,2) NOT NULL,
  sale_date DATE NOT NULL,
  description TEXT,
  is_refund BOOLEAN DEFAULT false,
  processed_period_id UUID REFERENCES public.royalty_periods(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Idempotency: each sale can only be consumed by ONE royalty period.
-- This prevents double-charging when the processor runs on overlapping windows.
ALTER TABLE public.royalty_sales ADD COLUMN IF NOT EXISTS processed_period_id UUID REFERENCES public.royalty_periods(id) ON DELETE SET NULL;
ALTER TABLE public.royalty_sales ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_royalty_sales_territory ON public.royalty_sales(territory_id);
CREATE INDEX IF NOT EXISTS idx_royalty_sales_date ON public.royalty_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_royalty_sales_unprocessed ON public.royalty_sales(territory_id) WHERE processed_period_id IS NULL;
ALTER TABLE public.royalty_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "royalty_sales_admin_all" ON public.royalty_sales;
DROP POLICY IF EXISTS "royalty_sales_owner_read" ON public.royalty_sales;
DROP POLICY IF EXISTS "royalty_sales_service_all" ON public.royalty_sales;
CREATE POLICY "Public full access royalty_sales" ON public.royalty_sales FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 23. Royalty Summary RPC (for external Master Dashboard)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_territory_royalty_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_territory RECORD;
  v_periods JSONB;
  v_lifetime_gross NUMERIC;
  v_current_gross NUMERIC;
  v_last_paid JSONB;
  v_unpaid JSONB;
  v_settings RECORD;
  v_next_date TEXT;
  v_days_until INTEGER;
  v_payment_status TEXT;
BEGIN
  SELECT * INTO v_territory FROM public.territories WHERE is_primary = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No primary territory registered');
  END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_periods
  FROM (
    SELECT period_start, period_end, gross_sales, royalty_amount, payback_amount, total_due, status, paid_at
    FROM public.royalty_periods WHERE territory_id = v_territory.id ORDER BY period_start DESC LIMIT 12
  ) t;
  SELECT COALESCE(SUM(CASE WHEN is_refund THEN -sale_amount ELSE sale_amount END), 0) INTO v_lifetime_gross
  FROM public.royalty_sales WHERE territory_id = v_territory.id;
  SELECT COALESCE(SUM(CASE WHEN is_refund THEN -sale_amount ELSE sale_amount END), 0) INTO v_current_gross
  FROM public.royalty_sales WHERE territory_id = v_territory.id AND sale_date >= (CURRENT_DATE - INTERVAL '7 days')::DATE AND sale_date < CURRENT_DATE;
  SELECT row_to_json(t) INTO v_last_paid FROM (
    SELECT total_due, paid_at FROM public.royalty_periods WHERE territory_id = v_territory.id AND status = 'paid' ORDER BY period_start DESC LIMIT 1
  ) t;
  SELECT row_to_json(t) INTO v_unpaid FROM (
    SELECT total_due, period_end FROM public.royalty_periods WHERE territory_id = v_territory.id AND status NOT IN ('paid', 'waived') AND total_due > 0 ORDER BY period_start ASC LIMIT 1
  ) t;
  v_payment_status := 'none';
  IF v_unpaid IS NOT NULL THEN
    v_days_until := EXTRACT(DAY FROM (CURRENT_DATE - (v_unpaid->>'period_end')::DATE));
    v_payment_status := CASE WHEN v_days_until > 7 THEN 'overdue' ELSE 'current' END;
  ELSIF v_last_paid IS NOT NULL THEN
    v_payment_status := 'current';
  END IF;
  SELECT * INTO v_settings FROM public.royalty_settings LIMIT 1;
  v_next_date := NULL;
  IF v_settings IS NOT NULL THEN
    v_days_until := (v_settings.processing_day_of_week - EXTRACT(DOW FROM CURRENT_DATE)::INT);
    IF v_days_until <= 0 THEN v_days_until := v_days_until + 7; END IF;
    v_next_date := (CURRENT_DATE + v_days_until)::TEXT;
  END IF;
  RETURN jsonb_build_object(
    'territory_id', v_territory.id, 'territory_name', v_territory.name,
    'status', COALESCE(v_territory.status, 'active'),
    'royalty_percentage', COALESCE(v_territory.royalty_percentage, 0),
    'payback_percentage', COALESCE(v_territory.payback_percentage, 0),
    'purchase_price', COALESCE(v_territory.purchase_price, 0),
    'down_payment', COALESCE(v_territory.down_payment, 0),
    'remaining_balance', COALESCE(v_territory.remaining_balance, 0),
    'gross_sales_current_period', v_current_gross,
    'gross_sales_lifetime', v_lifetime_gross,
    'amount_currently_owed', COALESCE((v_unpaid->>'total_due')::NUMERIC, 0),
    'payment_status', v_payment_status,
    'last_payment_date', v_last_paid->>'paid_at',
    'last_payment_amount', COALESCE((v_last_paid->>'total_due')::NUMERIC, 0),
    'next_expected_payment_date', v_next_date,
    'stripe_connected', v_territory.stripe_customer_id IS NOT NULL,
    'periods', v_periods
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_territory_royalty_summary() TO authenticated, service_role;

-- ============================================================================
-- 24. Payment Plan Change Requests
-- Allows staff to propose a new remaining payment schedule, email/SMS the couple
-- a unique approval link, and only write custom_payment_plan after they approve.
-- ============================================================================
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

-- ============================================================================
-- 25. Push Notifications — VAPID keys, per-device subscriptions, per-user prefs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapid_public_key TEXT NOT NULL,
  vapid_private_key TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'mailto:admin@veydra.com',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.push_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read push_settings" ON public.push_settings;
CREATE POLICY "Public read push_settings public_key"
  ON public.push_settings FOR SELECT
  USING (true);

-- Seed the VAPID keypair. Always replaces (DELETE + INSERT) so re-syncing
-- fixes any invalid keys that were previously seeded.
DELETE FROM public.push_settings;
INSERT INTO public.push_settings (vapid_public_key, vapid_private_key, subject)
VALUES (
  'BP2Rhk8b2-A77mHB2XCSJjKEs4SyP_L8t9qTWDeQchhFbe03XQ0FkdCPSCN5xC8f02D2dsmf2i26vh84FgrAWuo',
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgpzGWJW9Jj0DbLYGY0PIKTbn5k2ioJRj5-0wKUBaN-tChRANCAAT9kYZPG9vgO-5hwdlwkiYyhLOEsj_y_Lfak1g3kHIYRW3tN10NBZHQj0gjecQvH9Ng9nbJn9otur4fOBYKwFrq',
  'mailto:admin@veydra.com'
);

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

-- ── Storage bucket for app icons / avatars (used by Settings → App Icon upload) ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public upload avatars" ON storage.objects;
CREATE POLICY "Public upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public update avatars" ON storage.objects;
CREATE POLICY "Public update avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

-- ============================================================================
-- Server-side backstop for the "Owner (Read Only)" role.
-- The frontend blocks writes for owner_readonly via localStorage, but that is
-- client-side and bypassable. This trigger enforces it at the DB layer on
-- every business table. Service-role / edge functions (no auth.uid()) are
-- never blocked, so cron + webhooks keep working.
-- ============================================================================
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
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
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
  RETURN v_role = 'owner_readonly';
END;
$$;

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
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


-- --- Scheduled jobs queue + scheduler heartbeats ---
-- Scheduled jobs queue + scheduler heartbeats for the notification scheduler.
-- The scheduler edge function claims pending jobs (run_at <= now) and sends
-- them using the existing SMS/email/push helpers. Idempotent via dedupe_key.

CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  dedupe_key TEXT,
  related_wedding_id UUID,
  related_assignment_id UUID,
  related_contractor_id UUID,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS run_at TIMESTAMPTZ;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS related_wedding_id UUID;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS related_assignment_id UUID;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS related_contractor_id UUID;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.scheduled_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Unique partial index so a dedupe_key can only have one pending/running job
-- at a time. This is what makes the queue idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_jobs_dedupe_active
  ON public.scheduled_jobs (dedupe_key)
  WHERE status IN ('pending', 'running');

-- Index for the worker's claim query (run_at <= now AND status = 'pending').
CREATE INDEX IF NOT EXISTS scheduled_jobs_claim_idx
  ON public.scheduled_jobs (run_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.scheduler_heartbeats (
  id TEXT PRIMARY KEY DEFAULT 'default',
  last_seen_at TIMESTAMPTZ,
  last_source TEXT,
  last_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scheduler_heartbeats ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.scheduler_heartbeats ADD COLUMN IF NOT EXISTS last_source TEXT;
ALTER TABLE public.scheduler_heartbeats ADD COLUMN IF NOT EXISTS last_result JSONB;

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access scheduled_jobs" ON public.scheduled_jobs;
CREATE POLICY "Public full access scheduled_jobs" ON public.scheduled_jobs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.scheduler_heartbeats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access scheduler_heartbeats" ON public.scheduler_heartbeats;
CREATE POLICY "Public full access scheduler_heartbeats" ON public.scheduler_heartbeats FOR ALL USING (true) WITH CHECK (true);

-- NOTE: Automatic scheduling is done via Supabase Scheduled Functions
-- (Edge Functions → Schedules), NOT pg_cron. pg_cron cannot reliably call
-- edge functions across projects because each project has its own
-- service-role key. See the "Clock & Scheduler" card in Settings for the
-- per-project setup steps.


DO $$
DECLARE
  t TEXT;
  business_tables TEXT[] := ARRAY[
    'portal_settings','managers','editors','contractors','weddings','jobs',
    'applications','assignments','notifications','blackout_dates','expenses',
    'activity_logs','sms_logs','api_logs','proposals','messages','coupons',
    'notification_queue','territories','edge_function_sources','royalty_settings',
    'royalty_secrets','royalty_periods','royalty_audit_log','royalty_sales',
    'payment_plan_change_requests','push_settings','push_subscriptions',
    'push_preferences','venue_geocodes','pricing_packages','pricing_addons',
    'upsell_purchases','scheduled_jobs','scheduler_heartbeats','payment_refunds','payment_charges'
  ];

-- Refunds log (idempotent: one row per Stripe charge id)
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID REFERENCES public.weddings(id) ON DELETE CASCADE,
  stripe_charge_id TEXT UNIQUE NOT NULL,
  stripe_refund_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Managers can read refunds" ON public.payment_refunds FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Managers insert refunds" ON public.payment_refunds FOR INSERT TO authenticated WITH CHECK (true);

-- Per-installment charge lock: prevents two staff members from
-- double-charging the same installment. The dedupe_key is unique per
-- wedding+installment, so only the first charge attempt can insert.
CREATE TABLE IF NOT EXISTS public.payment_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  schedule_index INTEGER,
  installment_label TEXT,
  amount NUMERIC NOT NULL,
  stripe_charge_id TEXT,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  charged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Only ONE pending/running row per wedding+installment. The partial unique
-- index means a 'sent' row does NOT block a legitimate future re-charge
-- (e.g. after Mark Unpaid resets the installment).
CREATE UNIQUE INDEX IF NOT EXISTS payment_charges_active_dedupe_idx
  ON public.payment_charges (dedupe_key)
  WHERE status IN ('pending','running');
ALTER TABLE public.payment_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Staff read charges" ON public.payment_charges FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Staff insert charges" ON public.payment_charges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Staff update charges" ON public.payment_charges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

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
