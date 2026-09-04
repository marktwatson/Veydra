import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";
import { updatePortalSettingsRow } from "./portal-settings-update";
import {
  formatDisplayDate,
  DEFAULT_LOGO_URL,
  generateHTMLReceipt,
} from "./utils";

// Types matching your Supabase tables
export interface DbContractor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  tags?: string[] | null;
  specialty?: string | null;
  region?: string[] | null;
  avatar_url?: string | null;
  rating?: number | null;
  drone_approved?: boolean;
  address?: string | null;
  portfolio_url?: string | null;
  stripe_account_id?: string | null;
  venmo_handle?: string | null;
  bio?: string | null;
  gear_list?: string | null;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  training_completed?: boolean;
  insurance_url?: string | null;
  insurance_expiry?: string | null;
  contract_url?: string | null;
  contract_expiry?: string | null;
  drone_license_url?: string | null;
  drone_license_expiry?: string | null;
  contract_signature?: string | null;
  contract_signed_at?: string | null;
  review_notes?: string | null;
  w9_name?: string | null;
  w9_business_name?: string | null;
  w9_tax_classification?: string | null;
  w9_address?: string | null;
  w9_city_state_zip?: string | null;
  w9_ssn_ein?: string | null;
  w9_signature?: string | null;
  w9_signed_at?: string | null;
  interview_date?: string | null;
  gallery_requested_at?: string | null;
  created_at: string;
}

export interface DbWedding {
  id: string;
  client_name: string;
  date: string;
  partner_name?: string | null;
  location: string;
  region?: string[] | string | null;
  status: string;
  notes: string | null;
  timeline?: string | null;
  vip_names?: string | null;
  vendors?: string | null;
  special_requests?: string | null;
  questionnaire_data?: any | null;
  questionnaire_completed?: boolean;
  welcome_email_sent?: boolean;
  drive_link?: string | null;
  upload_link?: string | null;
  editing_status?: string | null;
  editor_id?: string | null;
  vimeo_link?: string | null;
  youtube_link?: string | null;
  gallery_link?: string | null;
  editing_notes?: string | null;
  revisions_notes?: string | null;
  editor_due_date?: string | null;
  editor_photo_target?: number | null;
  editor_video_targets?: string[] | null;
  editor_payout_amount?: number | null;
  editor_invoice_status?: string | null;
  editor_invoice_details?: any | null;
  created_at: string;
  jobs?: any[];
  package?: string | null;
  addons?: string[] | string | null;
  second_shooter_hours?: number | null;
  second_shooter_type?: string | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  payment_plan?: string | null;
  custom_payment_plan?: any | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_subscription_status?: string | null;
  client_email?: string | null;
  contract_date?: string | null;
  is_lgbtq?: boolean | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  refund_amount?: number | null;
  refund_processed?: boolean | null;
  refund_date?: string | null;
  cancellation_notes?: string | null;
  highlight_songs?: any[] | null;
  songs_submitted_at?: string | null;
  songs_reminder_sent_at?: string | null;
  final_payment_verified?: boolean | null;
}

export interface DbJob {
  id: string;
  wedding_id: string;
  role: string;
  pay_rate: number;
  pay_type?: "flat" | "bidding" | null;
  status: string;
  requirements: string | null;
  drone_required?: boolean;
  hours?: number | null;
  addons?: string[] | null;
  contractor_todos?: any | null;
  invited_contractors?: string[] | null;
  created_at: string;
}

export interface DbApplication {
  id: string;
  job_id: string;
  contractor_id: string;
  status: string;
  message: string | null;
  bid_amount?: number | null;
  created_at: string;
}

export interface DbAssignment {
  id: string;
  job_id: string;
  contractor_id: string;
  status: string;
  media_link?: string | null;
  file_count?: number | null;
  invoice_notes?: string | null;
  editor_rating?: number | null;
  editor_feedback?: string | null;
  client_rating?: number | null;
  client_feedback?: string | null;
  system_rating?: number | null;
  speed_rating?: number | null;
  payment_method?: string | null;
  attendance_confirmed?: boolean | null;
  attendance_confirmed_at?: string | null;
  created_at: string;
  jobs?: DbJob;
}

export interface DbNotification {
  id: string;
  contractor_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export interface DbManager {
  id: string;
  email: string;
  name: string;
  role?: string;
  status?: string;
  avatar_url?: string;
  created_at: string;
}

export interface DbEditor {
  id: string;
  email: string;
  name: string;
  status?: string;
  avatar_url?: string;
  stripe_account_id?: string | null;
  venmo_handle?: string | null;
  created_at?: string;
}

export interface DbMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface DbSmsLog {
  id: string;
  recipient_email: string;
  message: string;
  status: string;
  error_details: string | null;
  created_at: string;
}

export interface DbApiLog {
  id: string;
  endpoint: string;
  payload: string | null;
  response: string | null;
  status: string;
  error_details: string | null;
  created_at: string;
}

export interface DbActivityLog {
  id: string;
  manager_id: string;
  manager_name: string;
  action: string;
  details: string;
  created_at: string;
}

export interface DbPortalSettings {
  id: string;
  company_name?: string | null;
  app_url?: string | null;
  logo_url: string | null;
  app_icon_url?: string | null;
  invite_webhook?: string | null;
  admin_invite_webhook?: string | null;
  new_job_webhook?: string | null;
  assignment_webhook?: string | null;
  payout_webhook?: string | null;
  editor_assignment_webhook?: string | null;
  hl_api_key?: string | null;
  hl_location_id?: string | null;
  fb_access_token?: string | null;
  fb_ad_account_id?: string | null;
  excluded_campaign_ids?: string[] | null;
  manual_expenses?: any[] | null;
  regions?: string[] | null;
  timezone?: string | null;
  photo_pay_rate?: number | null;
  video_pay_rate?: number | null;
  editor_video_pricing?: any | null;
  photo_bid_min?: number | null;
  photo_bid_max?: number | null;
  video_bid_min?: number | null;
  video_bid_max?: number | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_pass?: string | null;
  smtp_from_email?: string | null;
  smtp_from_name?: string | null;
  email_delivery_method?: "webhook" | "smtp" | null;
  email_invite_enabled?: boolean | null;
  email_invite_subject?: string | null;
  email_invite_template?: string | null;
  email_reset_enabled?: boolean | null;
  email_outbid_enabled?: boolean | null;
  email_outbid_subject?: string | null;
  email_outbid_template?: string | null;
  sms_outbid_enabled?: boolean | null;
  sms_outbid_template?: string | null;
  email_reset_subject?: string | null;
  email_reset_template?: string | null;
  email_assignment_enabled?: boolean | null;
  email_assignment_subject?: string | null;
  email_assignment_template?: string | null;
  email_new_job_enabled?: boolean | null;
  email_new_job_subject?: string | null;
  email_new_job_template?: string | null;
  email_reminder_enabled?: boolean | null;
  email_reminder_subject?: string | null;
  email_reminder_template?: string | null;
  email_payout_enabled?: boolean | null;
  email_payout_subject?: string | null;
  email_payout_template?: string | null;
  email_manager_invite_enabled?: boolean | null;
  email_manager_invite_subject?: string | null;
  email_manager_invite_template?: string | null;
  email_manager_reset_enabled?: boolean | null;
  email_manager_reset_subject?: string | null;
  email_manager_reset_template?: string | null;
  email_editor_invite_enabled?: boolean | null;
  email_editor_invite_subject?: string | null;
  email_editor_invite_template?: string | null;
  email_editor_reset_enabled?: boolean | null;
  email_editor_reset_subject?: string | null;
  email_editor_reset_template?: string | null;
  email_editor_assigned_enabled?: boolean | null;
  email_editor_assigned_subject?: string | null;
  email_editor_assigned_template?: string | null;
  email_editor_raw_media_enabled?: boolean | null;
  email_editor_raw_media_subject?: string | null;
  email_editor_raw_media_template?: string | null;
  email_editor_revisions_enabled?: boolean | null;
  email_editor_revisions_subject?: string | null;
  email_editor_revisions_template?: string | null;
  email_editor_payout_enabled?: boolean | null;
  email_editor_payout_subject?: string | null;
  email_editor_payout_template?: string | null;
  sms_invite_enabled?: boolean | null;
  sms_invite_template?: string | null;
  sms_reset_enabled?: boolean | null;
  sms_reset_template?: string | null;
  sms_manager_invite_enabled?: boolean | null;
  sms_manager_invite_template?: string | null;
  sms_manager_reset_enabled?: boolean | null;
  sms_manager_reset_template?: string | null;
  sms_assignment_enabled?: boolean | null;
  sms_assignment_template?: string | null;
  sms_new_job_enabled?: boolean | null;
  sms_new_job_template?: string | null;
  sms_reminder_enabled?: boolean | null;
  sms_reminder_template?: string | null;
  sms_reminder_hours?: number | null;
  sms_contractor_prep_enabled?: boolean | null;
  sms_contractor_prep_template?: string | null;
  sms_contractor_prep_days?: number | null;
  email_contractor_prep_enabled?: boolean | null;
  email_contractor_prep_subject?: string | null;
  email_contractor_prep_template?: string | null;
  sms_payout_enabled?: boolean | null;
  sms_payout_template?: string | null;
  email_bride_welcome_enabled?: boolean | null;
  email_bride_welcome_subject?: string | null;
  email_bride_welcome_template?: string | null;
  sms_bride_welcome_enabled?: boolean | null;
  sms_bride_welcome_template?: string | null;
  sms_bride_pre_wedding_enabled?: boolean | null;
  sms_bride_pre_wedding_template?: string | null;
  sms_bride_pre_wedding_hours?: number | null;
  email_bride_pre_wedding_enabled?: boolean | null;
  email_bride_pre_wedding_subject?: string | null;
  email_bride_pre_wedding_template?: string | null;
  sms_bride_delivery_enabled?: boolean | null;
  sms_bride_delivery_template?: string | null;
  email_bride_delivery_enabled?: boolean | null;
  email_bride_delivery_subject?: string | null;
  email_bride_delivery_template?: string | null;
  sms_bride_rating_enabled?: boolean | null;
  sms_bride_rating_template?: string | null;
  email_bride_rating_enabled?: boolean | null;
  email_bride_rating_subject?: string | null;
  email_bride_rating_template?: string | null;
  sms_bride_day_after_enabled?: boolean | null;
  sms_bride_day_after_template?: string | null;
  email_bride_day_after_enabled?: boolean | null;
  email_bride_day_after_subject?: string | null;
  email_bride_day_after_template?: string | null;

  sms_bride_gift_enabled?: boolean | null;
  sms_bride_gift_template?: string | null;
  email_bride_gift_enabled?: boolean | null;
  email_bride_gift_subject?: string | null;
  email_bride_gift_template?: string | null;
  sms_editor_assigned_enabled?: boolean | null;
  sms_editor_assigned_template?: string | null;
  sms_editor_raw_media_enabled?: boolean | null;
  sms_editor_raw_media_template?: string | null;
  sms_editor_revisions_enabled?: boolean | null;
  sms_editor_revisions_template?: string | null;
  sms_editor_payout_enabled?: boolean | null;
  sms_editor_payout_template?: string | null;
  sms_admin_application_enabled?: boolean | null;
  sms_admin_application_template?: string | null;
  sms_admin_assignment_accepted_enabled?: boolean | null;
  sms_admin_assignment_accepted_template?: string | null;
  sms_admin_raw_media_enabled?: boolean | null;
  sms_admin_raw_media_template?: string | null;
  sms_admin_feedback_enabled?: boolean | null;
  sms_admin_feedback_template?: string | null;
  sms_admin_edit_completed_enabled?: boolean | null;
  sms_admin_edit_completed_template?: string | null;
  admin_notification_emails?: string | null;
  sms_admin_booking_enabled?: boolean | null;
  sms_admin_booking_template?: string | null;
  email_admin_booking_enabled?: boolean | null;
  email_admin_booking_subject?: string | null;
  email_admin_booking_template?: string | null;
  sms_editor_invite_enabled?: boolean | null;
  sms_editor_invite_template?: string | null;
  sms_editor_reset_enabled?: boolean | null;
  sms_editor_reset_template?: string | null;
  email_pipeline_enabled?: boolean | null;
  email_pipeline_subject?: string | null;
  email_pipeline_template?: string | null;
  sms_pipeline_enabled?: boolean | null;
  sms_pipeline_template?: string | null;
  email_pipeline_interview_enabled?: boolean | null;
  email_pipeline_interview_subject?: string | null;
  email_pipeline_interview_template?: string | null;
  sms_pipeline_interview_enabled?: boolean | null;
  sms_pipeline_interview_template?: string | null;
  email_pipeline_paperwork_enabled?: boolean | null;
  email_pipeline_paperwork_subject?: string | null;
  email_pipeline_paperwork_template?: string | null;
  sms_pipeline_paperwork_enabled?: boolean | null;
  sms_pipeline_paperwork_template?: string | null;
  email_pipeline_hired_enabled?: boolean | null;
  email_pipeline_hired_subject?: string | null;
  email_pipeline_hired_template?: string | null;
  sms_pipeline_hired_enabled?: boolean | null;
  sms_pipeline_hired_template?: string | null;
  email_pipeline_rejected_enabled?: boolean | null;
  email_pipeline_rejected_subject?: string | null;
  email_pipeline_rejected_template?: string | null;
  sms_pipeline_rejected_enabled?: boolean | null;
  sms_pipeline_rejected_template?: string | null;
  email_applicant_welcome_enabled?: boolean | null;
  email_applicant_welcome_subject?: string | null;
  email_applicant_welcome_template?: string | null;
  sms_applicant_welcome_enabled?: boolean | null;
  sms_applicant_welcome_template?: string | null;
  email_doc_expiry_enabled?: boolean | null;
  email_doc_expiry_subject?: string | null;
  email_doc_expiry_template?: string | null;
  sms_doc_expiry_enabled?: boolean | null;
  sms_doc_expiry_template?: string | null;
  doc_expiry_reminder_days?: number | null;
  contract_template?: string | null;
  email_pipeline_gallery_enabled?: boolean | null;
  email_pipeline_gallery_subject?: string | null;
  email_pipeline_gallery_template?: string | null;
  sms_pipeline_gallery_enabled?: boolean | null;
  sms_pipeline_gallery_template?: string | null;
  last_heartbeat_date?: string | null;
  email_payment_failed_enabled?: boolean | null;
  email_bride_cancellation_enabled?: boolean | null;
  email_bride_cancellation_subject?: string | null;
  email_bride_cancellation_template?: string | null;
  sms_bride_cancellation_enabled?: boolean | null;
  sms_bride_cancellation_template?: string | null;
  email_contractor_cancellation_enabled?: boolean | null;
  email_contractor_cancellation_subject?: string | null;
  email_contractor_cancellation_template?: string | null;
  sms_contractor_cancellation_enabled?: boolean | null;
  sms_contractor_cancellation_template?: string | null;
  email_bride_songs_enabled?: boolean | null;
  email_bride_songs_subject?: string | null;
  email_bride_songs_template?: string | null;
  sms_bride_songs_enabled?: boolean | null;
  sms_bride_songs_template?: string | null;
  upload_account_email?: string | null;
  upload_account_password?: string | null;
  upload_instructions?: string | null;
  portal_theme?: any | null;
  bartending_module_enabled?: boolean | null;
  upsell_bartending_enabled?: boolean | null;
  upsell_bartending_headline?: string | null;
  upsell_bartending_subtext?: string | null;
  upsell_bartending_packages?: any[] | null;
  upsell_bartending_email_subject?: string | null;
  upsell_bartending_email_template?: string | null;
  upsell_bartending_sms_template?: string | null;
  updated_at: string;
}

export interface DbCoupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DbBlackoutDate {
  id: string;
  contractor_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
}

// ==========================================
// API Helper Functions
// ==========================================

function parseAddons(addons: any): string[] {
  if (!addons) return [];
  if (Array.isArray(addons)) return addons;
  if (typeof addons === "string") {
    try {
      const parsed = JSON.parse(addons);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Not JSON
    }
    if (addons.startsWith("{") && addons.endsWith("}")) {
      return addons
        .slice(1, -1)
        .split(",")
        .map((s) => s.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
    }
    return addons
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseRegionsArray(regions: any): string[] {
  if (!regions) return [];
  let parsed: string[] = [];

  if (Array.isArray(regions)) {
    parsed = regions;
  } else if (typeof regions === "string") {
    try {
      const j = JSON.parse(regions);
      if (Array.isArray(j)) {
        parsed = j;
      } else {
        parsed = [regions];
      }
    } catch (e) {
      if (regions.startsWith("{") && regions.endsWith("}")) {
        parsed = regions.slice(1, -1).split(",");
      } else if (regions.includes(",")) {
        parsed = regions.split(",");
      } else {
        parsed = [regions];
      }
    }
  }

  return parsed
    .map((s) => (typeof s === "string" ? s.trim() : String(s)))
    .filter((s) => s !== "");
}

export async function getEligibleContractorsForJob(jobId: string) {
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*, weddings(location, region, date)")
    .eq("id", jobId)
    .single();
  if (jobError) throw jobError;
  if (!job) throw new Error("Job not found");

  const location = (job.weddings as any)?.location || "";
  const weddingRegions = parseRegionsArray((job.weddings as any)?.region);

  const { data: rawContractors } = await supabase
    .from("contractors")
    .select("*")
    .eq("status", "active");
  const contractors = (rawContractors || []).map((c) => ({
    ...c,
    region:
      typeof c.region === "string" ? parseRegionsArray(c.region) : c.region,
    tags: typeof c.tags === "string" ? parseRegionsArray(c.tags) : c.tags,
  })) as DbContractor[];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentNotifs } = await supabase
    .from("notifications")
    .select("contractor_id, message")
    .eq("type", "position")
    .gte("created_at", yesterday);

  const { data: blackoutDates } = await supabase
    .from("blackout_dates")
    .select("*");
  const { data: assignments } = await supabase
    .from("assignments")
    .select("contractor_id, status, jobs(weddings(date))");

  if (!contractors) return [];

  const results = contractors.map((contractor) => {
    let isEligible = true;
    let reason = "";

    const msgRole = (job.role || "").toLowerCase();
    const locLower = location.toLowerCase();

    // Check if already alerted
    const alreadySent = recentNotifs?.some((n) => {
      if (n.contractor_id !== contractor.id) return false;
      const msg = n.message.toLowerCase();
      return msg.includes(msgRole) && msg.includes(locLower);
    });

    if (alreadySent) {
      isEligible = false;
      reason = "Alerted in last 24h";
    }

    // Check Region
    let matchesRegion = false;
    const cRegions = parseRegionsArray(contractor.region);
    if (cRegions.length > 0) {
      const isAllRegions = cRegions.some(
        (r) => r.toLowerCase() === "all regions",
      );
      if (isAllRegions) {
        matchesRegion = true;
      } else if (weddingRegions.length > 0) {
        matchesRegion = cRegions.some((cr) =>
          weddingRegions.some((wr) => wr.toLowerCase() === cr.toLowerCase()),
        );
      } else {
        matchesRegion = cRegions.some((r) => {
          try {
            return new RegExp(
              `\\b${r.toLowerCase().replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`,
              "i",
            ).test(locLower);
          } catch (e) {
            return locLower.includes(r.toLowerCase());
          }
        });
      }
    } else {
      matchesRegion = false;
    }

    if (isEligible && !matchesRegion) {
      isEligible = false;
      reason = "Outside region";
    }

    // Check Specialty
    let matchesSpecialty = true;
    if (contractor.specialty) {
      const specialty = contractor.specialty.toLowerCase();
      const isBoth =
        specialty.includes("both") ||
        specialty.includes("&") ||
        specialty.includes("and") ||
        specialty.includes("/") ||
        (specialty.includes("photo") && specialty.includes("video"));

      const isPhoto = specialty.includes("photo") || isBoth;
      const isVideo = specialty.includes("video") || isBoth;
      const isContent = specialty.includes("content");

      if (msgRole.includes("photo") && !isPhoto) matchesSpecialty = false;
      if (msgRole.includes("video") && !isVideo) matchesSpecialty = false;
      if (msgRole.includes("content") && !isContent) matchesSpecialty = false;
    }

    const isPhotoOnly = msgRole.includes("photo") && !msgRole.includes("video");
    const requiresDrone = job.drone_required && !isPhotoOnly;
    if (
      requiresDrone &&
      contractor.drone_approved !== true &&
      String(contractor.drone_approved).toLowerCase() !== "true"
    ) {
      matchesSpecialty = false;
      if (isEligible) reason = "Drone required";
    } else if (!matchesSpecialty && isEligible) {
      reason = "Wrong specialty";
    }

    if (isEligible && !matchesSpecialty) {
      isEligible = false;
    }

    // Check Certification
    if (
      isEligible &&
      (contractor.training_completed === false ||
        String(contractor.training_completed).toLowerCase() === "false")
    ) {
      isEligible = false;
      reason = "Not Certified";
    }

    if (isEligible && assignments) {
      const jobDateStr = job.weddings?.date;
      const isBooked = assignments.some((a: any) => {
        if (a.contractor_id !== contractor.id) return false;
        const status = String(a.status || "")
          .trim()
          .toLowerCase();
        if (
          ![
            "upcoming",
            "accepted",
            "confirmed",
            "assigned",
            "action required",
          ].includes(status)
        )
          return false;
        const aDate = a.jobs?.weddings?.date;
        return aDate === jobDateStr;
      });
      if (isBooked) {
        isEligible = false;
        reason = "Already Booked";
      }
    }

    if (isEligible && blackoutDates) {
      const hasBlackout = blackoutDates.some((bd) => {
        if (bd.contractor_id !== contractor.id) return false;
        const jobDate = new Date(job.weddings?.date || "");

        // Ensure parsing works consistently using YYYY-MM-DD
        const [sy, sm, sd] = bd.start_date.split("-").map(Number);
        const [ey, em, ed] = bd.end_date.split("-").map(Number);

        const start = new Date(sy, sm - 1, sd);
        const end = new Date(ey, em - 1, ed);

        jobDate.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        return jobDate >= start && jobDate <= end;
      });

      if (hasBlackout) {
        isEligible = false;
        reason = "Blackout Date";
      }
    }

    return { contractor, isEligible, reason };
  });

  return results.sort((a, b) => {
    // 1. Eligible first
    if (a.isEligible && !b.isEligible) return -1;
    if (!a.isEligible && b.isEligible) return 1;

    // 2. Sort by rating (highest first)
    const ratingA = a.contractor.rating || 0;
    const ratingB = b.contractor.rating || 0;
    if (ratingA !== ratingB) {
      return ratingB - ratingA;
    }

    // 3. Sort alphabetically by name
    return (a.contractor.first_name || "").localeCompare(
      b.contractor.first_name || "",
    );
  });
}

async function sendJobAlerts(
  job: any,
  location: string,
  weddingRegionArg: any,
  date: string,
  settings: any,
  contractorIds?: string[],
) {
  const weddingRegions = parseRegionsArray(weddingRegionArg);
  const { data: rawContractors } = await supabase
    .from("contractors")
    .select("*")
    .eq("status", "active");
  const contractors = (rawContractors || []).map((c) => ({
    ...c,
    region:
      typeof c.region === "string" ? parseRegionsArray(c.region) : c.region,
    tags: typeof c.tags === "string" ? parseRegionsArray(c.tags) : c.tags,
  })) as DbContractor[];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentNotifs } = await supabase
    .from("notifications")
    .select("contractor_id, message")
    .eq("type", "position")
    .gte("created_at", yesterday);

  const { data: blackoutDates } = await supabase
    .from("blackout_dates")
    .select("*");
  const { data: assignments } = await supabase
    .from("assignments")
    .select("contractor_id, status, jobs(weddings(date))");

  let sentCount = 0;
  if (!contractors) return 0;

  for (const contractor of contractors) {
    if (contractorIds && !contractorIds.includes(contractor.id)) continue;

    const msgRole = (job.role || "").toLowerCase();
    const locLower = location.toLowerCase();

    let matchesRegion = true;
    let matchesSpecialty = true;
    let alreadySent = false;

    if (!contractorIds) {
      matchesRegion = false;
      alreadySent =
        recentNotifs?.some((n) => {
          if (n.contractor_id !== contractor.id) return false;
          const msg = n.message.toLowerCase();
          return msg.includes(msgRole) && msg.includes(locLower);
        }) || false;

      if (alreadySent) continue;

      const cRegions = parseRegionsArray(contractor.region);
      if (cRegions.length > 0) {
        const isAllRegions = cRegions.some(
          (r) => r.toLowerCase() === "all regions",
        );
        if (isAllRegions) {
          matchesRegion = true;
        } else if (weddingRegions.length > 0) {
          matchesRegion = cRegions.some((cr) =>
            weddingRegions.some((wr) => wr.toLowerCase() === cr.toLowerCase()),
          );
        } else {
          matchesRegion = cRegions.some((r) => {
            try {
              return new RegExp(
                `\\b${r.toLowerCase().replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`,
                "i",
              ).test(locLower);
            } catch (e) {
              return locLower.includes(r.toLowerCase());
            }
          });
        }
      } else {
        matchesRegion = false;
      }

      if (!contractorIds) {
        if (contractor.specialty) {
          const specialty = contractor.specialty.toLowerCase();
          const isBoth =
            specialty.includes("both") ||
            specialty.includes("&") ||
            specialty.includes("and") ||
            specialty.includes("/") ||
            (specialty.includes("photo") && specialty.includes("video"));

          const isPhoto = specialty.includes("photo") || isBoth;
          const isVideo = specialty.includes("video") || isBoth;
          const isContent = specialty.includes("content");

          if (msgRole.includes("photo") && !isPhoto) matchesSpecialty = false;
          if (msgRole.includes("video") && !isVideo) matchesSpecialty = false;
          if (msgRole.includes("content") && !isContent)
            matchesSpecialty = false;
        }

        const isPhotoOnly =
          msgRole.includes("photo") && !msgRole.includes("video");
        const requiresDrone = job.drone_required && !isPhotoOnly;
        if (
          requiresDrone &&
          contractor.drone_approved !== true &&
          String(contractor.drone_approved).toLowerCase() !== "true"
        ) {
          matchesSpecialty = false;
        }

        if (
          contractor.training_completed === false ||
          String(contractor.training_completed).toLowerCase() === "false"
        ) {
          matchesSpecialty = false; // Filter out uncertified contractors for auto-send
        }
      }
    }

    if (!contractorIds && matchesRegion && matchesSpecialty && assignments) {
      const isBooked = assignments.some((a: any) => {
        if (a.contractor_id !== contractor.id) return false;
        const status = String(a.status || "")
          .trim()
          .toLowerCase();
        if (
          ![
            "upcoming",
            "accepted",
            "confirmed",
            "assigned",
            "action required",
          ].includes(status)
        )
          return false;
        const aDate = a.jobs?.weddings?.date;
        return aDate === date;
      });
      if (isBooked) continue;
    }

    if (!contractorIds && matchesRegion && matchesSpecialty && blackoutDates) {
      const hasBlackout = blackoutDates.some((bd) => {
        if (bd.contractor_id !== contractor.id) return false;
        const jobDate = new Date(date || "");

        const [sy, sm, sd] = bd.start_date.split("-").map(Number);
        const [ey, em, ed] = bd.end_date.split("-").map(Number);

        const start = new Date(sy, sm - 1, sd);
        const end = new Date(ey, em - 1, ed);

        jobDate.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        return jobDate >= start && jobDate <= end;
      });

      if (hasBlackout) continue;
    }

    if (matchesRegion && matchesSpecialty) {
      await supabase.from("notifications").insert({
        contractor_id: contractor.id,
        title: "New Job Available",
        message: `A new ${job.role} position is open for a wedding in ${location}.`,
        type: "position",
        read: false,
      });

      if (settings?.new_job_webhook) {
        const payload = {
          event: "new_job",
          job_id: job.id,
          role: job.role,
          pay_rate: job.pay_rate,
          hours: job.hours || null,
          location: location,
          date: date,
          drone_required: job.drone_required || false,
          addons: job.addons || [],
          contractor_id: contractor.id,
          contractor_email: contractor.email,
          contractor_name: `${contractor.first_name} ${contractor.last_name}`,
          email_notifications: contractor.email_notifications !== false,
        };
        fetch(settings.new_job_webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(async (res) => {
            supabase.from("api_logs").insert({
              endpoint: "Webhook: new_job",
              payload: JSON.stringify(payload),
              response: await res.text(),
              status: res.ok ? "success" : "error",
            });
          })
          .catch((err) => {
            supabase.from("api_logs").insert({
              endpoint: "Webhook: new_job",
              payload: JSON.stringify(payload),
              response: null,
              status: "error",
              error_details: err.message,
            });
          });
      }

      if (
        settings?.sms_new_job_enabled &&
        settings?.sms_new_job_template &&
        contractor.email &&
        contractor.sms_notifications !== false
      ) {
        let msg = settings.sms_new_job_template
          .replace(/{{company_name}}/g, settings.company_name || "Veydra")
          .replace(/{{contractor_name}}/g, contractor.first_name)
          .replace(/{{role}}/g, job.role)
          .replace(/{{location}}/g, location)
          .replace(/{{date}}/g, date || "TBD")
          .replace(
            /{{portal_link}}/g,
            (settings.app_url || window.location.origin).replace(/\/$/, ""),
          );
        sendOvantaSms(
          contractor.email,
          msg,
          `${contractor.first_name} ${contractor.last_name || ""}`,
          true,
        ).catch(() => {});
      }

      if (
        settings?.email_new_job_enabled &&
        settings?.email_new_job_template &&
        contractor.email &&
        contractor.email_notifications !== false
      ) {
        let subject = (settings.email_new_job_subject || "New Job Available")
          .replace(/{{company_name}}/g, settings.company_name || "Veydra")
          .replace(/{{role}}/g, job.role)
          .replace(/{{location}}/g, location)
          .replace(/{{date}}/g, date || "TBD");
        let msg = settings.email_new_job_template
          .replace(/{{company_name}}/g, settings.company_name || "Veydra")
          .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
          .replace(/{{contractor_name}}/g, contractor.first_name)
          .replace(/{{role}}/g, job.role)
          .replace(/{{location}}/g, location)
          .replace(/{{date}}/g, date || "TBD")
          .replace(
            /{{portal_link}}/g,
            (settings.app_url || window.location.origin).replace(/\/$/, ""),
          );
        sendOvantaEmail(
          contractor.email,
          subject,
          msg,
          `${contractor.first_name} ${contractor.last_name || ""}`,
          true,
        ).catch(() => {});
      }
      sentCount++;
    }
  }
  return sentCount;
}

export async function sendOvantaSms(
  email: string,
  message: string,
  name?: string,
  force: boolean = false,
) {
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("hl_api_key, hl_location_id")
        .limit(1)
        .single();
      if (!settings?.hl_api_key || !settings?.hl_location_id) {
        throw new Error("Missing Ovanta API credentials in the database.");
      }

      // Try to find phone number in our DB
      let dbPhone = null;
      const { data: contractor } = await supabase
        .from("contractors")
        .select("phone")
        .eq("email", email)
        .maybeSingle();
      if (contractor?.phone) {
        dbPhone = contractor.phone;
      } else {
        // Try to check weddings table just in case they are a client
        const { data: wedding } = await supabase
          .from("weddings")
          .select("questionnaire_data, client_phone")
          .eq("client_email", email)
          .maybeSingle();
        if (wedding?.client_phone) {
          dbPhone = wedding.client_phone;
        } else if (wedding?.questionnaire_data?.contact_info?.phone) {
          dbPhone = wedding.questionnaire_data.contact_info.phone;
        } else if (wedding?.questionnaire_data?.contact_info?.phone_bride) {
          dbPhone = wedding.questionnaire_data.contact_info.phone_bride;
        } else if (wedding?.questionnaire_data?.contact_info?.phone_groom) {
          dbPhone = wedding.questionnaire_data.contact_info.phone_groom;
        }
      }

      const searchRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${settings.hl_api_key}`,
            Version: "2021-07-28",
          },
        },
      );

      let contactId = null;
      let existingPhone = null;

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        contactId = searchData.contacts?.[0]?.id;
        existingPhone = searchData.contacts?.[0]?.phone;
      }

      if (!contactId) {
        const createPayload: any = {
          locationId: settings.hl_location_id,
          email,
          tags: ["portal-auto-created"],
        };
        if (name) {
          const parts = name.trim().split(" ");
          createPayload.firstName = parts[0];
          if (parts.length > 1)
            createPayload.lastName = parts.slice(1).join(" ");
        }
        if (dbPhone) createPayload.phone = dbPhone;

        const createRes = await fetch(
          `https://services.leadconnectorhq.com/contacts/`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.hl_api_key}`,
              Version: "2021-07-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(createPayload),
          },
        );
        if (createRes.ok) {
          const createData = await createRes.json();
          contactId = createData.contact?.id;
        } else {
          const errData = await createRes.text();
          throw new Error(`Failed to auto-create contact in CRM: ${errData}`);
        }
      } else if (!existingPhone && dbPhone) {
        // Update existing contact with phone number
        await fetch(
          `https://services.leadconnectorhq.com/contacts/${contactId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${settings.hl_api_key}`,
              Version: "2021-07-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ phone: dbPhone }),
          },
        );
      }
      if (contactId) {
        const sendRes = await fetch(
          "https://services.leadconnectorhq.com/conversations/messages",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.hl_api_key}`,
              Version: "2021-04-15",
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              type: "SMS",
              contactId: contactId,
              message: message,
            }),
          },
        );
        if (!sendRes.ok) {
          const errData = await sendRes.text();
          if (
            errData.includes("CONVERSATIONS_MSG_NO_PHONE") ||
            errData.includes("Missing phone number")
          ) {
            throw new Error(
              `Contact does not have a phone number in the CRM or portal.`,
            );
          }
          throw new Error(`Failed to send SMS via CRM: ${errData}`);
        }
        await supabase.from("sms_logs").insert({
          recipient_email: email,
          message: message,
          status: "success",
        });
      }

      return true;
    } catch (err: any) {
      console.error(`Attempt ${attempt} failed to send Ovanta SMS:`, err);
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }
  }

  await supabase.from("sms_logs").insert({
    recipient_email: email,
    message: `FAILED: ${lastError?.message || "Unknown error"} | ${message}`,
    status: "failed",
  });
  throw lastError;
}

export async function sendOvantaEmail(
  email: string,
  subject: string,
  message: string,
  name?: string,
  force: boolean = false,
) {
  // Safeguard: detect hardcoded Ovanta/CRM URLs in email body that should be bride portal links
  const ovantaUrlPattern = /https?:\/\/app\.ovanta\.io\/[^\s"'<>]+/gi;
  if (ovantaUrlPattern.test(message)) {
    console.warn(
      "[sendOvantaEmail] WARNING: Email body contains a hardcoded Ovanta URL instead of {{portal_link}}. The bride will be sent to the CRM app instead of the Veydra bride portal. Fix the email template in Settings to use {{portal_link}}.",
    );
  }
  // Add responsive HTML wrapper for mobile devices if not already present
  let htmlContent = message;
  if (
    !htmlContent.includes("<!DOCTYPE html>") &&
    !htmlContent.includes("<html")
  ) {
    htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; }
    p { margin-bottom: 16px; }
    a { color: #0066cc; text-decoration: none; word-break: break-all; }
    a:hover { text-decoration: underline; }
    @media only screen and (max-width: 600px) {
      body { padding: 15px; font-size: 16px; }
    }
  </style>
</head>
<body>
  ${message}
</body>
</html>`;
  }

  // Minify HTML to prevent CRM outbox from breaking on multi-line tags
  htmlContent = htmlContent.replace(/\s+/g, " ").trim();

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("hl_api_key, hl_location_id")
        .limit(1)
        .single();
      if (!settings?.hl_api_key || !settings?.hl_location_id) {
        throw new Error("Missing Ovanta API credentials in the database.");
      }

      const searchRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${settings.hl_api_key}`,
            Version: "2021-07-28",
          },
        },
      );
      let contactId = null;
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        contactId = searchData.contacts?.[0]?.id;
      }
      if (!contactId) {
        const createPayload: any = {
          locationId: settings.hl_location_id,
          email,
          tags: ["portal-auto-created"],
        };
        if (name) {
          const parts = name.trim().split(" ");
          createPayload.firstName = parts[0];
          if (parts.length > 1)
            createPayload.lastName = parts.slice(1).join(" ");
        }
        const createRes = await fetch(
          `https://services.leadconnectorhq.com/contacts/`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.hl_api_key}`,
              Version: "2021-07-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(createPayload),
          },
        );
        if (createRes.ok) {
          const createData = await createRes.json();
          contactId = createData.contact?.id;
        } else {
          const errData = await createRes.text();
          throw new Error(`Failed to auto-create contact in CRM: ${errData}`);
        }
      }
      if (contactId) {
        const sendRes = await fetch(
          "https://services.leadconnectorhq.com/conversations/messages",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.hl_api_key}`,
              Version: "2021-04-15",
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              type: "Email",
              contactId: contactId,
              subject: subject,
              html: htmlContent,
              message: "Please view the HTML version of this email.",
            }),
          },
        );
        if (!sendRes.ok) {
          const errData = await sendRes.text();
          throw new Error(`Failed to send Email via CRM: ${errData}`);
        }
        await supabase.from("sms_logs").insert({
          recipient_email: email,
          message: `[EMAIL: ${subject}]\n${htmlContent}`,
          status: "success",
        });
      }

      return true;
    } catch (err: any) {
      console.error(`Attempt ${attempt} failed to send Ovanta Email:`, err);
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }
  }

  await supabase.from("sms_logs").insert({
    recipient_email: email,
    message: `FAILED: ${lastError?.message || "Unknown error"} | [EMAIL: ${subject}]`,
    status: "failed",
  });
  throw lastError;
}

// Send admin notifications to all configured admin emails
export async function sendAdminNotification(
  type:
    | "booking"
    | "application"
    | "assignment_accepted"
    | "raw_media"
    | "feedback"
    | "edit_completed",
  template: string,
  options: {
    isEmail?: boolean;
    subject?: string;
    variables?: Record<string, string>;
  } = {},
) {
  const { data: settings } = await supabase
    .from("portal_settings")
    .select("*")
    .limit(1)
    .single();
  if (!settings) return;

  const adminEmailsRaw = settings.admin_notification_emails || "";
  const adminEmails = adminEmailsRaw
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  if (adminEmails.length === 0) return;

  const companyName = settings.company_name || "Veydra";
  let message = template;
  if (options.variables) {
    for (const [key, value] of Object.entries(options.variables)) {
      message = message.replace(
        new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        value,
      );
    }
  }
  message = message.replace(/{{company_name}}/g, companyName);

  let subject = options.subject || "Admin Notification";
  if (options.variables) {
    for (const [key, value] of Object.entries(options.variables)) {
      subject = subject.replace(
        new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        value,
      );
    }
  }
  subject = subject.replace(/{{company_name}}/g, companyName);

  const results: boolean[] = [];
  for (const email of adminEmails) {
    try {
      if (options.isEmail) {
        await sendOvantaEmail(email, subject, message, "Admin", true);
      } else {
        await sendOvantaSms(email, message, "Admin", true);
      }
      results.push(true);
    } catch (e) {
      console.error(`Failed to send admin notification to ${email}:`, e);
      results.push(false);
    }
  }
  return results;
}

export const api = {
  sendAdminNotification,
  async syncContractorCRM(contractorId: string) {
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("hl_api_key, hl_location_id")
        .limit(1)
        .single();
      if (!settings?.hl_api_key || !settings?.hl_location_id) {
        throw new Error(
          "CRM credentials (API Key or Location ID) are missing in settings.",
        );
      }

      const { data: contractor } = await supabase
        .from("contractors")
        .select("*")
        .eq("id", contractorId)
        .single();
      if (!contractor) return;

      const { data: assignments } = await supabase
        .from("assignments")
        .select("status, jobs(contractor_todos, weddings(date))")
        .eq("contractor_id", contractorId)
        .in("status", [
          "Upcoming",
          "upcoming",
          "Accepted",
          "accepted",
          "Confirmed",
          "confirmed",
          "Assigned",
          "assigned",
          "Action Required",
          "action required",
        ]);

      let nextWeddingDate = "";
      let hasPendingTodos = "False";

      if (assignments && assignments.length > 0) {
        const sorted = (assignments as any[])
          .filter((a) => a.jobs?.weddings?.date)
          .sort(
            (a, b) =>
              new Date(a.jobs.weddings.date).getTime() -
              new Date(b.jobs.weddings.date).getTime(),
          );

        if (sorted.length > 0) {
          const nextAssg = sorted[0];
          nextWeddingDate = nextAssg.jobs.weddings.date.split("T")[0];

          const todos = nextAssg.jobs.contractor_todos;
          if (todos) {
            let parsedTodos = [];
            if (typeof todos === "string") {
              try {
                parsedTodos = JSON.parse(todos);
              } catch (e) {}
            } else if (Array.isArray(todos)) {
              parsedTodos = todos;
            }
            const hasIncomplete = parsedTodos.some((t: any) => !t.completed);
            if (hasIncomplete) hasPendingTodos = "True";
          }
        }
      }

      const payload: any = {
        locationId: settings.hl_location_id,
        email: contractor.email,
        firstName: contractor.first_name,
        lastName: contractor.last_name,
        phone: contractor.phone || undefined,
        website: contractor.portfolio_url || undefined,
        tags:
          hasPendingTodos === "True"
            ? ["missing-action-items"]
            : ["all-action-items-complete"],
      };

      if (
        contractor.status === "applied" ||
        contractor.status === "interview" ||
        contractor.status === "paperwork"
      ) {
        payload.tags.push("applicant");
      } else if (["active", "hired"].includes(contractor.status)) {
        payload.tags.push("contractor");
      }

      const searchRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(contractor.email)}`,
        {
          headers: {
            Authorization: `Bearer ${settings.hl_api_key}`,
            Version: "2021-07-28",
          },
        },
      );

      let contactId = null;
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        contactId = searchData.contacts?.[0]?.id;
      }

      let finalContactId = contactId;
      if (contactId) {
        const updateRes = await fetch(
          `https://services.leadconnectorhq.com/contacts/${contactId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${settings.hl_api_key}`,
              Version: "2021-07-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (!updateRes.ok) {
          const errText = await updateRes.text();
          throw new Error(`Failed to update contact: ${errText}`);
        }
      } else {
        const createRes = await fetch(
          `https://services.leadconnectorhq.com/contacts/`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.hl_api_key}`,
              Version: "2021-07-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (createRes.ok) {
          const createData = await createRes.json();
          finalContactId = createData.contact?.id;
        } else {
          const errText = await createRes.text();
          throw new Error(`Failed to create contact: ${errText}`);
        }
      }

      if (finalContactId) {
        const noteBody = `Application Info:\nSpecialty: ${contractor.specialty || "N/A"}\nRegions: ${Array.isArray(contractor.region) ? contractor.region.join(", ") : contractor.region || "N/A"}\nPortfolio: ${contractor.portfolio_url || "N/A"}\nGear List & Experience:\n${contractor.gear_list || "N/A"}`;
        const noteRes = await fetch(
          `https://services.leadconnectorhq.com/contacts/${finalContactId}/notes`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.hl_api_key}`,
              Version: "2021-07-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ body: noteBody }),
          },
        );
        if (!noteRes.ok) {
          console.error("Failed to add note:", await noteRes.text());
        }
      }
    } catch (err: any) {
      console.error("Failed to sync contractor to CRM", err);
      throw err;
    }
  },

  async executeAutomations(settings: any, now: Date) {
    console.log("Executing daily automations...");
    const todayAtMidnight = new Date(now);
    todayAtMidnight.setHours(0, 0, 0, 0);

    // 1. Contractor Reminders & Prep SMS
    const { data: assignments } = await supabase
      .from("assignments")
      .select(
        `
      *,
      jobs (id, role, contractor_todos, weddings(id, client_name, date, location)),
      contractors (id, first_name, last_name, email, sms_notifications, email_notifications)
    `,
      )
      .in("status", [
        "Upcoming",
        "upcoming",
        "Accepted",
        "accepted",
        "Confirmed",
        "confirmed",
        "Assigned",
        "assigned",
        "Action Required",
        "action required",
      ]);

    if (assignments) {
      for (const a of assignments) {
        if (!a.jobs?.weddings?.date || !a.contractors?.email) continue;

        const wDate = new Date(
          a.jobs.weddings.date.split("T")[0] + "T12:00:00",
        );
        wDate.setHours(0, 0, 0, 0);

        const diffTime = wDate.getTime() - todayAtMidnight.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Attendance Verification Check (7-day rule)
        if (diffDays <= 7 && diffDays >= 0 && !a.attendance_confirmed) {
          try {
            await this.cancelAssignmentByJobAndContractor(
              a.jobs.id,
              a.contractor_id,
            );
            const msg = `Hi ${a.contractors.first_name}, your assignment for ${a.jobs.weddings.client_name} was automatically cancelled because you did not confirm your attendance within 7 days of the wedding.`;
            await sendOvantaSms(
              a.contractors.email,
              msg,
              `${a.contractors.first_name} ${a.contractors.last_name || ""}`,
              true,
            ).catch(() => {});
            await this.logAdminActivity(
              "System Automation",
              `Automatically cancelled unconfirmed assignment for ${a.contractors.first_name} on ${a.jobs.weddings.client_name}'s wedding (7-day rule).`,
            );
            continue; // Skip other reminders for this assignment
          } catch (e) {
            console.error("Failed to process attendance cancellation:", e);
          }
        }

        // Prep SMS
        if (
          settings.sms_contractor_prep_enabled &&
          settings.sms_contractor_prep_template &&
          settings.sms_contractor_prep_days
        ) {
          let hasPendingTodos = false;
          const todos = a.jobs.contractor_todos;
          if (todos) {
            let parsedTodos = [];
            if (typeof todos === "string") {
              try {
                parsedTodos = JSON.parse(todos);
              } catch (e) {}
            } else if (Array.isArray(todos)) {
              parsedTodos = todos;
            }
            hasPendingTodos = parsedTodos.some((t: any) => !t.completed);
          }

          if (
            diffDays === settings.sms_contractor_prep_days &&
            a.contractors.sms_notifications !== false &&
            hasPendingTodos
          ) {
            let msg = settings.sms_contractor_prep_template
              .replace(/{{company_name}}/g, settings.company_name || "Veydra")
              .replace(/{{contractor_name}}/g, a.contractors.first_name)
              .replace(/{{client_name}}/g, a.jobs.weddings.client_name)
              .replace(/{{location}}/g, a.jobs.weddings.location || "TBD")
              .replace(/{{date}}/g, formatDisplayDate(a.jobs.weddings.date))
              .replace(
                /{{portal_link}}/g,
                (settings.app_url || window.location.origin).replace(/\/$/, ""),
              );

            await sendOvantaSms(
              a.contractors.email,
              msg,
              `${a.contractors.first_name} ${a.contractors.last_name || ""}`,
            ).catch(() => {});
            await this.logAdminActivity(
              "System Automation",
              `Sent ${settings.sms_contractor_prep_days}-day prep reminder to ${a.contractors.first_name} for ${a.jobs.weddings.client_name}`,
            );
          }
        }

        // Reminder SMS & Email
        if (settings.sms_reminder_hours) {
          const targetDays = Math.round(settings.sms_reminder_hours / 24);
          if (diffDays === targetDays) {
            if (
              settings.sms_reminder_enabled &&
              settings.sms_reminder_template &&
              a.contractors.sms_notifications !== false
            ) {
              let msg = settings.sms_reminder_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{contractor_name}}/g, a.contractors.first_name)
                .replace(/{{client_name}}/g, a.jobs.weddings.client_name)
                .replace(/{{location}}/g, a.jobs.weddings.location || "TBD")
                .replace(/{{date}}/g, formatDisplayDate(a.jobs.weddings.date))
                .replace(
                  /{{portal_link}}/g,
                  (settings.app_url || window.location.origin).replace(
                    /\/$/,
                    "",
                  ),
                );

              await sendOvantaSms(
                a.contractors.email,
                msg,
                `${a.contractors.first_name} ${a.contractors.last_name || ""}`,
              ).catch(() => {});
              await this.logAdminActivity(
                "System Automation",
                `Sent ${settings.sms_reminder_hours}-hour reminder SMS to ${a.contractors.first_name} for ${a.jobs.weddings.client_name}`,
              );
            }

            if (
              settings.email_reminder_enabled &&
              settings.email_reminder_template &&
              a.contractors.email_notifications !== false
            ) {
              let subject = (
                settings.email_reminder_subject || "Upcoming Job Reminder"
              )
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{client_name}}/g, a.jobs.weddings.client_name)
                .replace(/{{date}}/g, formatDisplayDate(a.jobs.weddings.date));

              let msg = settings.email_reminder_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
                .replace(/{{contractor_name}}/g, a.contractors.first_name)
                .replace(/{{client_name}}/g, a.jobs.weddings.client_name)
                .replace(/{{location}}/g, a.jobs.weddings.location || "TBD")
                .replace(/{{date}}/g, formatDisplayDate(a.jobs.weddings.date))
                .replace(
                  /{{portal_link}}/g,
                  (settings.app_url || window.location.origin).replace(
                    /\/$/,
                    "",
                  ),
                );

              await sendOvantaEmail(
                a.contractors.email,
                subject,
                msg,
                `${a.contractors.first_name} ${a.contractors.last_name || ""}`,
              ).catch(() => {});
              await this.logAdminActivity(
                "System Automation",
                `Sent ${settings.sms_reminder_hours}-hour reminder Email to ${a.contractors.first_name} for ${a.jobs.weddings.client_name}`,
              );
            }
          }
        }
      }
    }

    // 2. Bride Welcome SMS & Email is now triggered on publish (pending -> upcoming)
    // in the Weddings UI, not by this scheduled runner. The guard column
    // `welcome_email_sent` prevents double-sending. Nothing to do here.

    // 3. Bride Pre-Wedding Check-in
    if (
      settings.sms_bride_pre_wedding_enabled &&
      settings.sms_bride_pre_wedding_template &&
      settings.sms_bride_pre_wedding_hours
    ) {
      const targetDays = Math.round(settings.sms_bride_pre_wedding_hours / 24);
      const targetDateStart = new Date(now);
      targetDateStart.setDate(now.getDate() + targetDays);
      targetDateStart.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date(targetDateStart);
      targetDateEnd.setHours(23, 59, 59, 999);

      const { data: upcomingWeddings } = await supabase
        .from("weddings")
        .select("*")
        .gte("date", targetDateStart.toISOString())
        .lte("date", targetDateEnd.toISOString());

      if (upcomingWeddings) {
        for (const wedding of upcomingWeddings) {
          // Prioritize client_email (main Details email) over questionnaire email
          let brideEmail = wedding.client_email || "";
          if (!brideEmail && wedding.questionnaire_data) {
            let qData = wedding.questionnaire_data;
            if (typeof qData === "string") {
              try {
                qData = JSON.parse(qData);
              } catch (e) {}
            }
            if (qData?.contact_info?.email) {
              brideEmail = qData.contact_info.email;
            } else if (qData?.email) {
              brideEmail = qData.email;
            }
          }
          if (!brideEmail) {
            const emailMatch = wedding.notes?.match(
              /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/,
            );
            if (emailMatch) brideEmail = emailMatch[1];
          }

          if (brideEmail) {
            let msg = settings.sms_bride_pre_wedding_template
              .replace(/{{company_name}}/g, settings.company_name || "Veydra")
              .replace(/{{bride_name}}/g, wedding.client_name || "Bride");

            await sendOvantaSms(brideEmail, msg, wedding.client_name).catch(
              () => {},
            );
            await this.logAdminActivity(
              "System Automation",
              `Sent pre-wedding check-in SMS to bride ${wedding.client_name}`,
            );
          }
        }
      }
    }

    // 4. Post-Wedding Rating (2 days after)
    if (
      settings.sms_bride_rating_enabled &&
      settings.sms_bride_rating_template
    ) {
      const twoDaysAgoStart = new Date(now);
      twoDaysAgoStart.setDate(now.getDate() - 2);
      twoDaysAgoStart.setHours(0, 0, 0, 0);

      const twoDaysAgoEnd = new Date(twoDaysAgoStart);
      twoDaysAgoEnd.setHours(23, 59, 59, 999);

      const { data: pastWeddings } = await supabase
        .from("weddings")
        .select("*")
        .gte("date", twoDaysAgoStart.toISOString())
        .lte("date", twoDaysAgoEnd.toISOString())
        .neq("status", "cancelled");

      if (pastWeddings) {
        for (const wedding of pastWeddings) {
          // Prioritize client_email (main Details email) over questionnaire email
          let brideEmail = wedding.client_email || "";
          if (!brideEmail && wedding.questionnaire_data) {
            let qData = wedding.questionnaire_data;
            if (typeof qData === "string") {
              try {
                qData = JSON.parse(qData);
              } catch (e) {}
            }
            if (qData?.contact_info?.email) {
              brideEmail = qData.contact_info.email;
            } else if (qData?.email) {
              brideEmail = qData.email;
            }
          }
          if (!brideEmail) {
            const emailMatch = wedding.notes?.match(
              /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/,
            );
            if (emailMatch) brideEmail = emailMatch[1];
          }

          if (brideEmail) {
            let msg = settings.sms_bride_rating_template
              .replace(/{{company_name}}/g, settings.company_name || "Veydra")
              .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
              .replace(
                /{{feedback_link}}/g,
                `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/feedback/${wedding.id}`,
              );

            await sendOvantaSms(brideEmail, msg, wedding.client_name).catch(
              () => {},
            );
            await this.logAdminActivity(
              "System Automation",
              `Sent post-wedding rating SMS to bride ${wedding.client_name}`,
            );
          }
        }
      }
    }

    // 5. Document Expiration Reminders
    if (settings.email_doc_expiry_enabled || settings.sms_doc_expiry_enabled) {
      const { data: contractors } = await supabase
        .from("contractors")
        .select("*")
        .eq("status", "active");
      if (contractors) {
        const reminderDays = settings.doc_expiry_reminder_days || 30;
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + reminderDays);
        const targetDateStr = targetDate.toISOString().split("T")[0];

        for (const contractor of contractors) {
          const docs = [
            {
              name: "Liability Insurance",
              url: contractor.insurance_url,
              expiry: contractor.insurance_expiry,
            },
            {
              name: "Drone License",
              url: contractor.drone_license_url,
              expiry: contractor.drone_license_expiry,
            },
            {
              name: "Contractor Agreement",
              url: contractor.contract_url,
              expiry: contractor.contract_expiry,
            },
          ];

          for (const doc of docs) {
            if (doc.url && doc.expiry === targetDateStr) {
              if (
                settings.sms_doc_expiry_enabled &&
                settings.sms_doc_expiry_template &&
                contractor.sms_notifications !== false
              ) {
                let msg = settings.sms_doc_expiry_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{contractor_name}}/g, contractor.first_name)
                  .replace(/{{document_name}}/g, doc.name)
                  .replace(/{{expiry_date}}/g, formatDisplayDate(doc.expiry))
                  .replace(
                    /{{portal_link}}/g,
                    (settings.app_url || window.location.origin).replace(
                      /\/$/,
                      "",
                    ),
                  );
                await sendOvantaSms(
                  contractor.email,
                  msg,
                  `${contractor.first_name} ${contractor.last_name || ""}`,
                ).catch(() => {});
              }

              if (
                settings.email_doc_expiry_enabled &&
                settings.email_doc_expiry_template &&
                contractor.email_notifications !== false
              ) {
                let subject = (
                  settings.email_doc_expiry_subject || "Document Expiring Soon"
                )
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{document_name}}/g, doc.name);
                let msg = settings.email_doc_expiry_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(
                    /{{logo_url}}/g,
                    settings.logo_url || DEFAULT_LOGO_URL,
                  )
                  .replace(/{{contractor_name}}/g, contractor.first_name)
                  .replace(/{{document_name}}/g, doc.name)
                  .replace(/{{expiry_date}}/g, formatDisplayDate(doc.expiry))
                  .replace(
                    /{{portal_link}}/g,
                    (settings.app_url || window.location.origin).replace(
                      /\/$/,
                      "",
                    ),
                  );
                await sendOvantaEmail(
                  contractor.email,
                  subject,
                  msg,
                  `${contractor.first_name} ${contractor.last_name || ""}`,
                ).catch(() => {});
              }
              await this.logAdminActivity(
                "System Automation",
                `Sent document expiration reminder to ${contractor.first_name} for ${doc.name}`,
              );
            }
          }
        }
      }
    }
  },

  async runDailyHeartbeat() {
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (!settings) return;

      const tz = settings.timezone || "America/New_York";
      const now = new Date();

      const tzDateStr = now.toLocaleString("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const [month, day, year] = tzDateStr.split("/");
      const todayTz = `${year}-${month}-${day}`;

      const currentHourStr = now.toLocaleString("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
      });
      const currentHour = parseInt(currentHourStr, 10);

      if (settings.last_heartbeat_date === todayTz) return; // Already ran today
      if (currentHour < 9) return; // Wait until at least 9 AM in configured timezone

      const { data: updated, error } = await supabase
        .from("portal_settings")
        .update({ last_heartbeat_date: todayTz })
        .eq("id", settings.id)
        .neq("last_heartbeat_date", todayTz)
        .select()
        .maybeSingle();

      if (error || !updated) return;

      console.log("Running daily heartbeat (backup path)...");
      // The scheduler worker is now the primary notification engine. The
      // heartbeat no longer runs executeAutomations itself (which fired
      // everything at once on first login). It only kicks the worker as a
      // backup so offset notifications still send if the 10-min cron is down.
      // executeAutomations is kept for forceRunAutomations (manual testing).
      try {
        await this.runSchedulerBackup();
      } catch (e) {
        console.warn("[Heartbeat] scheduler backup failed:", e);
      }

      // Fire the daily-digest push exactly once per day. The heartbeat's
      // last_heartbeat_date guard above already ensures this whole block
      // runs at most once per calendar day, so the digest edge function is
      // called exactly once (not on every app load). Do NOT trigger the
      // digest from main.tsx — that caused duplicate pushes on every reload.
      try {
        await fetch(`${supabaseUrl}/functions/v1/daily-digest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({}),
        });
      } catch (e) {
        console.warn("[Heartbeat] daily-digest trigger failed:", e);
      }
    } catch (e) {
      console.error("Heartbeat error:", e);
    }
  },

  // Kick the scheduler worker as a backup (idempotent). The worker writes a
  // heartbeat, claims due jobs, and sends them. Safe to call on every page
  // load because dedupe_key prevents double-sends.
  async runSchedulerBackup() {
    try {
      await fetch(`${supabaseUrl}/functions/v1/scheduler`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ source: "heartbeat" }),
      });
    } catch (e) {
      // Silent — the cron is the primary driver; this is just a backup.
    }
  },

  // Manually trigger the scheduler worker (from Settings "Run scheduler now").
  async runSchedulerNow() {
    const res = await fetch(`${supabaseUrl}/functions/v1/scheduler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ source: "manual" }),
    });
    if (!res.ok) throw new Error(`Scheduler returned ${res.status}`);
    return res.json();
  },

  // Fetch upcoming scheduled jobs + heartbeat for the Settings clock card.
  async getSchedulerStatus() {
    const { supabase: sb } = await import("./supabase");
    const [hb, jobs] = await Promise.all([
      sb
        .from("scheduler_heartbeats")
        .select("last_seen_at,last_source,last_result")
        .eq("id", "default")
        .maybeSingle()
        .then(({ data, error }) => (error ? null : data)),
      sb
        .from("scheduled_jobs")
        .select("id,type,run_at,status,dedupe_key,attempts,last_error")
        .in("status", ["pending", "running"])
        .order("run_at", { ascending: true })
        .limit(10)
        .then(({ data, error }) => (error ? [] : data || [])),
    ]);
    return { heartbeat: hb, upcoming: jobs };
  },

  // Cancel all pending scheduled_jobs for a wedding so the next worker
  // backfill recreates them with the correct run_at (e.g. after a date edit
  // or publish). Idempotent — only touches pending jobs.
  async rescheduleWeddingJobs(weddingId: string) {
    try {
      const { supabase: sb } = await import("./supabase");
      await sb
        .from("scheduled_jobs")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("related_wedding_id", weddingId)
        .eq("status", "pending");
    } catch (e) {
      // Table may not exist on old snapshots — ignore.
    }
  },

  async forceRunAutomations() {
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("*")
        .limit(1)
        .single();
      if (settings) {
        await supabase
          .from("portal_settings")
          .update({ last_heartbeat_date: null })
          .eq("id", settings.id);
        await this.executeAutomations(settings, new Date());
      }
    } catch (e) {
      console.error("Force heartbeat error:", e);
      throw e;
    }
  },

  // --- Activity Logs ---
  async logAdminActivity(
    action: string,
    details: string,
    isSystem: boolean = false,
  ) {
    try {
      // Add a safety timeout to prevent hanging the UI if auth or DB is unresponsive
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Activity log timeout")),
          10000,
        );
      });

      await Promise.race([
        (async () => {
          try {
            let manager_id = null;
            let manager_name = "System";

            if (!isSystem) {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              manager_id = session?.user?.id;
              manager_name =
                session?.user?.user_metadata?.full_name || session?.user?.email;

              if (!manager_id) return; // Not logged in

              if (!manager_name) {
                const { data: manager } = await supabase
                  .from("managers")
                  .select("name")
                  .eq("id", manager_id)
                  .maybeSingle();
                if (manager) manager_name = manager.name;
              }
            }

            await supabase.from("activity_logs").insert({
              manager_id: manager_id || null,
              manager_name: manager_name || "Unknown",
              action,
              details,
            });
          } finally {
            clearTimeout(timeoutId);
          }
        })(),
        timeoutPromise,
      ]);
    } catch (e) {
      console.warn("Could not log activity", e);
    }
  },

  async getActivityLogs() {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error && error.code !== "42P01") throw error;
    if (error && error.code === "42P01") return []; // Table doesn't exist yet

    return (data || []) as DbActivityLog[];
  },

  async getSmsLogs() {
    const { data, error } = await supabase
      .from("sms_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error && error.code !== "42P01") throw error;
    if (error && error.code === "42P01") return []; // Table doesn't exist yet

    return (data || []) as DbSmsLog[];
  },

  async getApiLogs() {
    const { data, error } = await supabase
      .from("api_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error && error.code !== "42P01") throw error;
    if (error && error.code === "42P01") return [];

    return (data || []) as DbApiLog[];
  },

  async getUpcomingAutomations() {
    const upcoming: any[] = [];
    try {
      const { data: settingsRows } = await supabase
        .from("portal_settings")
        .select("*")
        .limit(1);
      const settings = settingsRows?.[0] || {};
      const now = new Date();
      const todayAtMidnight = new Date(now);
      todayAtMidnight.setHours(0, 0, 0, 0);

      // 1. Assignments (Prep & Reminders)
      const { data: assignments } = await supabase
        .from("assignments")
        .select(
          `
        *,
        jobs (id, role, contractor_todos, weddings(id, client_name, date, location)),
        contractors (id, first_name, last_name, email, sms_notifications, email_notifications)
      `,
        )
        .in("status", [
          "Upcoming",
          "upcoming",
          "Accepted",
          "accepted",
          "Confirmed",
          "confirmed",
          "Assigned",
          "assigned",
          "Action Required",
          "action required",
        ]);

      if (assignments) {
        for (const a of assignments) {
          if (!a.jobs?.weddings?.date || !a.contractors?.email) continue;

          const wDate = new Date(
            a.jobs.weddings.date.split("T")[0] + "T12:00:00",
          );
          wDate.setHours(0, 0, 0, 0);

          const diffTime = wDate.getTime() - todayAtMidnight.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 0) continue; // Already past or today

          // Prep SMS
          if (
            settings.sms_contractor_prep_enabled &&
            settings.sms_contractor_prep_template &&
            settings.sms_contractor_prep_days
          ) {
            let hasPendingTodos = false;
            const todos = a.jobs.contractor_todos;
            if (todos) {
              let parsedTodos = [];
              if (typeof todos === "string") {
                try {
                  parsedTodos = JSON.parse(todos);
                } catch (e) {}
              } else if (Array.isArray(todos)) {
                parsedTodos = parsedTodos.concat(todos);
              }
              hasPendingTodos = parsedTodos.some((t: any) => !t.completed);
            }

            if (
              diffDays >= settings.sms_contractor_prep_days &&
              a.contractors.sms_notifications !== false &&
              hasPendingTodos
            ) {
              const sendDate = new Date(wDate);
              sendDate.setDate(
                sendDate.getDate() - settings.sms_contractor_prep_days,
              );

              if (sendDate >= todayAtMidnight) {
                let msg = settings.sms_contractor_prep_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{contractor_name}}/g, a.contractors.first_name)
                  .replace(/{{client_name}}/g, a.jobs.weddings.client_name)
                  .replace(/{{location}}/g, a.jobs.weddings.location || "TBD")
                  .replace(
                    /{{date}}/g,
                    formatDisplayDate(a.jobs.weddings.date),
                  );

                upcoming.push({
                  id: `prep_${a.id}`,
                  type: "SMS",
                  recipient_email: a.contractors.email,
                  recipient_name: `${a.contractors.first_name} ${a.contractors.last_name || ""}`,
                  message: msg,
                  scheduled_for: sendDate.toISOString(),
                  description: `${settings.sms_contractor_prep_days}-day Action Item Reminder`,
                });
              }
            }
          }

          // Reminder SMS & Email
          if (settings.sms_reminder_hours) {
            const targetDays = Math.round(settings.sms_reminder_hours / 24);

            if (diffDays >= targetDays) {
              const sendDate = new Date(wDate);
              sendDate.setDate(sendDate.getDate() - targetDays);

              if (sendDate >= todayAtMidnight) {
                if (
                  settings.sms_reminder_enabled &&
                  settings.sms_reminder_template &&
                  a.contractors.sms_notifications !== false
                ) {
                  let msg = settings.sms_reminder_template
                    .replace(
                      /{{company_name}}/g,
                      settings.company_name || "Veydra",
                    )
                    .replace(/{{contractor_name}}/g, a.contractors.first_name)
                    .replace(/{{client_name}}/g, a.jobs.weddings.client_name)
                    .replace(/{{location}}/g, a.jobs.weddings.location || "TBD")
                    .replace(
                      /{{date}}/g,
                      formatDisplayDate(a.jobs.weddings.date),
                    );

                  upcoming.push({
                    id: `rem_sms_${a.id}`,
                    type: "SMS",
                    recipient_email: a.contractors.email,
                    recipient_name: `${a.contractors.first_name} ${a.contractors.last_name || ""}`,
                    message: msg,
                    scheduled_for: sendDate.toISOString(),
                    description: `${settings.sms_reminder_hours}-hour Job Reminder (SMS)`,
                  });
                }

                if (
                  settings.email_reminder_enabled &&
                  settings.email_reminder_template &&
                  a.contractors.email_notifications !== false
                ) {
                  let subject = (
                    settings.email_reminder_subject || "Upcoming Job Reminder"
                  )
                    .replace(
                      /{{company_name}}/g,
                      settings.company_name || "Veydra",
                    )
                    .replace(/{{client_name}}/g, a.jobs.weddings.client_name)
                    .replace(
                      /{{date}}/g,
                      formatDisplayDate(a.jobs.weddings.date),
                    );

                  let msg = settings.email_reminder_template
                    .replace(
                      /{{company_name}}/g,
                      settings.company_name || "Veydra",
                    )
                    .replace(
                      /{{logo_url}}/g,
                      settings.logo_url || DEFAULT_LOGO_URL,
                    )
                    .replace(/{{contractor_name}}/g, a.contractors.first_name)
                    .replace(/{{client_name}}/g, a.jobs.weddings.client_name)
                    .replace(/{{location}}/g, a.jobs.weddings.location || "TBD")
                    .replace(
                      /{{date}}/g,
                      formatDisplayDate(a.jobs.weddings.date),
                    );

                  upcoming.push({
                    id: `rem_email_${a.id}`,
                    type: "Email",
                    recipient_email: a.contractors.email,
                    recipient_name: `${a.contractors.first_name} ${a.contractors.last_name || ""}`,
                    message: `[SUBJECT: ${subject}]\n\n${msg}`,
                    scheduled_for: sendDate.toISOString(),
                    description: `${settings.sms_reminder_hours}-hour Job Reminder (Email)`,
                  });
                }
              }
            }
          }
        }
      }

      // 3. Document Expiration Reminders
      if (
        settings.email_doc_expiry_enabled ||
        settings.sms_doc_expiry_enabled
      ) {
        const { data: contractors } = await supabase
          .from("contractors")
          .select("*")
          .eq("status", "active");
        if (contractors) {
          const reminderDays = settings.doc_expiry_reminder_days || 30;

          for (const contractor of contractors) {
            const docs = [
              {
                name: "Liability Insurance",
                url: contractor.insurance_url,
                expiry: contractor.insurance_expiry,
              },
              {
                name: "Drone License",
                url: contractor.drone_license_url,
                expiry: contractor.drone_license_expiry,
              },
              {
                name: "Contractor Agreement",
                url: contractor.contract_url,
                expiry: contractor.contract_expiry,
              },
            ];

            for (const doc of docs) {
              if (doc.url && doc.expiry) {
                const expiryDate = new Date(doc.expiry + "T12:00:00");
                const sendDate = new Date(expiryDate);
                sendDate.setDate(sendDate.getDate() - reminderDays);
                sendDate.setHours(0, 0, 0, 0);

                if (sendDate >= todayAtMidnight) {
                  if (
                    settings.sms_doc_expiry_enabled &&
                    settings.sms_doc_expiry_template &&
                    contractor.sms_notifications !== false
                  ) {
                    let msg = settings.sms_doc_expiry_template
                      .replace(
                        /{{company_name}}/g,
                        settings.company_name || "Veydra",
                      )
                      .replace(/{{contractor_name}}/g, contractor.first_name)
                      .replace(/{{document_name}}/g, doc.name)
                      .replace(
                        /{{expiry_date}}/g,
                        formatDisplayDate(doc.expiry),
                      );

                    upcoming.push({
                      id: `doc_expiry_sms_${contractor.id}_${doc.name}`,
                      type: "SMS",
                      recipient_email: contractor.email,
                      recipient_name: `${contractor.first_name} ${contractor.last_name || ""}`,
                      message: msg,
                      scheduled_for: sendDate.toISOString(),
                      description: `${doc.name} Expiration Reminder (SMS)`,
                    });
                  }

                  if (
                    settings.email_doc_expiry_enabled &&
                    settings.email_doc_expiry_template &&
                    contractor.email_notifications !== false
                  ) {
                    let subject = (
                      settings.email_doc_expiry_subject ||
                      "Document Expiring Soon"
                    )
                      .replace(
                        /{{company_name}}/g,
                        settings.company_name || "Veydra",
                      )
                      .replace(/{{document_name}}/g, doc.name);
                    let msg = settings.email_doc_expiry_template
                      .replace(
                        /{{company_name}}/g,
                        settings.company_name || "Veydra",
                      )
                      .replace(
                        /{{logo_url}}/g,
                        settings.logo_url || DEFAULT_LOGO_URL,
                      )
                      .replace(/{{contractor_name}}/g, contractor.first_name)
                      .replace(/{{document_name}}/g, doc.name)
                      .replace(
                        /{{expiry_date}}/g,
                        formatDisplayDate(doc.expiry),
                      );

                    upcoming.push({
                      id: `doc_expiry_email_${contractor.id}_${doc.name}`,
                      type: "Email",
                      recipient_email: contractor.email,
                      recipient_name: `${contractor.first_name} ${contractor.last_name || ""}`,
                      message: `[SUBJECT: ${subject}]\n\n${msg}`,
                      scheduled_for: sendDate.toISOString(),
                      description: `${doc.name} Expiration Reminder (Email)`,
                    });
                  }
                }
              }
            }
          }
        }
      }

      // 2. Bride Automations
      const { data: upcomingWeddings } = await supabase
        .from("weddings")
        .select("*")
        .neq("status", "cancelled");

      if (upcomingWeddings) {
        for (const wedding of upcomingWeddings) {
          // Prioritize client_email (main Details email) over questionnaire email
          let brideEmail = wedding.client_email || "";
          if (!brideEmail && wedding.questionnaire_data) {
            let qData = wedding.questionnaire_data;
            if (typeof qData === "string") {
              try {
                qData = JSON.parse(qData);
              } catch (e) {}
            }
            if (qData?.contact_info?.email) {
              brideEmail = qData.contact_info.email;
            } else if (qData?.email) {
              brideEmail = qData.email;
            }
          }
          if (!brideEmail) {
            const emailMatch = wedding.notes?.match(
              /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/,
            );
            if (emailMatch) brideEmail = emailMatch[1];
          }

          if (!brideEmail) continue;

          // Welcome SMS & Email is now triggered on publish (pending -> upcoming)
          // in the Weddings UI, not by a scheduled automation. Nothing to preview here.

          // Pre-Wedding Check-in
          if (
            wedding.date &&
            settings.sms_bride_pre_wedding_enabled &&
            settings.sms_bride_pre_wedding_template &&
            settings.sms_bride_pre_wedding_hours
          ) {
            const wDate = new Date(wedding.date.split("T")[0] + "T12:00:00");
            wDate.setHours(0, 0, 0, 0);
            const targetDays = Math.round(
              settings.sms_bride_pre_wedding_hours / 24,
            );

            const sendDate = new Date(wDate);
            sendDate.setDate(sendDate.getDate() - targetDays);

            if (sendDate >= todayAtMidnight) {
              let msg = settings.sms_bride_pre_wedding_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride");

              upcoming.push({
                id: `bride_pre_${wedding.id}`,
                type: "SMS",
                recipient_email: brideEmail,
                recipient_name: wedding.client_name,
                message: msg,
                scheduled_for: sendDate.toISOString(),
                description: `Bride Pre-Wedding Check-in (${settings.sms_bride_pre_wedding_hours} hours before)`,
              });
            }
          }

          // Post-Wedding Rating (2 days after)
          if (
            wedding.date &&
            settings.sms_bride_rating_enabled &&
            settings.sms_bride_rating_template
          ) {
            const wDate = new Date(wedding.date.split("T")[0] + "T12:00:00");
            wDate.setHours(0, 0, 0, 0);

            const sendDate = new Date(wDate);
            sendDate.setDate(sendDate.getDate() + 2); // 2 days AFTER wedding

            if (sendDate >= todayAtMidnight) {
              let msg = settings.sms_bride_rating_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                .replace(
                  /{{feedback_link}}/g,
                  `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/feedback/${wedding.id}`,
                );

              upcoming.push({
                id: `bride_rating_${wedding.id}`,
                type: "SMS",
                recipient_email: brideEmail,
                recipient_name: wedding.client_name,
                message: msg,
                scheduled_for: sendDate.toISOString(),
                description: `Post-Wedding Feedback Request (2 days after)`,
              });
            }
          }
        }
      }

      // Sort by scheduled date
      upcoming.sort(
        (a, b) =>
          new Date(a.scheduled_for).getTime() -
          new Date(b.scheduled_for).getTime(),
      );
    } catch (e) {
      console.error("Failed to get upcoming automations:", e);
    }
    return upcoming;
  },

  async logApiEvent(
    endpoint: string,
    payload: string | null,
    response: string | null,
    status: string,
    error_details: string | null = null,
  ) {
    try {
      await supabase.from("api_logs").insert({
        endpoint,
        payload,
        response,
        status,
        error_details,
      });
    } catch (e) {
      console.warn("Failed to log API event:", e);
    }
  },

  // --- Portal Settings ---
  async getPortalSettings() {
    let settings: DbPortalSettings | null = null;
    try {
      const { data, error } = await supabase
        .from("portal_settings")
        .select("*")
        .limit(1);
      if (error && error.code !== "42P01") throw error; // Ignore table not found error
      settings = data && data.length > 0 ? (data[0] as DbPortalSettings) : null;
    } catch (e) {
      console.warn(
        "Could not fetch portal settings. Table might not exist yet.",
      );
    }

    // Parse regions and excluded_campaign_ids if string
    if (settings && typeof settings.regions === "string") {
      settings.regions = parseRegionsArray(settings.regions);
    }
    if (settings && typeof settings.excluded_campaign_ids === "string") {
      try {
        settings.excluded_campaign_ids = JSON.parse(
          settings.excluded_campaign_ids,
        );
      } catch (e) {
        settings.excluded_campaign_ids = [];
      }
    }
    if (settings && typeof settings.manual_expenses === "string") {
      try {
        settings.manual_expenses = JSON.parse(settings.manual_expenses);
      } catch (e) {
        settings.manual_expenses = [];
      }
    }

    // Fallback to local storage for regions if not found in DB
    if (!settings || !settings.regions || settings.regions.length === 0) {
      try {
        const localRegions = localStorage.getItem("veydra_regions");
        if (localRegions) {
          const parsedRegions = JSON.parse(localRegions);
          if (parsedRegions && parsedRegions.length > 0) {
            settings =
              settings ||
              ({
                id: "local",
                updated_at: new Date().toISOString(),
              } as DbPortalSettings);
            settings.regions = parsedRegions;
          }
        }
      } catch (e) {}
    }

    // Fallback to local storage for rates
    if (settings) {
      if (
        settings.photo_pay_rate === undefined ||
        settings.photo_pay_rate === null
      ) {
        try {
          const localPhotoRate = localStorage.getItem("veydra_photo_pay_rate");
          if (localPhotoRate) settings.photo_pay_rate = Number(localPhotoRate);
        } catch (e) {}
      }
      if (
        settings.video_pay_rate === undefined ||
        settings.video_pay_rate === null
      ) {
        try {
          const localVideoRate = localStorage.getItem("veydra_video_pay_rate");
          if (localVideoRate) settings.video_pay_rate = Number(localVideoRate);
        } catch (e) {}
      }
    }

    // Default fallback if still empty
    if (!settings || !settings.regions || settings.regions.length === 0) {
      settings =
        settings ||
        ({
          id: "default",
          updated_at: new Date().toISOString(),
        } as DbPortalSettings);
      settings.regions = ["Charlotte", "Raleigh"];
    }

    return settings;
  },

  async updatePortalSettings(settings: Partial<DbPortalSettings>) {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(
              "Database request timed out after 30 seconds. Please check your internet connection or Supabase status.",
            ),
          ),
        30000,
      );
    });

    const task = async () => {
      try {
        const result = await updatePortalSettingsRow(settings);
        this.logAdminActivity(
          "Updated Settings",
          "Updated portal settings",
        ).catch(console.error);
        return result;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    return Promise.race([task(), timeoutPromise]);
  },

  // --- Managers ---
  async getManagers() {
    const { data, error } = await supabase
      .from("managers")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data as DbManager[];
  },

  async addManager(manager: Omit<DbManager, "created_at">) {
    const { data, error } = await supabase
      .from("managers")
      .insert(manager)
      .select()
      .single();
    if (error) throw error;
    await this.logAdminActivity(
      "Added Admin",
      `Added new admin: ${manager.name} (${manager.email})`,
    );
    return data as DbManager;
  },

  async updateManager(id: string, updates: Partial<DbManager>) {
    const { data, error } = await supabase
      .from("managers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    await this.logAdminActivity(
      "Updated Admin",
      `Updated admin details for: ${data.name}`,
    );
    return data as DbManager;
  },

  async removeManager(id: string) {
    await supabase
      .from("messages")
      .delete()
      .or(`sender_id.eq.${id},receiver_id.eq.${id}`);
    await supabase.from("activity_logs").delete().eq("manager_id", id);
    const { error } = await supabase.from("managers").delete().eq("id", id);
    if (error) throw error;
    await this.logAdminActivity("Removed Admin", `Removed admin ID: ${id}`);
  },

  // --- Editors ---
  async getEditors() {
    const { data, error } = await supabase
      .from("editors")
      .select("*")
      .order("created_at", { ascending: true });
    if (error && error.code !== "42P01") throw error;
    if (error && error.code === "42P01") return [];
    return data as DbEditor[];
  },

  async addEditor(editor: Omit<DbEditor, "created_at">) {
    const { data, error } = await supabase
      .from("editors")
      .insert(editor)
      .select()
      .single();
    if (error) throw error;
    await this.logAdminActivity(
      "Added Editor",
      `Added new editor: ${editor.name} (${editor.email})`,
    );
    return data as DbEditor;
  },

  async updateEditor(id: string, updates: Partial<DbEditor>) {
    const { data, error } = await supabase
      .from("editors")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    await this.logAdminActivity(
      "Updated Editor",
      `Updated editor details for: ${data.name}`,
    );
    return data as DbEditor;
  },

  async removeEditor(id: string) {
    // Check if editor is assigned to any weddings and remove them first
    await supabase
      .from("weddings")
      .update({ editor_id: null })
      .eq("editor_id", id);
    await supabase
      .from("messages")
      .delete()
      .or(`sender_id.eq.${id},receiver_id.eq.${id}`);
    await supabase.from("activity_logs").delete().eq("manager_id", id);
    await supabase.from("notifications").delete().eq("contractor_id", id);

    const { error } = await supabase.from("editors").delete().eq("id", id);
    if (error) throw error;
    await this.logAdminActivity("Removed Editor", `Removed editor ID: ${id}`);
  },

  // --- Contractors ---
  async getContractors() {
    const { data, error } = await supabase
      .from("contractors")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((c) => ({
      ...c,
      region:
        typeof c.region === "string" ? parseRegionsArray(c.region) : c.region,
      tags: typeof c.tags === "string" ? parseRegionsArray(c.tags) : c.tags,
    })) as DbContractor[];
  },

  async addContractor(contractor: Omit<DbContractor, "created_at">) {
    const { data, error } = await supabase
      .from("contractors")
      .insert(contractor)
      .select()
      .single();
    if (error) throw error;
    await this.logAdminActivity(
      "Added Contractor",
      `Added new contractor: ${contractor.first_name} ${contractor.last_name}`,
    );
    return data as DbContractor;
  },

  async addContractors(contractors: Omit<DbContractor, "created_at">[]) {
    const { data, error } = await supabase
      .from("contractors")
      .insert(contractors)
      .select();
    if (error) throw error;
    await this.logAdminActivity(
      "Imported Contractors",
      `Imported ${contractors.length} new contractors`,
    );
    return data as DbContractor[];
  },

  async getContractor(id: string) {
    const { data, error } = await supabase
      .from("contractors")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return {
      ...data,
      region:
        typeof data.region === "string"
          ? parseRegionsArray(data.region)
          : data.region,
      tags:
        typeof data.tags === "string"
          ? parseRegionsArray(data.tags)
          : data.tags,
    } as DbContractor;
  },

  async completeTraining(id: string) {
    const { data, error } = await supabase
      .from("contractors")
      .update({ training_completed: true })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateContractor(id: string, updates: Partial<DbContractor>) {
    const { data, error } = await supabase
      .from("contractors")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    this.logAdminActivity(
      "Updated Contractor",
      `Updated profile for contractor: ${data.first_name} ${data.last_name}`,
    ).catch(() => {});
    return data as DbContractor;
  },

  async deleteContractor(id: string) {
    // Delete related records first to avoid foreign key constraints
    await supabase.from("blackout_dates").delete().eq("contractor_id", id);
    await supabase.from("applications").delete().eq("contractor_id", id);
    await supabase.from("assignments").delete().eq("contractor_id", id);
    await supabase.from("notifications").delete().eq("contractor_id", id);
    await supabase
      .from("messages")
      .delete()
      .or(`sender_id.eq.${id},receiver_id.eq.${id}`);

    const { error } = await supabase.from("contractors").delete().eq("id", id);
    if (error) throw error;
    await this.logAdminActivity(
      "Deleted Contractor",
      `Deleted contractor ID: ${id}`,
    );
  },

  // --- Blackout Dates ---
  async getBlackoutDates(contractor_id: string) {
    const { data, error } = await supabase
      .from("blackout_dates")
      .select("*")
      .eq("contractor_id", contractor_id)
      .order("start_date", { ascending: true });
    if (error) throw error;
    return data as DbBlackoutDate[];
  },

  async addBlackoutDate(
    blackoutDate: Omit<DbBlackoutDate, "id" | "created_at">,
  ) {
    const { data, error } = await supabase
      .from("blackout_dates")
      .insert(blackoutDate)
      .select()
      .single();
    if (error) throw error;
    return data as DbBlackoutDate;
  },

  async deleteBlackoutDate(id: string) {
    const { error } = await supabase
      .from("blackout_dates")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  // --- Weddings ---
  async getWeddings() {
    const { data, error } = await supabase
      .from("weddings")
      .select("*")
      .neq("status", "draft")
      .order("date", { ascending: true });
    if (error) throw error;

    // Parse any array/JSON fields that might come back as strings
    return (data || []).map((w) => ({
      ...w,
      region:
        typeof w.region === "string" ? parseRegionsArray(w.region) : w.region,
      editor_video_targets:
        typeof w.editor_video_targets === "string"
          ? parseRegionsArray(w.editor_video_targets)
          : w.editor_video_targets,
      questionnaire_data:
        typeof w.questionnaire_data === "string"
          ? (() => {
              try {
                return JSON.parse(w.questionnaire_data);
              } catch {
                return w.questionnaire_data;
              }
            })()
          : w.questionnaire_data,
      editor_invoice_details:
        typeof w.editor_invoice_details === "string"
          ? (() => {
              try {
                return JSON.parse(w.editor_invoice_details);
              } catch {
                return w.editor_invoice_details;
              }
            })()
          : w.editor_invoice_details,
      highlight_songs:
        typeof w.highlight_songs === "string"
          ? (() => {
              try {
                return JSON.parse(w.highlight_songs);
              } catch {
                return w.highlight_songs;
              }
            })()
          : w.highlight_songs || [],
    })) as DbWedding[];
  },

  async createWedding(
    wedding: Omit<DbWedding, "id" | "created_at">,
    syncToCrmOnCreate = false,
  ) {
    const { data, error } = await supabase
      .from("weddings")
      .insert(wedding)
      .select()
      .single();
    if (error) throw error;
    await this.logAdminActivity(
      "Added Wedding",
      `Created new wedding for: ${data.client_name}`,
    );

    // Only sync to CRM if explicitly requested (e.g. manager manually adds a confirmed wedding).
    // For bookings via /book or /proposal, the Stripe webhook handles CRM tagging AFTER payment succeeds.
    if (syncToCrmOnCreate && data.client_email) {
      try {
        const { data: settings } = await supabase
          .from("portal_settings")
          .select("hl_api_key, hl_location_id")
          .single();
        if (settings?.hl_api_key && settings?.hl_location_id) {
          const headers = {
            Authorization: `Bearer ${settings.hl_api_key}`,
            Version: "2021-07-28",
            "Content-Type": "application/json",
          };

          const searchRes = await fetch(
            `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(data.client_email)}`,
            { headers },
          );
          const searchData = await searchRes.json();
          let contactId = searchData.contacts?.[0]?.id;

          const tags = ["booked"];

          if (!contactId) {
            const createPayload: any = {
              locationId: settings.hl_location_id,
              email: data.client_email,
              name: data.client_name || "",
              tags,
            };
            if (data.client_name) {
              const parts = data.client_name.trim().split(" ");
              createPayload.firstName = parts[0];
              if (parts.length > 1)
                createPayload.lastName = parts.slice(1).join(" ");
            }
            if (wedding.notes) {
              const phoneMatch = wedding.notes.match(/Phone:\s*([^\n]+)/);
              if (phoneMatch && phoneMatch[1] !== "N/A")
                createPayload.phone = phoneMatch[1];
            }
            const createRes = await fetch(
              `https://services.leadconnectorhq.com/contacts/`,
              {
                method: "POST",
                headers,
                body: JSON.stringify(createPayload),
              },
            );
            const createData = await createRes.json();
            contactId = createData.contact?.id;
          } else {
            const existingTags = searchData.contacts?.[0]?.tags || [];
            const newTags = Array.from(new Set([...existingTags, "booked"]));
            await fetch(
              `https://services.leadconnectorhq.com/contacts/${contactId}`,
              {
                method: "PUT",
                headers,
                body: JSON.stringify({ tags: newTags }),
              },
            );
          }
        }
      } catch (e) {
        console.error("Failed to sync new wedding to CRM:", e);
      }
    }

    return data as DbWedding;
  },

  async updateWedding(id: string, updates: Partial<DbWedding>) {
    const { data: oldWedding } = await supabase
      .from("weddings")
      .select("editing_status, client_name, editor_id")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("weddings")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    const isReadyForEditor =
      data.editing_status && data.editing_status !== "awaiting_raw_media";

    if (
      oldWedding &&
      updates.editor_id !== undefined &&
      oldWedding.editor_id !== updates.editor_id &&
      updates.editor_id &&
      isReadyForEditor
    ) {
      await supabase.from("notifications").insert({
        contractor_id: updates.editor_id,
        title: "New Wedding Assigned",
        message: `You have been assigned to edit ${data.client_name}'s wedding.`,
        type: "assignment",
        read: false,
      });
      await this.logAdminActivity(
        "Assigned Editor",
        `Assigned editor to ${data.client_name}'s wedding.`,
      );

      try {
        const { data: settings } = await supabase
          .from("portal_settings")
          .select("editor_assignment_webhook")
          .limit(1)
          .maybeSingle();
        let webhookUrl = settings?.editor_assignment_webhook;
        if (!webhookUrl && typeof window !== "undefined") {
          webhookUrl = localStorage.getItem("veydra_editor_assignment_webhook");
        }

        if (webhookUrl) {
          const { data: editor } = await supabase
            .from("editors")
            .select("name, email")
            .eq("id", updates.editor_id)
            .single();
          if (editor) {
            const payload = {
              event: "editor_assigned",
              editor_id: updates.editor_id,
              editor_name: editor.name,
              editor_email: editor.email,
              wedding_id: data.id,
              wedding_name: data.client_name,
              date: data.date,
            };
            fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
              .then(async (res) => {
                supabase.from("api_logs").insert({
                  endpoint: "Webhook: editor_assigned",
                  payload: JSON.stringify(payload),
                  response: await res.text(),
                  status: res.ok ? "success" : "error",
                });
              })
              .catch((err) => {
                supabase.from("api_logs").insert({
                  endpoint: "Webhook: editor_assigned",
                  payload: JSON.stringify(payload),
                  response: null,
                  status: "error",
                  error_details: err.message,
                });
              });
          }
        }
      } catch (e) {
        console.error("Failed to trigger editor assignment webhook", e);
      }

      try {
        const { data: settings } = await supabase
          .from("portal_settings")
          .select(
            "sms_editor_assigned_enabled, sms_editor_assigned_template, email_editor_assigned_enabled, email_editor_assigned_template, email_editor_assigned_subject, company_name, logo_url, app_url",
          )
          .limit(1)
          .maybeSingle();
        const { data: editor } = await supabase
          .from("editors")
          .select("email, name")
          .eq("id", updates.editor_id)
          .single();

        if (
          editor?.email &&
          settings?.sms_editor_assigned_enabled &&
          settings?.sms_editor_assigned_template
        ) {
          let msg = settings.sms_editor_assigned_template
            .replace(/{{company_name}}/g, settings.company_name || "Veydra")
            .replace(/{{editor_name}}/g, editor.name || "Editor")
            .replace(/{{client_name}}/g, data.client_name || "Unknown")
            .replace(/{{date}}/g, data.date || "TBD")
            .replace(
              /{{portal_link}}/g,
              (settings.app_url || window.location.origin).replace(/\/$/, ""),
            );
          await sendOvantaSms(editor.email, msg, editor.name).catch(() => {});
        }

        if (
          editor?.email &&
          settings?.email_editor_assigned_enabled &&
          settings?.email_editor_assigned_template
        ) {
          let subject = (
            settings.email_editor_assigned_subject || "New Wedding Assigned"
          )
            .replace(/{{company_name}}/g, settings.company_name || "Veydra")
            .replace(/{{client_name}}/g, data.client_name || "Unknown")
            .replace(/{{date}}/g, data.date || "TBD");
          let msg = settings.email_editor_assigned_template
            .replace(/{{company_name}}/g, settings.company_name || "Veydra")
            .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
            .replace(/{{editor_name}}/g, editor.name || "Editor")
            .replace(/{{client_name}}/g, data.client_name || "Unknown")
            .replace(/{{date}}/g, data.date || "TBD")
            .replace(
              /{{portal_link}}/g,
              (settings.app_url || window.location.origin).replace(/\/$/, ""),
            );
          await sendOvantaEmail(editor.email, subject, msg, editor.name).catch(
            () => {},
          );
        }
      } catch (err) {
        console.error("Failed to trigger editor assignment notifications", err);
      }
    }

    if (updates.status === "cancelled") {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("wedding_id", id);
      if (jobs && jobs.length > 0) {
        const jobIds = jobs.map((j) => j.id);
        const { error: jErr } = await supabase
          .from("jobs")
          .update({ status: "cancelled" })
          .in("id", jobIds)
          .select();
        if (jErr) console.error("Failed to cancel jobs", jErr);
        const { error: aErr } = await supabase
          .from("assignments")
          .update({ status: "Cancelled" })
          .in("job_id", jobIds)
          .select();
        if (aErr) console.error("Failed to cancel assignments", aErr);
        const { error: appErr } = await supabase
          .from("applications")
          .update({ status: "declined" })
          .in("job_id", jobIds)
          .select();
        if (appErr) console.error("Failed to decline applications", appErr);
      }
    } else {
      // Notify assigned contractors of wedding updates
      try {
        const { data: jobs } = await supabase
          .from("jobs")
          .select("id")
          .eq("wedding_id", id);
        if (jobs && jobs.length > 0) {
          const jobIds = jobs.map((j) => j.id);
          const { data: assignments } = await supabase
            .from("assignments")
            .select("contractor_id")
            .in("job_id", jobIds)
            .in("status", [
              "Upcoming",
              "upcoming",
              "Accepted",
              "accepted",
              "Confirmed",
              "confirmed",
              "Assigned",
              "assigned",
              "Action Required",
              "action required",
            ]);
          if (assignments && assignments.length > 0) {
            const contractorIds = [
              ...new Set(assignments.map((a) => a.contractor_id)),
            ];
            for (const cid of contractorIds) {
              await supabase.from("notifications").insert({
                contractor_id: cid,
                title: "Wedding Details Updated",
                message: `The details for ${data.client_name}'s wedding have been updated. Please review the changes.`,
                type: "job",
                read: false,
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to notify contractors of wedding update", e);
      }
    }

    // Post-production status change notifications
    if (
      oldWedding &&
      updates.editing_status &&
      oldWedding.editing_status !== updates.editing_status
    ) {
      if (updates.editing_status === "delivered") {
        try {
          const { data: jobs } = await supabase
            .from("jobs")
            .select("id")
            .eq("wedding_id", id);
          if (jobs && jobs.length > 0) {
            const jobIds = jobs.map((j) => j.id);
            const { data: assignments } = await supabase
              .from("assignments")
              .select("contractor_id")
              .in("job_id", jobIds)
              .in("status", [
                "Completed",
                "Paid",
                "Payment Received",
                "Assigned",
                "Confirmed",
                "Accepted",
              ]);

            if (assignments && assignments.length > 0) {
              const contractorIds = [
                ...new Set(assignments.map((a) => a.contractor_id)),
              ];
              for (const cid of contractorIds) {
                await supabase.from("notifications").insert({
                  contractor_id: cid,
                  title: "Wedding Delivered! 🎉",
                  message: `The final media for ${data.client_name}'s wedding has been delivered. Great work!`,
                  type: "job",
                  read: false,
                });
              }
            }
          }

          // Notify Bride of Delivery & Rating
          const { data: settings } = await supabase
            .from("portal_settings")
            .select(
              "sms_bride_delivery_enabled, sms_bride_delivery_template, sms_bride_rating_enabled, sms_bride_rating_template, email_bride_delivery_enabled, email_bride_delivery_template, email_bride_delivery_subject, email_bride_rating_enabled, email_bride_rating_template, email_bride_rating_subject, company_name, logo_url, app_url",
            )
            .limit(1)
            .maybeSingle();

          // Prioritize client_email (main Details email) over questionnaire email
          let brideEmail = data.client_email || "";
          if (!brideEmail && data.questionnaire_data) {
            let qData = data.questionnaire_data;
            if (typeof qData === "string") {
              try {
                qData = JSON.parse(qData);
              } catch (e) {}
            }
            if (qData?.contact_info?.email)
              brideEmail = qData.contact_info.email;
            else if (qData?.email) brideEmail = qData.email;
          }
          if (!brideEmail) {
            const emailMatch = data.notes?.match(
              /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/,
            );
            if (emailMatch) brideEmail = emailMatch[1];
          }

          if (brideEmail && settings) {
            if (
              settings.sms_bride_delivery_enabled &&
              settings.sms_bride_delivery_template
            ) {
              let msg = settings.sms_bride_delivery_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, data.client_name || "Bride")
                .replace(
                  /{{gallery_link}}/g,
                  data.gallery_link || "your gallery link",
                )
                .replace(
                  /{{video_link}}/g,
                  data.vimeo_link || data.youtube_link || "your video link",
                );
              await sendOvantaSms(brideEmail, msg, data.client_name).catch(
                () => {},
              );
            }
            if (
              settings.email_bride_delivery_enabled &&
              settings.email_bride_delivery_template
            ) {
              let subject = (
                settings.email_bride_delivery_subject ||
                "Your Wedding Media is Ready!"
              )
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, data.client_name || "Bride");
              let msg = settings.email_bride_delivery_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
                .replace(/{{bride_name}}/g, data.client_name || "Bride")
                .replace(
                  /{{gallery_link}}/g,
                  data.gallery_link || "your gallery link",
                )
                .replace(
                  /{{video_link}}/g,
                  data.vimeo_link || data.youtube_link || "your video link",
                );
              await sendOvantaEmail(
                brideEmail,
                subject,
                msg,
                data.client_name,
              ).catch(() => {});
            }

            if (
              settings.sms_bride_rating_enabled &&
              settings.sms_bride_rating_template
            ) {
              let msg = settings.sms_bride_rating_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, data.client_name || "Bride")
                .replace(
                  /{{feedback_link}}/g,
                  `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/feedback/${data.id}`,
                );
              await sendOvantaSms(brideEmail, msg, data.client_name).catch(
                () => {},
              );
            }
            if (
              settings.email_bride_rating_enabled &&
              settings.email_bride_rating_template
            ) {
              let subject = (
                settings.email_bride_rating_subject || "How did we do?"
              )
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, data.client_name || "Bride");
              let msg = settings.email_bride_rating_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
                .replace(/{{bride_name}}/g, data.client_name || "Bride")
                .replace(
                  /{{feedback_link}}/g,
                  `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/feedback/${data.id}`,
                );
              await sendOvantaEmail(
                brideEmail,
                subject,
                msg,
                data.client_name,
              ).catch(() => {});
            }
          }
        } catch (e) {
          console.error("Failed to notify contractors/bride of delivery", e);
        }
      } else if (updates.editing_status === "ready_to_edit") {
        await this.logAdminActivity(
          "Post-Production",
          `Raw media for ${data.client_name} is now Ready to Edit.`,
        );

        if (data.editor_id) {
          try {
            const { data: settings } = await supabase
              .from("portal_settings")
              .select(
                "sms_editor_raw_media_enabled, sms_editor_raw_media_template, email_editor_raw_media_enabled, email_editor_raw_media_template, email_editor_raw_media_subject, company_name, logo_url, app_url",
              )
              .limit(1)
              .maybeSingle();
            const { data: editor } = await supabase
              .from("editors")
              .select("email, name")
              .eq("id", data.editor_id)
              .single();
            if (editor?.email) {
              if (
                settings?.sms_editor_raw_media_enabled &&
                settings?.sms_editor_raw_media_template
              ) {
                let msg = settings.sms_editor_raw_media_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{editor_name}}/g, editor.name || "Editor")
                  .replace(/{{client_name}}/g, data.client_name || "Unknown")
                  .replace(/{{date}}/g, data.date || "TBD")
                  .replace(
                    /{{portal_link}}/g,
                    (settings.app_url || window.location.origin).replace(
                      /\/$/,
                      "",
                    ),
                  );
                await sendOvantaSms(editor.email, msg, editor.name).catch(
                  () => {},
                );
              }
              if (
                settings?.email_editor_raw_media_enabled &&
                settings?.email_editor_raw_media_template
              ) {
                let subject = (
                  settings.email_editor_raw_media_subject ||
                  "Raw Media Ready to Edit"
                )
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{client_name}}/g, data.client_name || "Unknown")
                  .replace(/{{date}}/g, data.date || "TBD");
                let msg = settings.email_editor_raw_media_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(
                    /{{logo_url}}/g,
                    settings.logo_url || DEFAULT_LOGO_URL,
                  )
                  .replace(/{{editor_name}}/g, editor.name || "Editor")
                  .replace(/{{client_name}}/g, data.client_name || "Unknown")
                  .replace(/{{date}}/g, data.date || "TBD")
                  .replace(
                    /{{portal_link}}/g,
                    (settings.app_url || window.location.origin).replace(
                      /\/$/,
                      "",
                    ),
                  );
                await sendOvantaEmail(
                  editor.email,
                  subject,
                  msg,
                  editor.name,
                ).catch(() => {});
              }
            }
          } catch (e) {
            console.error("Failed to send raw media notification", e);
          }
        }
      } else {
        await this.logAdminActivity(
          "Post-Production",
          `Editing status for ${data.client_name} updated to ${updates.editing_status.replace(/_/g, " ")}.`,
        );

        if (
          updates.editing_status === "revisions_requested" &&
          data.editor_id
        ) {
          try {
            const { data: settings } = await supabase
              .from("portal_settings")
              .select(
                "sms_editor_revisions_enabled, sms_editor_revisions_template, email_editor_revisions_enabled, email_editor_revisions_template, email_editor_revisions_subject, company_name, logo_url, app_url",
              )
              .limit(1)
              .maybeSingle();
            const { data: editor } = await supabase
              .from("editors")
              .select("email, name")
              .eq("id", data.editor_id)
              .single();
            if (editor?.email) {
              if (
                settings?.sms_editor_revisions_enabled &&
                settings?.sms_editor_revisions_template
              ) {
                let msg = settings.sms_editor_revisions_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{editor_name}}/g, editor.name || "Editor")
                  .replace(/{{client_name}}/g, data.client_name || "Unknown")
                  .replace(/{{date}}/g, data.date || "TBD")
                  .replace(
                    /{{portal_link}}/g,
                    (settings.app_url || window.location.origin).replace(
                      /\/$/,
                      "",
                    ),
                  );
                await sendOvantaSms(editor.email, msg, editor.name).catch(
                  () => {},
                );
              }
              if (
                settings?.email_editor_revisions_enabled &&
                settings?.email_editor_revisions_template
              ) {
                let subject = (
                  settings.email_editor_revisions_subject ||
                  "Revisions Requested"
                )
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{client_name}}/g, data.client_name || "Unknown")
                  .replace(/{{date}}/g, data.date || "TBD");
                let msg = settings.email_editor_revisions_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(
                    /{{logo_url}}/g,
                    settings.logo_url || DEFAULT_LOGO_URL,
                  )
                  .replace(/{{editor_name}}/g, editor.name || "Editor")
                  .replace(/{{client_name}}/g, data.client_name || "Unknown")
                  .replace(/{{date}}/g, data.date || "TBD")
                  .replace(
                    /{{portal_link}}/g,
                    (settings.app_url || window.location.origin).replace(
                      /\/$/,
                      "",
                    ),
                  );
                await sendOvantaEmail(
                  editor.email,
                  subject,
                  msg,
                  editor.name,
                ).catch(() => {});
              }
            }
          } catch (e) {
            console.error("Failed to send revisions notification", e);
          }
        }
      }
    }

    await this.logAdminActivity(
      "Updated Wedding",
      `Updated details for wedding: ${data.client_name}`,
    );
    return data as DbWedding;
  },

  async deleteWedding(id: string) {
    const { data } = await supabase
      .from("weddings")
      .select("client_name")
      .eq("id", id)
      .single();

    // Explicitly delete related records to avoid foreign key constraints
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("wedding_id", id);
    if (jobs && jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id);
      await supabase.from("assignments").delete().in("job_id", jobIds);
      await supabase.from("applications").delete().in("job_id", jobIds);
      await supabase.from("jobs").delete().in("id", jobIds);
    }

    const { error } = await supabase.from("weddings").delete().eq("id", id);
    if (error) throw error;
    await this.logAdminActivity(
      "Deleted Wedding",
      `Deleted wedding: ${data?.client_name || id}`,
    );
  },

  async archiveWedding(
    id: string,
    details: {
      reason: string;
      refundAmount?: number;
      refundProcessed?: boolean;
      refundDate?: string;
      cancelledBy?: string;
      notes?: string;
      notifyContractors?: boolean;
      notifyBride?: boolean;
    },
  ) {
    const { data: wedding } = await supabase
      .from("weddings")
      .select("*")
      .eq("id", id)
      .single();
    if (!wedding) throw new Error("Wedding not found");

    // 1. Update wedding status to cancelled with cancellation metadata
    const { data, error } = await supabase
      .from("weddings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: details.cancelledBy || "manager",
        cancellation_reason: details.reason,
        refund_amount: details.refundAmount || 0,
        refund_processed: details.refundProcessed || false,
        refund_date: details.refundDate || null,
        cancellation_notes: details.notes || null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    // 2. Cancel all jobs, assignments, and applications
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("wedding_id", id);
    if (jobs && jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id);
      await supabase
        .from("jobs")
        .update({ status: "cancelled" })
        .in("id", jobIds);
      await supabase
        .from("assignments")
        .update({ status: "Cancelled" })
        .in("job_id", jobIds);
      await supabase
        .from("applications")
        .update({ status: "declined" })
        .in("job_id", jobIds);
    }

    // 3. Notify assigned contractors
    if (details.notifyContractors && jobs && jobs.length > 0) {
      try {
        const jobIds = jobs.map((j) => j.id);
        const { data: assignments } = await supabase
          .from("assignments")
          .select(
            "contractor_id, contractors(email, first_name, last_name, phone)",
          )
          .in("job_id", jobIds)
          .in("status", [
            "Cancelled",
            "Upcoming",
            "upcoming",
            "Accepted",
            "accepted",
            "Confirmed",
            "confirmed",
            "Assigned",
            "assigned",
          ]);

        if (assignments && assignments.length > 0) {
          const contractorIds = [
            ...new Set(assignments.map((a) => a.contractor_id)),
          ];
          // In-app notifications
          for (const cid of contractorIds) {
            await supabase.from("notifications").insert({
              contractor_id: cid,
              title: "Wedding Cancelled",
              message: `The wedding for ${wedding.client_name} on ${wedding.date || "TBD"} has been cancelled. You are no longer needed for this event.`,
              type: "job",
              read: false,
            });
          }
          // Email/SMS notifications
          const { data: settings } = await supabase
            .from("portal_settings")
            .select(
              "email_contractor_cancellation_enabled, email_contractor_cancellation_subject, email_contractor_cancellation_template, sms_contractor_cancellation_enabled, sms_contractor_cancellation_template, company_name, logo_url, app_url",
            )
            .limit(1)
            .maybeSingle();
          if (settings) {
            for (const a of assignments) {
              const contractor = a.contractors as any;
              if (!contractor) continue;
              const contractorName = `${contractor.first_name} ${contractor.last_name || ""}`;
              if (
                settings.email_contractor_cancellation_enabled &&
                settings.email_contractor_cancellation_template
              ) {
                const subject = (
                  settings.email_contractor_cancellation_subject ||
                  "Wedding Cancelled"
                )
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                  .replace(/{{date}}/g, wedding.date || "TBD");
                const msg = settings.email_contractor_cancellation_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(
                    /{{logo_url}}/g,
                    settings.logo_url || DEFAULT_LOGO_URL,
                  )
                  .replace(/{{contractor_name}}/g, contractorName)
                  .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                  .replace(/{{date}}/g, wedding.date || "TBD")
                  .replace(/{{reason}}/g, details.reason || "")
                  .replace(
                    /{{portal_link}}/g,
                    (settings.app_url || window.location.origin).replace(
                      /\/$/,
                      "",
                    ),
                  );
                await sendOvantaEmail(
                  contractor.email,
                  subject,
                  msg,
                  contractorName,
                  true,
                ).catch(() => {});
              }
              if (
                settings.sms_contractor_cancellation_enabled &&
                settings.sms_contractor_cancellation_template
              ) {
                const msg = settings.sms_contractor_cancellation_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{contractor_name}}/g, contractorName)
                  .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                  .replace(/{{date}}/g, wedding.date || "TBD")
                  .replace(/{{reason}}/g, details.reason || "");
                await sendOvantaSms(
                  contractor.email,
                  msg,
                  contractorName,
                  true,
                ).catch(() => {});
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to notify contractors of cancellation", e);
      }
    }

    // 4. Notify bride
    if (details.notifyBride) {
      try {
        // Prioritize client_email over questionnaire email
        let brideEmail = wedding.client_email || "";
        if (!brideEmail && wedding.questionnaire_data) {
          let qData = wedding.questionnaire_data;
          if (typeof qData === "string") {
            try {
              qData = JSON.parse(qData);
            } catch (e) {}
          }
          if (qData?.contact_info?.email) brideEmail = qData.contact_info.email;
          else if (qData?.email) brideEmail = qData.email;
        }
        if (!brideEmail) {
          const emailMatch = wedding.notes?.match(
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/,
          );
          if (emailMatch) brideEmail = emailMatch[1];
        }

        if (brideEmail) {
          const { data: settings } = await supabase
            .from("portal_settings")
            .select(
              "email_bride_cancellation_enabled, email_bride_cancellation_subject, email_bride_cancellation_template, sms_bride_cancellation_enabled, sms_bride_cancellation_template, company_name, logo_url, app_url",
            )
            .limit(1)
            .maybeSingle();
          if (settings) {
            if (
              settings.email_bride_cancellation_enabled &&
              settings.email_bride_cancellation_template
            ) {
              const subject = (
                settings.email_bride_cancellation_subject ||
                "Wedding Cancellation"
              )
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                .replace(/{{date}}/g, wedding.date || "TBD");
              const msg = settings.email_bride_cancellation_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                .replace(/{{date}}/g, wedding.date || "TBD")
                .replace(/{{reason}}/g, details.reason || "")
                .replace(
                  /{{refund_amount}}/g,
                  (details.refundAmount || 0).toFixed(2),
                )
                .replace(
                  /{{portal_link}}/g,
                  (settings.app_url || window.location.origin).replace(
                    /\/$/,
                    "",
                  ),
                );
              await sendOvantaEmail(
                brideEmail,
                subject,
                msg,
                wedding.client_name,
                true,
              ).catch(() => {});
            }
            if (
              settings.sms_bride_cancellation_enabled &&
              settings.sms_bride_cancellation_template
            ) {
              const msg = settings.sms_bride_cancellation_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                .replace(/{{date}}/g, wedding.date || "TBD")
                .replace(/{{reason}}/g, details.reason || "")
                .replace(
                  /{{refund_amount}}/g,
                  (details.refundAmount || 0).toFixed(2),
                );
              await sendOvantaSms(
                brideEmail,
                msg,
                wedding.client_name,
                true,
              ).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error("Failed to notify bride of cancellation", e);
      }
    }

    await this.logAdminActivity(
      "Cancelled Wedding",
      `Cancelled & archived wedding for ${wedding.client_name}. Reason: ${details.reason}${details.refundProcessed ? `. Refund: $${(details.refundAmount || 0).toFixed(2)}` : ""}`,
    );
    return data as DbWedding;
  },

  // --- Public Wedding Form ---
  async getPublicWedding(id: string) {
    // Note: ensure RLS allows SELECT on weddings by ID without auth
    const { data, error } = await supabase
      .from("weddings")
      .select(
        `
      id, client_name, client_email, client_phone, date, location, timeline, vip_names, vendors, special_requests, questionnaire_data, questionnaire_completed,
      gallery_link, vimeo_link, youtube_link, drive_link, upload_link, package, addons, stripe_customer_id, total_amount, paid_amount, payment_plan, custom_payment_plan, contract_date, created_at, highlight_songs, songs_submitted_at, final_payment_verified,
      jobs (
        role,
        hours,
        assignments (
          status,
          contractors (
            id,
            first_name,
            last_name,
            avatar_url,
            email,
            phone
          )
        )
      )
    `,
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return {
      ...data,
      questionnaire_data:
        typeof data.questionnaire_data === "string"
          ? (() => {
              try {
                return JSON.parse(data.questionnaire_data);
              } catch {
                return data.questionnaire_data;
              }
            })()
          : data.questionnaire_data,
      custom_payment_plan:
        typeof data.custom_payment_plan === "string"
          ? (() => {
              try {
                return JSON.parse(data.custom_payment_plan);
              } catch {
                return data.custom_payment_plan;
              }
            })()
          : data.custom_payment_plan,
      highlight_songs:
        typeof data.highlight_songs === "string"
          ? (() => {
              try {
                return JSON.parse(data.highlight_songs);
              } catch {
                return data.highlight_songs;
              }
            })()
          : data.highlight_songs || [],
    } as Partial<DbWedding>;
  },

  async getPublicWeddingTeam(weddingId: string) {
    const { data, error } = await supabase.rpc("get_public_wedding_team", {
      p_wedding_id: weddingId,
    });
    if (error) {
      console.warn("Failed to fetch team via RPC, falling back...", error);
      return [];
    }
    return data || [];
  },

  async submitWeddingQuestionnaire(id: string, updates: Partial<DbWedding>) {
    // Note: ensure RLS allows UPDATE on weddings by ID without auth
    const payload = { ...updates, questionnaire_completed: true };
    if (payload.timeline && typeof payload.timeline !== "string")
      payload.timeline = JSON.stringify(payload.timeline) as any;
    if (
      payload.questionnaire_data &&
      typeof payload.questionnaire_data !== "string"
    )
      payload.questionnaire_data = JSON.stringify(payload.questionnaire_data);

    const { data, error } = await supabase
      .from("weddings")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as DbWedding;
  },

  async saveWeddingQuestionnaireProgress(
    id: string,
    updates: Partial<DbWedding>,
  ) {
    const payload = { ...updates };
    if (payload.timeline && typeof payload.timeline !== "string")
      payload.timeline = JSON.stringify(payload.timeline) as any;
    if (
      payload.questionnaire_data &&
      typeof payload.questionnaire_data !== "string"
    )
      payload.questionnaire_data = JSON.stringify(payload.questionnaire_data);

    const { data, error } = await supabase
      .from("weddings")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as DbWedding;
  },

  async saveHighlightSongs(id: string, songs: any[]) {
    const payload: any = {
      highlight_songs: songs,
      songs_submitted_at: new Date().toISOString(),
    };
    if (Array.isArray(payload.highlight_songs))
      payload.highlight_songs = JSON.stringify(payload.highlight_songs) as any;
    const { data, error } = await supabase
      .from("weddings")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as DbWedding;
  },

  async markSongsReminderSent(id: string) {
    const { error } = await supabase
      .from("weddings")
      .update({ songs_reminder_sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  // --- Jobs ---
  async getJobs() {
    const { data, error } = await supabase
      .from("jobs")
      .select(
        `
      *,
      weddings (client_name, date, location, region, is_lgbtq),
      applications (message, status)
    `,
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((job) => {
      const addons = parseAddons(job.addons);
      const isBidding = addons.includes("PAY_TYPE:BIDDING");

      let pay_rate = job.pay_rate;
      if (
        isBidding &&
        (job.status === "filled" || job.status === "completed") &&
        (!pay_rate || pay_rate === 0)
      ) {
        if (job.applications && job.applications.length > 0) {
          const acceptedApp = job.applications.find(
            (a: any) => a.status === "awarded",
          );
          if (acceptedApp && acceptedApp.message) {
            const match = acceptedApp.message.match(/\[BID:(\d+(?:\.\d+)?)\]/);
            if (match) {
              pay_rate = parseFloat(match[1]);
            }
          }
        }
      }

      const { applications, ...jobWithoutApps } = job;

      return {
        ...jobWithoutApps,
        pay_rate,
        addons: addons.filter((a) => a !== "PAY_TYPE:BIDDING"),
        pay_type: isBidding ? "bidding" : "flat",
      };
    });
  },

  async getJobsForWedding(wedding_id: string) {
    const { data, error } = await supabase
      .from("jobs")
      .select("*, applications(message, status)")
      .eq("wedding_id", wedding_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((job) => {
      const addons = parseAddons(job.addons);
      const isBidding = addons.includes("PAY_TYPE:BIDDING");

      let pay_rate = job.pay_rate;
      if (
        isBidding &&
        (job.status === "filled" || job.status === "completed") &&
        (!pay_rate || pay_rate === 0)
      ) {
        if (job.applications && job.applications.length > 0) {
          const acceptedApp = job.applications.find(
            (a: any) => a.status === "awarded",
          );
          if (acceptedApp && acceptedApp.message) {
            const match = acceptedApp.message.match(/\[BID:(\d+(?:\.\d+)?)\]/);
            if (match) {
              pay_rate = parseFloat(match[1]);
            }
          }
        }
      }

      const { applications, ...jobWithoutApps } = job;

      return {
        ...jobWithoutApps,
        pay_rate,
        addons: addons.filter((a) => a !== "PAY_TYPE:BIDDING"),
        pay_type: isBidding ? "bidding" : "flat",
      } as DbJob;
    });
  },

  async createJob(job: Omit<DbJob, "id" | "created_at">) {
    const jobData = { ...job };
    if (jobData.pay_type === "bidding") {
      jobData.addons = [...(jobData.addons || []), "PAY_TYPE:BIDDING"];
    }
    delete jobData.pay_type;

    const { data, error } = await supabase
      .from("jobs")
      .insert(jobData)
      .select()
      .single();
    if (error) throw error;

    if (job.status === "open") {
      try {
        const { data: wedding } = await supabase
          .from("weddings")
          .select("location, region, date")
          .eq("id", job.wedding_id)
          .single();
        const location = wedding?.location || "";
        const weddingRegion = wedding?.region;
        const date = wedding?.date || "";

        const { data: settings } = await supabase
          .from("portal_settings")
          .select("*")
          .limit(1)
          .single();

        await sendJobAlerts(data, location, weddingRegion, date, settings);
      } catch (e) {
        console.error("Failed to send job alerts", e);
      }
    }

    await this.logAdminActivity(
      "Added Position",
      `Created new ${job.role} position`,
    );
    return { ...data, addons: parseAddons(data.addons) } as DbJob;
  },

  async updateJob(id: string, updates: Partial<DbJob>) {
    // First get the old job to check if status is changing TO open
    const { data: oldJob } = await supabase
      .from("jobs")
      .select("status, wedding_id")
      .eq("id", id)
      .single();

    const updateData = { ...updates };
    if (updateData.pay_type !== undefined) {
      const addons = (updateData.addons || []).filter(
        (a) => a !== "PAY_TYPE:BIDDING",
      );
      if (updateData.pay_type === "bidding") addons.push("PAY_TYPE:BIDDING");
      updateData.addons = addons;
      delete updateData.pay_type;
    }

    const { data, error } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    if (updates.status === "cancelled") {
      const { error: aErr } = await supabase
        .from("assignments")
        .update({ status: "Cancelled" })
        .eq("job_id", id)
        .select();
      if (aErr) console.error("Failed to cancel assignments", aErr);
      const { error: appErr } = await supabase
        .from("applications")
        .update({ status: "declined" })
        .eq("job_id", id)
        .select();
      if (appErr) console.error("Failed to decline applications", appErr);
    } else if (updates.status === "open") {
      await supabase
        .from("assignments")
        .update({ status: "Cancelled" })
        .eq("job_id", id)
        .neq("status", "Cancelled")
        .select();

      // If it wasn't open before, send alerts
      if (oldJob && oldJob.status !== "open") {
        try {
          const { data: wedding } = await supabase
            .from("weddings")
            .select("location, region, date")
            .eq("id", oldJob.wedding_id)
            .single();
          const location = wedding?.location || "";
          const weddingRegion = wedding?.region;
          const date = wedding?.date || "";

          const { data: settings } = await supabase
            .from("portal_settings")
            .select("*")
            .limit(1)
            .single();

          await sendJobAlerts(data, location, weddingRegion, date, settings);
        } catch (e) {
          console.error("Failed to send job alerts", e);
        }
      }
    } else if (updates.status === "filled") {
      try {
        const { data: weddingJobs } = await supabase
          .from("jobs")
          .select("status")
          .eq("wedding_id", data.wedding_id);
        const allFilledOrCancelled = weddingJobs?.every(
          (j) =>
            j.status === "filled" ||
            j.status === "completed" ||
            j.status === "cancelled",
        );

        // Decline other pending applications for THIS job specifically
        const { data: pendingAppsThisJob } = await supabase
          .from("applications")
          .select("id, contractor_id")
          .eq("job_id", id)
          .in("status", ["pending", "under_review"]);

        if (pendingAppsThisJob && pendingAppsThisJob.length > 0) {
          await supabase
            .from("applications")
            .update({ status: "not_selected" })
            .eq("job_id", id)
            .in("status", ["pending", "under_review"]);

          // Notify declined contractors
          for (const app of pendingAppsThisJob) {
            await supabase.from("notifications").insert({
              contractor_id: app.contractor_id,
              title: "Application Update",
              message: `Another contractor was selected for the ${data.role} position. Thank you for applying!`,
              type: "job",
              read: false,
            });
          }
        }

        if (allFilledOrCancelled) {
          // Find all pending applications for this wedding
          const { data: allWeddingJobs } = await supabase
            .from("jobs")
            .select("id")
            .eq("wedding_id", data.wedding_id);
          if (allWeddingJobs) {
            const jobIds = allWeddingJobs.map((j) => j.id);

            const { data: pendingAppsWedding } = await supabase
              .from("applications")
              .select("id, contractor_id")
              .in("job_id", jobIds)
              .in("status", ["pending", "under_review"]);

            if (pendingAppsWedding && pendingAppsWedding.length > 0) {
              await supabase
                .from("applications")
                .update({ status: "not_selected" })
                .in("job_id", jobIds)
                .in("status", ["pending", "under_review"]);

              // Notify declined contractors
              for (const app of pendingAppsWedding) {
                // Avoid notifying the same contractor twice if they were already notified for THIS job
                if (pendingAppsThisJob?.some((a) => a.id === app.id)) continue;

                await supabase.from("notifications").insert({
                  contractor_id: app.contractor_id,
                  title: "Application Update",
                  message: `All positions for this wedding have been filled. Thank you for applying!`,
                  type: "job",
                  read: false,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to update pending applications", e);
      }
    }

    await this.logAdminActivity(
      "Updated Position",
      `Updated details for position: ${data.role}`,
    );
    return { ...data, addons: parseAddons(data.addons) } as DbJob;
  },

  async deleteJob(id: string) {
    const { data } = await supabase
      .from("jobs")
      .select("role")
      .eq("id", id)
      .single();

    // Explicitly delete related records to avoid foreign key constraints
    await supabase.from("assignments").delete().eq("job_id", id);
    await supabase.from("applications").delete().eq("job_id", id);

    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) throw error;
    await this.logAdminActivity(
      "Deleted Position",
      `Deleted position: ${data?.role || id}`,
    );
  },

  async updateJobTodos(id: string, contractor_todos: any) {
    const { data, error } = await supabase
      .from("jobs")
      .update({ contractor_todos })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    // Trigger CRM Sync
    supabase
      .from("assignments")
      .select("contractor_id")
      .eq("job_id", id)
      .then(({ data: assignments }) => {
        if (assignments) {
          assignments.forEach((a) => {
            if (a.contractor_id)
              this.syncContractorCRM(a.contractor_id).catch(() => {});
          });
        }
      });

    return data;
  },

  async resendJobAlerts(id: string, contractorIds?: string[]) {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*, weddings(location, region, date)")
      .eq("id", id)
      .single();
    if (jobError) throw jobError;
    if (!job || job.status !== "open")
      throw new Error("Job must be open to send alerts");
    job.addons = parseAddons(job.addons);

    const location = (job.weddings as any)?.location || "";
    const weddingRegion = (job.weddings as any)?.region;
    const date = (job.weddings as any)?.date || "";
    const { data: settings } = await supabase
      .from("portal_settings")
      .select("*")
      .limit(1)
      .single();

    // If contractors were manually selected, add them to the invited_contractors list
    if (contractorIds && contractorIds.length > 0) {
      const currentInvited = Array.isArray(job.invited_contractors)
        ? job.invited_contractors
        : [];
      const newInvited = Array.from(
        new Set([...currentInvited, ...contractorIds]),
      );
      const { error: updateError } = await supabase
        .from("jobs")
        .update({ invited_contractors: newInvited })
        .eq("id", id);
      if (updateError)
        console.error(
          "Failed to update invited_contractors, column might be missing:",
          updateError,
        );
    }

    return await sendJobAlerts(
      job,
      location,
      weddingRegion,
      date,
      settings,
      contractorIds,
    );
  },

  // --- Applications ---
  async getApplications() {
    const { data, error } = await supabase
      .from("applications")
      .select(
        `
      *,
      jobs (id, status, role, pay_rate, hours, addons, weddings(client_name, date, location, region, timeline, vip_names, vendors, special_requests, questionnaire_data, questionnaire_completed, is_lgbtq)),
      contractors (id, first_name, last_name, email, rating, specialty, region)
    `,
      )
      .order("created_at", { ascending: false });
    if (error) throw error;

    return (data || []).map((app) => {
      let bid_amount = null;
      let message = app.message;
      if (message) {
        const match = message.match(/\[BID:(\d+(?:\.\d+)?)\]/);
        if (match) {
          bid_amount = parseFloat(match[1]);
          message = message.replace(/\[BID:\d+(?:\.\d+)?\]\s*/, "").trim();
        }
      }

      if (app.jobs) {
        const addons = parseAddons(app.jobs.addons);
        const isBidding = addons.includes("PAY_TYPE:BIDDING");
        app.jobs.addons = addons.filter((a) => a !== "PAY_TYPE:BIDDING");
        app.jobs.pay_type = isBidding ? "bidding" : "flat";
      }
      return { ...app, message, bid_amount };
    });
  },

  async checkAndNotifyOutbid(
    job_id: string,
    new_bid: number,
    new_bidder_id: string,
  ) {
    const { data: apps } = await supabase
      .from("applications")
      .select("id, contractor_id, message")
      .eq("job_id", job_id)
      .neq("status", "declined")
      .neq("status", "not_selected");
    if (!apps) return;

    let settings: any = null;
    try {
      const { data } = await supabase
        .from("portal_settings")
        .select(
          "sms_outbid_enabled, sms_outbid_template, email_outbid_enabled, email_outbid_template, email_outbid_subject, company_name, logo_url, app_url",
        )
        .limit(1)
        .maybeSingle();
      settings = data;
    } catch (e) {}

    for (const a of apps) {
      if (a.contractor_id === new_bidder_id) continue;
      const match = a.message?.match(/\[BID:(\d+(?:\.\d+)?)\]/);
      if (match) {
        const theirBid = parseFloat(match[1]);
        if (theirBid > new_bid) {
          await supabase.from("notifications").insert({
            contractor_id: a.contractor_id,
            title: "You've been outbid!",
            message: `Someone has placed a lower bid ($${new_bid}) on a job you applied for. Update your bid if you still want the position!`,
            type: "job",
            read: false,
          });

          try {
            const { data: contractor } = await supabase
              .from("contractors")
              .select(
                "email, first_name, last_name, sms_notifications, email_notifications",
              )
              .eq("id", a.contractor_id)
              .single();
            if (contractor?.email) {
              if (
                settings?.sms_outbid_enabled &&
                settings?.sms_outbid_template &&
                contractor.sms_notifications !== false
              ) {
                let msg = settings.sms_outbid_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(/{{contractor_name}}/g, contractor.first_name)
                  .replace(/{{new_bid}}/g, new_bid.toString())
                  .replace(
                    /{{portal_link}}/g,
                    (settings.app_url || window.location.origin).replace(
                      /\/$/,
                      "",
                    ),
                  );
                await sendOvantaSms(
                  contractor.email,
                  msg,
                  `${contractor.first_name} ${contractor.last_name || ""}`,
                  true,
                );
              } else if (
                contractor.sms_notifications !== false &&
                !settings?.sms_outbid_template
              ) {
                const msg = `Hi ${contractor.first_name}, someone has placed a lower bid ($${new_bid}) on a job you applied for. Update your bid in the portal if you still want the position!`;
                await sendOvantaSms(
                  contractor.email,
                  msg,
                  `${contractor.first_name} ${contractor.last_name || ""}`,
                  true,
                );
              }

              if (
                settings?.email_outbid_enabled &&
                settings?.email_outbid_template &&
                contractor.email_notifications !== false
              ) {
                let subject = (
                  settings.email_outbid_subject || "You've been outbid!"
                ).replace(
                  /{{company_name}}/g,
                  settings.company_name || "Veydra",
                );
                let msg = settings.email_outbid_template
                  .replace(
                    /{{company_name}}/g,
                    settings.company_name || "Veydra",
                  )
                  .replace(
                    /{{logo_url}}/g,
                    settings.logo_url || DEFAULT_LOGO_URL,
                  )
                  .replace(/{{contractor_name}}/g, contractor.first_name)
                  .replace(/{{new_bid}}/g, new_bid.toString())
                  .replace(
                    /{{portal_link}}/g,
                    (settings.app_url || window.location.origin).replace(
                      /\/$/,
                      "",
                    ),
                  );
                await sendOvantaEmail(
                  contractor.email,
                  subject,
                  msg,
                  `${contractor.first_name} ${contractor.last_name || ""}`,
                  true,
                );
              }
            }
          } catch (e) {
            console.error("Failed to send outbid notification", e);
          }
        }
      }
    }
  },

  async sendBidReceivedSms(
    contractor_id: string,
    job_id: string,
    bid_amount: number,
  ) {
    try {
      const { data: contractor } = await supabase
        .from("contractors")
        .select("email, first_name, last_name, sms_notifications")
        .eq("id", contractor_id)
        .single();
      if (contractor?.email && contractor.sms_notifications !== false) {
        const { data: job } = await supabase
          .from("jobs")
          .select("role, weddings(location)")
          .eq("id", job_id)
          .single();
        const location = (job?.weddings as any)?.location || "the location";
        const role = job?.role || "job";
        const msg = `Hi ${contractor.first_name}, your bid of $${bid_amount} for the ${role} position in ${location} has been received! We'll let you know if you're selected.`;
        await sendOvantaSms(
          contractor.email,
          msg,
          `${contractor.first_name} ${contractor.last_name || ""}`,
        );
      }
    } catch (e) {
      console.error("Failed to send bid received SMS", e);
    }
  },

  async applyForJob(
    application: Omit<DbApplication, "id" | "created_at" | "status">,
  ) {
    const appData = { ...application };
    let bidAmount = appData.bid_amount;
    if (appData.bid_amount != null) {
      appData.message =
        `[BID:${appData.bid_amount}] ${appData.message || ""}`.trim();
      delete appData.bid_amount;
    }

    const { data, error } = await supabase
      .from("applications")
      .insert({
        ...appData,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw error;

    if (bidAmount != null) {
      this.checkAndNotifyOutbid(
        application.job_id,
        bidAmount,
        application.contractor_id,
      ).catch(console.error);
      this.sendBidReceivedSms(
        application.contractor_id,
        application.job_id,
        bidAmount,
      ).catch(console.error);
    }

    return data as DbApplication;
  },

  async updateApplicationBid(id: string, bid_amount: number) {
    const { data: app } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .single();
    if (!app) throw new Error("Application not found");

    let oldMessage = app.message || "";
    oldMessage = oldMessage.replace(/\[BID:\d+(?:\.\d+)?\]\s*/, "").trim();
    const newMessage = `[BID:${bid_amount}] ${oldMessage}`.trim();

    let resultData;
    const { data, error } = await supabase
      .from("applications")
      .update({
        message: newMessage,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.warn("Update failed, attempting delete/insert fallback", error);
      await supabase.from("applications").delete().eq("id", id);
      const { data: newData, error: insertError } = await supabase
        .from("applications")
        .insert({
          job_id: app.job_id,
          contractor_id: app.contractor_id,
          status: app.status,
          message: newMessage,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      resultData = newData;
    } else {
      resultData = data;
    }

    if (app.job_id) {
      this.checkAndNotifyOutbid(
        app.job_id,
        bid_amount,
        app.contractor_id,
      ).catch(console.error);
      this.sendBidReceivedSms(app.contractor_id, app.job_id, bid_amount).catch(
        console.error,
      );
    }

    return resultData as DbApplication;
  },

  async withdrawApplication(id: string) {
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) throw error;
  },

  async updateApplicationStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    await this.logAdminActivity(
      "Updated Application",
      `Set application ${id} status to ${status}`,
    );
    return data as DbApplication;
  },

  // --- Assignments ---
  async getAssignments() {
    const { data, error } = await supabase
      .from("assignments")
      .select(
        `
      *,
      jobs (id, status, role, pay_rate, hours, addons, contractor_todos, wedding_id, weddings(client_name, date, location, region, timeline, vip_names, vendors, special_requests, questionnaire_data, questionnaire_completed, drive_link, upload_link, is_lgbtq), applications(message, status)),
      contractors (first_name, last_name, email, venmo_handle, stripe_account_id)
    `,
      )
      .order("created_at", { ascending: false });
    if (error) throw error;

    return (data || []).map((assignment) => {
      if (assignment.jobs) {
        const addons = parseAddons(assignment.jobs.addons);
        const isBidding = addons.includes("PAY_TYPE:BIDDING");

        let pay_rate = assignment.jobs.pay_rate;
        if (isBidding && (!pay_rate || pay_rate === 0)) {
          if (
            assignment.jobs.applications &&
            assignment.jobs.applications.length > 0
          ) {
            const acceptedApp = assignment.jobs.applications.find(
              (a: any) => a.status === "awarded",
            );
            if (acceptedApp && acceptedApp.message) {
              const match = acceptedApp.message.match(
                /\[BID:(\d+(?:\.\d+)?)\]/,
              );
              if (match) {
                pay_rate = parseFloat(match[1]);
              }
            }
          }
        }

        const { applications, ...jobWithoutApps } = assignment.jobs;

        assignment.jobs = {
          ...jobWithoutApps,
          pay_rate,
          addons: addons.filter((a) => a !== "PAY_TYPE:BIDDING"),
          pay_type: isBidding ? "bidding" : "flat",
        };
      }
      return assignment;
    });
  },

  async getAssignment(id: string) {
    const { data, error } = await supabase
      .from("assignments")
      .select(
        `
      *,
      jobs (id, status, role, pay_rate, hours, addons, contractor_todos, wedding_id, weddings(client_name, date, location, region, timeline, vip_names, vendors, special_requests, questionnaire_data, questionnaire_completed, drive_link, upload_link), applications(message, status)),
      contractors (first_name, last_name, email, avatar_url, venmo_handle, stripe_account_id)
    `,
      )
      .eq("id", id)
      .single();
    if (error) throw error;

    if (data.jobs) {
      const addons = parseAddons(data.jobs.addons);
      const isBidding = addons.includes("PAY_TYPE:BIDDING");

      let pay_rate = data.jobs.pay_rate;
      if (isBidding && (!pay_rate || pay_rate === 0)) {
        if (data.jobs.applications && data.jobs.applications.length > 0) {
          const acceptedApp = data.jobs.applications.find(
            (a: any) => a.status === "awarded",
          );
          if (acceptedApp && acceptedApp.message) {
            const match = acceptedApp.message.match(/\[BID:(\d+(?:\.\d+)?)\]/);
            if (match) {
              pay_rate = parseFloat(match[1]);
            }
          }
        }
      }

      const { applications, ...jobWithoutApps } = data.jobs;

      data.jobs = {
        ...jobWithoutApps,
        pay_rate,
        addons: addons.filter((a) => a !== "PAY_TYPE:BIDDING"),
        pay_type: isBidding ? "bidding" : "flat",
      };
    }
    return data;
  },

  async createAssignment(assignment: Omit<DbAssignment, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("assignments")
      .insert(assignment)
      .select()
      .single();
    if (error) throw error;

    if (data.contractor_id) {
      // Get job info for the notification and failsafe
      const { data: job } = await supabase
        .from("jobs")
        .select("role, wedding_id")
        .eq("id", data.job_id)
        .single();
      const role = job?.role || "job";

      let location = "a location";
      let date = "TBD";

      if (job?.wedding_id) {
        try {
          const { data: wedding } = await supabase
            .from("weddings")
            .select("location, date")
            .eq("id", job.wedding_id)
            .single();
          if (wedding) {
            location = wedding.location || location;
            date = wedding.date || date;
          }
        } catch (e) {
          console.error("Failed to fetch wedding details for assignment", e);
        }
      }

      // FAILSAFE: If assigned to a job, decline their other pending applications for this same wedding
      if (job?.wedding_id) {
        try {
          const { data: weddingJobs } = await supabase
            .from("jobs")
            .select("id")
            .eq("wedding_id", job.wedding_id);
          if (weddingJobs && weddingJobs.length > 0) {
            const jobIds = weddingJobs.map((j) => j.id);
            await supabase
              .from("applications")
              .update({ status: "not_selected" })
              .eq("contractor_id", data.contractor_id)
              .in("job_id", jobIds)
              .in("status", ["pending", "under_review"]);
          }
        } catch (e) {
          console.error("Failed to execute application failsafe", e);
        }
      }

      await supabase.from("notifications").insert({
        contractor_id: data.contractor_id,
        title: "New Assignment",
        message: `You have been assigned to a new ${role} position in ${location}.`,
        type: "assignment",
        read: false,
      });

      // Send SMS and Email via Ovanta
      try {
        const { data: settings } = await supabase
          .from("portal_settings")
          .select(
            "sms_assignment_enabled, sms_assignment_template, email_assignment_enabled, email_assignment_template, email_assignment_subject, company_name, logo_url, app_url",
          )
          .limit(1)
          .maybeSingle();
        const { data: contractor } = await supabase
          .from("contractors")
          .select(
            "email, first_name, last_name, sms_notifications, email_notifications",
          )
          .eq("id", data.contractor_id)
          .single();

        if (
          contractor?.email &&
          settings?.sms_assignment_enabled &&
          settings?.sms_assignment_template &&
          contractor.sms_notifications !== false
        ) {
          let msg = settings.sms_assignment_template
            .replace(/{{company_name}}/g, settings.company_name || "Veydra")
            .replace(/{{contractor_name}}/g, contractor.first_name)
            .replace(/{{role}}/g, role)
            .replace(/{{location}}/g, location)
            .replace(/{{date}}/g, date)
            .replace(
              /{{portal_link}}/g,
              (settings.app_url || window.location.origin).replace(/\/$/, ""),
            );

          await sendOvantaSms(
            contractor.email,
            msg,
            `${contractor.first_name} ${contractor.last_name || ""}`,
          );
        }

        if (
          contractor?.email &&
          settings?.email_assignment_enabled &&
          settings?.email_assignment_template &&
          contractor.email_notifications !== false
        ) {
          let subject = (settings.email_assignment_subject || "New Assignment")
            .replace(/{{company_name}}/g, settings.company_name || "Veydra")
            .replace(/{{role}}/g, role)
            .replace(/{{location}}/g, location)
            .replace(/{{date}}/g, date);
          let msg = settings.email_assignment_template
            .replace(/{{company_name}}/g, settings.company_name || "Veydra")
            .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
            .replace(/{{contractor_name}}/g, contractor.first_name)
            .replace(/{{role}}/g, role)
            .replace(/{{location}}/g, location)
            .replace(/{{date}}/g, date)
            .replace(
              /{{portal_link}}/g,
              (settings.app_url || window.location.origin).replace(/\/$/, ""),
            );

          await sendOvantaEmail(
            contractor.email,
            subject,
            msg,
            `${contractor.first_name} ${contractor.last_name || ""}`,
          );
        }
      } catch (err) {
        console.error("Failed to trigger assignment notifications", err);
      }
    }

    if (data?.contractor_id) {
      this.syncContractorCRM(data.contractor_id).catch(() => {});
    }

    return data as DbAssignment;
  },

  async updateAssignment(id: string, updates: Partial<DbAssignment>) {
    const { data, error } = await supabase
      .from("assignments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as DbAssignment;
  },

  async updateAssignmentStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from("assignments")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    if (status === "Cancelled" && data?.job_id) {
      await supabase
        .from("jobs")
        .update({ status: "open" })
        .eq("id", data.job_id)
        .select();

      if (data.contractor_id) {
        await supabase
          .from("applications")
          .update({ status: "declined" })
          .eq("job_id", data.job_id)
          .eq("contractor_id", data.contractor_id)
          .select();
      }
    }

    if (data?.contractor_id) {
      this.syncContractorCRM(data.contractor_id).catch(() => {});

      if (["Completed", "Paid", "Payment Received"].includes(status)) {
        this.recalculateContractorRating(data.contractor_id).catch(() => {});
      }
    }

    await this.logAdminActivity(
      "Updated Assignment",
      `Set assignment ${id} status to ${status}`,
    );
    return data as DbAssignment;
  },

  async confirmAssignmentAttendance(id: string) {
    const { data, error } = await supabase
      .from("assignments")
      .update({
        attendance_confirmed: true,
        attendance_confirmed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as DbAssignment;
  },

  async approvePayoutWithRating(
    assignmentId: string,
    systemRating: number,
    systemFeedback: string,
    contractorId: string,
    paymentMethod?: string,
    speedRating?: number,
  ) {
    const { data: existing } = await supabase
      .from("assignments")
      .select("editor_feedback")
      .eq("id", assignmentId)
      .single();

    const combinedFeedback =
      existing?.editor_feedback && systemFeedback
        ? `${existing.editor_feedback}\n\nManager Note: ${systemFeedback}`
        : systemFeedback || existing?.editor_feedback || null;

    const { data, error } = await supabase
      .from("assignments")
      .update({
        status: "Completed",
        system_rating: systemRating,
        speed_rating: speedRating,
        editor_feedback: combinedFeedback,
        payment_method: paymentMethod,
      })
      .eq("id", assignmentId)
      .select("*, jobs(weddings(client_name, date, location), role, pay_rate)")
      .single();
    if (error) throw error;

    await this.recalculateContractorRating(contractorId);
    await this.logAdminActivity(
      "Approved Payout",
      `Approved payout and rated assignment ${assignmentId}`,
    );

    // Send SMS and Email via Ovanta
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select(
          "sms_payout_enabled, sms_payout_template, email_payout_enabled, email_payout_template, email_payout_subject, company_name, logo_url, app_url",
        )
        .limit(1)
        .maybeSingle();
      const { data: contractor } = await supabase
        .from("contractors")
        .select(
          "email, first_name, last_name, sms_notifications, email_notifications",
        )
        .eq("id", contractorId)
        .single();

      const job = (data as any).jobs;
      const location = job?.weddings?.location || "a location";
      const date = job?.weddings?.date || "TBD";
      const amount = job?.pay_rate || 0;

      if (
        contractor?.email &&
        settings?.sms_payout_enabled &&
        settings?.sms_payout_template &&
        contractor.sms_notifications !== false
      ) {
        let msg = settings.sms_payout_template
          .replace(/{{company_name}}/g, settings.company_name || "Veydra")
          .replace(/{{contractor_name}}/g, contractor.first_name)
          .replace(/{{location}}/g, location)
          .replace(/{{date}}/g, date)
          .replace(/{{amount}}/g, amount.toString())
          .replace(
            /{{portal_link}}/g,
            (settings.app_url || window.location.origin).replace(/\/$/, ""),
          );

        await sendOvantaSms(
          contractor.email,
          msg,
          `${contractor.first_name} ${contractor.last_name || ""}`,
          true,
        ).catch((e) => console.error("SMS failed:", e));
      }

      if (
        contractor?.email &&
        settings?.email_payout_enabled &&
        settings?.email_payout_template &&
        contractor.email_notifications !== false
      ) {
        let subject = (settings.email_payout_subject || "Payout Processed")
          .replace(/{{company_name}}/g, settings.company_name || "Veydra")
          .replace(/{{location}}/g, location)
          .replace(/{{date}}/g, date)
          .replace(/{{amount}}/g, amount.toString());
        let msg = settings.email_payout_template
          .replace(/{{company_name}}/g, settings.company_name || "Veydra")
          .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
          .replace(/{{contractor_name}}/g, contractor.first_name)
          .replace(/{{location}}/g, location)
          .replace(/{{date}}/g, date)
          .replace(/{{amount}}/g, amount.toString())
          .replace(
            /{{portal_link}}/g,
            (settings.app_url || window.location.origin).replace(/\/$/, ""),
          );

        await sendOvantaEmail(
          contractor.email,
          subject,
          msg,
          `${contractor.first_name} ${contractor.last_name || ""}`,
          true,
        ).catch((e) => console.error("Email failed:", e));
      }
    } catch (err) {
      console.error("Failed to trigger payout notifications", err);
    }

    return data as DbAssignment;
  },

  async recalculateContractorRating(contractorId: string) {
    try {
      if (!contractorId) return;

      const { data: assignments, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("contractor_id", contractorId);

      if (error || !assignments || assignments.length === 0) return;

      let totalScore = 0;
      let count = 0;

      assignments.forEach((a) => {
        // Only calculate for completed jobs
        const status = String(a.status || "")
          .trim()
          .toLowerCase();
        if (!["completed", "paid", "payment received"].includes(status)) return;

        let assignmentScore = 0;
        let weights = 0;

        const eRating = Number(a.editor_rating || 0);
        const cRating = Number(a.client_rating || 0);
        const sRating = Number(a.system_rating || 0);
        const spRating = Number(a.speed_rating || 0);

        if (eRating > 0) {
          assignmentScore += eRating * 0.3;
          weights += 0.3;
        }
        if (cRating > 0) {
          assignmentScore += cRating * 0.3;
          weights += 0.3;
        }

        if (sRating > 0) {
          assignmentScore += sRating * 0.2;
          weights += 0.2;
        } else {
          assignmentScore += 5 * 0.2;
          weights += 0.2; // Default system rating for completed jobs
        }

        if (spRating > 0) {
          assignmentScore += spRating * 0.2;
          weights += 0.2;
        } else {
          assignmentScore += 5 * 0.2;
          weights += 0.2; // Default speed rating for completed jobs
        }

        if (weights > 0) {
          totalScore += assignmentScore / weights;
          count++;
        }
      });

      if (count > 0) {
        const finalRating = Number((totalScore / count).toFixed(1));
        const { error: updateError } = await supabase
          .from("contractors")
          .update({ rating: finalRating })
          .eq("id", contractorId);
        if (updateError) {
          console.error("Failed to update contractor rating:", updateError);
        }
      } else {
        await supabase
          .from("contractors")
          .update({ rating: null })
          .eq("id", contractorId);
      }
    } catch (err) {
      console.error("Error in recalculateContractorRating:", err);
    }
  },

  async recalculateAllRatings() {
    const { data: contractors } = await supabase
      .from("contractors")
      .select("id");
    if (contractors) {
      const promises = contractors.map((c) =>
        this.recalculateContractorRating(c.id),
      );
      await Promise.allSettled(promises);
    }
  },

  async cancelAssignmentByJobAndContractor(
    job_id: string,
    contractor_id: string,
  ) {
    const { data, error } = await supabase
      .from("assignments")
      .update({ status: "Cancelled" })
      .eq("job_id", job_id)
      .eq("contractor_id", contractor_id)
      .select();
    if (error) throw error;

    await supabase
      .from("jobs")
      .update({ status: "open" })
      .eq("id", job_id)
      .select();

    await supabase
      .from("applications")
      .update({ status: "declined" })
      .eq("job_id", job_id)
      .eq("contractor_id", contractor_id)
      .select();

    await this.logAdminActivity(
      "Cancelled Assignment",
      `Cancelled assignment for job ${job_id}`,
    );
    return data;
  },

  async getWeddingAssignmentsForFeedback(weddingId: string) {
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id")
      .eq("wedding_id", weddingId);
    if (jobsError) throw jobsError;
    if (!jobs || jobs.length === 0) return [];

    const jobIds = jobs.map((j) => j.id);
    const { data, error } = await supabase
      .from("assignments")
      .select(
        `
      *,
      jobs (id, status, role, pay_rate, hours, addons, weddings(client_name, date, location, region)),
      contractors (id, first_name, last_name, avatar_url)
    `,
      )
      .in("job_id", jobIds)
      .neq("status", "Cancelled");

    if (error) throw error;
    return data;
  },

  async submitBulkClientFeedback(
    feedbacks: {
      assignmentId: string;
      rating: number;
      feedback: string;
      contractorId: string;
    }[],
  ) {
    const promises = feedbacks.map(async (f) => {
      const { error } = await supabase
        .from("assignments")
        .update({
          client_rating: f.rating,
          client_feedback: f.feedback || null,
        })
        .eq("id", f.assignmentId);
      if (error) throw error;
      await this.recalculateContractorRating(f.contractorId);
    });
    await Promise.all(promises);
  },

  // --- Notifications ---
  async createNotification(
    notification: Omit<DbNotification, "id" | "created_at" | "read">,
  ) {
    const { data, error } = await supabase
      .from("notifications")
      .insert(notification)
      .select()
      .single();
    if (error) throw error;
    return data as DbNotification;
  },

  async getNotifications(contractor_id: string) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("contractor_id", contractor_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as DbNotification[];
  },

  async markNotificationAsRead(id: string) {
    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as DbNotification;
  },

  async markAllNotificationsAsRead(contractor_id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("contractor_id", contractor_id)
      .select();
    if (error) throw error;
  },

  // --- Messages ---
  async getMessages(userId: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Messages table error:", error);
      return [];
    }

    return data as DbMessage[];
  },

  async sendMessage(message: Omit<DbMessage, "id" | "created_at" | "read">) {
    const { data, error } = await supabase
      .from("messages")
      .insert({ ...message, read: false })
      .select()
      .single();

    if (error) {
      console.warn("Messages table error:", error);
      throw error;
    }

    return data as DbMessage;
  },

  async markMessageAsRead(id: string) {
    const { data, error } = await supabase
      .from("messages")
      .update({ read: true })
      .eq("id", id)
      .select()
      .single();

    if (error && error.code === "42P01") return null;
    if (error) throw error;
    return data as DbMessage;
  },

  async deleteMessage(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) throw error;
  },

  async sendOvantaSms(
    email: string,
    message: string,
    name?: string,
    force: boolean = false,
  ) {
    return sendOvantaSms(email, message, name, force);
  },

  async sendOvantaEmail(
    email: string,
    subject: string,
    message: string,
    name?: string,
    force: boolean = false,
  ) {
    return sendOvantaEmail(email, subject, message, name, force);
  },

  // CRM methods (_getCrmCustomFieldMap, _extractVenueLocation, _extractVenueName,
  // getOvantaLeads, getOvantaContactsForMap) are defined later in this object.

  /**
   * Fetch Facebook Ads campaigns with insights from Meta Graph API.
   */
  async getFacebookAdsCampaigns(
    datePreset?: string | null,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const { data: settings } = await supabase
      .from("portal_settings")
      .select("fb_access_token, fb_ad_account_id")
      .single();
    if (!settings?.fb_access_token || !settings?.fb_ad_account_id) {
      console.warn("Missing Facebook API credentials in portal_settings.");
      throw new Error("Missing Credentials");
    }

    try {
      const cleanToken = settings.fb_access_token.trim();
      const rawAccountId = settings.fb_ad_account_id.trim();
      const numericId = rawAccountId.replace(/^act_/, "").trim();
      const accountId = `act_${numericId}`;

      let insightsField =
        "insights.limit(500).time_increment(1){spend,impressions,clicks,actions,cost_per_action_type,action_values,date_start,date_stop}";
      if (startDate && endDate) {
        insightsField = `insights.time_range({"since":"${startDate}","until":"${endDate}"}).limit(500).time_increment(1){spend,impressions,clicks,actions,cost_per_action_type,action_values,date_start,date_stop}`;
      } else if (datePreset) {
        insightsField = `insights.date_preset(${datePreset}).limit(500).time_increment(1){spend,impressions,clicks,actions,cost_per_action_type,action_values,date_start,date_stop}`;
      }

      const queryObj: Record<string, string> = {
        fields: `name,objective,status,${insightsField}`,
        effective_status: '["ACTIVE","PAUSED"]',
        limit: "100",
        access_token: cleanToken,
      };

      if (startDate && endDate) {
        queryObj["time_range"] = JSON.stringify({
          since: startDate,
          until: endDate,
        });
      } else if (datePreset) {
        queryObj["date_preset"] = datePreset;
      }

      const params = new URLSearchParams(queryObj);
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${accountId}/campaigns?${params.toString()}`,
      );

      if (!res.ok) {
        const errorData = await res.json();
        const errObj = errorData.error || {};
        let msg = errObj.message || `Meta API Error (${res.status})`;
        if (
          errObj.type === "OAuthException" ||
          errObj.code === 190 ||
          msg.includes("Session has expired") ||
          msg.includes("invalid")
        ) {
          msg =
            "Meta Access Token has expired or is invalid. Please generate a new token in Meta Graph API Explorer and click 'Save Meta Credentials' in Settings.";
        } else if (errObj.code === 200 || msg.includes("permission")) {
          msg =
            "Token is missing required permissions (ads_read or read_insights). Please grant these permissions when generating your token.";
        }
        api.logApiEvent(
          "GET Facebook Ads",
          null,
          JSON.stringify(errorData),
          "error",
          msg,
        );
        throw new Error(msg);
      }

      const data = await res.json();
      api.logApiEvent("GET Facebook Ads", null, "Success", "success");

      if (data.data && data.data.length > 0) {
        return data.data.map((camp: any) => {
          const insightsList: any[] = camp.insights?.data || [];
          const spend = insightsList.reduce(
            (sum, item) => sum + parseFloat(item.spend || 0),
            0,
          );
          const impressions = insightsList.reduce(
            (sum, item) => sum + parseInt(item.impressions || 0),
            0,
          );
          const clicks = insightsList.reduce(
            (sum, item) => sum + parseInt(item.clicks || 0),
            0,
          );

          let conversions = 0;
          let purchaseValue = 0;

          const dailyBreakdown = insightsList.map((item: any) => {
            const itemSpend = parseFloat(item.spend || 0);
            const actions = item.actions || [];

            const leadAction = actions.find(
              (a: any) => a.action_type === "lead",
            );
            let itemConv = 0;
            if (leadAction) {
              itemConv = parseInt(leadAction.value || 0);
            } else {
              itemConv = actions.reduce((sum: number, a: any) => {
                const actType = (a.action_type || "").toLowerCase();
                if (
                  actType.includes("lead") ||
                  actType === "offsite_conversion" ||
                  actType.includes("submit_application") ||
                  actType.includes("contact")
                ) {
                  return sum + parseInt(a.value || 0);
                }
                return sum;
              }, 0);
            }
            conversions += itemConv;

            const actionValues = item.action_values || [];
            const itemPurch = parseFloat(
              actionValues.find(
                (a: any) =>
                  a.action_type === "purchase" ||
                  a.action_type === "offsite_conversion.fb_pixel_purchase",
              )?.value || 0,
            );
            purchaseValue += itemPurch;

            return {
              date: item.date_start,
              spend: itemSpend,
              conversions: itemConv,
              clicks: parseInt(item.clicks || 0),
              impressions: parseInt(item.impressions || 0),
            };
          });

          const roas = spend > 0 ? (purchaseValue / spend).toFixed(2) : 0;

          return {
            id: camp.id,
            name: camp.name,
            objective: camp.objective,
            status: camp.status,
            spend: spend,
            budget: 0,
            impressions: impressions,
            clicks: clicks,
            conversions: conversions,
            cpa: conversions > 0 ? spend / conversions : 0,
            roas: parseFloat(roas as string),
            dailyBreakdown,
          };
        });
      }
      return [];
    } catch (e) {
      console.error("Facebook API Error:", e);
      throw e;
    }
  },

  async processStripePayout(
    amount: number,
    destination_account: string,
    description?: string,
    idempotency_key?: string,
  ) {
    let {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      const { data } = await supabase.auth.refreshSession();
      session = data.session;
    }

    const token = session?.access_token;
    if (!token || !token.startsWith("eyJ")) {
      throw new Error(
        "Your session has expired or is invalid. Please log out and log back in to process payouts.",
      );
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/stripe-payout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        amount,
        destination_account,
        description,
        idempotency_key,
      }),
    });

    if (!res.ok) {
      let errorText = `Server returned ${res.status}`;
      try {
        const json = await res.json();
        if (json.error) errorText = json.error;
      } catch (e) {
        try {
          const text = await res.text();
          if (text) errorText = text;
        } catch (e2) {}
      }
      throw new Error(errorText);
    }

    const data = await res.json();
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async fulfillProposalPayment(proposalId: string): Promise<boolean> {
    try {
      const { data: proposal } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();
      if (!proposal) return false;

      // If already accepted/paid, do nothing
      if (proposal.status === "accepted" || proposal.status === "paid")
        return true;

      let weddingId = proposal.is_upgrade
        ? proposal.original_wedding_id
        : proposal.wedding_id;

      const customPlan =
        typeof proposal.custom_payment_plan === "string"
          ? JSON.parse(proposal.custom_payment_plan)
          : proposal.custom_payment_plan;
      const resolvedPaymentPlan =
        proposal.payment_plan || (customPlan?.enabled ? "custom" : null);

      const packageName = proposal.package_id
        ? proposal.package_id.charAt(0).toUpperCase() +
          proposal.package_id.slice(1)
        : "Custom";
      const coverageLabel =
        proposal.coverage_type === "photo"
          ? "Photo Only"
          : proposal.coverage_type === "video"
            ? "Video Only"
            : "Photo & Video";
      const packageString = `${packageName} (${coverageLabel})`;

      if (weddingId) {
        await supabase
          .from("weddings")
          .update({
            package: packageString,
            addons: proposal.addons,
            second_shooter_hours: proposal.second_shooter_hours,
            second_shooter_type: proposal.second_shooter_type,
            total_amount: proposal.total_amount,
            payment_plan: resolvedPaymentPlan,
            custom_payment_plan: customPlan,
            status: proposal.is_upgrade ? undefined : "pending",
            notes: proposal.is_upgrade
              ? `Upgraded Package (Paid via Portal).\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`
              : `Booked via Portal.\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`,
          })
          .eq("id", weddingId);
      } else {
        const { data: wedding, error: weddingError } = await supabase
          .from("weddings")
          .insert([
            {
              client_name: proposal.client_name,
              client_email: proposal.client_email,
              partner_name: proposal.partner_name,
              date: proposal.wedding_date,
              location:
                `${proposal.venue || ""} ${proposal.city || ""}, ${proposal.state || ""}`.trim(),
              package: packageString,
              addons: proposal.addons,
              second_shooter_hours: proposal.second_shooter_hours,
              second_shooter_type: proposal.second_shooter_type,
              status: "pending",
              payment_plan: resolvedPaymentPlan,
              custom_payment_plan: customPlan,
              total_amount: proposal.total_amount,
              paid_amount: 0,
              contract_date: new Date().toISOString(),
              notes: `Booked via Portal.\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`,
            },
          ])
          .select()
          .single();

        if (weddingError) throw weddingError;
        if (wedding) weddingId = wedding.id;
      }

      if (weddingId) {
        await supabase
          .from("proposals")
          .update({
            status: "accepted",
            wedding_id: weddingId,
          })
          .eq("id", proposal.id);

        // Send CRM Sync
        const { data: updatedWedding } = await supabase
          .from("weddings")
          .select("*")
          .eq("id", weddingId)
          .single();
        if (updatedWedding) {
          const { data: settings } = await supabase
            .from("portal_settings")
            .select("*")
            .single();
          if (
            settings?.hl_api_key &&
            settings?.hl_location_id &&
            updatedWedding.client_email
          ) {
            try {
              const headers = {
                Authorization: `Bearer ${settings.hl_api_key}`,
                Version: "2021-07-28",
                "Content-Type": "application/json",
              };
              const searchRes = await fetch(
                `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(updatedWedding.client_email)}`,
                { headers },
              );
              const searchData = await searchRes.json();
              let contactId = searchData.contacts?.[0]?.id;

              if (!contactId) {
                const createRes = await fetch(
                  `https://services.leadconnectorhq.com/contacts/`,
                  {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                      locationId: settings.hl_location_id,
                      email: updatedWedding.client_email,
                      name: updatedWedding.client_name || "",
                      tags: ["booked", "payment-received"],
                    }),
                  },
                );
                const createData = await createRes.json();
                contactId = createData.contact?.id;
              } else {
                const existingTags = searchData.contacts?.[0]?.tags || [];
                const newTags = new Set([
                  ...existingTags,
                  "booked",
                  "payment-received",
                ]);
                await fetch(
                  `https://services.leadconnectorhq.com/contacts/${contactId}`,
                  {
                    method: "PUT",
                    headers,
                    body: JSON.stringify({ tags: Array.from(newTags) }),
                  },
                );
              }
            } catch (e) {}
          }
        }
      }
      return true;
    } catch (error) {
      console.error("Failed to fulfill proposal payment:", error);
      return false;
    }
  },

  async fulfillDirectBookingPayment(
    weddingId: string,
    paymentData?: {
      paid_amount?: number;
      stripe_customer_id?: string;
      stripe_subscription_id?: string;
    },
  ): Promise<boolean> {
    try {
      const { data: wedding } = await supabase
        .from("weddings")
        .select("*")
        .eq("id", weddingId)
        .single();
      if (!wedding) return false;

      // If already pending/active and not unpaid draft, do nothing
      if (
        wedding.status !== "draft" &&
        !wedding.notes?.includes("[UNPAID_DRAFT]")
      )
        return true;

      const updatePayload: any = {
        status: "pending",
        contract_date: new Date().toISOString(),
      };

      if (wedding.notes?.includes("[UNPAID_DRAFT]")) {
        updatePayload.notes = wedding.notes
          .replace("[UNPAID_DRAFT]\n", "")
          .replace("[UNPAID_DRAFT]", "");
      }

      // If payment data provided (from successful checkout), persist it
      if (paymentData?.paid_amount && paymentData.paid_amount > 0) {
        updatePayload.paid_amount = paymentData.paid_amount;
      }
      if (paymentData?.stripe_customer_id) {
        updatePayload.stripe_customer_id = paymentData.stripe_customer_id;
      }
      if (paymentData?.stripe_subscription_id) {
        updatePayload.stripe_subscription_id =
          paymentData.stripe_subscription_id;
      }

      await supabase.from("weddings").update(updatePayload).eq("id", weddingId);

      // Send CRM Sync
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("*")
        .single();
      if (
        settings?.hl_api_key &&
        settings?.hl_location_id &&
        wedding.client_email
      ) {
        try {
          const headers = {
            Authorization: `Bearer ${settings.hl_api_key}`,
            Version: "2021-07-28",
            "Content-Type": "application/json",
          };
          const searchRes = await fetch(
            `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(wedding.client_email)}`,
            { headers },
          );
          const searchData = await searchRes.json();
          let contactId = searchData.contacts?.[0]?.id;

          if (!contactId) {
            const createRes = await fetch(
              `https://services.leadconnectorhq.com/contacts/`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({
                  locationId: settings.hl_location_id,
                  email: wedding.client_email,
                  name: wedding.client_name,
                  tags: ["booked", "direct-booking"],
                }),
              },
            );
            const createData = await createRes.json();
            contactId = createData.contact?.id;
          }

          if (contactId) {
            await fetch(
              `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({
                  tags: ["booked", "direct-booking", "payment-received"],
                }),
              },
            );
          }
        } catch (crmErr) {
          console.error("CRM Sync Error in Direct Booking:", crmErr);
        }
      }

      await this.logAdminActivity(
        "Direct Booking Fulfilled",
        `Fulfilled direct booking for ${wedding.client_name}`,
      );
      return true;
    } catch (error) {
      console.error("Failed to fulfill direct booking payment:", error);
      return false;
    }
  },

  async updateProposal(id: string, updates: Record<string, any>) {
    const { data, error } = await supabase
      .from("proposals")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    await this.logAdminActivity("Updated Proposal", `Updated proposal: ${id}`);
    return data;
  },

  async getProposals() {
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async chargeSavedCard({
    weddingId,
    amount,
    description,
  }: {
    weddingId: string;
    amount: number;
    description: string;
  }) {
    const { data: wedding } = await supabase
      .from("weddings")
      .select("*")
      .eq("id", weddingId)
      .single();
    if (!wedding) throw new Error("Wedding not found");

    const customerEmail =
      wedding.client_email || wedding.questionnaire_data?.contact_info?.email;
    const customerId = wedding.stripe_customer_id;

    // Call stripe-checkout with x-charge-offsession header to trigger direct card charge
    let res: Response;
    try {
      res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
          "x-charge-offsession": "true",
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          customerEmail,
          customerName: wedding.client_name,
          description: description || `Payment for ${wedding.client_name}`,
          paymentOption: "custom",
          stripeCustomerId: customerId,
          weddingId: wedding.id,
        }),
      });
    } catch (netErr: any) {
      console.error("Network / CORS error calling stripe-checkout:", netErr);
      throw new Error(
        "Unable to connect to Stripe server endpoint. Please ensure 'stripe-checkout' function is deployed on Supabase or click 'Send Invoice Link' instead.",
      );
    }

    if (!res.ok) {
      let errorMsg = "Failed to initiate payment charge.";
      try {
        const err = await res.json();
        if (err && typeof err === "object") {
          errorMsg = err.error || err.message || errorMsg;
        } else if (typeof err === "string") {
          errorMsg = err;
        }
      } catch (_) {
        const text = await res.text().catch(() => "");
        if (text) errorMsg = text;
      }

      // Payment notification emails disabled per user request until auto-charge function is verified
      /*
      if (customerEmail) {
        try {
          const settings = await this.getPortalSettings();
          if (settings?.email_payment_failed_enabled) {
            const failureSubject = `Payment Action Needed - ${wedding.client_name}`;
            const failureHtml = `...`;
            await sendOvantaEmail(customerEmail, failureSubject, failureHtml, wedding.client_name, true).catch(() => {});
          }
        } catch (e) {
          console.error("Failed checking payment failed notification setting:", e);
        }
      }
      */

      throw new Error(
        typeof errorMsg === "string"
          ? errorMsg
          : "Failed to initiate payment charge.",
      );
    }

    const data = await res.json();

    // If auto payment succeeds, update paid_amount on wedding
    const newPaidAmount = (Number(wedding.paid_amount) || 0) + amount;
    await supabase
      .from("weddings")
      .update({ paid_amount: newPaidAmount })
      .eq("id", weddingId);
    await this.logAdminActivity(
      "Processed Auto-Charge",
      `Charged $${amount} for ${wedding.client_name}`,
    );

    // Receipt email disabled per user request
    /*
    if (customerEmail) {
      try {
        const settings = await this.getPortalSettings();
        const companyName = settings?.company_name || localStorage.getItem("veydra_company_name") || "Veydra";
        const addonsList = Array.isArray(wedding.addons) ? wedding.addons : (wedding.addons ? [wedding.addons] : []);
        const invoicePdfUrl = data?.invoicePdf || data?.hostedInvoiceUrl;
        const receiptHtml = generateHTMLReceipt(
          companyName,
          wedding.client_name,
          amount,
          wedding.payment_plan || "Custom Plan",
          wedding.package || "Custom Wedding Package",
          addonsList,
          Number(wedding.total_amount) || newPaidAmount,
          invoicePdfUrl
        );
        await sendOvantaEmail(customerEmail, `Payment Receipt - ${companyName}`, receiptHtml, wedding.client_name, true);
      } catch (receiptErr) {
        console.error("Failed to send automatic receipt email:", receiptErr);
      }
    }
    */

    return { success: true, amountPaid: amount, data };
  },

  async sendManualPaymentInvoice({
    weddingId,
    amount,
    label,
  }: {
    weddingId: string;
    amount: number;
    label: string;
  }) {
    const { data: wedding } = await supabase
      .from("weddings")
      .select("*")
      .eq("id", weddingId)
      .single();
    if (!wedding) throw new Error("Wedding not found");

    const clientEmail =
      wedding.client_email || wedding.questionnaire_data?.contact_info?.email;
    if (!clientEmail)
      throw new Error("Client email is missing on this wedding record.");

    const portalLink = `${window.location.origin}/bride-portal/${wedding.id}`;
    const subject = `Payment Invoice: ${label} ($${amount.toLocaleString()}) for ${wedding.client_name}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">Payment Invoice</h2>
        <p>Dear ${wedding.client_name},</p>
        <p>Here is your requested payment invoice for your upcoming wedding media services.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;"><strong>Installment:</strong> ${label}</p>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #059669;"><strong>Amount Due:</strong> $${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalLink}" style="background-color: #0f172a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 24px; font-weight: bold; display: inline-block;">Pay Invoice Online</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">If you have any questions, please reach out to us directly.</p>
      </div>
    `;

    await sendOvantaEmail(
      clientEmail,
      subject,
      emailHtml,
      wedding.client_name,
      true,
    );

    const smsMessage = `Hi ${wedding.client_name}, here is your payment invoice for $${amount} (${label}). Complete payment online here: ${portalLink}`;
    await sendOvantaSms(
      clientEmail,
      smsMessage,
      wedding.client_name,
      true,
    ).catch(() => {});

    await this.logAdminActivity(
      "Sent Manual Invoice",
      `Sent manual invoice $${amount} to ${wedding.client_name}`,
    );
    return true;
  },

  async sendPaymentReceipt({
    weddingId,
    amount,
    label,
  }: {
    weddingId: string;
    amount: number;
    label?: string;
  }) {
    const { data: wedding } = await supabase
      .from("weddings")
      .select("*")
      .eq("id", weddingId)
      .single();
    if (!wedding) throw new Error("Wedding not found");

    const clientEmail =
      wedding.client_email || wedding.questionnaire_data?.contact_info?.email;
    if (!clientEmail)
      throw new Error("Client email is missing on this wedding record.");

    const settings = await this.getPortalSettings();
    const companyName =
      settings?.company_name ||
      localStorage.getItem("veydra_company_name") ||
      "Veydra";
    const addonsList = Array.isArray(wedding.addons)
      ? wedding.addons
      : wedding.addons
        ? [wedding.addons]
        : [];

    const receiptHtml = generateHTMLReceipt(
      companyName,
      wedding.client_name,
      amount,
      label || wedding.payment_plan || "Custom Plan",
      wedding.package || "Custom Wedding Package",
      addonsList,
      Number(wedding.total_amount) || amount,
    );

    const subject = `Payment Receipt - ${companyName} (${label || "Payment"})`;
    await sendOvantaEmail(
      clientEmail,
      subject,
      receiptHtml,
      wedding.client_name,
      true,
    );

    await this.logAdminActivity(
      "Resent Payment Receipt",
      `Sent $${amount} payment receipt to ${wedding.client_name}`,
    );
    return true;
  },

  // --- Pricing Packages & Addons ---
  async getPackages(includeArchived = false) {
    let query = supabase
      .from("pricing_packages")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!includeArchived) query = query.eq("is_archived", false);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      desc: p.description,
      priceBoth: Number(p.price_both),
      priceSingle: Number(p.price_single),
      photoFeatures: p.photo_features || [],
      videoFeatures: p.video_features || [],
      isArchived: p.is_archived,
      sortOrder: p.sort_order,
    }));
  },

  async savePackage(pkg: {
    id?: string;
    name: string;
    description: string;
    priceBoth: number;
    priceSingle: number;
    photoFeatures: string[];
    videoFeatures: string[];
    isArchived: boolean;
  }) {
    let id = pkg.id;
    if (!id) {
      const baseId = pkg.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      // Check if a package with this id already exists to avoid overwriting
      const { data: existing } = await supabase
        .from("pricing_packages")
        .select("id")
        .eq("id", baseId)
        .maybeSingle();
      if (existing) {
        // Append a unique suffix
        id = `${baseId}_copy_${Date.now().toString(36)}`;
      } else {
        id = baseId;
      }
    }
    const payload = {
      id,
      name: pkg.name,
      description: pkg.description,
      price_both: pkg.priceBoth,
      price_single: pkg.priceSingle,
      photo_features: pkg.photoFeatures,
      video_features: pkg.videoFeatures,
      is_archived: pkg.isArchived,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("pricing_packages")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deletePackage(id: string) {
    const { error } = await supabase
      .from("pricing_packages")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async getAddons(includeArchived = false) {
    let query = supabase
      .from("pricing_addons")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!includeArchived) query = query.eq("is_archived", false);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      price: Number(a.price),
      isHourly: a.is_hourly,
      minHours: Number(a.min_hours) || 0,
      isArchived: a.is_archived,
      isBartending: a.is_bartending || false,
      description: a.description || "",
      features: a.features || [],
      sortOrder: a.sort_order,
    }));
  },

  async saveAddon(addon: {
    id?: string;
    name: string;
    price: number;
    isHourly: boolean;
    minHours: number;
    isArchived: boolean;
    isBartending?: boolean;
    description?: string;
    features?: string[];
  }) {
    const id =
      addon.id ||
      addon.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    const payload = {
      id,
      name: addon.name,
      price: addon.price,
      is_hourly: addon.isHourly,
      min_hours: addon.minHours,
      is_archived: addon.isArchived,
      is_bartending: addon.isBartending || false,
      description: addon.description || "",
      features: addon.features || [],
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("pricing_addons")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAddon(id: string) {
    const { error } = await supabase
      .from("pricing_addons")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  // ─── Upsell: Bartending add-on ───

  async getUpsellPurchases(weddingId?: string) {
    let query = supabase
      .from("upsell_purchases")
      .select("*")
      .order("created_at", { ascending: false });
    if (weddingId) query = query.eq("wedding_id", weddingId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createUpsellCheckout(opts: {
    weddingId: string;
    packageName: string;
    amount: number;
    customerEmail?: string;
    customerName?: string;
    stripeCustomerId?: string | null;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        type: "upsell",
        weddingId: opts.weddingId,
        amount: opts.amount,
        packageName: opts.packageName,
        description: `Bartending Add-On: ${opts.packageName}`,
        customerEmail: opts.customerEmail || "",
        customerName: opts.customerName || "",
        stripeCustomerId: opts.stripeCustomerId || undefined,
        successUrl: opts.successUrl,
        cancelUrl: opts.cancelUrl,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to create checkout session");
    }
    return res.json();
  },

  // ─── CRM / Ovanta integration methods ───

  async _getCrmCustomFieldMap(): Promise<Record<string, string>> {
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("hl_api_key, hl_location_id")
        .single();
      if (!settings?.hl_api_key || !settings?.hl_location_id) return {};

      const headers = {
        Authorization: `Bearer ${settings.hl_api_key}`,
        Version: "v3",
        "Content-Type": "application/json",
      };

      const res = await fetch(
        `https://services.leadconnectorhq.com/contacts/customFields?locationId=${settings.hl_location_id}`,
        { headers },
      );
      if (!res.ok) {
        console.error(`[API] Custom fields fetch failed: ${res.status}`);
        return {};
      }
      const json = await res.json();
      const fields = json.customFields || json.fields || [];
      console.log(
        `[API] Custom field definitions received:`,
        fields.length,
        "fields",
      );

      const map: Record<string, string> = {};
      fields.forEach((f: any) => {
        if (!f.id) return;
        if (f.name) {
          map[f.name] = f.id;
          map[f.name.toLowerCase()] = f.id;
          map[f.name.toLowerCase().replace(/\s+/g, "_")] = f.id;
        }
        if (f.fieldKey) {
          map[f.fieldKey] = f.id;
          map[f.fieldKey.toLowerCase()] = f.id;
          map[f.fieldKey.replace(/^contact\./, "")] = f.id;
          map[f.fieldKey.replace(/^contact\./, "").toLowerCase()] = f.id;
        }
        map[f.id] = f.id;
      });

      console.log("[API] Field map keys:", Object.keys(map));
      return map;
    } catch (e) {
      console.error("[API] Failed to fetch CRM custom fields:", e);
      return {};
    }
  },

  _extractVenueLocation(
    contact: any,
    fieldMap: Record<string, string>,
  ): string {
    if (!contact) return "";
    // Try customFields as array of { id, value } (v3 API)
    if (Array.isArray(contact.customFields)) {
      for (const f of contact.customFields) {
        const fid = f.id || f.fieldId || f.key || "";
        const val = f.value || f.fieldValue || "";
        if (!val) continue;
        const lower = String(fid).toLowerCase();
        if (
          lower.includes("venue_location") ||
          lower.includes("wedding_venue_location") ||
          lower.includes("venue address") ||
          (lower.includes("location") && lower.includes("venue"))
        ) {
          return String(val);
        }
      }
      // Fallback: match by field map
      const locFieldId =
        fieldMap["wedding_venue_location"] ||
        fieldMap["venue_location"] ||
        fieldMap["venue address"];
      if (locFieldId) {
        const found = contact.customFields.find(
          (f: any) => (f.id || f.fieldId) === locFieldId,
        );
        if (found?.value) return String(found.value);
      }
    }
    // Try customFields as object { fieldKey: value }
    if (
      contact.customFields &&
      typeof contact.customFields === "object" &&
      !Array.isArray(contact.customFields)
    ) {
      const keys = Object.keys(contact.customFields);
      for (const k of keys) {
        const lower = k.toLowerCase();
        if (
          lower.includes("venue_location") ||
          lower.includes("wedding_venue_location")
        ) {
          return String(contact.customFields[k] || "");
        }
      }
    }
    return "";
  },

  _extractVenueName(contact: any, fieldMap: Record<string, string>): string {
    if (!contact) return "";
    if (Array.isArray(contact.customFields)) {
      for (const f of contact.customFields) {
        const fid = f.id || f.fieldId || f.key || "";
        const val = f.value || f.fieldValue || "";
        if (!val) continue;
        const lower = String(fid).toLowerCase();
        if (
          lower.includes("venue_name") ||
          lower.includes("wedding_venue_name") ||
          (lower.includes("venue") && lower.includes("name"))
        ) {
          return String(val);
        }
      }
      const nameFieldId =
        fieldMap["wedding_venue_name"] || fieldMap["venue_name"];
      if (nameFieldId) {
        const found = contact.customFields.find(
          (f: any) => (f.id || f.fieldId) === nameFieldId,
        );
        if (found?.value) return String(found.value);
      }
    }
    if (
      contact.customFields &&
      typeof contact.customFields === "object" &&
      !Array.isArray(contact.customFields)
    ) {
      const keys = Object.keys(contact.customFields);
      for (const k of keys) {
        const lower = k.toLowerCase();
        if (
          lower.includes("venue_name") ||
          lower.includes("wedding_venue_name")
        ) {
          return String(contact.customFields[k] || "");
        }
      }
    }
    return "";
  },

  /** Fetch leads from CRM. Paginates through up to 500 contacts using v3 API. */
  async getOvantaLeads(tagFilter?: string) {
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("hl_api_key, hl_location_id")
        .single();
      if (!settings?.hl_api_key || !settings?.hl_location_id) return [];

      const headers = {
        Authorization: `Bearer ${settings.hl_api_key}`,
        Version: "v3",
        "Content-Type": "application/json",
      };

      let allContacts: any[] = [];
      let startAfter = "";
      let hasNext = true;
      let page = 0;

      console.log("[API] Fetching CRM contacts with v3 API...");

      while (hasNext && allContacts.length < 500) {
        page++;
        let url = `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&limit=100`;
        if (startAfter) url += `&startAfter=${encodeURIComponent(startAfter)}`;

        console.log(
          `[API] CRM fetch page ${page}, total so far: ${allContacts.length}`,
        );

        const res = await fetch(url, { headers });
        if (!res.ok) {
          console.error(
            `[API] CRM fetch failed: ${res.status} ${res.statusText}`,
          );
          break;
        }

        const json = await res.json();
        const batch = json.contacts || [];
        console.log(`[API] Page ${page} returned ${batch.length} contacts`);
        allContacts = allContacts.concat(batch);

        hasNext = !!json.meta?.nextPageToken;
        startAfter = json.meta?.nextPageToken || "";

        if (batch.length === 0) break;
      }

      console.log(`[API] Total CRM contacts fetched: ${allContacts.length}`);

      const fieldMap = await this._getCrmCustomFieldMap();

      const enriched = allContacts.map((c: any) => {
        const venueLoc = this._extractVenueLocation(c, fieldMap);
        const venueName = this._extractVenueName(c, fieldMap);

        if (allContacts.indexOf(c) < 5) {
          console.log(`[API] Contact "${c.firstName} ${c.lastName}":`, {
            customFieldsType: Array.isArray(c.customFields)
              ? "array"
              : typeof c.customFields,
            customFieldsCount: Array.isArray(c.customFields)
              ? c.customFields.length
              : 0,
            venueLocation: venueLoc,
            venueName: venueName,
            tags: c.tags,
          });
        }

        return {
          id: c.id,
          name:
            `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
            c.name ||
            c.email ||
            "Unknown",
          email: c.email || "",
          phone: c.phone || "",
          status: c.tags?.some((t: string) => t.toLowerCase() === "booked")
            ? "Booked"
            : c.tags?.some((t: string) => t.toLowerCase() === "new lead")
              ? "New"
              : "Contacted",
          source: c.source || "Direct",
          date: c.dateAdded || c.createdAt || new Date().toISOString(),
          created_at: c.dateAdded || c.createdAt || new Date().toISOString(),
          tags: c.tags || [],
          venue_location: venueLoc,
          venue_name: venueName,
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
          _rawContact: c,
        };
      });

      const withVenue = enriched.filter((c: any) => c.venue_location);
      console.log(
        `[API] Enriched leads: ${enriched.length} total, ${withVenue.length} with venue location`,
      );

      if (tagFilter) {
        const lowerTag = tagFilter.toLowerCase();
        return enriched.filter((c: any) =>
          c.tags?.some((t: string) => t.toLowerCase() === lowerTag),
        );
      }

      return enriched;
    } catch (e) {
      console.error("[API] getOvantaLeads error:", e);
      return [];
    }
  },

  /** Fetch all CRM contacts with venue locations for the Market Map. */
  async getOvantaContactsForMap() {
    const all = await this.getOvantaLeads();
    return all.filter((c: any) => c.venue_location);
  },

  // ===========================================================================
  // Royalty & Territory Payback API
  // ===========================================================================

  // Fetch THIS instance's own territory (is_primary = true) — single-territory model
  async getOwnRoyaltyTerritory() {
    // Match by THIS instance's project_ref first (the Fleet Manager's self-row),
    // then fall back to is_primary. This is the single source of truth for
    // "which row is this instance's territory" across the royalty module.
    const SELF_PROJECT_REF = "oosmhtzqdmntlzhheofw";

    // Select BOTH payment method columns so the UI can detect a connection
    // regardless of which column the edge function actually wrote to.
    const { data: selfRow } = await supabase
      .from("territories")
      .select(
        "id, name, is_primary, owner_user_id, project_ref, supabase_url, stripe_customer_id, primary_payment_method_id, stripe_payment_method_id, stripe_royalty_configured, stripe_connected, royalty_percentage, payback_percentage, remaining_balance, total_collected",
      )
      .eq("project_ref", SELF_PROJECT_REF)
      .limit(1)
      .maybeSingle();
    if (selfRow) return selfRow;

    const { data, error } = await supabase
      .from("territories")
      .select("*")
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[Royalty] getOwnRoyaltyTerritory error:", error.message);
      return null;
    }
    return data;
  },

  async getRoyaltyTerritories() {
    const { data, error } = await supabase
      .from("territories")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getRoyaltyTerritory(id: string) {
    const { data, error } = await supabase
      .from("territories")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async updateRoyaltyTerritory(id: string, updates: any) {
    const { data, error } = await supabase
      .from("territories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getRoyaltyPeriods(territoryId: string) {
    const { data, error } = await supabase
      .from("royalty_periods")
      .select("*")
      .eq("territory_id", territoryId)
      .order("period_start", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getAllRoyaltyPeriods() {
    const { data, error } = await supabase
      .from("royalty_periods")
      .select("*, territories(name)")
      .order("period_start", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getRoyaltyAuditLog(territoryId: string) {
    const { data, error } = await supabase
      .from("royalty_audit_log")
      .select("*")
      .eq("territory_id", territoryId)
      .order("performed_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getRoyaltySales(territoryId: string) {
    const { data, error } = await supabase
      .from("royalty_sales")
      .select("*")
      .eq("territory_id", territoryId)
      .order("sale_date", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Per-wedding royalty breakdown: all royalty_sales rows attributed to a
  // specific wedding (sales + refunds), plus the territory's royalty/payback
  // percentages so the UI can show exactly how much royalty this wedding has
  // generated and how much has been collected.
  async getWeddingRoyalty(weddingId: string) {
    // 1. Fetch this instance's own territory for the royalty/payback rates.
    const territory = await this.getOwnRoyaltyTerritory().catch(() => null);
    const royaltyPct = Number(territory?.royalty_percentage || 0);
    const paybackPct = Number(territory?.payback_percentage || 0);

    // 2. Fetch all royalty_sales rows for this wedding.
    const { data: sales, error } = await supabase
      .from("royalty_sales")
      .select("*")
      .eq("wedding_id", weddingId)
      .order("sale_date", { ascending: false });
    if (error) throw error;

    const rows = sales || [];
    // Royalty rule: refunds NEVER count toward royalty — only processed sales.
    const grossSales = rows.reduce(
      (sum: number, s: any) => sum + (s.is_refund ? 0 : Number(s.sale_amount)),
      0,
    );
    const royaltyGenerated = Math.max(0, grossSales * (royaltyPct / 100));
    const paybackGenerated = Math.max(0, grossSales * (paybackPct / 100));

    // 3. Determine how much has actually been COLLECTED: sum the sales that
    // have been locked to a paid/waived royalty period.
    const lockedSaleIds = rows
      .filter((s: any) => s.processed_period_id)
      .map((s: any) => s.processed_period_id);
    let collectedRoyalty = 0;
    let collectedPayback = 0;
    if (lockedSaleIds.length > 0) {
      const uniquePeriodIds = [...new Set(lockedSaleIds)];
      const { data: periods } = await supabase
        .from("royalty_periods")
        .select("id, status, royalty_amount, payback_amount")
        .in("id", uniquePeriodIds)
        .in("status", ["paid", "waived"]);
      if (periods) {
        for (const p of periods) {
          collectedRoyalty += Number(p.royalty_amount || 0);
          collectedPayback += Number(p.payback_amount || 0);
        }
      }
    }

    return {
      sales: rows,
      grossSales,
      royaltyPct,
      paybackPct,
      royaltyGenerated,
      paybackGenerated,
      collectedRoyalty,
      collectedPayback,
      pendingRoyalty: Math.max(0, royaltyGenerated - collectedRoyalty),
    };
  },

  async getRoyaltySettings() {
    // Order by configured DESC + created_at DESC so we always read the real
    // configured row, not an empty clone row created by stale self-heal SQL.
    const { data, error } = await supabase
      .from("royalty_settings")
      .select("*")
      .order("stripe_royalty_configured", {
        ascending: false,
        nullsFirst: false,
      })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[Royalty] getRoyaltySettings error:", error.message);
      return null;
    }
    return data;
  },

  async updateRoyaltySettings(updates: any) {
    const current = await this.getRoyaltySettings();
    if (!current) {
      // No settings row exists — create one
      const { data, error } = await supabase
        .from("royalty_settings")
        .insert({ ...updates, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase
      .from("royalty_settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", current.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createRoyaltyAuditLog(entry: any) {
    const { error } = await supabase.from("royalty_audit_log").insert(entry);
    if (error) throw error;
  },

  async adjustRoyaltyPeriod(
    periodId: string,
    updates: any,
    reason: string,
    performedBy: string,
  ) {
    const { data: period, error: fetchErr } = await supabase
      .from("royalty_periods")
      .select("*")
      .eq("id", periodId)
      .single();
    if (fetchErr) throw fetchErr;
    const { data, error } = await supabase
      .from("royalty_periods")
      .update({
        ...updates,
        adjustment_reason: reason,
        adjusted_by: performedBy,
        adjusted_at: new Date().toISOString(),
      })
      .eq("id", periodId)
      .select()
      .single();
    if (error) throw error;
    await this.createRoyaltyAuditLog({
      territory_id: period.territory_id,
      action: "adjust_period",
      field_changed: Object.keys(updates).join(", "),
      old_value: JSON.stringify({
        royalty_amount: period.royalty_amount,
        payback_amount: period.payback_amount,
        total_due: period.total_due,
        status: period.status,
      }),
      new_value: JSON.stringify(updates),
      reason,
      performed_by: performedBy,
    });
    return data;
  },

  async waiveRoyaltyPeriod(
    periodId: string,
    reason: string,
    performedBy: string,
  ) {
    return this.adjustRoyaltyPeriod(
      periodId,
      { status: "waived", total_due: 0, royalty_amount: 0, payback_amount: 0 },
      reason,
      performedBy,
    );
  },

  async markRoyaltyPeriodPaid(
    periodId: string,
    reason: string,
    performedBy: string,
  ) {
    return this.adjustRoyaltyPeriod(
      periodId,
      { status: "paid", paid_at: new Date().toISOString() },
      reason,
      performedBy,
    );
  },

  async adjustTerritoryBalance(
    territoryId: string,
    newBalance: number,
    reason: string,
    performedBy: string,
  ) {
    const { data: territory, error: fetchErr } = await supabase
      .from("territories")
      .select("remaining_balance, name")
      .eq("id", territoryId)
      .single();
    if (fetchErr) throw fetchErr;
    const { data, error } = await supabase
      .from("territories")
      .update({ remaining_balance: newBalance })
      .eq("id", territoryId)
      .select()
      .single();
    if (error) throw error;
    await this.createRoyaltyAuditLog({
      territory_id: territoryId,
      action: "adjust_balance",
      field_changed: "remaining_balance",
      old_value: String(territory.remaining_balance),
      new_value: String(newBalance),
      reason,
      performed_by: performedBy,
    });
    return data;
  },

  async triggerRoyaltyProcessor(territoryId?: string, force = false) {
    const functionUrl = `${supabaseUrl}/functions/v1/royalty-processor`;
    const body: any = { force };
    if (territoryId) body.territory_id = territoryId;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Royalty processor failed: ${errText}`);
    }
    return response.json();
  },

  // Seed a fake gross-sale row into royalty_sales for THIS instance's primary
  // territory (dated today) so the weekly processor has something to sum +
  // charge. Testing tool — does NOT touch real bookings or the booking
  // Stripe account. No money moves until the processor runs.
  async seedTestSale(amount: number, note?: string) {
    const functionUrl = `${supabaseUrl}/functions/v1/royalty-processor`;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ action: "seed_test_sale", amount, note }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Seed test sale failed: ${errText}`);
    }
    return response.json();
  },

  // Fetch the territory for an Owner. In the single-territory model the Owner
  // is linked to the primary territory via owner_user_id. If that's not set
  // yet, fall back to the primary territory so the owner still sees their
  // dashboard (Super Admin can assign them explicitly via assignTerritoryOwner).
  async getOwnerTerritory(ownerUserId: string) {
    // First try the explicit owner_user_id link
    const { data: owned, error: ownedErr } = await supabase
      .from("territories")
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .limit(1)
      .maybeSingle();
    if (ownedErr) {
      console.warn("[Royalty] getOwnerTerritory error:", ownedErr.message);
    }
    if (owned) return owned;
    // Fallback: THIS instance's own territory — match by project_ref first
    // (the Fleet Manager's self-row), then is_primary.
    const SELF_PROJECT_REF = "oosmhtzqdmntlzhheofw";
    const { data: selfRow } = await supabase
      .from("territories")
      .select("*")
      .eq("project_ref", SELF_PROJECT_REF)
      .limit(1)
      .maybeSingle();
    if (selfRow) return selfRow;

    const { data: primary, error: primaryErr } = await supabase
      .from("territories")
      .select("*")
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    if (primaryErr) {
      console.warn(
        "[Royalty] getOwnerTerritory fallback error:",
        primaryErr.message,
      );
      return null;
    }
    return primary;
  },
  // Create or update THIS instance's primary territory (single-territory model).
  // IMPORTANT: The Fleet Manager already creates a primary territory row on
  // instance registration (project_ref = real ref). We must NOT insert a second
  // is_primary row — instead reuse the existing one. This avoids the duplicate
  // territory bug where royalty setup created a second primary row.
  async setupPrimaryTerritory(config: {
    name: string;
    owner_user_id?: string;
    royalty_percentage: number;
    payback_percentage: number;
    purchase_price: number;
    down_payment: number;
    remaining_balance?: number;
    status?: string;
  }) {
    // The Fleet Manager registers THIS instance with a known project_ref.
    // Match by that exact identifier so we always reuse the row it created —
    // never create a duplicate. (Matching by is_primary alone is unreliable
    // because is_primary can be null/false on older rows.)
    const SELF_PROJECT_REF = "oosmhtzqdmntlzhheofw";

    const calculatedBalance =
      config.remaining_balance !== undefined
        ? config.remaining_balance
        : config.purchase_price - config.down_payment;

    // 1) Try to find the Fleet Manager's self-row by project_ref.
    let existingId: string | null = null;
    const { data: selfRow, error: selfErr } = await supabase
      .from("territories")
      .select("id")
      .eq("project_ref", SELF_PROJECT_REF)
      .limit(1);
    if (selfErr) throw selfErr;
    if (selfRow && selfRow.length > 0) {
      existingId = selfRow[0].id;
    } else {
      // 2) Fallback: any row already flagged is_primary (in case project_ref
      //    differs). Still reuse rather than duplicate.
      const { data: primaryRow, error: primaryErr } = await supabase
        .from("territories")
        .select("id")
        .eq("is_primary", true)
        .limit(1);
      if (primaryErr) throw primaryErr;
      if (primaryRow && primaryRow.length > 0) {
        existingId = primaryRow[0].id;
      }
    }

    const updates: Record<string, any> = {
      name: config.name,
      royalty_percentage: config.royalty_percentage,
      payback_percentage: config.payback_percentage,
      purchase_price: config.purchase_price,
      down_payment: config.down_payment,
      remaining_balance: calculatedBalance,
      status: config.status || "active",
      is_primary: true,
    };
    if (config.owner_user_id) updates.owner_user_id = config.owner_user_id;

    if (existingId) {
      // Reuse the existing row — update royalty fields, preserve project_ref.
      const { data, error } = await supabase
        .from("territories")
        .update(updates)
        .eq("id", existingId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    // 3) Truly no row exists — create one using the REAL project_ref (not
    //    "self"), so it is recognized as this instance by the Fleet Manager.
    const { data, error } = await supabase
      .from("territories")
      .insert({
        ...updates,
        is_primary: true,
        project_ref: SELF_PROJECT_REF,
        supabase_url: supabaseUrl || window.location.origin,
        owner_user_id: config.owner_user_id || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Link an owner user to the primary territory (single-territory model).
  // Only sets owner_user_id if not already set — does NOT create a new territory.
  async assignTerritoryOwner(userId: string) {
    const SELF_PROJECT_REF = "oosmhtzqdmntlzhheofw";

    // Match by project_ref first (the Fleet Manager's self-row), then is_primary.
    let territory: any = null;
    const { data: selfRow } = await supabase
      .from("territories")
      .select("id, owner_user_id")
      .eq("project_ref", SELF_PROJECT_REF)
      .limit(1)
      .maybeSingle();
    if (selfRow) {
      territory = selfRow;
    } else {
      const { data: primaryRow } = await supabase
        .from("territories")
        .select("id, owner_user_id")
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle();
      territory = primaryRow;
    }

    if (!territory) {
      console.warn(
        "[Royalty] assignTerritoryOwner: No primary territory found",
      );
      return null;
    }

    if (territory.owner_user_id) {
      return territory; // Already owned
    }

    const { data, error } = await supabase
      .from("territories")
      .update({ owner_user_id: userId })
      .eq("id", territory.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Create a Stripe SetupIntent for connecting a bank account (ACH) or card
  // Uses the SEPARATE HQ royalty Stripe account (not bride booking account).
  async createRoyaltySetupIntent() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const functionUrl = `${supabaseUrl}/functions/v1/royalty-processor`;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ action: "setup_intent" }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(
        "[Royalty] createRoyaltySetupIntent failed:",
        response.status,
        errText,
      );
      throw new Error(`SetupIntent failed (${response.status}): ${errText}`);
    }
    return response.json();
  },

  // Save the separate HQ royalty Stripe account keys (Super Admin only).
  // These target a DIFFERENT Stripe account than bride booking payments.
  async setRoyaltyStripeKeys(keys: {
    secret_key?: string;
    publishable_key?: string;
    webhook_secret?: string;
  }) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    };
    const body = JSON.stringify(keys);

    // Try royalty-stripe-keys dedicated endpoint first
    try {
      const r1 = await fetch(
        `${supabaseUrl}/functions/v1/royalty-stripe-keys`,
        { method: "POST", headers, body },
      );
      if (r1.ok) return await r1.json();
      if (r1.status !== 404) {
        const t = await r1.text();
        throw new Error(`Failed to save royalty Stripe keys: ${t}`);
      }
    } catch (e: any) {
      // Only fall through on 404; rethrow other errors
      if (!e.message?.includes("404")) throw e;
    }

    // Fallback: call royalty-processor with set_royalty_keys action
    const r2 = await fetch(`${supabaseUrl}/functions/v1/royalty-processor`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "set_royalty_keys", ...keys }),
    });
    if (!r2.ok) {
      const errText = await r2.text();
      throw new Error(`Failed to save royalty Stripe keys: ${errText}`);
    }
    return await r2.json();
  },

  // Fetch the royalty publishable key (for initializing Stripe Elements
  // against the correct HQ royalty account). Safe to call from any role.
  async getRoyaltyPublishableKey() {
    const functionUrl = `${supabaseUrl}/functions/v1/royalty-processor`;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ action: "get_publishable_key" }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Royalty Stripe account not configured: ${errText}`);
    }
    return response.json() as Promise<{ publishable_key: string }>;
  },
  // Attaches the confirmed Stripe payment method to the territory customer.
  // Routes through the royalty-processor edge function (attach_payment_method)
  // so the PM is attached on Stripe's side AND both payment-method columns
  // (primary_payment_method_id + stripe_payment_method_id) are written in the
  // DB. The previous implementation misassigned the PM id into
  // stripe_customer_id via a direct client update, which is why the UI kept
  // showing "No payment method on file".
  async connectTerritoryStripe(
    paymentMethodId: string | { id?: string } | undefined,
  ) {
    const pmId =
      typeof paymentMethodId === "string"
        ? paymentMethodId
        : paymentMethodId && typeof paymentMethodId === "object"
          ? paymentMethodId.id || ""
          : "";
    if (!pmId || !pmId.startsWith("pm_")) {
      throw new Error(
        "Invalid payment method id returned by Stripe. Please retry the bank connection.",
      );
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const functionUrl = `${supabaseUrl}/functions/v1/royalty-processor`;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        action: "attach_payment_method",
        payment_method_id: pmId,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(
        "[Royalty] attach_payment_method failed:",
        response.status,
        errText,
      );
      throw new Error(`Attach failed (${response.status}): ${errText}`);
    }
    const result = await response.json();
    if (!result?.payment_method_id) {
      throw new Error(
        result?.error ||
          "Bank authorized in Stripe, but it was not saved to the territory. Do not close this dialog.",
      );
    }
    return result;
  },
};
