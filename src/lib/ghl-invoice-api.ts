import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export async function createGhlInvoice({
  weddingId,
  amount,
  label,
}: {
  weddingId: string;
  amount: number;
  label?: string;
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
    body: JSON.stringify({ weddingId, amount, label }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to create CRM invoice");
  }
  return result as {
    success: boolean;
    invoiceId: string;
    invoiceUrl: string;
    contactId: string;
    clientName: string;
    amount: number;
    reused?: boolean;
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
