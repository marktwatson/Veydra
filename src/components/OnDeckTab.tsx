import { useState, useMemo } from "react";
import {
  CalendarCheck,
  AlertTriangle,
  DollarSign,
  Users,
  LayoutGrid,
  List,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getMissingItems,
  sendPrepReminder,
  sendAttendanceReminder,
} from "@/lib/wedding-readiness";
import { OnDeckCard, OnDeckWeddingMeta } from "@/components/OnDeckCard";
import { OnDeckTable } from "@/components/OnDeckTable";

export interface OnDeckTabProps {
  onDeckSorted: any[];
  assignments: any[];
  jobs: any[];
  today: Date;
  settings: any;
  navigate: (path: string) => void;
  parseLocalDate: (dateStr: string) => Date;
  calculateReadiness: (wedding: any, weddingAssignments?: any[]) => number;
  onChangePlan: (w: any) => void;
  onUpsell: (w: any) => void;
  onVerifyPayment: (weddingId: string, verified: boolean) => void;
  verifyPaymentPending: boolean;
  onEmailPreview: (data: any, sendFn: () => Promise<void>) => void;
  onCancel: (w: any) => void;
}

export function OnDeckTab({
  onDeckSorted,
  assignments,
  jobs,
  today,
  settings,
  navigate,
  parseLocalDate,
  calculateReadiness,
  onChangePlan,
  onUpsell,
  onVerifyPayment,
  verifyPaymentPending,
  onEmailPreview,
  onCancel,
}: OnDeckTabProps) {
  const [viewMode, setViewMode] = useState<"lanes" | "table">("lanes");
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [sendingAttendanceReminder, setSendingAttendanceReminder] = useState<
    string | null
  >(null);
  const { toast } = useToast();

  const handleRemind = async (wedding: any) => {
    setSendingReminder(wedding.id);
    try {
      const sent = await sendPrepReminder(wedding, jobs, assignments, settings);
      if (sent > 0) {
        toast({
          title: "Prep Reminders Sent",
          description: `${sent} reminder(s) sent to contractors with incomplete to-dos.`,
        });
      } else {
        toast({
          title: "No Reminders Sent",
          description:
            "Either no contractors have incomplete todos, or SMS/Email prep alerts are disabled in Settings.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Failed to Send",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSendingReminder(null);
    }
  };

  const handleRemindAttendance = async (wedding: any) => {
    setSendingAttendanceReminder(wedding.id);
    try {
      const sent = await sendAttendanceReminder(
        wedding,
        jobs,
        assignments,
        settings,
      );
      if (sent > 0) {
        toast({
          title: "Attendance Reminders Sent",
          description: `${sent} contractor(s) alerted via SMS to confirm attendance.`,
        });
      } else {
        toast({
          title: "All Attendance Confirmed",
          description:
            "All assigned contractors for this wedding have already confirmed their attendance!",
        });
      }
    } catch (e: any) {
      toast({
        title: "Failed to Send",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSendingAttendanceReminder(null);
    }
  };

  const parsedWeddings: OnDeckWeddingMeta[] = useMemo(() => {
    return onDeckSorted.map((w: any) => {
      const d = parseLocalDate(w.date);
      const daysUntil = Math.ceil(
        (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      const total = Number(w.total_amount) || 0;
      const paid = Number(w.paid_amount) || 0;
      const unpaid = Math.max(0, total - paid);
      const isFullyPaid = total > 0 && paid >= total - 0.01;
      const isVerified = !!w.final_payment_verified;
      const readiness = Math.round(calculateReadiness(w) * 100) / 100;

      const wAssignments = (assignments as any[]).filter(
        (a) => a.jobs?.wedding_id === w.id,
      );
      const contractors = wAssignments.map((a) => ({
        id: a.contractor_id,
        first_name: a.contractors?.first_name || "Unknown",
        last_name: a.contractors?.last_name || "",
        role: a.jobs?.role || "Team",
      }));

      const weddingJobs = jobs.filter((j) => j.wedding_id === w.id);
      const totalHours = weddingJobs.reduce(
        (s, j) => s + (Number(j.hours) || 0),
        0,
      );
      const pkgName =
        w.package ||
        (w.addons && Array.isArray(w.addons) && w.addons.length > 0
          ? w.addons[0]
          : null);

      const missingItems = getMissingItems(w, jobs, assignments);

      const needsAttention =
        (total > 0 && unpaid > 0.01) ||
        (isFullyPaid && !isVerified) ||
        readiness < 100 ||
        contractors.length === 0;

      const isUrgent = daysUntil >= 0 && daysUntil <= 7 && needsAttention;

      return {
        wedding: w,
        daysUntil,
        total,
        paid,
        unpaid,
        isFullyPaid,
        isVerified,
        readiness,
        contractors,
        totalHours,
        pkgName,
        missingItems,
        isUrgent,
        needsAttention,
      };
    });
  }, [
    onDeckSorted,
    assignments,
    jobs,
    today,
    parseLocalDate,
    calculateReadiness,
  ]);

  const lanes = useMemo(() => {
    const urgent: OnDeckWeddingMeta[] = [];
    const nextTwoWeeks: OnDeckWeddingMeta[] = [];
    const upcoming: OnDeckWeddingMeta[] = [];
    const pastDue: OnDeckWeddingMeta[] = [];

    parsedWeddings.forEach((meta) => {
      if (meta.daysUntil < 0) {
        pastDue.push(meta);
      } else if (meta.daysUntil <= 7) {
        urgent.push(meta);
      } else if (meta.daysUntil <= 14) {
        nextTwoWeeks.push(meta);
      } else {
        upcoming.push(meta);
      }
    });

    return [
      {
        id: "urgent",
        title: "Immediate & Urgent",
        subtitle: "≤ 7 days until wedding date",
        badge: `${urgent.length} wedding${urgent.length === 1 ? "" : "s"}`,
        badgeVariant: "destructive" as const,
        items: urgent,
        emptyText: "No weddings occurring within the next 7 days.",
      },
      {
        id: "nextTwoWeeks",
        title: "Next 2 Weeks",
        subtitle: "8 to 14 days out",
        badge: `${nextTwoWeeks.length} wedding${nextTwoWeeks.length === 1 ? "" : "s"}`,
        badgeVariant: "secondary" as const,
        items: nextTwoWeeks,
        emptyText: "No weddings scheduled 8–14 days out.",
      },
      {
        id: "upcoming",
        title: "Upcoming On Deck",
        subtitle: "15 to 30 days out",
        badge: `${upcoming.length} wedding${upcoming.length === 1 ? "" : "s"}`,
        badgeVariant: "outline" as const,
        items: upcoming,
        emptyText: "No weddings scheduled 15–30 days out.",
      },
      ...(pastDue.length > 0
        ? [
            {
              id: "pastDue",
              title: "Past Dates Pending Closeout",
              subtitle: "Requires wrap-up or post-production",
              badge: `${pastDue.length} past`,
              badgeVariant: "secondary" as const,
              items: pastDue,
              emptyText: "",
            },
          ]
        : []),
    ];
  }, [parsedWeddings]);

  const urgentCount = parsedWeddings.filter(
    (w) => w.daysUntil >= 0 && w.daysUntil <= 7,
  ).length;
  const totalUnpaid = parsedWeddings.reduce((sum, w) => sum + w.unpaid, 0);
  const contractorCount = new Set(
    parsedWeddings.flatMap((w) => w.contractors.map((c) => c.id)),
  ).size;

  if (onDeckSorted.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-16 text-center">
          <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-1">No weddings on deck</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Weddings published and scheduled within the next 30 days will appear
            here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview bar with metrics and view switch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold">
            <CalendarCheck className="h-4 w-4" />
            <span>{onDeckSorted.length} On Deck</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>{urgentCount} Next 7 Days</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
            <DollarSign className="h-4 w-4" />
            <span>
              $
              {totalUnpaid.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}{" "}
              Unpaid
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
            <Users className="h-4 w-4" />
            <span>{contractorCount} Contractors Assigned</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/40 shrink-0 self-start md:self-auto">
          <Button
            size="sm"
            variant={viewMode === "lanes" ? "default" : "ghost"}
            className="h-8 px-3 text-xs gap-1.5"
            onClick={() => setViewMode("lanes")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Urgency Swimlanes</span>
          </Button>
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            className="h-8 px-3 text-xs gap-1.5"
            onClick={() => setViewMode("table")}
          >
            <List className="h-3.5 w-3.5" />
            <span>Compact Table</span>
          </Button>
        </div>
      </div>

      {/* SWIMLANES VIEW */}
      {viewMode === "lanes" && (
        <div className="space-y-8">
          {lanes.map((lane) => (
            <div key={lane.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-semibold text-base tracking-tight text-foreground flex items-center gap-2">
                    {lane.title}
                  </h3>
                  <Badge variant={lane.badgeVariant} className="text-xs">
                    {lane.badge}
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    • {lane.subtitle}
                  </span>
                </div>
              </div>

              {lane.items.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border/60 text-center bg-muted/10">
                  <p className="text-xs text-muted-foreground">
                    {lane.emptyText}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {lane.items.map((meta) => (
                    <OnDeckCard
                      key={meta.wedding.id}
                      meta={meta}
                      settings={settings}
                      navigate={navigate}
                      onChangePlan={onChangePlan}
                      onUpsell={onUpsell}
                      onVerifyPayment={onVerifyPayment}
                      verifyPaymentPending={verifyPaymentPending}
                      onEmailPreview={onEmailPreview}
                      onCancel={onCancel}
                      sendingReminder={sendingReminder === meta.wedding.id}
                      onRemind={handleRemind}
                      sendingAttendanceReminder={
                        sendingAttendanceReminder === meta.wedding.id
                      }
                      onRemindAttendance={handleRemindAttendance}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* COMPACT TABLE VIEW */}
      {viewMode === "table" && (
        <OnDeckTable
          parsedWeddings={parsedWeddings}
          settings={settings}
          navigate={navigate}
          onChangePlan={onChangePlan}
          onUpsell={onUpsell}
          onVerifyPayment={onVerifyPayment}
          verifyPaymentPending={verifyPaymentPending}
          onEmailPreview={onEmailPreview}
          onCancel={onCancel}
          sendingReminder={sendingReminder}
          onRemind={handleRemind}
          sendingAttendanceReminder={sendingAttendanceReminder}
          onRemindAttendance={handleRemindAttendance}
        />
      )}
    </div>
  );
}

export default OnDeckTab;
