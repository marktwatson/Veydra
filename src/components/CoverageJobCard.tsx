import { useMutation, useQueryClient } from "@tanstack/react-query";
import { acceptCoverageJob } from "@/lib/coverage";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users } from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";

/**
 * Renders inside the contractor Open Jobs list for coverage-request jobs.
 * Shows "Coverage request" label and an "Apply Now" button — same as any
 * open position. The contractor submits an application; the manager assigns
 * from the applicants list.
 */
export function CoverageJobCard({
  job,
  contractorId,
}: {
  job: any;
  contractorId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const apply = useMutation({
    mutationFn: () => acceptCoverageJob(job.id, contractorId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["openJobs"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      if (res.alreadyCovered) {
        toast({
          title: "Already covered",
          description: "Another team member took this one.",
        });
      } else {
        toast({
          title: "Application submitted",
          description:
            "We'll notify you if you're selected for this assignment.",
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Could not apply",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const wedding = job.weddings;
  const isBartender = /bartender/i.test(job.role || "");
  if (isBartender) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] uppercase tracking-wider"
          >
            <Users className="h-3 w-3 mr-1" />
            Coverage request
          </Badge>
          <span className="font-semibold text-sm">
            {wedding?.client_name || "Wedding"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDisplayDate(wedding?.date)}
          </span>
          {wedding?.location && (
            <span className="text-xs text-muted-foreground">
              · {wedding.location}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {job.role}
          {job.hours ? ` (${job.hours} hrs)` : ""} · short-notice booking
        </p>
      </div>
      <Button
        size="sm"
        className="h-8 text-xs shrink-0"
        disabled={apply.isPending}
        onClick={() => apply.mutate()}
      >
        {apply.isPending ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : null}
        Apply Now
      </Button>
    </div>
  );
}
