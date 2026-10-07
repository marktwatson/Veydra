import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createAssignmentWithTerritory } from "@/lib/child-row-territory";

const EVENT_TYPES = [
  { value: "wedding_day", label: "Wedding day" },
  { value: "engagement", label: "Engagement session" },
  { value: "bartending", label: "Bartending" },
  { value: "sangeet", label: "Sangeet / other day" },
];

function EventFile({ event, weddingId, territoryId }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(event.notes || "");
  const [earlyEdit, setEarlyEdit] = useState(!!event.needs_early_edit);
  const [role, setRole] = useState("Lead Photographer");
  const [pay, setPay] = useState("");
  const [hours, setHours] = useState("");
  const [contractorId, setContractorId] = useState("");

  const { data: positions = [] } = useQuery({
    queryKey: ["event-jobs", event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, role, pay_rate, hours, status, assignments(id, contractor_id, status, contractors(first_name, last_name))")
        .eq("event_id", event.id);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ["event-contractors", territoryId],
    enabled: !!territoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contractors")
        .select("id, first_name, last_name")
        .eq("territory_id", territoryId)
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const saveDetails = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("wedding_events")
        .update({ notes, needs_early_edit: earlyEdit })
        .eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Event details saved" }),
    onError: (err: any) =>
      toast({ variant: "destructive", title: "Could not save event", description: err.message }),
  });

  const addPosition = useMutation({
    mutationFn: async () => {
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          wedding_id: weddingId,
          territory_id: territoryId || null,
          event_id: event.id,
          role,
          pay_rate: Number(pay || 0),
          hours: hours ? Number(hours) : null,
          status: contractorId ? "filled" : "open",
        })
        .select("id")
        .single();
      if (error) throw error;
      if (contractorId) {
        await createAssignmentWithTerritory({
          job_id: job.id,
          contractor_id: contractorId,
          status: "Upcoming",
        });
      }
    },
    onSuccess: () => {
      setPay("");
      setHours("");
      setContractorId("");
      queryClient.invalidateQueries({ queryKey: ["event-jobs", event.id] });
      toast({ title: "Position saved on this event" });
    },
    onError: (err: any) =>
      toast({ variant: "destructive", title: "Could not add position", description: err.message }),
  });

  const removePosition = useMutation({
    mutationFn: async (jobId: string) => {
      await supabase.from("assignments").delete().eq("job_id", jobId);
      const { error } = await supabase.from("jobs").delete().eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-jobs", event.id] });
      toast({ title: "Position removed" });
    },
    onError: (err: any) =>
      toast({ variant: "destructive", title: "Could not remove position", description: err.message }),
  });

  const label =
    EVENT_TYPES.find((t) => t.value === event.event_type)?.label || event.event_type;

  return (
    <div className="rounded-xl border p-4 space-y-4">
      <div>
        <p className="font-semibold">{event.title || label}</p>
        <p className="text-sm text-muted-foreground">
          {label} · {event.event_date || "Date not set"}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
      <div className="space-y-2">
        <Label>What this crew needs</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={earlyEdit}
            onChange={(e) => setEarlyEdit(e.target.checked)}
          />
          Bride needs this edited before the wedding day
        </label>
        <Button type="button" size="sm" variant="outline" onClick={() => saveDetails.mutate()}>
          Save event details
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Crew</p>
        {positions.length === 0 && (
          <p className="text-sm text-muted-foreground">No one assigned yet.</p>
        )}
        {positions.map((job: any) => {
          const assignment = (job.assignments || []).find(
            (a: any) => String(a.status || "").toLowerCase() !== "cancelled",
          );
          const name = assignment?.contractors
            ? `${assignment.contractors.first_name || ""} ${assignment.contractors.last_name || ""}`.trim()
            : "Unassigned";
          return (
            <div key={job.id} className="flex items-center justify-between text-sm">
              <span>
                {job.role} · {name} · ${job.pay_rate || 0} · {job.hours || "—"} hrs
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removePosition.mutate(job.id)}
              >
                Remove
              </Button>
            </div>
          );
        })}
        <div className="grid grid-cols-2 gap-2">
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {contractors.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
          <Input value={pay} onChange={(e) => setPay(e.target.value)} placeholder="Pay" />
          <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours" />
        </div>
        <Button type="button" size="sm" onClick={() => addPosition.mutate()}>
          Add crew
        </Button>
        <p className="text-xs text-muted-foreground">
          Assigning here does not text the contractor yet. The wedding questionnaire stays on the wedding.
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
        .select("id, event_type, title, event_date, location, notes, needs_early_edit")
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
      toast({ variant: "destructive", title: "Could not add event", description: err.message }),
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading events…</p>
      ) : (
        events.map((event: any) => (
          <EventFile
            key={event.id}
            event={event}
            weddingId={weddingId}
            territoryId={territoryId}
          />
        ))
      )}
      <div className="rounded-xl border p-4 space-y-3">
        <p className="text-sm font-medium">Add another date</p>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Button type="button" variant="outline" onClick={() => addEvent.mutate()}>
          Add event
        </Button>
      </div>
    </div>
  );
}
