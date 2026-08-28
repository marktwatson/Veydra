import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { EDGE_FUNCTION_SOURCES } from "@/lib/edge-function-sources";

const THIS_PROJECT_REF = "oosmhtzqdmntlzhheofw";
const THIS_SUPABASE_URL = "https://oosmhtzqdmntlzhheofw.supabase.co";

const FN_IMPORTS = EDGE_FUNCTION_SOURCES;
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  Rocket,
  Database,
  Cloud,
  Star,
  Key,
  Upload,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Territory {
  id: string;
  name: string;
  project_ref: string;
  supabase_url: string;
  access_token: string;
  last_synced_at: string | null;
  last_sync_status: string;
  last_sync_result: any;
  is_primary: boolean;
  created_at: string;
}

export default function Territories() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [newTerritory, setNewTerritory] = useState({
    name: "",
    project_ref: "",
    supabase_url: "",
    access_token: "",
  });
  const [tokenDialogTerritory, setTokenDialogTerritory] =
    useState<Territory | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [manualDeployOpen, setManualDeployOpen] = useState(false);
  const [manualDeploying, setManualDeploying] = useState<string | null>(null);
  const [manualResults, setManualResults] = useState<
    Record<string, { status: string; error?: string }>
  >({});
  const [stripeGuideOpen, setStripeGuideOpen] = useState(false);
  const [syncGuideOpen, setSyncGuideOpen] = useState(false);

  const {
    data: territories = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Territory[]>({
    queryKey: ["territories"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("territories").select("*");
        if (error) {
          console.error(
            "[Territories] Query error:",
            error.message,
            error.code,
          );
          throw error;
        }
        const sorted = (data || []).sort((a, b) => {
          // This instance always first
          if (
            a.project_ref === THIS_PROJECT_REF &&
            b.project_ref !== THIS_PROJECT_REF
          )
            return -1;
          if (
            b.project_ref === THIS_PROJECT_REF &&
            a.project_ref !== THIS_PROJECT_REF
          )
            return 1;
          // Then by created_at descending
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
        return sorted;
      } catch (err) {
        console.error("[Territories] Failed to fetch:", err);
        throw err;
      }
    },
    retry: 2,
  });

  const addTerritoryMutation = useMutation({
    mutationFn: async (t: typeof newTerritory) => {
      const { error } = await supabase.from("territories").insert({
        name: t.name,
        project_ref: t.project_ref,
        supabase_url: t.supabase_url || `https://${t.project_ref}.supabase.co`,
        access_token: t.access_token,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territories"] });
      setIsAddDialogOpen(false);
      setNewTerritory({
        name: "",
        project_ref: "",
        supabase_url: "",
        access_token: "",
      });
      toast.success("Territory added", {
        description: `${newTerritory.name} is ready to sync.`,
      });
    },
    onError: (e: any) =>
      toast.error("Failed to add territory", { description: e.message }),
  });

  const deleteTerritoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("territories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territories"] });
      toast.success("Territory removed");
    },
    onError: (e: any) =>
      toast.error("Failed to delete", { description: e.message }),
  });

  const syncAll = async () => {
    // Auto-upload sources before syncing all
    await ensureSourcesUploaded();
    for (const t of territories) {
      await syncTerritory(t);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Synced
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const isThisInstanceConnected = territories.some(
    (t) => t.project_ref === THIS_PROJECT_REF,
  );

  const addThisInstance = async () => {
    const loadingToast = toast.loading(
      "Registering this instance as primary...",
    );
    try {
      const { error } = await supabase.from("territories").insert({
        name: "Veydra (Main)",
        project_ref: THIS_PROJECT_REF,
        supabase_url: THIS_SUPABASE_URL,
        access_token: "",
        is_primary: true,
        last_sync_status: "success",
      });
      if (error) throw error;
      toast.success("Main instance registered!", {
        description:
          "Add a Supabase access token to enable edge function syncing.",
        id: loadingToast,
      });
      queryClient.invalidateQueries({ queryKey: ["territories"] });
    } catch (e: any) {
      toast.error("Failed to register", {
        description: e.message,
        id: loadingToast,
      });
    }
  };

  const updateAccessToken = async (territory: Territory) => {
    setTokenDialogTerritory(territory);
    setTokenInput(territory.access_token || "");
  };

  const saveAccessToken = async () => {
    if (!tokenDialogTerritory || !tokenInput.trim()) return;
    try {
      const { error } = await supabase
        .from("territories")
        .update({ access_token: tokenInput.trim() })
        .eq("id", tokenDialogTerritory.id);
      if (error) throw error;
      toast.success("Access token saved", {
        description: "Click Sync to deploy edge functions.",
      });
      setTokenDialogTerritory(null);
      setTokenInput("");
      queryClient.invalidateQueries({ queryKey: ["territories"] });
    } catch (e: any) {
      toast.error("Failed to save token", { description: e.message });
    }
  };

  const uploadSources = async () => {
    const loadingToast = toast.loading(
      "Uploading edge function sources + master SQL to DB...",
    );
    try {
      const entries = Object.entries(FN_IMPORTS);
      for (const [name, source] of entries) {
        const { error } = await supabase
          .from("edge_function_sources")
          .upsert(
            { name, source_code: source, updated_at: new Date().toISOString() },
            { onConflict: "name" },
          );
        if (error) console.error(`Failed to upload ${name}:`, error.message);
      }
      toast.success(`${entries.length} sources uploaded!`, {
        description:
          "Edge functions + master SQL are now in DB. Click Sync to deploy.",
        id: loadingToast,
      });
    } catch (e: any) {
      toast.error("Failed to upload sources", {
        description: e.message,
        id: loadingToast,
      });
    }
  };

  // Redeploy deploy-territory to THIS instance by calling our OWN edge function
  // (server-side, no CORS issues). Deploys ONLY deploy-territory so it's fast
  // and won't time out. Once the new code is live, click Schema to push the
  // full schema using the new exec_sql_batch method.
  const redeploySelf = async () => {
    // Re-fetch latest token from DB
    const { data: thisTerritory } = await supabase
      .from("territories")
      .select("*")
      .eq("project_ref", THIS_PROJECT_REF)
      .single();
    if (!thisTerritory?.access_token) {
      toast.error("No access token", {
        description: "Add a Supabase Personal Access Token first.",
      });
      return;
    }

    // Ensure sources are uploaded first (so the DB has the latest code)
    const sourcesOk = await ensureSourcesUploaded();
    if (!sourcesOk) return;

    const loadingToast = toast.loading(
      "Updating deploy-territory function (this instance)...",
    );

    try {
      // Call our OWN edge function — it runs server-side and can call the
      // Management API without CORS issues. We deploy ONLY deploy-territory
      // (skip schema, skip other functions) for a fast, reliable update.
      const functionUrl = `${supabaseUrl}/functions/v1/deploy-territory`;
      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          territoryId: thisTerritory.id,
          projectRef: THIS_PROJECT_REF,
          accessToken: thisTerritory.access_token,
          deploySchema: false,
          deployFunctions: true,
          functionNames: ["deploy-territory"],
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(
          data.error || `HTTP ${res.status}: ${text.substring(0, 300)}`,
        );
      }

      const fnResult = data.functions?.["deploy-territory"];
      if (fnResult?.status === "success") {
        toast.success("deploy-territory updated!", {
          description:
            "New batch-sync code is live. Click Schema to push the full schema, then Sync All.",
          id: loadingToast,
          duration: 8000,
        });
        queryClient.invalidateQueries({ queryKey: ["territories"] });
      } else if (fnResult?.status === "skipped") {
        toast.warning("Function was skipped", {
          description:
            fnResult.note || "Add an access token to enable self-redeploy.",
          id: loadingToast,
        });
      } else {
        toast.error("Failed to update deploy-territory", {
          description: fnResult?.error || "Unknown error",
          id: loadingToast,
          duration: 10000,
        });
      }
    } catch (e: any) {
      toast.error("Failed to update deploy-territory", {
        description: e.message.includes("fetch")
          ? "Cannot reach the edge function. Try Manual Deploy instead."
          : e.message,
        id: loadingToast,
        duration: 10000,
      });
    }
  };

  const ALL_FUNCTION_NAMES = [
    "daily-reminders",
    "stripe-checkout",
    "stripe-invoices",
    "stripe-payout",
    "stripe-portal",
    "stripe-onboard",
    "stripe-webhook",
    "stripe-status",
    "crm-webhook",
    "process-notifications",
    "deploy-territory",
    "geocode",
    "royalty-processor",
    "royalty-summary",
    "royalty-stripe-keys",
  ];

  const deploySingleFunction = async (fnName: string) => {
    // Re-fetch latest token
    const { data: thisTerritory } = await supabase
      .from("territories")
      .select("*")
      .eq("project_ref", THIS_PROJECT_REF)
      .single();
    if (!thisTerritory?.access_token) {
      toast.error("No access token", {
        description: "Add a Supabase Personal Access Token first.",
      });
      return;
    }

    // Ensure sources are uploaded (with verification)
    const sourcesOk = await ensureSourcesUploaded();
    if (!sourcesOk) return;

    setManualDeploying(fnName);
    setManualResults((prev) => ({
      ...prev,
      [fnName]: { status: "deploying" },
    }));

    try {
      // Call our OWN edge function — server-side, no CORS issues.
      // Deploy ONLY this one function (skip schema, skip others).
      const functionUrl = `${supabaseUrl}/functions/v1/deploy-territory`;
      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          territoryId: thisTerritory.id,
          projectRef: THIS_PROJECT_REF,
          accessToken: thisTerritory.access_token,
          deploySchema: false,
          deployFunctions: true,
          functionNames: [fnName],
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }

      const fnResult = data.functions?.[fnName];
      if (res.ok && fnResult?.status === "success") {
        setManualResults((prev) => ({
          ...prev,
          [fnName]: { status: "success" },
        }));
        toast.success(`${fnName} deployed!`);
      } else {
        const errMsg =
          fnResult?.error ||
          data.error ||
          `HTTP ${res.status}: ${text.substring(0, 200)}`;
        setManualResults((prev) => ({
          ...prev,
          [fnName]: { status: "failed", error: errMsg },
        }));
        toast.error(`${fnName} failed`, {
          description: errMsg.substring(0, 200),
        });
      }
    } catch (e: any) {
      setManualResults((prev) => ({
        ...prev,
        [fnName]: { status: "failed", error: e.message },
      }));
      toast.error(`${fnName} failed`, { description: e.message });
    } finally {
      setManualDeploying(null);
    }
  };

  const deployAllManual = async () => {
    for (const fnName of ALL_FUNCTION_NAMES) {
      await deploySingleFunction(fnName);
    }
    toast.success("All functions processed", {
      description: "Check results below.",
    });
  };

  const ensureSourcesUploaded = async (): Promise<boolean> => {
    // Always force-upload the latest sources + master SQL before every sync.
    // This guarantees the DB always has the newest code from this app build.
    await uploadSources();

    // VERIFY the upload actually landed — read back master_sql and check it
    // contains critical columns. If it doesn't, the sync would silently fall
    // back to stale hardcoded SQL in the edge function.
    try {
      const { data: verifyRow, error: verifyErr } = await supabase
        .from("edge_function_sources")
        .select("source_code")
        .eq("name", "master_sql")
        .single();

      if (verifyErr || !verifyRow?.source_code) {
        console.error(
          "[Territories] master_sql verification FAILED — not found in DB",
        );
        toast.error("Source upload verification failed", {
          description:
            "master_sql not found in edge_function_sources table. Sync aborted to prevent stale schema.",
        });
        return false;
      }

      // Check for critical columns that must be present
      const criticalColumns = [
        "email_contractor_prep_enabled",
        "email_contractor_prep_subject",
        "email_contractor_prep_template",
        "sms_contractor_prep_enabled",
        "venue_geocodes",
        "email_colors",
      ];
      const missing = criticalColumns.filter(
        (col) => !verifyRow.source_code.includes(col),
      );
      if (missing.length > 0) {
        console.error(
          "[Territories] master_sql verification FAILED — missing columns:",
          missing,
        );
        toast.error("Source upload verification failed", {
          description: `master_sql is missing: ${missing.join(", ")}. Sync aborted — click Upload Sources again.`,
        });
        return false;
      }

      console.log(
        "[Territories] master_sql verified OK (" +
          verifyRow.source_code.length +
          " chars, all critical columns present)",
      );
      return true;
    } catch (e: any) {
      console.error("[Territories] Verification error:", e.message);
      return false;
    }
  };

  const syncTerritory = async (
    territory: Territory,
    functionsOnly = false,
    schemaOnly = false,
  ) => {
    setSyncingId(territory.id);

    // Auto-upload sources before syncing (ensures latest code is in DB)
    // Abort if verification fails — prevents pushing stale schema
    const sourcesOk = await ensureSourcesUploaded();
    if (!sourcesOk) {
      setSyncingId(null);
      return;
    }

    // Re-fetch the latest territory record from DB to get the current access token
    // (React state may be stale if token was just updated)
    const { data: latestTerritory, error: fetchErr } = await supabase
      .from("territories")
      .select("*")
      .eq("id", territory.id)
      .single();
    if (fetchErr || !latestTerritory) {
      toast.error("Failed to fetch territory data", {
        description: fetchErr?.message,
      });
      setSyncingId(null);
      return;
    }
    const t = latestTerritory as Territory;

    const loadingToast = toast.loading(
      `${schemaOnly ? "Pushing schema to" : functionsOnly ? "Deploying functions to" : "Syncing"} ${t.name}...`,
    );

    try {
      const functionUrl = `${supabaseUrl}/functions/v1/deploy-territory`;

      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
          "x-client-info": "veydra-fleet-manager",
        },
        body: JSON.stringify({
          territoryId: t.id,
          projectRef: t.project_ref,
          accessToken: t.access_token || "",
          deploySchema: schemaOnly || !functionsOnly,
          deployFunctions: !schemaOnly,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        throw new Error(
          `Server returned non-JSON response (${res.status}): ${text.substring(0, 200)}`,
        );
      }

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            "deploy-territory Edge Function not found. Run: supabase functions deploy deploy-territory",
          );
        }
        throw new Error(data.error || `HTTP ${res.status}: Sync failed`);
      }

      const fnCount = data.functions
        ? Object.keys(data.functions).filter(
            (k: string) => data.functions[k].status === "success",
          ).length
        : 0;
      const fnSkipped = data.functions
        ? Object.keys(data.functions).filter(
            (k: string) => data.functions[k].status === "skipped",
          ).length
        : 0;
      const fnFailed = data.functions
        ? Object.keys(data.functions).filter(
            (k: string) => data.functions[k].status === "failed",
          ).length
        : 0;
      const fnTotal = Object.keys(data.functions || {}).length;
      const schemaOk = data.schema?.status === "success";

      if (data.success && fnSkipped === 0) {
        toast.success(`${t.name} synced!`, {
          description: `Schema: ${schemaOk ? "OK" : "Failed"} | Functions: ${fnCount}/${fnTotal}`,
          id: loadingToast,
          duration: 5000,
        });
      } else if (fnSkipped > 0 && fnFailed === 0) {
        toast.warning(`${t.name} partially synced`, {
          description: `Schema: ${schemaOk ? "OK" : "Failed"} | Functions: ${fnCount} deployed, ${fnSkipped} skipped (no access token). Add a token to deploy functions.`,
          id: loadingToast,
          duration: 8000,
        });
      } else {
        const fnErrors = data.functions
          ? Object.entries(data.functions)
              .filter(([, f]: [string, any]) => f.status === "failed")
              .map(
                ([name, f]: [string, any]) =>
                  `${name}: ${(f.error || "unknown").substring(0, 120)}`,
              )
          : [];
        const schemaErrors = data.schema?.details || [];
        const schemaErrorSummary = data.schema?.error || "";

        toast.error(`${t.name} sync had issues`, {
          description: `Schema: ${schemaErrorSummary || "OK"} | ${fnFailed} fn(s) failed, ${fnSkipped} skipped. ${fnErrors.length > 0 ? fnErrors.slice(0, 2).join(" | ") : ""}${schemaErrors.length > 0 ? " | Schema: " + schemaErrors.slice(0, 2).join(" | ") : ""}`,
          id: loadingToast,
          duration: 12000,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["territories"] });
    } catch (e: any) {
      toast.error(`Failed to sync ${t.name}`, {
        description: e.message.includes("fetch")
          ? "Cannot reach Supabase Edge Function. Is it deployed?"
          : e.message,
        id: loadingToast,
      });
    } finally {
      setSyncingId(null);
    }
  };

  // Check if sources are uploaded on mount — also auto-recover empty territories table
  const [sourcesVerified, setSourcesVerified] = useState<boolean | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const rescueTerritoriesTable = async () => {
    setIsRecovering(true);
    try {
      // Step 1: Check if the main instance record exists
      const { data: existing, error: fetchErr } = await supabase
        .from("territories")
        .select("*")
        .eq("project_ref", THIS_PROJECT_REF);

      if (fetchErr) {
        console.error("[Territories] Rescue fetch error:", fetchErr);
        toast.error("Database error", { description: fetchErr.message });
        setIsRecovering(false);
        return;
      }

      if (existing && existing.length > 0) {
        // Records exist but maybe query failed - just refetch
        console.log(
          "[Territories] Found",
          existing.length,
          "records, refetching...",
        );
        await refetch();
        toast.success("Territories restored!", {
          description: `Found ${existing.length} territory record(s).`,
        });
      } else {
        // Table is truly empty - recreate the main instance
        console.log("[Territories] No records found, recreating...");
        const { error } = await supabase.from("territories").insert({
          name: "Veydra (Main)",
          project_ref: THIS_PROJECT_REF,
          supabase_url: THIS_SUPABASE_URL,
          access_token: "",
          is_primary: true,
          last_sync_status: "success",
        });

        if (error) {
          console.error("[Territories] Rescue insert failed:", error);
          toast.error("Rescue failed", { description: error.message });
        } else {
          console.log("[Territories] Rescue successful!");
          toast.success("Territory recovered!", {
            description: "Your territory record was restored.",
          });
          await refetch();
        }
      }
    } catch (e: any) {
      console.error("[Territories] Rescue exception:", e);
      toast.error("Rescue failed", { description: e.message });
    } finally {
      setIsRecovering(false);
    }
  };

  React.useEffect(() => {
    const init = async () => {
      // Step 1: Auto-upload sources if missing
      try {
        const { data } = await supabase
          .from("edge_function_sources")
          .select("source_code")
          .eq("name", "master_sql")
          .single();
        if (
          !data?.source_code ||
          !data.source_code.includes("email_contractor_prep_enabled")
        ) {
          setSourcesVerified(false);
          console.log(
            "[Territories] Sources missing or outdated, auto-uploading...",
          );
          await ensureSourcesUploaded();
          setSourcesVerified(true);
        } else {
          setSourcesVerified(true);
        }
      } catch {
        setSourcesVerified(false);
        try {
          await ensureSourcesUploaded();
          setSourcesVerified(true);
        } catch {}
      }

      // Step 2: Auto-recover if territories table was accidentally wiped
      try {
        const { count } = await supabase
          .from("territories")
          .select("*", { count: "exact", head: true });

        if (count === 0) {
          console.log(
            "[Territories] Table is empty — auto-registering this instance...",
          );
          const { error } = await supabase.from("territories").insert({
            name: "Veydra (Main)",
            project_ref: THIS_PROJECT_REF,
            supabase_url: THIS_SUPABASE_URL,
            access_token: "",
            is_primary: true,
            last_sync_status: "success",
          });
          if (error) {
            console.error("[Territories] Auto-recovery failed:", error.message);
          } else {
            console.log("[Territories] Instance auto-recovered!");
            toast.success("Instance recovered", {
              description: "Your territory record was restored.",
            });
            queryClient.invalidateQueries({ queryKey: ["territories"] });
          }
        }
      } catch (err: any) {
        console.error(
          "[Territories] Recovery check failed:",
          err?.message || err,
        );
        // Don't show toast for RLS errors during init - the rescue button handles it
      }
    };
    init();
  }, []);

  return (
    <div className="space-y-6">
      {sourcesVerified === false && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
              Sources not uploaded or outdated
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
              The master SQL schema in the database is missing critical columns.
              Click "Upload Sources + SQL" before syncing to any territory —
              otherwise stale schema will be pushed.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await uploadSources();
              setSourcesVerified(true);
            }}
          >
            <Upload className="mr-2 h-3.5 w-3.5" /> Upload Now
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Territory Fleet Manager
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Push schema & edge functions to all Veydra instances.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={uploadSources}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Sources + SQL
          </Button>
          <Button
            variant="default"
            onClick={() => {
              setManualResults({});
              setManualDeployOpen(true);
            }}
            className="bg-primary"
          >
            <Cloud className="mr-2 h-4 w-4" />
            Manual Deploy
          </Button>
          <Button
            variant="outline"
            onClick={syncAll}
            disabled={territories.length === 0 || !!syncingId}
          >
            {syncingId ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            Sync All ({territories.length})
          </Button>
          {!isThisInstanceConnected && (
            <Button
              variant="default"
              onClick={addThisInstance}
              className="bg-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add This Instance
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Territory
          </Button>
        </div>
      </div>

      {/* Stripe Setup Guide - Collapsible */}
      <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-800 overflow-hidden">
        <button
          onClick={() => setStripeGuideOpen(!stripeGuideOpen)}
          className="w-full p-4 flex items-center gap-3 text-left hover:bg-indigo-100/30 dark:hover:bg-indigo-900/20 transition-colors"
        >
          <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
            <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
              Stripe Payment Setup (Per Territory)
            </p>
            {!stripeGuideOpen && (
              <p className="text-xs text-indigo-700 dark:text-indigo-300 truncate mt-0.5">
                Each territory needs its own Stripe keys to process payments.
                Click to expand...
              </p>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-indigo-500 shrink-0 transition-transform duration-200 ${stripeGuideOpen ? "rotate-180" : ""}`}
          />
        </button>
        {stripeGuideOpen && (
          <CardContent className="px-4 pb-4 pt-0 border-t border-indigo-200/50 dark:border-indigo-700/50">
            <div className="space-y-2 flex-1 mt-3">
              <p className="text-xs text-indigo-700 dark:text-indigo-300">
                Each territory needs its own Stripe keys to process payments.
                Follow these steps for every new instance:
              </p>
              <ol className="text-xs text-indigo-800 dark:text-indigo-300 space-y-1.5 list-decimal list-inside">
                <li>
                  <strong>Create a Stripe account</strong> — Go to{" "}
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    dashboard.stripe.com
                  </a>{" "}
                  and create an account (or use an existing one). Complete the
                  business verification (details_submitted).
                </li>
                <li>
                  <strong>Get your API keys</strong> — In Stripe Dashboard, go
                  to <em>Developers → API Keys</em>. Copy the{" "}
                  <strong>Secret Key</strong> (starts with{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    sk_live_
                  </code>{" "}
                  for production or{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    sk_test_
                  </code>{" "}
                  for test mode).
                </li>
                <li>
                  <strong>Add the key to Supabase</strong> — Go to the
                  territory's{" "}
                  <em>Supabase Dashboard → Edge Functions → Secrets</em>. Add a
                  new secret named{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    STRIPE_SECRET_KEY
                  </code>{" "}
                  with the secret key value. Also add{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    STRIPE_WEBHOOK_SECRET
                  </code>{" "}
                  (from Stripe Dashboard → Developers → Webhooks → your
                  endpoint's signing secret) and{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    APP_URL
                  </code>{" "}
                  (your territory's app URL, e.g.{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    https://veydra-nashville.honeysucklehaus.com
                  </code>
                  ).
                </li>
                <li>
                  <strong>Deploy edge functions</strong> — In this page, click{" "}
                  <strong>Upload Sources + SQL</strong>, then{" "}
                  <strong>Sync</strong> (or <strong>Manual Deploy</strong>) to
                  push all Stripe edge functions (
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    stripe-checkout
                  </code>
                  ,{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    stripe-invoices
                  </code>
                  ,{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    stripe-payout
                  </code>
                  ,{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    stripe-portal
                  </code>
                  ,{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    stripe-onboard
                  </code>
                  ,{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    stripe-webhook
                  </code>
                  ,{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    stripe-status
                  </code>
                  ) to the territory.
                </li>
                <li>
                  <strong>Set up the Stripe webhook</strong> — In Stripe
                  Dashboard → Developers → Webhooks, add an endpoint pointing to{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    https://[project-ref].supabase.co/functions/v1/stripe-webhook
                  </code>
                  . Subscribe to these events:{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    checkout.session.completed
                  </code>
                  ,{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    invoice.payment_succeeded
                  </code>
                  ,{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    invoice.payment_failed
                  </code>
                  ,{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    account.updated
                  </code>
                  . Copy the signing secret and add it as{" "}
                  <code className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded">
                    STRIPE_WEBHOOK_SECRET
                  </code>{" "}
                  in Supabase Edge Function Secrets (if not done in step 3).
                </li>
                <li>
                  <strong>Verify the connection</strong> — Go to{" "}
                  <em>Settings → Integrations</em> in the Veydra app. The Stripe
                  Connection card should show <strong>Connected</strong> with
                  your account details. Click <strong>Refresh Status</strong> if
                  it doesn't update automatically.
                </li>
              </ol>
              <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>Important:</strong> Each territory needs its own
                  Stripe keys — keys are NOT shared across instances. Test mode
                  keys (
                  <code className="text-[10px] bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                    sk_test_
                  </code>
                  ) will show a "Test Mode" badge in Settings. Switch to live
                  keys before going live.
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* How Syncing Works - Collapsible */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 overflow-hidden">
        <button
          onClick={() => setSyncGuideOpen(!syncGuideOpen)}
          className="w-full p-4 flex items-center gap-3 text-left hover:bg-blue-100/30 dark:hover:bg-blue-900/20 transition-colors"
        >
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/40 shrink-0">
            <Rocket className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
              How Syncing Works
            </p>
            {!syncGuideOpen && (
              <p className="text-xs text-blue-700 dark:text-blue-300 truncate mt-0.5">
                Upload sources, set tokens, sync schema & functions. Click to
                expand...
              </p>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-blue-500 shrink-0 transition-transform duration-200 ${syncGuideOpen ? "rotate-180" : ""}`}
          />
        </button>
        {syncGuideOpen && (
          <CardContent className="px-4 pb-4 pt-0 border-t border-blue-200/50 dark:border-blue-700/50">
            <div className="space-y-2 mt-3">
              <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                <li>
                  <strong>Upload Sources</strong> — Pushes the latest edge
                  function code AND master SQL schema from this app to the{" "}
                  <code className="text-[10px] bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
                    edge_function_sources
                  </code>{" "}
                  table. Do this after any code or schema change.
                </li>
                <li>
                  <strong>Set Token</strong> — Add a Supabase Personal Access
                  Token (Dashboard → Account → Access Tokens) to each territory.
                  Required for deploying functions.
                </li>
                <li>
                  <strong>Sync</strong> — Pushes the latest master SQL + all
                  edge functions to the territory's Supabase project. Sources
                  are auto-uploaded before every sync.
                </li>
              </ol>
              <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>One-time setup per territory:</strong> Click{" "}
                  <strong>Manual Deploy</strong> then{" "}
                  <strong>Deploy All</strong> to push all edge functions to a
                  new territory. For the main instance, use{" "}
                  <strong>Redeploy Self</strong> to update the deploy-territory
                  function directly via the Management API.
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {territories.length > 0 &&
        territories.some(
          (t) => t.project_ref === THIS_PROJECT_REF && !t.access_token,
        ) && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Edge functions cannot be deployed without an access token
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                The main instance has no Supabase Personal Access Token. Click{" "}
                <strong>Set Token</strong> on the main territory row and paste a
                token from Supabase Dashboard → Account → Access Tokens. Then
                click <strong>Sync</strong> to deploy all edge functions.
              </p>
            </div>
          </div>
        )}

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Connected Territories
          </CardTitle>
          <CardDescription>
            Each territory has its own Supabase project. Click{" "}
            <strong>Upload Sources</strong> first to push the latest edge
            function code to the database, then click <strong>Sync</strong> to
            deploy schema + functions. The main instance needs a Supabase
            Personal Access Token (click "Set Token") to redeploy its own edge
            functions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : territories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No territories yet.</p>
              <p className="text-sm mt-1 mb-4">
                Add this instance as your primary, or add another territory
                Supabase project.
              </p>
              <Button
                variant="default"
                onClick={addThisInstance}
                className="mb-3"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add This Instance as Primary
              </Button>
              {isError && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-destructive">
                    Failed to load territories. This may be an RLS issue after a
                    schema sync.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={rescueTerritoriesTable}
                    disabled={isRecovering}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    {isRecovering ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    🚨 Rescue Territories Table
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Territory</TableHead>
                  <TableHead>Project Ref</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {territories.map((t, idx) => {
                  const showSeparator =
                    idx > 0 &&
                    territories[idx - 1]?.project_ref === THIS_PROJECT_REF &&
                    t.project_ref !== THIS_PROJECT_REF;
                  const result = t.last_sync_result;
                  const fnResults = result?.functions || {};
                  const fnNames = Object.keys(fnResults);
                  const fnSuccess = fnNames.filter(
                    (n: string) => fnResults[n]?.status === "success",
                  );
                  const fnFailed = fnNames.filter(
                    (n: string) => fnResults[n]?.status === "failed",
                  );
                  const fnSkipped = fnNames.filter(
                    (n: string) => fnResults[n]?.status === "skipped",
                  );
                  const schemaOk = result?.schema?.status === "success";
                  const schemaErrors = result?.schema?.details || [];

                  return (
                    <React.Fragment key={t.id}>
                      {idx === 0 && t.project_ref === THIS_PROJECT_REF && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="bg-primary/5 border-b-2 border-primary/20"
                          >
                            <div className="flex items-center gap-2 py-1">
                              <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                                This Instance (Main)
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {showSeparator && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="bg-muted/30 border-y-2 border-border"
                          >
                            <div className="flex items-center gap-2 py-1">
                              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Other Territories
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {t.name}
                            {t.is_primary && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-wider">
                                <Star className="h-2.5 w-2.5 mr-0.5 fill-primary" />
                                Main
                              </Badge>
                            )}
                            {t.project_ref === THIS_PROJECT_REF &&
                              !t.is_primary && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  This Instance
                                </Badge>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs text-muted-foreground">
                            {t.project_ref}
                          </code>
                        </TableCell>
                        <TableCell>
                          {t.last_synced_at ? (
                            <span className="text-sm text-muted-foreground">
                              {format(
                                new Date(t.last_synced_at),
                                "MMM d, h:mm a",
                              )}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Never
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(t.last_sync_status)}
                            {result && (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground mt-1">
                                <span
                                  className={`flex items-center gap-0.5 ${schemaOk ? "text-emerald-600" : "text-destructive"}`}
                                >
                                  <Database className="h-2.5 w-2.5" />
                                  {schemaOk ? "Schema OK" : "Schema Failed"}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Cloud className="h-2.5 w-2.5" />
                                  {fnSuccess.length}/{fnNames.length} fns
                                </span>
                                {fnFailed.length > 0 && (
                                  <span className="text-destructive font-medium">
                                    ({fnFailed.length} failed)
                                  </span>
                                )}
                                {fnSkipped.length > 0 && (
                                  <span className="text-amber-600 font-medium">
                                    ({fnSkipped.length} skipped)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={
                                t.access_token
                                  ? "text-emerald-600 hover:text-emerald-700 h-7"
                                  : "text-amber-600 hover:text-amber-700 h-7"
                              }
                              onClick={() => updateAccessToken(t)}
                              title={
                                t.access_token
                                  ? "Update access token"
                                  : "Add access token to enable edge function syncing"
                              }
                            >
                              <Key className="h-3.5 w-3.5" />
                              {t.access_token ? "Token ✓" : "Set Token"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={syncingId === t.id || !t.access_token}
                              onClick={() => syncTerritory(t, true)}
                              title={
                                t.access_token
                                  ? "Deploy only edge functions (skip schema)"
                                  : "Add an access token first"
                              }
                            >
                              {syncingId === t.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Cloud className="mr-1 h-3 w-3" />
                              )}
                              Fns
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7"
                              onClick={() => syncTerritory(t)}
                              disabled={syncingId === t.id}
                            >
                              {syncingId === t.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Sync
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => syncTerritory(t, false, true)}
                              disabled={syncingId === t.id}
                              title="Push only the SQL schema (no edge functions). Use this to debug schema failures."
                            >
                              {syncingId === t.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Database className="mr-1 h-3 w-3" />
                              )}
                              Schema
                            </Button>
                            {t.project_ref === THIS_PROJECT_REF && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs bg-primary"
                                  onClick={redeploySelf}
                                  title="Deploy the latest deploy-territory code directly to this instance via the Supabase Management API"
                                >
                                  <Rocket className="h-3.5 w-3.5" />
                                  Redeploy Self
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive h-7"
                              onClick={() =>
                                deleteTerritoryMutation.mutate(t.id)
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {fnFailed.length > 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="bg-destructive/5 px-6 py-3"
                          >
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
                                Function Errors
                              </p>
                              {fnFailed.map((fnName: string) => (
                                <div
                                  key={fnName}
                                  className="flex items-start gap-2 text-xs"
                                >
                                  <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                                  <div>
                                    <code className="font-mono text-destructive font-semibold">
                                      {fnName}
                                    </code>
                                    <p className="text-muted-foreground mt-0.5 break-all">
                                      {(
                                        fnResults[fnName] as any
                                      )?.error?.substring(0, 300) ||
                                        "Unknown error"}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {!schemaOk && schemaErrors.length > 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="bg-destructive/5 px-6 py-3"
                          >
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
                                Schema Errors (
                                {result?.schema?.error || "failed"})
                              </p>
                              {schemaErrors.map((err: string, i: number) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 text-xs"
                                >
                                  <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                                  <p className="text-muted-foreground break-all">
                                    {err}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {fnSkipped.length > 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="bg-amber-50 dark:bg-amber-950/20 px-6 py-3"
                          >
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                Functions Skipped — No Access Token
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {fnSkipped.join(", ")} — Click{" "}
                                <strong>Set Token</strong> and add a Supabase
                                Personal Access Token to deploy these.
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Territory</DialogTitle>
            <DialogDescription>
              Enter the Supabase project details for this territory. You'll need
              a Personal Access Token from the territory's Supabase dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="terr-name">Territory Name</Label>
              <Input
                id="terr-name"
                placeholder="e.g. Nashville, TN"
                value={newTerritory.name}
                onChange={(e) =>
                  setNewTerritory({ ...newTerritory, name: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Found in Supabase Dashboard → Settings → General → Reference ID
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="terr-ref">Supabase Project Ref</Label>
              <Input
                id="terr-ref"
                placeholder="e.g. abcdefghijklmnop"
                value={newTerritory.project_ref}
                onChange={(e) =>
                  setNewTerritory({
                    ...newTerritory,
                    project_ref: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Found in Supabase Dashboard → Settings → General → Reference ID
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="terr-token">Supabase Personal Access Token</Label>
              <Input
                id="terr-token"
                type="password"
                placeholder="sbp_xxxxxxxxxxxxxxxxxxxx"
                value={newTerritory.access_token}
                onChange={(e) =>
                  setNewTerritory({
                    ...newTerritory,
                    access_token: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Generate at: Supabase Dashboard → Account → Access Tokens
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addTerritoryMutation.mutate(newTerritory)}
              disabled={
                !newTerritory.name ||
                !newTerritory.project_ref ||
                !newTerritory.access_token ||
                addTerritoryMutation.isPending
              }
            >
              {addTerritoryMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Territory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Dialog */}
      <Dialog
        open={!!tokenDialogTerritory}
        onOpenChange={(open) => {
          if (!open) {
            setTokenDialogTerritory(null);
            setTokenInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Set Access Token</DialogTitle>
            <DialogDescription>
              Enter a Supabase Personal Access Token for{" "}
              <strong>{tokenDialogTerritory?.name}</strong>. Generate one at
              Supabase Dashboard → Account → Access Tokens.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token-input">Personal Access Token</Label>
              <Input
                id="token-input"
                type="password"
                autoComplete="off"
                placeholder="sbp_xxxxxxxxxxxxxxxxxxxx"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This token is stored in the territories table and used to deploy
                edge functions via the Supabase Management API.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTokenDialogTerritory(null);
                setTokenInput("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveAccessToken} disabled={!tokenInput.trim()}>
              <Key className="mr-2 h-4 w-4" />
              Save Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Deploy Dialog */}
      <Dialog
        open={manualDeployOpen}
        onOpenChange={(open) => {
          if (!open) {
            setManualDeployOpen(false);
            setManualResults({});
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Manual Edge Function Deployment</DialogTitle>
            <DialogDescription>
              Deploy each edge function individually to this instance. This
              bypasses bulk sync and gives you per-function pass/fail feedback.
              Make sure you've set an access token first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
            {ALL_FUNCTION_NAMES.map((fnName) => {
              const result = manualResults[fnName];
              return (
                <div
                  key={fnName}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <code className="text-sm font-mono font-semibold shrink-0">
                      {fnName}
                    </code>
                    {result?.status === "success" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                    {result?.status === "failed" && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    {result?.status === "deploying" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    )}
                    {result?.status === "failed" && result.error && (
                      <span className="text-xs text-destructive truncate">
                        {result.error.substring(0, 80)}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs shrink-0"
                    disabled={manualDeploying === fnName}
                    onClick={() => deploySingleFunction(fnName)}
                  >
                    {manualDeploying === fnName ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Rocket className="mr-1 h-3 w-3" />
                    )}
                    Deploy
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setManualResults({});
              }}
              className="text-xs"
            >
              Clear Results
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setManualDeployOpen(false)}
              >
                Close
              </Button>
              <Button onClick={deployAllManual} disabled={!!manualDeploying}>
                {manualDeploying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="mr-2 h-4 w-4" />
                )}
                Deploy All
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
