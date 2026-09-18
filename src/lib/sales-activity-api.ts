import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export interface SalesActivityRow {
  contactId?: string;
  name?: string;
  phone?: string;
  email?: string;
  hoursAgo?: number | null;
  daysAgo?: number | null;
  channel?: string;
  snippet?: string;
  what?: string;
  note?: string;
  automationOnly?: boolean;
}

export interface SalesPriority {
  name: string;
  action: string;
  why: string;
  contactId?: string;
  hoursAgo?: number | null;
}

export interface SalesChannelMix {
  calls: number;
  manualSms: number;
  email: number;
  automation: number;
  voicemail?: number;
  callPct?: number;
  callRatio: number;
  contactedLast24h?: number;
  automationOnly: SalesActivityRow[];
  emailBlindSpotWarning: boolean;
}

export interface SalesEmailRecipient {
  email: string;
  contactId?: string;
  status: string;
  code?: number;
  body?: string;
  error?: string;
}

export interface SalesActivityResult {
  ranAt: string;
  poolSize: number;
  poolSource?: string;
  reportText?: string;
  emailResult?: { subject: string; recipients: SalesEmailRecipient[] } | null;
  priorities: SalesPriority[];
  needsReply: SalesActivityRow[];
  emailBlindSpot: SalesActivityRow[];
  goingCold: SalesActivityRow[];
  optedOut: SalesActivityRow[];
  channelMix: SalesChannelMix;
  goingWell: SalesActivityRow[];
  errors: string[];
  error?: string;
}

export async function runSalesActivityReport(opts?: {
  sendEmail?: boolean;
}): Promise<SalesActivityResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const functionUrl = `${supabaseUrl}/functions/v1/sales-activity`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ sendEmail: opts?.sendEmail ?? false }),
  });
  const result = await response
    .json()
    .catch(() => ({ error: "Invalid response" }));
  if (!response.ok) {
    const err = new Error(result.error || "Failed to run report");
    (err as any).result = result;
    throw err;
  }
  return result as SalesActivityResult;
}
