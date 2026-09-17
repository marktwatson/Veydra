import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export interface SendProposalResult {
  success: boolean;
  action: string;
  sent_at?: string;
  expires_at?: string;
  sent_count?: number;
  publicUrl?: string;
  message?: any;
  error?: string;
  expired?: boolean;
}

/**
 * Calls the send-proposal edge function to email + SMS the client their
 * proposal link and start (or reset) the 48-hour clock.
 *
 * - First send: sent_at = now, expires_at = now + 48h, sent_count = 1
 * - resend (not expired): re-send, do NOT move expires_at, sent_count++
 * - extend: expires_at = now + 48h (optionally resend)
 */
export async function sendProposalToClient(
  proposalId: string,
  opts?: { resend?: boolean; extend?: boolean },
): Promise<SendProposalResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const functionUrl = `${supabaseUrl}/functions/v1/send-proposal`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      proposalId,
      resend: opts?.resend ?? false,
      extend: opts?.extend ?? false,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    const err = new Error(result.error || "Failed to send proposal");
    (err as any).result = result;
    throw err;
  }
  return result as SendProposalResult;
}
