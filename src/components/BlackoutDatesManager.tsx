import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export function BlackoutDatesManager({
  contractorId,
}: {
  contractorId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: blackoutDates, isLoading } = useQuery({
    queryKey: ["blackout-dates", contractorId],
    queryFn: () => api.getBlackoutDates(contractorId),
    enabled: !!contractorId,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.addBlackoutDate({
        contractor_id: contractorId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["blackout-dates", contractorId],
      });
      setStartDate("");
      setEndDate("");
      setReason("");
      toast({
        title: "Blackout dates added",
        description: "Your unavailable dates have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to add dates",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBlackoutDate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["blackout-dates", contractorId],
      });
      toast({
        title: "Dates removed",
        description: "The blackout dates have been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to remove dates",
        description: error.message,
      });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Missing dates",
        description: "Please select both a start and end date.",
      });
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast({
        variant: "destructive",
        title: "Invalid dates",
        description: "End date must be after start date.",
      });
      return;
    }
    addMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blackout Dates</CardTitle>
        <CardDescription>
          Block off dates when you are unavailable. You will not receive job
          alerts or be eligible for assignments on these dates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={handleAdd}
          className="grid gap-4 sm:grid-cols-2 items-end bg-muted/30 p-4 rounded-lg border"
        >
          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Input
              id="reason"
              placeholder="e.g. Vacation, Another wedding, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarIcon className="mr-2 h-4 w-4" />
              )}
              Add Blackout Dates
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <h3 className="font-medium">Upcoming Unavailable Dates</h3>
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !blackoutDates || blackoutDates.length === 0 ? (
            <div className="text-center p-6 border rounded-lg border-dashed text-muted-foreground">
              You haven't added any blackout dates yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {blackoutDates.map((bd) => {
                // Parse correctly
                const [sy, sm, sd] = bd.start_date.split("-").map(Number);
                const [ey, em, ed] = bd.end_date.split("-").map(Number);
                const start = new Date(sy, sm - 1, sd);
                const end = new Date(ey, em - 1, ed);

                const isSingleDay = bd.start_date === bd.end_date;
                const isPast = end < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <div
                    key={bd.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${isPast ? "opacity-50 bg-muted" : "bg-card"}`}
                  >
                    <div>
                      <div className="font-medium">
                        {isSingleDay
                          ? format(start, "MMM d, yyyy")
                          : `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`}
                      </div>
                      {bd.reason && (
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {bd.reason}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(bd.id)}
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
