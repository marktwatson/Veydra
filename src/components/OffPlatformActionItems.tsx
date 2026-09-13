import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Wallet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from "@/lib/api";

const METHOD_LABELS: Record<string, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  zelle: "Zelle",
};

/**
 * Manager Dashboard Action Items block for off-platform payments that need
 * staff review (Venmo / Cash App / Zelle promised or claimed by the bride).
 *
 * Lists every wedding with offplatform_status in (promised, claimed), linking
 * to /manager/payments. Visible to manager, owner, and super_admin — the
 * caller decides visibility; this component just renders the list.
 */
export function OffPlatformActionItems() {
  const { data: weddings = [] } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  const items = weddings
    .filter(
      (w: any) =>
        w.offplatform_status === "promised" ||
        w.offplatform_status === "claimed",
    )
    .map((w: any) => ({
      id: w.id,
      clientName: w.client_name || "Unknown Client",
      method:
        METHOD_LABELS[w.offplatform_method] ||
        w.offplatform_method ||
        "Off-platform",
      status: w.offplatform_status as "promised" | "claimed",
      amount: Number(w.offplatform_amount) || 0,
      claimedAt: w.offplatform_claimed_at,
    }))
    .sort((a, b) => {
      if (a.status === "claimed" && b.status === "promised") return -1;
      if (a.status === "promised" && b.status === "claimed") return 1;
      return (
        new Date(b.claimedAt || 0).getTime() -
        new Date(a.claimedAt || 0).getTime()
      );
    });

  if (items.length === 0) return null;

  return (
    <Alert className="bg-amber-500/5 border-amber-500/30 rounded-2xl shadow-sm">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="font-semibold text-amber-700 dark:text-amber-400">
        Off-platform payments to review ({items.length})
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-1.5">
          {items.map((item) => (
            <Link
              key={item.id}
              to="/manager/payments"
              className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-2 text-sm hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <Wallet className="h-3.5 w-3.5 text-amber-600" />
                {item.clientName} — {item.method}{" "}
                {item.status === "claimed" ? "claimed" : "promised"} $
                {item.amount.toLocaleString()}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  item.status === "claimed"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                }`}
              >
                {item.status === "claimed"
                  ? "Bride says paid — review"
                  : "Pay later — pending"}
              </span>
            </Link>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
