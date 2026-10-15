import { useQuery } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { currentTerritoryId } from "@/lib/current-territory";
import { feeFor, getSalespersonSendFees } from "@/lib/salesperson-payouts";
import { repriceUnpaidInvoice } from "@/lib/edit-tracks";
import { Button } from "@/components/ui/button";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

type Row = { id: string; who: string; detail: string; amount: number };

export function usePendingExtraPayouts() {
  const { data: territoryId } = useQuery({
    queryKey: ["current-territory"],
    queryFn: currentTerritoryId,
  });
  const { data: weddings = [] } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });
  const { data: editors = [] } = useQuery({
    queryKey: ["editors"],
    queryFn: api.getEditors,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["salesperson-owed", territoryId],
    enabled: territoryId !== undefined,
    queryFn: async () => {
      let q = supabase
        .from("proposals")
        .select("id, salesperson_email, salesperson_name, salesperson_paid_at, territory_id, client_name, sent_at")
        .not("salesperson_email", "is", null)
        .not("sent_at", "is", null);
      if (territoryId) q = q.eq("territory_id", territoryId);
      const { data } = await q;
      const unpaid = (data || []).filter((p: any) => !p.salesperson_paid_at);
      const fees = await getSalespersonSendFees(unpaid.map((p: any) => p.territory_id));
      const map = new Map<string, Row>();
      for (const p of unpaid) {
        const email = String(p.salesperson_email || "").trim().toLowerCase();
        if (!email) continue;
        const fee = feeFor(fees, p.territory_id);
        const existing = map.get(email);
        if (existing) {
          existing.amount += fee;
          existing.detail = `${Number(existing.detail) + 1}`;
        } else {
          map.set(email, {
            id: email,
            who: p.salesperson_name || email,
            detail: "1",
            amount: fee,
          });
        }
      }
      return Array.from(map.values());
    },
  });

  const editorName = (id?: string | null) =>
    editors.find((e: any) => e.id === id)?.name || "Editor";
  const editorEmail = (id?: string | null) =>
    editors.find((e: any) => e.id === id)?.email || "";

  const inArea = (w: any) => !territoryId || !w.territory_id || w.territory_id === territoryId;
  const open = (status?: string | null) => status === "pending" || status === "approved";

  const editorRows: Row[] = [];
  for (const w of weddings as any[]) {
    if (!inArea(w)) continue;
    if (!w.edit_split && open(w.editor_invoice_status)) {
      const priced = repriceUnpaidInvoice(w, editorEmail(w.editor_id));
      editorRows.push({
        id: w.id,
        who: editorName(w.editor_id),
        detail: w.client_name || "Wedding",
        amount: Number(priced.editor_payout_amount || 0),
      });
    }
    if (w.edit_split && open(w.photo_invoice_status)) {
      const priced = repriceUnpaidInvoice(
        {
          editor_invoice_status: w.photo_invoice_status,
          editor_payout_amount: w.photo_payout_amount,
          editor_invoice_details: w.photo_invoice_details,
        },
        editorEmail(w.photo_editor_id),
      );
      editorRows.push({
        id: `${w.id}:photo`,
        who: editorName(w.photo_editor_id),
        detail: `${w.client_name || "Wedding"} · Photo`,
        amount: Number(priced.editor_payout_amount || 0),
      });
    }
    if (w.edit_split && open(w.video_invoice_status)) {
      editorRows.push({
        id: `${w.id}:video`,
        who: editorName(w.video_editor_id),
        detail: `${w.client_name || "Wedding"} · Video`,
        amount: Number(w.video_payout_amount || 0),
      });
    }
  }

  return { editorRows, salesRows: sales || [] };
}

function Group({
  value,
  title,
  rows,
  tone,
}: {
  value: string;
  title: string;
  rows: Row[];
  tone: "violet" | "sky";
}) {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const [border, from, text, badge] = [
    tone === "violet" ? "border-violet-500/30" : "border-sky-500/30",
    tone === "violet" ? "from-violet-500/10" : "from-sky-500/10",
    tone === "violet" ? "text-violet-700 dark:text-violet-300" : "text-sky-700 dark:text-sky-300",
    tone === "violet"
      ? "bg-violet-500/15 border-violet-500/30 text-violet-700 dark:text-violet-300"
      : "bg-sky-500/15 border-sky-500/30 text-sky-700 dark:text-sky-300",
  ];
  return (
    <AccordionItem value={value} className={`border ${border} rounded-xl mb-2 overflow-hidden bg-gradient-to-r ${from} to-transparent`}>
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-full ${badge} shrink-0`}>
            <DollarSign className="h-4 w-4" />
          </div>
          <span className={`font-semibold text-sm ${text}`}>{title}</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${badge}`}>
            {rows.length} • ${total.toLocaleString()}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-3">
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/40 p-2.5 bg-card gap-2">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-sm font-medium truncate">{row.who}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {value === "sales-payouts" ? `${row.detail} proposal${row.detail === "1" ? "" : "s"}` : row.detail}
                  {" • "}${row.amount.toLocaleString()}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0 w-full sm:w-auto rounded-full bg-background text-xs h-8">
                <Link to="/manager/payouts">Approve</Link>
              </Button>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function PendingPayoutActionItems() {
  const { editorRows, salesRows } = usePendingExtraPayouts();
  return (
    <>
      <Group value="editor-payouts" title="Editor Payouts" rows={editorRows} tone="violet" />
      <Group value="sales-payouts" title="Sales Payouts" rows={salesRows} tone="sky" />
    </>
  );
}
