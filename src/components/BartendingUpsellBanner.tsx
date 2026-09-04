import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBartendingModule } from "@/hooks/use-bartending-module";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Wine, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { api, type DbWedding, type DbPortalSettings } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface Props {
  wedding: Partial<DbWedding> | null;
  settings: DbPortalSettings | null;
}

interface BartendingAddon {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
}

export default function BartendingUpsellBanner({ wedding, settings }: Props) {
  const { toast } = useToast();
  const bartendingModuleOn = useBartendingModule();
  const [open, setOpen] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Pull bartending packages directly from the pricing_addons table
  // (single source of truth — managed in Settings → Packages & Addons)
  const { data: packages = [] } = useQuery<BartendingAddon[]>({
    queryKey: ["bartending-addons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_addons")
        .select("id, name, price, description, features")
        .eq("is_bartending", true)
        .eq("is_archived", false)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        price: Number(a.price),
        description: a.description || "",
        features: a.features || [],
      }));
    },
  });

  if (!bartendingModuleOn || !settings?.upsell_bartending_enabled) return null;
  if (!packages || packages.length === 0) return null;

  // Only show to active (non-cancelled) weddings
  const status = (wedding?.status || "").toLowerCase();
  if (status === "cancelled") return null;

  const headline =
    settings.upsell_bartending_headline || "Add Professional Bartending";
  const subtext =
    settings.upsell_bartending_subtext ||
    "Let our certified bartenders handle your reception so you can enjoy every moment.";

  const handlePurchase = async (pkg: BartendingAddon) => {
    if (!wedding?.id) return;
    setPurchasing(pkg.id);
    try {
      const origin = window.location.origin;
      const data = await api.createUpsellCheckout({
        weddingId: wedding.id,
        packageName: pkg.name,
        amount: pkg.price,
        customerEmail: wedding.client_email || undefined,
        customerName: wedding.client_name || undefined,
        stripeCustomerId: wedding.stripe_customer_id || undefined,
        successUrl: `${origin}/bride-portal/${wedding.id}?upsell=success`,
        cancelUrl: `${origin}/bride-portal/${wedding.id}?upsell=cancelled`,
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Purchase failed",
        description: e.message || "Could not start checkout. Please try again.",
      });
      setPurchasing(null);
    }
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-[#c9a96e]/15 to-[#f0e6d2]/20 border-[#c9a96e]/40 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-[#1a1a1a] text-white p-3 rounded-full shrink-0">
              <Wine className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-[#1a1a1a]">
                  {headline}
                </h3>
                <Badge className="bg-[#c9a96e]/30 text-[#1a1a1a] hover:bg-[#c9a96e]/40 border-0">
                  <Sparkles className="h-3 w-3 mr-1" /> New
                </Badge>
              </div>
              <p className="text-sm text-[#1a1a1a]/70 mt-1">{subtext}</p>
            </div>
          </div>
          <Button
            className="bg-[#1a1a1a] hover:bg-[#1a1a1a]/90 text-white rounded-full shrink-0"
            onClick={() => setOpen(true)}
          >
            View Packages
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wine className="h-5 w-5 text-[#c9a96e]" />
              {headline}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{subtext}</p>
          <div className="space-y-3 mt-2">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="border rounded-xl p-4 hover:border-[#c9a96e]/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-[#1a1a1a]">
                        {pkg.name}
                      </h4>
                      <Badge variant="secondary" className="bg-[#c9a96e]/20">
                        ${pkg.price.toLocaleString()}
                      </Badge>
                    </div>
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {pkg.description}
                      </p>
                    )}
                    {pkg.features?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {pkg.features.map((f, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-[#1a1a1a]/80"
                          >
                            <CheckCircle2 className="h-4 w-4 text-[#c9a96e] shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <Button
                  className="w-full mt-3 bg-[#1a1a1a] hover:bg-[#1a1a1a]/90 text-white rounded-full"
                  disabled={purchasing !== null}
                  onClick={() => handlePurchase(pkg)}
                >
                  {purchasing === pkg.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Redirecting to checkout...
                    </>
                  ) : (
                    `Add for $${pkg.price.toLocaleString()}`
                  )}
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Maybe later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
