import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Crown } from "lucide-react";
import { RoyaltyStripeAccountCard } from "./RoyaltyStripeAccountCard";

// ─── Setup form shown when no primary territory exists yet ───
export function RoyaltySetupForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [royaltyPct, setRoyaltyPct] = useState("8.00");
  const [paybackPct, setPaybackPct] = useState("5.00");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSetup = async () => {
    if (!name.trim() || !purchasePrice || !downPayment) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description:
          "Please fill in territory name, purchase price, and down payment.",
      });
      return;
    }
    setSaving(true);
    try {
      await api.setupPrimaryTerritory({
        name: name.trim(),
        royalty_percentage: parseFloat(royaltyPct) || 0,
        payback_percentage: parseFloat(paybackPct) || 0,
        purchase_price: parseFloat(purchasePrice) || 0,
        down_payment: parseFloat(downPayment) || 0,
      });
      // Link the current user as the owner of this territory so the Owner
      // dashboard sees it immediately (single-territory model).
      if (user?.id) {
        try {
          await api.assignTerritoryOwner(user.id);
        } catch (_) {}
      }
      await api.createRoyaltyAuditLog({
        action: "setup_territory",
        field_changed: "all",
        old_value: "none",
        new_value: JSON.stringify({
          name,
          royaltyPct,
          paybackPct,
          purchasePrice,
          downPayment,
        }),
        reason: "Initial territory setup",
        performed_by: user?.email || "unknown",
      });
      toast({
        title: "Territory Created",
        description: "Royalty settings have been configured for this instance.",
      });
      queryClient.invalidateQueries({ queryKey: ["royalty-territory"] });
      onCreated();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Setup Failed",
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-7 w-7 text-amber-500" /> Royalty & Payback Setup
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure this territory's royalty and payback settings. This only
          needs to be done once.
        </p>
      </div>

      <Card className="shadow-sm border-border/40 rounded-2xl bg-card max-w-2xl">
        <CardHeader className="p-5 pb-3 border-b border-border/40">
          <CardTitle className="text-lg font-bold">
            Territory Configuration
          </CardTitle>
          <CardDescription className="text-xs">
            Set the royalty percentage, payback percentage, purchase price, and
            down payment for this territory.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Territory Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nashville Territory"
            />
          </div>
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
          <div className="bg-muted/30 rounded-xl p-3 text-sm text-muted-foreground">
            <strong>Remaining Balance</strong> will be automatically calculated
            as: Purchase Price − Down Payment ={" "}
            <span className="font-bold text-foreground">
              $
              {(
                (parseFloat(purchasePrice) || 0) -
                (parseFloat(downPayment) || 0)
              ).toLocaleString()}
            </span>
          </div>
          <Button
            className="rounded-full w-full"
            onClick={handleSetup}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Crown className="h-4 w-4 mr-2" />
            )}
            Create Territory & Save Settings
          </Button>
        </CardContent>
      </Card>

      <RoyaltyStripeAccountCard
        onSaved={() =>
          queryClient.invalidateQueries({ queryKey: ["royalty-settings"] })
        }
      />
    </div>
  );
}
