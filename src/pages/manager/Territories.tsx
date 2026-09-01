import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { EDGE_FUNCTION_SOURCES } from "@/lib/edge-function-sources";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Plus,
  Globe,
  AlertCircle,
  Rocket,
  Cloud,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Territory,
  THIS_PROJECT_REF,
  THIS_SUPABASE_URL,
} from "./territories/constants";
import { TerritoriesTable } from "./territories/TerritoriesTable";
import { StripeSetupGuide, SyncGuide } from "./territories/TerritoriesGuides";
import {
  AddTerritoryDialog,
  TokenDialog,
} from "./territories/TerritoriesDialogs";
import { ManualDeployDialog } from "./territories/ManualDeployDialog";

const FN_IMPORTS = EDGE_FUNCTION_SOURCES;

export default function Territories() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [tokenDialogTerritory, setTokenDialogTerritory] =
    useState<Territory | null>(null);
  const [manualDeployOpen, setManualDeployOpen] = useState(false);
  const [sourcesVerified, setSourcesVerified] = useState<boolean | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const {
    data: territories = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Territory[]>({
    queryKey: ["territories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("territories").select("*");
      if (error) throw error;
      const sorted = (data || []).sort((a, b) => {
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
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      return sorted;
    },
    retry: 2,
  });

  const addTerritoryMutation = useMutation({
    mutationFn: async (t: any) => {
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
      toast.success("Territory added");
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

  const ensureSourcesUploaded = async (): Promise<boolean> => {
    await uploadSources();
    try {
      const { data: verifyRow, error: verifyErr } = await supabase
        .from("edge_function_sources")
        .select("source_code")
        .eq("name", "master_sql")
        .single();
      if (verifyErr || !verifyRow?.source_code) {
        toast.error("Source upload verification failed", {
          description:
            "master_sql not found in edge_function_sources table. Sync aborted to prevent stale schema.",
        });
        return false;
      }
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
        toast.error("Source upload verification failed", {
          description: `master_sql is missing: ${missing.join(", ")}. Sync aborted — click Upload Sources again.`,
        });
        return false;
      }
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
    const sourcesOk = await ensureSourcesUploaded();
    if (!sourcesOk) {
      setSyncingId(null);
      return;
    }
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
      let data: any;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        throw new Error(
          `Server returned non-JSON response (${res.status}): ${text.substring(0, 200)}`,
        );
      }
      if (!res.ok) {
        if (res.status === 404)
          throw new Error(
            "deploy-territory Edge Function not found. Run: supabase functions deploy deploy-territory",
          );
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

  const syncAll = async () => {
    await ensureSourcesUploaded();
    for (const t of territories) {
      await syncTerritory(t);
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

  const updateAccessToken = (territory: Territory) => {
    setTokenDialogTerritory(territory);
  };

  const saveAccessToken = async (token: string) => {
    if (!tokenDialogTerritory || !token.trim()) return;
    try {
      const { error } = await supabase
        .from("territories")
        .update({ access_token: token.trim() })
        .eq("id", tokenDialogTerritory.id);
      if (error) throw error;
      toast.success("Access token saved", {
        description: "Click Sync to deploy edge functions.",
      });
      setTokenDialogTerritory(null);
      queryClient.invalidateQueries({ queryKey: ["territories"] });
    } catch (e: any) {
      toast.error("Failed to save token", { description: e.message });
    }
  };

  const redeploySelf = async () => {
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
    const sourcesOk = await ensureSourcesUploaded();
    if (!sourcesOk) return;
    const loadingToast = toast.loading(
      "Updating deploy-territory function (this instance)...",
    );
    try {
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
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
      if (!res.ok)
        throw new Error(
          data.error || `HTTP ${res.status}: ${text.substring(0, 300)}`,
        );
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

  const rescueTerritoriesTable = async () => {
    setIsRecovering(true);
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from("territories")
        .select("*")
        .eq("project_ref", THIS_PROJECT_REF);
      if (fetchErr) {
        toast.error("Database error", { description: fetchErr.message });
        setIsRecovering(false);
        return;
      }
      if (existing && existing.length > 0) {
        await refetch();
        toast.success("Territories restored!", {
          description: `Found ${existing.length} territory record(s).`,
        });
      } else {
        const { error } = await supabase.from("territories").insert({
          name: "Veydra (Main)",
          project_ref: THIS_PROJECT_REF,
          supabase_url: THIS_SUPABASE_URL,
          access_token: "",
          is_primary: true,
          last_sync_status: "success",
        });
        if (error) {
          toast.error("Rescue failed", { description: error.message });
        } else {
          toast.success("Territory recovered!", {
            description: "Your territory record was restored.",
          });
          await refetch();
        }
      }
    } catch (e: any) {
      toast.error("Rescue failed", { description: e.message });
    } finally {
      setIsRecovering(false);
    }
  };

  React.useEffect(() => {
    const init = async () => {
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
      try {
        const { count } = await supabase
          .from("territories")
          .select("*", { count: "exact", head: true });
        if (count === 0) {
          const { error } = await supabase.from("territories").insert({
            name: "Veydra (Main)",
            project_ref: THIS_PROJECT_REF,
            supabase_url: THIS_SUPABASE_URL,
            access_token: "",
            is_primary: true,
            last_sync_status: "success",
          });
          if (!error) {
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
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            onClick={() => setManualDeployOpen(true)}
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

      <StripeSetupGuide />
      <SyncGuide />

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
            <TerritoriesTable
              territories={territories}
              syncingId={syncingId}
              onSync={syncTerritory}
              onUpdateToken={updateAccessToken}
              onDelete={(id) => deleteTerritoryMutation.mutate(id)}
              onRedeploySelf={redeploySelf}
            />
          )}
        </CardContent>
      </Card>

      <AddTerritoryDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={(t) => addTerritoryMutation.mutate(t)}
        pending={addTerritoryMutation.isPending}
      />
      <TokenDialog
        territory={tokenDialogTerritory}
        onClose={() => setTokenDialogTerritory(null)}
        onSave={saveAccessToken}
      />
      <ManualDeployDialog
        open={manualDeployOpen}
        onOpenChange={setManualDeployOpen}
        ensureSourcesUploaded={ensureSourcesUploaded}
      />
    </div>
  );
}
