import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertCircle, Loader2, Landmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { api } from "@/lib/api";

/**
 * Connect Bank Account dialog (ACH only) for the manager Royalty page.
 * Extracted from Royalty.tsx to keep the page file manageable.
 */
export function RoyaltyBankDialog({
  open,
  onOpenChange,
  setupClientSecret,
  royaltyPublishableKey,
  royaltyStripe,
  stripeLoadError,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setupClientSecret: string | null;
  royaltyPublishableKey: string | null;
  royaltyStripe: any;
  stripeLoadError: string | null;
  onDone: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-[480px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Connect Bank Account
          </DialogTitle>
          <DialogDescription>
            Securely add a bank account (ACH) for automatic weekly royalty
            collection. A backup card can be added separately after your bank is
            connected.
          </DialogDescription>
        </DialogHeader>
        {stripeLoadError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="text-sm font-medium text-red-600">
              Stripe Failed to Load
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {stripeLoadError}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : setupClientSecret && royaltyPublishableKey && royaltyStripe ? (
          <Elements
            stripe={royaltyStripe}
            options={{
              clientSecret: setupClientSecret,
              appearance: { theme: "stripe" },
            }}
          >
            <BankSetupForm
              clientSecret={setupClientSecret}
              publishableKey={royaltyPublishableKey}
              onDone={onDone}
              onError={() => {}}
            />
          </Elements>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              Initializing secure payment form...
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-xs">
              Connecting to Stripe. This should only take a moment.
            </p>
          </div>
        )}
        {!royaltyPublishableKey && setupClientSecret && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <div className="flex items-center text-amber-600 text-sm">
              <AlertCircle className="h-4 w-4 mr-2" /> Royalty Stripe account
              not configured
            </div>
            <p className="text-xs text-muted-foreground max-w-xs">
              A Super Admin must add the royalty Stripe publishable key (pk_...)
              and secret key (sk_...) in the Royalty Stripe Account card before
              a bank account can be connected.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        )}
        {!setupClientSecret && (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure
            connection...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BankSetupForm({
  onDone,
  onError,
  clientSecret,
  publishableKey,
}: {
  onDone: () => void;
  onError?: (msg: string) => void;
  clientSecret: string;
  publishableKey: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elementsReady, setElementsReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!elementsReady) {
        const msg =
          "Stripe could not load the payment form. This usually means the publishable key and secret key are from different Stripe accounts.";
        setError(msg);
        onError?.(msg);
      }
    }, 12000);
    return () => clearTimeout(t);
  }, [elementsReady, clientSecret, publishableKey, onError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!stripe || !elements) {
      setError("Stripe has not loaded yet. Please wait a moment.");
      return;
    }
    if (!elementsReady) {
      setError("Payment form is still loading. Please wait...");
      return;
    }
    setSubmitting(true);
    try {
      const { setupIntent, error: confirmError } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url:
            window.location.origin + "/manager/royalty?setup=complete",
        },
      });
      if (confirmError) {
        setError(confirmError.message || "Failed to connect bank account.");
        return;
      }
      if (setupIntent?.payment_method) {
        try {
          await api.connectTerritoryStripe(setupIntent.payment_method);
        } catch (attachErr: any) {
          setError(
            attachErr?.message ||
              "Bank authorized, but we couldn't save it to your territory.",
          );
          return;
        }
      }
      onDone();
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: { type: "accordion", defaultCollapsed: false },
          paymentMethodOrder: ["us_bank_account"],
        }}
        onReady={() => setElementsReady(true)}
        onChange={(e: any) => {
          if (e.error) setError(e.error.message);
          else setError(null);
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
