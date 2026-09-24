import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export type SalesRange = 1 | 7 | 30;

export type SalesGrade = "Critical" | "High" | "Medium" | "Low";

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
  signal?: string;
  automationOnly?: boolean;
  replyHours?: number | null;
  grade?: SalesGrade;
  multiUnanswered?: boolean;
  followedUp?: boolean;
  source?: string;
  dateAdded?: string | null;
  createdDay?: string;
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
  total?: number;
  callPct?: number;
  callRatio: number;
  outreachPct?: number;
  contactedLast24h?: number;
  contactedInRange?: number;
  automationOnly: SalesActivityRow[];
  emailBlindSpotWarning: boolean;
}

export interface SalesResponsePerformance {
  count: number;
  avgHours: number | null;
  slaBreaches: number;
  slaThresholdHours: number;
  slowestName: string | null;
  slowestHours: number | null;
}

export interface SalesFunnel {
  new: number;
  contacted: number;
  engaged: number;
  proposal_sent: number;
  booked: number;
  total: number;
  windowNewLeadsCount?: number;
}

export interface SalesLeadIntel {
  contactId: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  weddingDate: string | null;
  estimatedValue: number | null;
  daysSinceFirstContact: number | null;
  stage: string;
  lastActivityDate: string | null;
  lastChannel: string | null;
  hoursAgo: number | null;
  dateAdded?: string | null;
  isNewInWindow?: boolean;
  dnd?: boolean;
}

export interface SalesHistoryRun {
  ran_at: string;
  range: number;
  pool_size: number;
  needs_reply_count: number;
  going_cold_count: number;
  opted_out_count: number;
  avg_response_hours: number | null;
  sla_breaches: number;
  funnel: SalesFunnel | null;
  channel_mix: SalesChannelMix | null;
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
  range?: number;
  rangeLabel?: string;
  poolSize: number;
  windowNewLeadsCount?: number;
  poolSource?: string;
  companyName?: string;
  reportText?: string;
  htmlReport?: string;
  emailResult?: { subject: string; recipients: SalesEmailRecipient[] } | null;
  priorities: SalesPriority[];
  needsReply: SalesActivityRow[];
  ghostLeads?: SalesActivityRow[];
  missedCalls?: SalesActivityRow[];
  emailBlindSpot: SalesActivityRow[];
  goingCold: SalesActivityRow[];
  goingColdTotal?: number;
  optedOut: SalesActivityRow[];
  automationOnly?: SalesActivityRow[];
  weekendCatchUp?: SalesActivityRow[] | null;
  channelMix: SalesChannelMix;
  goingWell: SalesActivityRow[];
  responsePerformance?: SalesResponsePerformance;
  funnel?: SalesFunnel;
  leadIntel?: SalesLeadIntel[];
  history?: SalesHistoryRun[];
  errors: string[];
  error?: string;
}

export interface SalesRecipientChoice {
  email: string;
  name?: string;
  role?: string;
}

export async function runSalesActivityReport(opts?: {
  sendEmail?: boolean;
  recipients?: SalesRecipientChoice[];
  range?: SalesRange;
  includeHistory?: boolean;
}): Promise<SalesActivityResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let userEmail = session?.user?.email || "";
  if (!userEmail) {
    try {
      const imp = localStorage.getItem("impersonated_user");
      if (imp) {
        const parsed = JSON.parse(imp);
        if (parsed.email) userEmail = parsed.email;
      }
    } catch (_e) {}
  }

  const functionUrl = `${supabaseUrl}/functions/v1/sales-activity`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
      "x-user-email": userEmail,
    },
    body: JSON.stringify({
      sendEmail: opts?.sendEmail ?? false,
      recipients: opts?.recipients ?? undefined,
      callerEmail: userEmail,
      range: opts?.range ?? 1,
      includeHistory: opts?.includeHistory ?? true,
    }),
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
