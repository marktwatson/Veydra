import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { createGhlInvoice } from "@/lib/ghl-invoice-api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weddings: any[];
}

export function GhlInvoiceDialog({ open, onOpenChange, weddings }: Props) {
  const { toast } = useToast();
  const [selectedWeddingId, setSelectedWeddingId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const activeWeddings = weddings
    .filter(
      (w) => w.status !== "cancelled" && !w.notes?.includes("[UNPAID_DRAFT]"),
    )
    .sort((a, b) => (a.client_name || "").localeCompare(b.client_name || ""));

  const handleWeddingChange = (weddingId: string) => {
    setSelectedWeddingId(weddingId);
    setCreatedUrl(null);
    const w = weddings.find((item) => item.id === weddingId);
    if (w) {
      const total = Number(w.total_amount) || 0;
      const paid = Number(w.paid_amount) || 0;
      const remaining = Math.max(0, total - paid);
      setAmount(remaining > 0 ? remaining.toString() : total.toString());
      setLabel(`Invoice for ${w.client_name || "Wedding"}`);
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedWeddingId) {
      toast({
        variant: "destructive",
        title: "Select a Wedding",
        description: "Please select a wedding to generate an invoice for.",
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid invoice amount greater than $0.",
      });
      return;
    }

    setLoading(true);
    setCreatedUrl(null);

    try {
      const res = await createGhlInvoice({
        weddingId: selectedWeddingId,
        amount: numAmount,
        label: label.trim() || undefined,
      });

      setCreatedUrl(res.invoiceUrl);
      const note = res.reused
        ? `Reused today's existing $${numAmount.toLocaleString()} invoice for ${res.clientName}.`
        : `Created $${numAmount.toLocaleString()} invoice for ${res.clientName}. Opening invoice...`;
      toast({
        title: res.reused ? "Invoice Reused" : "Invoice Generated!",
        description: note,
      });

      if (res.invoiceUrl) {
        window.open(res.invoiceUrl, "_blank");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Invoice Creation Failed",
        description: err.message || "Failed to generate CRM invoice.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedWeddingId("");
    setAmount("");
    setLabel("");
    setCreatedUrl(null);
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px] rounded-3xl overflow-hidden shadow-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Create CRM
            Invoice
          </DialogTitle>
          <DialogDescription>
            Generate a CRM invoice for a client and open the invoice URL
            directly.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Select Wedding / Client
            </Label>
            <Select
              value={selectedWeddingId}
              onValueChange={handleWeddingChange}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Choose a client..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {activeWeddings.map((w) => {
                  const rem = Math.max(
                    0,
                    (Number(w.total_amount) || 0) -
                      (Number(w.paid_amount) || 0),
                  );
                  return (
                    <SelectItem key={w.id} value={w.id}>
                      {w.client_name} — Due: ${rem.toLocaleString()}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Invoice Title / Label
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Payment for John & Jane"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Invoice Amount ($)</Label>
            <Input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="rounded-xl"
            />
          </div>

          {createdUrl && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                Invoice URL Created!
              </div>
              <p className="break-all font-mono text-[11px] bg-background/50 p-2 rounded-xl border border-border/40">
                {createdUrl}
              </p>
              <a
                href={createdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 bg-transparent px-4 py-2 text-sm font-medium hover:bg-emerald-500/10 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open invoice
              </a>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Close
          </Button>
          <Button
            className="rounded-full"
            onClick={handleCreateInvoice}
            disabled={loading || !selectedWeddingId}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Generate Invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
