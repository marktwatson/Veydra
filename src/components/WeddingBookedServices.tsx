import { useQuery } from "@tanstack/react-query";
import { Wine, Camera, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

/**
 * Compact "Booked" block shown on the wedding file.
 * Lists the photography package and any bartending upsell package purchased.
 */
export default function WeddingBookedServices({ wedding }: { wedding: any }) {
  const packageName =
    wedding?.package ||
    (Array.isArray(wedding?.addons) && wedding.addons.length ? null : null);

  // Look for a bartending upsell purchase for this wedding.
  const { data: bartending } = useQuery({
    queryKey: ["bartending-upsell", wedding?.id],
    queryFn: async () => {
      if (!wedding?.id) return null;
      const { data } = await supabase
        .from("upsell_purchases")
        .select("id, package_name, amount, package_details")
        .eq("wedding_id", wedding.id)
        .eq("service", "bartending")
        .order("purchased_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!wedding?.id,
  });

  const barAddonEntry = Array.isArray(wedding?.addons)
    ? wedding.addons.find((a: string) =>
        String(a).toLowerCase().startsWith("bartending:"),
      )
    : null;
  const barPackageName =
    bartending?.package_name ||
    (barAddonEntry ? barAddonEntry.replace(/^Bartending:\s*/i, "") : null);
  const barAmount = bartending?.amount ?? null;
  const barInvoiceUrl =
    (bartending?.package_details as any)?.ghl_invoice_url || null;

  const hasBar = !!barPackageName || !!bartending;
  const hasPhoto = !!packageName || !hasBar;

  if (!hasPhoto && !hasBar) return null;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Booked Services
      </div>
      <div className="flex flex-wrap gap-2">
        {hasPhoto && (
          <Badge
            variant="secondary"
            className="gap-1.5 py-1.5 px-2.5 text-xs font-medium"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="text-muted-foreground">Photography</span>
            <span className="font-semibold">
              {packageName || wedding?.package || "—"}
            </span>
          </Badge>
        )}
        {hasBar && (
          <Badge
            variant="secondary"
            className="gap-1.5 py-1.5 px-2.5 text-xs font-medium"
          >
            <Wine className="h-3.5 w-3.5" />
            <span className="text-muted-foreground">Bartending</span>
            <span className="font-semibold">{barPackageName || "Package"}</span>
            {barAmount != null && (
              <span className="text-muted-foreground">
                ${Number(barAmount).toLocaleString()}
              </span>
            )}
            {barInvoiceUrl && (
              <a
                href={barInvoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                Open invoice
              </a>
            )}
          </Badge>
        )}
      </div>
    </div>
  );
}
