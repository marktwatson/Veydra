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
 * salesperson built for a given area, matched by their email. Gated by the
 * area PIN if one is set.
 */
export async function publicListProposals(input: {
  slug: string;
  salespersonEmail: string;
  pin?: string;
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
    throw new Error(result.error || "Failed to load proposals");
  }
  return result.proposals as PublicProposalListItem[];
}
