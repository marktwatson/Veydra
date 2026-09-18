import { Badge } from "@/components/ui/badge";
import { useCountdown, isProposalExpired } from "@/lib/proposal-countdown";
import { isBooked } from "@/lib/proposal-tabs";

/**
 * Compact live countdown badge for the Proposals table.
 * Only renders when the proposal has been sent and is not booked.
 */
export function ProposalCountdownBadge({ proposal }: { proposal: any }) {
  if (!proposal?.sent_at || !proposal?.expires_at) return null;
  if (isBooked(proposal)) return null;

  const { remaining, isExpired } = useCountdown(proposal.expires_at);

  if (isExpired) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        Expired
      </Badge>
    );
  }

  return (
    <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20 text-[10px]">
      Expires in {remaining}
    </Badge>
  );
}

export { isProposalExpired };
