import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Heart } from "lucide-react";
import { format } from "date-fns";

export default function GiftWedding() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [wedding, setWedding] = useState<any>(null);

  useEffect(() => {
    async function fetchWedding() {
      if (!id) return;

      // Try fetching by UUID first
      let { data } = await supabase
        .from("weddings")
        .select(
          "id, client_name, partner_name, date, total_amount, paid_amount, payment_plan, stripe_customer_id",
        )
        .eq("id", id)
        .maybeSingle();

      // Fallback: search by stripe_customer_id
      if (!data) {
        const { data: stripeData } = await supabase
          .from("weddings")
          .select(
            "id, client_name, partner_name, date, total_amount, paid_amount, payment_plan, stripe_customer_id",
          )
          .eq("stripe_customer_id", id)
          .maybeSingle();
        if (stripeData) data = stripeData;
      }

      if (data) setWedding(data);
      setLoading(false);
    }
    fetchWedding();
  }, [id]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#FAF9F6] selection:bg-primary/10">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/[0.03] rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-2xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <Badge
            variant="outline"
            className="mb-6 px-4 py-1 rounded-full border-primary/20 text-primary/60 tracking-widest uppercase text-[10px]"
          >
            The Gift of Memories
          </Badge>
          <h1 className="text-5xl md:text-6xl font-serif mb-6 tracking-tight">
            Gift a Wedding
          </h1>
          {wedding?.client_name && (
            <p className="text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
              For {wedding.client_name}
              {wedding.partner_name ? ` & ${wedding.partner_name}` : ""}
              {wedding?.date
                ? ` · ${format(new Date(wedding.date), "MMMM d, yyyy")}`
                : ""}
            </p>
          )}
        </div>

        <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-md text-center p-12">
          <CardContent className="flex flex-col items-center gap-6">
            <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center">
              <Heart className="h-8 w-8 text-primary/40" />
            </div>
            <h2 className="text-2xl font-serif">
              Gift payments are temporarily unavailable
            </h2>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              We're sorry for the inconvenience. Please contact the studio
              directly to arrange a gift contribution for this couple.
            </p>
          </CardContent>
        </Card>
      </div>

      <footer className="py-12 border-t border-primary/5 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary/30 font-bold">
          &copy; {new Date().getFullYear()} Honeysuckle Haus
        </p>
      </footer>
    </div>
  );
}
