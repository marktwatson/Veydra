import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createAssignmentWithTerritory } from "@/lib/child-row-territory";

const EVENT_TYPES = [
  { value: "wedding_day", label: "Wedding day", chip: "bg-rose-100 text-rose-800", card: "border-l-rose-500 bg-rose-50" },
  { value: "engagement", label: "Engagement session", chip: "bg-amber-100 text-amber-900", card: "border-l-amber-500 bg-amber-50" },
  { value: "bartending", label: "Bartending", chip: "bg-emerald-100 text-emerald-900", card: "border-l-emerald-500 bg-emerald-50" },
  { value: "sangeet", label: "Sangeet / other day", chip: "bg-violet-100 text-violet-900", card: "border-l-violet-500 bg-violet-50" },
];

const EVENT_BADGES: Record<string, { label: string; className: string }> = {
  engagement: { label: "Engagement", className: "bg-amber-100 text-amber-900" },
  bartending: { label: "Bartending", className: "bg-emerald-100 text-emerald-900" },
  sangeet: { label: "Other day", className: "bg-violet-100 text-violet-900" },
};

function shortEventDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = String(value).split("T")[0].split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function EventTypeBadges({ events }: { events?: any[] }) {
  const extras = (events || []).filter(
    (event) => event.event_type && event.event_type !== "wedding_day",
  );
  if (extras.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {extras.map((event) => {
        const meta = EVENT_BADGES[event.event_type] || {
          label: event.title || "Extra date",
          className: "bg-sky-100 text-sky-900",
        };
        const when = shortEventDate(event.event_date);
        return (
          <span
            key={event.id}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
          >
            {meta.label}
            {when ? ` · ${when}` : ""}
          </span>
        );
      })}
    </div>
  );
}

export function useWeddingEventBadges(weddingIds: string[]) {
  const key = [...weddingIds].sort().join(",");
  return useQuery({
    queryKey: ["wedding-event-badges", key],
    enabled: weddingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_events")
        .select("id, wedding_id, event_type, title, event_date, venue, address, location")
        .in("wedding_id", weddingIds);
      if (error) throw error;
      const map = new Map<string, any[]>();
      for (const event of data || []) {
        if (!event.event_type || event.event_type === "wedding_day") continue;
        const list = map.get(event.wedding_id) || [];
        list.push(event);
        map.set(event.wedding_id, list);
      }
      return map;
    },
  });
}

function EventFile({ event, weddingId, territoryId }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(event.notes || "");
  const [timeline, setTimeline] = useState(event.timeline_notes || "");
  const [questions, setQuestions] = useState(event.day_questions || "");
  const [venue, setVenue] = useState(event.venue || "");
  const [address, setAddress] = useState(event.address || event.location || "");
  const [eventDate, setEventDate] = useState(event.event_date || "");
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
        .update({
          notes,
          needs_early_edit: earlyEdit,
          venue,
          address,
          location: address,
          timeline_notes: timeline,
          day_questions: questions,
          event_date: eventDate || null,
        })
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
      } else {
        const place = [venue, address, event.location].filter(Boolean).join(", ");
        const kind = event.title || "an extra date";
        try {
          await api.resendJobAlerts(job.id, undefined, {
            location: place || undefined,
            date: eventDate || event.event_date || undefined,
            kind,
          });
        } catch (alertError) {
          console.error("Event job alert failed", alertError);
        }
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

  const removeEvent = useMutation({
    mutationFn: async () => {
      const { data: jobs } = await supabase.from("jobs").select("id").eq("event_id", event.id);
      for (const job of jobs || []) {
        await supabase.from("assignments").delete().eq("job_id", job.id);
        await supabase.from("jobs").delete().eq("id", job.id);
      }
      const { error } = await supabase.from("wedding_events").delete().eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wedding-events", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding-event-badges"] });
      toast({ title: "Event removed" });
    },
    onError: (err: any) =>
      toast({ variant: "destructive", title: "Could not remove event", description: err.message }),
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

  const typeMeta = EVENT_TYPES.find((t) => t.value === event.event_type);
  const label = typeMeta?.label || event.event_type;

  return (
    <div className="rounded-2xl border border-[#c9a96e]/30 bg-white p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <h3 className="mt-1 text-lg font-semibold">{event.title || label}</h3>
          <p className="text-sm text-muted-foreground">{venue || address || "Location not set"}</p>
        </div>
        <div className="w-40 space-y-1">
          <Label>Date</Label>
          <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        {positions.length === 0 && (
          <p className="text-sm text-muted-foreground">No crew on this date yet.</p>
        )}
        {positions.map((job: any) => {
          const assignment = (job.assignments || []).find(
            (a: any) => String(a.status || "").toLowerCase() !== "cancelled",
          );
          const name = assignment?.contractors
            ? `${assignment.contractors.first_name || ""} ${assignment.contractors.last_name || ""}`.trim()
            : "Unassigned";
          return (
            <div key={job.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[#c9a96e]/20 bg-[#faf7f2] px-3 py-2">
              <div>
                <p className="text-sm font-medium">{job.role}</p>
                <p className="text-sm text-muted-foreground">{name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">${job.pay_rate || 0} · {job.hours || "—"} hrs</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => removePosition.mutate(job.id)}>
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Add crew</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      </div>

      <div className="grid gap-3 border-t border-[#c9a96e]/20 pt-4">
        <div className="space-y-2">
          <Label>Venue</Label>
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue name" />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state" />
        </div>
        <div className="space-y-2">
          <Label>Timeline</Label>
          <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="One line per moment" />
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Wardrobe, timing, anything else" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={earlyEdit} onChange={(e) => setEarlyEdit(e.target.checked)} />
          Bride needs this edited before the wedding day
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => saveDetails.mutate()}>
            Save this date
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => removeEvent.mutate()}>
            Remove this date
          </Button>
        </div>
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
        .select("id, event_type, title, event_date, location, venue, address, notes, needs_early_edit, timeline_notes, day_questions")
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
      queryClient.invalidateQueries({ queryKey: ["wedding-event-badges"] });
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
      <div className="rounded-2xl border border-[#c9a96e]/30 bg-white p-4 space-y-3">
        <p className="text-sm font-medium">Add another date</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
