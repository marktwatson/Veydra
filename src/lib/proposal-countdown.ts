import { useState, useEffect } from "react";

/**
 * Formats the remaining time until `expiresAt` as a single-line string.
 * Returns "Expired" when the deadline has passed.
 *
 * Examples: "1d 23h left", "2h left", "1h 46m left", "46m left", "Expired"
 * No "Expires in". No minutes when >= 2h. No newlines.
 */
export function formatRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  // >= 2 hours: days + hours only (no minutes)
  if (totalMinutes >= 120) {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    parts.push(`${hours}h`);
    return `${parts.join(" ")} left`;
  }
  // < 2 hours: hours + minutes (or just minutes)
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
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
