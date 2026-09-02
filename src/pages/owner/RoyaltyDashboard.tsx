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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Crown,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RotateCcw,
  DollarSign,
  Loader2,
  Download,
  CreditCard,
  Landmark,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

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
  // Sum all sales in the current (not-yet-processed) 7-day window so the owner
  // can see what the next weekly processor run will calculate and charge.
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
      !/backfill|seed test|manual charge/i.test(s.description || "") &&
      !!s.stripe_charge_id,
  );
  const upcomingGross = upcomingSales.reduce(
    (sum, s) => sum + Number(s.sale_amount),
    0,
  );
  const projectedRoyalty = Math.max(0, upcomingGross * (royaltyPct / 100));
  const rawPayback = Math.max(0, upcomingGross * (paybackPct / 100));
  const projectedPayback = Math.min(rawPayback, remainingBalance);
  const projectedTotal = projectedRoyalty + projectedPayback;

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
            <CheckCircle className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 rounded-full">
            <Clock className="h-3 w-3 mr-1" />
            Processing
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 rounded-full">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "waived":
        return (
          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 rounded-full">
            <AlertCircle className="h-3 w-3 mr-1" />
            Waived
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="rounded-full">
            {status}
          </Badge>
        );
    }
  };

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
              {lastPeriod ? statusBadge(lastPeriod.status) : "No periods yet"}
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

      {/* Upcoming / Projected Royalty Breakdown (owner view) */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" /> Upcoming Royalty
            Projection
          </CardTitle>
          <CardDescription className="text-xs">
            Sales recorded in the last 7 days that the next weekly run will
            calculate and charge.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Gross Sales (7d)
              </p>
              <p className="text-xl font-bold">
                ${upcomingGross.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {upcomingSales.length} sale
                {upcomingSales.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="bg-blue-500/5 rounded-xl p-3">
              <p className="text-xs text-blue-600 uppercase tracking-wider">
                Royalty ({royaltyPct.toFixed(2)}%)
              </p>
              <p className="text-xl font-bold text-blue-600">
                ${projectedRoyalty.toLocaleString()}
              </p>
            </div>
            <div className="bg-amber-500/5 rounded-xl p-3">
              <p className="text-xs text-amber-600 uppercase tracking-wider">
                Payback ({paybackPct.toFixed(2)}%)
              </p>
              <p className="text-xl font-bold text-amber-600">
                ${projectedPayback.toLocaleString()}
              </p>
              {rawPayback > remainingBalance && remainingBalance > 0 && (
                <p className="text-xs text-amber-600">
                  Capped at remaining balance
                </p>
              )}
            </div>
            <div className="bg-emerald-500/5 rounded-xl p-3">
              <p className="text-xs text-emerald-600 uppercase tracking-wider">
                Projected Total
              </p>
              <p className="text-xl font-bold text-emerald-600">
                ${projectedTotal.toLocaleString()}
              </p>
            </div>
          </div>

          {upcomingSales.length > 0 ? (
            <div className="border-t border-border/40 pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Sales in this window:
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {upcomingSales.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center text-sm py-1.5 px-2 rounded-lg hover:bg-muted/30"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {s.is_refund ? "Refund" : "Sale"} —{" "}
                        {s.description || "No description"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.sale_date}
                      </span>
                    </div>
                    <span
                      className={`font-semibold ${s.is_refund ? "text-red-600" : "text-emerald-600"}`}
                    >
                      {s.is_refund ? "-" : "+"}$
                      {Number(s.sale_amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <DollarSign className="h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm">
                No sales recorded in the last 7 days yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Payment Method
          </CardTitle>
          <CardDescription className="text-xs">
            Bank account (ACH) is preferred for automatic weekly collection.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-3">
          {territory.stripe_customer_id ? (
            <>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Stripe Connected
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Customer ID: {territory.stripe_customer_id.substring(0, 12)}
                  ...
                </span>
              </div>
              {territory.primary_payment_method_id ||
              territory.stripe_payment_method_id ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500" /> Payment
                  method on file — automatic weekly collection is active.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertCircle className="h-4 w-4" /> No payment method on file
                  yet. Connect a bank account to enable automatic collection.
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => connectBankMutation.mutate()}
                disabled={connectBankMutation.isPending}
              >
                {connectBankMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : territory.primary_payment_method_id ||
                  territory.stripe_payment_method_id ? (
                  <RotateCcw className="h-4 w-4 mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {territory.primary_payment_method_id ||
                territory.stripe_payment_method_id
                  ? "Update Payment Method"
                  : "Connect Bank Account"}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" /> No payment method on file.
              </div>
              <Button
                size="sm"
                className="rounded-full"
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Period History Table */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/40">
          <CardTitle className="text-lg font-bold">Payment History</CardTitle>
          <CardDescription className="text-xs">
            Every weekly period: gross sales, royalty, payback, and status.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {periods.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <DollarSign className="h-10 w-10 opacity-40 mb-2" />
              <p>
                No royalty periods calculated yet. The first weekly run will
                appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold">Period</TableHead>
                    <TableHead className="font-semibold text-right">
                      Gross Sales
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Royalty
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Payback
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Total
                    </TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((p: any) => (
                    <TableRow key={p.id} className="hover:bg-muted/20">
                      <TableCell className="text-xs font-medium">
                        {p.period_start} → {p.period_end}
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(p.gross_sales || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        ${Number(p.royalty_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        ${Number(p.payback_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${Number(p.total_due || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contributing Sales */}
      {sales.length > 0 && (
        <Card className="shadow-sm border-border/40 rounded-2xl bg-card overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-border/40">
            <CardTitle className="text-lg font-bold">
              Sales Contributing to Royalty
            </CardTitle>
            <CardDescription className="text-xs">
              Bookings and revenue attributed to your territory.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold text-right">
                      Amount
                    </TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.slice(0, 20).map((s: any) => (
                    <TableRow key={s.id} className="hover:bg-muted/20">
                      <TableCell className="text-xs">{s.sale_date}</TableCell>
                      <TableCell className="text-sm">
                        {s.description || "Booking"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${s.is_refund ? "text-red-600" : ""}`}
                      >
                        ${Number(s.sale_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {s.is_refund ? (
                          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 rounded-full text-xs">
                            Refund
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full text-xs">
                            Sale
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connect / Update Bank Account Dialog (Stripe Elements) */}
      <Dialog
        open={bankDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBankDialogOpen(false);
            setSetupClientSecret(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Connect Bank Account
            </DialogTitle>
            <DialogDescription>
              Securely add a bank account (ACH preferred) or credit card for
              automatic weekly royalty collection. This uses Veydra's dedicated
              royalty account.
            </DialogDescription>
          </DialogHeader>
          {setupClientSecret && royaltyPublishableKey && royaltyStripe && (
            <Elements
              stripe={royaltyStripe}
              options={{
                clientSecret: setupClientSecret,
                appearance: { theme: "stripe" },
              }}
            >
              <OwnerBankSetupForm
                onDone={() => {
                  setBankDialogOpen(false);
                  setSetupClientSecret(null);
                  setRoyaltyStripe(null);
                  queryClient.invalidateQueries({
                    queryKey: ["owner-territory", user?.id],
                  });
                }}
              />
            </Elements>
          )}
          {!royaltyPublishableKey && setupClientSecret && (
            <div className="flex items-center justify-center py-8 text-amber-600 text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading royalty
              Stripe account...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Owner Bank Account Setup Form (inside Elements provider) ───
function OwnerBankSetupForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether the Payment Element has fully mounted and is ready for submission
  const [elementsReady, setElementsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError("Stripe has not loaded yet. Please wait a moment.");
      return;
    }

    // Guard: don't submit until PaymentElement is mounted and ready
    if (!elementsReady) {
      setError("Payment form is still loading. Please wait...");
      return;
    }

    setSubmitting(true);

    try {
      // Use "if_required" so we stay in-page instead of redirecting the frame.
      // In the preview iframe, top-frame navigation is blocked, which would
      // throw "Failed to set a named property 'href' on 'Location'".
      const { setupIntent, error: confirmError } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.origin + "/owner/royalty?setup=complete",
        },
      });

      if (confirmError) {
        setError(confirmError.message || "Failed to connect bank account.");
        return;
      }

      // Success — attach the payment method to the territory customer so the
      // processor can charge it later. FATAL: if persisting fails, the UI would
      // keep showing "No payment method" even though Stripe confirmed.
      if (setupIntent?.payment_method) {
        try {
          await api.connectTerritoryStripe(setupIntent.payment_method);
        } catch (attachErr: any) {
          setError(
            attachErr?.message ||
              "Bank authorized, but we couldn't save it to your territory. Please redeploy the royalty-processor edge function and try again.",
          );
          return;
        }
      }
      onDone();
    } catch (err: any) {
      setError(
        err?.message || "An unexpected error occurred. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: { type: "accordion", defaultCollapsed: false },
          paymentMethodOrder: ["us_bank_account", "card"],
        }}
        onReady={() => setElementsReady(true)}
        onChange={(e: any) => {
          if (e.error) {
            setError(e.error.message);
          } else {
            setError(null);
          }
        }}
      />
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || !elementsReady || submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...
          </>
        ) : !elementsReady ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading secure
            form...
          </>
        ) : (
          <>
            <Landmark className="mr-2 h-4 w-4" /> Connect Bank Account
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Your bank details are encrypted by Stripe and never stored on our
        servers.
      </p>
    </form>
  );
}
