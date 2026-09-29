import { supabaseUrl, supabaseAnonKey } from "./supabase";

export interface PublicCreateProposalInput {
  slug: string;
  salespersonName?: string;
  salespersonEmail?: string;
  /** The area PIN the salesperson entered. Validated server-side (never
   *  compared in the browser). Required only if the area has a PIN set. */
  pin?: string;
  proposal: {
    client_name: string;
    client_email: string;
    client_phone: string;
    partner_name?: string;
    wedding_date: string;
    is_lgbtq?: boolean;
    venue?: string;
    venue_address?: string;
    city: string;
    state: string;
    coverage_type?: string;
    package_id?: string | null;
    addons?: string[];
    second_shooter_hours?: number;
    second_shooter_type?: string;
    total_amount: number;
    notes?: string;
    custom_discount?: number;
    custom_discount_type?: string;
    custom_items?: {
      id: string;
      name: string;
      price: number;
      description: string;
    }[];
    custom_payment_plan?: {
      enabled: boolean;
      deposit: number;
      installments: { date: string; amount: number }[];
    };
  };
}

export interface PublicCreateProposalResult {
  success: boolean;
  proposalId: string;
  link: string;
  territoryId: string;
}

/**
 * Calls the public-create-proposal edge function (service role) to insert a
 * proposal row scoped to the territory resolved from the slug. The area PIN
 * (if any) is validated server-side with per-IP rate limiting; no login
 * required — this is the unauthenticated salesperson path.
 */
export async function publicCreateProposal(
  input: PublicCreateProposalInput,
): Promise<PublicCreateProposalResult> {
  const functionUrl = `${supabaseUrl}/functions/v1/public-create-proposal`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(input),
  });
  let result: any = {};
  try {
    result = await response.json();
  } catch {
    throw new Error(`Failed to create proposal (HTTP ${response.status})`);
  }
  if (!response.ok || !result.success) {
    const detail = result.detail ? ` — ${result.detail}` : "";
    const err = new Error(
      `${result.error || "Failed to create proposal"}${detail}`,
    );
    (err as any).retryAfter = result.retryAfter;
    (err as any).attemptsRemaining = result.attemptsRemaining;
    throw err;
  }
  return result as PublicCreateProposalResult;
}
