import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface SyncLogEntry {
  wedding_id: string;
  client_name: string;
  status: string;
  old_paid_amount: number;
  new_paid_amount: number | null;
  new_refunded_amount: number | null;
  updated: boolean;
  skipped_reason: string | null;
  error: string | null;
  charge_count?: number;
}

interface SyncSummary {
  weddings_updated: number;
  weddings_skipped: number;
  weddings_errored: number;
  stripe_key_missing: boolean;
  total_net_collected: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary?: SyncSummary;
  log?: SyncLogEntry[];
}

/**
 * Per-wedding diagnostic of the last Stripe paid-amount sync. Shows exactly
 * which weddings updated, which were skipped (and why), and which errored —
 * so silent sync failures can't hide behind a generic "Synced" toast.
 */
export function SyncReportDialog({ open, onOpenChange, summary, log }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Last Sync Report
          </DialogTitle>
          <DialogDescription>
            Per-wedding breakdown of what the Stripe sync did. This tells you
            exactly which weddings updated, which were skipped, and which
            errored — so silent failures can't hide.
          </DialogDescription>
        </DialogHeader>
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <div className="bg-muted/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">
                Updated
              </p>
              <p className="text-lg font-bold text-emerald-600">
                {summary.weddings_updated}
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">
                Skipped
              </p>
              <p className="text-lg font-bold text-muted-foreground">
                {summary.weddings_skipped}
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">
                Errored
              </p>
              <p className="text-lg font-bold text-red-600">
                {summary.weddings_errored}
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">
                Net Collected
              </p>
              <p className="text-lg font-bold">
                ${summary.total_net_collected?.toLocaleString()}
              </p>
            </div>
          </div>
        )}
        {summary?.stripe_key_missing && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300 mb-3">
            <strong>Stripe key missing.</strong> The STRIPE_SECRET_KEY env var
            is not set on the daily-reminders edge function. Add it in Supabase
            → Edge Functions → daily-reminders → Secrets, then redeploy. Without
            it, no paid amounts can be recomputed.
          </div>
        )}
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {(log || []).map((entry) => (
            <div
              key={entry.wedding_id}
              className="flex items-start justify-between gap-3 border border-border/40 rounded-xl p-2.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {entry.client_name}
                  </span>
                  <Badge
                    variant="outline"
                    className="rounded-full text-[10px] capitalize"
                  >
                    {entry.status}
                  </Badge>
                </div>
                {entry.updated ? (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    ${entry.old_paid_amount?.toFixed(2)} → $
                    {entry.new_paid_amount?.toFixed(2)} paid
                    {entry.new_refunded_amount && entry.new_refunded_amount > 0
                      ? ` · $${entry.new_refunded_amount.toFixed(2)} refunded`
                      : ""}
                    {entry.charge_count != null
                      ? ` · ${entry.charge_count} charges`
                      : ""}
                  </p>
                ) : entry.error ? (
                  <p className="text-xs text-red-600 mt-0.5">
                    Error: {entry.error}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Skipped: {entry.skipped_reason || "already up to date"}
                  </p>
                )}
              </div>
              {entry.updated ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full shrink-0">
                  Updated
                </Badge>
              ) : entry.error ? (
                <Badge className="bg-red-500/10 text-red-600 border-red-500/20 rounded-full shrink-0">
                  Error
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full shrink-0">
                  Skipped
                </Badge>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
