import { useState, useEffect, useMemo } from "react";
import { useProposalResumeStep } from "@/lib/use-proposal-resume-step";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { signAndPayProposal } from "@/lib/proposal-sign-and-pay";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  PenTool,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_LOGO_URL,
  formatDisplayDate,
  generatePaymentSchedule,
} from "@/lib/utils";
import { api } from "@/lib/api";
import confetti from "canvas-confetti";

import {
  FALLBACK_PACKAGES,
  FALLBACK_ADDONS,
  renderContractSnapshot,
  CustomPlanOption,
} from "@/lib/booking-fallbacks";
import { CustomPlanBalanceIndicator } from "@/components/CustomPlanBalanceIndicator";
import { ProposalContractStep } from "@/components/ProposalContractStep";
import { ProposalPayStep } from "@/components/ProposalPayStep";
import { ProposalExpiryBanner } from "@/components/ProposalExpiryBanner";

export default function ProposalReview() {
  const { id } = useParams();
  const [proposal, setProposal] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [PACKAGES, setPackages] = useState<any[]>(FALLBACK_PACKAGES);
  const [ADDONS, setAddons] = useState<any[]>(FALLBACK_ADDONS);

  useEffect(() => {
    Promise.all([api.getPackages(true), api.getAddons(true)])
      .then(([pkgs, adns]) => {
        if (pkgs.length) setPackages(pkgs);
        if (adns.length) setAddons(adns);
      })
      .catch(() => {});
  }, []);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  useProposalResumeStep(id, proposal, step, setStep);
  const [signature, setSignature] = useState("");
  const [paymentPlan, setPaymentPlan] = useState<
    "deposit" | "fifty_fifty" | "quarterly" | "full" | "custom"
  >("deposit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [deferred, setDeferred] = useState<{
    weddingId: string;
    firstDue: number;
    label: string;
  } | null>(null);
  const [isSuccess, setIsSuccess] = useState(
    new URLSearchParams(window.location.search).get("success") === "true",
  );
  const { toast } = useToast();

  useEffect(() => {
    const loadPortalData = async () => {
      if (!id) return;

      try {
        const [proposalRes, settingsRes] = await Promise.all([
          supabase.from("proposals").select("*").eq("id", id).single(),
          supabase.from("portal_settings").select("*").single(),
        ]);

        if (proposalRes.error || !proposalRes.data) {
          toast({
            title: "Error",
            description: "Proposal not found or expired.",
            variant: "destructive",
          });
        } else {
          let proposalData = proposalRes.data;

          // Normalize custom_payment_plan from JSONB — ensure booleans are actual booleans
          let rawPlan = proposalData.custom_payment_plan;
          if (typeof rawPlan === "string") {
            try {
              rawPlan = JSON.parse(rawPlan);
            } catch (e) {}
          }
          if (rawPlan && typeof rawPlan === "object") {
            proposalData = {
              ...proposalData,
              custom_payment_plan: {
                enabled:
                  rawPlan.enabled === true ||
                  rawPlan.enabled === "true" ||
                  rawPlan.enabled === 1,
                deposit: Number(rawPlan.deposit) || 0,
                installments: Array.isArray(rawPlan.installments)
                  ? rawPlan.installments
                  : [],
              },
            };
          } else {
            proposalData = {
              ...proposalData,
              custom_payment_plan: {
                enabled: false,
                deposit: 0,
                installments: [],
              },
            };
          }

          // Mark as viewed if first time opening
          if (
            !proposalData.viewed_at &&
            proposalData.status !== "accepted" &&
            proposalData.status !== "paid"
          ) {
            const viewedAt = new Date().toISOString();
            await supabase
              .from("proposals")
              .update({ viewed_at: viewedAt, status: "viewed" })
              .eq("id", id);
            api.logAdminActivity(
              "Proposal Viewed",
              `Client ${proposalData.client_name} viewed their proposal`,
              true,
            );
            proposalData = {
              ...proposalData,
              viewed_at: viewedAt,
              status: "viewed",
            };
          }
          setProposal(proposalData);
        }

        if (settingsRes.data) {
          setBranding(settingsRes.data);
        }
      } catch (err) {
        console.error("Error loading portal data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPortalData();
  }, [id]);

  const companyName = branding?.company_name || "Veydra";
  const companyState = branding?.state || "Tennessee";

  const packageName = proposal?.package_id
    ? PACKAGES.find((p) => p.id === proposal.package_id)?.name ||
      proposal.package_id.charAt(0).toUpperCase() + proposal.package_id.slice(1)
    : "Custom";
  const coverageLabel =
    proposal?.coverage_type === "photo"
      ? "Photo Only"
      : proposal?.coverage_type === "video"
        ? "Video Only"
        : "Photo & Video";
  const packageString = proposal?.package_id
    ? `${packageName} (${coverageLabel})`
    : "Custom";

  // Auto-select custom plan when proposal has one enabled
  useEffect(() => {
    if (proposal?.custom_payment_plan?.enabled) {
      setPaymentPlan("custom");
    }
  }, [proposal]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const calculatePaymentAmount = () => {
    if (!proposal) return 0;
    if (proposal.is_upgrade) {
      if (paymentPlan === "custom" && proposal.custom_payment_plan?.enabled)
        return proposal.custom_payment_plan.deposit || 0;
      return Math.max(
        0,
        proposal.total_amount - (proposal.amount_paid_so_far || 0),
      );
    }
    if (paymentPlan === "custom" && proposal.custom_payment_plan?.enabled)
      return proposal.custom_payment_plan.deposit || 0;
    if (paymentPlan === "full") return proposal.total_amount; // pay in full, no discount
    if (paymentPlan === "fifty_fifty") return proposal.total_amount / 2;
    if (paymentPlan === "quarterly") return proposal.total_amount / 4;
    return 99; // deposit
  };

  const handleSignAndPay = async () => {
    setIsSubmitting(true);
    try {
      const result = await signAndPayProposal({
        proposal,
        signature,
        paymentPlan,
        calculatePaymentAmount,
        signOnly: true,
      });

      if (result.accepted) {
        setIsSuccess(true);
        return;
      }

      setDeferred({
        weddingId: result.weddingId || "",
        firstDue: result.firstDue || 0,
        label: result.label || "",
      });
      setStep(4);
    } catch (err: any) {
      if (
        err.message ===
        "Please type your full name exactly as it appears on the proposal."
      ) {
        toast({
          title: "Invalid Signature",
          description: err.message,
          variant: "destructive",
        });
        return;
      }
      console.error(err);
      api.logAdminActivity(
        "Proposal Payment Error",
        `Failed to initialize checkout for ${proposal.client_name}: ${err.message}`,
        true,
      );
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMoreThanYearOut = proposal?.wedding_date
    ? new Date(proposal.wedding_date).getTime() - Date.now() >
      365 * 24 * 60 * 60 * 1000
    : false;

  const isWithin90Days = useMemo(() => {
    if (!proposal?.wedding_date) return false;
    const wedding = new Date(proposal.wedding_date);
    const today = new Date();
    const diffTime = wedding.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 90;
  }, [proposal?.wedding_date]);

  useEffect(() => {
    // Don't override if a custom plan is enabled — it takes full priority
    if (proposal?.custom_payment_plan?.enabled) return;
    if (proposal?.is_upgrade) {
      if (paymentPlan !== "full") setPaymentPlan("full");
      return;
    }
    if (isWithin90Days && paymentPlan === "deposit") {
      setPaymentPlan("fifty_fifty");
    }
  }, [
    isWithin90Days,
    paymentPlan,
    proposal?.custom_payment_plan?.enabled,
    proposal?.is_upgrade,
  ]);

  useEffect(() => {
    if (isSuccess) {
      if (proposal?.id) {
        api.fulfillProposalPayment(proposal.id).catch(console.error);
      }

      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 100,
      };
      const randomInRange = (min: number, max: number) =>
        Math.random() * (max - min) + min;
      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti(
          Object.assign({}, defaults, {
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          }),
        );
        confetti(
          Object.assign({}, defaults, {
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          }),
        );
      }, 250);
      return () => clearInterval(interval);
    }
  }, [isSuccess, proposal?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!proposal) {
    return <Navigate to="/404" replace />;
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 py-12 px-4 flex items-center justify-center relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />

        <Card className="max-w-lg w-full text-center p-10 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl shadow-2xl border-stone-200/50 dark:border-stone-800/50 relative z-10 animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-800/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-green-200/50 dark:border-green-800/50">
            <CheckCircle2
              className="w-12 h-12 text-green-600 dark:text-green-500"
              strokeWidth={1.5}
            />
          </div>
          <h2 className="text-4xl font-serif text-stone-900 dark:text-stone-50 mb-4">
            Welcome to the Family!
          </h2>
          <div className="h-px w-16 bg-primary/20 mx-auto mb-6" />
          <p className="text-stone-500 dark:text-stone-400 mb-8 leading-relaxed text-lg font-light">
            Thank you,{" "}
            <span className="font-medium text-stone-900 dark:text-stone-100">
              {proposal.client_name}
            </span>
            ! Your booking is officially confirmed. We will be emailing and
            calling you shortly. If you prefer text, you can reply back to us
            saying that.
          </p>
          <Button
            onClick={() => window.close()}
            className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            Close Window
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 py-12 px-4 selection:bg-primary/20 font-serif">
      <div className="max-w-4xl mx-auto">
        <ProposalExpiryBanner
          proposal={proposal}
          isBooked={
            proposal.status === "accepted" ||
            proposal.status === "paid" ||
            proposal.status === "upcoming"
          }
        />
        <div className="text-center space-y-6 mb-12">
          <img
            src={branding?.logo_url || DEFAULT_LOGO_URL}
            alt="Logo"
            className="h-16 mx-auto"
          />
          <h1 className="text-4xl md:text-5xl font-serif text-foreground tracking-tight">
            Your Custom Proposal
          </h1>
          <p className="text-xl text-muted-foreground italic">
            Prepared exclusively for {proposal.client_name}
          </p>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-sans text-muted-foreground pt-2">
            {proposal.wedding_date && (
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-widest text-[10px] opacity-60">
                  Date:
                </span>
                <span className="font-medium text-foreground">
                  {formatDisplayDate(proposal.wedding_date)}
                </span>
              </div>
            )}
            {proposal.venue && (
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-widest text-[10px] opacity-60">
                  Venue:
                </span>
                <span className="font-medium text-foreground">
                  {proposal.venue}
                </span>
              </div>
            )}
            {(proposal.city || proposal.state) && (
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-widest text-[10px] opacity-60">
                  Location:
                </span>
                <span className="font-medium text-foreground">
                  {[proposal.city, proposal.state].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center mb-12 relative max-w-2xl mx-auto">
          <div className="absolute top-1/2 left-0 w-full h-px bg-border -z-10" />
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className="flex flex-col items-center gap-2 bg-stone-50 dark:bg-stone-950 px-4"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-500
                ${
                  step === s
                    ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20"
                    : step > s
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              <span
                className={`text-xs uppercase tracking-widest font-sans ${step === s ? "text-primary font-semibold" : "text-muted-foreground"}`}
              >
                {s === 1
                  ? "Review"
                  : s === 2
                    ? "Payment"
                    : s === 3
                      ? "Contract"
                      : "Checkout"}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border/50 shadow-2xl rounded-sm overflow-hidden transition-all duration-500">
          {step === 1 && (
            <div className="p-8 md:p-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-serif">Investment Summary</h2>
                <div className="h-px w-24 bg-primary/30 mx-auto" />
              </div>

              <div className="grid sm:grid-cols-3 gap-4 bg-muted/30 rounded-sm border border-border/50 p-6 font-sans">
                {proposal.wedding_date && (
                  <div className="text-center space-y-1">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Wedding Date
                    </p>
                    <p className="font-medium">
                      {formatDisplayDate(proposal.wedding_date)}
                    </p>
                  </div>
                )}
                {proposal.venue && (
                  <div className="text-center space-y-1">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Venue
                    </p>
                    <p className="font-medium">{proposal.venue}</p>
                  </div>
                )}
                {(proposal.city || proposal.state) && (
                  <div className="text-center space-y-1">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Location
                    </p>
                    <p className="font-medium">
                      {[proposal.city, proposal.state]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                {proposal.package_id && (
                  <div className="space-y-6 border-b border-border pb-8">
                    <div>
                      <h3 className="text-xl font-medium">
                        {packageString} Package
                      </h3>
                      <p className="text-muted-foreground font-sans mt-1">
                        Base coverage includes:
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                      {(proposal.coverage_type === "photo" ||
                        proposal.coverage_type === "both") && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
                            Photography
                          </h4>
                          <ul className="space-y-2">
                            {PACKAGES.find(
                              (p) => p.id === proposal.package_id,
                            )?.photoFeatures?.map((feature, idx) => (
                              <li
                                key={idx}
                                className="flex items-start text-sm"
                              >
                                <CheckCircle2 className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" />
                                <span className="text-muted-foreground">
                                  {feature}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(proposal.coverage_type === "video" ||
                        proposal.coverage_type === "both") && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
                            Videography
                          </h4>
                          <ul className="space-y-2">
                            {PACKAGES.find(
                              (p) => p.id === proposal.package_id,
                            )?.videoFeatures?.map((feature, idx) => (
                              <li
                                key={idx}
                                className="flex items-start text-sm"
                              >
                                <CheckCircle2 className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" />
                                <span className="text-muted-foreground">
                                  {feature}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {proposal.addons && proposal.addons.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
                      Included Enhancements
                    </h3>
                    <ul className="grid gap-4 sm:grid-cols-2">
                      {proposal.addons.map((addon: string) => {
                        const addonDetails = ADDONS.find((a) => a.id === addon);
                        const addonName =
                          addonDetails?.name || addon.replace(/_/g, " ");
                        return (
                          <li
                            key={addon}
                            className="flex items-start bg-muted/30 p-4 rounded-sm"
                          >
                            <CheckCircle2 className="w-5 h-5 text-primary mr-3 shrink-0" />
                            <span className="font-medium">
                              {addonName}{" "}
                              {addon === "second_shooter" &&
                              proposal.second_shooter_hours
                                ? `(${proposal.second_shooter_hours} hrs - ${proposal.second_shooter_type === "video" ? "Videographer" : "Photographer"})`
                                : addon === "second_shooter_new"
                                  ? `(${proposal.second_shooter_type === "video" ? "Videographer" : "Photographer"})`
                                  : ""}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {proposal.custom_prices?.items &&
                  proposal.custom_prices.items.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
                        Custom Additions
                      </h3>
                      <ul className="grid gap-4 sm:grid-cols-2">
                        {proposal.custom_prices.items.map((item: any) => (
                          <li
                            key={item.id}
                            className="flex items-start bg-muted/30 p-4 rounded-sm"
                          >
                            <CheckCircle2 className="w-5 h-5 text-primary mr-3 shrink-0" />
                            <div>
                              <span className="font-medium block">
                                {item.name}{" "}
                                <span className="text-muted-foreground ml-1">
                                  (${item.price.toLocaleString()})
                                </span>
                              </span>
                              {item.description && (
                                <span className="text-sm text-muted-foreground mt-1 block">
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {proposal.custom_prices?.discount > 0 && (
                  <div className="flex justify-between items-center bg-green-50/50 dark:bg-green-950/20 p-4 rounded-sm text-green-700 dark:text-green-400">
                    <span className="font-medium">
                      Special Discount Applied
                    </span>
                    <span>
                      -
                      {proposal.custom_prices.discountType === "percentage"
                        ? `${proposal.custom_prices.discount}%`
                        : `$${proposal.custom_prices.discount}`}
                    </span>
                  </div>
                )}

                <div className="bg-primary/5 p-8 rounded-sm border border-primary/10 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h3 className="text-lg text-muted-foreground">
                      Total Investment
                    </h3>
                    <p className="text-sm font-sans text-muted-foreground mt-1">
                      Includes all taxes and fees
                    </p>
                  </div>
                  <div className="text-4xl font-serif font-bold text-primary">
                    ${proposal.total_amount.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-8">
                <Button
                  onClick={() => setStep(2)}
                  size="lg"
                  className="w-full sm:w-auto font-sans tracking-wide"
                >
                  Continue to Payment Options{" "}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-8 md:p-12 space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-serif">Select Payment Schedule</h2>
                <div className="h-px w-24 bg-primary/30 mx-auto" />
                <p className="text-muted-foreground font-sans">
                  Choose how you'd like to handle your investment.
                </p>
              </div>

              <RadioGroup
                value={paymentPlan}
                onValueChange={(v: any) => setPaymentPlan(v)}
                className="grid gap-6"
              >
                {proposal?.custom_payment_plan?.enabled ? (
                  <CustomPlanOption
                    proposal={proposal}
                    selected={paymentPlan === "custom"}
                  />
                ) : proposal?.is_upgrade ? (
                  <Label
                    className={`flex flex-col border-2 rounded-sm p-6 cursor-pointer transition-all duration-300 border-primary bg-primary/5 shadow-md`}
                  >
                    <div className="flex justify-between items-start w-full mb-4">
                      <div className="flex items-center space-x-3 mt-1">
                        <RadioGroupItem value="full" id="full" />
                        <span className="text-xl font-serif font-semibold">
                          Pay Upgrade Balance
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">
                          Total Investment
                        </span>
                        <span className="text-2xl font-serif font-bold text-primary">
                          ${proposal.total_amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground font-sans ml-7 leading-relaxed">
                      You have already paid $
                      {(proposal.amount_paid_so_far || 0).toLocaleString()}{" "}
                      toward your original package. Pay the remaining upgrade
                      balance today to secure your new services.
                    </p>
                    <div className="mt-6 space-y-4 border-t border-stone-200 dark:border-stone-800 pt-5 ml-7">
                      <div className="flex justify-between items-center bg-primary/10 p-3 rounded-sm border border-primary/20">
                        <span className="font-semibold text-primary font-sans text-sm">
                          Due Today (Upgrade Balance)
                        </span>
                        <span className="font-bold text-primary text-lg">
                          $
                          {Math.max(
                            0,
                            proposal.total_amount -
                              (proposal.amount_paid_so_far || 0),
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </Label>
                ) : (
                  <>
                    {!isWithin90Days && (
                      <Label
                        className={`flex flex-col border-2 rounded-sm p-6 cursor-pointer transition-all duration-300 ${
                          paymentPlan === "deposit"
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex justify-between items-start w-full mb-4">
                          <div className="flex items-center space-x-3 mt-1">
                            <RadioGroupItem value="deposit" id="deposit" />
                            <span className="text-xl font-serif font-semibold">
                              Standard Booking
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">
                              Total Investment
                            </span>
                            <span className="text-2xl font-serif font-bold text-primary">
                              ${proposal.total_amount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-muted-foreground font-sans ml-7 leading-relaxed">
                          Pay a $99 non-refundable deposit today to secure your
                          date. The remaining balance will be split into equal
                          monthly installments of $250 until the month of your
                          wedding, with any final balance due 10 days prior.
                        </p>
                        {paymentPlan === "deposit" && (
                          <div className="mt-6 space-y-4 border-t border-stone-200 dark:border-stone-800 pt-5 ml-7">
                            <div className="flex justify-between items-center bg-primary/10 p-3 rounded-sm border border-primary/20">
                              <span className="font-semibold text-primary font-sans text-sm">
                                Due Today (Deposit)
                              </span>
                              <span className="font-bold text-primary text-lg">
                                $99.00
                              </span>
                            </div>
                            <div className="space-y-2 pt-2">
                              <p className="text-xs font-semibold text-stone-900 dark:text-stone-50 mb-3 uppercase tracking-wider">
                                Upcoming Schedule
                              </p>
                              {generatePaymentSchedule(
                                proposal.total_amount,
                                "deposit",
                                proposal.wedding_date,
                                proposal.created_at,
                                0,
                              )
                                .slice(0, 3)
                                .map((payment, i) => (
                                  <div
                                    key={i}
                                    className="flex justify-between text-sm text-stone-600 dark:text-stone-400 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                                  >
                                    <span>{payment.date}</span>
                                    <span className="font-medium">
                                      $
                                      {payment.amount.toLocaleString(
                                        undefined,
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        },
                                      )}
                                    </span>
                                  </div>
                                ))}
                              {generatePaymentSchedule(
                                proposal.total_amount,
                                "deposit",
                                proposal.wedding_date,
                                proposal.created_at,
                                0,
                              ).length > 3 && (
                                <p className="text-xs text-stone-400 mt-2 italic text-right">
                                  ...plus remaining installments
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </Label>
                    )}
                    <Label
                      className={`flex flex-col border-2 rounded-sm p-6 cursor-pointer transition-all duration-300 ${
                        paymentPlan === "fifty_fifty"
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex justify-between items-start w-full mb-4">
                        <div className="flex items-center space-x-3 mt-1">
                          <RadioGroupItem
                            value="fifty_fifty"
                            id="fifty_fifty"
                          />
                          <span className="text-xl font-serif font-semibold">
                            50/50 Split
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">
                            Total Investment
                          </span>
                          <span className="text-2xl font-serif font-bold text-primary">
                            ${proposal.total_amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-muted-foreground font-sans ml-7 leading-relaxed">
                        Pay 50% today to secure your date. The remaining 50%
                        will be automatically charged 10 days prior to your
                        wedding date. No monthly payments.
                      </p>
                      {paymentPlan === "fifty_fifty" && (
                        <div className="mt-6 space-y-4 border-t border-stone-200 dark:border-stone-800 pt-5 ml-7">
                          <div className="flex justify-between items-center bg-primary/10 p-3 rounded-sm border border-primary/20">
                            <span className="font-semibold text-primary font-sans text-sm">
                              Due Today (Deposit)
                            </span>
                            <span className="font-bold text-primary text-lg">
                              ${(proposal.total_amount / 2).toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-2 pt-2">
                            <p className="text-xs font-semibold text-stone-900 dark:text-stone-50 mb-3 uppercase tracking-wider">
                              Upcoming Schedule
                            </p>
                            {generatePaymentSchedule(
                              proposal.total_amount,
                              "fifty_fifty",
                              proposal.wedding_date,
                              proposal.created_at,
                              0,
                            ).map((payment, i) => (
                              <div
                                key={i}
                                className="flex justify-between text-sm text-stone-600 dark:text-stone-400 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                              >
                                <span>{payment.date}</span>
                                <span className="font-medium">
                                  $
                                  {payment.amount.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Label>

                    {isMoreThanYearOut && (
                      <Label
                        className={`flex flex-col border-2 rounded-sm p-6 cursor-pointer transition-all duration-300 ${
                          paymentPlan === "quarterly"
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex justify-between items-start w-full mb-4">
                          <div className="flex items-center space-x-3 mt-1">
                            <RadioGroupItem value="quarterly" id="quarterly" />
                            <span className="text-xl font-serif font-semibold">
                              Quarterly Plan
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">
                              Total Investment
                            </span>
                            <span className="text-2xl font-serif font-bold text-primary">
                              ${proposal.total_amount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-muted-foreground font-sans ml-7 leading-relaxed">
                          Pay 25% today to secure your date. The remaining
                          balance will be split into equal quarterly (every 3
                          months) installments.
                        </p>
                        {paymentPlan === "quarterly" && (
                          <div className="mt-6 space-y-4 border-t border-stone-200 dark:border-stone-800 pt-5 ml-7">
                            <div className="flex justify-between items-center bg-primary/10 p-3 rounded-sm border border-primary/20">
                              <span className="font-semibold text-primary font-sans text-sm">
                                Due Today (Deposit)
                              </span>
                              <span className="font-bold text-primary text-lg">
                                ${(proposal.total_amount / 4).toLocaleString()}
                              </span>
                            </div>
                            <div className="space-y-2 pt-2">
                              <p className="text-xs font-semibold text-stone-900 dark:text-stone-50 mb-3 uppercase tracking-wider">
                                Upcoming Schedule
                              </p>
                              {generatePaymentSchedule(
                                proposal.total_amount,
                                "quarterly",
                                proposal.wedding_date,
                                proposal.created_at,
                                0,
                              )
                                .slice(0, 3)
                                .map((payment, i) => (
                                  <div
                                    key={i}
                                    className="flex justify-between text-sm text-stone-600 dark:text-stone-400 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                                  >
                                    <span>{payment.date}</span>
                                    <span className="font-medium">
                                      $
                                      {payment.amount.toLocaleString(
                                        undefined,
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        },
                                      )}
                                    </span>
                                  </div>
                                ))}
                              {generatePaymentSchedule(
                                proposal.total_amount,
                                "quarterly",
                                proposal.wedding_date,
                                proposal.created_at,
                                0,
                              ).length > 3 && (
                                <p className="text-xs text-stone-400 mt-2 italic text-right">
                                  ...plus remaining installments
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </Label>
                    )}

                    <Label
                      className={`flex flex-col border-2 rounded-sm p-6 cursor-pointer transition-all duration-300 ${
                        paymentPlan === "full"
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex justify-between items-start w-full mb-4">
                        <div className="flex items-center space-x-3 mt-1">
                          <RadioGroupItem value="full" id="full" />
                          <span className="text-xl font-serif font-semibold">
                            Pay in Full
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">
                            Total Investment
                          </span>
                          <div className="flex flex-col items-end">
                            <span className="text-2xl font-serif font-bold text-primary">
                              ${proposal.total_amount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-muted-foreground font-sans ml-7 leading-relaxed">
                        Take care of the entire investment today. No future
                        payments to worry about.
                      </p>
                      {paymentPlan === "full" && (
                        <div className="mt-6 space-y-4 border-t border-stone-200 dark:border-stone-800 pt-5 ml-7">
                          <div className="flex justify-between items-center bg-primary/10 p-3 rounded-sm border border-primary/20">
                            <span className="font-semibold text-primary font-sans text-sm">
                              Due Today (Paid in Full)
                            </span>
                            <span className="font-bold text-primary text-lg">
                              ${proposal.total_amount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </Label>
                  </>
                )}
              </RadioGroup>

              <div className="flex justify-between pt-8 border-t">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="font-sans"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  size="lg"
                  className="font-sans tracking-wide"
                >
                  Continue to Contract <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <ProposalContractStep
              proposal={proposal}
              companyName={companyName}
              companyState={companyState}
              packageString={packageString}
              ADDONS={ADDONS}
              signature={signature}
              setSignature={setSignature}
              isSubmitting={isSubmitting}
              paymentPlan={paymentPlan}
              calculatePaymentAmount={calculatePaymentAmount}
              onSign={handleSignAndPay}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && (
            <div className="p-8 md:p-12 space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
              {paymentPlan !== "full" && (
                <div className="max-w-md mx-auto bg-primary/5 p-6 rounded-sm border border-primary/10 space-y-4">
                  <h3 className="text-sm font-sans uppercase tracking-widest text-primary font-semibold">
                    Your Payment Schedule
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Today's Payment</span>
                      <span>${calculatePaymentAmount().toLocaleString()}</span>
                    </div>
                    {generatePaymentSchedule(
                      proposal.total_amount,
                      paymentPlan,
                      proposal.wedding_date,
                      proposal.created_at,
                      0,
                      proposal.custom_payment_plan,
                    ).map((payment: any, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm text-muted-foreground"
                      >
                        <span>{payment.date}</span>
                        <span>${payment.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ProposalPayStep
                deferred={deferred}
                invoiceUrl={invoiceUrl}
                onInvoiceUrl={setInvoiceUrl}
                remaining={Math.max(
                  0,
                  (proposal.total_amount || 0) -
                    (proposal.amount_paid_so_far || 0),
                )}
                clientName={proposal.client_name}
                weddingDate={proposal.wedding_date}
                isUpgrade={proposal.is_upgrade}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
