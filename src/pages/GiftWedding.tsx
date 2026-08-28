import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Heart, Gift, ArrowRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ... keep existing code (STYLING TOKENS)

export default function GiftWedding() {
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [wedding, setWedding] = useState<any>(null);
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWedding() {
      if (!id) return;

      // Try fetching by UUID first
      let { data, error } = await supabase
        .from("weddings")
        .select(
          "id, client_name, partner_name, date, total_amount, paid_amount, payment_plan, stripe_customer_id",
        )
        .eq("id", id)
        .maybeSingle();

      // Fallback: If not found or not a valid UUID, try searching by stripe_customer_id
      if (!data) {
        const { data: stripeData, error: stripeError } = await supabase
          .from("weddings")
          .select(
            "id, client_name, partner_name, date, total_amount, paid_amount, payment_plan, stripe_customer_id",
          )
          .eq("stripe_customer_id", id)
          .maybeSingle();

        if (stripeData) {
          data = stripeData;
          error = null;
        }
      }

      if (error || !data) {
        toast({
          variant: "destructive",
          title: "Wedding Not Found",
          description:
            "We couldn't find a wedding matching this link. Please check with the couple.",
        });
      } else {
        setWedding(data);
      }
      setLoading(false);
    }
    fetchWedding();
  }, [id]);

  const installments = useMemo(() => {
    if (!wedding) return [];
    const total = wedding.total_amount || 0;
    const paid = wedding.paid_amount || 0;
    const datePart = wedding.date.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    const weddingDate = new Date(year, month - 1, day);
    const today = new Date();
    const remaining = total - paid;
    if (remaining <= 0) return [];

    const plan = wedding.payment_plan || "monthly";
    const result = [];

    if (plan === "50/50") {
      const half = total / 2;
      if (paid < half) {
        result.push({
          id: "retainer",
          label: "Retainer (50%)",
          amount: half - paid,
          date: today,
        });
      }
      result.push({
        id: "final",
        label: "Final Balance",
        amount: half,
        date: new Date(weddingDate.getTime() - 10 * 24 * 60 * 60 * 1000),
      });
    } else if (plan === "quarterly") {
      const chunk = (total - 99) / 4;
      for (let i = 1; i <= 4; i++) {
        result.push({
          id: `q${i}`,
          label: `Installment ${i}`,
          amount: chunk,
          date: new Date(today.getTime() + i * 90 * 24 * 60 * 60 * 1000),
        });
      }
    } else {
      const count = Math.ceil(remaining / 250);
      for (let i = 0; i < Math.min(count, 6); i++) {
        result.push({
          id: `m${i}`,
          label: i === 0 ? "Next Installment" : `Future Installment`,
          amount: Math.min(remaining, 250),
          date: new Date(today.getTime() + i * 30 * 24 * 60 * 60 * 1000),
        });
      }
    }

    return result.filter((inst) => inst.amount > 0);
  }, [wedding]);

  const handleGift = async (installmentToProcess?: any) => {
    const inst =
      installmentToProcess && !installmentToProcess.nativeEvent
        ? installmentToProcess
        : selectedInstallment;
    if (!inst) return;

    setErrorMsg(null);
    setSelectedInstallment(inst);
    setProcessing(true);

    try {
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
            weddingId: wedding.id,
            stripeCustomerId: wedding.stripe_customer_id,
            amount: inst.amount,
            type: "gift",
            customerEmail: "",
            description: `Gift for ${wedding.client_name}'s Wedding: ${inst.label}`,
            successUrl: `${window.location.origin}/gift/${wedding.id}?success=true`,
            cancelUrl: `${window.location.origin}/gift/${wedding.id}`,
          }),
        },
      );

      if (!response.ok) {
        let errorMsg = "Failed to initiate payment";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          errorMsg = await response.text();
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error(
          "Backend not updated. Please copy the latest stripe-checkout code into Supabase.",
        );
      }
    } catch (error: any) {
      console.error("Gift error:", error);
      setErrorMsg(
        error.message || "Could not initiate payment. Please try again.",
      );
      toast({
        variant: "destructive",
        title: "Payment Error",
        description:
          error.message || "Could not initiate payment. Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );

  if (new URLSearchParams(window.location.search).get("success")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] p-6">
        <Card className="max-w-md w-full border-none shadow-2xl bg-white/80 backdrop-blur-md text-center p-12">
          <div className="mb-6 flex justify-center">
            <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-3xl font-serif mb-4">Thank You</h1>
          <p className="text-muted-foreground mb-8">
            Your thoughtful gift has been received. {wedding?.client_name} &{" "}
            {wedding?.partner_name} will be notified of your contribution. We
            will be emailing and calling you shortly. If you prefer text, you
            can reply back to us saying that.
          </p>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
            className="rounded-full px-8"
          >
            Close
          </Button>
        </Card>
      </div>
    );
  }

  // Removed calculateInstallments call as it is now a memoized value

  return (
    <div className="min-h-screen bg-[#FAF9F6] selection:bg-primary/10">
      {/* Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/[0.03] rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <Badge
            variant="outline"
            className="mb-6 px-4 py-1 rounded-full border-primary/20 text-primary/60 tracking-widest uppercase text-[10px]"
          >
            The Gift of Memories
          </Badge>
          <h1 className="text-5xl md:text-6xl font-serif mb-6 tracking-tight">
            Gift a Wedding
          </h1>
          <p className="text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
            Help {wedding?.client_name} & {wedding?.partner_name} preserve their
            most precious moments by contributing to their wedding media.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Left Side: Info */}
          <div className="space-y-8">
            <div className="p-8 rounded-3xl bg-white/40 border border-white/60 backdrop-blur-sm">
              <Heart className="h-6 w-6 text-primary/40 mb-4" />
              <h3 className="text-xl font-serif mb-2">
                A Meaningful Contribution
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Instead of a traditional gift, you can help cover the cost of
                their professional wedding photography and cinematography. Your
                contribution goes directly toward their remaining balance.
              </p>
            </div>

            <div className="flex items-center gap-6 p-4">
              <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center text-primary/40">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Wedding Date</p>
                <p className="text-lg font-serif">
                  {wedding?.date
                    ? format(new Date(wedding.date), "MMMM d, yyyy")
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Options */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary/40 mb-4">
              Select an Installment to Gift
            </h3>
            <div className="space-y-3">
              {installments.map((inst, idx) => (
                <button
                  key={idx}
                  onClick={() => handleGift(inst)}
                  disabled={processing}
                  className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 group ${
                    selectedInstallment?.id === inst.id
                      ? "bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/20 scale-[1.02]"
                      : "bg-white border-primary/10 hover:border-primary/30 hover:shadow-lg"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p
                        className={`text-xs font-bold uppercase tracking-widest mb-1 ${selectedInstallment?.id === inst.id ? "text-primary-foreground/60" : "text-primary/40"}`}
                      >
                        {inst.label}
                      </p>
                      <p className="text-2xl font-serif">
                        ${inst.amount.toFixed(2)}
                      </p>
                    </div>
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
                        selectedInstallment?.id === inst.id
                          ? "bg-white/20"
                          : "bg-primary/5 group-hover:bg-primary/10"
                      }`}
                    >
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
                </button>
              ))}

              <button
                onClick={() =>
                  setSelectedInstallment({ label: "Custom Gift", amount: 100 })
                }
                className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 group ${
                  selectedInstallment?.label === "Custom Gift"
                    ? "bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/20 scale-[1.02]"
                    : "bg-white border-primary/10 hover:border-primary/30 hover:shadow-lg"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p
                      className={`text-xs font-bold uppercase tracking-widest mb-1 ${selectedInstallment?.label === "Custom Gift" ? "text-primary-foreground/60" : "text-primary/40"}`}
                    >
                      Custom Amount
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-serif">$</span>
                      <input
                        type="number"
                        className={`bg-transparent text-2xl font-serif w-24 border-none focus:ring-0 p-0 ${selectedInstallment?.label === "Custom Gift" ? "placeholder:text-white/40" : "placeholder:text-black/20"}`}
                        placeholder="100"
                        onChange={(e) =>
                          setSelectedInstallment({
                            label: "Custom Gift",
                            amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <Button
              className="w-full h-16 rounded-2xl text-lg font-serif tracking-wide shadow-2xl shadow-primary/20"
              disabled={
                !selectedInstallment ||
                selectedInstallment.amount <= 0 ||
                processing
              }
              onClick={handleGift}
            >
              {processing ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Heart className="h-5 w-5 mr-2" />
              )}
              Complete Gift Payment
            </Button>

            {errorMsg && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm text-center border border-red-100">
                <p className="font-bold mb-1">Error Processing Gift</p>
                <p>{errorMsg}</p>
              </div>
            )}

            <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              Secure payment processed by Stripe
            </p>
          </div>
        </div>
      </div>

      <footer className="py-12 border-t border-primary/5 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary/30 font-bold">
          &copy; {new Date().getFullYear()} Honeysuckle Haus
        </p>
      </footer>
    </div>
  );
}
