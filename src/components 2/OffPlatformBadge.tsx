import { Badge } from "@/components/ui/badge";
import { ProposalOffPlatformReview } from "@/components/ProposalOffPlatformReview";

const METHOD_LABELS: Record<string, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  zelle: "Zelle",
};

/**
 * Compact off-platform payment badge for a wedding or proposal row.
 *
 * - promised → "{Method} · Pay later" (blue)
 * - claimed  → "{Method} · Bride says paid — review" (amber)
 * - confirmed → "{Method} · Confirmed" (emerald)
 *
 * Returns null when there is no off-platform status, so it can be dropped
 * inline anywhere without conditional wrappers.
 *
 * Also re-exports ProposalOffPlatformReview as a static property so callers
 * that already import OffPlatformBadge can use <OffPlatformBadge.Review>
 * without an extra import line.
 */
function OffPlatformBadgeInner({
  status,
  method,
  amount,
  claimedAt,
}: {
  status?: string | null;
  method?: string | null;
  amount?: number | null;
  claimedAt?: string | null;
}) {
  if (!status) return null;
  const methodLabel = METHOD_LABELS[method || ""] || method || "Off-platform";
  const amt = Number(amount) || 0;

  if (status === "promised") {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[10px] font-semibold">
          {methodLabel} · Pay later
        </Badge>
        {amt > 0 && (
          <span className="text-[10px] text-muted-foreground">
            ${amt.toLocaleString()}
            {claimedAt ? ` · ${new Date(claimedAt).toLocaleDateString()}` : ""}
          </span>
        )}
      </span>
    );
  }
  if (status === "claimed") {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] font-semibold">
          {methodLabel} · Bride says paid — review
        </Badge>
        {amt > 0 && (
          <span className="text-[10px] text-muted-foreground">
            ${amt.toLocaleString()}
            {claimedAt ? ` · ${new Date(claimedAt).toLocaleDateString()}` : ""}
          </span>
        )}
      </span>
    );
  }
  if (status === "confirmed") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold">
        {methodLabel} · Confirmed
      </Badge>
    );
  }
  return null;
}

type OffPlatformBadgeWithReview = typeof OffPlatformBadgeInner & {
  Review: typeof ProposalOffPlatformReview;
};

const OffPlatformBadge = OffPlatformBadgeInner as OffPlatformBadgeWithReview;
OffPlatformBadge.Review = ProposalOffPlatformReview;

export { OffPlatformBadge };
