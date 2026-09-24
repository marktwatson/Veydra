import { MapPin, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatDisplayDate } from "@/lib/utils";
import { OnDeckWeddingMeta } from "@/components/OnDeckCard";

export interface OnDeckTableProps {
  parsedWeddings: OnDeckWeddingMeta[];
  settings: any;
  navigate: (path: string) => void;
  onChangePlan: (w: any) => void;
  onUpsell: (w: any) => void;
  onVerifyPayment: (weddingId: string, verified: boolean) => void;
  verifyPaymentPending: boolean;
  onEmailPreview: (data: any, sendFn: () => Promise<void>) => void;
  onCancel: (w: any) => void;
  sendingReminder: string | null;
  onRemind: (wedding: any) => void;
  sendingAttendanceReminder?: string | null;
  onRemindAttendance?: (wedding: any) => void;
}

export function OnDeckTable({
  parsedWeddings,
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
}: OnDeckTableProps) {
  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Wedding
                </th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Date & Countdown
                </th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                  Package
                </th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Payment
                </th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                  Readiness
                </th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                  Team
                </th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {parsedWeddings.map((meta) => {
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

                return (
                  <tr
                    key={wedding.id}
                    className={`border-b border-border/20 hover:bg-muted/30 transition-colors ${
                      isUrgent ? "bg-destructive/[0.04]" : ""
                    }`}
                  >
                    {/* Client name + venue + status */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {wedding.client_name}
                          </span>
                          {isUrgent && (
                            <Badge
                              variant="destructive"
                              className="text-[9px] h-4 px-1.5 font-bold"
                            >
                              URGENT
                            </Badge>
                          )}
                          <Badge
                            variant={
                              wedding.status === "upcoming"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[9px] h-4 px-1.5"
                          >
                            {(wedding.status || "pending").toUpperCase()}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {wedding.location || "Venue TBD"}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-medium text-xs">
                          {formatDisplayDate(wedding.date)}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            daysUntil < 0
                              ? "text-muted-foreground"
                              : daysUntil <= 7
                                ? "text-destructive"
                                : daysUntil <= 14
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {daysUntil < 0
                            ? "Past"
                            : daysUntil === 0
                              ? "Today"
                              : `${daysUntil} days`}
                        </span>
                      </div>
                    </td>

                    {/* Package + hours */}
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium">
                          {pkgName || "—"}
                        </span>
                        {totalHours > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            {totalHours}h coverage
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Payment */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {total > 0 ? (
                          <>
                            <span className="text-xs font-semibold">
                              ${paid.toLocaleString()} / $
                              {total.toLocaleString()}
                            </span>
                            {isFullyPaid ? (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                              >
                                {isVerified ? "Verified" : "Paid"}
                              </Badge>
                            ) : unpaid > 0.01 ? (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-destructive/10 text-destructive border-destructive/20 font-medium"
                              >
                                ${unpaid.toLocaleString()} unpaid
                              </Badge>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Readiness + overdue items */}
                    <td className="px-4 py-3.5 hidden md:table-cell text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`text-xs font-bold ${
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1.5 bg-destructive/10 text-destructive border-destructive/20"
                                >
                                  {missingItems.length} overdue
                                </Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="p-3 max-w-[220px]"
                            >
                              <p className="font-bold text-xs mb-1.5 text-destructive">
                                Overdue Items
                              </p>
                              <ul className="space-y-1 text-[11px]">
                                {missingItems.map((item, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-1.5 leading-tight"
                                  >
                                    <span className="w-1 h-1 rounded-full bg-destructive mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>

                    {/* Team */}
                    <td className="px-4 py-3.5 hidden xl:table-cell">
                      {contractors.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {contractors.slice(0, 3).map((c) => (
                            <Tooltip key={c.id}>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] gap-1 py-0.5 px-2"
                                >
                                  <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[8px]">
                                      {(c.first_name?.[0] || "") +
                                        (c.last_name?.[0] || "")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate max-w-[80px]">
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
                          {contractors.length > 3 && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{contractors.length - 3} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          No team assigned
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <ManageWeddingSheet
                          wedding={wedding}
                          trigger={
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 text-xs rounded-lg px-3"
                            >
                              Manage
                            </Button>
                          }
                        />
                        <CallSheetGenerator
                          weddingId={wedding.id}
                          weddingName={wedding.client_name}
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs rounded-lg px-2.5"
                            >
                              Call Sheet
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
                          sendingReminder={sendingReminder === wedding.id}
                          onRemindAttendance={
                            onRemindAttendance
                              ? () => onRemindAttendance(wedding)
                              : undefined
                          }
                          sendingAttendanceReminder={
                            sendingAttendanceReminder === wedding.id
                          }
                        />
                        <ContractModal wedding={wedding} showSaveSnapshot />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Cancel & Archive Wedding"
                          onClick={() => onCancel(wedding)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
