import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Wine,
  Tag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { processBartendingUpsell } from "@/lib/bartending-upsell";
import { InstallmentEditor, type Installment } from "./InstallmentEditor";
import {
  UpsellSelectStep,
  UpsellPlanStep,
  UpsellReviewStep,
} from "./BartendingUpsellSteps";
import type { BartendingAddon } from "./BartendingUpsellSteps";

function fmtMoney(n: number) {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

const HH_DISCOUNT = 800;

export function BartendingUpsellDialog({
  wedding,
  open,
  onOpenChange,
  settings,
  onEmailPreview,
}: {
  wedding: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: any;
  onEmailPreview: (
    email: string,
    subject: string,
    html: string,
    name: string,
    sendFn: () => Promise<void>,
  ) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<
    "select" | "plan" | "review" | "processing" | "success"
  >("select");
  const [addons, setAddons] = useState<BartendingAddon[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(true);
  const [selectedAddon, setSelectedAddon] = useState<BartendingAddon | null>(
    null,
  );
  const [applyDiscount, setApplyDiscount] = useState(true);
  const [deposit, setDeposit] = useState(0);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [staffNote, setStaffNote] = useState("");
  const [error, setError] = useState("");

  const stripeCustomerId = wedding?.stripe_customer_id || null;
  const hasCardOnFile = !!stripeCustomerId;
  const cardLast4 = wedding?.stripe_card_last4 || "";
  const clientEmail =
    wedding?.client_email ||
    wedding?.questionnaire_data?.contact_info?.email ||
    wedding?.questionnaire_data?.email ||
    "";

  useEffect(() => {
    if (open) {
      setApplyDiscount(true);
      setStep("select");
      setError("");
      setDeposit(0);
      setInstallments([]);
      setStaffNote("");
      setSelectedAddon(null);
      setLoadingAddons(true);
      api
        .getAddons()
        .then((all) =>
          setAddons(all.filter((a: any) => a.isBartending && !a.isArchived)),
        )
        .catch(() => setAddons([]))
        .finally(() => setLoadingAddons(false));
    }
  }, [open]);

  const listPrice = selectedAddon?.price || 0;
  const discount = applyDiscount ? Math.min(HH_DISCOUNT, listPrice) : 0;
  const totalDue = Math.max(0, listPrice - discount);
  const remainingAfterDeposit = Math.max(0, totalDue - deposit);
  const installmentSum = useMemo(
    () => installments.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [installments],
  );
  const planBalanced =
    Math.abs(installmentSum - remainingAfterDeposit) <= 0.01 &&
    (deposit > 0 || installments.length > 0);
  const allDatesValid = installments.every(
    (i) => i.date && i.date >= todayStr() && i.amount > 0,
  );

  const goToPlan = () => {
    if (!selectedAddon) return;
    setStep("plan");
    setDeposit(0);
    setInstallments([
      { date: "", amount: remainingAfterDeposit, label: "Final Payment" },
    ]);
  };

  const goToReview = () => {
    if (deposit > 0 && !hasCardOnFile) {
      setError(
        "This bride doesn't have a card on file. Set deposit to $0 or add a payment method first.",
      );
      return;
    }
    if (deposit < 0) {
      setError("Deposit cannot be negative.");
      return;
    }
    if (deposit < totalDue && !planBalanced) {
      setError(
        `Installments (${fmtMoney(installmentSum)}) must equal the remaining balance (${fmtMoney(remainingAfterDeposit)}).`,
      );
      return;
    }
    if (deposit < totalDue && !allDatesValid) {
      setError(
        "Every installment needs a valid date (today or later) and amount.",
      );
      return;
    }
    setError("");
    setStep("review");
  };

  const handleSignAndPay = async () => {
    setError("");
    setStep("processing");
    try {
      const upsellResult = await processBartendingUpsell(api, {
        wedding,
        addon: selectedAddon,
        discount,
        totalDue,
        deposit,
        installments,
        settings,
      });

      if (clientEmail) {
        const companyName = settings?.company_name || "Honeysuckle Haus";
        const appUrl = (settings?.app_url || window.location.origin).replace(
          /\/$/,
          "",
        );
        const portalLink = upsellResult?.purchaseId
          ? `${appUrl}/bartending-contract/${upsellResult.purchaseId}`
          : `${appUrl}/bride-portal/${wedding.id}`;
        const subject = `Your Bartending Services Agreement — ${companyName}`;
        const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
          <h2>Bartending Services Agreement (placeholder)</h2>
          <p>Hi ${wedding?.client_name?.split(" ")[0] || "there"},</p>
          <p>We've added <strong>${selectedAddon?.name}</strong> to your wedding package!</p>
          <ul><li>Package: ${selectedAddon?.name}</li><li>Total: ${fmtMoney(totalDue)}</li>
          ${discount > 0 ? `<li>HH bride discount: -${fmtMoney(discount)}</li>` : ""}
          <li>Deposit ${deposit > 0 ? `charged: ${fmtMoney(deposit)}` : ": $0 (no charge)"}</li></ul>
          <p>Review and sign here: <a href="${portalLink}">${portalLink}</a></p>
          <p>We're excited to serve you on your big day!</p><p>— ${companyName}</p></body></html>`;
        onEmailPreview(
          clientEmail,
          subject,
          html,
          wedding?.client_name,
          async () => {
            await api.sendOvantaEmail(
              clientEmail,
              subject,
              html,
              wedding?.client_name,
              true,
            );
          },
        );
      }

      // Logging must never turn an already-saved add-on into an error state.
      api
        .logAdminActivity(
          "Bartending Upsell Added",
          `Added ${selectedAddon?.name} (${fmtMoney(totalDue)}) to ${wedding?.client_name}. Deposit: ${fmtMoney(deposit)}.`,
        )
        .catch((logErr: any) =>
          console.warn("[BartendingUpsell] activity log failed:", logErr),
        );

      toast({
        title:
          deposit > 0
            ? "Bartending package added & deposit collected"
            : "Bartending package added",
        description:
          deposit > 0
            ? `${fmtMoney(deposit)} charged to card on file. Contract sent to ${clientEmail}.`
            : `No charge. Contract sent to ${clientEmail}.`,
      });
      setStep("success");
    } catch (e: any) {
      console.error("[BartendingUpsell] Sign & Pay failed:", e);
      setStep("review");
      const rawMsg = e?.message || "Something went wrong. Please try again.";
      const friendlyMsg =
        deposit > 0
          ? "Payment was not successful. Please talk to your manager."
          : rawMsg;
      setError(friendlyMsg);
      toast({
        variant: "destructive",
        title: "Could not complete",
        description: `${friendlyMsg} The add-on has not been attached.`,
      });
    }
  };

  const reset = () => {
    setStep("select");
    setSelectedAddon(null);
    setDeposit(0);
    setInstallments([]);
    setStaffNote("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5 text-primary" />
            Add Bartending Package
          </DialogTitle>
          <DialogDescription>
            Add a bartending add-on to {wedding?.client_name}'s wedding. Charges
            the card on file for deposits. Does not affect the photography plan.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "select" && (
          <UpsellSelectStep
            addons={addons}
            loading={loadingAddons}
            selectedAddon={selectedAddon}
            onSelect={setSelectedAddon}
            onContinue={goToPlan}
          />
        )}

        {step === "plan" && selectedAddon && (
          <UpsellPlanStep
            selectedAddon={selectedAddon}
            listPrice={listPrice}
            discount={discount}
            totalDue={totalDue}
            deposit={deposit}
            setDeposit={setDeposit}
            remainingAfterDeposit={remainingAfterDeposit}
            installments={installments}
            setInstallments={setInstallments}
            applyDiscount={applyDiscount}
            setApplyDiscount={setApplyDiscount}
            hasCardOnFile={hasCardOnFile}
            cardLast4={cardLast4}
            staffNote={staffNote}
            setStaffNote={setStaffNote}
            onBack={() => setStep("select")}
            onContinue={goToReview}
          />
        )}

        {step === "review" && selectedAddon && (
          <UpsellReviewStep
            selectedAddon={selectedAddon}
            listPrice={listPrice}
            discount={discount}
            totalDue={totalDue}
            deposit={deposit}
            remainingAfterDeposit={remainingAfterDeposit}
            installments={installments}
            hasCardOnFile={hasCardOnFile}
            cardLast4={cardLast4}
            stripeCustomerId={stripeCustomerId}
            clientEmail={clientEmail}
            onBack={() => setStep("plan")}
            onSignAndPay={handleSignAndPay}
          />
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {deposit > 0
                ? "Charging card on file…"
                : "Saving bartending package…"}
            </p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <div>
              <p className="font-semibold text-lg">Bartending package added!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {deposit > 0
                  ? `${fmtMoney(deposit)} deposit collected. `
                  : "No charge processed. "}
                Contract sent to {clientEmail || "the bride"}.
              </p>
            </div>
            <Button onClick={reset}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
