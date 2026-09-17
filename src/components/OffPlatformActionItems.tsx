import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ChevronRight, Clock, AlertCircle } from "lucide-react";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { api } from "@/lib/api";
import { ApproveOffPlatformPaymentDialog } from "@/components/ApproveOffPlatformPaymentDialog";
import { CoverageActionItems } from "@/components/CoverageActionItems";
import { useCoverageConfirmWatcher } from "@/lib/use-coverage-confirm-watcher";

const METHOD_LABELS: Record<string, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  zelle: "Zelle",
};

/**
 * Manager Dashboard Action Items accordion item for off-platform payments that need
 * staff review (Venmo / Cash App / Zelle promised or claimed by the bride).
 *
 * Rendered inside the Action Items Accordion alongside Overdue Payments, Missing
 * Questionnaires, etc. Matching header style, collapsible drawer, polished row cards,
 * and clicking an item opens the modal without overflow.
 */
export function OffPlatformActionItems() {
  const [selected, setSelected] = useState<any | null>(null);
  useCoverageConfirmWatcher();
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
      date: w.date,
      method:
        METHOD_LABELS[(w.offplatform_method || "").toLowerCase()] ||
        w.offplatform_method ||
        "Off-platform",
      status: w.offplatform_status as "promised" | "claimed",
      amount: Number(w.offplatform_amount) || 0,
      claimedAt: w.offplatform_claimed_at,
      raw: w,
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

  const claimedCount = items.filter((i) => i.status === "claimed").length;
  const promisedCount = items.filter((i) => i.status === "promised").length;
  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <>
      <AccordionItem
        value="offplatform"
        className="border-2 border-amber-500/40 rounded-xl mb-3 overflow-hidden bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent shadow-sm ring-1 ring-amber-500/20"
      >
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-amber-500/10 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
            <div className="p-2 rounded-xl bg-amber-500/20 shrink-0 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30">
              <Wallet className="h-4 w-4" />
            </div>
            <div className="text-left min-w-0">
              <span className="font-bold text-sm text-foreground block truncate">
                Off-Platform Payments
              </span>
              <span className="text-[11px] text-muted-foreground block truncate">
                Venmo, Cash App & Zelle awaiting verification
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap ml-auto">
              <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 tracking-wide">
                {items.length} • ${totalAmount.toLocaleString()}
              </span>
              {claimedCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {claimedCount} to review
                </span>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-3 pt-1">
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.raw)}
                className="group flex w-full flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-card/90 hover:bg-card p-3 text-left transition-all hover:border-amber-500/50 hover:shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {item.clientName}
                    </p>
                    <span className="text-xs font-medium text-muted-foreground">
                      • {item.method}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-foreground">
                      ${item.amount.toLocaleString()}
                    </span>
                    {item.claimedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        ({new Date(item.claimedAt).toLocaleDateString()})
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                      item.status === "claimed"
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300"
                        : "bg-sky-500/15 border-sky-500/30 text-sky-800 dark:text-sky-300"
                    }`}
                  >
                    {item.status === "claimed" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Bride says paid
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        Pay later
                      </>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                    Review
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <ApproveOffPlatformPaymentDialog
        wedding={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />

      <CoverageActionItems />
    </>
  );
}
