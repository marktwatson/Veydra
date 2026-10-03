import { useState } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";

import { RoyaltyNextPullCard } from "@/components/RoyaltyNextPullCard";
import { RoyaltyBankDialog } from "@/components/manager/RoyaltyBankDialog";
import { RoyaltyBackupCard } from "@/components/RoyaltyBackupCard";
import { RoyaltyTerritorySelect } from "@/components/RoyaltyTerritorySelect";
import { PeriodDetailsDialog } from "@/components/royalty/PeriodDetailsDialog";
import { TerritoryEditForm } from "@/components/royalty/TerritoryEditForm";
import { RoyaltySetupForm } from "@/components/royalty/RoyaltySetupForm";
import { RoyaltyStripeAccountCard } from "@/components/royalty/RoyaltyStripeAccountCard";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { currentTerritoryId } from "@/lib/current-territory";

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

  const isSuperAdmin =
    user?.role === "super_admin" || isSuperAdminEmail(user?.email);

  // Primary territory = this instance's own row (Honeysuckle). Used as the
  // super-admin default and to detect first-run setup.
  const { data: primaryTerritory, isLoading: loadingPrimary } = useQuery({
    queryKey: ["royalty-territory-primary"],
    queryFn: api.getOwnRoyaltyTerritory,
  });

  // Super admin can switch areas; owner/manager is locked to their own
  // managers.territory_id (currentTerritoryId falls back to Honeysuckle, never
  // a list of all territories). Owners with no territory_id keep the primary.
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(
    null,
  );
  const { data: lockedTerritoryId } = useQuery({
    queryKey: ["royalty-locked-territory-id"],
    queryFn: () => currentTerritoryId(),
    enabled: !isSuperAdmin,
  });

  const effectiveTerritoryId = isSuperAdmin
    ? selectedTerritoryId || primaryTerritory?.id || null
    : lockedTerritoryId || primaryTerritory?.id || null;

  // Load the FULL row for the selected/locked territory (royalty %, payback,
  // balance, stripe ids, …) — not just the primary row.
  const { data: territory, isLoading: loadingTerr } = useQuery({
    queryKey: ["royalty-territory", effectiveTerritoryId],
    queryFn: () => api.getRoyaltyTerritory(effectiveTerritoryId!),
    enabled: !!effectiveTerritoryId,
  });

  const { data: periods = [], isLoading: loadingPeriods } = useQuery({
    queryKey: ["royalty-periods", effectiveTerritoryId],
    queryFn: () => api.getRoyaltyPeriods(effectiveTerritoryId!),
    enabled: !!effectiveTerritoryId,
  });

  const { data: settings } = useQuery({
    queryKey: ["royalty-settings"],
    queryFn: api.getRoyaltySettings,
  });

  const { data: auditLog = [] } = useQuery({
    queryKey: ["royalty-audit", effectiveTerritoryId],
    queryFn: () => api.getRoyaltyAuditLog(effectiveTerritoryId!),
    enabled: !!effectiveTerritoryId,
  });

  // All raw sales rows (for the upcoming/projection breakdown)
  const { data: allSales = [] } = useQuery({
    queryKey: ["royalty-sales", effectiveTerritoryId],
    queryFn: () => api.getRoyaltySales(effectiveTerritoryId!),
    enabled: !!effectiveTerritoryId,
  });

  const updateTerritoryMutation = useMutation({
    mutationFn: async (updates: any) => {
      await api.updateRoyaltyTerritory(effectiveTerritoryId!, updates);
      await api.createRoyaltyAuditLog({
        territory_id: effectiveTerritoryId,
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
        effectiveTerritoryId!,
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
      return await api.triggerRoyaltyProcessor(effectiveTerritoryId, force);
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

  if (loadingTerr || loadingPrimary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No primary territory exists at all → first-run setup.
  if (!primaryTerritory && !territory) {
    return (
      <RoyaltySetupForm
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["royalty-territory"] })
        }
      />
    );
  }

  if (!territory) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
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
  const royaltyPct = Number(territory.royalty_percentage || 0);
  const paybackPct = Number(territory.payback_percentage || 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - 7);
  const windowStartStr = windowStart.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  const saleDay = (s: any) => String(s.sale_date || "").slice(0, 10);
  const upcomingSales = (allSales as any[]).filter((s) => {
    const day = saleDay(s);
    if (day < windowStartStr || day > todayStr) return false;
    if (s.processed_period_id) return false;
    if (s.is_refund || s.is_test) return false;
    const desc = s.description || "";
    const isJunk = /backfill|seed test|manual charge/i.test(desc);
    if (isJunk && !s.stripe_charge_id) return false;
    return true;
  });
  const upcomingGross = upcomingSales.reduce(
    (sum, s) => sum + Number(s.sale_amount),
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
          {isSuperAdmin && effectiveTerritoryId && (
            <div className="mt-3">
              <RoyaltyTerritorySelect
                selectedId={effectiveTerritoryId}
                onChange={(id) => {
                  setSelectedTerritoryId(id);
                  queryClient.invalidateQueries({
                    queryKey: ["royalty-periods"],
                  });
                  queryClient.invalidateQueries({
                    queryKey: ["royalty-sales"],
                  });
                  queryClient.invalidateQueries({
                    queryKey: ["royalty-audit"],
                  });
                }}
              />
            </div>
          )}
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

      <RoyaltyNextPullCard
        settings={settings}
        onEditSchedule={() => setActiveTab("settings")}
      />

      {/* Upcoming / Projected Royalty Breakdown */}
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" /> Upcoming Royalty
            Projection
          </CardTitle>
          <CardDescription className="text-xs">
            Kept sales in the last 7 days that the next processor run will
            calculate and charge. Refunds and test sales are excluded.
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
        territoryId={effectiveTerritoryId}
        onClose={() => setDetailsPeriod(null)}
      />

      {/* Connect Bank Account Dialog (Stripe Elements) — ACH only */}
      <RoyaltyBankDialog
        open={bankDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setBankDialogOpen(false);
            setSetupClientSecret(null);
          }
        }}
        setupClientSecret={setupClientSecret}
        royaltyPublishableKey={royaltyPublishableKey}
        royaltyStripe={royaltyStripe}
        stripeLoadError={stripeLoadError}
        onDone={() => {
          setBankDialogOpen(false);
          setSetupClientSecret(null);
          queryClient.invalidateQueries({ queryKey: ["royalty-territory"] });
        }}
      />

      {/* Backup card (optional, after bank is connected) */}
      <RoyaltyBackupCard
        territory={territory}
        onSaved={() =>
          queryClient.invalidateQueries({ queryKey: ["royalty-territory"] })
        }
      />

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
