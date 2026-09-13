import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Wallet,
  CheckCircle2,
  XCircle,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  confirmOffPlatformClaim,
  rejectOffPlatformClaim,
} from "@/lib/off-platform-payment";
import { formatDisplayDate } from "@/lib/utils";

const METHOD_LABELS: Record<string, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  zelle: "Zelle",
};

export interface ApproveOffPlatformWedding {
  id: string;
  client_name?: string;
  date?: string;
  offplatform_status?: string | null;
  offplatform_method?: string | null;
  offplatform_amount?: number | string | null;
  offplatform_claimed_at?: string | null;
}

/**
 * Blocking modal for staff to approve or reject an off-platform payment
 * (Venmo / Cash App / Zelle). Opens from Dashboard Action Items,
 * Proposals detail sheet, and Payment Audit.
 *
 * Designed with a clean luxury card layout, mobile-first responsive stacking,
 * clear action hierarchy, and distinct visual treatments for "claimed" vs "promised".
 */
export function ApproveOffPlatformPaymentDialog({
  wedding,
  open,
  onOpenChange,
  onResolved,
}: {
  wedding: ApproveOffPlatformWedding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);

  if (!wedding) return null;

  const status = wedding.offplatform_status;
  const methodKey = (wedding.offplatform_method || "").toLowerCase();
  const method =
    METHOD_LABELS[methodKey] || wedding.offplatform_method || "Off-platform";
  const amount = Number(wedding.offplatform_amount) || 0;
  const claimedAt = wedding.offplatform_claimed_at;
  const isClaimed = status === "claimed";
  const isPromised = status === "promised";

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["weddings"] });
    queryClient.invalidateQueries({ queryKey: ["proposals"] });
  };

  const handleConfirm = async () => {
    setBusy("confirm");
    try {
      const res = await confirmOffPlatformClaim(wedding.id);
      if (!res.success) throw new Error(res.error || "Confirm failed");
      toast({
        title: "Payment received — booking confirmed",
        description: `${wedding.client_name || "Client"} marked paid in full and activated.`,
      });
      refreshAll();
      onResolved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Confirm failed",
        description: e?.message || "Could not confirm.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    setBusy("reject");
    try {
      const res = await rejectOffPlatformClaim(wedding.id);
      if (!res.success) throw new Error(res.error || "Reject failed");
      toast({
        title: "Claim rejected",
        description: `Cleared off-platform claim for ${wedding.client_name || "client"}. paid_amount unchanged.`,
      });
      refreshAll();
      onResolved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Reject failed",
        description: e?.message || "Could not reject.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && busy) return;
        onOpenChange(o);
      }}
    >
      <DialogContent
        showCloseButton={busy === null}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
        className="w-[calc(100vw-2rem)] max-w-xl p-0 overflow-hidden border shadow-2xl rounded-2xl sm:rounded-3xl max-h-[85vh] flex flex-col"
      >
        {/* Header with status-aware accent banner */}
        <div className="relative px-5 py-3.5 sm:px-6 sm:py-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-start gap-3 sm:gap-4 pr-8">
            <div
              className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${
                isClaimed
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "bg-primary/10 border-primary/20 text-primary"
              }`}
            >
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Approve Off-Platform Payment
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                Verify the payment was received in your account before
                confirming the booking.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4">
          {/* Hero Couple Card */}
          <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                  Client & Event
                </p>
                <h3 className="text-base sm:text-lg font-bold text-foreground truncate mt-0.5">
                  {wedding.client_name || "Unknown Client"}
                </h3>
                {wedding.date && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                    <span>{formatDisplayDate(wedding.date)}</span>
                  </div>
                )}
              </div>

              {isClaimed ? (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 px-2.5 py-1 text-xs font-semibold shrink-0 gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Bride says paid
                </Badge>
              ) : isPromised ? (
                <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 px-2.5 py-1 text-xs font-semibold shrink-0 gap-1">
                  <Clock className="h-3 w-3" />
                  Pay later
                </Badge>
              ) : null}
            </div>

            {/* Amount Banner */}
            <div className="rounded-xl bg-muted/40 p-3 sm:p-4 flex items-center justify-between border">
              <div>
                <span className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Expected via {method}
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-0.5">
                  ${amount.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-background px-2.5 py-1 rounded-full border">
                  <span>{method}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-sm">
            <div className="rounded-xl border bg-card p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Payment Channel
              </span>
              <p className="font-semibold text-foreground mt-0.5 truncate">
                {method}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Current State
              </span>
              <p className="font-semibold text-foreground mt-0.5 truncate">
                {isClaimed
                  ? "Bride says paid"
                  : isPromised
                    ? "Pay later requested"
                    : status || "Pending"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-3 col-span-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                {isPromised ? "Promise Timestamp" : "Claim Timestamp"}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-foreground font-medium mt-0.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>
                  {claimedAt
                    ? new Date(claimedAt).toLocaleString()
                    : "Not recorded"}
                </span>
              </div>
            </div>
          </div>

          {/* Explanatory callout */}
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 sm:p-3.5 text-xs text-muted-foreground flex gap-2.5 items-start">
            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-medium text-foreground text-xs">
                Staff Verification Rule
              </p>
              <p>
                Confirming marks the wedding{" "}
                <strong className="text-foreground">paid in full</strong>, sets
                status to <strong className="text-foreground">upcoming</strong>,
                and records royalty. Rejecting simply clears this claim with
                zero changes to collected amounts.
              </p>
            </div>
          </div>
        </div>

        {/* Action Footer: Fully visible buttons, wrapping gracefully, never overflowing horizontally */}
        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-3.5 border-t bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!!busy}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-muted-foreground hover:text-foreground shrink-0"
          >
            Cancel
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
            <Button
              type="button"
              variant="outline"
              disabled={!!busy}
              onClick={handleReject}
              className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
            >
              {busy === "reject" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject Claim
            </Button>

            <Button
              type="button"
              disabled={!!busy}
              onClick={handleConfirm}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold truncate px-4"
            >
              {busy === "confirm" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2 shrink-0" />
              )}
              <span className="truncate">Confirm Payment Received</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
