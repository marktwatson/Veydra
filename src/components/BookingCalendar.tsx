import { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfDay,
  isBefore,
  isAfter,
  addDays,
} from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

const VIBE_API_URL = "https://backend.leadconnectorhq.com/vibe-ai";
const LOCATION_ID = "76EKIVBXrGYIny0RbqcE";

export function BookingCalendar({
  calendarId,
  contractor,
  onBookingComplete,
}: {
  calendarId: string;
  contractor: any;
  onBookingComplete?: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotsData, setSlotsData] = useState<
    Record<string, { slots: string[] }>
  >({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const fetchSlots = async (month: Date) => {
    setLoadingSlots(true);
    try {
      const today = startOfDay(new Date());
      let start = startOfMonth(month);
      if (isBefore(start, today)) {
        start = today;
      }

      const end = endOfMonth(month);
      let fetchEnd = end;
      if (isAfter(fetchEnd, addDays(start, 30))) {
        fetchEnd = addDays(start, 30);
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const url = `https://backend.leadconnectorhq.com/calendars/${calendarId}/free-slots?startDate=${start.getTime()}&endDate=${fetchEnd.getTime()}&timezone=${timezone}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch available slots");
      const data = await res.json();
      setSlotsData((prev) => ({ ...prev, ...data }));
    } catch (error) {
      console.error(error);
      toast.error("Could not load available interview times.");
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    fetchSlots(currentMonth);
  }, [currentMonth, calendarId]);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
    setSelectedDate(undefined);
    setSelectedSlot(null);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const payload = {
        locationId: LOCATION_ID,
        calendarId: calendarId,
        firstName: contractor.first_name,
        lastName: contractor.last_name || "",
        email: contractor.email,
        phone: contractor.phone || "",
        selectedSlot,
        selectedTimezone: timezone,
        timezone: timezone,
        sessionId: crypto.randomUUID(),
      };

      const res = await fetch(`${VIBE_API_URL}/booking/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      // Save the interview date to the contractor's profile
      const { supabase } = await import("@/lib/supabase");
      await supabase
        .from("contractors")
        .update({ interview_date: selectedSlot })
        .eq("id", contractor.id);

      // Invalidate queries so contractor dashboard and manager views update immediately
      const { queryClient } = await import("@/lib/query-client");
      queryClient.invalidateQueries({ queryKey: ["contractor"] });
      queryClient.invalidateQueries({ queryKey: ["contractors"] });

      setBooked(true);
      toast.success("Interview scheduled successfully!");
      if (onBookingComplete) onBookingComplete();
    } catch (error) {
      console.error(error);
      toast.error("Failed to schedule interview. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  if (booked) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-2xl font-bold">Interview Scheduled!</h3>
        <p className="text-muted-foreground max-w-md">
          Your interview has been confirmed. You will receive an email shortly
          with the meeting details.
        </p>
      </div>
    );
  }

  const today = startOfDay(new Date());
  const maxDate = addDays(today, 30);

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const availableSlotsForDate =
    dateStr && slotsData[dateStr] ? slotsData[dateStr].slots : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" /> Select a Date
        </h3>
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              month={currentMonth}
              onMonthChange={handleMonthChange}
              disabled={(date) =>
                isBefore(startOfDay(date), today) ||
                isAfter(startOfDay(date), maxDate)
              }
              className="w-full mx-auto"
            />
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Available Times
        </h3>

        {!selectedDate ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 border rounded-xl bg-muted/20 border-dashed">
            <CalendarIcon className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">
              Please select a date from the calendar to view available interview
              times.
            </p>
          </div>
        ) : loadingSlots && !slotsData[dateStr!] ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading available times...</p>
          </div>
        ) : availableSlotsForDate.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 border rounded-xl bg-muted/20 border-dashed">
            <Clock className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">
              No available times on {format(selectedDate, "MMMM d, yyyy")}.
              <br />
              Please select another date.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
              {availableSlotsForDate.map((slot) => {
                const slotTime = new Date(slot);
                const isSelected = selectedSlot === slot;
                return (
                  <Button
                    key={slot}
                    variant={isSelected ? "default" : "outline"}
                    className={`justify-start ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {format(slotTime, "h:mm a")}
                  </Button>
                );
              })}
            </div>

            {selectedSlot && (
              <div className="p-4 border rounded-xl bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-bottom-4">
                <p className="text-sm font-medium mb-3">
                  Selected:{" "}
                  {format(new Date(selectedSlot), "EEEE, MMMM d 'at' h:mm a")}
                </p>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleBook}
                  disabled={booking}
                >
                  {booking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    "Confirm Interview Time"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
