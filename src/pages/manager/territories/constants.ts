export const THIS_PROJECT_REF = "oosmhtzqdmntlzhheofw";
export const THIS_SUPABASE_URL = "https://oosmhtzqdmntlzhheofw.supabase.co";

export interface Territory {
  id: string;
  name: string;
  project_ref: string;
  supabase_url: string;
  access_token: string;
  last_synced_at: string | null;
  last_sync_status: string;
  last_sync_result: any;
  is_primary: boolean;
  created_at: string;
}

// Every edge function that can be individually deployed via Manual Deploy.
// Keep this in sync with EDGE_FUNCTION_SOURCES in src/lib/edge-function-sources.ts.
export const ALL_FUNCTION_NAMES = [
  "daily-reminders",
  "stripe-checkout",
  "stripe-invoices",
  "stripe-payout",
  "stripe-portal",
  "stripe-onboard",
  "stripe-webhook",
  "stripe-status",
  "stripe-cancel-subscription",
  "crm-webhook",
  "process-notifications",
  "deploy-territory",
  "geocode",
  "royalty-processor",
  "royalty-summary",
  "royalty-stripe-keys",
  "payment-plan-approve",
  "daily-digest",
  "send-push",
  "scheduler",
];
