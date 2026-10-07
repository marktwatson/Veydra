import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { applyRoyaltyPayback } from "@/lib/royalty-payback";
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
  Loader2,
  Crown,
  Settings,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  Lock,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";

import { RoyaltyNextPullCard } from "@/components/RoyaltyNextPullCard";
import { RoyaltyBankDialog } from "@/components/manager/RoyaltyBankDialog";
import { RoyaltyBackupCard } from "@/components/RoyaltyBackupCard";
import { PeriodDetailsDialog } from "@/components/royalty/PeriodDetailsDialog";
import { TerritoryEditForm } from "@/components/royalty/TerritoryEditForm";
import { RoyaltySetupForm } from "@/components/royalty/RoyaltySetupForm";
import { RoyaltyStripeAccountCard } from "@/components/royalty/RoyaltyStripeAccountCard";
import {
  RoyaltyLoadingState,
  RoyaltyNoAreaState,
} from "@/components/royalty/RoyaltyGuards";
import { RoyaltySeedSaleDialog } from "@/components/royalty/RoyaltySeedSaleDialog";
import {
  RoyaltyAdjustPeriodDialog,
  RoyaltyAdjustBalanceDialog,
} from "@/components/royalty/RoyaltyAdjustDialogs";
import { RoyaltyProjectionCard } from "@/components/royalty/RoyaltyProjectionCard";
import { RoyaltyPeriodsTable } from "@/components/royalty/RoyaltyPeriodsTable";
import { RoyaltyGlobalSettingsCard } from "@/components/royalty/RoyaltyGlobalSettingsCard";
import { useRoyaltyTerritory } from "@/lib/use-royalty-territory";

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

  // Territory resolution lives in a focused hook (see use-royalty-territory.ts):
  //  - Super admin (role only) → header SuperAdminAreaSwitcher id, else primary.
  //  - Owner / manager → managers.territory_id, NO Honeysuckle fallback.
  const {
    isSuperAdmin,
    primaryTerritory,
    loadingPrimary,
    managerTerritoryId,
    loadingManagerTerritory,
    managerTerritoryLoaded,
    effectiveTerritoryId,
  } = useRoyaltyTerritory();

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
        await applyRoyaltyPayback(adjustingPeriod.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["royalty-periods"] });
      queryClient.invalidateQueries({ queryKey: ["royalty-territory"] });
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

  if (
    loadingPrimary ||
    (!isSuperAdmin && loadingManagerTerritory) ||
    loadingTerr
  ) {
    return <RoyaltyLoadingState />;
  }

  // Owner / manager with no territory assigned → do NOT load Honeysuckle
  // royalty. Show a clear "No area assigned" state instead.
  if (!isSuperAdmin && managerTerritoryLoaded && !managerTerritoryId) {
    return <RoyaltyNoAreaState />;
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
    return <RoyaltyLoadingState />;
  }

  const remainingBalance = Number(territory.remaining_balance || 0);
  const purchasePrice = Number(territory.purchase_price || 0);
  const paidOff =
    purchasePrice > 0 ? Math.max(0, purchasePrice - remainingBalance) : 0;
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
                {purchasePrice > 0
                  ? `$${paidOff.toLocaleString()} paid off`
                  : "Purchase price not set"}
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
      <RoyaltyProjectionCard
        upcomingSales={upcomingSales}
        upcomingGross={upcomingGross}
        royaltyPct={royaltyPct}
        paybackPct={paybackPct}
        projectedRoyalty={projectedRoyalty}
        projectedPayback={projectedPayback}
        rawPayback={rawPayback}
        remainingBalance={remainingBalance}
        projectedTotal={projectedTotal}
      />

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
          <RoyaltyPeriodsTable
            periods={periods}
            loadingPeriods={loadingPeriods}
            onDetails={(p) => setDetailsPeriod(p)}
            onMarkPaid={(p) => {
              setAdjustingPeriod(p);
              setAdjustAction("markPaid");
            }}
            onWaive={(p) => {
              setAdjustingPeriod(p);
              setAdjustAction("waive");
            }}
          />
        </TabsContent>

        {/* Global Settings */}
        <TabsContent value="settings">
          <RoyaltyGlobalSettingsCard
            settings={settings}
            onUpdate={(updates) => updateSettingsMutation.mutate(updates)}
          />

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
      <RoyaltyAdjustPeriodDialog
        open={!!adjustingPeriod}
        onOpenChange={(o) => !o && setAdjustingPeriod(null)}
        period={adjustingPeriod}
        action={adjustAction}
        reason={adjustReason}
        setReason={setAdjustReason}
        pending={adjustPeriodMutation.isPending}
        onConfirm={() => adjustPeriodMutation.mutate()}
      />

      {/* Adjust Balance Dialog */}
      <RoyaltyAdjustBalanceDialog
        open={balanceOpen}
        onOpenChange={(o) => !o && setBalanceOpen(false)}
        territoryName={territory.name}
        currentBalance={Number(territory?.remaining_balance || 0)}
        newBalance={newBalance}
        setNewBalance={setNewBalance}
        reason={balanceReason}
        setReason={setBalanceReason}
        pending={adjustBalanceMutation.isPending}
        onSave={() => adjustBalanceMutation.mutate()}
      />

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
      <RoyaltySeedSaleDialog
        open={seedOpen}
        onOpenChange={(o) => !o && setSeedOpen(false)}
        seedAmount={seedAmount}
        setSeedAmount={setSeedAmount}
        seedNote={seedNote}
        setSeedNote={setSeedNote}
        royaltyPct={Number(territory.royalty_percentage || 0)}
        paybackPct={Number(territory.payback_percentage || 0)}
        pending={seedSaleMutation.isPending}
        onSeed={() => seedSaleMutation.mutate()}
      />
    </div>
  );
}
