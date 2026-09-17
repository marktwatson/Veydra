import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, ExternalLink, UserCheck, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { maybeConfirmCoverage } from "@/lib/coverage-request";

/**
 * State 2 — coverage requested, waiting for applicants.
 *
 * Hides the request form entirely. Lists each coverage job with its
 * pay/hours/region, the pending applications, and an Assign button that
 * uses the same assign path as Manage wedding → Positions.
 */
export function CoverageApplicants({
  proposal,
  weddingId,
  onChanged,
}: {
  proposal: any;
  weddingId?: string | null;
  onChanged?: () => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [apps, setApps] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!weddingId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: jobRows } = await supabase
        .from("jobs")
        .select(
          "id, role, pay_rate, hours, region, status, contractor_id, coverage_request, proposal_id, requirements",
        )
        .eq("wedding_id", weddingId)
        .in("role", [
          "Photographer",
          "Videographer",
          "Lead Photographer",
          "Lead Videographer",
        ]);
      const coverageJobs = (jobRows || []).filter(
        (j) => j.coverage_request || j.proposal_id === proposal?.id,
      );
      setJobs(coverageJobs);

      // Fetch applications for each job
      const appMap: Record<string, any[]> = {};
      await Promise.all(
        coverageJobs.map(async (j) => {
          const { data: aRows } = await supabase
            .from("applications")
            .select(
              "id, job_id, contractor_id, status, message, created_at, contractors!applications_contractor_id_fkey(id, first_name, last_name, specialty)",
            )
            .eq("job_id", j.id)
            .order("created_at", { ascending: true });
          appMap[j.id] = aRows || [];
        }),
      );
      setApps(appMap);
    } catch (e) {
      console.error("CoverageApplicants load error", e);
    } finally {
      setLoading(false);
    }
  }, [weddingId, proposal?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAssign = async (jobId: string, contractorId: string) => {
    setAssigning(jobId);
    try {
      // Assign contractor directly (DbJob type doesn't include contractor_id).
      const { error: jobErr } = await supabase
        .from("jobs")
        .update({ contractor_id: contractorId, status: "assigned" })
        .eq("id", jobId);
      if (jobErr) throw new Error(jobErr.message);
      // Insert / update assignment row (same as Positions)
      const { data: job } = await supabase
        .from("jobs")
        .select("wedding_id, role, pay_rate")
        .eq("id", jobId)
        .single();
      if (job) {
        const { data: existingAsg } = await supabase
          .from("assignments")
          .select("id")
          .eq("job_id", jobId)
          .maybeSingle();
        if (existingAsg) {
          await supabase
            .from("assignments")
            .update({
              contractor_id: contractorId,
              status: "Assigned",
            })
            .eq("id", existingAsg.id);
        } else {
          await supabase.from("assignments").insert({
            job_id: jobId,
            contractor_id: contractorId,
            wedding_id: job.wedding_id,
            status: "Assigned",
          });
        }
        // Mark the application accepted
        await supabase
          .from("applications")
          .update({ status: "accepted" })
          .eq("job_id", jobId)
          .eq("contractor_id", contractorId);
        // Stamp coverage_confirmed_at if all required roles covered
        await maybeConfirmCoverage(job.wedding_id, proposal?.id);
      }
      toast({
        title: "Contractor assigned",
        description: "Coverage confirmed — couple can Sign & Pay.",
      });
      await load();
      onChanged?.();
    } catch (e: any) {
      toast({
        title: "Assign failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading coverage…
      </div>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-amber-600" />
        Positions already requested — awaiting response
      </div>

      {jobs.map((job) => {
        const jobApps = apps[job.id] || [];
        const pending = jobApps.filter((a) => a.status === "pending");
        const others = jobApps.filter((a) => a.status !== "pending");
        const ordered = [...pending, ...others];
        const assigned = !!job.contractor_id;

        return (
          <div
            key={job.id}
            className="rounded-lg border border-border bg-background/60 p-3 space-y-2"
          >
            {/* Job header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {job.role}
                </span>
                <Badge variant="outline" className="text-[11px] font-normal">
                  ${Number(job.pay_rate || 0).toFixed(0)}
                  {job.hours ? ` · ${job.hours} hrs` : ""}
                </Badge>
                {job.region && (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-normal text-muted-foreground"
                  >
                    {job.region}
                  </Badge>
                )}
              </div>
              {assigned ? (
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[11px]"
                >
                  <UserCheck className="h-3 w-3 mr-1" /> Assigned
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-800 text-[11px]"
                >
                  Open
                </Badge>
              )}
            </div>

            {job.requirements && (
              <p className="text-[11px] text-muted-foreground">
                {job.requirements}
              </p>
            )}

            {/* Applications */}
            <div className="space-y-1.5">
              {ordered.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">
                  No applications yet — contractors see this under Open
                  Positions.
                </p>
              ) : (
                ordered.map((a) => {
                  const c = a.contractors;
                  const name = c
                    ? `${c.first_name || ""} ${c.last_name || ""}`.trim()
                    : "Unknown";
                  const isPending = a.status === "pending";
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground shrink-0">
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {c?.specialty || "—"}
                            {a.created_at
                              ? ` · ${new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      {isPending && !assigned ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-[11px] px-2.5"
                          disabled={assigning === job.id}
                          onClick={() => handleAssign(job.id, a.contractor_id)}
                        >
                          {assigning === job.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <UserCheck className="h-3 w-3 mr-1" />
                          )}
                          Assign
                        </Button>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal capitalize"
                        >
                          {a.status}
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {/* Helper */}
      <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          To change pay, hours, or region, open Weddings → this wedding →
          Positions and edit the job there. Do not request coverage again.
        </span>
      </div>

      {weddingId && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate(`/manager/weddings`)}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Open in Positions
        </Button>
      )}
    </div>
  );
}
