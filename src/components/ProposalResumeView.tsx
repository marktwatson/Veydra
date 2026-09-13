import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  ExternalLink,
  Wallet,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { OffPlatformBadge } from "@/components/OffPlatformBadge";
import { PayStepChoice } from "@/components/PayStepChoice";
import { createGhlInvoice } from "@/lib/ghl-invoice-api";
import { rejectOffPlatformClaim } from "@/lib/off-platform-payment";
import { useToast } from "@/hooks/use-toast";
import type { ProposalResume } from "@/lib/use-proposal-resume";

const METHOD_LABELS: Record<string, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  zelle: "Zelle",
};

/**
 * Renders the correct resume view for a proposal that has already progressed
 * past the fresh state. Replaces the 4-step wizard when the bride returns.
 *
 * Resume table:
 * - confirmed:  thank-you only. No pay buttons.
 * - offplatform: method, amount, state. No sign pad, no GHL invoice.
 * - invoice:     Open invoice only. No sign, no new invoice.
 * - signed:      Pay step only (PayStepChoice).
 */
export function ProposalResumeView({
  resume,
  proposal,
  remaining,
  clientName,
  weddingDate,
  isUpgrade,
}: {
  resume: ProposalResume;
  proposal: any;
  remaining: number;
  clientName: string;
  weddingDate?: string;
  isUpgrade?: boolean;
}) {
  const { toast } = useToast();
  const [invoiceUrl, setInvoiceUrl] = useState<string>(resume.invoiceUrl || "");
  const [creating, setCreating] = useState(false);
  const [changing, setChanging] = useState(false);

  // ---- confirmed: thank-you only ----
  if (resume.state === "confirmed") {
    return (
      <div className="p-8 md:p-12 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-3xl font-serif text-foreground">You're all set!</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your booking is confirmed. We'll be in touch with next steps for your
          wedding{weddingDate ? ` on ${weddingDate}` : ""}.
        </p>
        {resume.invoiceUrl && (
          <Button
            variant="outline"
            onClick={() => window.open(resume.invoiceUrl!, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" /> View invoice
          </Button>
        )}
      </div>
    );
  }

  // ---- offplatform: show method / amount / state ----
  if (resume.state === "offplatform") {
    const methodLabel =
      METHOD_LABELS[resume.offplatformMethod || ""] ||
      resume.offplatformMethod ||
      "Off-platform";
    const canChange = resume.offplatformStatus !== "confirmed";

    return (
      <div className="p-8 md:p-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-serif text-foreground">
            Payment in progress
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            We're waiting for your {methodLabel} payment to post. Your booking
            stays pending until we confirm it.
          </p>
        </div>

        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Status</span>
              <OffPlatformBadge
                status={resume.offplatformStatus}
                method={resume.offplatformMethod}
                amount={resume.offplatformAmount}
                claimedAt={resume.offplatformClaimedAt}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium">{methodLabel}</span>
            </div>
            {resume.offplatformAmount != null &&
              resume.offplatformAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-primary">
                    ${resume.offplatformAmount.toLocaleString()}
                  </span>
                </div>
              )}
            {resume.offplatformClaimedAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {resume.offplatformStatus === "promised"
                    ? "Promised"
                    : "Claimed"}
                </span>
                <span className="text-muted-foreground">
                  {new Date(resume.offplatformClaimedAt).toLocaleString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {canChange && (
          <ChangePaymentMethodButton
            changing={changing}
            disabled={creating}
            onChange={async () => {
              setChanging(true);
              try {
                if (resume.weddingId) {
                  await rejectOffPlatformClaim(resume.weddingId);
                }
                toast({
                  title: "Payment choice cleared",
                  description: "You can choose a different payment method now.",
                });
                // Reload so the resume hook re-evaluates from the DB.
                setTimeout(() => window.location.reload(), 600);
              } catch (e: any) {
                toast({
                  title: "Error",
                  description: e.message || "Could not change method.",
                  variant: "destructive",
                });
              } finally {
                setChanging(false);
              }
            }}
          />
        )}
      </div>
    );
  }

  // ---- invoice: Open invoice only ----
  if (resume.state === "invoice") {
    const url = invoiceUrl || resume.invoiceUrl || "";
    return (
      <div className="p-8 md:p-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <ExternalLink className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-serif text-foreground">
            Your invoice is ready
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            You're almost done — pay the invoice to confirm. This page will
            update when payment posts.
          </p>
        </div>

        {url ? (
          <div className="max-w-md mx-auto space-y-4">
            <Button
              size="lg"
              className="w-full"
              onClick={() => window.open(url, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" /> Open invoice
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm text-muted-foreground underline underline-offset-4 hover:opacity-80"
            >
              Open invoice
            </a>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground max-w-md mx-auto">
            Your invoice link isn't ready yet — check your email or contact us.
          </p>
        )}

        <ChangePaymentMethodButton
          changing={changing}
          disabled={creating}
          onChange={async () => {
            setChanging(true);
            try {
              if (resume.weddingId) {
                await rejectOffPlatformClaim(resume.weddingId);
              }
              toast({
                title: "Payment choice cleared",
                description: "You can choose a different payment method now.",
              });
              // Reload so the resume hook re-evaluates from the DB.
              setTimeout(() => window.location.reload(), 600);
            } catch (e: any) {
              toast({
                title: "Error",
                description: e.message || "Could not change method.",
                variant: "destructive",
              });
            } finally {
              setChanging(false);
            }
          }}
        />
      </div>
    );
  }

  // ---- signed: Pay step only ----
  // state === "signed"
  const weddingId = resume.weddingId || proposal.wedding_id || "";
  const label = isUpgrade
    ? `Wedding Package Upgrade for ${clientName}`
    : `Wedding Payment for ${clientName}`;
  const firstDue = Math.max(0, remaining);

  return (
    <div className="p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8 text-center space-y-2">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-serif text-foreground">Contract signed</h2>
        <p className="text-muted-foreground">
          Choose how to pay to finish your booking.
        </p>
      </div>

      {firstDue <= 0 ? (
        <div className="max-w-md mx-auto text-center space-y-4">
          <p className="text-muted-foreground">
            Nothing is due right now — your balance is paid.
          </p>
        </div>
      ) : (
        <PayStepChoice
          weddingId={weddingId}
          remaining={remaining}
          clientName={clientName}
          weddingDate={weddingDate}
          invoiceUrl={invoiceUrl}
          onInvoiceUrl={setInvoiceUrl}
          onCreateInvoice={async () => {
            if (firstDue <= 0) return { invoiceUrl: "", firstDue: 0 };
            setCreating(true);
            try {
              const invoice = await createGhlInvoice({
                weddingId,
                amount: firstDue,
                label,
                kind: isUpgrade ? "addon" : undefined,
                forceNew: isUpgrade ? true : undefined,
              });
              return {
                invoiceUrl: invoice.invoiceUrl,
                firstDue,
              };
            } finally {
              setCreating(false);
            }
          }}
        />
      )}
    </div>
  );
}

function ChangePaymentMethodButton({
  changing,
  disabled,
  onChange,
}: {
  changing: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="text-center">
      <Button
        variant="ghost"
        size="sm"
        disabled={changing || disabled}
        onClick={() => {
          if (
            window.confirm(
              "This cancels the previous payment choice. Continue?",
            )
          ) {
            onChange();
          }
        }}
        className="text-muted-foreground"
      >
        {changing ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4 mr-2" />
        )}
        Change payment method
      </Button>
    </div>
  );
}
