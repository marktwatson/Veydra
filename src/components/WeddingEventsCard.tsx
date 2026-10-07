import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const EVENT_TYPES = [
  { value: "wedding_day", label: "Wedding day" },
  { value: "engagement", label: "Engagement session" },
  { value: "bartending", label: "Bartending" },
  { value: "sangeet", label: "Sangeet / other day" },
];

export function WeddingEventsCard({
  weddingId,
  territoryId,
}: {
  weddingId: string;
  territoryId?: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [eventType, setEventType] = useState("engagement");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState("");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["wedding-events", weddingId],
    enabled: !!weddingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_events")
        .select("id, event_type, title, event_date, location, notes")
        .eq("wedding_id", weddingId)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const addEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wedding_events").insert({
        wedding_id: weddingId,
        territory_id: territoryId || null,
        event_type: eventType,
        title: title || null,
        event_date: eventDate || null,
        location: location || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setEventDate("");
      setLocation("");
      queryClient.invalidateQueries({ queryKey: ["wedding-events", weddingId] });
      toast({ title: "Event added" });
    },
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Could not add event",
        description: err.message,
      }),
  });

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div>
        <p className="text-sm font-medium">Events</p>
        <p className="text-xs text-muted-foreground">
          Separate dates under this wedding. Positions still publish from the
          wedding until this is approved.
        </p>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No extra events yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event: any) => (
            <div key={event.id} className="text-sm">
              <span className="font-medium">
                {EVENT_TYPES.find((t) => t.value === event.event_type)?.label ||
                  event.event_type}
              </span>
              {event.title ? ` · ${event.title}` : ""}
              <div className="text-xs text-muted-foreground">
                {event.event_date || "No date"}
                {event.location ? ` · ${event.location}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Type</Label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Date</Label>
          <Input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
      </div>
      <Input
        placeholder="Title, optional"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        placeholder="Location, optional"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={addEvent.isPending}
        onClick={() => addEvent.mutate()}
      >
        Add event
      </Button>
    </div>
  );
}
