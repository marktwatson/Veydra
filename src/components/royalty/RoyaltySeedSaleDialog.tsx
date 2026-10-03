import { DollarSign, Loader2 } from "lucide-react";
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

/** Seed Test Sale dialog — inserts a fake gross-sale row (testing only). */
export function RoyaltySeedSaleDialog({
  open,
  onOpenChange,
  seedAmount,
  setSeedAmount,
  seedNote,
  setSeedNote,
  royaltyPct,
  paybackPct,
  pending,
  onSeed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seedAmount: string;
  setSeedAmount: (v: string) => void;
  seedNote: string;
  setSeedNote: (v: string) => void;
  royaltyPct: number;
  paybackPct: number;
  pending: boolean;
  onSeed: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-500" /> Seed Test Sale
          </DialogTitle>
          <DialogDescription>
            Inserts a fake gross-sale row dated today so the weekly processor
            has something to calculate and charge. This does NOT create a real
            booking or touch the bride booking Stripe account — it only feeds
            the royalty math. Run "Run Weekly Processor" after seeding.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="seed-amount">Sale amount (USD)</Label>
            <Input
              id="seed-amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 1500"
              value={seedAmount}
              onChange={(e) => setSeedAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seed-note">Note (optional)</Label>
            <Input
              id="seed-note"
              placeholder="e.g. Simulated wedding payment"
              value={seedNote}
              onChange={(e) => setSeedNote(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            With your current rates, a ${seedAmount || "0"} sale would produce
            ~$
            {(parseFloat(seedAmount || "0") * (royaltyPct / 100)).toFixed(
              2,
            )}{" "}
            royalty
            {" + "}$
            {(parseFloat(seedAmount || "0") * (paybackPct / 100)).toFixed(2)}{" "}
            payback.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSeed} disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4 mr-2" />
            )}
            Seed Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
