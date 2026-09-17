import {
  CheckCircle2,
  Clock,
  Loader2,
  Calendar,
  ShieldCheck,
  FileText,
  Star,
  ArrowRight,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STAGE_FLOW = [
  { id: "applied", label: "Applied", description: "Application submitted" },
  { id: "interview", label: "Interview", description: "Interview scheduling" },
  { id: "paperwork", label: "Paperwork", description: "W-9 & agreement" },
  { id: "active", label: "Hired", description: "Active contractor" },
];

function stageIndex(status: string): number {
  const idx = STAGE_FLOW.findIndex((s) => s.id === status);
  if (idx >= 0) return idx;
  if (status === "inactive") return STAGE_FLOW.length - 1;
  return -1;
}

function formatDate(d?: string | null) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function daysSince(d?: string | null): number | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function StageStatusPanel({
  contractor,
  onAdvanceStage,
}: {
  contractor: any;
  onAdvanceStage?: (c: any, status: string) => void;
}) {
  const status = contractor.status || "applied";
  const currentIdx = stageIndex(status);
  const isInactive = status === "inactive";
  const isRejected = status === "rejected" || status === "declined";

  // Stage-specific completion checks
  const interviewScheduled = !!contractor.interview_date;
  const w9Signed = !!contractor.w9_signature;
  const contractSigned = !!contractor.contract_signature;
  const paperworkComplete = w9Signed && contractSigned;

  const createdDays = daysSince(contractor.created_at);
  const updatedDays = daysSince(contractor.updated_at);

  const getNextStageInfo = (s: string) => {
    switch (s) {
      case "applied":
        return { id: "interview", label: "Advance to Interview" };
      case "interview":
        return { id: "paperwork", label: "Advance to Paperwork" };
      case "paperwork":
        return { id: "active", label: "Hire Contractor" };
      default:
        return null;
    }
  };
  const nextStage = getNextStageInfo(status);

  return (
    <div className="space-y-5">
      {/* Current stage banner */}
      <div
        className={`rounded-xl border p-4 ${
          isRejected
            ? "border-red-200 bg-red-50/50 dark:bg-red-950/20"
            : isInactive
              ? "border-muted bg-muted/30"
              : status === "active"
                ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Current Stage
            </p>
            <p className="text-xl font-bold mt-0.5 capitalize">
              {isInactive ? "Inactive" : isRejected ? "Rejected" : status}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {STAGE_FLOW.find((s) => s.id === status)?.description ||
                (isInactive
                  ? "No longer active with the team"
                  : isRejected
                    ? "Application was declined"
                    : "")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            {createdDays !== null && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Applied {createdDays}d ago
              </p>
            )}
            {updatedDays !== null && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Updated {updatedDays}d ago
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Progress timeline */}
      {!isInactive && !isRejected && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Pipeline Progress
          </p>
          <div className="flex items-center gap-1">
            {STAGE_FLOW.map((stage, idx) => {
              const complete = idx < currentIdx;
              const current = idx === currentIdx;
              return (
                <div
                  key={stage.id}
                  className="flex items-center flex-1 last:flex-none"
                >
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        complete
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : current
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-background border-muted text-muted-foreground"
                      }`}
                    >
                      {complete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : current ? (
                        idx + 1
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${current ? "text-blue-600 dark:text-blue-400" : complete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {idx < STAGE_FLOW.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 mb-4 ${complete ? "bg-emerald-500" : "bg-muted"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage-specific status checklist */}
      {!isInactive && !isRejected && (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Stage Requirements
          </p>

          {status === "applied" && (
            <>
              <ChecklistRow
                done
                label="Application submitted"
                sub={
                  contractor.created_at
                    ? formatDate(contractor.created_at) || ""
                    : ""
                }
              />
              <ChecklistRow
                done={!!contractor.portfolio_url}
                label="Portfolio link provided"
                sub={contractor.portfolio_url ? "On file" : "Not provided yet"}
              />
              <ChecklistRow
                done={!!contractor.gallery_requested_at}
                label="Full gallery requested"
                sub={
                  contractor.gallery_requested_at
                    ? formatDate(contractor.gallery_requested_at) || ""
                    : "Optional — request a full wedding gallery"
                }
              />
            </>
          )}

          {status === "interview" && (
            <>
              <ChecklistRow done label="Application received" />
              <ChecklistRow
                done={interviewScheduled}
                label="Interview scheduled"
                sub={
                  interviewScheduled
                    ? formatDate(contractor.interview_date) || ""
                    : "Waiting for applicant to pick a time"
                }
                icon={
                  !interviewScheduled ? (
                    <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4 text-blue-500" />
                  )
                }
              />
            </>
          )}

          {status === "paperwork" && (
            <>
              <ChecklistRow done label="Application received" />
              <ChecklistRow
                done={interviewScheduled}
                label="Interview completed"
              />
              <ChecklistRow
                done={w9Signed}
                label="W-9 form signed"
                icon={
                  w9Signed ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )
                }
              />
              <ChecklistRow
                done={contractSigned}
                label="Contractor agreement signed"
                icon={
                  contractSigned ? (
                    <FileText className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )
                }
              />
              {paperworkComplete && (
                <div className="pt-2">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 font-medium">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Paperwork Complete
                  </Badge>
                </div>
              )}
            </>
          )}

          {status === "active" && (
            <>
              <ChecklistRow done label="Application received" />
              <ChecklistRow done label="Interview completed" />
              <ChecklistRow done label="Paperwork signed" />
              <ChecklistRow
                done={!!contractor.rating}
                label="Performance rating"
                icon={
                  contractor.rating ? (
                    <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                      {contractor.rating}
                      <Star className="h-3 w-3 fill-current" />
                    </span>
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )
                }
              />
            </>
          )}
        </div>
      )}

      {/* Advance action */}
      {nextStage && onAdvanceStage && (
        <Button
          type="button"
          className={`w-full ${
            status === "paperwork" && paperworkComplete
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : ""
          }`}
          variant={
            status === "paperwork" && paperworkComplete ? "default" : "outline"
          }
          onClick={() => onAdvanceStage(contractor, nextStage.id)}
        >
          {nextStage.label}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}

      {isRejected && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-400">
            This application was declined. The contractor was notified and is no
            longer moving through the pipeline.
          </p>
        </div>
      )}
    </div>
  );
}

function ChecklistRow({
  done,
  label,
  sub,
  icon,
}: {
  done: boolean;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">
        {icon ||
          (done ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
          ))}
      </div>
      <div>
        <p
          className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}
        >
          {label}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
