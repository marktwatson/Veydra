import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  AlertCircle,
  ShieldCheck,
  DollarSign,
  Undo2,
} from "lucide-react";
import {
  markPaidInFull,
  undoPaidInFull,
  buildPaidInFullMethods,
  type PaidInFullMethod,
} from "@/lib/paid-in-full";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export interface PaidInFullWedding {
  id: string;
  client_name?: string;
  total_amount?: number | string;
  paid_amount?: number | string;
  status?: string;
}

interface Props {
  wedding: PaidInFullWedding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function money(n: number) {
  return `$${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  })}`;
}

export function PaidInFullDialog({ wedding, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PaidInFullMethod>("card");
  const [methods, setMethods] = useState<
    { value: PaidInFullMethod; label: string }[]
  >([]);
  const [confirmCollected, setConfirmCollected] = useState(false);
  const [activate, setActivate] = useState(false);
  const [pending, setPending] = useState(false);
  const [isPif, setIsPif] = useState(false);

  const isCardMethod = method === "card";
  const checkboxRequired = !isCardMethod;

  const total = Number(wedding?.total_amount) || 0;
  const paid = Number(wedding?.paid_amount) || 0;
  const remaining = Math.max(0, total - paid);
  const alreadyPaidInFull = remaining <= 0.01;

  useEffect(() => {
    if (wedding?.id && open) {
      setMethod("card");
      setConfirmCollected(false);
      setActivate(false);
      setPending(false);
      buildPaidInFullMethods().then((m) => {
        setMethods(m);
        if (!m.find((x) => x.value === method)) setMethod("card");
      });
      // Check if a manual PIF record exists for the undo path.
      import("@/lib/paid-in-full").then((m) =>
        m.isPaidInFullManual(wedding.id).then(setIsPif),
      );
    }
  }, [wedding?.id, open]);

  const handleConfirm = async () => {
    if (!wedding) return;
    setPending(true);
    try {
      const result = await markPaidInFull({
        weddingId: wedding.id,
        method,
        activate,
      });
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Cannot mark paid in full",
          description: result.error || "Something went wrong.",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["weddings"] });
        toast({
          title: "Marked Paid in Full",
          description: `${money(remaining)} recorded via ${method}. paid_amount now ${money(result.newPaidAmount)}.${result.activated ? " Wedding activated." : ""}`,
        });
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: e?.message || "Could not update wedding.",
      });
    } finally {
      setPending(false);
    }
  };

  const handleUndo = async () => {
    if (!wedding) return;
    setPending(true);
    try {
      const result = await undoPaidInFull(wedding.id);
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Cannot undo",
          description: result.error || "Something went wrong.",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["weddings"] });
        toast({
          title: "Undid Paid in Full",
          description: `Reversed ${money(result.remaining)}. paid_amount now ${money(result.newPaidAmount)}. Status unchanged.`,
        });
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: e?.message || "Could not undo.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <DollarSign className="h-5 w-5 text-emerald-600" /> Paid in Full
            (Off-Platform)
          </DialogTitle>
          <DialogDescription>
            Record an outside collection for{" "}
            <strong>{wedding?.client_name || "this wedding"}</strong> — Venmo,
            Cash App, Zelle, cash, or other. No Stripe or invoice is created.
          </DialogDescription>
        </DialogHeader>

        {wedding && (
          <div className="py-4 space-y-4">
            <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold">{money(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already paid:</span>
                <span className="font-semibold text-emerald-600">
                  {money(paid)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/40 pt-2 mt-2">
                <span className="font-bold text-foreground">
                  Remaining to record:
                </span>
                <span className="font-extrabold text-emerald-600 text-base">
                  {money(remaining)}
                </span>
              </div>
            </div>

            {alreadyPaidInFull ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  This wedding is already paid in full. You can undo a prior
                  manual paid-in-full below if needed.
                </span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Collection method</Label>
                  <Select
                    value={method}
                    onValueChange={(v) => setMethod(v as PaidInFullMethod)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {methods.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {checkboxRequired && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={confirmCollected}
                      onCheckedChange={(c) => setConfirmCollected(!!c)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-muted-foreground">
                      I collected this outside Card/GHL and turned off GHL
                      auto-pay / voided the open invoice.
                    </span>
                  </label>
                )}

                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={activate}
                    onCheckedChange={(c) => setActivate(!!c)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground">
                    Activate wedding (set status upcoming)
                  </span>
                </label>
              </>
            )}

            {isPif && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  A manual paid-in-full record exists for this wedding. Undoing
                  reverses the paid amount — it does not refund the client.
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          {isPif ? (
            <Button
              className="rounded-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleUndo}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Undo2 className="h-4 w-4 mr-2" />
              )}
              Undo paid in full
            </Button>
          ) : (
            <Button
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirm}
              disabled={
                pending ||
                alreadyPaidInFull ||
                (checkboxRequired && !confirmCollected)
              }
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <DollarSign className="h-4 w-4 mr-2" />
              )}
              Confirm Paid in Full
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
