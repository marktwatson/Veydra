import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { currentTerritoryId } from "@/lib/current-territory";
import { formatDisplayDate } from "@/lib/utils";
import { type AreaBlackout } from "@/lib/area-blackout";

/** Area-only blackout dates. Not contractor blackouts, and not app-wide. */
export function AreaBlackoutDatesCard() {
  const { toast } = useToast();
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [rows, setRows] = useState<AreaBlackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = async (id: string) => {
    const { data, error } = await supabase
      .from("area_blackout_dates")
      .select("id, territory_id, start_date, end_date, note")
      .eq("territory_id", id)
      .order("start_date", { ascending: true });
    if (error && (error.code === "42P01" || error.code === "PGRST205")) {
      setMissing(true);
      setRows([]);
      return;
    }
    if (error) {
      toast({
        title: "Could not load blackout dates",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setMissing(false);
    setRows((data || []) as AreaBlackout[]);
  };

  useEffect(() => {
    let active = true;
    currentTerritoryId()
      .then(async (id) => {
        if (!active) return;
        setTerritoryId(id);
        if (id) await reload(id);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const addDate = async () => {
    if (!territoryId || !startDate) return;
    const end = endDate || startDate;
    if (end < startDate) {
      toast({
        title: "Check the dates",
        description: "The end date has to be on or after the start date.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("area_blackout_dates").insert({
      territory_id: territoryId,
      start_date: startDate,
      end_date: end,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({
        title: "Could not add that date",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setStartDate("");
    setEndDate("");
    setNote("");
    await reload(territoryId);
  };

  const removeDate = async (id: string) => {
    const { error } = await supabase
      .from("area_blackout_dates")
      .delete()
      .eq("id", id);
    if (error) {
      toast({
        title: "Could not remove that date",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    if (territoryId) await reload(territoryId);
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Blackout dates</CardTitle>
        <CardDescription>
          Dates this area is already too full to promise. A salesperson can
          still build the proposal, but Send stays off until a manager confirms
          the date can be covered. This list is only for the area you have
          selected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {missing && (
          <p className="text-sm text-destructive">
            The blackout list is not in the database yet. Run the area blackout
            SQL, then refresh.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label>Start</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>End</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional, for your team"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={addDate}
          disabled={!territoryId || !startDate || saving || missing}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add blackout
        </Button>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading dates…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No blackout dates for this area.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>
                  {formatDisplayDate(row.start_date)}
                  {row.end_date && row.end_date !== row.start_date
                    ? ` – ${formatDisplayDate(row.end_date)}`
                    : ""}
                  {row.note ? (
                    <span className="text-muted-foreground"> · {row.note}</span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDate(row.id)}
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
