import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getCoverageStatus,
  isCoverageRequired,
  coverageBadge,
  type CoverageStatus,
} from "@/lib/coverage";
import { requestCoverage } from "@/lib/coverage-request";

/**
 * Staff coverage block. Shows the coverage state for a proposal's wedding and
 * a "Request coverage" button when coverage is required but not yet confirmed.
 */
export function ProposalCoverageBlock({
  proposal,
  weddingId,
  onChanged,
}: {
  proposal: any;
  weddingId?: string | null;
  onChanged?: () => void;
}) {
  const [status, setStatus] = useState<CoverageStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const s = await getCoverageStatus(weddingId, proposal);
    setStatus(s);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingId, proposal?.id, proposal?.wedding_date]);

  if (!status || !status.required) return null;

  const badge = coverageBadge(status);

  const handleRequest = async () => {
    setRequesting(true);
    try {
      const res = await requestCoverage(proposal);
      toast({
        title: "Coverage requested",
        description: `Team can accept from Open Jobs. ${res.notified} contractor(s) notified.`,
      });
      await load();
      onChanged?.();
    } catch (e: any) {
      toast({
        title: "Failed to request coverage",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Radio className="h-4 w-4 text-amber-600" />
          Short-notice coverage
        </div>
        {badge && (
          <Badge
            variant="outline"
            className={
              status.confirmed
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
            }
          >
            {badge}
          </Badge>
        )}
      </div>
      {!status.confirmed && (
        <>
          <p className="text-xs text-muted-foreground">
            This wedding is within 60 days. Sign &amp; Pay stays disabled until
            coverage is confirmed.{" "}
            {status.missing.length > 0 && (
              <>Missing: {status.missing.join(", ")}.</>
            )}
          </p>
          <Button
            size="sm"
            variant="default"
            className="w-full"
            disabled={requesting || loading}
            onClick={handleRequest}
          >
            {requesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {requesting ? "Requesting…" : "Request coverage"}
          </Button>
        </>
      )}
      {status.confirmed && (
        <p className="text-xs text-muted-foreground">
          A team member is confirmed for this date.
        </p>
      )}
    </div>
  );
}

/** Compact badge-only version for table rows / headers. */
export function CoverageStatusBadge({
  proposal,
  weddingId,
}: {
  proposal: any;
  weddingId?: string | null;
}) {
  const [status, setStatus] = useState<CoverageStatus | null>(null);

  useEffect(() => {
    let active = true;
    getCoverageStatus(weddingId, proposal).then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, [weddingId, proposal?.id, proposal?.wedding_date]);

  if (!status || !status.required) return null;
  const badge = coverageBadge(status);
  if (!badge) return null;
  return (
    <Badge
      variant="outline"
      className={
        status.confirmed
          ? "ml-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "ml-1 border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
      }
    >
      {badge}
    </Badge>
  );
}
