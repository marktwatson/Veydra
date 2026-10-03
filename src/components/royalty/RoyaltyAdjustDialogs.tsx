import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

/** Waive / Mark-Paid period dialog. */
export function RoyaltyAdjustPeriodDialog({
  open,
  onOpenChange,
  period,
  action,
  reason,
  setReason,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  period: any;
  action: "waive" | "markPaid";
  reason: string;
  setReason: (v: string) => void;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle>
            {action === "waive"
              ? "Waive Royalty Period"
              : "Mark Period as Paid"}
          </DialogTitle>
          <DialogDescription>
            {action === "waive"
              ? "This will zero out the amounts for this period. A reason is required for the audit log."
              : "This will mark the period as paid. A reason is required for the audit log."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted/40 p-3 rounded-xl text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Period:</span>
              <span>
                {period?.period_start} → {period?.period_end}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Due:</span>
              <span className="font-bold">
                ${Number(period?.total_due || 0).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason (required for audit log)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Manual check received via wire transfer"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full"
            onClick={onConfirm}
            disabled={pending || !reason.trim()}
          >
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Adjust remaining balance dialog. */
export function RoyaltyAdjustBalanceDialog({
  open,
  onOpenChange,
  territoryName,
  currentBalance,
  newBalance,
  setNewBalance,
  reason,
  setReason,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  territoryName: string;
  currentBalance: number;
  newBalance: string;
  setNewBalance: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  pending: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle>Adjust Remaining Balance: {territoryName}</DialogTitle>
          <DialogDescription>
            Manually adjust the payback remaining balance. A reason is required
            for the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted/40 p-3 rounded-xl text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Balance:</span>
              <span className="font-bold">
                ${Number(currentBalance || 0).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>New Remaining Balance ($)</Label>
            <Input
              type="number"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Correcting initial balance after down payment adjustment"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full"
            onClick={onSave}
            disabled={pending || !reason.trim() || !newBalance}
          >
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Balance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
