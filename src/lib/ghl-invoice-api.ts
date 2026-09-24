import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export interface GhlAddonInstallment {
  date: string;
  amount: number;
  label?: string;
}

export async function createGhlInvoice({
  weddingId,
  amount,
  label,
  kind,
  installments,
  forceNew,
  proposalEmail,
}: {
  weddingId: string;
  amount: number;
  label?: string;
  kind?: "addon";
  installments?: GhlAddonInstallment[];
  forceNew?: boolean;
  proposalEmail?: string;
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const functionUrl = `${supabaseUrl}/functions/v1/ghl-invoice`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      weddingId,
      amount,
      label,
      kind,
      installments,
      forceNew,
      proposalEmail,
    }),
  });
  const result = await response.json();
  // Return success when we have a usable invoiceUrl — even if the scheduled
  // invoice failed and the edge function fell back to a plain firstDue invoice
  // (scheduleError will be set). Only throw when there is NO invoiceUrl.
  if (!response.ok || !result.invoiceUrl) {
    const errParts = [result.error || "Failed to create CRM invoice"];
    if (result.ghlBodyPreview) errParts.push(`CRM: ${result.ghlBodyPreview}`);
    throw new Error(errParts.join(" — "));
  }
  return result as {
    success: boolean;
    invoiceId: string;
    invoiceUrl: string;
    contactId: string;
    clientName: string;
    amount: number;
    reused?: boolean;
    isAddon?: boolean;
    scheduleError?: string;
  };
}

/**
 * Pull all CRM invoices for a wedding's contact and recompute paid_amount +
 * schedule using the same idempotent running-total rules as the webhook.
 */
export async function syncGhlInvoices(weddingId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const functionUrl = `${supabaseUrl}/functions/v1/ghl-invoice`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ weddingId, action: "sync" }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to sync CRM invoices");
  }
  return result as {
    success: boolean;
    synced: boolean;
    invoiceCount: number;
    totalPaidDelta: number;
    paid_amount: number;
    scheduleRows: number;
  };
}
