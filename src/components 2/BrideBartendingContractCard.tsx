import { useQuery } from "@tanstack/react-query";
import { Wine, ExternalLink, FileText, Printer } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

function fmtMoney(n: number) {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/**
 * Bartending Services Agreement card shown on the bride portal Contract tab,
 * directly after the photography agreement card.
 */
export default function BrideBartendingContractCard({
  wedding,
}: {
  wedding: any;
}) {
  const weddingId = wedding?.id;

  const { data: purchase } = useQuery({
    queryKey: ["bartending-upsell-portal", weddingId],
    queryFn: async () => {
      if (!weddingId) return null;
      const { data } = await supabase
        .from("upsell_purchases")
        .select("*")
        .eq("wedding_id", weddingId)
        .eq("service", "bartending")
        .order("purchased_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!weddingId,
  });

  const barAddonEntry = Array.isArray(wedding?.addons)
    ? wedding.addons.find((a: string) =>
        String(a).toLowerCase().startsWith("bartending:"),
      )
    : null;

  // Render nothing if no bartending purchase and no addons entry.
  if (!purchase && !barAddonEntry) return null;

  const pkgName =
    purchase?.package_name ||
    (barAddonEntry ? barAddonEntry.replace(/^Bartending:\s*/i, "") : "Package");
  const amount = Number(purchase?.amount) || 0;
  const status =
    purchase?.contract_status === "signed"
      ? "signed"
      : purchase?.contract_status === "sent"
        ? "sent"
        : "invoiced";

  // Resolve invoice URL (same order as BartendingContract page)
  const pkgDetails = purchase?.package_details || {};
  const invoiceUrl =
    purchase?.ghl_invoice_url ||
    pkgDetails?.ghl_invoice_url ||
    pkgDetails?.invoiceUrl ||
    null;

  const snapshot = purchase?.contract_snapshot || null;
  const contractUrl = purchase?.id
    ? `/bartending-contract/${purchase.id}`
    : null;

  return (
    <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
      <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20 flex flex-row items-center justify-between">
        <div>
          <CardTitle
            className="text-[#1a1a1a] flex items-center gap-2"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            <Wine className="h-5 w-5 text-[#8b6f3f]" />
            Bartending Services Agreement
          </CardTitle>
          <CardDescription className="text-[#1a1a1a]/60">
            Separate from your photography & videography contract.
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className={
            status === "signed"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : status === "sent"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
          }
        >
          {status === "signed"
            ? "Signed"
            : status === "sent"
              ? "Sent"
              : "Invoiced"}
        </Badge>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-[#1a1a1a]">{pkgName}</span>
          {amount > 0 && (
            <Badge variant="secondary" className="font-medium">
              {fmtMoney(amount)}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {contractUrl && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href={contractUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4" />
                {status === "signed"
                  ? "View / Print Contract"
                  : "View Contract"}
              </a>
            </Button>
          )}
          {invoiceUrl && (
            <Button asChild size="sm" className="gap-2">
              <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open Invoice
              </a>
            </Button>
          )}
        </div>

        {snapshot && (
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1a1a1a]/50 mb-2">
              Signed Agreement Preview
            </p>
            <div
              className="max-h-[400px] overflow-y-auto rounded-lg border border-[#c9a96e]/20 bg-[#fafaf7] p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: snapshot }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
