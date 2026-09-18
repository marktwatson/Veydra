import { useCountdown, isProposalExpired } from "@/lib/proposal-countdown";

/**
 * Renders the live countdown banner at the top of the public proposal page
 * AND the full expired overlay (hides Sign & Pay on every step).
 *
 * Props:
 * - proposal: the proposal row (needs sent_at, expires_at, status)
 * - isBooked: whether the wedding is booked (suppresses expiry)
 *
 * When expired + not booked, returns ONLY the overlay (caller should hide
 * the rest of the page content).
 */
export function ProposalExpiryBanner({
  proposal,
  isBooked,
}: {
  proposal: any;
  isBooked: boolean;
}) {
  const sent = !!proposal?.sent_at;
  const expired = sent && isProposalExpired(proposal) && !isBooked;
  const { remaining, isExpired } = useCountdown(
    sent && !expired ? proposal?.expires_at : null,
  );

  if (expired) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4">
        <div className="max-w-md w-full text-center bg-card border border-border rounded-lg shadow-2xl p-10">
          <h2 className="text-3xl font-serif text-foreground mb-4">
            This proposal has expired
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            The review window for this proposal has closed. Please contact your
            manager to request an extension or a new proposal.
          </p>
        </div>
      </div>
    );
  }

  if (!sent || !proposal?.expires_at || isExpired) return null;

  const ms = proposal?.expires_at
    ? new Date(proposal.expires_at).getTime() - Date.now()
    : 0;
  const isUrgent = ms < 2 * 60 * 60 * 1000;

  return (
    <div className="mb-6 text-center">
      <span
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-sans whitespace-nowrap ${
          isUrgent
            ? "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300"
            : "bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300"
        }`}
      >
        {remaining}
      </span>
    </div>
  );
}

/** Returns true when the proposal is expired + not booked (overlay should
 *  hide all page content including Sign & Pay). */
export function shouldHideForExpiry(proposal: any, isBooked: boolean): boolean {
  return !!proposal?.sent_at && isProposalExpired(proposal) && !isBooked;
}
