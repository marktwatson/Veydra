import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type Item = {
  id: string;
  label: string;
  done: boolean;
  manual?: boolean;
  hint: string;
  phase?: "after";
};

function questionnaireIsFilled(raw: any): boolean {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return false;
    }
  }
  if (!data || typeof data !== "object") return false;
  const contact = data.contact_info || {};
  const photo = data.photo_video || {};
  const style = data.style_vibe || {};
  return [
    contact.bride_full_name,
    contact.groom_full_name,
    contact.full_name,
    photo.must_have_photos,
    photo.must_have_video_moments,
    style.wedding_theme,
  ].some((value) => String(value || "").trim().length > 0);
}

function weddingDayPassed(dateValue: any): boolean {
  if (!dateValue) return false;
  const day = String(dateValue).split("T")[0];
  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return day <= stamp;
}
function hasText(value: any): boolean {
  if (!value) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "{}" || trimmed === "[]") return false;
    try {
      return hasText(JSON.parse(trimmed));
    } catch {
      return true;
    }
  }
  if (Array.isArray(value)) return value.some(hasText);
  if (typeof value === "object") return Object.values(value).some(hasText);
  return false;
}

function realTimeline(raw: any): boolean {
  let rows = raw;
  if (typeof rows === "string") {
    try {
      rows = JSON.parse(rows);
    } catch {
      return rows.trim().length > 20;
    }
  }
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const onlyPlaceholder =
    rows.length === 1 && /photographer arrives/i.test(String(rows[0]?.event || ""));
  return !onlyPlaceholder;
}

function activeAssignment(job: any) {
  return (job.assignments || []).find((assignment: any) => {
    const status = String(assignment.status || "").toLowerCase();
    return !status.includes("cancel") && !status.includes("declin");
  });
}

function personName(assignment: any) {
  const person = assignment?.contractors;
  const row = Array.isArray(person) ? person[0] : person;
  return [row?.first_name, row?.last_name].filter(Boolean).join(" ");
}

export function WeddingChecklist({ wedding }: { wedding: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [manual, setManual] = useState<Record<string, boolean>>(
    wedding?.manager_checklist && typeof wedding.manager_checklist === "object"
      ? wedding.manager_checklist
      : {},
  );
  const saved = manual;

  const { data: jobs = [] } = useQuery({
    queryKey: ["checklist-jobs", wedding?.id],
    enabled: !!wedding?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, role, status, event_id, assignments(id, status, attendance_confirmed, contractor_id, contractors(first_name, last_name))",
        )
        .eq("wedding_id", wedding.id);
      if (error) return [];
      return data || [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["checklist-events", wedding?.id],
    enabled: !!wedding?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_events")
        .select(
          "id, title, event_type, event_date, venue, address, location, timeline_notes, day_questions, needs_early_edit, editor_id, edit_due_date, drive_link, edit_details",
        )
        .eq("wedding_id", wedding.id)
        .order("event_date");
      if (error) return [];
      return (data || []).filter((event: any) => event.event_type !== "wedding_day");
    },
  });

  const paid = Number(wedding?.paid_amount || wedding?.ghl_amount_paid || 0) > 0;
  const total = Number(wedding?.total_amount || 0);
  const paidFull =
    !!wedding?.final_payment_verified || (total > 0 && Number(wedding?.paid_amount || 0) >= total);
  const published = ["upcoming", "completed"].includes(String(wedding?.status || ""));
  const region = Array.isArray(wedding?.region) ? wedding.region.length > 0 : !!wedding?.region;
  const weddingJobs = jobs.filter((job: any) => !job.event_id);
  const videoWork =
    /video/i.test(String(wedding?.package || "")) ||
    jobs.some((job: any) => /video/i.test(String(job.role || "")));
  const songs = Array.isArray(wedding?.highlight_songs)
    ? wedding.highlight_songs.length > 0
    : hasText(wedding?.highlight_songs);
  const questionnaire = questionnaireIsFilled(wedding?.questionnaire_data);
  const contractSigned =
    /sign|complete/i.test(String(wedding?.contract_status || "")) ||
    !!wedding?.contract_date ||
    hasText(wedding?.contract_snapshot);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Booked",
      items: [
        { id: "contract", label: "Contract signed", done: contractSigned, hint: "The bride signs on the proposal. This checks itself when the contract is signed." },
        { id: "deposit", label: "A payment is on the wedding", done: paid, hint: "A paid invoice has to land on this wedding. This checks itself when money is recorded." },
        {
          id: "reviewed_hours",
          label: "Package hours reviewed",
          done: !!saved.reviewed_hours,
          manual: true,
          hint: "Open the booked package and confirm the photo and video hours, then check this yourself.",
        },
      ],
    },
    {
      title: "Publish",
      items: [
        { id: "published", label: "Wedding published", done: published, hint: "Publish the wedding from the weddings list. Draft and pending do not count." },
        { id: "date", label: "Date is set", done: !!wedding?.date, hint: "Put the wedding date on the Details tab." },
        { id: "place", label: "Location is set", done: !!String(wedding?.location || "").trim(), hint: "Put the venue or address on the Details tab." },
        { id: "region", label: "Region is set", done: region, hint: "Choose the region on the Details tab so the right contractors can see the jobs." },
        { id: "positions", label: "Positions exist", done: weddingJobs.length > 0, hint: "Add the photo and video positions on the Positions tab." },
        {
          id: "alerts_sent",
          label: "Job alerts sent",
          done: !!saved.alerts_sent,
          manual: true,
          hint: "Use Resend alerts on each open position, then check this yourself.",
        },
      ],
    },
    {
      title: "Team",
      items: weddingJobs.flatMap((job: any) => {
        const assignment = activeAssignment(job);
        const name = personName(assignment);
        return [
          {
            id: `filled-${job.id}`,
            label: name ? `${job.role} · ${name}` : `${job.role || "Position"} filled`,
            done: !!assignment?.contractor_id,
            hint: "Assign someone on the Positions tab. This checks itself when a person is on the job.",
          },
          {
            id: `confirmed-${job.id}`,
            label: `${name || job.role || "Contractor"} confirmed`,
            done: !!assignment?.attendance_confirmed,
            hint: "The contractor confirms attendance in their own portal. This checks itself when they do.",
          },
        ];
      }),
    },
    {
      title: "Before the day",
      items: [
        { id: "questionnaire", label: "Questionnaire is in", done: questionnaire, hint: "The bride fills this in on her portal. An empty form does not count." },
        { id: "timeline", label: "Timeline is filled in", done: realTimeline(wedding?.timeline), hint: "The bride adds the real timeline on her portal. The placeholder row does not count." },
        ...(videoWork
          ? [{ id: "songs", label: "Highlight songs are in", done: songs || !!wedding?.songs_submitted_at, hint: "The bride submits highlight songs on her portal." }]
          : []),
        {
          id: "call_sheet_sent",
          label: "Call sheet sent",
          done: !!saved.call_sheet_sent,
          manual: true,
          hint: "Send the call sheet to the assigned team, then check this yourself.",
        },
      ],
    },
    {
      title: "After the day",
      items: [
        {
          id: "raw",
          label: "Raw media is linked",
          done: !!(wedding?.drive_link || wedding?.upload_link),
          hint: "Add the drive or upload link on this wedding.",
          phase: "after",
        },
        { id: "editor", label: "Editor is assigned", done: !!wedding?.editor_id, hint: "Assign an editor in Post Production.", phase: "after" },
        { id: "due", label: "Edit due date is set", done: !!wedding?.editor_due_date, hint: "Set the editor due date in Post Production.", phase: "after" },
        {
          id: "delivery",
          label: "Gallery or film link is in",
          done: !!(wedding?.gallery_link || wedding?.vimeo_link || wedding?.youtube_link),
          hint: "Add the gallery, Vimeo, or YouTube link when the edit is delivered.",
          phase: "after",
        },
        {
          id: "editor-invoice",
          label: "Editor invoice sent",
          done: /sent|paid|invoic/i.test(String(wedding?.editor_invoice_status || "")),
          hint: "The editor sends the invoice from their pipeline after the edit is delivered.",
          phase: "after",
        },
        { id: "balance", label: "Balance is paid", done: paidFull, hint: "The remaining balance has to be recorded on the wedding.", phase: "after" },
      ],
    },
  ];

  for (const event of events) {
    const eventJobs = jobs.filter((job: any) => job.event_id === event.id);
    const title = event.title || "Extra date";
    const items: Item[] = [
      { id: `event-date-${event.id}`, label: `${title} date is set`, done: !!event.event_date, hint: "Set the date on the Events tab." },
      {
        id: `event-place-${event.id}`,
        label: `${title} location is set`,
        done: !!(event.venue || event.address || event.location),
        hint: "Add the venue or address on the Events tab.",
      },
      {
        id: `event-details-${event.id}`,
        label: `${title} questions or timeline are in`,
        done: hasText(event.day_questions) || hasText(event.timeline_notes),
        hint: "The bride fills the questions for this date on her portal.",
      },
    ];
    for (const job of eventJobs) {
      const assignment = activeAssignment(job);
      const name = personName(assignment);
      items.push({
        id: `event-filled-${job.id}`,
        label: name ? `${title} · ${job.role} · ${name}` : `${title} · ${job.role || "Position"} filled`,
        done: !!assignment?.contractor_id,
        hint: "Assign this date's position on the Events tab.",
      });
      items.push({
        id: `event-confirmed-${job.id}`,
        label: `${title} · ${name || job.role || "Contractor"} confirmed`,
        done: !!assignment?.attendance_confirmed,
        hint: "That contractor confirms this date in their portal.",
      });
    }
    if (event.needs_early_edit) {
      const details = event.edit_details || {};
      items.push(
        { id: `event-editor-${event.id}`, label: `${title} editor assigned`, done: !!event.editor_id, hint: "Assign the editor on this date's row in Post Production." },
        { id: `event-due-${event.id}`, label: `${title} edit due date set`, done: !!event.edit_due_date, hint: "Set the due date on this date's edit in Post Production." },
        { id: `event-raw-${event.id}`, label: `${title} raw media linked`, done: !!event.drive_link, hint: "Add the raw media link on this date's edit." },
        {
          id: `event-invoice-${event.id}`,
          label: `${title} editor invoice sent`,
          done: /sent|paid|invoic/i.test(String(details.invoice_status || "")),
          hint: "The editor sends this date's invoice from their pipeline.",
        },
      );
    }
    groups.push({ title, items });
  }

  const all = groups.flatMap((group) => group.items);
  const ready = all.filter((item) => item.phase !== "after");
  const after = all.filter((item) => item.phase === "after");
  const readyDone = ready.filter((item) => item.done).length;
  const afterDone = after.filter((item) => item.done).length;
  const showAfter = weddingDayPassed(wedding?.date);

  const toggle = async (id: string, next: boolean) => {
    const manager_checklist = { ...saved, [id]: next };
    setManual(manager_checklist);
    const { error } = await supabase
      .from("weddings")
      .update({ manager_checklist })
      .eq("id", wedding.id);
    if (error) {
      setManual(saved);
      toast({
        variant: "destructive",
        title: "Could not save that check",
        description: error.message,
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["weddings"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">
          {readyDone} of {ready.length} ready for the day
          {showAfter ? ` · ${afterDone} of ${after.length} after` : ""}
        </p>
        <p className="text-xs text-muted-foreground">Locked rows follow the wedding</p>
      </div>
      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <div key={group.title} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.title}
              {group.title === "After the day" && !showAfter ? " · counted after the wedding" : ""}
            </p>
            <div className="rounded-lg border divide-y">
              {group.items.map((item) => (
                <label key={item.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={item.done}
                    disabled={!item.manual}
                    onCheckedChange={(value) => {
                      if (item.manual) toggle(item.id, value === true);
                    }}
                  />
                  <span className="min-w-0">
                    <span className={item.done ? "text-muted-foreground" : ""}>{item.label}</span>
                    {!item.done && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
                    )}
                  </span>
                  {!item.manual && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                      Auto
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
