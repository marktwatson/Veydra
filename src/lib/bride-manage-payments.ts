import type { DbWedding } from "@/lib/api";

/**
 * Resolve the best GHL invoice URL for a wedding.
 * Order: explicit ghl_invoice_url → latest ghl_schedule row url →
 * built from ghl_invoice_id + portal base url.
 */
export function resolveGhlInvoiceUrl(
  wedding: DbWedding | null,
  portalGhlBaseUrl?: string | null,
): string | null {
  if (!wedding) return null;
  const w = wedding as any;

  // 1) Explicit saved URL
  if (w.ghl_invoice_url) return String(w.ghl_invoice_url);

  // 2) Latest schedule row that has a url
  try {
    const sched = w.ghl_schedule;
    if (Array.isArray(sched)) {
      const withUrl = sched.filter((r: any) => r?.url);
      if (withUrl.length) return String(withUrl[withUrl.length - 1].url);
    }
  } catch {
    /* ignore */
  }

  // 3) Build from id + portal base url
  if (w.ghl_invoice_id) {
    const base =
      (portalGhlBaseUrl && String(portalGhlBaseUrl).replace(/\/+$/, "")) ||
      "https://links.msgsndr.com";
    return `${base}/invoice/${w.ghl_invoice_id}`;
  }

  return null;
}

export type ManagePaymentsResult =
  | { action: "open"; url: string }
  | { action: "stripe-portal" }
  | { action: "offplatform-note" }
  | { action: "none" };

/**
 * Decide what the "Update card / pay invoice" button should do, given the
 * wedding + portal settings. Does not create customers or charge anything.
 *
 * Order:
 * 1. GHL invoice URL → open in new tab
 * 2. Off-platform promised/claimed → short note (no card)
 * 3. Legacy stripe_customer_id → open stripe-portal (refunds / old invoices)
 * 4. Nothing on file → toast
 */
export function resolveManagePaymentsAction(
  wedding: DbWedding | null,
  portalGhlBaseUrl?: string | null,
): ManagePaymentsResult {
  if (!wedding) return { action: "none" };

  const ghlUrl = resolveGhlInvoiceUrl(wedding, portalGhlBaseUrl);
  if (ghlUrl) return { action: "open", url: ghlUrl };

  const w = wedding as any;
  const offStatus = w.offplatform_status;
  if (offStatus === "promised" || offStatus === "claimed") {
    return { action: "offplatform-note" };
  }

  if (wedding.stripe_customer_id) {
    return { action: "stripe-portal" };
  }

  return { action: "none" };
}
