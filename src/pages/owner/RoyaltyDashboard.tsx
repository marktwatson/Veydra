import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Crown,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import { RoyaltyNextPullCard } from "@/components/RoyaltyNextPullCard";
import {
  OwnerRoyaltyBody,
  OwnerRoyaltyStatusBadge,
} from "@/components/owner/OwnerRoyaltyBody";
import { OwnerBankDialog } from "@/components/owner/OwnerBankDialog";

export default function OwnerRoyaltyDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Bank account / card connection (uses the separate royalty Stripe account)
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(
    null,
  );
  const [royaltyPublishableKey, setRoyaltyPublishableKey] = useState<
    string | null
  >(null);
  // Loaded Stripe instance for the royalty account (async — loadStripe returns
  // a Promise, so we store it in state once resolved before rendering Elements)
  const [royaltyStripe, setRoyaltyStripe] = useState<any>(null);

  const connectBankMutation = useMutation({
    mutationFn: async () => {
      return await api.createRoyaltySetupIntent();
    },
    onSuccess: async (data: any) => {
      if (data.client_secret) {
        setSetupClientSecret(data.client_secret);
        let pk = data.publishable_key;
        if (!pk) {
          try {
            const r = await api.getRoyaltyPublishableKey();
            pk = r.publishable_key;
          } catch {}
        }
        if (pk) {
          setRoyaltyPublishableKey(pk);
          // loadStripe is async — store the resolved instance in state so
          // <Elements stripe={...}> receives a real object, not a Promise.
          const instance = await loadStripe(pk);
          setRoyaltyStripe(instance);
          setBankDialogOpen(true);
        } else {
          toast({
            variant: "destructive",
            title: "Setup Failed",
            description: "No royalty Stripe publishable key configured.",
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Setup Failed",
          description: "No client secret returned.",
        });
      }
    },
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: err.message,
      }),
  });

  const {
    data: territory,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["owner-territory", user?.id],
    queryFn: () => api.getOwnerTerritory(user!.id),
    enabled: !!user?.id,
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["owner-royalty-periods", territory?.id],
    queryFn: () => api.getRoyaltyPeriods(territory!.id),
    enabled: !!territory?.id,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["owner-royalty-sales", territory?.id],
    queryFn: () => api.getRoyaltySales(territory!.id),
    enabled: !!territory?.id,
  });

  const { data: settings } = useQuery({
    queryKey: ["royalty-settings"],
    queryFn: api.getRoyaltySettings,
  });

  // Auto-link this owner to the primary territory if not yet linked, so the
  // dashboard "sees" the territory immediately (single-territory model).
  const linkOwnerMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      return await api.assignTerritoryOwner(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["owner-territory", user?.id],
      });
    },
  });

  React.useEffect(() => {
    // If we found a territory but it's not explicitly owned by this user,
    // link them automatically.
    if (territory && user?.id && !territory.owner_user_id) {
      linkOwnerMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory?.id, user?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !territory) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-7 w-7 text-amber-500" /> My Territory
        </h1>
        <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>
              No territory is linked to your account yet. Please contact Veydra
              support to be assigned a territory.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPaid = periods
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + (Number(p.total_due) || 0), 0);
  const lastPeriod = periods[0];
  const remainingBalance = Number(territory.remaining_balance || 0);
  const purchasePrice = Number(territory.purchase_price || 0);
  const paidOff = purchasePrice - remainingBalance;
  const progressPct =
    purchasePrice > 0
      ? Math.min(100, Math.round((paidOff / purchasePrice) * 100))
      : 0;

  // ─── Upcoming / projected royalty breakdown (owner view) ───
  const royaltyPct = Number(territory.royalty_percentage || 0);
  const paybackPct = Number(territory.payback_percentage || 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - 7);
  const windowStartStr = windowStart.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  const upcomingSales = (sales as any[]).filter(
    (s) =>
      s.sale_date >= windowStartStr &&
      s.sale_date <= todayStr &&
      !s.processed_period_id &&
      !s.is_refund &&
      !s.is_test &&
      (!!s.stripe_charge_id ||
        !/backfill|seed test|manual charge/i.test(s.description || "")),
  );
  const upcomingGross = upcomingSales.reduce(
    (sum, s) => sum + Number(s.sale_amount),
    0,
  );
  const projectedRoyalty = Math.max(0, upcomingGross * (royaltyPct / 100));
  const rawPayback = Math.max(0, upcomingGross * (paybackPct / 100));
  const projectedPayback = Math.min(rawPayback, remainingBalance);
  const projectedTotal = projectedRoyalty + projectedPayback;

  const printStatement = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Crown className="h-7 w-7 text-amber-500" /> {territory.name}{" "}
            Territory
          </h1>
          <p className="text-sm text-muted-foreground">
            Your royalty and payback dashboard.
          </p>
        </div>

        {/* Prominent call-to-action banner if no payment method on file */}
        {!(
          territory.primary_payment_method_id ||
          territory.stripe_payment_method_id
        ) && (
          <Card className="shadow-sm rounded-2xl bg-amber-500/5 border-amber-500/30">
            <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-500/15 p-2 shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    Action Required: Connect Your Bank Account
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Automatic weekly royalty + payback collection is disabled
                    until you add a payment method. A bank account (ACH) is
                    preferred.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="rounded-full shrink-0"
                onClick={() => connectBankMutation.mutate()}
                disabled={connectBankMutation.isPending}
              >
                {connectBankMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Connect Bank Account
              </Button>
            </CardContent>
          </Card>
        )}
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={printStatement}
        >
          <Download className="h-4 w-4 mr-2" /> Print Statement
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border/40 rounded-2xl bg-amber-500/5 border-amber-500/20">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-amber-600 uppercase tracking-wider">
              Remaining Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-3xl font-bold text-amber-600">
              ${remainingBalance.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of ${purchasePrice.toLocaleString()} purchase price
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/40 rounded-2xl bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
              Total Paid
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-3xl font-bold text-emerald-600">
              ${totalPaid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All-time royalty + payback
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Last Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-3xl font-bold">
              ${Number(lastPeriod?.total_due || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lastPeriod ? (
                <OwnerRoyaltyStatusBadge status={lastPeriod.status} />
              ) : (
                "No periods yet"
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Royalty Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-3xl font-bold">
              {Number(territory.royalty_percentage || 0).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              + {Number(territory.payback_percentage || 0).toFixed(2)}% payback
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payback Progress */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold">
            Payback Progress
          </CardTitle>
          <CardDescription className="text-xs">
            How close your territory purchase is to being paid off.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                ${paidOff.toLocaleString()} paid off
              </span>
              <span className="font-semibold">{progressPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {progressPct === 100 && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium pt-1">
                <CheckCircle className="h-4 w-4" /> Territory purchase is fully
                paid off!
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Royalty Pull — read-only for owners (no schedule editing) */}
      <RoyaltyNextPullCard settings={settings} showEditButton={false} />

      <OwnerRoyaltyBody
        territory={territory}
        periods={periods}
        sales={sales}
        upcomingGross={upcomingGross}
        upcomingSales={upcomingSales}
        royaltyPct={royaltyPct}
        paybackPct={paybackPct}
        projectedRoyalty={projectedRoyalty}
        rawPayback={rawPayback}
        projectedPayback={projectedPayback}
        projectedTotal={projectedTotal}
        remainingBalance={remainingBalance}
        onConnectBank={() => connectBankMutation.mutate()}
        connectPending={connectBankMutation.isPending}
      />

      {/* Connect / Update Bank Account Dialog (Stripe Elements) */}
      <OwnerBankDialog
        open={bankDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setBankDialogOpen(false);
            setSetupClientSecret(null);
          }
        }}
        setupClientSecret={setupClientSecret}
        publishableKey={royaltyPublishableKey}
        stripeInstance={royaltyStripe}
        onDone={() => {
          setBankDialogOpen(false);
          setSetupClientSecret(null);
          setRoyaltyStripe(null);
          queryClient.invalidateQueries({
            queryKey: ["owner-territory", user?.id],
          });
        }}
      />
    </div>
  );
}
