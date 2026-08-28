import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Master SQL Schema (mirrors supabase/migrations/20260803000000_schema.sql) ─
const MASTER_SQL = `
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
  app_url TEXT, logo_url TEXT,
  invite_webhook TEXT, admin_invite_webhook TEXT, new_job_webhook TEXT,
  assignment_webhook TEXT, payout_webhook TEXT, editor_assignment_webhook TEXT,
  webhook_url TEXT, hl_api_key TEXT, hl_location_id TEXT,
  fb_access_token TEXT, fb_ad_account_id TEXT,
  excluded_campaign_ids TEXT[] DEFAULT '{}', excluded_campaigns TEXT[] DEFAULT '{}',
  manual_expenses JSONB DEFAULT '[]', regions TEXT[] DEFAULT '{}',
  timezone TEXT DEFAULT 'America/New_York', company_timezone TEXT DEFAULT 'America/New_York',
  photo_pay_rate NUMERIC, video_pay_rate NUMERIC, editor_video_pricing JSONB,
  photo_bid_min NUMERIC DEFAULT 50, photo_bid_max NUMERIC DEFAULT 100,
  video_bid_min NUMERIC DEFAULT 60, video_bid_max NUMERIC DEFAULT 120,
  smtp_host TEXT, smtp_port INTEGER, smtp_user TEXT, smtp_pass TEXT,
  smtp_from_email TEXT, smtp_from_name TEXT,
  email_delivery_method TEXT DEFAULT 'webhook',
  email_colors JSONB,
  contract_template TEXT, wedding_contract_template TEXT,
  notify_on_failed_autocharge BOOLEAN DEFAULT false,
  email_payment_failed_enabled BOOLEAN DEFAULT false,
  last_heartbeat_date TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'Veydra';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS company_state TEXT DEFAULT 'Tennessee';
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS app_url TEXT;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
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

-- 2. Managers
CREATE TABLE IF NOT EXISTS public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL, name TEXT, role TEXT DEFAULT 'manager',
  status TEXT DEFAULT 'active', avatar_url TEXT, phone TEXT,
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
  email TEXT UNIQUE NOT NULL, name TEXT, status TEXT DEFAULT 'active',
  avatar_url TEXT, pay_rate NUMERIC DEFAULT 0,
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
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  phone TEXT, status TEXT DEFAULT 'active', tags TEXT[] DEFAULT '{}',
  specialty TEXT, region TEXT[] DEFAULT '{}', avatar_url TEXT,
  rating NUMERIC DEFAULT 5, drone_approved BOOLEAN DEFAULT false,
  address TEXT, portfolio_url TEXT, stripe_account_id TEXT, venmo_handle TEXT,
  bio TEXT, gear_list TEXT, email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT true, training_completed BOOLEAN DEFAULT false,
  insurance_url TEXT, insurance_expiry TEXT, contract_url TEXT, contract_expiry TEXT,
  drone_license_url TEXT, drone_license_expiry TEXT,
  contract_signature TEXT, contract_signed_at TEXT, review_notes TEXT,
  w9_name TEXT, w9_business_name TEXT, w9_tax_classification TEXT,
  w9_address TEXT, w9_city_state_zip TEXT, w9_ssn_ein TEXT,
  w9_signature TEXT, w9_signed_at TEXT,
  interview_date TEXT, gallery_requested_at TEXT,
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

-- 5. Weddings
CREATE TABLE IF NOT EXISTS public.weddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL, partner_name TEXT, date TEXT NOT NULL,
  location TEXT, region TEXT[], status TEXT DEFAULT 'upcoming',
  notes TEXT, timeline TEXT, vip_names TEXT, vendors TEXT,
  special_requests TEXT, questionnaire_data JSONB,
  questionnaire_completed BOOLEAN DEFAULT false,
  drive_link TEXT, upload_link TEXT,
  editing_status TEXT DEFAULT 'pending', editor_id TEXT,
  vimeo_link TEXT, youtube_link TEXT, gallery_link TEXT,
  editing_notes TEXT, revisions_notes TEXT, editor_due_date TEXT,
  editor_photo_target NUMERIC, editor_video_targets TEXT[],
  editor_payout_amount NUMERIC, editor_invoice_status TEXT,
  editor_invoice_details JSONB, package TEXT, addons JSONB,
  second_shooter_hours NUMERIC, second_shooter_type TEXT,
  total_amount NUMERIC DEFAULT 0, paid_amount NUMERIC DEFAULT 0,
  payment_plan TEXT DEFAULT 'full', custom_payment_plan JSONB,
  stripe_customer_id TEXT, stripe_subscription_id TEXT,
  stripe_subscription_status TEXT, client_email TEXT,
  contract_date TEXT, contract_snapshot TEXT, is_lgbtq BOOLEAN DEFAULT false,
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
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS highlight_songs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS songs_submitted_at TIMESTAMPTZ;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS songs_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS venue_lat DOUBLE PRECISION;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS venue_lng DOUBLE PRECISION;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS venue_geocoded_at TIMESTAMPTZ;
-- Welcome & Questionnaire email guard: sent once on publish (pending -> upcoming)
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT false;

-- Venue geocode cache table (for all locations: leads, proposals, weddings)
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
-- Pricing: Packages & Addons
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  price_both NUMERIC DEFAULT 0, price_single NUMERIC DEFAULT 0,
  photo_features TEXT[] DEFAULT '{}', video_features TEXT[] DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pricing_addons (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, price NUMERIC DEFAULT 0,
  is_hourly BOOLEAN DEFAULT false, min_hours NUMERIC DEFAULT 0,
  is_archived BOOLEAN DEFAULT false, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access pricing_packages" ON public.pricing_packages;
CREATE POLICY "Public full access pricing_packages" ON public.pricing_packages FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.pricing_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access pricing_addons" ON public.pricing_addons;
CREATE POLICY "Public full access pricing_addons" ON public.pricing_addons FOR ALL USING (true) WITH CHECK (true);
INSERT INTO public.pricing_packages (id, name, description, price_both, price_single, photo_features, video_features, is_archived, sort_order) VALUES
  ('pearl', 'Pearl', '4 hours', 1950, 1150, ARRAY['4 hours ~ 1 Photographer','300+ fully edited photos','Personalized Digital Gallery','Printing Rights'], ARRAY['4 hours ~ 1 Videographer','6+ minute highlight video','Audio of Vows & Speeches','Shareable Digital Portfolio Link','RAW Video Footage'], true, 1),
  ('emerald', 'Emerald', '6 hours', 2550, 1450, ARRAY['6 hours ~ 1 Photographer','450+ fully edited photos','Personalized Digital Gallery','Printing Rights'], ARRAY['6 hours ~ 1 Videographer','8+ minute highlight video','Audio of Vows & Speeches','Shareable Digital Portfolio Link','RAW Video Footage'], true, 2),
  ('diamond', 'Diamond Special', '8 hours', 3150, 1750, ARRAY['8 hours ~ 1 Photographer','600+ fully edited photos','Personalized Digital Gallery','Printing Rights'], ARRAY['8 hours ~ 1 Videographer','10+ minute highlight video','Audio of Vows & Speeches','Shareable Digital Portfolio Link','RAW Video Footage'], true, 3),
  ('platinum', 'Platinum', '10 hours', 3750, 2050, ARRAY['10 hours ~ 1 Photographer','750+ fully edited photos','Personalized Digital Gallery','Printing Rights'], ARRAY['10 hours ~ 1 Videographer','12+ minute highlight video','Audio of Vows & Speeches','Shareable Digital Portfolio Link','RAW Video Footage'], true, 4),
  ('all_in_bride', 'All-In Bride', '10 hours', 1950, 1150, ARRAY['10 hours ~ 1 Photographer','750+ fully edited photos & RAW photos','Personalized Digital Gallery & Printing Rights','Shareable Digital Portfolio Link'], ARRAY['10 hours ~ 1 Videographer','6+ minute highlight video & RAW Video Footage','Audio of Vows & Speeches','Shareable Digital Portfolio Link'], false, 5)
ON CONFLICT (id) DO NOTHING;
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

-- 6. Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id UUID REFERENCES public.weddings(id) ON DELETE CASCADE,
  role TEXT NOT NULL, pay_rate NUMERIC DEFAULT 0,
  pay_type TEXT DEFAULT 'flat', status TEXT DEFAULT 'open',
  requirements TEXT, drone_required BOOLEAN DEFAULT false,
  hours NUMERIC DEFAULT 8, addons TEXT[],
  contractor_todos JSONB, invited_contractors TEXT[],
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
  status TEXT DEFAULT 'pending', message TEXT, bid_amount NUMERIC,
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
  status TEXT DEFAULT 'upcoming', media_link TEXT, file_count NUMERIC,
  invoice_notes TEXT, editor_rating NUMERIC, editor_feedback TEXT,
  client_rating NUMERIC, client_feedback TEXT,
  system_rating NUMERIC, speed_rating NUMERIC,
  payment_method TEXT, attendance_confirmed BOOLEAN DEFAULT false,
  attendance_confirmed_at TEXT, created_at TIMESTAMPTZ DEFAULT now()
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
  title TEXT NOT NULL, message TEXT NOT NULL,
  type TEXT DEFAULT 'announcement', read BOOLEAN DEFAULT false,
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
  date TEXT NOT NULL, reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.blackout_dates ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.blackout_dates ADD COLUMN IF NOT EXISTS reason TEXT;

-- 11. Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, amount NUMERIC NOT NULL,
  category TEXT DEFAULT 'Software / Subscriptions', date TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT false, frequency TEXT DEFAULT 'monthly',
  notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
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
  manager_id TEXT, action TEXT NOT NULL, details TEXT,
  entity_type TEXT, entity_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS manager_id TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- 13. SMS Logs
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT, message TEXT,
  status TEXT DEFAULT 'success', created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';

-- 14. API Logs
CREATE TABLE IF NOT EXISTS public.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT, payload TEXT, response TEXT,
  status TEXT DEFAULT 'success', error TEXT,
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
  client_name TEXT NOT NULL, client_email TEXT, client_phone TEXT,
  partner_name TEXT, wedding_date TEXT, is_lgbtq BOOLEAN DEFAULT false,
  venue TEXT, venue_address TEXT, city TEXT, state TEXT,
  coverage_type TEXT DEFAULT 'both', package_id TEXT, package TEXT,
  addons JSONB DEFAULT '[]', second_shooter_hours NUMERIC DEFAULT 3,
  second_shooter_type TEXT DEFAULT 'photo', total_amount NUMERIC DEFAULT 0,
  custom_prices JSONB, custom_payment_plan JSONB, notes TEXT,
  status TEXT DEFAULT 'draft', expires_at TEXT,
  is_upgrade BOOLEAN DEFAULT false, original_wedding_id TEXT,
  amount_paid_so_far NUMERIC DEFAULT 0, custom_contract_snapshot TEXT,
  contract_signed_at TEXT, created_at TIMESTAMPTZ DEFAULT now()
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

-- 16. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL, receiver_id TEXT NOT NULL,
  content TEXT NOT NULL, read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- 17. Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, discount_type TEXT DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL, max_uses NUMERIC,
  used_count NUMERIC DEFAULT 0, active BOOLEAN DEFAULT true,
  expiry_date TEXT, created_at TIMESTAMPTZ DEFAULT now()
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
  title TEXT NOT NULL, message TEXT NOT NULL,
  type TEXT DEFAULT 'announcement', processed BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending', retry_count INTEGER DEFAULT 0,
  error_message TEXT, payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
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

-- RLS
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

CREATE POLICY "Public full access notification_queue" ON public.notification_queue FOR ALL USING (true) WITH CHECK (true);

-- ... keep existing RLS policies ...

-- 19. Territories (Fleet Management + Royalty/Payback)
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

-- 20. Edge Function Sources
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
DROP POLICY IF EXISTS "Public full access edge_function_sources" ON public.edge_function_sources;
CREATE POLICY "Public full access edge_function_sources" ON public.edge_function_sources FOR ALL USING (true) WITH CHECK (true);

-- 21. Venue Geocodes
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

-- 22. Royalty & Payback Tables
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
-- NOTE: Secret keys are NOT stored here — they go in royalty_secrets (RLS-locked, no policy).
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_publishable_key TEXT;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_configured BOOLEAN DEFAULT false;
ALTER TABLE public.royalty_settings ADD COLUMN IF NOT EXISTS stripe_royalty_webhook_secret TEXT;
INSERT INTO public.royalty_settings (processing_day_of_week, processing_time) VALUES (5, '02:00') ON CONFLICT DO NOTHING;
ALTER TABLE public.royalty_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access royalty_settings" ON public.royalty_settings;
DROP POLICY IF EXISTS "royalty_settings_admin_all" ON public.royalty_settings;
DROP POLICY IF EXISTS "royalty_settings_service_all" ON public.royalty_settings;
CREATE POLICY "Public full access royalty_settings" ON public.royalty_settings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.royalty_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_secret_key TEXT,
  stripe_webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.royalty_secrets ENABLE ROW LEVEL SECURITY;

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
ALTER TABLE public.royalty_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access royalty_periods" ON public.royalty_periods;
DROP POLICY IF EXISTS "royalty_periods_admin_all" ON public.royalty_periods;
DROP POLICY IF EXISTS "royalty_periods_owner_read" ON public.royalty_periods;
DROP POLICY IF EXISTS "royalty_periods_service_all" ON public.royalty_periods;
CREATE POLICY "Public full access royalty_periods" ON public.royalty_periods FOR ALL USING (true) WITH CHECK (true);

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
`;

// ── Edge Function Sources (fetched from edge_function_sources table at deploy time) ─────
// IMPORTANT: Each territory MUST set STRIPE_SECRET_KEY in their Supabase env vars!
// Sources are uploaded from the Territories UI using Vite ?raw imports.

const FN_SOURCES: Record<string, string> = {}; // Populated at runtime from DB

// Strip SQL comments (single-line -- and multi-line block) to prevent
// comment content (like $$ inside comments) from confusing the splitter.
function stripSqlComments(sql: string): string {
  let result = "";
  let i = 0;
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = "";
  while (i < sql.length) {
    const ch = sql[i];
    const nextCh = sql[i + 1] || "";
    // Handle single quotes
    if (ch === "'" && !inDollarQuote) {
      if (inSingleQuote && nextCh === "'") { result += "''"; i += 2; continue; }
      inSingleQuote = !inSingleQuote;
      result += ch; i++; continue;
    }
    // Handle dollar quotes
    if (ch === "$" && !inSingleQuote) {
      if (!inDollarQuote) {
        const tagMatch = sql.substring(i).match(/^\$(\w*)\$/);
        if (tagMatch) { inDollarQuote = true; dollarTag = tagMatch[0]; result += tagMatch[0]; i += tagMatch[0].length; continue; }
      } else {
        if (sql.substring(i).startsWith(dollarTag)) { inDollarQuote = false; result += dollarTag; i += dollarTag.length; continue; }
      }
    }
    // Strip -- comments (only when not in string/dollar-quote)
    if (ch === "-" && nextCh === "-" && !inSingleQuote && !inDollarQuote) {
      // Skip to end of line
      while (i < sql.length && sql[i] !== "\n") i++;
      result += "\n";
      continue;
    }
    // Strip /* */ comments
    if (ch === "/" && nextCh === "*" && !inSingleQuote && !inDollarQuote) {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      result += " ";
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

/** Split a multi-statement SQL string into individual statements, respecting quotes and dollar-quoting. */
function splitSqlStatements(sql: string): string[] {
  // Strip comments FIRST so $$ inside comments doesn't confuse the parser
  const cleaned = stripSqlComments(sql);
  const statements: string[] = [];
  let currentStmt = "";
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = "";
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const nextCh = cleaned[i + 1] || "";
    currentStmt += ch;
    if (ch === "'" && !inDollarQuote && !inSingleQuote) { inSingleQuote = true; }
    else if (ch === "'" && !inDollarQuote && inSingleQuote && nextCh !== "'") { inSingleQuote = false; }
    else if (ch === "'" && inSingleQuote && nextCh === "'") { currentStmt += nextCh; i++; }
    else if (ch === "$" && !inSingleQuote) {
      if (!inDollarQuote) {
        const tagMatch = cleaned.substring(i).match(/^\$(\w*)\$/);
        if (tagMatch) { inDollarQuote = true; dollarTag = tagMatch[0]; currentStmt += tagMatch[0].substring(1); i += tagMatch[0].length - 1; }
      } else {
        if (cleaned.substring(i).startsWith(dollarTag)) { inDollarQuote = false; currentStmt += dollarTag.substring(1); i += dollarTag.length - 1; }
      }
    }
    if (ch === ";" && !inSingleQuote && !inDollarQuote) {
      const trimmed = currentStmt.trim();
      if (trimmed.length > 1) statements.push(trimmed);
      currentStmt = "";
    }
  }
  if (currentStmt.trim().length > 1) statements.push(currentStmt.trim());
  return statements;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { territoryId, projectRef, accessToken, deploySchema, deployFunctions, functionNames, testOnly } = await req.json();

    // Detect self-deploy: when the target projectRef matches this instance
    const selfSu = Deno.env.get("SUPABASE_URL") || "";
    const selfRef = selfSu.replace("https://", "").replace(".supabase.co", "");
    const isSelfDeploy = projectRef === selfRef;

    // For self-deploy we don't need an access token — we run SQL directly
    if (!projectRef || (!accessToken && !isSelfDeploy)) {
      return new Response(JSON.stringify({ error: "Missing projectRef or accessToken" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const managementApiBase = `https://api.supabase.com/v1/projects/${projectRef}`;

    // Test-only mode
    if (testOnly) {
      try {
        const testRes = await fetch(managementApiBase, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        if (testRes.ok) {
          const proj = await testRes.json();
          return new Response(JSON.stringify({
            success: true,
            project: { name: proj.name, region: proj.region, status: proj.status, ref: projectRef },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: false, error: `HTTP ${testRes.status}` }), {
          status: testRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const results: any = { projectRef, schema: null, functions: {} as Record<string, any>, errors: [] as string[], duration: 0 };

    // Fetch latest source code AND master SQL from edge_function_sources table
    const mainDbForSources = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data: sourceRows, error: sourceError } = await mainDbForSources.from("edge_function_sources").select("name, source_code");
    console.log(`[Fleet] edge_function_sources query: ${sourceRows?.length || 0} rows, error: ${sourceError?.message || "none"}`);

    // Extract master_sql from the DB rows (uploaded by Territories UI)
    let dynamicMasterSql = "";
    if (sourceRows && sourceRows.length > 0) {
      for (const row of sourceRows) {
        if (row.source_code && row.source_code.length > 50) {
          FN_SOURCES[row.name] = row.source_code;
        }
        if (row.name === "master_sql" && row.source_code && row.source_code.length > 50) {
          dynamicMasterSql = row.source_code;
          console.log(`[Fleet] Loaded master_sql from DB (${row.source_code.length} chars)`);
        }
      }
      console.log(`[Fleet] Loaded ${sourceRows.length} rows from edge_function_sources`);
    } else {
      console.warn(`[Fleet] WARNING: No edge function sources found in DB! Click 'Upload Sources' in Territories UI first.`);
      results.errors.push("No edge function sources in DB — click 'Upload Sources' in the Territories page first.");
    }

    // Use the DB-fetched master SQL if available, otherwise fall back to the hardcoded MASTER_SQL
    let effectiveSql = dynamicMasterSql;
    if (dynamicMasterSql) {
      console.log(`[Fleet] Using DB master SQL (${dynamicMasterSql.length} chars) — always latest version`);
    } else {
      // Last resort: use hardcoded MASTER_SQL but warn loudly
      effectiveSql = MASTER_SQL;
      console.warn(`[Fleet] WARNING: master_sql not found in DB, falling back to hardcoded MASTER_SQL (${MASTER_SQL.length} chars). Click 'Upload Sources' to push the latest schema.`);
      results.errors.push("WARNING: master_sql not found in edge_function_sources DB table — used hardcoded fallback which may be stale. Click 'Upload Sources' in the Territories UI to fix.");
    }

    // Push SQL Schema
    if (deploySchema !== false) {
      try {
        const statements = splitSqlStatements(effectiveSql);
        console.log(`[Fleet] Schema deploy: ${statements.length} statements, selfDeploy: ${isSelfDeploy}, hasToken: ${!!accessToken}`);

        let failedCount = 0;
        const schemaErrors: string[] = [];
        const selfSk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

        // ── Schema deployment ──
        // When an access token is available (self-deploy OR other territories),
        // use the Management API /database/query endpoint. This is the most
        // reliable method — it doesn't need any pre-existing database functions
        // and can run raw multi-statement SQL directly.
        //
        // When self-deploying WITHOUT an access token, fall back to the
        // exec_sql_batch RPC approach (requires exec_sql to already exist).
        if (accessToken) {
          // ── Method: Management API /database/query ──
          // Works for both self-deploy and other territories.
          // Split into ~200KB chunks to stay under payload limits.
          const CHUNK_SIZE = 200000;
          let pos = 0;
          let chunkIdx = 0;
          while (pos < effectiveSql.length) {
            const chunk = effectiveSql.substring(pos, pos + CHUNK_SIZE);
            pos += CHUNK_SIZE;
            chunkIdx++;
            const sqlRes = await fetch(`${managementApiBase}/database/query`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ query: chunk }),
            });
            if (!sqlRes.ok) {
              const errText = await sqlRes.text();
              if (!errText.includes("already exists") && !errText.includes("duplicate") && !errText.includes("already") && !errText.includes("Throttler")) {
                failedCount++;
                if (schemaErrors.length < 10) schemaErrors.push(`Chunk ${chunkIdx}: ${errText.substring(0, 150)}`);
              }
            }
            console.log(`[Fleet] Management API chunk ${chunkIdx} (${chunk.length} chars): ${sqlRes.ok ? "OK" : "failed"}`);
          }
        } else if (isSelfDeploy) {
          // ── Fallback: exec_sql_batch RPC (self-deploy, no access token) ──
          // Requires exec_sql to already exist on this database.
          if (!selfSk) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set on this instance");

          // Step 1: Create the batch function (idempotent)
          const createBatchFn = `CREATE OR REPLACE FUNCTION public.exec_sql_batch(sql_texts TEXT[]) RETURNS void AS $$ BEGIN FOR i IN 1..array_length(sql_texts, 1) LOOP BEGIN EXECUTE sql_texts[i]; EXCEPTION WHEN OTHERS THEN IF NOT (SQLERRM LIKE '%already exists%' OR SQLERRM LIKE '%duplicate%' OR SQLERRM LIKE '%already%') THEN RAISE NOTICE 'Skip: %', SQLERRM; END IF; END; END LOOP; END; $$ LANGUAGE plpgsql SECURITY DEFINER;`;
          const batchFnRes = await fetch(`${selfSu}/rest/v1/rpc/exec_sql`, {
            method: "POST",
            headers: { "apikey": selfSk, "Authorization": `Bearer ${selfSk}`, "Content-Type": "application/json" },
            body: JSON.stringify({ sql_text: createBatchFn }),
          });
          if (!batchFnRes.ok) {
            const errText = await batchFnRes.text();
            console.error(`[Fleet] Failed to create exec_sql_batch: ${errText.substring(0, 300)}`);
            throw new Error(`Cannot create exec_sql_batch (exec_sql may not exist). Add a Supabase access token to use the Management API instead. Error: ${errText.substring(0, 200)}`);
          }
          console.log(`[Fleet] exec_sql_batch function created: ${batchFnRes.ok}`);

          // Step 2: Send ALL statements in chunks of 100
          const CHUNK = 100;
          for (let ci = 0; ci < statements.length; ci += CHUNK) {
            const chunk = statements.slice(ci, ci + CHUNK);
            const batchRes = await fetch(`${selfSu}/rest/v1/rpc/exec_sql_batch`, {
              method: "POST",
              headers: { "apikey": selfSk, "Authorization": `Bearer ${selfSk}`, "Content-Type": "application/json" },
              body: JSON.stringify({ sql_texts: chunk }),
            });
            if (!batchRes.ok) {
              const errText = await batchRes.text();
              console.error(`[Fleet] exec_sql_batch chunk ${ci} failed: ${errText.substring(0, 300)}`);
              failedCount += chunk.length;
              if (schemaErrors.length < 10) schemaErrors.push(`Batch chunk ${ci}: ${errText.substring(0, 150)}`);
            } else {
              console.log(`[Fleet] exec_sql_batch chunk ${ci}-${ci + chunk.length} OK`);
            }
          }
        }



        if (failedCount > 0) {
          results.errors.push(`Schema: ${failedCount} statements/chunks failed`);
          results.schema = { status: "failed", error: `${failedCount} of ${statements.length} statements failed`, details: schemaErrors, totalStatements: statements.length };
        } else {
          results.schema = { status: "success", method: accessToken ? "management_api" : "exec_sql_batch_rpc", statements: statements.length };
        }
      } catch (e: any) {
        results.schema = { status: "failed", error: e.message, details: [e.message] };
        results.errors.push(`Schema: ${e.message}`);
      }

      // Reload PostgREST schema cache so newly added columns are immediately visible.
      // Without this, the API returns "column does not exist" errors until PostgREST auto-refreshes.
      // For self-deploy, the service role key bypasses RLS so PostgREST cache isn't an issue,
      // but we still reload it so the anon/authenticated API picks up new columns.
      if (accessToken && results.schema?.status === "success") {
        try {
          await fetch(`${managementApiBase}/postgrest/restart`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${accessToken}` },
          });
          console.log("[Fleet] PostgREST schema cache reloaded");
        } catch (e) {
          console.warn("[Fleet] Could not reload PostgREST cache:", (e as Error).message);
        }
      }
    }

    // Deploy Edge Functions — including self-deploy when an access token is provided
    const targetFunctions = functionNames || ["daily-reminders", "stripe-checkout", "stripe-invoices", "stripe-payout", "stripe-portal", "stripe-onboard", "stripe-webhook", "stripe-status", "crm-webhook", "process-notifications", "deploy-territory", "geocode", "royalty-processor", "royalty-summary", "royalty-stripe-keys"];

    if (deployFunctions !== false && (!isSelfDeploy || accessToken)) {
      for (const fnName of targetFunctions) {
        // When self-deploying WITH an access token, we CAN redeploy ourselves
        // because the Management API creates a new version — the current execution
        // continues with the old code and the next invocation uses the new code.
        if (fnName === "deploy-territory" && isSelfDeploy && !accessToken) {
          results.functions[fnName] = { status: "skipped", note: "Self-deploy without token — add an access token to redeploy this function." };
          continue;
        }
        try {
          const source = FN_SOURCES[fnName];
          if (!source) {
            results.functions[fnName] = { status: "failed", error: "Source code not found in DB. Click 'Upload Sources' in Territories UI first." };
            results.errors.push(`${fnName}: Source missing`);
            continue;
          }

          // Validate source is valid JS/TS before attempting deploy
          if (source.length < 50) {
            results.functions[fnName] = { status: "failed", error: "Source too short (corrupted?)" };
            results.errors.push(`${fnName}: Source appears corrupted (${source.length} chars)`);
            continue;
          }

          console.log(`[Fleet] Deploying ${fnName} to ${projectRef} (${source.length} chars)...`);

          // Manually construct multipart/form-data (Deno's FormData+Blob can be unreliable)
          const boundary = "----VeydraBoundary" + Math.random().toString(16).substring(2);
          const metadataJson = JSON.stringify({ name: fnName, verify_jwt: false, entrypoint_path: "index.ts" });
          const multipartBody = [
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="metadata"\r\n`,
            `Content-Type: application/json\r\n\r\n`,
            `${metadataJson}\r\n`,
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="file"; filename="index.ts"\r\n`,
            `Content-Type: text/typescript\r\n\r\n`,
            `${source}\r\n`,
            `--${boundary}--\r\n`,
          ].join("");

          const deployRes = await fetch(`${managementApiBase}/functions/deploy?slug=${fnName}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
            body: multipartBody,
          });

          const responseText = await deployRes.text();
          console.log(`[Fleet] ${fnName} deploy response: HTTP ${deployRes.status}, body: ${responseText.substring(0, 300)}`);

          if (!deployRes.ok) {
            // Parse Supabase API error for details
            let errDetail = responseText.substring(0, 500);
            try {
              const errJson = JSON.parse(responseText);
              errDetail = errJson.error || errJson.message || JSON.stringify(errJson).substring(0, 300);
            } catch { /* keep raw text */ }
            
            results.functions[fnName] = { 
              status: "failed", 
              error: errDetail,
              httpStatus: deployRes.status 
            };
            results.errors.push(`${fnName}: HTTP ${deployRes.status} — ${errDetail.substring(0, 150)}`);
          } else {
            let deployData;
            try {
              deployData = JSON.parse(responseText);
            } catch {
              deployData = { raw: responseText.substring(0, 200) };
            }
            results.functions[fnName] = { status: "success", id: deployData?.id, size: source.length };
            console.log(`[Fleet] ✓ ${fnName} deployed OK`);
          }
        } catch (e: any) {
          results.functions[fnName] = { status: "failed", error: e.message };
          results.errors.push(`${fnName}: ${e.message}`);
          console.error(`[Fleet] ✗ ${fnName} failed:`, e.message);
        }
      }
    } else if (isSelfDeploy && !accessToken) {
      // Self-deploy without access token: functions are already running here
      for (const fnName of targetFunctions) {
        results.functions[fnName] = { status: "skipped", note: "Self-deploy without token — functions not redeployed. Add an access token to enable." };
      }
    }

    results.duration = Date.now() - startTime;
    // Count skipped functions — those count as "partial" not "success"
    const skippedCount = Object.values(results.functions).filter((f: any) => f?.status === "skipped").length;
    results.success = results.errors.length === 0 && skippedCount === 0;

    // Update territory record
    const mainSu = Deno.env.get("SUPABASE_URL") || "";
    const mainSk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (mainSu && mainSk && territoryId) {
      const mainDb = createClient(mainSu, mainSk);
      await mainDb.from("territories").update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: results.success ? "success" : "partial",
        last_sync_result: results,
      }).eq("id", territoryId);
    }

    // If self-deploy (no territoryId), register this instance as primary
    if (mainSu && mainSk && !territoryId && deploySchema !== false) {
      const mainDb = createClient(mainSu, mainSk);
      // Check if already exists
      const { data: existing } = await mainDb.from("territories").select("id").eq("project_ref", selfRef).limit(1);
      if (!existing || existing.length === 0) {
        await mainDb.from("territories").insert({
          name: "Veydra (Main)",
          project_ref: selfRef,
          supabase_url: mainSu,
          access_token: accessToken || "",
          last_synced_at: new Date().toISOString(),
          last_sync_status: "success",
          last_sync_result: results,
          is_primary: true,
        });
        results.selfRegistered = true;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, success: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
