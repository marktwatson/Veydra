import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Landmark, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

interface OwnerBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setupClientSecret: string | null;
  publishableKey: string | null;
  stripeInstance: any;
  onDone: () => void;
}

export function OwnerBankDialog({
  open,
  onOpenChange,
  setupClientSecret,
  publishableKey,
  stripeInstance,
  onDone,
}: OwnerBankDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Connect Bank Account
          </DialogTitle>
          <DialogDescription>
            Securely add a bank account (ACH preferred) or credit card for
            automatic weekly royalty collection. This uses Veydra's dedicated
            royalty account.
          </DialogDescription>
        </DialogHeader>
        {setupClientSecret && publishableKey && stripeInstance && (
          <Elements
            stripe={stripeInstance}
            options={{
              clientSecret: setupClientSecret,
              appearance: { theme: "stripe" },
            }}
          >
            <OwnerBankSetupForm onDone={onDone} />
          </Elements>
        )}
        {!publishableKey && setupClientSecret && (
          <div className="flex items-center justify-center py-8 text-amber-600 text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading royalty
            Stripe account...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Owner Bank Account Setup Form (inside Elements provider) ───
function OwnerBankSetupForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether the Payment Element has fully mounted and is ready for submissions
  const [elementsReady, setElementsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError("Stripe has not loaded yet. Please wait a moment.");
      return;
    }

    // Guard: don't submit until PaymentElement is mounted and ready
    if (!elementsReady) {
      setError("Payment form is still loading. Please wait...");
      return;
    }

    setSubmitting(true);

    try {
      // Use "if_required" so we stay in-page instead of redirecting the frame.
      // In the preview iframe, top-frame navigation is blocked, which would
      // throw "Failed to set a named property 'href' on 'Location'".
      const { setupIntent, error: confirmError } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.origin + "/owner/royalty?setup=complete",
        },
      });

      if (confirmError) {
        setError(confirmError.message || "Failed to connect bank account.");
        return;
      }

      // Success — attach the payment method to the territory customer so the
      // processor can charge it later. FATAL: if persisting fails, the UI would
      // keep showing "No payment method" even though Stripe confirmed.
      if (setupIntent?.payment_method) {
        try {
          await api.connectTerritoryStripe(setupIntent.payment_method);
        } catch (attachErr: any) {
          setError(
            attachErr?.message ||
              "Bank authorized, but we couldn't save it to your territory. Please redeploy the royalty-processor edge function and try again.",
          );
          return;
        }
      }
      onDone();
    } catch (err: any) {
      setError(
        err?.message || "An unexpected error occurred. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: { type: "accordion", defaultCollapsed: false },
          paymentMethodOrder: ["us_bank_account", "card"],
        }}
        onReady={() => setElementsReady(true)}
        onChange={(e: any) => {
          if (e.error) {
            setError(e.error.message);
          } else {
            setError(null);
          }
        }}
      />
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || !elementsReady || submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...
          </>
        ) : !elementsReady ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading secure
            form...
          </>
        ) : (
          <>
            <Landmark className="mr-2 h-4 w-4" /> Connect Bank Account
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Your bank details are encrypted by Stripe and never stored on our
        servers.
      </p>
    </form>
  );
}
