import { useState } from "react";
import { DialogFooter } from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Settings,
  DollarSign,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export function TerritoryEditForm({
  territory,
  onSave,
  saving,
  onAdjustBalance,
}: {
  territory: any;
  onSave: (updates: any) => void;
  saving: boolean;
  onAdjustBalance: () => void;
}) {
  const [royaltyPct, setRoyaltyPct] = useState(
    String(territory.royalty_percentage || 0),
  );
  const [paybackPct, setPaybackPct] = useState(
    String(territory.payback_percentage || 0),
  );
  const [purchasePrice, setPurchasePrice] = useState(
    String(territory.purchase_price || 0),
  );
  const [downPayment, setDownPayment] = useState(
    String(territory.down_payment || 0),
  );
  const [status, setStatus] = useState(territory.status || "active");
  const [stripeCustomerId, setStripeCustomerId] = useState(
    territory.stripe_customer_id || "",
  );

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Royalty Percentage (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={royaltyPct}
            onChange={(e) => setRoyaltyPct(e.target.value)}
            placeholder="8.00"
          />
        </div>
        <div className="space-y-2">
          <Label>Payback Percentage (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={paybackPct}
            onChange={(e) => setPaybackPct(e.target.value)}
            placeholder="5.00"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Purchase Price ($)</Label>
          <Input
            type="number"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="50000"
          />
        </div>
        <div className="space-y-2">
          <Label>Down Payment ($)</Label>
          <Input
            type="number"
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value)}
            placeholder="10000"
          />
        </div>
      </div>
      <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3">
        <div>
          <Label className="text-sm">Remaining Balance</Label>
          <p className="text-lg font-bold">
            ${Number(territory.remaining_balance || 0).toLocaleString()}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onAdjustBalance}
        >
          <DollarSign className="h-3.5 w-3.5 mr-1" />
          Adjust
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Stripe Customer ID</Label>
        <Input
          value={stripeCustomerId}
          onChange={(e) => setStripeCustomerId(e.target.value)}
          placeholder="cus_..."
        />
        {territory.stripe_customer_id && (
          <div className="flex items-center gap-2 text-xs">
            {territory.primary_payment_method_id ||
            territory.stripe_payment_method_id ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
                <CheckCircle className="h-3 w-3 mr-1" />
                Bank Account Connected
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full">
                <AlertCircle className="h-3 w-3 mr-1" />
                No Payment Method — Use "Connect Bank Account" button
              </Badge>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          className="rounded-full w-full"
          onClick={() =>
            onSave({
              royalty_percentage: parseFloat(royaltyPct) || 0,
              payback_percentage: parseFloat(paybackPct) || 0,
              purchase_price: parseFloat(purchasePrice) || 0,
              down_payment: parseFloat(downPayment) || 0,
              status,
              stripe_customer_id: stripeCustomerId || null,
            })
          }
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Settings className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </DialogFooter>
    </div>
  );
}
