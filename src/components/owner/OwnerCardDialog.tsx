import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { api } from "@/lib/api";

/**
 * Backup card dialog for the owner Royalty dashboard.
 * Card-only SetupIntent. Saves to territories.backup_payment_method_id.
 * Only available after a bank (ACH) is connected as primary.
 */
export function OwnerCardDialog({
  open,
  onOpenChange,
  setupClientSecret,
  stripeInstance,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setupClientSecret: string | null;
  stripeInstance: any;
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
            <CreditCard className="h-5 w-5" /> Add Backup Card
          </DialogTitle>
          <DialogDescription>
            This card is only used if the primary bank (ACH) charge fails. A 3%
            fee applies on the charged amount when this card is used.
          </DialogDescription>
        </DialogHeader>
        {setupClientSecret && stripeInstance ? (
          <Elements
            stripe={stripeInstance}
            options={{
              clientSecret: setupClientSecret,
              appearance: { theme: "stripe" },
            }}
          >
            <OwnerCardForm onDone={onDone} />
          </Elements>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure card
            form...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OwnerCardForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elementsReady, setElementsReady] = useState(false);

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
          return_url: window.location.origin + "/owner/royalty?card=complete",
        },
      });
      if (confirmError) {
        setError(confirmError.message || "Failed to add card.");
        return;
      }
      if (setupIntent?.payment_method) {
        try {
          await api.connectTerritoryStripe(setupIntent.payment_method);
        } catch (attachErr: any) {
          setError(
            attachErr?.message ||
              "Card authorized, but it couldn't be saved to your territory.",
          );
          return;
        }
      }
      toast({
        title: "Backup Card Added",
        description:
          "Your backup card is on file. A 3% fee applies if this card is used.",
      });
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
          paymentMethodOrder: ["card"],
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
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
          </>
        ) : !elementsReady ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading form...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" /> Add Backup Card
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Your card details are encrypted by Stripe and never stored on our
        servers.
      </p>
    </form>
  );
}
