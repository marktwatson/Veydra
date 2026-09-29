import { supabaseUrl, supabaseAnonKey } from "./supabase";

export interface PublicProposalListItem {
  id: string;
  client_name: string | null;
  wedding_date: string | null;
  total_amount: number;
  status: string | null;
  sent_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  link: string;
}

/**
 * Calls the public-list-proposals edge function to fetch the proposals a
 * salesperson built for a given area, matched by their email. The area PIN
 * (if any) is validated server-side with per-IP rate limiting.
 *
 * `verifyOnly: true` skips the listing and ONLY validates the PIN — used by
 * the gate modal to unlock the builder without exposing the stored PIN.
 */
export async function publicListProposals(input: {
  slug: string;
  salespersonEmail: string;
  pin?: string;
  verifyOnly?: boolean;
}): Promise<PublicProposalListItem[]> {
  const functionUrl = `${supabaseUrl}/functions/v1/public-list-proposals`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    const err = new Error(result.error || "Failed to load proposals");
    (err as any).retryAfter = result.retryAfter;
    (err as any).attemptsRemaining = result.attemptsRemaining;
    throw err;
  }
  return (result.proposals || []) as PublicProposalListItem[];
}
