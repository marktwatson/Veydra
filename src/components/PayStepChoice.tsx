import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Wallet, ExternalLink } from "lucide-react";
import { OffPlatformPayInstead } from "@/components/OffPlatformPayInstead";
import {
  getOffPlatformConfig,
  availableMethods,
} from "@/lib/off-platform-payment";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

/**
 * Step-4 payment choice for the bride pay step (Book + ProposalReview).
 *
 * - Card/bank → calls onCreateInvoice (creates the GHL invoice), then shows
 *   the Open invoice link.
 * - Off-platform (only offered methods) → opens the blocking
 *   OffPlatformPayInstead modal. No GHL invoice is created on this path.
 *
 * Props:
 *   weddingId, remaining (full remaining balance), clientName, weddingDate
 *   onCreateInvoice: () => Promise<{ invoiceUrl: string; firstDue: number }>
 *   invoiceUrl: the current invoice URL (if already created)
 *   onInvoiceUrl: setter for the invoice URL
 */
export function PayStepChoice({
  weddingId,
  remaining,
  clientName,
  weddingDate,
  onCreateInvoice,
  invoiceUrl,
  onInvoiceUrl,
}: {
  weddingId: string;
  remaining: number;
  clientName: string;
  weddingDate?: string;
  onCreateInvoice: () => Promise<{ invoiceUrl: string; firstDue: number }>;
  invoiceUrl: string;
  onInvoiceUrl: (url: string) => void;
}) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [showOffPlatform, setShowOffPlatform] = useState(false);
  const [offPlatformDone, setOffPlatformDone] = useState(false);
  const [hasOffPlatform, setHasOffPlatform] = useState(false);

  useEffect(() => {
    getOffPlatformConfig()
      .then((c) => setHasOffPlatform(availableMethods(c).length > 0))
      .catch(() => setHasOffPlatform(false));
  }, []);

  const handleCardBank = async () => {
    setCreating(true);
    try {
      const result = await onCreateInvoice();
      if (result.invoiceUrl) {
        onInvoiceUrl(result.invoiceUrl);
        window.open(result.invoiceUrl, "_blank");
      } else {
        // Nothing due — already paid in full.
        toast({
          title: "Already paid in full",
          description: "No payment is due for this booking.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Could not create the invoice.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // If an invoice URL already exists (created via Card/bank), show the
  // "Almost done — Open invoice" screen.
  if (invoiceUrl) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-xl mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3">
            Almost done.
          </h2>
          <p className="text-stone-500 dark:text-stone-400 font-light text-lg">
            You're almost done — pay the invoice to confirm. This page will
            update when payment posts.
          </p>
        </div>
        <div className="bg-white dark:bg-stone-900/30 border border-stone-200 dark:border-stone-800 rounded-2xl p-8 space-y-6 shadow-sm">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            An invoice has been created. Open it to complete your payment
            securely.
          </p>
          <Button
            size="lg"
            className="w-full"
            onClick={() => window.open(invoiceUrl, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open invoice
          </Button>
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-stone-700 dark:text-stone-300 underline underline-offset-4 hover:opacity-80"
          >
            Open invoice
          </a>
        </div>
      </div>
    );
  }

  // Off-platform completed → thank-you screen.
  if (offPlatformDone) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3">
          You're almost done.
        </h2>
        <p className="text-stone-500 dark:text-stone-400 font-light text-lg max-w-md mx-auto">
          We received your note. Your booking stays pending until we confirm
          your payment. This page will update when payment posts.
        </p>
      </div>
    );
  }

  // Choice screen: Card/bank vs off-platform.
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-xl mx-auto">
      <div className="mb-10 text-center">
        <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3">
          Choose how to pay.
        </h2>
        <p className="text-stone-500 dark:text-stone-400 font-light text-lg">
          You're almost done — pick a payment method to confirm your booking.
        </p>
      </div>

      <div className="space-y-4">
        {/* Card / bank — primary */}
        <div className="bg-white dark:bg-stone-900/30 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold text-stone-900 dark:text-stone-50">
                Card / Bank
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Pay securely online with a card or bank account.
              </p>
            </div>
          </div>
          <Button
            size="lg"
            className="w-full"
            disabled={creating}
            onClick={handleCardBank}
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4 mr-2" />
            )}
            Pay with Card / Bank
          </Button>
        </div>

        {/* Off-platform — only if methods are offered */}
        {hasOffPlatform && (
          <div className="bg-white dark:bg-stone-900/30 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold text-stone-900 dark:text-stone-50">
                  Pay in full instead
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Venmo, Cash App, or Zelle — full remaining balance only.
                </p>
              </div>
            </div>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => setShowOffPlatform(true)}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Pay in full with Venmo / Cash App / Zelle
            </Button>
          </div>
        )}
      </div>

      <OffPlatformPayInstead
        weddingId={weddingId}
        remaining={remaining}
        clientName={clientName}
        weddingDate={weddingDate}
        open={showOffPlatform}
        onDone={() => {
          setShowOffPlatform(false);
          setOffPlatformDone(true);
        }}
      />
    </div>
  );
}
