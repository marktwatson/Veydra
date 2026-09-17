import { useEffect, useState } from "react";
import { Loader2, Wallet, CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getOffPlatformConfig,
  availableMethods,
  claimOffPlatformPayment,
  promiseOffPlatformPayment,
  type OffPlatformMethod,
  type OffPlatformConfig,
} from "@/lib/off-platform-payment";
import { useToast } from "@/hooks/use-toast";

const METHOD_META: Record<
  OffPlatformMethod,
  { label: string; handleKey: keyof OffPlatformConfig }
> = {
  venmo: { label: "Venmo", handleKey: "venmo" },
  cashapp: { label: "Cash App", handleKey: "cashapp" },
  zelle: { label: "Zelle", handleKey: "zelle" },
};

/**
 * Blocking off-platform payment modal shown on the bride pay step.
 *
 * - No overlay-click dismiss, no X close. The bride MUST pick one of the two
 *   buttons (or use Card/bank which is handled by the parent).
 * - "I made a payment" → claimOffPlatformPayment (status "claimed")
 * - "I'll pay later"   → promiseOffPlatformPayment (status "promised")
 *
 * Both leave paid_amount and wedding status alone. No GHL invoice is created.
 */
export function OffPlatformPayInstead({
  weddingId,
  remaining,
  clientName,
  weddingDate,
  open,
  onDone,
}: {
  weddingId: string;
  remaining: number;
  clientName: string;
  weddingDate?: string;
  open: boolean;
  onDone: (status: "claimed" | "promised") => void;
}) {
  const { toast } = useToast();
  const [config, setConfig] = useState<OffPlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMethod, setSelectedMethod] =
    useState<OffPlatformMethod | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedMethod(null);
    getOffPlatformConfig()
      .then((c) => {
        setConfig(c);
        const methods = availableMethods(c);
        if (methods.length > 0) setSelectedMethod(methods[0]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const methods = config ? availableMethods(config) : [];
  const amount = Math.max(0, remaining);

  const handleSubmit = async (status: "claimed" | "promised") => {
    if (!selectedMethod || amount <= 0.01) return;
    setSubmitting(true);
    try {
      const fn =
        status === "claimed"
          ? claimOffPlatformPayment
          : promiseOffPlatformPayment;
      const res = await fn({
        weddingId,
        method: selectedMethod,
        amount,
      });
      if (res.success) {
        toast({
          title:
            status === "claimed"
              ? "Thanks! We'll confirm your payment."
              : "Got it — we'll watch for your payment.",
          description:
            status === "claimed"
              ? `We'll confirm your ${METHOD_META[selectedMethod].label} payment and activate your booking shortly.`
              : `Send your ${METHOD_META[selectedMethod].label} payment when you're ready. We'll activate your booking once it posts.`,
        });
        onDone(status);
      } else {
        toast({
          title: "Could not record",
          description: res.error || "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-[480px] rounded-2xl border-border/50"
        // Block all dismiss paths — no overlay click, no Escape, no X button.
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Wallet className="h-5 w-5 text-primary" />
            Pay in full with{" "}
            {selectedMethod ? METHOD_META[selectedMethod].label : "..."}
          </DialogTitle>
          <DialogDescription>
            Send the full remaining balance via your preferred method. Include
            your wedding date{weddingDate ? ` (${weddingDate})` : ""} and name (
            {clientName}) in the note.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : methods.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No off-platform methods are available right now. Use Card/bank
            instead.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            {/* Method selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Choose a method
              </Label>
              {methods.map((method) => {
                const meta = METHOD_META[method];
                const handle = config?.[meta.handleKey]?.handle || "";
                const selected = selectedMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedMethod(method)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-border bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {meta.label}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {handle}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Amount */}
            <div className="bg-muted/40 p-4 rounded-lg border border-border/50 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount to send</span>
                <span className="font-bold text-foreground">
                  $
                  {amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              {selectedMethod && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Send to</span>
                  <span className="font-mono text-foreground">
                    {config?.[METHOD_META[selectedMethod].handleKey]?.handle}
                  </span>
                </div>
              )}
            </div>

            {/* Two required buttons */}
            <div className="space-y-2 pt-1">
              <Button
                className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={submitting || !selectedMethod}
                onClick={() => handleSubmit("claimed")}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                I made a payment
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full"
                disabled={submitting || !selectedMethod}
                onClick={() => handleSubmit("promised")}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4 mr-2" />
                )}
                I'll pay later
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Your booking stays pending until we confirm your payment. No card
              is charged.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
