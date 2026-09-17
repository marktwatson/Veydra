import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Calendar as CalendarIcon } from "lucide-react";
import { BookingCalendar } from "@/components/BookingCalendar";

export function ContractorInterviewSection({
  contractor,
}: {
  contractor: any;
}) {
  if (!contractor) return null;

  if (contractor.interview_date) {
    return (
      <Card className="shadow-sm border-border/50 bg-blue-50/30 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Interview Scheduled!</CardTitle>
              <CardDescription>
                Your intro call with our team is confirmed.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-background border border-blue-200/60 dark:border-blue-800/60">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              Scheduled Time
            </p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {new Date(contractor.interview_date).toLocaleString([], {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Need to reschedule? Select a new time slot below to update your
            appointment.
          </p>
          <div className="pt-2">
            <BookingCalendar
              calendarId="XFbKwnR3PtbdQoZPMAFi"
              contractor={contractor}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="bg-muted/10 border-b pb-6">
        <CardTitle>Schedule Your Interview</CardTitle>
        <CardDescription>
          Select a time below to complete your intro call with our team.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-8 pb-10">
        <BookingCalendar
          calendarId="XFbKwnR3PtbdQoZPMAFi"
          contractor={contractor}
        />
      </CardContent>
    </Card>
  );
}
