import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Play } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  resolveTimezone,
  formatPortalClock,
  formatPortalDate,
  relativeFromNow,
  heartbeatHealth,
} from "@/lib/business-time";

/**
 * Compact "Clock & scheduler" card shown in Settings → Notifications.
 * Shows the live portal time, scheduler health, upcoming scheduled jobs,
 * and a "Run scheduler now" button. Includes a one-line note about the
 * 10-minute Scheduled Function requirement per Supabase project.
 */
export function ClockSchedulerCard({ settings }: { settings?: any }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);

  const { data: fetchedSettings } = useQuery({
    queryKey: ["portal-settings-clock"],
    queryFn: () => api.getPortalSettings(),
    staleTime: 60_000,
    enabled: !settings,
  });
  const effectiveSettings = settings || fetchedSettings;

  const tz = resolveTimezone(effectiveSettings);

  const { data: status } = useQuery({
    queryKey: ["scheduler-status", tick],
    queryFn: () => api.getSchedulerStatus(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const runNow = async () => {
    setRunning(true);
    try {
      const res: any = await api.runSchedulerNow();
      if (res?.error) {
        toast.error("Scheduler run failed", {
          description: res.error,
          duration: 10000,
        });
      } else {
        toast.success("Scheduler ran", {
          description: `Claimed ${res?.claimed ?? 0} · Sent ${res?.sent ?? 0} · Backfilled ${res?.backfilled ?? 0}`,
        });
      }
      setTick((t) => t + 1);
      queryClient.invalidateQueries({ queryKey: ["scheduler-status"] });
      queryClient.invalidateQueries({ queryKey: ["scheduler-heartbeat"] });
    } catch (e: any) {
      toast.error("Scheduler run failed", {
        description: e?.message || "Could not reach the scheduler function.",
        duration: 10000,
      });
    } finally {
      setRunning(false);
    }
  };

  const health = heartbeatHealth(status?.heartbeat?.last_seen_at);
  const lastSeen = relativeFromNow(status?.heartbeat?.last_seen_at);
  const source = status?.heartbeat?.last_source || "—";
  const now = new Date();

  return (
    <Card className="max-w-3xl">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Clock & Scheduler
          </CardTitle>
          <CardDescription>
            Portal time, scheduler health, and upcoming scheduled jobs.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={runNow}
          disabled={running}
        >
          {running ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run scheduler now
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Portal Time
            </p>
            <p className="text-sm font-semibold">{formatPortalDate(now, tz)}</p>
            <p className="text-sm">{formatPortalClock(now, tz)}</p>
            <p className="text-xs text-muted-foreground">{tz}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Scheduler
            </p>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${health.color}`} />
              <span className="text-sm font-medium capitalize">
                {health.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Last seen {lastSeen} via {source}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Pending Jobs
            </p>
            <p className="text-sm font-semibold">
              {status?.upcoming?.length || 0} queued
            </p>
          </div>
        </div>

        {status?.upcoming && status.upcoming.length > 0 && (
          <div className="border-t border-border/40 pt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Upcoming Scheduled Jobs
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {status.upcoming.map((job: any) => (
                <div
                  key={job.id}
                  className="flex justify-between items-center text-sm py-1.5 px-2 rounded-lg hover:bg-muted/30"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{job.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatPortalDate(new Date(job.run_at), tz)}{" "}
                      {formatPortalClock(new Date(job.run_at), tz)}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full shrink-0 ml-2"
                  >
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1.5">
          <p className="font-semibold">Manual Payments &amp; Daily Alerts</p>
          <p>
            Subscriptions and deposits are charged automatically by Stripe at
            booking. All other payments (custom installments, final balances)
            are <span className="font-medium">manual only</span> — no background
            auto-charging. When payments are due today, the scheduler sends one
            push alert to owners &amp; super admins so you can process them in
            the Payment Audit UI.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Wrapper that renders the Clock & Scheduler card followed by the New Area
 * Setup Checklist. Rendered by Settings → Notifications tab.
 */
export function ClockSchedulerSection({ settings }: { settings?: any }) {
  const { data: fetchedSettings } = useQuery({
    queryKey: ["portal-settings-section"],
    queryFn: () => api.getPortalSettings(),
    staleTime: 60_000,
    enabled: !settings,
  });
  const effectiveSettings = settings || fetchedSettings;
  return <ClockSchedulerCard settings={effectiveSettings} />;
}
