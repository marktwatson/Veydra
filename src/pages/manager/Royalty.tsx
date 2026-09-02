import { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsTrigger, TabsList } from "@/components/ui/tabs";
import {
  DollarSign,
  Loader2,
  Crown,
  Settings,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RotateCcw,
  Receipt,
  Lock,
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

// NOTE: Royalty collections use a SEPARATE Stripe account from bride booking
// payments. The publishable key for the royalty account is fetched dynamically
// from the edge function (stored in royalty_settings by Super Admin), so we
// do NOT hardcode a publishable key here. The Stripe instance is created
// lazily inside the bank-setup dialog once the key is known.

// This instance manages royalty for ONE territory only.
// The "territories" table row with is_primary = true is this instance's own territory.
// Super Admins configure royalty %, payback %, purchase price, remaining balance.
// Owners see their own dashboard at /owner/royalty.
// Managers see nothing.

export default function RoyaltyManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedAmount, setSeedAmount] = useState("");
  const [seedNote, setSeedNote] = useState("");
  const [adjustingPeriod, setAdjustingPeriod] = useState<any>(null);
  const [adjustAction, setAdjustAction] = useState<"waive" | "markPaid">(
    "waive",
  );
  const [adjustReason, setAdjustReason] = useState("");
  const [detailsPeriod, setDetailsPeriod] = useState<any>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [balanceReason, setBalanceReason] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch THIS instance's own territory (is_primary = true)
  const { data: territory, isLoading: loadingTerr } = useQuery({
    queryKey: ["royalty-territory"],
    queryFn: api.getOwnRoyaltyTerritory,
  });

  const { data: periods = [], isLoading: loadingPeriods } = useQuery({
    queryKey: ["royalty-periods", territory?.id],
    queryFn: () => api.getRoyaltyPeriods(territory!.id),
    enabled: !!territory?.id,
  });

  const { data: settings } = useQuery({
    queryKey: ["royalty-settings"],
    queryFn: api.getRoyaltySettings,
  });

  const { data: auditLog = [] } = useQuery({
    queryKey: ["royalty-audit", territory?.id],
    queryFn: () => api.getRoyaltyAuditLog(territory!.id),
    enabled: !!territory?.id,
  });

  // All raw sales rows (for the upcoming/projection breakdown)
  const { data: allSales = [] } = useQuery({
    queryKey: ["royalty-sales", territory?.id],
    queryFn: () => api.getRoyaltySales(territory!.id),
    enabled: !!territory?.id,
  });

  const updateTerritoryMutation = useMutation({
    mutationFn: async (updates: any) => {
      await api.updateRoyaltyTerritory(territory!.id, updates);
      await api.createRoyaltyAuditLog({
        territory_id: territory!.id,
        action: "update_settings",
        field_changed: Object.keys(updates).join(", "),
        old_value: "",
        new_value: JSON.stringify(updates),
        reason: "Super Admin edit",
        performed_by: user?.email || "unknown",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["royalty-territory"] });
      toast({
        title: "Settings Saved",
        description: "Royalty configuration updated.",
      });
      setEditOpen(false);
    },
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message,
      }),
  });

  const adjustPeriodMutation = useMutation({
    mutationFn: async () => {
      if (!adjustingPeriod) return;
      if (adjustAction === "waive") {
        await api.waiveRoyaltyPeriod(
          adjustingPeriod.id,
          adjustReason,
          user?.email || "unknown",
        );
      } else {
        await api.markRoyaltyPeriodPaid(
          adjustingPeriod.id,
          adjustReason,
          user?.email || "unknown",
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["royalty-periods"] });
      toast({
        title: "Period Adjusted",
        description: "The royalty period has been updated.",
      });
      setAdjustingPeriod(null);
      setAdjustReason("");
    },
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Adjustment Failed",
        description: err.message,
      }),
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async () => {
      if (!territory) return;
      await api.adjustTerritoryBalance(
        territory.id,
        parseFloat(newBalance),
        balanceReason,
        user?.email || "unknown",
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["royalty-territory"] });
      toast({
        title: "Balance Adjusted",
        description: "Remaining balance has been updated.",
      });
      setBalanceOpen(false);
      setNewBalance("");
      setBalanceReason("");
    },
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Adjustment Failed",
        description: err.message,
      }),
  });

  const triggerProcessorMutation = useMutation({
    mutationFn: async (force: boolean) => {
      return await api.triggerRoyaltyProcessor(territory?.id, force);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["royalty-periods"] });
      queryClient.invalidateQueries({ queryKey: ["royalty-territory"] });
      toast({
        title: "Processor Complete",
        description: `Processed: ${data.processed}, Succeeded: ${data.succeeded}, Failed: ${data.failed}`,
      });
    },
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Processor Failed",
        description: err.message,
      }),
  });

  // Seed a fake test sale into royalty_sales (dated today) so the processor
  // has something to sum + charge. Testing only — no real booking involved.
  const seedSaleMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(seedAmount);
      if (!amt || amt <= 0) throw new Error("Enter a positive amount");
      return await api.seedTestSale(amt, seedNote || undefined);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["royalty-sales"] });
      queryClient.invalidateQueries({ queryKey: ["royalty-periods"] });
      toast({
        title: "Test Sale Seeded",
        description: data?.message || `Seeded $${seedAmount} test sale.`,
      });
      setSeedOpen(false);
      setSeedAmount("");
      setSeedNote("");
    },
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Seed Failed",
        description: err.message,
      }),
  });

  // Connect bank account via Stripe SetupIntent (uses the separate royalty
  // Stripe account, NOT the bride booking payments account)
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
  const [stripeLoadError, setStripeLoadError] = useState<string | null>(null);

  const connectBankMutation = useMutation({
    mutationFn: async () => {
      return await api.createRoyaltySetupIntent();
    },
    onSuccess: async (data: any) => {
      if (data.client_secret) {
        setSetupClientSecret(data.client_secret);
        // Use the publishable key returned by the edge function (royalty account).
        // Fall back to fetching it explicitly if the setup intent didn't include it.
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
          try {
            const instance = await loadStripe(pk);
            if (instance) {
              setRoyaltyStripe(instance);
              setStripeLoadError(null);
              setBankDialogOpen(true);
            } else {
              throw new Error(
                "loadStripe returned null — invalid publishable key?",
              );
            }
          } catch (err: any) {
            console.error("loadStripe error:", err);
            setStripeLoadError(
              err.message ||
                "Failed to initialize Stripe JS. Check that your key starts with pk_test_ or pk_live_.",
            );
            // Still open dialog so user can see the error
            setBankDialogOpen(true);
          }
        } else {
          toast({
            variant: "destructive",
            title: "Setup Failed",
            description:
              "No royalty Stripe publishable key configured. Ask a Super Admin to add it in Royalty Settings.",
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Setup Failed",
          description: data?.error || "No client secret returned from server.",
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

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: any) => {
      await api.updateRoyaltySettings(updates);
      await api.createRoyaltyAuditLog({
        action: "update_global_settings",
        field_changed: Object.keys(updates).join(", "),
        old_value: "",
        new_value: JSON.stringify(updates),
        reason: "Super Admin edit",
        performed_by: user?.email || "unknown",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["royalty-settings"] });
      toast({
        title: "Settings Saved",
        description: "Global royalty settings updated.",
      });
    },
    onError: (err: any) =>
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err.message,
      }),
  });

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

  if (loadingTerr) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!territory) {
    return (
      <RoyaltySetupForm
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["royalty-territory"] })
        }
      />
    );
  }

  const remainingBalance = Number(territory.remaining_balance || 0);
  const purchasePrice = Number(territory.purchase_price || 0);
  const paidOff = purchasePrice - remainingBalance;
  const progressPct =
    purchasePrice > 0
      ? Math.min(100, Math.round((paidOff / purchasePrice) * 100))
      : 0;
  const totalCollected = periods
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + (Number(p.total_due) || 0), 0);
  const failedCount = periods.filter((p: any) => p.status === "failed").length;

  // ─── Upcoming / projected royalty breakdown ───
  // Sum all sales in the current (not-yet-processed) 7-day window to show what
  // the NEXT processor run will calculate + charge.
  const royaltyPct = Number(territory.royalty_percentage || 0);
  const paybackPct = Number(territory.payback_percentage || 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - 7);
  const windowStartStr = windowStart.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  const upcomingSales = (allSales as any[]).filter(
    (s) =>
      s.sale_date >= windowStartStr &&
      s.sale_date <= todayStr &&
      !s.processed_period_id,
  );
  // Royalty rule: refunds NEVER count toward royalty — only processed sales.
  const upcomingGross = upcomingSales.reduce(
    (sum, s) => sum + (s.is_refund ? 0 : Number(s.sale_amount)),
    0,
  );
  const projectedRoyalty = Math.max(0, upcomingGross * (royaltyPct / 100));
  const rawPayback = Math.max(0, upcomingGross * (paybackPct / 100));
  const projectedPayback = Math.min(rawPayback, remainingBalance);
  const projectedTotal = projectedRoyalty + projectedPayback;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Crown className="h-7 w-7 text-amber-500" /> Royalty & Payback
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage this territory's royalty percentages, payback balance, and
            weekly processing.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => triggerProcessorMutation.mutate(false)}
            disabled={triggerProcessorMutation.isPending}
          >
            {triggerProcessorMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Weekly Processor
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setEditOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" /> Edit Settings
          </Button>
          {!(
            territory.primary_payment_method_id ||
            territory.stripe_payment_method_id
          ) && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => connectBankMutation.mutate()}
            >
              {connectBankMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Connect Bank Account
            </Button>
          )}
          {(territory.primary_payment_method_id ||
            territory.stripe_payment_method_id) && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => connectBankMutation.mutate()}
            >
              {connectBankMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Update Payment Method
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border/40 rounded-2xl bg-amber-500/5 border-amber-500/20">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-amber-600 uppercase tracking-wider">
              Remaining Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-amber-600">
              ${remainingBalance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/40 rounded-2xl bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
              Total Collected
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-emerald-600">
              ${totalCollected.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Royalty Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold">
              {Number(territory.royalty_percentage || 0).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              + {Number(territory.payback_percentage || 0).toFixed(2)}% payback
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/40 rounded-2xl bg-red-500/5 border-red-500/20">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-red-600 uppercase tracking-wider">
              Failed Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Payback Progress */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold">
            Payback Progress — {territory.name}
          </CardTitle>
          <CardDescription className="text-xs">
            How close this territory's purchase is to being paid off.
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

      {/* Upcoming / Projected Royalty Breakdown */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" /> Upcoming Royalty
            Projection
          </CardTitle>
          <CardDescription className="text-xs">
            Sales recorded in the last 7 days that the next processor run will
            calculate and charge. Run the processor to lock these into a period.
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
              <Receipt className="h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm">
                No sales recorded in the last 7 days. Use "Seed Test Sale" to
                add one.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-full">
          <TabsTrigger value="overview" className="rounded-full">
            Payment History
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-full">
            Global Settings
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-full">
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Payment History */}
        <TabsContent value="overview">
          <Card className="shadow-sm border-border/40 rounded-2xl bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold">
                Royalty Periods
              </CardTitle>
              <CardDescription className="text-xs">
                Complete ledger of every weekly calculation for this territory.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingPeriods ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : periods.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Receipt className="h-10 w-10 opacity-40 mb-2" />
                  <p>No royalty periods calculated yet.</p>
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
                          Total Due
                        </TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right pr-6">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periods.map((p: any) => (
                        <TableRow key={p.id} className="hover:bg-muted/20">
                          <TableCell className="text-xs">
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
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-full text-xs"
                                onClick={() => setDetailsPeriod(p)}
                              >
                                <Receipt className="h-3.5 w-3.5 mr-1" />
                                Details
                              </Button>
                              {p.status !== "paid" && p.status !== "waived" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-full text-xs text-emerald-600"
                                    onClick={() => {
                                      setAdjustingPeriod(p);
                                      setAdjustAction("markPaid");
                                    }}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                    Mark Paid
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-full text-xs text-purple-600"
                                    onClick={() => {
                                      setAdjustingPeriod(p);
                                      setAdjustAction("waive");
                                    }}
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-1" />
                                    Waive
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Settings */}
        <TabsContent value="settings">
          <Card className="shadow-sm border-border/40 rounded-2xl bg-card max-w-2xl">
            <CardHeader className="p-5 pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Global Royalty Settings
              </CardTitle>
              <CardDescription className="text-xs">
                Weekly processing schedule, retry rules, and Stripe status.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {settings && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Processing Day</Label>
                      <Select
                        value={String(settings.processing_day_of_week)}
                        onValueChange={(v) =>
                          updateSettingsMutation.mutate({
                            processing_day_of_week: parseInt(v),
                          })
                        }
                      >
                        <SelectTrigger className="rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Processing Time (portal timezone)</Label>
                      <Input
                        className="rounded-full"
                        defaultValue={settings.processing_time}
                        onBlur={(e) =>
                          updateSettingsMutation.mutate({
                            processing_time: e.target.value,
                          })
                        }
                        placeholder="09:00"
                      />
                      <p className="text-xs text-muted-foreground">
                        Interpreted in your portal timezone. Scheduler auto-runs
                        on this day at/after this time. One run per week —
                        safeguarded against double charges.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Retry Count</Label>
                      <Input
                        type="number"
                        className="rounded-full"
                        defaultValue={settings.retry_count}
                        onBlur={(e) =>
                          updateSettingsMutation.mutate({
                            retry_count: parseInt(e.target.value) || 3,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Retry Delay (hours)</Label>
                      <Input
                        type="number"
                        className="rounded-full"
                        defaultValue={settings.retry_delay_hours}
                        onBlur={(e) =>
                          updateSettingsMutation.mutate({
                            retry_delay_hours: parseInt(e.target.value) || 24,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notification Email</Label>
                    <Input
                      className="rounded-full"
                      defaultValue={settings.notify_email || ""}
                      onBlur={(e) =>
                        updateSettingsMutation.mutate({
                          notify_email: e.target.value,
                        })
                      }
                      placeholder="admin@veydra.com"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                    {settings.stripe_royalty_configured ||
                    settings.stripe_connected ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Stripe Connected
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 rounded-full">
                        <XCircle className="h-3 w-3 mr-1" />
                        Stripe Not Connected
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Royalty Stripe Account — separate from bride booking payments */}
          <RoyaltyStripeAccountCard
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["royalty-settings"] });
              queryClient.invalidateQueries({
                queryKey: ["royalty-territory"],
              });
            }}
          />
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit">
          <Card className="shadow-sm border-border/40 rounded-2xl bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Audit Trail
              </CardTitle>
              <CardDescription className="text-xs">
                Every Super Admin change to percentages, balances, or statuses.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {auditLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Lock className="h-10 w-10 opacity-40 mb-2" />
                  <p>No audit entries yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Action</TableHead>
                        <TableHead className="font-semibold">Field</TableHead>
                        <TableHead className="font-semibold">
                          Old → New
                        </TableHead>
                        <TableHead className="font-semibold">Reason</TableHead>
                        <TableHead className="font-semibold">By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLog.map((a: any) => (
                        <TableRow key={a.id} className="hover:bg-muted/20">
                          <TableCell className="text-xs">
                            {new Date(a.performed_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {a.action}
                          </TableCell>
                          <TableCell className="text-xs">
                            {a.field_changed || "—"}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {a.old_value || "—"} → {a.new_value || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {a.reason || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {a.performed_by}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Territory Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => !open && setEditOpen(false)}
      >
        <DialogContent className="sm:max-w-[520px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit Royalty: {territory.name}</DialogTitle>
            <DialogDescription>
              Configure royalty and payback percentages, purchase details, and
              Stripe connection.
            </DialogDescription>
          </DialogHeader>
          <TerritoryEditForm
            territory={territory}
            onSave={(updates) => updateTerritoryMutation.mutate(updates)}
            saving={updateTerritoryMutation.isPending}
            onAdjustBalance={() => {
              setEditOpen(false);
              setBalanceOpen(true);
              setNewBalance(String(territory.remaining_balance || 0));
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Adjust Period Dialog */}
      <Dialog
        open={!!adjustingPeriod}
        onOpenChange={(open) => !open && setAdjustingPeriod(null)}
      >
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {adjustAction === "waive"
                ? "Waive Royalty Period"
                : "Mark Period as Paid"}
            </DialogTitle>
            <DialogDescription>
              {adjustAction === "waive"
                ? "This will zero out the amounts for this period. A reason is required for the audit log."
                : "This will mark the period as paid. A reason is required for the audit log."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/40 p-3 rounded-xl text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period:</span>
                <span>
                  {adjustingPeriod?.period_start} →{" "}
                  {adjustingPeriod?.period_end}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Due:</span>
                <span className="font-bold">
                  ${Number(adjustingPeriod?.total_due || 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason (required for audit log)</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Manual check received via wire transfer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setAdjustingPeriod(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={() => adjustPeriodMutation.mutate()}
              disabled={adjustPeriodMutation.isPending || !adjustReason.trim()}
            >
              {adjustPeriodMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Dialog */}
      <Dialog
        open={balanceOpen}
        onOpenChange={(open) => !open && setBalanceOpen(false)}
      >
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              Adjust Remaining Balance: {territory.name}
            </DialogTitle>
            <DialogDescription>
              Manually adjust the payback remaining balance. A reason is
              required for the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/40 p-3 rounded-xl text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Balance:</span>
                <span className="font-bold">
                  ${Number(territory?.remaining_balance || 0).toLocaleString()}
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
                value={balanceReason}
                onChange={(e) => setBalanceReason(e.target.value)}
                placeholder="e.g. Correcting initial balance after down payment adjustment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setBalanceOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={() => adjustBalanceMutation.mutate()}
              disabled={
                adjustBalanceMutation.isPending ||
                !balanceReason.trim() ||
                !newBalance
              }
            >
              {adjustBalanceMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Period Details Dialog — breakdown of charges + contributing sales */}
      <PeriodDetailsDialog
        period={detailsPeriod}
        territoryId={territory?.id}
        onClose={() => setDetailsPeriod(null)}
      />

      {/* Connect Bank Account Dialog (Stripe Elements) */}
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
              automatic weekly royalty collection.
            </DialogDescription>
          </DialogHeader>
          {stripeLoadError ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm font-medium text-red-600">
                Stripe Failed to Load
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {stripeLoadError}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBankDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          ) : setupClientSecret && royaltyPublishableKey && royaltyStripe ? (
            <Elements
              stripe={royaltyStripe}
              options={{
                clientSecret: setupClientSecret,
                appearance: { theme: "stripe" },
              }}
            >
              <BankSetupForm
                clientSecret={setupClientSecret}
                publishableKey={royaltyPublishableKey}
                onDone={() => {
                  setBankDialogOpen(false);
                  setSetupClientSecret(null);
                  queryClient.invalidateQueries({
                    queryKey: ["royalty-territory"],
                  });
                }}
                onError={(msg: string) => setStripeLoadError(msg)}
              />
            </Elements>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                Initializing secure payment form...
              </p>
              <p className="text-xs text-muted-foreground/70 max-w-xs">
                Connecting to Stripe. This should only take a moment.
              </p>
            </div>
          )}
          {!royaltyPublishableKey && setupClientSecret && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="flex items-center text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4 mr-2" /> Royalty Stripe account
                not configured
              </div>
              <p className="text-xs text-muted-foreground max-w-xs">
                A Super Admin must add the royalty Stripe publishable key
                (pk_...) and secret key (sk_...) in the Royalty Stripe Account
                card below before a bank account can be connected.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBankDialogOpen(false);
                  setSetupClientSecret(null);
                }}
              >
                Close
              </Button>
            </div>
          )}
          {!setupClientSecret && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure
              connection...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Seed Test Sale Dialog (testing tool — no real booking) */}
      <Dialog
        open={seedOpen}
        onOpenChange={(open) => !open && setSeedOpen(false)}
      >
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
              {(
                parseFloat(seedAmount || "0") *
                (Number(territory.royalty_percentage || 0) / 100)
              ).toFixed(2)}{" "}
              royalty
              {" + "}$
              {(
                parseFloat(seedAmount || "0") *
                (Number(territory.payback_percentage || 0) / 100)
              ).toFixed(2)}{" "}
              payback.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => seedSaleMutation.mutate()}
              disabled={seedSaleMutation.isPending}
            >
              {seedSaleMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="h-4 w-4 mr-2" />
              )}
              Seed Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Period Details Dialog — full breakdown of a single royalty period ───
function PeriodDetailsDialog({
  period,
  territoryId,
  onClose,
}: {
  period: any;
  territoryId?: string;
  onClose: () => void;
}) {
  const { data: allSales = [] } = useQuery({
    queryKey: ["royalty-sales", territoryId],
    queryFn: () => api.getRoyaltySales(territoryId!),
    enabled: !!territoryId,
  });

  if (!period) return null;

  const grossSales = Number(period.gross_sales || 0);
  const royaltyAmount = Number(period.royalty_amount || 0);
  const paybackAmount = Number(period.payback_amount || 0);
  const totalDue = Number(period.total_due || 0);
  const royaltyPct = grossSales > 0 ? (royaltyAmount / grossSales) * 100 : 0;
  const paybackPct = grossSales > 0 ? (paybackAmount / grossSales) * 100 : 0;

  // Sales locked to THIS period (processed_period_id match)
  const periodSales = (allSales as any[]).filter(
    (s) => s.processed_period_id === period.id,
  );

  const breakdownRows = [
    {
      label: "Gross Sales",
      sub:
        periodSales.length > 0
          ? `${periodSales.length} sale${periodSales.length === 1 ? "" : "s"} in period`
          : "No individual sales locked",
      value: grossSales,
      color: "text-foreground",
    },
    {
      label: "Royalty",
      sub: `${royaltyPct.toFixed(2)}% of gross`,
      value: royaltyAmount,
      color: "text-blue-600",
    },
    {
      label: "Payback",
      sub: `${paybackPct.toFixed(2)}% of gross`,
      value: paybackAmount,
      color: "text-amber-600",
    },
    {
      label: "Total Charged",
      sub: "Collected via Stripe",
      value: totalDue,
      color: "text-emerald-600",
      bold: true,
    },
  ];

  return (
    <Dialog open={!!period} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] rounded-3xl flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Royalty Period Breakdown
          </DialogTitle>
          <DialogDescription>
            {period.period_start} → {period.period_end}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Status + metadata */}
          <div className="flex items-center justify-between gap-3 bg-muted/30 rounded-xl p-3">
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Status</p>
              <p className="font-semibold capitalize">{period.status}</p>
            </div>
            {period.paid_at && (
              <div className="text-sm text-right">
                <p className="text-muted-foreground text-xs">Paid</p>
                <p className="font-semibold text-sm">
                  {new Date(period.paid_at).toLocaleDateString()}
                </p>
              </div>
            )}
            {period.stripe_payment_intent_id && (
              <div className="text-sm text-right max-w-[140px]">
                <p className="text-muted-foreground text-xs">Stripe PI</p>
                <p className="font-mono text-xs truncate">
                  {period.stripe_payment_intent_id}
                </p>
              </div>
            )}
          </div>

          {/* Charge breakdown */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Charge Breakdown
            </p>
            {breakdownRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0"
              >
                <div>
                  <p
                    className={`text-sm ${row.bold ? "font-bold" : "font-medium"}`}
                  >
                    {row.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.sub}</p>
                </div>
                <p
                  className={`text-base ${row.bold ? "font-bold" : "font-semibold"} ${row.color}`}
                >
                  $
                  {row.value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))}
          </div>

          {/* Contributing sales */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sales in This Period ({periodSales.length})
            </p>
            {periodSales.length > 0 ? (
              <div className="border border-border/40 rounded-xl divide-y divide-border/30 max-h-52 overflow-y-auto">
                {periodSales.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">
                        {s.is_refund ? "Refund" : "Sale"} —{" "}
                        {s.description || "No description"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.sale_date}
                      </span>
                    </div>
                    <span
                      className={`font-semibold shrink-0 ml-2 ${s.is_refund ? "text-red-600" : "text-emerald-600"}`}
                    >
                      {s.is_refund ? "-" : "+"}$
                      {Number(s.sale_amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted/20 rounded-xl p-4 text-center">
                No individual sales were locked to this period. It may have been
                created manually or before sales tracking was enabled.
              </div>
            )}
          </div>

          {period.notes && (
            <div className="bg-muted/30 rounded-xl p-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Notes
              </p>
              <p>{period.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 shrink-0">
          <Button variant="outline" className="rounded-full" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TerritoryEditForm({
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

// ─── Setup form shown when no primary territory exists yet ───
function RoyaltySetupForm({ onCreated }: { onCreated: () => void }) {
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

// ─── Stripe Bank Account Setup Form (inside Elements provider) ───
function BankSetupForm({
  onDone,
  onError,
  clientSecret,
  publishableKey,
}: {
  onDone: () => void;
  onError?: (msg: string) => void;
  clientSecret: string;
  publishableKey: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether the Payment Element has fully mounted and is ready for submission
  const [elementsReady, setElementsReady] = useState(false);

  // Safety timeout: if the PaymentElement hasn't signalled ready in 12s, the
  // Stripe Elements load likely failed (400 key/account mismatch). Show a clear
  // error instead of spinning forever.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!elementsReady) {
        const msg =
          "Stripe could not load the payment form. This usually means the publishable key and secret key are from different Stripe accounts (e.g. one test, one live). Go to Royalty → Global Settings and make sure BOTH keys are from the same Stripe account and same mode.";
        setError(msg);
        onError?.(msg);
      }
    }, 12000);
    return () => clearTimeout(t);
  }, [elementsReady, clientSecret, publishableKey, onError]);

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
          return_url:
            window.location.origin + "/manager/royalty?setup=complete",
        },
      });

      if (confirmError) {
        setError(confirmError.message || "Failed to connect bank account.");
        return;
      }

      // Success — attach the payment method to the territory customer so the
      // processor can charge it later. This is FATAL: if persisting fails, the
      // UI would keep showing "No payment method" even though Stripe confirmed.
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

// ─── Royalty Stripe Account settings (Super Admin only) ───
// This is a SEPARATE Stripe account used to collect royalty + payback from
// territory owners. It is distinct from the Stripe account that processes
// bride booking payments. Keys are stored server-side in royalty_settings and
// only the publishable key is ever exposed to the browser.
function RoyaltyStripeAccountCard({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["royalty-settings"],
    queryFn: api.getRoyaltySettings,
  });

  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  // The secret key lives in royalty_secrets (RLS-locked) and is never returned
  // to the browser. We only know if it's configured via the stripe_royalty_configured flag.
  const hasKeysConfigured = !!(
    settings?.stripe_royalty_configured ||
    settings?.stripe_royalty_publishable_key
  );

  const handleSave = async () => {
    if (!secretKey && !publishableKey && !webhookSecret) {
      toast({
        variant: "destructive",
        title: "Nothing to Save",
        description: "Enter at least one key to update.",
      });
      return;
    }
    setSaving(true);
    try {
      const result: any = await api.setRoyaltyStripeKeys({
        secret_key: secretKey || undefined,
        publishable_key: publishableKey || undefined,
        webhook_secret: webhookSecret || undefined,
      });
      toast({
        title: "Royalty Stripe Keys Saved",
        description: result?.account
          ? `Connected to ${result.account.businessName || result.account.id} (${result.account.isTest ? "test" : "live"} mode).`
          : "Keys updated successfully.",
      });
      setSecretKey("");
      setPublishableKey("");
      setWebhookSecret("");
      // Invalidate so the card re-fetches and shows "Configured" state
      queryClient.invalidateQueries({ queryKey: ["royalty-settings"] });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm border-border/40 rounded-2xl bg-card max-w-2xl mt-6">
      <CardHeader className="p-5 pb-3 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Royalty Stripe Account
        </CardTitle>
        <CardDescription className="text-xs">
          This is a separate Stripe account for collecting royalty + payback
          payments from territory owners. It is NOT the account used for bride
          booking payments. Keys are stored securely server-side.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          {hasKeysConfigured ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
              <CheckCircle className="h-3 w-3 mr-1" />
              Royalty Stripe Account Configured
            </Badge>
          ) : (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not Configured — owners cannot connect bank accounts until set
            </Badge>
          )}
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Enter the keys from your dedicated HQ royalty Stripe account. Leave
            a field blank to keep the existing value. The secret key is never
            shown again after saving.
          </span>
        </div>

        <div className="space-y-2">
          <Label>Secret Key (sk_live_... or sk_test_...)</Label>
          <div className="flex gap-2">
            <Input
              type={showSecret ? "text" : "password"}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={
                settings?.stripe_royalty_configured
                  ? "•••••••• (stored securely — enter new key to replace)"
                  : "sk_live_..."
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full shrink-0"
              onClick={() => setShowSecret((s) => !s)}
            >
              {showSecret ? "Hide" : "Show"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Publishable Key (pk_live_... or pk_test_...)</Label>
          <Input
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder={
              settings?.stripe_royalty_publishable_key
                ? `${settings.stripe_royalty_publishable_key.substring(0, 14)}... (stored)`
                : "pk_live_..."
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Webhook Signing Secret (whsec_...) — optional</Label>
          <Input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={
              settings?.stripe_royalty_configured
                ? "•••••••• (stored securely — enter new to replace)"
                : "whsec_..."
            }
          />
        </div>

        <Button
          className="rounded-full w-full"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4 mr-2" />
          )}
          Save Royalty Stripe Keys
        </Button>
      </CardContent>
    </Card>
  );
}
