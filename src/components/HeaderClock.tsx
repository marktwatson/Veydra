import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatPortalClock,
  formatPortalDate,
  resolveTimezone,
  relativeFromNow,
  heartbeatHealth,
} from "@/lib/business-time";
import { api } from "@/lib/api";

/**
 * Portal-time clock shown in the Layout header. Ticks every 20s and reflects
 * portal_settings.timezone (not the browser timezone). Also shows scheduler
 * health via the scheduler_heartbeats table.
 */
export function HeaderClock() {
  const [now, setNow] = useState(new Date());

  // Portal settings for timezone.
  const { data: settings } = useQuery({
    queryKey: ["portal-settings-header"],
    queryFn: () => api.getPortalSettings(),
    staleTime: 60_000,
  });

  // Scheduler heartbeat (best-effort; table may not exist on old snapshots).
  const { data: heartbeat } = useQuery({
    queryKey: ["scheduler-heartbeat"],
    queryFn: async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data, error } = await supabase
          .from("scheduler_heartbeats")
          .select("last_seen_at,last_source,last_result")
          .eq("id", "default")
          .maybeSingle();
        if (error) return null;
        return data;
      } catch {
        return null;
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const tz = resolveTimezone(settings);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);

  const health = heartbeatHealth(heartbeat?.last_seen_at);
  const lastSeenLabel = relativeFromNow(heartbeat?.last_seen_at);
  const source = heartbeat?.last_source || "—";

  const tooltipText = `${formatPortalDate(now, tz)} • ${formatPortalClock(now, tz)} (${tz})\nScheduler last seen: ${lastSeenLabel} via ${source}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-muted/50 border border-border/40 text-xs text-muted-foreground cursor-default select-none">
          <span className="font-medium text-foreground">
            {formatPortalDate(now, tz)}
          </span>
          <span className="text-border">•</span>
          <span className="font-medium text-foreground">
            {formatPortalClock(now, tz)}
          </span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide">
              Scheduler
            </span>
            <span className={`h-2 w-2 rounded-full ${health.color}`} />
            <span className="text-[10px]">{lastSeenLabel}</span>
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-xs whitespace-pre-line text-xs"
      >
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}
