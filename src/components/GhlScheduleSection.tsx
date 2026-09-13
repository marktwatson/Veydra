import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, Clock, AlertCircle, ExternalLink } from "lucide-react";

interface ScheduleRow {
  date: string;
  amount: number;
  status: string;
  invoiceId?: string;
}

interface Props {
  weddingId: string;
}

/**
 * Shows the CRM (GHL) invoice payment schedule in the bride portal Financials
 * tab when one exists. Falls back silently (returns null) when there is no GHL
 * data, so the existing local payment schedule remains the source of truth.
 */
export function GhlScheduleSection({ weddingId }: Props) {
  const [schedule, setSchedule] = useState<ScheduleRow[] | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("weddings")
          .select("ghl_schedule, ghl_invoice_url")
          .eq("id", weddingId)
          .maybeSingle();
        if (!active) return;
        const rows = Array.isArray(data?.ghl_schedule)
          ? data.ghl_schedule
          : null;
        setSchedule(rows);
        setInvoiceUrl(data?.ghl_invoice_url || null);
      } catch {
        /* ignore */
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [weddingId]);

  if (!loaded || !schedule || schedule.length === 0) return null;

  const statusMeta = (s: string) => {
    const st = (s || "").toLowerCase();
    if (st === "paid" || st === "partially_paid")
      return { icon: CheckCircle, color: "text-emerald-500", label: "Paid" };
    if (st === "due" || st === "overdue" || st === "failed")
      return { icon: AlertCircle, color: "text-red-500", label: "Due" };
    return { icon: Clock, color: "text-[#1a1a1a]/60", label: "Upcoming" };
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#1a1a1a]">
          Invoice Payment Schedule
        </h3>
        {invoiceUrl && (
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open invoice
          </a>
        )}
      </div>
      <div className="border border-[#c9a96e]/20 rounded-xl divide-y divide-[#c9a96e]/20">
        {schedule.map((row, i) => {
          const meta = statusMeta(row.status);
          const Icon = meta.icon;
          const dateStr = row.date
            ? new Date(row.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—";
          return (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${meta.color}`} />
                <div>
                  <p className="font-medium text-[#1a1a1a]">{meta.label}</p>
                  <p className="text-sm text-[#1a1a1a]/60">{dateStr}</p>
                </div>
              </div>
              <span
                className={`font-semibold ${
                  meta.label === "Paid" ? "text-emerald-600" : "text-[#1a1a1a]"
                }`}
              >
                $
                {Number(row.amount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
