import { useState, useEffect, useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
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
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  PenTool,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  DEFAULT_LOGO_URL,
  formatDisplayDate,
  generatePaymentSchedule,
  generateHTMLReceipt,
} from "@/lib/utils";
import { api } from "@/lib/api";
import confetti from "canvas-confetti";

// Fallbacks used while DB data loads or if DB is unreachable
const FALLBACK_PACKAGES = [
  {
    id: "pearl",
    name: "Pearl",
    desc: "4 hours",
    priceBoth: 1950,
    priceSingle: 1150,
    photoFeatures: [
      "4 hours ~ 1 Photographer",
      "300+ fully edited photos",
      "Personalized Digital Gallery",
      "Printing Rights",
    ],
    videoFeatures: [
      "4 hours ~ 1 Videographer",
      "6+ minute highlight video",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
      "RAW Video Footage",
    ],
    isArchived: true,
  },
  {
    id: "emerald",
    name: "Emerald",
    desc: "6 hours",
    priceBoth: 2550,
    priceSingle: 1450,
    photoFeatures: [
      "6 hours ~ 1 Photographer",
      "450+ fully edited photos",
      "Personalized Digital Gallery",
      "Printing Rights",
    ],
    videoFeatures: [
      "6 hours ~ 1 Videographer",
      "8+ minute highlight video",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
      "RAW Video Footage",
    ],
    isArchived: true,
  },
  {
    id: "diamond",
    name: "Diamond Special",
    desc: "8 hours",
    priceBoth: 3150,
    priceSingle: 1750,
    photoFeatures: [
      "8 hours ~ 1 Photographer",
      "600+ fully edited photos",
      "Personalized Digital Gallery",
      "Printing Rights",
    ],
    videoFeatures: [
      "8 hours ~ 1 Videographer",
      "10+ minute highlight video",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
      "RAW Video Footage",
    ],
    isArchived: true,
  },
  {
    id: "platinum",
    name: "Platinum",
    desc: "10 hours",
    priceBoth: 3750,
    priceSingle: 2050,
    photoFeatures: [
      "10 hours ~ 1 Photographer",
      "750+ fully edited photos",
      "Personalized Digital Gallery",
      "Printing Rights",
    ],
    videoFeatures: [
      "10 hours ~ 1 Videographer",
      "12+ minute highlight video",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
      "RAW Video Footage",
    ],
    isArchived: true,
  },
  {
    id: "all_in_bride",
    name: "All-In Bride",
    desc: "10 hours",
    priceBoth: 1950,
    priceSingle: 1150,
    photoFeatures: [
      "10 hours ~ 1 Photographer",
      "750+ fully edited photos & RAW photos",
      "Personalized Digital Gallery & Printing Rights",
      "Shareable Digital Portfolio Link",
    ],
    videoFeatures: [
      "10 hours ~ 1 Videographer",
      "6+ minute highlight video & RAW Video Footage",
      "Audio of Vows & Speeches",
      "Shareable Digital Portfolio Link",
    ],
  },
];

const FALLBACK_ADDONS = [
  {
    id: "audio",
    name: "Audio of Vows & Speeches",
    price: 125,
    isArchived: true,
  },
  { id: "drone", name: "Aerial Drone Footage", price: 250, isArchived: true },
  {
    id: "second_shooter",
    name: "2nd Shooter",
    price: 200,
    isHourly: true,
    minHours: 3,
    isArchived: true,
  },
  { id: "raw", name: "4K RAW Footage Delivery", price: 200, isArchived: true },
  {
    id: "highlight_30",
    name: "30-Min Highlight Video",
    price: 350,
    isArchived: true,
  },
  {
    id: "highlight_60",
    name: "60-Min Highlight Video",
    price: 500,
    isArchived: true,
  },
  {
    id: "extra_session",
    name: "Extra Session (Engagement/Bridals)",
    price: 450,
    isArchived: true,
  },
  { id: "drone_new", name: "Aerial Drone Footage", price: 300 },
  {
    id: "second_shooter_new",
    name: "2nd Shooter (up to 10 hours)",
    price: 750,
  },
];

const stripePromise = loadStripe("pk_live_ksr3XxUGn2LLl5mf847DsThU");

function CheckoutForm({
  clientSecret,
  clientName,
  onSuccess,
}: {
  clientSecret: string;
  clientName: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    try {
      const isSetupIntent = clientSecret.startsWith("seti_");
      const confirmResult = isSetupIntent
        ? await stripe.confirmSetup({
            elements,
            confirmParams: {
              return_url: window.location.href + "?success=true",
            },
            redirect: "if_required",
          })
        : await stripe.confirmPayment({
            elements,
            confirmParams: {
              return_url: window.location.href + "?success=true",
            },
            redirect: "if_required",
          });

      if (confirmResult.error) {
        api.logAdminActivity(
          "Proposal Payment Failed",
          `Payment failed for ${clientName}: ${confirmResult.error.message}`,
          true,
        );
        toast({
          title: "Payment Failed",
          description: confirmResult.error.message,
          variant: "destructive",
        });
        setIsProcessing(false);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Stripe confirmation error:", err);
      api.logAdminActivity(
        "Proposal Payment Error",
        `Unexpected error during checkout for ${clientName}: ${err?.message}`,
        true,
      );
      toast({
        title: "Payment Error",
        description:
          err?.message || "An unexpected error occurred during checkout.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <ShieldCheck className="w-4 h-4 mr-2" />
        )}
        {isProcessing ? "Processing..." : "Complete Payment"}
      </Button>
    </form>
  );
}

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
  const [signature, setSignature] = useState("");
  const [paymentPlan, setPaymentPlan] = useState<
    "deposit" | "fifty_fifty" | "quarterly" | "full" | "custom"
  >("deposit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [stripeIds, setStripeIds] = useState({
    customerId: "",
    subscriptionId: "",
  });
  const [isSuccess, setIsSuccess] = useState(
    new URLSearchParams(window.location.search).get("success") === "true",
  );
  const stripeOptions = useMemo(
    () => ({ clientSecret, appearance: { theme: "stripe" as const } }),
    [clientSecret],
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
    if (paymentPlan === "full") return proposal.total_amount * 0.95; // 5% off
    if (paymentPlan === "fifty_fifty") return proposal.total_amount / 2;
    if (paymentPlan === "quarterly") return proposal.total_amount / 4;
    return 99; // deposit
  };

  const handleSignAndPay = async () => {
    if (
      signature.trim().toLowerCase().replace(/\s+/g, "") !==
      proposal.client_name.toLowerCase().replace(/\s+/g, "")
    ) {
      toast({
        title: "Invalid Signature",
        description:
          "Please type your full name exactly as it appears on the proposal.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Save signature to database
      const { error: updateError } = await supabase
        .from("proposals")
        .update({
          contract_signature: signature,
          contract_signed_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);

      if (updateError) {
        console.warn(
          "Could not save signature to DB (likely RLS), but proceeding to payment...",
          updateError,
        );
      }
      const response = await fetch(
        `${supabaseUrl}/functions/v1/stripe-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({
            proposalId: proposal.id,
            amount: Math.round(calculatePaymentAmount() * 100), // Convert to cents
            totalPrice: proposal.is_upgrade
              ? calculatePaymentAmount()
              : paymentPlan === "full"
                ? proposal.total_amount * 0.95
                : proposal.total_amount,
            weddingDate: proposal.wedding_date,
            customerEmail: proposal.client_email,
            customerName: proposal.client_name,
            paymentPlan:
              proposal.is_upgrade && paymentPlan !== "custom"
                ? "full"
                : paymentPlan === "custom"
                  ? "custom"
                  : paymentPlan === "deposit" || paymentPlan === "quarterly"
                    ? paymentPlan
                    : paymentPlan === "fifty_fifty"
                      ? "half"
                      : "full",
            paymentOption:
              proposal.is_upgrade && paymentPlan !== "custom"
                ? "full"
                : paymentPlan === "custom"
                  ? "custom"
                  : paymentPlan === "deposit" || paymentPlan === "quarterly"
                    ? paymentPlan
                    : paymentPlan === "fifty_fifty"
                      ? "half"
                      : "full",
            description: proposal.is_upgrade
              ? `Wedding Package Upgrade for ${proposal.client_name}`
              : paymentPlan === "custom"
                ? `Custom Payment Plan Deposit for ${proposal.client_name}`
                : paymentPlan === "full"
                  ? `Wedding Payment in Full for ${proposal.client_name}`
                  : paymentPlan === "fifty_fifty"
                    ? `Wedding 50% Deposit for ${proposal.client_name}`
                    : `Wedding Deposit for ${proposal.client_name}`,
          }),
        },
      );

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(
          `Payment server error: ${responseText.substring(0, 100)}`,
        );
      }

      if (!response.ok)
        throw new Error(result.error || "Failed to initialize checkout");

      setClientSecret(result.clientSecret);
      setStripeIds({
        customerId: result.customerId || "",
        subscriptionId: result.subscriptionId || "",
      });
      setStep(4);
    } catch (err: any) {
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
                  <Label
                    className={`flex flex-col border-2 rounded-sm p-6 cursor-pointer transition-all duration-300 ${
                      paymentPlan === "custom"
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex justify-between items-start w-full mb-4">
                      <div className="flex items-center space-x-3 mt-1">
                        <RadioGroupItem value="custom" id="custom" />
                        <span className="text-xl font-serif font-semibold">
                          Custom Payment Plan
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
                      Pay a custom deposit today to secure your date. The
                      remaining balance is split into a customized schedule.
                    </p>
                    {paymentPlan === "custom" && (
                      <div className="mt-6 space-y-4 border-t border-stone-200 dark:border-stone-800 pt-5 ml-7">
                        <div className="flex justify-between items-center bg-primary/10 p-3 rounded-sm border border-primary/20">
                          <span className="font-semibold text-primary font-sans text-sm">
                            Due Today (Deposit)
                          </span>
                          <span className="font-bold text-primary text-lg">
                            $
                            {(
                              proposal.custom_payment_plan.deposit || 0
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="space-y-2 pt-2">
                          <p className="text-xs font-semibold text-stone-900 dark:text-stone-50 mb-3 uppercase tracking-wider">
                            Upcoming Schedule
                          </p>
                          {generatePaymentSchedule(
                            proposal.total_amount,
                            "custom",
                            proposal.wedding_date,
                            proposal.created_at,
                            0,
                            proposal.custom_payment_plan,
                          ).map((payment: any, i: number) => (
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
                            Pay in Full{" "}
                            <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full ml-2">
                              -5% OFF
                            </span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">
                            Total Investment
                          </span>
                          <div className="flex flex-col items-end">
                            <span className="text-2xl font-serif font-bold text-primary">
                              ${(proposal.total_amount * 0.95).toLocaleString()}
                            </span>
                            <span className="text-sm text-muted-foreground line-through">
                              ${proposal.total_amount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-muted-foreground font-sans ml-7 leading-relaxed">
                        Take care of the entire investment today and receive a
                        5% discount. No future payments to worry about.
                      </p>
                      {paymentPlan === "full" && (
                        <div className="mt-6 space-y-4 border-t border-stone-200 dark:border-stone-800 pt-5 ml-7">
                          <div className="flex justify-between items-center bg-primary/10 p-3 rounded-sm border border-primary/20">
                            <span className="font-semibold text-primary font-sans text-sm">
                              Due Today (Paid in Full)
                            </span>
                            <span className="font-bold text-primary text-lg">
                              ${(proposal.total_amount * 0.95).toLocaleString()}
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
            <div className="p-8 md:p-12 space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-serif">Service Agreement</h2>
                <div className="h-px w-24 bg-primary/30 mx-auto" />
              </div>

              <ScrollArea className="h-[500px] w-full rounded-sm border bg-muted/10 p-8 shadow-inner">
                {proposal.custom_contract_snapshot ? (
                  <div
                    className="contract-content space-y-6 max-w-3xl mx-auto font-serif prose dark:prose-invert max-w-none text-foreground"
                    dangerouslySetInnerHTML={{
                      __html: proposal.custom_contract_snapshot
                        .replace(/{{company_name}}/g, companyName || "")
                        .replace(/{{company_state}}/g, companyState || "")
                        .replace(/{{bride_name}}/g, proposal.client_name || "")
                        .replace(/{{client_name}}/g, proposal.client_name || "")
                        .replace(
                          /{{partner_name}}/g,
                          proposal.partner_name
                            ? `& ${proposal.partner_name}`
                            : "",
                        )
                        .replace(
                          /{{wedding_date}}/g,
                          formatDisplayDate(proposal.wedding_date) || "",
                        )
                        .replace(/{{venue}}/g, proposal.venue || "")
                        .replace(
                          /{{venue_address}}/g,
                          proposal.venue_address || "",
                        )
                        .replace(/{{city}}/g, proposal.city || "")
                        .replace(/{{state}}/g, proposal.state || "")
                        .replace(/{{package_name}}/g, packageString || "")
                        .replace(
                          /{{total_amount}}/g,
                          proposal.total_amount
                            ? `$${proposal.total_amount.toLocaleString()}`
                            : "$0",
                        )
                        .replace(
                          /{{retainer_amount}}/g,
                          proposal.total_amount
                            ? `$${(proposal.total_amount / 2).toLocaleString()}`
                            : "$0",
                        )
                        .replace(
                          /{{add_ons}}/g,
                          (() => {
                            const addonNames: string[] = [];
                            if (proposal.addons?.length > 0) {
                              proposal.addons.forEach((a: string) => {
                                const name =
                                  ADDONS.find((ad) => ad.id === a)?.name || a;
                                addonNames.push(
                                  a === "second_shooter"
                                    ? `${name} (${proposal.second_shooter_hours} hrs - ${proposal.second_shooter_type === "video" ? "Videographer" : "Photographer"})`
                                    : name,
                                );
                              });
                            }
                            if (proposal.custom_prices?.items?.length > 0) {
                              proposal.custom_prices.items.forEach(
                                (item: any) => addonNames.push(item.name),
                              );
                            }
                            return addonNames.length > 0
                              ? addonNames.join(", ")
                              : "None";
                          })(),
                        )
                        .replace(
                          /{{date}}/g,
                          proposal.contract_signed_at
                            ? formatDisplayDate(proposal.contract_signed_at)
                            : formatDisplayDate(new Date().toISOString()),
                        ),
                    }}
                  />
                ) : (
                  <div className="contract-content space-y-8 max-w-3xl mx-auto font-serif">
                    <div className="text-center space-y-4 mb-12">
                      <h1 className="text-2xl font-bold uppercase tracking-widest border-b pb-4">
                        {proposal.is_upgrade
                          ? "Amendment to Wedding Photography & Videography Agreement"
                          : "Wedding Photography & Videography Agreement"}
                      </h1>
                      <p className="text-muted-foreground italic">
                        ({companyName} — {companyState})
                      </p>
                      <p className="text-muted-foreground italic">
                        This{" "}
                        {proposal.is_upgrade
                          ? "Amendment"
                          : "Wedding Agreement (“Agreement”)"}{" "}
                        is entered into on{" "}
                        <strong>
                          {proposal.contract_signed_at
                            ? formatDisplayDate(proposal.contract_signed_at)
                            : formatDisplayDate(new Date().toISOString())}
                        </strong>{" "}
                        by and between:
                      </p>
                    </div>

                    <section className="space-y-4">
                      <p>
                        <strong>Client(s):</strong> {proposal.client_name}{" "}
                        {proposal.partner_name
                          ? `& ${proposal.partner_name}`
                          : ""}
                      </p>
                      <p>
                        <strong>Service Provider:</strong> {companyName}, an
                        independently owned and operated limited liability
                        company based in {companyState}{" "}
                        (“Photographer/Videographer”).
                      </p>
                    </section>

                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold uppercase tracking-wider">
                        1. Services
                      </h2>
                      <p>
                        {proposal.is_upgrade
                          ? `This amendment modifies the original agreement. ${companyName} agrees to provide the following upgraded services for the Client’s event:`
                          : `${companyName} agrees to provide professional wedding photography and/or videography services for the Client’s event as follows:`}
                      </p>
                      <ul className="list-none space-y-2">
                        <li>
                          <strong>Wedding Date:</strong>{" "}
                          {formatDisplayDate(proposal.wedding_date)}
                        </li>
                        <li>
                          <strong>Venue:</strong> {proposal.venue}{" "}
                          {proposal.venue_address
                            ? `- ${proposal.venue_address}`
                            : ""}{" "}
                          {proposal.city}, {proposal.state}
                        </li>
                        {proposal.package_id && (
                          <li>
                            <strong>Package Booked:</strong> {packageString}
                          </li>
                        )}
                        {(proposal.addons?.length > 0 ||
                          proposal.custom_prices?.items?.length > 0) && (
                          <li>
                            <strong>Add-ons:</strong>
                            {proposal.addons
                              ?.map((a: string) => {
                                const name =
                                  ADDONS.find((ad) => ad.id === a)?.name || a;
                                return a === "second_shooter"
                                  ? `${name} (${proposal.second_shooter_hours} hrs - ${proposal.second_shooter_type === "video" ? "Videographer" : "Photographer"})`
                                  : name;
                              })
                              .join(", ")}
                            {proposal.addons?.length > 0 &&
                            proposal.custom_prices?.items?.length > 0
                              ? ", "
                              : ""}
                            {proposal.custom_prices?.items
                              ?.map((item: any) => item.name)
                              .join(", ")}
                          </li>
                        )}
                        <li>
                          <strong>Assigned Team:</strong>{" "}
                          {proposal.coverage_type === "both"
                            ? "1 Photographer + 1 Videographer"
                            : proposal.coverage_type === "photo"
                              ? "1 Photographer"
                              : "1 Videographer"}{" "}
                          (unless otherwise noted)
                        </li>
                      </ul>
                      <p>
                        {companyName} reserves the right to assign qualified
                        creative professionals from its trusted network to
                        ensure timely, high-quality coverage.
                      </p>
                    </section>

                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold uppercase tracking-wider">
                        2. Deliverables
                      </h2>
                      <p>
                        The Photographer/Videographer agrees to deliver the
                        following:
                      </p>
                      <ul className="list-disc pl-6 space-y-2">
                        {(proposal.coverage_type === "photo" ||
                          proposal.coverage_type === "both") && (
                          <li>Professionally edited digital photo gallery</li>
                        )}
                        {(proposal.coverage_type === "video" ||
                          proposal.coverage_type === "both") && (
                          <li>
                            Edited wedding film (highlight + optional
                            documentary/full ceremony edits, depending on
                            package)
                          </li>
                        )}
                      </ul>
                      <p>
                        <strong>Delivery Timeline:</strong> Within approximately
                        3–4 weeks following the wedding date. During high-volume
                        months (such as October), timelines may extend slightly
                        to maintain editing quality.
                      </p>
                    </section>

                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold uppercase tracking-wider">
                        3. Payment Terms
                      </h2>
                      <p>
                        <strong>Total Investment:</strong> $
                        {proposal.total_amount.toLocaleString()}
                      </p>

                      <div className="bg-primary/5 p-4 rounded-sm space-y-2 border border-primary/10">
                        <p>
                          <strong>Retainer (Non-Refundable):</strong> $
                          {(proposal.total_amount / 2).toLocaleString()} due
                          upon signing to reserve your wedding date. The
                          retainer is 50% of the contract value.
                        </p>
                      </div>

                      <p>
                        <strong>Remaining Balance:</strong> Due no later than 10
                        days before the wedding date.
                      </p>
                      <p>
                        <strong>Accepted Payments:</strong> Credit Card only
                        (processed securely through {companyName}’s online
                        payment system).
                      </p>
                      <p>
                        Payments made via credit card include standard merchant
                        processing fees, which are built into the total
                        investment.
                        <br />
                        Cash, check, or alternative payment methods are not
                        accepted.
                      </p>
                      <p>
                        Failure to make timely payments may result in suspension
                        or cancellation of services and forfeiture of the
                        retainer.
                      </p>
                    </section>

                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold uppercase tracking-wider">
                        4. Rescheduling & Cancellation
                      </h2>
                      <p>
                        <strong>Rescheduling:</strong> The retainer may be
                        applied to a new wedding date, subject to availability.
                      </p>
                      <p>
                        <strong>Cancellation:</strong> The retainer is
                        non-refundable. Any additional payments made beyond the
                        retainer will be refunded if cancellation occurs.
                      </p>
                      <p>
                        If {companyName} must cancel due to emergency or
                        unforeseen circumstances, all payments made by the
                        Client will be refunded in full, and best efforts will
                        be made to assist in finding an alternate provider.
                      </p>
                    </section>

                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold uppercase tracking-wider">
                        5. Creative Rights
                      </h2>
                      <p>
                        The Client acknowledges that {companyName} maintains
                        complete creative control over style, editing, and
                        artistic decisions. The Client has reviewed the
                        company’s portfolio and understands the creative nature
                        of the work.
                      </p>
                      <p>
                        All photographs and videos remain the copyrighted
                        property of {companyName}, which grants the Client a
                        perpetual, non-exclusive, personal-use license to
                        download, print, share, and display the media for
                        personal use.
                      </p>
                    </section>

                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold uppercase tracking-wider">
                        6. Substitutions & Liability
                      </h2>
                      <p>
                        If a scheduled Photographer or Videographer is unable to
                        attend due to illness, emergency, or unforeseen event,{" "}
                        {companyName} will provide a qualified replacement
                        whenever possible.
                      </p>
                      <p>
                        {companyName} is not responsible for circumstances
                        beyond reasonable control (e.g., weather, equipment
                        failure, venue restrictions, or interference by guests).
                        <br />
                        Liability is limited to the return of all payments
                        received.
                      </p>
                    </section>

                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold uppercase tracking-wider">
                        7. Client Cooperation
                      </h2>
                      <p>
                        The Client agrees to provide a safe and cooperative
                        environment for all team members. The Client understands
                        that full cooperation—including adherence to schedules,
                        communication, and participation from key
                        individuals—directly impacts the final quality of
                        results.
                      </p>
                    </section>

                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold uppercase tracking-wider">
                        8. Model Release
                      </h2>
                      <p>
                        The Client grants {companyName} permission to use images
                        and/or video clips from the event for portfolio, social
                        media, website, and promotional use.
                        <br />
                        (Optional: Clients may request in writing to opt out
                        prior to the wedding date.)
                      </p>
                    </section>

                    <section className="space-y-4">
                      <h2 className="text-xl font-semibold uppercase tracking-wider">
                        9. Entire Agreement
                      </h2>
                      <p>
                        This Agreement represents the full understanding between
                        the Client and {companyName}. Any modifications or
                        additions must be made in writing and signed by both
                        parties.
                      </p>
                    </section>
                  </div>
                )}
              </ScrollArea>

              <div className="bg-primary/5 p-8 rounded-sm border border-primary/10 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="signature" className="text-lg font-serif">
                    Electronic Signature
                  </Label>
                  <p className="text-sm font-sans text-muted-foreground">
                    By typing your name below, you agree to the terms outlined
                    in this agreement.
                  </p>
                </div>
                <div className="relative max-w-md">
                  <PenTool className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    id="signature"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder={`Type "${proposal.client_name}"`}
                    className="pl-12 py-6 text-lg font-serif bg-background"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-8 border-t">
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className="font-sans"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={handleSignAndPay}
                  disabled={
                    !signature ||
                    signature.trim().toLowerCase().replace(/\s+/g, "") !==
                      proposal.client_name.toLowerCase().replace(/\s+/g, "") ||
                    isSubmitting
                  }
                  size="lg"
                  className="font-sans tracking-wide"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-2" />
                  )}
                  {isSubmitting
                    ? "Initializing..."
                    : `Sign & Pay $${calculatePaymentAmount().toLocaleString()}`}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && clientSecret && (
            <div className="p-8 md:p-12 space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-serif">Finalize Booking</h2>
                <div className="h-px w-24 bg-primary/30 mx-auto" />
                <p className="text-muted-foreground font-sans">
                  Complete your payment of{" "}
                  <strong>${calculatePaymentAmount().toLocaleString()}</strong>{" "}
                  securely via Stripe.
                </p>
              </div>

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

              <div className="max-w-md mx-auto bg-white p-6 rounded-sm shadow-sm border border-border/50">
                <Elements stripe={stripePromise} options={stripeOptions}>
                  <CheckoutForm
                    clientSecret={clientSecret}
                    clientName={proposal.client_name}
                    onSuccess={async () => {
                      setIsSuccess(true);
                      confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 },
                      });

                      const amountPaid = calculatePaymentAmount();

                      try {
                        await api.updateProposal(proposal.id, {
                          status: "accepted",
                          payment_plan: paymentPlan,
                        } as any);

                        if (proposal.wedding_id) {
                          await api.updateWedding(proposal.wedding_id, {
                            status: "pending",
                            paid_amount: amountPaid,
                            stripe_customer_id: stripeIds.customerId || null,
                            stripe_subscription_id:
                              stripeIds.subscriptionId || null,
                            contract_date: new Date().toISOString(),
                          } as any);
                        } else {
                          const newWedding = await api.createWedding({
                            client_name: proposal.client_name,
                            client_email: proposal.client_email,
                            partner_name: proposal.partner_name,
                            date: proposal.wedding_date,
                            location:
                              `${proposal.venue || ""} ${proposal.city || ""}, ${proposal.state || ""}`.trim(),
                            package: packageString,
                            addons: proposal.addons,
                            status: "pending",
                            payment_plan: paymentPlan,
                            custom_payment_plan: proposal.custom_payment_plan,
                            total_amount:
                              paymentPlan === "full"
                                ? proposal.total_amount * 0.95
                                : proposal.total_amount,
                            paid_amount: amountPaid,
                            stripe_customer_id: stripeIds.customerId || null,
                            stripe_subscription_id:
                              stripeIds.subscriptionId || null,
                            contract_date: new Date().toISOString(),
                          } as any);

                          if (newWedding?.id) {
                            await api.updateProposal(proposal.id, {
                              wedding_id: newWedding.id,
                            } as any);
                          }
                        }
                      } catch (err) {
                        console.error(
                          "Failed to update proposal/wedding status on success:",
                          err,
                        );
                      }

                      const addonsList =
                        proposal.addons?.length > 0
                          ? proposal.addons.join(", ")
                          : "None";
                      const receiptHtml = generateHTMLReceipt(
                        companyName,
                        proposal.client_name,
                        amountPaid,
                        paymentPlan,
                        packageString,
                        proposal.addons || [],
                        proposal.total_amount,
                      );

                      try {
                        await api.sendOvantaEmail(
                          proposal.client_email,
                          `Payment Receipt - ${companyName}`,
                          receiptHtml,
                          proposal.client_name,
                          true,
                        );
                      } catch (err) {
                        console.error("Failed to send receipt:", err);
                      }
                    }}
                  />
                </Elements>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
