import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { api } from "@/lib/api";
import {
  DEFAULT_LOGO_URL,
  formatDisplayDate,
  generatePaymentSchedule,
  generateHTMLReceipt,
} from "@/lib/utils";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import confetti from "canvas-confetti";

const stripePromise = loadStripe("pk_live_ksr3XxUGn2LLl5mf847DsThU");

function TypewriterText({
  text,
  delay = 0,
  className = "",
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    let i = 0;
    let interval: NodeJS.Timeout;
    const timer = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setDisplayedText(text.substring(0, i));
        if (i >= text.length) clearInterval(interval);
      }, 35);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [text, delay]);

  return (
    <span className={className}>
      {displayedText}
      <span className="animate-pulse text-stone-300 dark:text-stone-600 font-light opacity-70 ml-0.5">
        |
      </span>
    </span>
  );
}

function CheckoutForm({
  clientSecret,
  clientName,
  onSuccess,
  isSubmitting,
  setIsSubmitting,
  companyName,
  weddingDate,
  totalPrice,
  paymentOption,
  createdWeddingId,
}: {
  clientSecret: string;
  clientName: string;
  onSuccess: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  companyName: string;
  weddingDate: string;
  totalPrice: number;
  paymentOption: string;
  createdWeddingId: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsSubmitting(true);
    try {
      const isSetupIntent = clientSecret.startsWith("seti_");

      const confirmResult = isSetupIntent
        ? await stripe.confirmSetup({
            elements,
            confirmParams: {
              return_url:
                window.location.origin +
                "/book?success=true&wedding_id=" +
                createdWeddingId,
            },
            redirect: "if_required",
          })
        : await stripe.confirmPayment({
            elements,
            confirmParams: {
              return_url:
                window.location.origin +
                "/book?success=true&wedding_id=" +
                createdWeddingId,
            },
            redirect: "if_required",
          });

      const { error } = confirmResult;

      if (error) {
        api.logAdminActivity(
          "Direct Booking Payment Failed",
          `Payment failed for ${clientName}: ${error.message}`,
          true,
        );
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
        setIsSubmitting(false);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Stripe confirmation error:", err);
      api.logAdminActivity(
        "Direct Booking Payment Error",
        `Unexpected error during checkout for ${clientName}: ${err?.message}`,
        true,
      );
      toast({
        title: "Payment Error",
        description:
          err?.message || "An unexpected error occurred during checkout.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const isIframe = window !== window.top;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isIframe && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm">
          <strong>⚠️ Preview Mode Detected:</strong> Stripe security prevents
          payments from being processed inside this preview window. Please click
          the <strong>"Open in New Tab"</strong> icon in the top right corner of
          your screen to test the payment.
        </div>
      )}
      <div className="bg-muted/30 border rounded-lg p-5 space-y-3 text-sm">
        <h4 className="font-semibold text-base mb-2">Payment Summary</h4>
        {paymentOption === "deposit" || paymentOption === "quarterly" ? (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Due Today (Retainer)
              </span>
              <span className="font-medium">$99.00</span>
            </div>
            {generatePaymentSchedule(
              totalPrice,
              paymentOption,
              weddingDate,
              new Date().toISOString(),
              0,
              null,
            ).map((payment, i) => (
              <div
                key={i}
                className="flex justify-between text-muted-foreground"
              >
                <span>
                  {payment.label} ({payment.date})
                </span>
                <span>
                  $
                  {payment.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
            <div className="pt-3 mt-3 border-t text-xs text-muted-foreground leading-relaxed">
              By completing this payment, you authorize {companyName} to
              securely save this payment method on file and automatically
              process future scheduled payments towards your total balance of $
              {totalPrice.toLocaleString()}.
            </div>
          </>
        ) : paymentOption === "half" ? (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Due Today (50% Deposit)
              </span>
              <span className="font-medium">
                $
                {(totalPrice / 2).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Final Balance (due 10 days before wedding)</span>
              <span>
                $
                {(totalPrice / 2).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="pt-3 mt-3 border-t text-xs text-muted-foreground leading-relaxed">
              By completing this payment, you authorize {companyName} to
              securely save this payment method on file and automatically
              process the remaining 50% balance 10 days before your wedding
              date.
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Due Today (Paid in Full)
              </span>
              <span className="font-medium">
                $
                {(totalPrice * 0.95).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining Balance</span>
              <span className="font-medium">$0.00</span>
            </div>
          </>
        )}
      </div>

      <div className="min-h-[200px] relative">
        <PaymentElement onReady={() => console.log("PaymentElement ready")} />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || isSubmitting}
        size="lg"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : null}
        {isSubmitting
          ? "Processing..."
          : `Pay ${paymentOption === "full" ? "$" + (totalPrice * 0.95).toLocaleString() : paymentOption === "half" ? "$" + (totalPrice / 2).toLocaleString() : "$99"} & Secure Date`}
      </Button>
    </form>
  );
}

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

export default function Book() {
  const [PACKAGES, setPackages] = useState<any[]>(FALLBACK_PACKAGES);
  const [ADDONS, setAddons] = useState<any[]>(FALLBACK_ADDONS);

  useEffect(() => {
    Promise.all([api.getPackages(), api.getAddons()])
      .then(([pkgs, adns]) => {
        if (pkgs.length) setPackages(pkgs);
        if (adns.length) setAddons(adns);
      })
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    partnerName: "",
    weddingDate: "",
    venue: "",
    venueAddress: "",
    city: "",
    state: "",
    coverageType: "",
    packageId: "",
    addons: [] as string[],
    secondShooterHours: 3,
    secondShooterType: "photo",
    notes: "",
    signature: "",
    paymentOption: "deposit",
    couponCode: "",
  });

  const [step, setStep] = useState(1);
  const [formStep, setFormStep] = useState(0);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [stripeIds, setStripeIds] = useState({
    customerId: "",
    subscriptionId: "",
  });
  const [createdWeddingId, setCreatedWeddingId] = useState("");
  const [isSuccess, setIsSuccess] = useState(
    new URLSearchParams(window.location.search).get("success") === "true",
  );
  const [settings, setSettings] = useState<any>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const stripeOptions = useMemo(
    () => ({ clientSecret, appearance: { theme: "stripe" as const } }),
    [clientSecret],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    supabase
      .from("portal_settings")
      .select("*")
      .single()
      .then(({ data }) => {
        if (data) setSettings(data);
      });
  }, []);

  useEffect(() => {
    if (isSuccess) {
      const urlParams = new URLSearchParams(window.location.search);
      const wId = urlParams.get("wedding_id") || createdWeddingId;
      if (wId) {
        const amountPaid =
          formData.paymentOption === "full"
            ? discountedPrice
            : formData.paymentOption === "half"
              ? halfDepositPrice
              : 99;
        api
          .fulfillDirectBookingPayment(wId, {
            paid_amount: amountPaid,
            stripe_customer_id: stripeIds.customerId || null,
            stripe_subscription_id: stripeIds.subscriptionId || null,
          })
          .catch(console.error);
      }
    }
  }, [isSuccess, createdWeddingId]);
  const updateForm = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAddon = (id: string) => {
    setFormData((prev) => {
      if (prev.addons.includes(id)) {
        return { ...prev, addons: prev.addons.filter((a) => a !== id) };
      }
      return { ...prev, addons: [...prev.addons, id] };
    });
  };

  const selectedPackage = PACKAGES.find((p) => p.id === formData.packageId);
  const selectedAddons = ADDONS.filter((a) => formData.addons.includes(a.id));
  const packagePrice = selectedPackage
    ? formData.coverageType === "photo"
      ? selectedPackage.priceSingle
      : formData.coverageType === "video"
        ? selectedPackage.priceSingle
        : selectedPackage.priceBoth
    : 0;
  const baseTotalPrice =
    packagePrice +
    selectedAddons.reduce((sum, a) => {
      if (a.id === "second_shooter")
        return sum + a.price * formData.secondShooterHours;
      return sum + a.price;
    }, 0);

  const discountAmount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? baseTotalPrice * (appliedCoupon.discount_value / 100)
      : appliedCoupon.discount_value
    : 0;
  const totalPrice = Math.max(0, baseTotalPrice - discountAmount);

  const payInFullDiscount = totalPrice * 0.05;
  const discountedPrice = totalPrice - payInFullDiscount;
  const halfDepositPrice = totalPrice / 2;

  const isWithin90Days = useMemo(() => {
    if (!formData?.weddingDate) return false;
    const [y, m, d] = formData.weddingDate.split("-").map(Number);
    const wedding = new Date(y, m - 1, d);
    const today = new Date();
    const diffTime = wedding.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 90;
  }, [formData?.weddingDate]);

  const isLongTerm = useMemo(() => {
    if (!formData?.weddingDate) return false;
    const [y, m, d] = formData.weddingDate.split("-").map(Number);
    const wedding = new Date(y, m - 1, d);
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    return wedding > oneYearFromNow;
  }, [formData?.weddingDate]);

  useEffect(() => {
    if (isWithin90Days && formData.paymentOption === "deposit") {
      setFormData((prev) => ({ ...prev, paymentOption: "half" }));
    }
  }, [isWithin90Days, formData.paymentOption]);

  const coverageLabel =
    formData.coverageType === "photo"
      ? "Photo Only"
      : formData.coverageType === "video"
        ? "Video Only"
        : "Photo & Video";
  const companyName = settings?.company_name || "Honeysuckle Haus";
  const companyLocation = settings?.company_location || "North Carolina";

  const handleApplyCoupon = async () => {
    if (!formData.couponCode) return;
    setIsValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", formData.couponCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !data) {
        toast({
          title: "Invalid Coupon",
          description: "This coupon code is invalid or has expired.",
          variant: "destructive",
        });
        setAppliedCoupon(null);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast({
          title: "Expired Coupon",
          description: "This coupon code has expired.",
          variant: "destructive",
        });
        setAppliedCoupon(null);
        return;
      }

      if (data.max_uses && data.current_uses >= data.max_uses) {
        toast({
          title: "Coupon Exhausted",
          description: "This coupon has reached its maximum number of uses.",
          variant: "destructive",
        });
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon(data);
      toast({
        title: "Coupon Applied",
        description: `Discount applied successfully.`,
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to validate coupon.",
        variant: "destructive",
      });
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleNextSubStep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (formStep === 0 && !formData.firstName) {
      toast({
        title: "Required",
        description: "Please enter your first name.",
        variant: "destructive",
      });
      return;
    }
    if (formStep === 1 && (!formData.email || !formData.phone)) {
      toast({
        title: "Required",
        description: "Please enter your email and phone.",
        variant: "destructive",
      });
      return;
    }
    if (formStep === 2 && !formData.weddingDate) {
      toast({
        title: "Required",
        description: "Please enter your wedding date.",
        variant: "destructive",
      });
      return;
    }
    if (
      formStep === 3 &&
      (!formData.venue ||
        !formData.venueAddress ||
        !formData.city ||
        !formData.state)
    ) {
      toast({
        title: "Required",
        description: "Please fill out all venue details.",
        variant: "destructive",
      });
      return;
    }

    if (formStep < 3) {
      setFormStep((s) => s + 1);
    } else {
      handleNext();
    }
  };

  const handlePrevSubStep = () => {
    if (formStep > 0) {
      setFormStep((s) => s - 1);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      if (
        !formData.firstName ||
        !formData.email ||
        !formData.phone ||
        !formData.weddingDate ||
        !formData.venue ||
        !formData.venueAddress ||
        !formData.city ||
        !formData.state
      ) {
        toast({
          title: "Required Fields",
          description: "Please fill out all required fields to continue.",
          variant: "destructive",
        });
        return;
      }
    }
    if (step === 2) {
      if (!formData.coverageType || !formData.packageId) {
        toast({
          title: "Incomplete Selection",
          description:
            "Please select your coverage type and a package to continue.",
          variant: "destructive",
        });
        return;
      }
    }
    if (step === 3) {
      const expectedSignature = `${formData.firstName} ${formData.lastName}`
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      const providedSignature = formData.signature
        ? formData.signature.trim().toLowerCase().replace(/\s+/g, " ")
        : "";
      if (!providedSignature || providedSignature !== expectedSignature) {
        toast({
          title: "Signature Required",
          description: `Please type your full name (${`${formData.firstName} ${formData.lastName}`.trim()}) to electronically sign.`,
          variant: "destructive",
        });
        return;
      }
      setIsSubmitting(true);
      try {
        let weddingId = createdWeddingId;

        const weddingPayload = {
          client_name: `${formData.firstName} ${formData.lastName}`.trim(),
          client_email: formData.email,
          partner_name: formData.partnerName,
          date: formData.weddingDate,
          location:
            `${formData.venue || ""} ${formData.venueAddress || ""} ${formData.city || ""}, ${formData.state || ""}`.trim(),
          package:
            `${selectedPackage?.name || "Custom"} (${coverageLabel})`.trim(),
          addons: formData.addons.map(
            (id) => ADDONS.find((a) => a.id === id)?.name || id,
          ),
          second_shooter_hours: formData.secondShooterHours,
          second_shooter_type: formData.secondShooterType,
          total_amount:
            formData.paymentOption === "full" ? discountedPrice : totalPrice,
          paid_amount: 0,
          status: "draft" as const,
          payment_plan: formData.paymentOption,
          contract_date: new Date().toISOString(),
          notes: `[UNPAID_DRAFT]\nPhone: ${formData.phone || "N/A"}\n${formData.notes || ""}`,
        };

        if (!weddingId) {
          const wedding = await api.createWedding(weddingPayload);
          weddingId = wedding.id;
          setCreatedWeddingId(wedding.id);
        } else {
          await api.updateWedding(weddingId, weddingPayload);
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
              amount: Math.round(
                formData.paymentOption === "full"
                  ? discountedPrice * 100
                  : formData.paymentOption === "half"
                    ? halfDepositPrice * 100
                    : 9900,
              ),
              paymentOption: formData.paymentOption,
              customerEmail: formData.email,
              customerName: `${formData.firstName} ${formData.lastName}`.trim(),
              description:
                formData.paymentOption === "full"
                  ? `Wedding Payment in Full for ${formData.firstName} ${formData.lastName}`
                  : formData.paymentOption === "half"
                    ? `Wedding 50% Deposit for ${formData.firstName} ${formData.lastName}`
                    : `Wedding Deposit for ${formData.firstName} ${formData.lastName}`,
              totalPrice:
                formData.paymentOption === "full"
                  ? discountedPrice
                  : totalPrice,
              weddingDate: formData.weddingDate,
              couponId: appliedCoupon?.id || null,
              weddingId: weddingId,
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Stripe Edge Function Error:", errorText);
          throw new Error(
            `Payment server error (${response.status}): ${errorText || "Function not found or failed"}`,
          );
        }

        const data = await response.json();

        if (!data?.clientSecret) {
          console.error("No client secret returned:", data);
          throw new Error(
            data?.error || "Invalid response from payment server",
          );
        }

        setClientSecret(data.clientSecret);
        if (data.customerId || data.subscriptionId) {
          setStripeIds({
            customerId: data.customerId || "",
            subscriptionId: data.subscriptionId || "",
          });
          if (weddingId) {
            api
              .updateWedding(weddingId, {
                stripe_customer_id: data.customerId || null,
                stripe_subscription_id: data.subscriptionId || null,
              })
              .catch(console.error);
          }
        }
        setStep(4);
      } catch (err: any) {
        console.error("Checkout initialization failed:", err);
        api.logAdminActivity(
          "Direct Booking Payment Error",
          `Failed to initialize checkout for ${formData.firstName} ${formData.lastName}: ${err.message}`,
          true,
        );
        toast({
          title: "Error",
          description:
            err.message || "Could not initialize payment. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step === 2) {
      setFormStep(3);
    }
    setStep((s) => s - 1);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#faf9f7] dark:bg-stone-950 flex items-center justify-center p-4 relative overflow-hidden">
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
            You're Booked!
          </h2>
          <div className="h-px w-16 bg-primary/20 mx-auto mb-6" />
          <p className="text-stone-500 dark:text-stone-400 mb-8 leading-relaxed text-lg font-light">
            Thank you,{" "}
            <span className="font-medium text-stone-900 dark:text-stone-100">
              {formData.firstName}
            </span>
            ! Your wedding date is now officially secured. We will be emailing
            and calling you shortly. If you prefer text, you can reply back to
            us saying that.
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
    <div className="min-h-screen bg-[#faf9f7] dark:bg-stone-950 py-16 px-4 font-sans text-stone-800 dark:text-stone-200 transition-colors duration-500 relative overflow-hidden">
      {/* Decorative Background */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-stone-200/40 dark:bg-stone-800/30 blur-[120px]" />
        <div className="absolute top-[50%] -right-[10%] w-[50%] h-[50%] rounded-full bg-stone-200/40 dark:bg-stone-800/30 blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <img
            src={settings?.logo_url || DEFAULT_LOGO_URL}
            alt="Logo"
            className="h-14 mx-auto mb-8 object-contain opacity-90"
          />
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 dark:text-stone-50 mb-4 tracking-tight">
            Book Your Wedding
          </h1>
          <p className="text-stone-500 dark:text-stone-400 max-w-md mx-auto font-light tracking-wide">
            Secure your date in just a few elegant steps.
          </p>
        </div>

        <div className="flex flex-wrap gap-y-4 items-center justify-center mb-16 space-x-2 sm:space-x-4">
          {[1, 2, 3, 4].map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border transition-all duration-500 shrink-0 ${step >= s ? "border-stone-900 bg-stone-900 text-stone-50 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900" : "border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500 bg-transparent"}`}
              >
                {step > s ? (
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <span className="font-serif text-base sm:text-lg">{s}</span>
                )}
              </div>
              {i < 3 && (
                <div
                  className={`w-6 sm:w-12 h-[1px] transition-all duration-500 ${step > s ? "bg-stone-900 dark:bg-stone-100" : "bg-stone-300 dark:bg-stone-700"}`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white dark:bg-stone-900/50 rounded-2xl shadow-sm border border-stone-200/50 dark:border-stone-800/50 p-5 sm:p-8 md:p-12 transition-all duration-500">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <form
                onSubmit={handleNextSubStep}
                className="min-h-[400px] flex flex-col justify-center"
              >
                {formStep === 0 && (
                  <div
                    key="step0"
                    className="animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-both"
                  >
                    <div className="mb-10 text-center">
                      <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3 min-h-[4.5rem] sm:min-h-[3rem]">
                        <TypewriterText text="Let's start with your names." />
                      </h2>
                      <p className="text-stone-500 dark:text-stone-400 font-light text-lg">
                        Who is getting married?
                      </p>
                    </div>
                    <div className="space-y-6 max-w-md mx-auto w-full">
                      <div className="space-y-2">
                        <Label className="text-stone-500 ml-1">
                          Your First Name *
                        </Label>
                        <Input
                          className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                          value={formData.firstName}
                          onChange={(e) =>
                            updateForm("firstName", e.target.value)
                          }
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-stone-500 ml-1">
                          Your Last Name
                        </Label>
                        <Input
                          className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                          value={formData.lastName}
                          onChange={(e) =>
                            updateForm("lastName", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-stone-500 ml-1">
                          Partner's Name
                        </Label>
                        <Input
                          className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                          value={formData.partnerName}
                          onChange={(e) =>
                            updateForm("partnerName", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formStep === 1 && (
                  <div
                    key="step1"
                    className="animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-both"
                  >
                    <div className="mb-10 text-center">
                      <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3 min-h-[4.5rem] sm:min-h-[3rem]">
                        <TypewriterText
                          text={`Beautiful. How can we reach you${formData.firstName ? ", " + formData.firstName : ""}?`}
                        />
                      </h2>
                      <p className="text-stone-500 dark:text-stone-400 font-light text-lg">
                        For your contract and portal access.
                      </p>
                    </div>
                    <div className="space-y-6 max-w-md mx-auto w-full">
                      <div className="space-y-2">
                        <Label className="text-stone-500 ml-1">
                          Email Address *
                        </Label>
                        <Input
                          type="email"
                          className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                          value={formData.email}
                          onChange={(e) => updateForm("email", e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-stone-500 ml-1">
                          Phone Number *
                        </Label>
                        <Input
                          type="tel"
                          className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                          value={formData.phone}
                          onChange={(e) => updateForm("phone", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formStep === 2 && (
                  <div
                    key="step2"
                    className="animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-both"
                  >
                    <div className="mb-10 text-center">
                      <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3 min-h-[4.5rem] sm:min-h-[3rem]">
                        <TypewriterText text="When is the big day?" />
                      </h2>
                      <p className="text-stone-500 dark:text-stone-400 font-light text-lg">
                        Let's make sure we're available.
                      </p>
                    </div>
                    <div className="max-w-md mx-auto w-full">
                      <div className="space-y-2">
                        <Label className="text-stone-500 ml-1">
                          Wedding Date *
                        </Label>
                        <Input
                          type="date"
                          className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                          value={formData.weddingDate}
                          onChange={(e) =>
                            updateForm("weddingDate", e.target.value)
                          }
                          autoFocus
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formStep === 3 && (
                  <div
                    key="step3"
                    className="animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-both"
                  >
                    <div className="mb-10 text-center">
                      <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3 min-h-[4.5rem] sm:min-h-[3rem]">
                        <TypewriterText text="And where will it be?" />
                      </h2>
                      <p className="text-stone-500 dark:text-stone-400 font-light text-lg">
                        The venue and location details.
                      </p>
                    </div>
                    <div className="space-y-6 max-w-md mx-auto w-full">
                      <div className="space-y-2">
                        <Label className="text-stone-500 ml-1">
                          Venue Name *
                        </Label>
                        <Input
                          className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                          value={formData.venue}
                          onChange={(e) => updateForm("venue", e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-stone-500 ml-1">
                          Venue Address *
                        </Label>
                        <Input
                          className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                          value={formData.venueAddress}
                          onChange={(e) =>
                            updateForm("venueAddress", e.target.value)
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-stone-500 ml-1">City *</Label>
                          <Input
                            className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                            value={formData.city}
                            onChange={(e) => updateForm("city", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-stone-500 ml-1">State *</Label>
                          <Input
                            className="text-xl py-6 bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                            value={formData.state}
                            onChange={(e) =>
                              updateForm("state", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-12 flex justify-between items-center max-w-md mx-auto w-full">
                  {formStep > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handlePrevSubStep}
                      className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-50 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button
                    type="submit"
                    className="bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 px-8 py-6 rounded-xl text-lg font-medium transition-all group"
                  >
                    {formStep === 3 ? "Continue to Packages" : "Next"}{" "}
                    <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mb-12 text-center">
                <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3">
                  <TypewriterText text="Choose your coverage." />
                </h2>
                <p className="text-stone-500 dark:text-stone-400 font-light text-lg">
                  Tailored to capture every moment.
                </p>
              </div>

              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {["photo", "video", "both"].map((type) => (
                    <div
                      key={type}
                      onClick={() => updateForm("coverageType", type)}
                      className={`cursor-pointer rounded-2xl p-8 text-center transition-all duration-300 border ${formData.coverageType === type ? "bg-stone-900 text-stone-50 border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 shadow-lg scale-105" : "bg-white border-stone-100 text-stone-800 hover:border-stone-300 dark:bg-stone-900/50 dark:border-stone-800 dark:text-stone-200"}`}
                    >
                      <h3 className="text-xl font-serif mb-2 uppercase tracking-widest">
                        {type === "both"
                          ? "Photo & Video"
                          : type === "photo"
                            ? "Photography"
                            : "Videography"}
                      </h3>
                      <p className="text-xs opacity-70 font-light tracking-wide">
                        {type === "both"
                          ? "The complete experience"
                          : "Focused coverage"}
                      </p>
                    </div>
                  ))}
                </div>

                {formData.coverageType && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
                    <h3 className="font-serif text-xl mb-6 text-stone-800 dark:text-stone-200">
                      Select a Package
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {PACKAGES.filter((p) => !p.isArchived).map((pkg) => {
                        const price =
                          formData.coverageType === "both"
                            ? pkg.priceBoth
                            : pkg.priceSingle;
                        return (
                          <div
                            key={pkg.id}
                            onClick={() => updateForm("packageId", pkg.id)}
                            className={`cursor-pointer rounded-2xl p-5 sm:p-8 transition-all duration-300 ${formData.packageId === pkg.id ? "bg-stone-50 border border-stone-300 shadow-sm dark:bg-stone-800/80 dark:border-stone-600" : "bg-white border border-stone-100 hover:border-stone-300 dark:bg-stone-900/50 dark:border-stone-800/50 dark:hover:border-stone-700"}`}
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-2 sm:gap-0">
                              <div>
                                <h3 className="font-serif text-2xl text-stone-900 dark:text-stone-50">
                                  {pkg.name}
                                </h3>
                                <p className="text-sm text-stone-500 dark:text-stone-400 font-light tracking-wide uppercase mt-1">
                                  {pkg.desc}
                                </p>
                              </div>
                              <span className="font-serif text-2xl text-stone-900 dark:text-stone-50">
                                ${price.toLocaleString()}
                              </span>
                            </div>

                            <div className="space-y-6 text-sm mt-6 border-t border-stone-100 dark:border-stone-800 pt-6">
                              {(formData.coverageType === "both" ||
                                formData.coverageType === "photo") && (
                                <div className="space-y-3">
                                  <span className="font-serif text-sm italic text-stone-500 dark:text-stone-400">
                                    Photography
                                  </span>
                                  <ul className="space-y-2">
                                    {pkg.photoFeatures.map((f, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start text-stone-600 dark:text-stone-300 font-light"
                                      >
                                        <div className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600 mr-3 mt-1.5 shrink-0" />
                                        <span>{f}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(formData.coverageType === "both" ||
                                formData.coverageType === "video") && (
                                <div className="space-y-3">
                                  <span className="font-serif text-sm italic text-stone-500 dark:text-stone-400">
                                    Videography
                                  </span>
                                  <ul className="space-y-2">
                                    {pkg.videoFeatures.map((f, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start text-stone-600 dark:text-stone-300 font-light"
                                      >
                                        <div className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600 mr-3 mt-1.5 shrink-0" />
                                        <span>{f}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formData.packageId && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both space-y-12">
                    <div>
                      <h3 className="font-serif text-xl mb-6 text-stone-800 dark:text-stone-200">
                        Enhance Your Package (Optional)
                      </h3>
                      <div className="space-y-4">
                        {ADDONS.filter((a) => !a.isArchived).map((addon) => (
                          <div
                            key={addon.id}
                            className="flex flex-col p-4 sm:p-5 rounded-2xl border border-stone-100 hover:border-stone-300 dark:border-stone-800/50 dark:hover:border-stone-700 transition-colors bg-white dark:bg-stone-900/30"
                          >
                            <div className="flex items-center space-x-3 sm:space-x-4">
                              <Checkbox
                                id={addon.id}
                                checked={formData.addons.includes(addon.id)}
                                onCheckedChange={() => toggleAddon(addon.id)}
                                className="border-stone-300 data-[state=checked]:bg-stone-900 data-[state=checked]:text-stone-50"
                              />
                              <div className="flex-1">
                                <label
                                  htmlFor={addon.id}
                                  className="text-stone-800 dark:text-stone-200 font-medium leading-none cursor-pointer text-sm sm:text-base"
                                >
                                  {addon.name}{" "}
                                  <span className="text-stone-500 font-light text-xs sm:text-sm ml-1 block sm:inline mt-1 sm:mt-0">
                                    {addon.isHourly &&
                                      `($${addon.price}/hr, ${addon.minHours}-hr min)`}
                                  </span>
                                </label>
                              </div>
                              <div className="text-sm font-serif text-stone-900 dark:text-stone-50 whitespace-nowrap">
                                +$
                                {addon.isHourly
                                  ? addon.price * formData.secondShooterHours
                                  : addon.price}
                              </div>
                            </div>

                            {(addon.id === "second_shooter" ||
                              addon.id === "second_shooter_new") &&
                              formData.addons.includes(addon.id) && (
                                <div className="mt-4 ml-0 sm:ml-7 pl-4 border-l-2 space-y-4 animate-in fade-in slide-in-from-top-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                      Second Shooter Role
                                    </Label>
                                    <Select
                                      value={formData.secondShooterType}
                                      onValueChange={(v) =>
                                        updateForm("secondShooterType", v)
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-sm bg-background">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="photo">
                                          Photographer
                                        </SelectItem>
                                        <SelectItem value="video">
                                          Videographer
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {addon.id === "second_shooter" && (
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">
                                        Hours of Coverage
                                      </Label>
                                      <div className="flex items-center space-x-4">
                                        <Input
                                          type="number"
                                          min={3}
                                          max={10}
                                          value={formData.secondShooterHours}
                                          onChange={(e) =>
                                            updateForm(
                                              "secondShooterHours",
                                              parseInt(e.target.value),
                                            )
                                          }
                                          className="w-20 h-8"
                                        />
                                        <span className="text-xs text-stone-500">
                                          hours
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-12 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center">
                      <Button
                        variant="ghost"
                        onClick={handleBack}
                        className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-50 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button
                        onClick={handleNext}
                        className="bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 px-10 py-6 rounded-xl text-lg font-medium transition-all group"
                      >
                        Review & Sign{" "}
                        <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mb-12 text-center">
                <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3">
                  <TypewriterText text="Review & Signature." />
                </h2>
                <p className="text-stone-500 dark:text-stone-400 font-light text-lg">
                  Finalize your details and sign the agreement.
                </p>
              </div>

              <div className="max-w-4xl mx-auto space-y-16">
                <div className="space-y-16">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 bg-stone-50/50 dark:bg-stone-900/30 p-8 sm:p-10 rounded-2xl border border-stone-100 dark:border-stone-800/50">
                    <div>
                      <Label className="text-[10px] uppercase tracking-widest text-stone-400 mb-2 block">
                        Wedding Date
                      </Label>
                      <p className="font-serif text-lg text-stone-900 dark:text-stone-50">
                        {formatDisplayDate(formData.weddingDate)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-widest text-stone-400 mb-2 block">
                        Venue
                      </Label>
                      <p className="font-serif text-lg text-stone-900 dark:text-stone-50">
                        {formData.venue}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-widest text-stone-400 mb-2 block">
                        Coverage
                      </Label>
                      <p className="font-serif text-lg text-stone-900 dark:text-stone-50">
                        {coverageLabel}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-widest text-stone-400 mb-2 block">
                        Package
                      </Label>
                      <p className="font-serif text-lg text-stone-900 dark:text-stone-50">
                        {selectedPackage?.name}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="mb-8 p-6 bg-stone-50 dark:bg-stone-900/50 border rounded-2xl flex items-center justify-between gap-6">
                      <div className="flex-1">
                        <Label
                          htmlFor="coupon"
                          className="text-stone-700 dark:text-stone-300"
                        >
                          Have a discount code?
                        </Label>
                        <div className="flex mt-2 gap-2">
                          <Input
                            id="coupon"
                            placeholder="Enter code"
                            value={formData.couponCode}
                            onChange={(e) =>
                              updateForm(
                                "couponCode",
                                e.target.value.toUpperCase(),
                              )
                            }
                            className="uppercase"
                            disabled={!!appliedCoupon || isValidatingCoupon}
                          />
                          {appliedCoupon ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setAppliedCoupon(null);
                                updateForm("couponCode", "");
                              }}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          ) : (
                            <Button
                              onClick={handleApplyCoupon}
                              disabled={
                                !formData.couponCode || isValidatingCoupon
                              }
                            >
                              {isValidatingCoupon ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Apply"
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      {appliedCoupon && (
                        <div className="text-right">
                          <p className="text-sm text-stone-500">Discount</p>
                          <p className="text-lg font-semibold text-green-600">
                            -
                            {appliedCoupon.discount_type === "percentage"
                              ? `${appliedCoupon.discount_value}%`
                              : `$${appliedCoupon.discount_value}`}
                          </p>
                        </div>
                      )}
                    </div>
                    <Label className="text-xl font-serif text-stone-900 dark:text-stone-50">
                      Payment Option
                    </Label>
                    <RadioGroup
                      value={formData.paymentOption}
                      onValueChange={(v) => updateForm("paymentOption", v)}
                      className={`grid grid-cols-1 ${!isWithin90Days ? (isLongTerm ? "md:grid-cols-2 lg:grid-cols-2" : "md:grid-cols-3") : "md:grid-cols-2"} gap-8`}
                    >
                      {!isWithin90Days && (
                        <div
                          className={`border rounded-3xl p-6 sm:p-8 cursor-pointer flex items-start space-x-3 sm:space-x-4 transition-all duration-300 ${formData.paymentOption === "deposit" ? "bg-stone-50 border-stone-300 shadow-sm dark:bg-stone-800/80 dark:border-stone-600" : "bg-white border-stone-100 hover:border-stone-300 dark:bg-stone-900/30 dark:border-stone-800/50 dark:hover:border-stone-700"}`}
                          onClick={() => updateForm("paymentOption", "deposit")}
                        >
                          <RadioGroupItem
                            value="deposit"
                            id="deposit"
                            className="mt-1 border-stone-300 text-stone-900 shrink-0"
                          />
                          <div>
                            <Label
                              htmlFor="deposit"
                              className="font-serif text-lg cursor-pointer text-stone-900 dark:text-stone-50 flex items-center flex-wrap gap-2"
                            >
                              Pay Deposit ($99)
                            </Label>
                            <p className="text-sm font-light text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
                              Remaining balance paid at $250/month
                              automatically.
                            </p>
                            {formData.paymentOption === "deposit" && (
                              <div className="mt-4 space-y-1.5 border-t border-stone-200 dark:border-stone-800 pt-3">
                                <p className="text-xs font-medium text-stone-900 dark:text-stone-50 mb-2">
                                  Upcoming Schedule:
                                </p>
                                {generatePaymentSchedule(
                                  totalPrice,
                                  "deposit",
                                  formData.weddingDate,
                                  new Date().toISOString(),
                                  0,
                                  null,
                                )
                                  .slice(0, 3)
                                  .map((payment, i) => (
                                    <div
                                      key={i}
                                      className="flex justify-between text-xs text-stone-500 dark:text-stone-400"
                                    >
                                      <span>{payment.date}</span>
                                      <span>
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
                                  totalPrice,
                                  "deposit",
                                  formData.weddingDate,
                                  new Date().toISOString(),
                                  0,
                                  null,
                                ).length > 3 && (
                                  <p className="text-[10px] text-stone-400 mt-1 italic text-right">
                                    ...plus remaining installments
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!isWithin90Days && isLongTerm && (
                        <div
                          className={`border rounded-3xl p-6 sm:p-8 cursor-pointer flex items-start space-x-3 sm:space-x-4 transition-all duration-300 ${formData.paymentOption === "quarterly" ? "bg-stone-50 border-stone-300 shadow-sm dark:bg-stone-800/80 dark:border-stone-600" : "bg-white border-stone-100 hover:border-stone-300 dark:bg-stone-900/30 dark:border-stone-800/50 dark:hover:border-stone-700"}`}
                          onClick={() =>
                            updateForm("paymentOption", "quarterly")
                          }
                        >
                          <RadioGroupItem
                            value="quarterly"
                            id="quarterly"
                            className="mt-1 border-stone-300 text-stone-900 shrink-0"
                          />
                          <div>
                            <Label
                              htmlFor="quarterly"
                              className="font-serif text-lg cursor-pointer text-stone-900 dark:text-stone-50 flex items-center flex-wrap gap-2"
                            >
                              Quarterly Plan ($99)
                            </Label>
                            <p className="text-sm font-light text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
                              Remaining balance paid at $250 every 3 months
                              automatically.
                            </p>
                            {formData.paymentOption === "quarterly" && (
                              <div className="mt-4 space-y-1.5 border-t border-stone-200 dark:border-stone-800 pt-3">
                                <p className="text-xs font-medium text-stone-900 dark:text-stone-50 mb-2">
                                  Upcoming Schedule:
                                </p>
                                {generatePaymentSchedule(
                                  totalPrice,
                                  "quarterly",
                                  formData.weddingDate,
                                  new Date().toISOString(),
                                  0,
                                  null,
                                )
                                  .slice(0, 3)
                                  .map((payment, i) => (
                                    <div
                                      key={i}
                                      className="flex justify-between text-xs text-stone-500 dark:text-stone-400"
                                    >
                                      <span>{payment.date}</span>
                                      <span>
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
                                  totalPrice,
                                  "quarterly",
                                  formData.weddingDate,
                                  new Date().toISOString(),
                                  0,
                                  null,
                                ).length > 3 && (
                                  <p className="text-[10px] text-stone-400 mt-1 italic text-right">
                                    ...plus remaining installments
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div
                        className={`border rounded-3xl p-6 sm:p-8 cursor-pointer flex items-start space-x-3 sm:space-x-4 transition-all duration-300 ${formData.paymentOption === "half" ? "bg-stone-50 border-stone-300 shadow-sm dark:bg-stone-800/80 dark:border-stone-600" : "bg-white border-stone-100 hover:border-stone-300 dark:bg-stone-900/30 dark:border-stone-800/50 dark:hover:border-stone-700"}`}
                        onClick={() => updateForm("paymentOption", "half")}
                      >
                        <RadioGroupItem
                          value="half"
                          id="half"
                          className="mt-1 border-stone-300 text-stone-900 shrink-0"
                        />
                        <div>
                          <Label
                            htmlFor="half"
                            className="font-serif text-lg cursor-pointer text-stone-900 dark:text-stone-50"
                          >
                            50% Deposit
                          </Label>
                          <p className="text-sm font-light text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
                            Pay 50% now, remainder automatically charged 10 days
                            before the wedding.
                          </p>
                          {formData.paymentOption === "half" && (
                            <div className="mt-4 space-y-1.5 border-t border-stone-200 dark:border-stone-800 pt-3">
                              <p className="text-xs font-medium text-stone-900 dark:text-stone-50 mb-2">
                                Upcoming Schedule:
                              </p>
                              {generatePaymentSchedule(
                                totalPrice,
                                "half",
                                formData.weddingDate,
                                new Date().toISOString(),
                                0,
                                null,
                              ).map((payment, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between text-xs text-stone-500 dark:text-stone-400"
                                >
                                  <span>{payment.date}</span>
                                  <span>
                                    $
                                    {payment.amount.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className={`border rounded-3xl p-6 sm:p-8 cursor-pointer flex items-start space-x-3 sm:space-x-4 transition-all duration-300 ${formData.paymentOption === "full" ? "bg-stone-50 border-stone-300 shadow-sm dark:bg-stone-800/80 dark:border-stone-600" : "bg-white border-stone-100 hover:border-stone-300 dark:bg-stone-900/30 dark:border-stone-800/50 dark:hover:border-stone-700"}`}
                        onClick={() => updateForm("paymentOption", "full")}
                      >
                        <RadioGroupItem
                          value="full"
                          id="full"
                          className="mt-1 border-stone-300 text-stone-900 shrink-0"
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor="full"
                            className="font-serif text-lg cursor-pointer text-stone-900 dark:text-stone-50 flex items-center flex-wrap gap-2 sm:gap-3"
                          >
                            Pay in Full (${discountedPrice.toLocaleString()})
                            <Badge
                              variant="secondary"
                              className="bg-stone-200 text-stone-800 hover:bg-stone-200 border-none font-sans font-medium text-xs"
                            >
                              Save 5%
                            </Badge>
                          </Label>
                          <p className="text-sm font-light text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
                            Save ${payInFullDiscount.toLocaleString()} by paying
                            today. Klarna available at checkout.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="border border-stone-200 dark:border-stone-800 rounded-3xl p-8 sm:p-12 h-[600px] overflow-y-auto bg-white dark:bg-stone-900/30 text-sm space-y-8 contract-content mt-12 shadow-inner">
                    <h2 className="text-2xl font-serif text-center mb-2 text-stone-900 dark:text-stone-50">
                      Wedding Photography & Videography Agreement
                    </h2>
                    <p className="text-center text-stone-500 dark:text-stone-400 font-light mb-8">
                      ({companyName} — {companyLocation})
                    </p>

                    <p>
                      This Wedding Agreement ("Agreement") is entered into on{" "}
                      <strong>
                        {formatDisplayDate(new Date().toISOString())}
                      </strong>{" "}
                      by and between:
                    </p>
                    <p>
                      <strong>Client(s):</strong> {formData.firstName}{" "}
                      {formData.lastName}{" "}
                      {formData.partnerName ? `& ${formData.partnerName}` : ""}
                    </p>
                    <p>
                      <strong>Service Provider:</strong> {companyName}, an
                      independently owned and operated limited liability company
                      based in {companyLocation} ("Photographer/Videographer").
                    </p>

                    <h3 className="text-lg font-serif mt-8">1. Services</h3>
                    <p>
                      {companyName} agrees to provide professional wedding
                      photography and/or videography services for the Client's
                      event as follows:
                    </p>
                    <p>
                      <strong>Wedding Date:</strong>{" "}
                      {formatDisplayDate(formData.weddingDate)}
                    </p>
                    <p>
                      <strong>Venue:</strong> {formData.venue}{" "}
                      {formData.venueAddress}
                    </p>
                    <p>
                      <strong>Package Booked:</strong> {selectedPackage?.name} (
                      {selectedPackage?.desc})
                    </p>
                    {selectedAddons.length > 0 && (
                      <p>
                        <strong>Add-ons:</strong>{" "}
                        {selectedAddons
                          .map((a) =>
                            a.id === "second_shooter"
                              ? `${a.name} (${formData.secondShooterHours} hrs - ${formData.secondShooterType === "video" ? "Videographer" : "Photographer"})`
                              : a.id === "second_shooter_new"
                                ? `${a.name} (${formData.secondShooterType === "video" ? "Videographer" : "Photographer"})`
                                : a.name,
                          )
                          .join(", ")}
                      </p>
                    )}
                    <p>
                      <strong>Assigned Team:</strong>{" "}
                      {formData.coverageType === "photo"
                        ? "1 Photographer"
                        : formData.coverageType === "video"
                          ? "1 Videographer"
                          : "1 Photographer + 1 Videographer"}{" "}
                      (unless otherwise noted)
                    </p>
                    <p>
                      {companyName} reserves the right to assign qualified
                      creative professionals from its trusted network to ensure
                      timely, high-quality coverage.
                    </p>

                    <h3 className="text-lg font-serif mt-8">2. Deliverables</h3>
                    <p>
                      The Photographer/Videographer agrees to deliver the
                      following:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 mt-2">
                      {formData.coverageType !== "video" && (
                        <li>Professionally edited digital photo gallery</li>
                      )}
                      {formData.coverageType !== "photo" && (
                        <li>
                          Edited wedding film (highlight + optional
                          documentary/full ceremony edits, depending on package)
                        </li>
                      )}
                    </ul>
                    <p className="mt-4">
                      <strong>Delivery Timeline:</strong> Within approximately
                      3–4 weeks following the wedding date. During high-volume
                      months (such as October), timelines may extend slightly to
                      maintain editing quality.
                    </p>

                    <h3 className="text-lg font-serif mt-8">
                      3. Payment Terms
                    </h3>
                    <p>
                      <strong>Total Investment:</strong> $
                      {totalPrice.toLocaleString()}
                    </p>

                    <p>
                      <strong>Retainer (Non-Refundable):</strong> $
                      {(totalPrice / 2).toLocaleString()} due upon signing to
                      reserve your wedding date. The retainer is 50% of the
                      contract value.
                    </p>

                    <p>
                      <strong>Remaining Balance:</strong> Due no later than 10
                      days before the wedding date.
                    </p>
                    <p>
                      <strong>Accepted Payments:</strong> Credit Card only
                      (processed securely through {companyName}'s online payment
                      system).
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

                    <h3 className="text-lg font-serif mt-8">
                      4. Rescheduling & Cancellation
                    </h3>
                    <p>
                      <strong>Rescheduling:</strong> The retainer may be applied
                      to a new wedding date, subject to availability.
                    </p>
                    <p>
                      <strong>Cancellation:</strong> The retainer is
                      non-refundable. Any additional payments made beyond the
                      retainer will be refunded if cancellation occurs.
                    </p>
                    <p>
                      If {companyName} must cancel due to emergency or
                      unforeseen circumstances, all payments made by the Client
                      will be refunded in full, and best efforts will be made to
                      assist in finding an alternate provider.
                    </p>

                    <h3 className="text-lg font-serif mt-8">
                      5. Creative Rights
                    </h3>
                    <p>
                      The Client acknowledges that {companyName} maintains
                      complete creative control over style, editing, and
                      artistic decisions. The Client has reviewed the company's
                      portfolio and understands the creative nature of the work.
                    </p>
                    <p>
                      All photographs and videos remain the copyrighted property
                      of {companyName}, which grants the Client a perpetual,
                      non-exclusive, personal-use license to download, print,
                      share, and display the media for personal use.
                    </p>

                    <h3 className="text-lg font-serif mt-8">
                      6. Substitutions & Liability
                    </h3>
                    <p>
                      If a scheduled Photographer or Videographer is unable to
                      attend due to illness, emergency, or unforeseen event,{" "}
                      {companyName} will provide a qualified replacement
                      whenever possible.
                    </p>
                    <p>
                      {companyName} is not responsible for circumstances beyond
                      reasonable control (e.g., weather, equipment failure,
                      venue restrictions, or interference by guests).
                      <br />
                      Liability is limited to the return of all payments
                      received.
                    </p>

                    <h3 className="text-lg font-serif mt-8">
                      7. Client Cooperation
                    </h3>
                    <p>
                      The Client agrees to provide a safe and cooperative
                      environment for all team members. The Client understands
                      that full cooperation—including adherence to schedules,
                      communication, and participation from key
                      individuals—directly impacts the final quality of results.
                    </p>

                    <h3 className="text-lg font-serif mt-8">
                      8. Model Release
                    </h3>
                    <p>
                      The Client grants {companyName} permission to use images
                      and/or video clips from the event for portfolio, social
                      media, website, and promotional use.
                      <br />
                      (Optional: Clients may request in writing to opt out prior
                      to the wedding date.)
                    </p>

                    <h3 className="text-lg font-serif mt-8">
                      9. Entire Agreement
                    </h3>
                    <p>
                      This Agreement represents the full understanding between
                      the Client and {companyName}. Any modifications or
                      additions must be made in writing and signed by both
                      parties.
                    </p>
                  </div>

                  <div className="space-y-4 max-w-md">
                    <Label className="text-stone-500">
                      Type Full Name to Sign *
                    </Label>
                    <Input
                      placeholder={`${formData.firstName} ${formData.lastName}`.trim()}
                      className="text-xl py-6 font-serif italic bg-stone-50/50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-stone-900"
                      value={formData.signature}
                      onChange={(e) => updateForm("signature", e.target.value)}
                    />
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest">
                      Digital Signature Verification
                    </p>
                  </div>
                </div>

                <div className="mt-12">
                  <Card className="border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-900/30 shadow-sm overflow-hidden rounded-3xl">
                    <CardHeader className="border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900/50 p-8">
                      <CardTitle className="font-serif text-xl">
                        Investment Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">
                          {selectedPackage?.name} Package
                        </span>
                        <span className="font-medium">
                          ${packagePrice.toLocaleString()}
                        </span>
                      </div>
                      {selectedAddons.map((addon) => (
                        <div
                          key={addon.id}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-stone-500">
                            {addon.name}{" "}
                            {addon.id === "second_shooter"
                              ? `(${formData.secondShooterHours} hrs - ${formData.secondShooterType === "video" ? "Videographer" : "Photographer"})`
                              : ""}
                          </span>
                          <span className="font-medium">
                            +$
                            {addon.isHourly
                              ? addon.price * formData.secondShooterHours
                              : addon.price}
                          </span>
                        </div>
                      ))}
                      <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-between">
                        <span className="font-serif">Subtotal</span>
                        <span className="font-serif font-bold">
                          ${totalPrice.toLocaleString()}
                        </span>
                      </div>
                      {formData.paymentOption === "full" && (
                        <div className="flex justify-between text-green-600 dark:text-green-500 text-sm italic">
                          <span>Pay in Full Discount (5%)</span>
                          <span>-${payInFullDiscount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="pt-6 border-t border-stone-100 dark:border-stone-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-stone-900 dark:text-stone-50 font-medium">
                            Due Today
                          </span>
                          <span className="text-2xl font-serif text-stone-900 dark:text-stone-50">
                            {formData.paymentOption === "full"
                              ? "$" + discountedPrice.toLocaleString()
                              : formData.paymentOption === "half"
                                ? "$" + halfDepositPrice.toLocaleString()
                                : "$99.00"}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-widest text-right">
                          Non-refundable retainer
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-white dark:bg-stone-900/50 p-8">
                      <Button
                        onClick={handleNext}
                        disabled={isSubmitting || !formData.signature}
                        className="w-full bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 py-8 rounded-xl font-medium transition-all text-lg"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : null}
                        {isSubmitting
                          ? "Initializing..."
                          : "Sign & Proceed to Payment"}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </div>

              <div className="mt-12 pt-12 border-t border-stone-100 dark:border-stone-800">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Packages
                </Button>
              </div>
            </div>
          )}

          {step === 4 && clientSecret && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-xl mx-auto">
              <div className="mb-12 text-center">
                <h2 className="text-3xl md:text-4xl font-serif text-stone-900 dark:text-stone-50 mb-3">
                  <TypewriterText text="Secure your date." />
                </h2>
                <p className="text-stone-500 dark:text-stone-400 font-light text-lg">
                  Finalize your booking with a secure payment.
                </p>
              </div>

              <Elements stripe={stripePromise} options={stripeOptions}>
                <CheckoutForm
                  clientSecret={clientSecret}
                  clientName={`${formData.firstName} ${formData.lastName}`}
                  companyName={companyName}
                  weddingDate={formData.weddingDate}
                  totalPrice={
                    formData.paymentOption === "full"
                      ? discountedPrice
                      : totalPrice
                  }
                  paymentOption={formData.paymentOption}
                  setIsSubmitting={setIsSubmitting}
                  isSubmitting={isSubmitting}
                  createdWeddingId={createdWeddingId}
                  onSuccess={async () => {
                    setIsSuccess(true);
                    confetti({
                      particleCount: 100,
                      spread: 70,
                      origin: { y: 0.6 },
                    });
                    toast({
                      title: "Booking Successful",
                      description: "Your wedding has been secured!",
                    });

                    const amountPaid =
                      formData.paymentOption === "full"
                        ? discountedPrice
                        : formData.paymentOption === "half"
                          ? totalPrice / 2
                          : 99;

                    if (createdWeddingId) {
                      try {
                        await api.updateWedding(createdWeddingId, {
                          paid_amount: amountPaid,
                          status: "pending",
                          contract_date: new Date().toISOString(),
                          notes: (formData.notes || "")
                            .replace("[UNPAID_DRAFT]\n", "")
                            .replace("[UNPAID_DRAFT]", ""),
                          stripe_customer_id: stripeIds.customerId || null,
                          stripe_subscription_id:
                            stripeIds.subscriptionId || null,
                        } as any);
                      } catch (e) {
                        console.error(
                          "Failed to update wedding status on success:",
                          e,
                        );
                      }
                    }

                    const pkgName = selectedPackage?.name || "Custom Package";
                    const addonsList = selectedAddons.map(
                      (id) => ADDONS.find((a) => a.id === id.id)?.name || id.id,
                    );
                    const receiptHtml = generateHTMLReceipt(
                      companyName,
                      `${formData.firstName} ${formData.lastName}`,
                      amountPaid,
                      formData.paymentOption,
                      pkgName,
                      addonsList,
                      totalPrice,
                    );

                    try {
                      await api.sendOvantaEmail(
                        formData.email,
                        `Payment Receipt - ${companyName}`,
                        receiptHtml,
                        `${formData.firstName} ${formData.lastName}`,
                        true,
                      );
                    } catch (err) {
                      console.error("Failed to send receipt:", err);
                    }
                  }}
                />
              </Elements>

              <div className="mt-12 pt-8 border-t border-stone-100 dark:border-stone-800 text-center">
                <p className="text-xs text-stone-400 flex items-center justify-center gap-2 uppercase tracking-widest">
                  <Shield className="w-3 h-3" /> Secure SSL Encrypted Checkout
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Shield({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
