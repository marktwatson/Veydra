import { useState, useEffect } from "react";

/**
 * Formats the remaining time until `expiresAt` as a compact string.
 * Returns "Expired" when the deadline has passed.
 *
 * Examples: "2d 5h 30m", "5h 12m", "12m", "Expired"
 */
export function formatRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(" ");
}

/**
 * Tiny hook that re-renders every 30s so the countdown stays live.
 * Returns { remaining, isExpired }.
 */
export function useCountdown(expiresAt: string | null | undefined): {
  remaining: string;
  isExpired: boolean;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return { remaining: "", isExpired: false };
  const ms = new Date(expiresAt).getTime() - Date.now();
  return {
    remaining: formatRemaining(expiresAt),
    isExpired: ms <= 0,
  };
}

/**
 * True when the proposal is sent + past expires_at + not booked.
 */
export function isProposalExpired(proposal: any): boolean {
  if (!proposal?.sent_at || !proposal?.expires_at) return false;
  if (
    proposal.status === "accepted" ||
    proposal.status === "paid" ||
    proposal.status === "upcoming"
  )
    return false;
  return new Date(proposal.expires_at) < new Date();
}
