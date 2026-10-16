import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type AreaBlackout = {
  id: string;
  territory_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
};

export function dayKey(value: string | null | undefined): string {
  return String(value || "").slice(0, 10);
}

export function dateHitsBlackout(
  date: string | null | undefined,
  rows: AreaBlackout[],
): boolean {
  const day = dayKey(date);
  if (!day) return false;
  return rows.some((row) => {
    const start = dayKey(row.start_date);
    const end = dayKey(row.end_date) || start;
    return !!start && day >= start && day <= end;
  });
}

export async function loadAreaBlackouts(
  territoryId: string | null | undefined,
): Promise<AreaBlackout[]> {
  if (!territoryId) return [];
  const { data, error } = await supabase
    .from("area_blackout_dates")
    .select("id, territory_id, start_date, end_date, note")
    .eq("territory_id", territoryId)
    .order("start_date", { ascending: true });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    console.warn("area blackout lookup skipped", error.message);
    return [];
  }
  return (data || []) as AreaBlackout[];
}

/**
 * Watches one area's blackout list. Send stays locked for a matching date
 * until the salesperson confirms a manager said the date can be covered.
 * Changing the date clears that confirmation.
 */
export function useAreaBlackoutGate(
  territoryId: string | null | undefined,
  weddingDate: string,
) {
  const [rows, setRows] = useState<AreaBlackout[]>([]);
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const day = dayKey(weddingDate);
  const blocked = dateHitsBlackout(day, rows);
  const verified = blocked && verifiedFor === day;

  useEffect(() => {
    let active = true;
    loadAreaBlackouts(territoryId).then((next) => {
      if (active) setRows(next);
    });
    return () => {
      active = false;
    };
  }, [territoryId]);

  useEffect(() => {
    if (!blocked) {
      setOpen(false);
      return;
    }
    if (verifiedFor === day || dismissedFor === day) return;
    setOpen(true);
  }, [blocked, day, verifiedFor, dismissedFor]);

  return {
    blocked,
    verified,
    sendLocked: blocked && !verified,
    open,
    day,
    confirm() {
      setVerifiedFor(day);
      setDismissedFor(null);
      setOpen(false);
    },
    dismiss() {
      setDismissedFor(day);
      setOpen(false);
    },
  };
}
