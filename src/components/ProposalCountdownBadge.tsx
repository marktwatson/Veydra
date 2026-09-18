import { useCountdown, isProposalExpired } from "@/lib/proposal-countdown";
import { isBooked } from "@/lib/proposal-tabs";

/**
 * Compact live countdown for the Proposals table Status cell.
 * Rendered as a single-line span (NOT a Badge / pill), nowrap.
 * Only renders when the proposal has been sent and is not booked.
 */
export function ProposalCountdownBadge({ proposal }: { proposal: any }) {
  if (!proposal?.sent_at || !proposal?.expires_at) return null;
  if (isBooked(proposal)) return null;

  const { remaining, isExpired } = useCountdown(proposal.expires_at);

  if (isExpired) {
    return (
      <span className="text-[11px] leading-tight tabular-nums text-destructive whitespace-nowrap pl-0.5">
        Expired
      </span>
    );
  }

  if (!remaining) return null;

  const ms = new Date(proposal.expires_at).getTime() - Date.now();
  const isUrgent = ms < 2 * 60 * 60 * 1000;

  return (
    <span
      className={`text-[11px] leading-tight tabular-nums whitespace-nowrap pl-0.5 ${
        isUrgent ? "text-amber-700 font-medium" : "text-muted-foreground"
      }`}
    >
      {remaining}
    </span>
  );
}

export { isProposalExpired };
