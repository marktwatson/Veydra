// This file imports the FULL source code of edge functions using Vite's ?raw imports.
// This ensures the Territories "Upload Sources" button pushes the actual, complete code
// to the edge_function_sources table — not stubs.
//
// The ?raw suffix tells Vite to import the file content as a string at build time.

import dailyReminders from "../../supabase/functions/daily-reminders/index.ts?raw";
import stripeCheckout from "../../supabase/functions/stripe-checkout/index.ts?raw";
import stripeInvoices from "../../supabase/functions/stripe-invoices/index.ts?raw";
import stripePayout from "../../supabase/functions/stripe-payout/index.ts?raw";
import stripePortal from "../../supabase/functions/stripe-portal/index.ts?raw";
import stripeOnboard from "../../supabase/functions/stripe-onboard/index.ts?raw";
import stripeWebhook from "../../supabase/functions/stripe-webhook/index.ts?raw";
import stripeCancelSubscription from "../../supabase/functions/stripe-cancel-subscription/index.ts?raw";
import crmWebhook from "../../supabase/functions/crm-webhook/index.ts?raw";
import processNotifications from "../../supabase/functions/process-notifications/index.ts?raw";
import deployTerritory from "../../supabase/functions/deploy-territory/index.ts?raw";
import geocode from "../../supabase/functions/geocode/index.ts?raw";
import stripeStatus from "../../supabase/functions/stripe-status/index.ts?raw";
import royaltyProcessor from "../../supabase/functions/royalty-processor/index.ts?raw";
import royaltySummary from "../../supabase/functions/royalty-summary/index.ts?raw";
import royaltyStripeKeys from "../../supabase/functions/royalty-stripe-keys/index.ts?raw";
import paymentPlanApprove from "../../supabase/functions/payment-plan-approve/index.ts?raw";
import dailyDigest from "../../supabase/functions/daily-digest/index.ts?raw";
import sendPush from "../../supabase/functions/send-push/index.ts?raw";
import scheduler from "../../supabase/functions/scheduler/index.ts?raw";
import scheduledJobsSchema from "../../supabase/migrations/20260901000000_scheduled_jobs.sql?raw";
import pushSchema from "../../supabase/migrations/20260829000001_push_subscriptions.sql?raw";
import masterSql from "../../supabase/migrations/20260803000000_schema.sql?raw";

export const EDGE_FUNCTION_SOURCES: Record<string, string> = {
  "daily-reminders": dailyReminders,
  "stripe-checkout": stripeCheckout,
  "stripe-invoices": stripeInvoices,
  "stripe-payout": stripePayout,
  "stripe-portal": stripePortal,
  "stripe-onboard": stripeOnboard,
  "stripe-webhook": stripeWebhook,
  "stripe-cancel-subscription": stripeCancelSubscription,
  "stripe-status": stripeStatus,
  "crm-webhook": crmWebhook,
  "deploy-territory": deployTerritory,
  geocode: geocode,
  "royalty-processor": royaltyProcessor,
  "royalty-summary": royaltySummary,
  "royalty-stripe-keys": royaltyStripeKeys,
  "payment-plan-approve": paymentPlanApprove,
  "process-notifications": processNotifications,
  "daily-digest": dailyDigest,
  "send-push": sendPush,
  scheduler: scheduler,
  master_sql: masterSql,
  scheduled_jobs_schema: scheduledJobsSchema,
  push_schema: pushSchema,
};
