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
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { currentTerritoryId } from "@/lib/current-territory";
import { formatDisplayDate } from "@/lib/utils";
import {
  dateHitsBlackout,
  dayKey,
  type AreaBlackout,
} from "@/lib/area-blackout";

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmd(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function shiftDay(value: string, days: number): string {
  const date = parseYmd(value);
  date.setDate(date.getDate() + days);
  return ymd(date);
}

function rowStart(row: AreaBlackout): string {
  return dayKey(row.start_date);
}

function rowEnd(row: AreaBlackout): string {
  return dayKey(row.end_date) || rowStart(row);
}

function expandDays(rows: AreaBlackout[]): Date[] {
  const dates: Date[] = [];
  for (const row of rows) {
    const start = rowStart(row);
    const end = rowEnd(row);
    if (!start) continue;
    let cursor = start;
    let guard = 0;
    while (cursor <= end && guard < 400) {
      dates.push(parseYmd(cursor));
      cursor = shiftDay(cursor, 1);
      guard += 1;
    }
  }
  return dates;
}

function withoutDay(rows: AreaBlackout[], day: string): AreaBlackout[] {
  const next: AreaBlackout[] = [];
  for (const row of rows) {
    const start = rowStart(row);
    const end = rowEnd(row);
    if (!start || day < start || day > end) {
      next.push(row);
      continue;
    }
    if (start === day && end === day) continue;
    if (start === day) {
      next.push({ ...row, start_date: shiftDay(day, 1) });
      continue;
    }
    if (end === day) {
      next.push({ ...row, end_date: shiftDay(day, -1) });
      continue;
    }
    next.push({ ...row, end_date: shiftDay(day, -1) });
    next.push({
      ...row,
      id: `${row.id}-split`,
      start_date: shiftDay(day, 1),
      end_date: end,
    });
  }
  return next;
}

function labelFor(row: AreaBlackout): string {
  const start = rowStart(row);
  const end = rowEnd(row);
  if (!start) return "Date";
  if (!end || end === start) return formatDisplayDate(start);
  return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
}

/** Area-only blackout dates. Not contractor blackouts, and not app-wide. */
export function AreaBlackoutDatesCard() {
  const { toast } = useToast();
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [rows, setRows] = useState<AreaBlackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wide, setWide] = useState(false);

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

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const addDay = async (day: string) => {
    if (!territoryId || missing || saving || dateHitsBlackout(day, rows)) return;
    setRows((prev) => [
      ...prev,
      {
        id: `temp-${day}`,
        territory_id: territoryId,
        start_date: day,
        end_date: day,
        note: null,
      },
    ]);
    setSaving(true);
    const { error } = await supabase.from("area_blackout_dates").insert({
      territory_id: territoryId,
      start_date: day,
      end_date: day,
      note: null,
    });
    setSaving(false);
    if (error) {
      toast({
        title: "Could not block that date",
        description: error.message,
        variant: "destructive",
      });
    }
    await reload(territoryId);
  };

  const clearDay = async (day: string) => {
    if (!territoryId || saving) return;
    const before = rows.filter((row) => !row.id.startsWith("temp-"));
    setRows(withoutDay(before, day));
    setSaving(true);
    try {
      for (const row of before) {
        const start = rowStart(row);
        const end = rowEnd(row);
        if (!start || day < start || day > end) continue;
        if (start === day && end === day) {
          const { error } = await supabase
            .from("area_blackout_dates")
            .delete()
            .eq("id", row.id);
          if (error) throw error;
          continue;
        }
        if (start === day) {
          const { error } = await supabase
            .from("area_blackout_dates")
            .update({ start_date: shiftDay(day, 1) })
            .eq("id", row.id);
          if (error) throw error;
          continue;
        }
        if (end === day) {
          const { error } = await supabase
            .from("area_blackout_dates")
            .update({ end_date: shiftDay(day, -1) })
            .eq("id", row.id);
          if (error) throw error;
          continue;
        }
        const { error } = await supabase
          .from("area_blackout_dates")
          .update({ end_date: shiftDay(day, -1) })
          .eq("id", row.id);
        if (error) throw error;
        const { error: insertError } = await supabase
          .from("area_blackout_dates")
          .insert({
            territory_id: territoryId,
            start_date: shiftDay(day, 1),
            end_date: end,
            note: row.note,
          });
        if (insertError) throw insertError;
      }
    } catch (err: any) {
      toast({
        title: "Could not open that date",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    }
    setSaving(false);
    await reload(territoryId);
  };

  const removeRow = async (id: string) => {
    if (saving || id.startsWith("temp-")) return;
    setSaving(true);
    const { error } = await supabase
      .from("area_blackout_dates")
      .delete()
      .eq("id", id);
    setSaving(false);
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

  const today = ymd(new Date());
  const upcoming = rows
    .filter((row) => rowEnd(row) >= today)
    .sort((a, b) => rowStart(a).localeCompare(rowStart(b)));
  const past = rows
    .filter((row) => rowEnd(row) < today)
    .sort((a, b) => rowStart(b).localeCompare(rowStart(a)));

  const renderList = (list: AreaBlackout[], empty: string) =>
    list.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="divide-y rounded-md border">
        {list.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
          >
            <span>
              {labelFor(row)}
              {row.note ? (
                <span className="text-muted-foreground"> · {row.note}</span>
              ) : null}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(row.id)}
              title="Remove"
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blackout dates</CardTitle>
        <CardDescription>
          Click a day to block it for this area. Click it again to open it
          back up. A salesperson can still build the proposal, but Send stays
          off until a manager confirms that date can be covered.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {missing && (
          <p className="text-sm text-destructive">
            The blackout list is not in the database yet. Run the area blackout
            SQL, then refresh.
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border bg-muted/20 p-2 sm:p-4">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Calendar
              mode="multiple"
              selected={expandDays(rows)}
              onSelect={(_next, day) => {
                if (!day || missing || saving) return;
                const key = ymd(day);
                if (dateHitsBlackout(key, rows)) void clearDay(key);
                else void addDay(key);
              }}
              numberOfMonths={wide ? 2 : 1}
              showOutsideDays
              className="mx-auto w-fit p-0"
              classNames={{
                months: "flex flex-col gap-8 md:flex-row md:gap-10",
                month: "space-y-4",
                caption_label: "text-base font-semibold",
                head_cell:
                  "text-muted-foreground w-11 sm:w-12 font-medium text-xs",
                row: "flex w-full mt-1",
                cell: "h-11 w-11 sm:h-12 sm:w-12 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                day: "inline-flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 p-0 font-normal rounded-md hover:bg-amber-100 dark:hover:bg-amber-950/40 aria-selected:opacity-100",
                day_selected:
                  "bg-amber-800 text-white hover:bg-amber-900 hover:text-white focus:bg-amber-800 focus:text-white",
                day_today: "ring-1 ring-amber-800/50",
              }}
            />
          )}
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-800" />
          Highlighted days are blocked
          {saving ? " · Saving…" : ""}
        </p>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Coming up</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading dates…</p>
          ) : (
            renderList(upcoming, "Nothing blocked yet. Click a day above.")
          )}
        </div>
        {past.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Earlier
            </h3>
            {renderList(past, "")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
