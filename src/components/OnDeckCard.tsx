import { MapPin, Trash2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CallSheetGenerator } from "@/components/CallSheetGenerator";
import { ContractModal } from "@/components/ContractModal";
import { WeddingActionsMenu } from "@/components/WeddingActionsMenu";
import { ManageWeddingSheet } from "@/pages/manager/Weddings";
import { EventTypeBadges } from "@/components/WeddingEventsCard";
import { formatDisplayDate } from "@/lib/utils";

export interface OnDeckWeddingMeta {
  wedding: any;
  daysUntil: number;
  total: number;
  paid: number;
  unpaid: number;
  isFullyPaid: boolean;
  isVerified: boolean;
  readiness: number;
  contractors: Array<{
    id: string;
    first_name: string;
    last_name: string;
    role: string;
  }>;
  totalHours: number;
  pkgName: string | null;
  missingItems: string[];
  isUrgent: boolean;
  needsAttention: boolean;
}

interface OnDeckCardProps {
  meta: OnDeckWeddingMeta;
  events?: any[];
  settings: any;
  navigate: (path: string) => void;
  onChangePlan: (w: any) => void;
  onUpsell: (w: any) => void;
  onVerifyPayment: (weddingId: string, verified: boolean) => void;
  verifyPaymentPending: boolean;
  onEmailPreview: (data: any, sendFn: () => Promise<void>) => void;
  onCancel: (w: any) => void;
  sendingReminder: boolean;
  onRemind: (wedding: any) => void;
  sendingAttendanceReminder?: boolean;
  onRemindAttendance?: (wedding: any) => void;
}

export function OnDeckCard({
  meta,
  events,
  settings,
  navigate,
  onChangePlan,
  onUpsell,
  onVerifyPayment,
  verifyPaymentPending,
  onEmailPreview,
  onCancel,
  sendingReminder,
  onRemind,
  sendingAttendanceReminder,
  onRemindAttendance,
}: OnDeckCardProps) {
  const {
    wedding,
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
  } = meta;

  const when =
    daysUntil < 0
      ? "Past date"
      : daysUntil === 0
        ? "Today"
        : daysUntil === 1
          ? "Tomorrow"
          : `${daysUntil} days away`;
  const whenClass =
    daysUntil < 0
      ? "text-muted-foreground"
      : daysUntil <= 7
        ? "text-destructive"
        : daysUntil <= 14
          ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-600 dark:text-emerald-400";
  const dateOnly = String(wedding.date || "").trim().split("T")[0];
  const [year, month, day] = dateOnly.split("-").map(Number);
  const dayLabel =
    year && month && day
      ? new Date(year, month - 1, day).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : formatDisplayDate(wedding.date);

  return (
    <Card
      className={`overflow-hidden transition-all duration-200 border-border/60 hover:shadow-md hover:border-border ${
        isUrgent
          ? "ring-1 ring-destructive/40 bg-destructive/[0.02]"
          : "bg-card"
      }`}
    >
      {/* Top bar with names & countdown badge */}
      <div className="flex items-start justify-between gap-3 border-b border-border/40 bg-muted/20 p-4 pb-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold leading-tight text-foreground">
            {wedding.client_name}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {dayLabel}
            <span className={`font-semibold ${whenClass}`}> · {when}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{wedding.location || "Venue TBD"}</span>
          </div>
          {events && events.length > 0 && (
            <div className="mt-2">
              <EventTypeBadges events={events} />
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isUrgent && (
            <Badge
              variant="destructive"
              className="h-4 px-1.5 text-[9px] font-bold uppercase tracking-wide"
            >
              Urgent
            </Badge>
          )}
          <Badge
            variant={wedding.status === "upcoming" ? "default" : "secondary"}
            className="h-4 px-1.5 text-[9px] uppercase"
          >
            {wedding.status || "pending"}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-3.5">
        {/* Readiness Bar & Overdue Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Readiness</span>
            <div className="flex items-center gap-2">
              <span
                className={`font-bold ${
                  readiness >= 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : readiness >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-destructive"
                }`}
              >
                {readiness}%
              </span>
              {missingItems.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-destructive/10 text-destructive font-medium border border-destructive/20">
                  <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                  {missingItems.length} missing
                </span>
              )}
            </div>
          </div>
          <Progress
            value={readiness}
            className={`h-2 ${
              readiness >= 100
                ? "[&>div]:bg-emerald-500"
                : readiness >= 50
                  ? "[&>div]:bg-amber-500"
                  : "[&>div]:bg-destructive"
            }`}
          />

          {/* Missing items clearly written out below the readiness bar */}
          {missingItems.length > 0 ? (
            <div className="rounded-md bg-destructive/[0.06] border border-destructive/20 p-2 text-xs space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Missing / Overdue ({missingItems.length}):
              </span>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {missingItems.map((item, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-background/80 border border-destructive/25 text-destructive font-medium shadow-2xs"
                  >
                    <span className="w-1 h-1 rounded-full bg-destructive" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 pt-0.5">
              <span>✓ All readiness items complete</span>
            </div>
          )}
        </div>

        {/* Quick Details: Package & Financials */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
              Package & Hours
            </span>
            <span className="font-medium text-foreground truncate block">
              {pkgName || "Standard Package"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {totalHours > 0 ? `${totalHours} hrs coverage` : "Hours TBD"}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
              Financials
            </span>
            <span className="font-semibold text-foreground block">
              ${paid.toLocaleString()} / ${total.toLocaleString()}
            </span>
            {isFullyPaid ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {isVerified ? "✓ Verified PIF" : "Paid in Full"}
              </span>
            ) : unpaid > 0.01 ? (
              <span className="text-[11px] text-destructive font-semibold">
                ${unpaid.toLocaleString()} due
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Balanced
              </span>
            )}
          </div>
        </div>

        {/* Assigned Team */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium mb-1.5">
            <span>Assigned Team</span>
            <span>{contractors.length} assigned</span>
          </div>
          {contractors.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {contractors.map((c) => (
                <Tooltip key={c.id}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="text-[10px] gap-1.5 py-0.5 px-2 font-normal"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                          {(c.first_name?.[0] || "") + (c.last_name?.[0] || "")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[90px]">
                        {c.first_name} {c.last_name?.[0]}.
                      </span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-semibold text-xs">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.role || "Team Member"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No contractors assigned yet
            </p>
          )}
        </div>
      </CardContent>

      {/* Card Actions Footer - clean two-row stack so every label stays fully
          visible. Row 1: Manage (full width). Row 2: Call Sheet, Contract,
          Actions (equal width) + archive icon at the end. */}
      <div className="p-3 bg-muted/20 border-t border-border/40 space-y-1.5">
        <ManageWeddingSheet
          wedding={wedding}
          trigger={
            <Button
              size="sm"
              variant="default"
              className="h-8 w-full text-xs rounded-lg px-3.5 font-medium shadow-xs"
            >
              Manage
            </Button>
          }
        />

        <div className="flex items-stretch gap-1.5">
          <CallSheetGenerator
            weddingId={wedding.id}
            weddingName={wedding.client_name}
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="h-8 flex-1 text-xs rounded-lg px-2.5"
                title="View & send call sheet"
              >
                Call Sheet
              </Button>
            }
          />

          <ContractModal
            wedding={wedding}
            showSaveSnapshot
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="h-8 flex-1 text-xs rounded-lg px-2.5"
              >
                Contract
              </Button>
            }
          />

          <WeddingActionsMenu
            wedding={wedding}
            settings={settings}
            navigate={navigate}
            onChangePlan={onChangePlan}
            onUpsell={onUpsell}
            onVerifyPayment={onVerifyPayment}
            verifyPaymentPending={verifyPaymentPending}
            onEmailPreview={onEmailPreview}
            onRemind={() => onRemind(wedding)}
            sendingReminder={sendingReminder}
            onRemindAttendance={
              onRemindAttendance ? () => onRemindAttendance(wedding) : undefined
            }
            sendingAttendanceReminder={sendingAttendanceReminder}
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Cancel & Archive Wedding"
            onClick={() => onCancel(wedding)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
