import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { callOvantaSend } from "@/lib/api";
import { currentTerritoryId } from "@/lib/current-territory";
import { toast } from "sonner";

export function InterviewCalendarSetting() {
  const [calendars, setCalendars] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const territoryId = await currentTerritoryId();
      if (!territoryId) return;
      const { data } = await supabase
        .from("portal_settings")
        .select("interview_calendar_id")
        .eq("territory_id", territoryId)
        .limit(1)
        .maybeSingle();
      if (data?.interview_calendar_id) setSelected(data.interview_calendar_id);
    };
    load();
  }, []);

  const loadCalendars = async () => {
    setLoading(true);
    try {
      const territoryId = await currentTerritoryId();
      const data = await callOvantaSend({ action: "calendars", territoryId });
      const list = data?.calendars || [];
      setCalendars(list);
      if (!list.length) toast.error("No calendars came back for this area.");
    } catch (error: any) {
      toast.error(error?.message || "Could not load calendars.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const territoryId = await currentTerritoryId();
      if (!territoryId || !selected) return;
      const { error } = await supabase
        .from("portal_settings")
        .update({ interview_calendar_id: selected })
        .eq("territory_id", territoryId);
      if (error) throw error;
      toast.success("Interview calendar saved for this area.");
    } catch (error: any) {
      toast.error(error?.message || "Could not save the calendar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-2 pt-4 border-t mt-4">
      <Label>Interview calendar</Label>
      <p className="text-xs text-muted-foreground">
        Applicants in this area book from this Ovanta calendar. Load the list,
        pick the calendar, then save.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={loadCalendars}>
          {loading ? "Loading..." : "Load calendars"}
        </Button>
        {calendars.length > 0 && (
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a calendar</option>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <Button type="button" onClick={save} disabled={saving || !selected}>
          {saving ? "Saving..." : "Save calendar"}
        </Button>
      </div>
      {selected && calendars.length === 0 && (
        <p className="text-xs text-muted-foreground">
          A calendar is already saved. Load calendars to change it.
        </p>
      )}
    </div>
  );
}
