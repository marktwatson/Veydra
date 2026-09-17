import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { requestCoverage } from "@/lib/coverage";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, Users } from "lucide-react";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { formatDisplayDate } from "@/lib/utils";

/**
 * Manager Dashboard action item: proposals within 60 days that need coverage.
 * Shows "Awaiting coverage" proposals and lets staff request coverage.
 */
export function CoverageActionItems() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["coverage-needed"],
    queryFn: async () => {
      const { data: proposals } = await supabase
        .from("proposals")
        .select(
          "id, client_name, wedding_date, city, state, package_id, addons, coverage_type, second_shooter_type, coverage_requested_at, coverage_confirmed_at, wedding_id",
        )
        .in("status", ["draft", "viewed", "sent", "pending"])
        .order("wedding_date", { ascending: true });

      if (!proposals) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const shortNotice = proposals.filter((p: any) => {
        if (!p.wedding_date) return false;
        const d = new Date(p.wedding_date + "T12:00:00");
        d.setHours(0, 0, 0, 0);
        const days = Math.round(
          (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        return days > 0 && days <= 60;
      });

      // For each, check job coverage
      const withStatus = await Promise.all(
        shortNotice.map(async (p: any) => {
          let photoAssigned = false;
          let videoAssigned = false;
          if (p.wedding_id) {
            const { data: jobs } = await supabase
              .from("jobs")
              .select("role, contractor_id")
              .eq("wedding_id", p.wedding_id)
              .in("role", [
                "Photographer",
                "Videographer",
                "Lead Photographer",
                "Lead Videographer",
              ]);
            photoAssigned = (jobs || []).some(
              (j) => /photo/i.test(j.role) && j.contractor_id,
            );
            videoAssigned = (jobs || []).some(
              (j) => /video/i.test(j.role) && j.contractor_id,
            );
          }
          const needsVideo =
            p.coverage_type === "video" ||
            p.coverage_type === "both" ||
            (p.addons || []).some(
              (a: string) =>
                (a === "second_shooter" || a === "second_shooter_new") &&
                p.second_shooter_type === "video",
            );
          const needsPhoto =
            p.coverage_type === "photo" ||
            p.coverage_type === "both" ||
            !p.coverage_type;
          const isCovered =
            (needsPhoto ? photoAssigned : true) &&
            (needsVideo ? videoAssigned : true);
          return {
            ...p,
            isCovered,
            needsPhoto,
            needsVideo,
            photoAssigned,
            videoAssigned,
          };
        }),
      );

      // Only show ones that are NOT yet covered
      return withStatus.filter((p: any) => !p.isCovered);
    },
  });

  const requestMutation = useMutation({
    mutationFn: (proposalId: string) => requestCoverage(proposalId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["coverage-needed"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast({
        title: "Coverage requested",
        description: `Team can accept from Open Jobs. ${data.notified} contractor(s) notified.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to request coverage",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <AccordionItem
        value="coverage"
        className="border border-amber-500/30 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent"
      >
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            <span className="font-bold text-sm">Checking coverage…</span>
          </div>
        </AccordionTrigger>
      </AccordionItem>
    );
  }

  if (items.length === 0) return null;

  return (
    <AccordionItem
      value="coverage"
      className="border border-amber-500/30 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-full bg-amber-500/15 shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <span className="font-bold text-sm text-amber-700 dark:text-amber-400">
            Awaiting Coverage
          </span>
          <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider shrink-0">
            {items.length}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-2">
        {items.map((p: any) => (
          <div
            key={p.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-border/60"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">
                  {p.client_name}
                </span>
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                >
                  {formatDisplayDate(p.wedding_date)}
                </Badge>
                {p.city && (
                  <span className="text-xs text-muted-foreground">
                    {p.city}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {p.needsPhoto && (
                  <span
                    className={
                      p.photoAssigned
                        ? "text-emerald-600 flex items-center gap-1"
                        : "text-amber-600 flex items-center gap-1"
                    }
                  >
                    {p.photoAssigned ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Users className="h-3 w-3" />
                    )}
                    Photo
                  </span>
                )}
                {p.needsVideo && (
                  <span
                    className={
                      p.videoAssigned
                        ? "text-emerald-600 flex items-center gap-1"
                        : "text-amber-600 flex items-center gap-1"
                    }
                  >
                    {p.videoAssigned ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Users className="h-3 w-3" />
                    )}
                    Video
                  </span>
                )}
                {p.coverage_requested_at && (
                  <span className="text-muted-foreground">· requested</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                asChild
              >
                <Link to={`/manager/proposals`}>Manage</Link>
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={requestMutation.isPending}
                onClick={() => requestMutation.mutate(p.id)}
              >
                {requestMutation.isPending &&
                requestMutation.variables === p.id ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Users className="h-3 w-3 mr-1" />
                )}
                Request coverage
              </Button>
            </div>
          </div>
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}
