import { Settings, CheckCircle, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Global Royalty Settings card (processing schedule, retry, Stripe status). */
export function RoyaltyGlobalSettingsCard({
  settings,
  onUpdate,
}: {
  settings: any;
  onUpdate: (updates: any) => void;
}) {
  return (
    <Card className="shadow-sm border-border/40 rounded-2xl bg-card max-w-2xl">
      <CardHeader className="p-5 pb-3 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Global Royalty Settings
        </CardTitle>
        <CardDescription className="text-xs">
          Weekly processing schedule, retry rules, and Stripe status.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {settings && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Processing Day</Label>
                <Select
                  value={String(settings.processing_day_of_week)}
                  onValueChange={(v) =>
                    onUpdate({ processing_day_of_week: parseInt(v) })
                  }
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Processing Time (portal timezone)</Label>
                <Input
                  className="rounded-full"
                  defaultValue={settings.processing_time}
                  onBlur={(e) => onUpdate({ processing_time: e.target.value })}
                  placeholder="09:00"
                />
                <p className="text-xs text-muted-foreground">
                  Interpreted in your portal timezone. Scheduler auto-runs on
                  this day at/after this time. One run per week — safeguarded
                  against double charges.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Retry Count</Label>
                <Input
                  type="number"
                  className="rounded-full"
                  defaultValue={settings.retry_count}
                  onBlur={(e) =>
                    onUpdate({ retry_count: parseInt(e.target.value) || 3 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Retry Delay (hours)</Label>
                <Input
                  type="number"
                  className="rounded-full"
                  defaultValue={settings.retry_delay_hours}
                  onBlur={(e) =>
                    onUpdate({
                      retry_delay_hours: parseInt(e.target.value) || 24,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notification Email</Label>
              <Input
                className="rounded-full"
                defaultValue={settings.notify_email || ""}
                onBlur={(e) => onUpdate({ notify_email: e.target.value })}
                placeholder="admin@veydra.com"
              />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              {settings.stripe_royalty_configured ||
              settings.stripe_connected ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Stripe Connected
                </Badge>
              ) : (
                <Badge className="bg-red-500/10 text-red-600 border-red-500/20 rounded-full">
                  <XCircle className="h-3 w-3 mr-1" />
                  Stripe Not Connected
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
