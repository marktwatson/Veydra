import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { logManualAdjustment } from "@/lib/payment-manual-adjustments";
import { healOffPlatformColumns } from "@/lib/off-platform-payment";

export type PaidInFullMethod =
  "card" | "venmo" | "cashapp" | "zelle" | "cash" | "other";

/** Always-available methods (Card/GHL is the on-platform invoice path). */
export const BASE_PAID_IN_FULL_METHODS: {
  value: PaidInFullMethod;
  label: string;
}[] = [
  { value: "card", label: "Card / GHL invoice" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

/** All methods (used when nothing is configured / fallback). */
export const PAID_IN_FULL_METHODS: {
  value: PaidInFullMethod;
  label: string;
}[] = [
  { value: "card", label: "Card / GHL invoice" },
  { value: "venmo", label: "Venmo" },
  { value: "cashapp", label: "Cash App" },
  { value: "zelle", label: "Zelle" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

/** Off-platform alt methods that map to a PIF method value. */
const ALT_METHOD_META: {
  setting: "accept_venmo" | "accept_cashapp" | "accept_zelle";
  handle: "venmo_handle" | "cashapp_cashtag" | "zelle_target";
  value: PaidInFullMethod;
  label: string;
}[] = [
  {
    setting: "accept_venmo",
    handle: "venmo_handle",
    value: "venmo",
    label: "Venmo",
  },
  {
    setting: "accept_cashapp",
    handle: "cashapp_cashtag",
    value: "cashapp",
    label: "Cash App",
  },
  {
    setting: "accept_zelle",
    handle: "zelle_target",
    value: "zelle",
    label: "Zelle",
  },
];

/**
 * Build the staff "Paid in full" method dropdown.
 * Always includes Card/GHL + Cash + Other, plus any OFFERED alt method
 * (accept_* true AND handle non-empty).
 */
export async function buildPaidInFullMethods(): Promise<
  { value: PaidInFullMethod; label: string }[]
> {
  const methods = [...BASE_PAID_IN_FULL_METHODS];
  try {
    await healOffPlatformColumns();
    const { data } = await supabase
      .from("portal_settings")
      .select(
        "accept_venmo, venmo_handle, accept_cashapp, cashapp_cashtag, accept_zelle, zelle_target",
      )
      .limit(1)
      .maybeSingle();
    for (const meta of ALT_METHOD_META) {
      if (data && data[meta.setting] && (data[meta.handle] as string)?.trim()) {
        methods.push({ value: meta.value, label: meta.label });
      }
    }
  } catch {
    /* ignore — base methods are enough */
  }
  return methods;
}

export interface PaidInFullInput {
  weddingId: string;
  method: PaidInFullMethod;
  activate: boolean;
}

export interface PaidInFullResult {
  success: boolean;
  remaining: number;
  newPaidAmount: number;
  totalAmount: number;
  activated: boolean;
  undone?: boolean;
  error?: string;
}

/**
 * Mark a wedding "Paid in full" for an off-platform collection
 * (Venmo / Cash App / Zelle / Cash / Other). No Stripe, no GHL invoice.
 *
 * Writes:
 *  1. weddings: paid_amount = total_amount, final_payment_verified = true
 *     (optional status = "upcoming" + contract_date if activate checked)
 *  2. payment_manual_adjustments: amount = remaining (positive)
 *  3. royalty_sales: one row for the remaining amount (idempotent by
 *     stripe_charge_id = "manual:pif:{weddingId}")
 *
 * Undo reverses the paid_amount by the same remaining, logs a negative
 * adjustment, and inserts a refund royalty_sales row. Does not change status.
 */
export async function markPaidInFull(
  input: PaidInFullInput,
): Promise<PaidInFullResult> {
  const { weddingId, method, activate } = input;

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, client_name, total_amount, paid_amount, status, contract_date")
    .eq("id", weddingId)
    .maybeSingle();

  if (!wedding) {
    return {
      success: false,
      error: "Wedding not found",
      remaining: 0,
      newPaidAmount: 0,
      totalAmount: 0,
      activated: false,
    };
  }

  const total = Number(wedding.total_amount) || 0;
  const currentPaid = Number(wedding.paid_amount) || 0;
  const remaining = Math.max(0, total - currentPaid);

  if (remaining <= 0.01) {
    return {
      success: false,
      error: "Nothing remaining — this wedding is already paid in full.",
      remaining: 0,
      newPaidAmount: currentPaid,
      totalAmount: total,
      activated: false,
    };
  }

  // 1. Weddings update
  const update: Record<string, any> = {
    paid_amount: total,
    final_payment_verified: true,
  };
  if (activate && wedding.status !== "cancelled") {
    update.status = "upcoming";
    if (!wedding.contract_date) {
      update.contract_date = new Date().toISOString().split("T")[0];
    }
  }
  await api.updateWedding(weddingId, update);

  // 2. Manual adjustment ledger
  await logManualAdjustment({
    weddingId,
    amount: remaining,
    installmentLabel: "Paid in full",
    reason: `Manual PIF — ${method} — ${wedding.client_name || "client"}`,
  });

  // 3. Royalty sale (idempotent)
  await insertRoyaltySale({
    weddingId,
    amount: remaining,
    description: `Manual PIF — ${method} — ${wedding.client_name || "client"}`,
    chargeId: `manual:pif:${weddingId}`,
    isRefund: false,
  });

  await api.logAdminActivity(
    "Marked Paid in Full",
    `Marked ${wedding.client_name || weddingId} paid in full via ${method}. Remaining $${remaining.toLocaleString()} → paid_amount $${total.toLocaleString()}.${activate ? " Wedding activated (upcoming)." : ""}`,
  );

  return {
    success: true,
    remaining,
    newPaidAmount: total,
    totalAmount: total,
    activated: activate,
  };
}

export async function undoPaidInFull(
  weddingId: string,
): Promise<PaidInFullResult> {
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, client_name, total_amount, paid_amount, status")
    .eq("id", weddingId)
    .maybeSingle();

  if (!wedding) {
    return {
      success: false,
      error: "Wedding not found",
      remaining: 0,
      newPaidAmount: 0,
      totalAmount: 0,
      activated: false,
    };
  }

  const total = Number(wedding.total_amount) || 0;
  const currentPaid = Number(wedding.paid_amount) || 0;

  // Find the original PIF royalty sale to know the exact remaining that was applied.
  const { data: pifSale } = await supabase
    .from("royalty_sales")
    .select("sale_amount")
    .eq("stripe_charge_id", `manual:pif:${weddingId}`)
    .eq("is_refund", false)
    .maybeSingle();

  const remaining = pifSale
    ? Number(pifSale.sale_amount) || 0
    : Math.max(0, currentPaid - Math.max(0, currentPaid - total));
  const newPaid = Math.max(0, currentPaid - remaining);

  await api.updateWedding(weddingId, {
    paid_amount: newPaid,
    final_payment_verified: false,
  });

  await logManualAdjustment({
    weddingId,
    amount: -remaining,
    installmentLabel: "Paid in full",
    reason: `Undo manual PIF — ${wedding.client_name || "client"}`,
  });

  await insertRoyaltySale({
    weddingId,
    amount: remaining,
    description: `Undo Manual PIF — ${wedding.client_name || "client"}`,
    chargeId: `manual:pif:${weddingId}:undo`,
    isRefund: true,
  });

  await api.logAdminActivity(
    "Undid Paid in Full",
    `Reversed paid-in-full for ${wedding.client_name || weddingId}. paid_amount $${currentPaid.toLocaleString()} → $${newPaid.toLocaleString()}.`,
  );

  return {
    success: true,
    remaining,
    newPaidAmount: newPaid,
    totalAmount: total,
    activated: false,
    undone: true,
  };
}

async function insertRoyaltySale(args: {
  weddingId: string;
  amount: number;
  description: string;
  chargeId: string;
  isRefund: boolean;
}): Promise<void> {
  try {
    // Resolve the territory for this area.
    const { data: primaryTerr } = await supabase
      .from("territories")
      .select("id")
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    let territoryId = primaryTerr?.id;
    if (!territoryId) {
      const { data: anyTerr } = await supabase
        .from("territories")
        .select("id")
        .limit(1)
        .maybeSingle();
      territoryId = anyTerr?.id;
    }
    if (!territoryId) return;

    // Idempotency: skip if this charge id already exists.
    const { data: dup } = await supabase
      .from("royalty_sales")
      .select("id")
      .eq("stripe_charge_id", args.chargeId)
      .maybeSingle();
    if (dup) return;

    await supabase.from("royalty_sales").insert({
      territory_id: territoryId,
      wedding_id: args.weddingId,
      sale_amount: args.amount,
      sale_date: new Date().toISOString().split("T")[0],
      description: args.description,
      is_refund: args.isRefund,
      stripe_charge_id: args.chargeId,
    });
  } catch (e: any) {
    console.warn("[paid-in-full] royalty sale failed:", e?.message);
  }
}

/** Whether a wedding has an existing manual PIF record (for button label). */
export async function isPaidInFullManual(weddingId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("royalty_sales")
      .select("id")
      .eq("stripe_charge_id", `manual:pif:${weddingId}`)
      .eq("is_refund", false)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
