import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Plus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Landmark,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { api } from "@/lib/api";
import { createRoyaltyCardSetupIntent } from "@/lib/royalty-card-setup";

/**
 * Backup card manager for royalty territory.
 * Shows the connected bank (primary) and an optional backup card.
 * A backup card can only be added after a bank (ACH) is connected as primary.
 * If the card is used for a weekly charge, a 3% fee applies on the charged amount.
 */
export function RoyaltyBackupCard({
  territory,
  onSaved,
}: {
  territory: any;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(
    null,
  );
  const [royaltyStripe, setRoyaltyStripe] = useState<any>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasBank = !!(
    territory.primary_payment_method_id || territory.stripe_payment_method_id
  );
  const hasBackupCard = !!territory.backup_payment_method_id;

  const handleAddCard = async () => {
    if (!hasBank) {
      toast({
        variant: "destructive",
        title: "Bank Required",
        description:
          "Connect a bank account (ACH) first — a backup card can only be added after your primary bank is on file.",
      });
      return;
    }
    setLoading(true);
    try {
      const data: any = await createRoyaltyCardSetupIntent();
      if (!data.client_secret) {
        throw new Error("No client secret returned.");
      }
      setSetupClientSecret(data.client_secret);
      let pk = data.publishable_key;
      if (!pk) {
        try {
          const r = await api.getRoyaltyPublishableKey();
          pk = r.publishable_key;
        } catch {}
      }
      if (!pk) throw new Error("No royalty Stripe publishable key configured.");
      setPublishableKey(pk);
      const instance = await loadStripe(pk);
      setRoyaltyStripe(instance);
      setCardDialogOpen(true);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Card Setup Failed",
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card max-w-2xl mt-6">
        <CardHeader className="p-5 pb-3 border-b border-border/40">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Backup Payment Method
          </CardTitle>
          <CardDescription className="text-xs">
            A bank account (ACH) is the primary method for weekly collection. A
            backup card is optional — if it's used, a 3% fee applies on the
            charged amount (not on gross sales).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Primary bank status */}
          <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">Primary (Bank / ACH)</p>
                <p className="text-xs text-muted-foreground">
                  {hasBank
                    ? "Connected — used first for weekly charges"
                    : "Not connected"}
                </p>
              </div>
            </div>
            {hasBank ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
                <CheckCircle className="h-3 w-3 mr-1" /> Active
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full">
                <AlertCircle className="h-3 w-3 mr-1" /> Required
              </Badge>
            )}
          </div>

          {/* Backup card status */}
          <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Backup Card</p>
                <p className="text-xs text-muted-foreground">
                  {hasBackupCard
                    ? "On file — 3% fee if this card is used"
                    : hasBank
                      ? "Optional — used only if the bank charge fails"
                      : "Add a bank first, then a backup card"}
                </p>
                {hasBackupCard && (
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {territory.backup_payment_method_id.substring(0, 14)}…
                  </p>
                )}
              </div>
            </div>
            {hasBackupCard ? (
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 rounded-full">
                <CheckCircle className="h-3 w-3 mr-1" /> On File
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={handleAddCard}
                disabled={!hasBank || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add backup card
              </Button>
            )}
          </div>

          {!hasBank && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Connect a bank account (ACH) above first. A backup card can only
                be added after your primary bank is on file.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={cardDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCardDialogOpen(false);
            setSetupClientSecret(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Add Backup Card
            </DialogTitle>
            <DialogDescription>
              This card is only used if the primary bank (ACH) charge fails. A
              3% fee applies on the charged amount when this card is used.
            </DialogDescription>
          </DialogHeader>
          {setupClientSecret && publishableKey && royaltyStripe ? (
            <Elements
              stripe={royaltyStripe}
              options={{
                clientSecret: setupClientSecret,
                appearance: { theme: "stripe" },
              }}
            >
              <BackupCardForm
                onDone={() => {
                  setCardDialogOpen(false);
                  setSetupClientSecret(null);
                  onSaved();
                }}
              />
            </Elements>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure card
              form...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BackupCardForm({ onDone }: { onDone: () => void }) {
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
          return_url: window.location.origin + "/manager/royalty?card=complete",
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
          "Your backup card is on file. A 3% fee applies if this card is used for a weekly charge.",
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
