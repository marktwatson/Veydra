import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Radio,
  Camera,
  Video,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getCoverageStatus,
  coverageBadge,
  type CoverageStatus,
} from "@/lib/coverage";
import { requestCoverage } from "@/lib/coverage-request";
import { api } from "@/lib/api";
import { FALLBACK_PACKAGES_SLIM } from "@/lib/booking-fallbacks";

/**
 * Staff coverage block on proposal builder / detail.
 * Displays which specific roles, hours, and package details are being sought,
 * plus assigned contractor names or awaiting status.
 */
export function ProposalCoverageBlock({
  proposal,
  weddingId,
  packages: propPackages,
  onChanged,
}: {
  proposal: any;
  weddingId?: string | null;
  packages?: any[];
  onChanged?: () => void;
}) {
  const [packages, setPackages] = useState<any[]>(propPackages || []);

  useEffect(() => {
    if (propPackages && propPackages.length > 0) {
      setPackages(propPackages);
    } else {
      api
        .getPackages(true)
        .then((pkgs) => {
          if (pkgs && pkgs.length) setPackages(pkgs);
          else setPackages(FALLBACK_PACKAGES_SLIM);
        })
        .catch(() => setPackages(FALLBACK_PACKAGES_SLIM));
    }
  }, [propPackages]);

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
  }, [
    weddingId,
    proposal?.id,
    proposal?.wedding_date,
    proposal?.coverage_type,
    proposal?.package_id,
    JSON.stringify(proposal?.addons || []),
  ]);

  if (!status || !status.required) return null;

  const badge = coverageBadge(status);

  // Derive package name and hours if available
  const pkg = packages.find((p) => p.id === proposal?.package_id);
  const packageDesc = pkg?.desc || pkg?.description || "";
  const hoursMatch = packageDesc.match(/(\d+)\s*(?:hours|hrs|hour)/i);
  const packageHours = hoursMatch ? parseInt(hoursMatch[1], 10) : null;

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

  // Find existing assigned contractors from status.jobs
  const photoJob = (status.jobs || []).find((j) => /photo/i.test(j.role || ""));
  const videoJob = (status.jobs || []).find((j) => /video/i.test(j.role || ""));

  return (
    <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/20 p-4 shadow-sm space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
            <Radio className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Short-Notice Coverage
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Wedding date is within 60 days
            </p>
          </div>
        </div>
        {badge && (
          <Badge
            variant="outline"
            className={
              status.confirmed
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs px-2.5 py-0.5 font-medium"
                : "border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs px-2.5 py-0.5 font-medium"
            }
          >
            {status.confirmed ? (
              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-3 w-3 mr-1 text-amber-600 dark:text-amber-400" />
            )}
            {badge}
          </Badge>
        )}
      </div>

      {/* Package & Role Requirements Breakdown */}
      <div className="rounded-lg border border-amber-200/80 bg-background/80 p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between pb-1.5 border-b border-border/50 text-muted-foreground font-medium">
          <span>Required Roles</span>
          {packageHours ? (
            <span className="flex items-center gap-1 text-foreground font-semibold">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {packageHours} Hours {pkg?.name ? `· ${pkg.name}` : ""}
            </span>
          ) : pkg?.name ? (
            <span className="text-foreground font-semibold">{pkg.name}</span>
          ) : (
            <span className="text-muted-foreground italic">
              Select a package to set hours
            </span>
          )}
        </div>

        <div className="space-y-1.5 pt-0.5">
          {/* Photographer requirement */}
          {status.needsPhoto && (
            <div className="flex items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-2">
                <Camera className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">
                  Lead Photographer
                </span>
                {packageHours && (
                  <span className="text-[11px] text-muted-foreground">
                    ({packageHours} hrs)
                  </span>
                )}
              </div>
              {status.photoAssigned ? (
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[11px] font-normal"
                >
                  {photoJob?.contractors?.first_name
                    ? `${photoJob.contractors.first_name} ${photoJob.contractors.last_name || ""}`.trim()
                    : "Covered"}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-normal"
                >
                  Awaiting contractor
                </Badge>
              )}
            </div>
          )}

          {/* Videographer requirement */}
          {status.needsVideo && (
            <div className="flex items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-2">
                <Video className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">
                  Lead Videographer
                </span>
                {packageHours && (
                  <span className="text-[11px] text-muted-foreground">
                    ({packageHours} hrs)
                  </span>
                )}
              </div>
              {status.videoAssigned ? (
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[11px] font-normal"
                >
                  {videoJob?.contractors?.first_name
                    ? `${videoJob.contractors.first_name} ${videoJob.contractors.last_name || ""}`.trim()
                    : "Covered"}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-normal"
                >
                  Awaiting contractor
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Helper text & Request button */}
      {!status.confirmed && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The bride's Sign &amp; Pay button stays locked until these roles are
            accepted.
          </p>
          <Button
            size="sm"
            variant="default"
            className="w-full h-9 text-xs font-medium"
            disabled={requesting || loading}
            onClick={handleRequest}
          >
            {requesting ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Radio className="h-3.5 w-3.5 mr-2" />
            )}
            {requesting ? "Notifying Team…" : "Request Coverage Now"}
          </Button>
        </div>
      )}

      {status.confirmed && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium pt-0.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>All required coverage is confirmed. Couple can book.</span>
        </div>
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
