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

function EventWorkspace({ event, weddingId, territoryId }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(event.notes || "");
  const [role, setRole] = useState("Lead Photographer");
  const [pay, setPay] = useState("");
  const [hours, setHours] = useState("");

  const { data: positions = [] } = useQuery({
    queryKey: ["event-jobs", event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, role, pay_rate, hours, status")
        .eq("event_id", event.id);
      if (error) throw error;
      return data || [];
    },
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("wedding_events")
        .update({ notes })
        .eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Event notes saved" }),
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Could not save notes",
        description: err.message,
      }),
  });

  const addPosition = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("jobs").insert({
        wedding_id: weddingId,
        territory_id: territoryId || null,
        event_id: event.id,
        role,
        pay_rate: Number(pay || 0),
        hours: hours ? Number(hours) : null,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPay("");
      setHours("");
      queryClient.invalidateQueries({ queryKey: ["event-jobs", event.id] });
      toast({ title: "Position added to this event" });
    },
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Could not add position",
        description: err.message,
      }),
  });

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div>
        <p className="text-sm font-medium">
          {EVENT_TYPES.find((t) => t.value === event.event_type)?.label ||
            event.event_type}
          {event.title ? ` · ${event.title}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {event.event_date || "No date"}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
      <div className="space-y-1">
        <Label>Notes for this date</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Timing, wardrobe, what this crew needs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => saveNotes.mutate()}
        >
          Save notes
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium">Positions for this event</p>
        {positions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No positions yet.</p>
        ) : (
          positions.map((job: any) => (
            <p key={job.id} className="text-sm">
              {job.role} · ${job.pay_rate || 0} · {job.hours || "—"} hrs ·{" "}
              {job.status}
            </p>
          ))
        )}
        <div className="grid grid-cols-3 gap-2">
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role"
          />
          <Input
            value={pay}
            onChange={(e) => setPay(e.target.value)}
            placeholder="Pay"
          />
          <Input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Hours"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addPosition.mutate()}
        >
          Add position
        </Button>
        <p className="text-xs text-muted-foreground">
          This does not alert contractors yet. The questionnaire stays on the
          wedding.
        </p>
      </div>
    </div>
  );
}

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
          Each date has its own notes and positions. Contractor alerts are not
          on yet. The questionnaire stays on the wedding.
        </p>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No extra events yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event: any) => (
            <EventWorkspace
              key={event.id}
              event={event}
              weddingId={weddingId}
              territoryId={territoryId}
            />
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
