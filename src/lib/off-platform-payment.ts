import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { logManualAdjustment } from "@/lib/payment-manual-adjustments";

export type OffPlatformMethod = "venmo" | "cashapp" | "zelle";

export const OFF_PLATFORM_METHODS: {
  value: OffPlatformMethod;
  label: string;
  handleKey: "venmo_handle" | "cashapp_cashtag" | "zelle_target";
  handleLabel: string;
  handlePrefix: string;
}[] = [
  {
    value: "venmo",
    label: "Venmo",
    handleKey: "venmo_handle",
    handleLabel: "Venmo handle",
    handlePrefix: "@",
  },
  {
    value: "cashapp",
    label: "Cash App",
    handleKey: "cashapp_cashtag",
    handleLabel: "Cash App $cashtag",
    handlePrefix: "$",
  },
  {
    value: "zelle",
    label: "Zelle",
    handleKey: "zelle_target",
    handleLabel: "Zelle target (email/phone)",
    handlePrefix: "",
  },
];

/** Self-heal the portal_settings + weddings columns needed for off-platform. */
const OFF_PLATFORM_HEAL_SQL = `
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS accept_venmo boolean DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS venmo_handle text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS accept_cashapp boolean DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS cashapp_cashtag text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS accept_zelle boolean DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS zelle_target text;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS offplatform_status text;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS offplatform_method text;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS offplatform_amount numeric;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS offplatform_claimed_at timestamptz;
NOTIFY pgrst, 'reload schema';
`;

export async function healOffPlatformColumns(): Promise<void> {
  try {
    await supabase.rpc("exec_sql", { sql_text: OFF_PLATFORM_HEAL_SQL });
  } catch (e: any) {
    console.warn("[off-platform] heal failed:", e?.message);
  }
}

export interface OffPlatformConfig {
  venmo: { enabled: boolean; handle: string };
  cashapp: { enabled: boolean; handle: string };
  zelle: { enabled: boolean; handle: string };
}

export async function getOffPlatformConfig(): Promise<OffPlatformConfig> {
  await healOffPlatformColumns();
  const { data } = await supabase
    .from("portal_settings")
    .select(
      "accept_venmo, venmo_handle, accept_cashapp, cashapp_cashtag, accept_zelle, zelle_target",
    )
    .limit(1)
    .maybeSingle();
  return {
    venmo: {
      enabled: !!data?.accept_venmo,
      handle: (data?.venmo_handle as string) || "",
    },
    cashapp: {
      enabled: !!data?.accept_cashapp,
      handle: (data?.cashapp_cashtag as string) || "",
    },
    zelle: {
      enabled: !!data?.accept_zelle,
      handle: (data?.zelle_target as string) || "",
    },
  };
}

/** Which methods are actually available (enabled + handle set). */
export function availableMethods(
  config: OffPlatformConfig,
): OffPlatformMethod[] {
  const out: OffPlatformMethod[] = [];
  if (config.venmo.enabled && config.venmo.handle) out.push("venmo");
  if (config.cashapp.enabled && config.cashapp.handle) out.push("cashapp");
  if (config.zelle.enabled && config.zelle.handle) out.push("zelle");
  return out;
}

export interface ClaimOffPlatformInput {
  weddingId: string;
  method: OffPlatformMethod;
  amount: number;
}

export interface ClaimOffPlatformResult {
  success: boolean;
  error?: string;
}

/**
 * Bride clicks "I made a payment" for an off-platform method.
 * Records the claim (status "claimed"). Does NOT change paid_amount,
 * status, or create a GHL invoice.
 */
export async function claimOffPlatformPayment(
  input: ClaimOffPlatformInput,
): Promise<ClaimOffPlatformResult> {
  const { weddingId, method, amount } = input;
  await healOffPlatformColumns();
  try {
    const { data: wedding } = await supabase
      .from("weddings")
      .select("id, client_name")
      .eq("id", weddingId)
      .maybeSingle();
    const clientName = wedding?.client_name || "Client";

    const { error } = await supabase
      .from("weddings")
      .update({
        offplatform_status: "claimed",
        offplatform_method: method,
        offplatform_amount: amount,
        offplatform_claimed_at: new Date().toISOString(),
      })
      .eq("id", weddingId);

    if (error) throw error;

    notifyStaffClaim(clientName, method, amount, weddingId, "claimed").catch(
      () => {},
    );

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to record claim" };
  }
}

/**
 * Bride clicks "I'll pay later" for an off-platform method.
 * Records a promise (status "promised") — NOT a claim. Same method + amount.
 * Does NOT change paid_amount, status, or create a GHL invoice.
 */
export async function promiseOffPlatformPayment(
  input: ClaimOffPlatformInput,
): Promise<ClaimOffPlatformResult> {
  const { weddingId, method, amount } = input;
  await healOffPlatformColumns();
  try {
    const { data: wedding } = await supabase
      .from("weddings")
      .select("id, client_name")
      .eq("id", weddingId)
      .maybeSingle();
    const clientName = wedding?.client_name || "Client";

    const { error } = await supabase
      .from("weddings")
      .update({
        offplatform_status: "promised",
        offplatform_method: method,
        offplatform_amount: amount,
        offplatform_claimed_at: new Date().toISOString(),
      })
      .eq("id", weddingId);

    if (error) throw error;

    notifyStaffClaim(clientName, method, amount, weddingId, "promised").catch(
      () => {},
    );

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to record promise" };
  }
}

async function notifyStaffClaim(
  clientName: string,
  method: string,
  amount: number,
  weddingId: string,
  status: "claimed" | "promised",
): Promise<void> {
  try {
    const isClaimed = status === "claimed";
    const verb = isClaimed ? "claims" : "is expected to send";
    const title = isClaimed
      ? `${clientName} claims ${method} $${amount.toLocaleString()}`
      : `Expected ${method} from ${clientName}`;
    const body = isClaimed
      ? `Off-platform payment pending confirmation`
      : `Bride promised ${method} $${amount.toLocaleString()} — not yet sent`;
    await api.sendAdminNotification(
      "booking",
      `${clientName} ${verb} ${method} $${amount.toLocaleString()} — review in Payment Audit.`,
      {},
    );
    await api.logAdminActivity(
      "booking",
      `[Off-platform ${status}] ${clientName} ${verb} ${method} $${amount.toLocaleString()} (wedding ${weddingId}). ${isClaimed ? "Pending staff confirmation." : "Pending — no payment sent yet."}`,
    );
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/send-push`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roles: ["owner", "super_admin"],
            category: "bookings_payments",
            title,
            body,
            url: "/manager/payments",
            tag: `offplatform-${weddingId}`,
          }),
        },
      );
    } catch {}
  } catch {}
}

/**
 * Staff confirms the off-platform claim. Writes paid_amount = total, royalty
 * sale + manual adjustment, final_payment_verified. Reuses the PIF ledger.
 */
export async function confirmOffPlatformClaim(
  weddingId: string,
): Promise<{ success: boolean; error?: string; remaining?: number }> {
  await healOffPlatformColumns();
  try {
    const { data: wedding } = await supabase
      .from("weddings")
      .select(
        "id, client_name, total_amount, paid_amount, offplatform_method, offplatform_amount",
      )
      .eq("id", weddingId)
      .maybeSingle();
    if (!wedding) return { success: false, error: "Wedding not found" };

    const total = Number(wedding.total_amount) || 0;
    const currentPaid = Number(wedding.paid_amount) || 0;
    const remaining = Math.max(0, total - currentPaid);
    if (remaining <= 0.01) {
      return { success: false, error: "Already paid in full" };
    }

    const method = wedding.offplatform_method || "other";

    // 1. Wedding: paid in full + clear claim flags.
    await api.updateWedding(weddingId, {
      paid_amount: total,
      final_payment_verified: true,
      offplatform_status: "confirmed",
      offplatform_claimed_at: new Date().toISOString(),
    } as any);

    // 2. Manual adjustment ledger.
    await logManualAdjustment({
      weddingId,
      amount: remaining,
      installmentLabel: "Paid in full",
      reason: `Off-platform confirm — ${method} — ${wedding.client_name || "client"}`,
    });

    // 3. Royalty sale (idempotent).
    await insertOffPlatformRoyaltySale({
      weddingId,
      amount: remaining,
      description: `Off-platform PIF — ${method} — ${wedding.client_name || "client"}`,
      chargeId: `manual:pif:${weddingId}`,
    });

    await api.logAdminActivity(
      "booking",
      `[Off-platform confirmed] ${method} $${remaining.toLocaleString()} for ${wedding.client_name || weddingId}. paid_amount → $${total.toLocaleString()}.`,
    );

    return { success: true, remaining };
  } catch (e: any) {
    return { success: false, error: e?.message || "Confirm failed" };
  }
}

/** Staff rejects/clears the claimed flags without changing paid_amount. */
export async function rejectOffPlatformClaim(
  weddingId: string,
): Promise<{ success: boolean; error?: string }> {
  await healOffPlatformColumns();
  try {
    const { error } = await supabase
      .from("weddings")
      .update({
        offplatform_status: null,
        offplatform_method: null,
        offplatform_amount: null,
        offplatform_claimed_at: null,
      })
      .eq("id", weddingId);
    if (error) throw error;
    await api.logAdminActivity(
      "booking",
      `[Off-platform rejected] Cleared off-platform payment claim for wedding ${weddingId}. paid_amount unchanged.`,
    );
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Reject failed" };
  }
}

export interface OffPlatformClaimState {
  status: string | null;
  method: string | null;
  amount: number | null;
  claimedAt: string | null;
}

export async function getOffPlatformClaim(
  weddingId: string,
): Promise<OffPlatformClaimState> {
  const { data } = await supabase
    .from("weddings")
    .select(
      "offplatform_status, offplatform_method, offplatform_amount, offplatform_claimed_at",
    )
    .eq("id", weddingId)
    .maybeSingle();
  return {
    status: (data?.offplatform_status as string) || null,
    method: (data?.offplatform_method as string) || null,
    amount:
      data?.offplatform_amount != null ? Number(data.offplatform_amount) : null,
    claimedAt: (data?.offplatform_claimed_at as string) || null,
  };
}

async function insertOffPlatformRoyaltySale(args: {
  weddingId: string;
  amount: number;
  description: string;
  chargeId: string;
}): Promise<void> {
  try {
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
      is_refund: false,
      stripe_charge_id: args.chargeId,
    });
  } catch (e: any) {
    console.warn("[off-platform] royalty sale failed:", e?.message);
  }
}
