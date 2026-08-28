import { useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function AssignmentCalendar({
  assignments,
  role = "contractor",
}: {
  assignments: any[];
  role?: "contractor" | "manager";
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">
          {format(currentDate, "MMMM yyyy")}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)]">
        {days.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayAssignments = assignments.filter((a) => {
            const wDateStr = a.jobs?.weddings?.date;
            return wDateStr && wDateStr.startsWith(dayStr);
          });

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "p-2 border-r border-b min-h-[120px] flex flex-col gap-1 overflow-hidden",
                !isSameMonth(day, monthStart) && "bg-muted/30",
                "hover:bg-muted/50 transition-colors",
              )}
            >
              <div
                className={cn(
                  "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1",
                  isSameDay(day, new Date())
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1">
                {dayAssignments.map((assg) => (
                  <div
                    key={assg.id}
                    onClick={() =>
                      navigate(
                        role === "manager"
                          ? `/manager/assignments`
                          : `/assignments/${assg.id}`,
                      )
                    }
                    className={cn(
                      "text-xs p-1.5 rounded border-l-4 border-y border-r cursor-pointer hover:bg-accent/50 transition-colors text-left flex flex-col gap-0.5",
                      assg.status === "Completed"
                        ? "border-l-muted-foreground bg-muted/50"
                        : assg.status === "Cancelled"
                          ? "border-l-destructive bg-destructive/10"
                          : "border-l-primary bg-card",
                    )}
                    title={`${assg.jobs?.weddings?.client_name} - ${assg.jobs?.role}`}
                  >
                    <div className="font-semibold truncate text-foreground">
                      {assg.jobs?.weddings?.client_name || "Unknown"}
                    </div>
                    <div className="truncate text-muted-foreground text-[10px]">
                      {assg.jobs?.role}
                    </div>
                    {role === "manager" && assg.contractors && (
                      <div className="truncate text-muted-foreground text-[10px] opacity-80 mt-0.5">
                        {assg.contractors.first_name}{" "}
                        {assg.contractors.last_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
