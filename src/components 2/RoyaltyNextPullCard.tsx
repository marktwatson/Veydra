import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Settings } from "lucide-react";

const ROYALTY_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Compute the next Date that falls on processing_day_of_week (0=Sun..6=Sat) at
// processing_time (HH:MM). If that weekday+time already passed this week, use
// next week. Defaults: day 0 (Sunday), time 00:00. Pure JS — no date library.
function getNextRoyaltyPullDate(settings: any): Date | null {
  if (!settings) return null;
  const dayOfWeek = Number(settings.processing_day_of_week ?? 0);
  const timeStr = String(settings.processing_time || "00:00").trim();
  const [hhPart, mmPart] = timeStr.split(":");
  const hh = parseInt(hhPart, 10);
  const mm = parseInt(mmPart, 10);
  const hour = isNaN(hh) ? 0 : Math.min(23, Math.max(0, hh));
  const minute = isNaN(mm) ? 0 : Math.min(59, Math.max(0, mm));
  const targetDay = isNaN(dayOfWeek) ? 0 : Math.min(6, Math.max(0, dayOfWeek));

  const now = new Date();
  const target = new Date();
  const currentDay = now.getDay();
  const diff = (targetDay - currentDay + 7) % 7;
  target.setDate(now.getDate() + diff);
  target.setHours(hour, minute, 0, 0);
  // If that instant already passed (incl. today after the time), roll forward a week
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

export function RoyaltyNextPullCard({
  settings,
  onEditSchedule,
  showEditButton = true,
}: {
  settings: any;
  onEditSchedule?: () => void;
  showEditButton?: boolean;
}) {
  const pullDate = getNextRoyaltyPullDate(settings);

  return (
    <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Next Royalty Pull
        </CardTitle>
        <CardDescription className="text-xs">
          When the weekly processor will next calculate and charge kept sales.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-3">
        {!pullDate ? (
          <p className="text-sm text-muted-foreground">
            Set a processing day in Global Settings.
          </p>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              NEXT ROYALTY PULL
            </p>
            <p className="text-2xl font-bold tracking-tight">
              {pullDate.toLocaleString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {ROYALTY_DAY_NAMES[
                Number(settings.processing_day_of_week ?? 0)
              ] || "Sunday"}{" "}
              at {String(settings.processing_time || "00:00").trim()} · uses
              kept sales from the last 7 days
            </p>
          </>
        )}
        {showEditButton && onEditSchedule && (
          <div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={onEditSchedule}
            >
              <Settings className="h-4 w-4 mr-2" /> Change schedule
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
