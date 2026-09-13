import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { EDGE_FUNCTION_SOURCES } from "@/lib/edge-function-sources";
import { toast } from "sonner";
import type { Territory } from "./constants";

const FN_IMPORTS = EDGE_FUNCTION_SOURCES;

export async function uploadSources(): Promise<boolean> {
  const loadingToast = toast.loading(
    "Uploading edge function sources + master SQL to DB...",
  );
  try {
    const entries = Object.entries(FN_IMPORTS);
    const failed: string[] = [];
    for (const [name, source] of entries) {
      const { error } = await supabase
        .from("edge_function_sources")
        .upsert(
          { name, source_code: source, updated_at: new Date().toISOString() },
          { onConflict: "name" },
        );
      if (error) {
        console.error(`Failed to upload ${name}:`, error.message);
        failed.push(name);
      }
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} source(s) failed to upload`, {
        description: `Failed: ${failed.join(", ")}. These functions will be missing from sync. Check RLS on edge_function_sources.`,
        id: loadingToast,
        duration: 10000,
      });
      return false;
    }
    toast.success(`${entries.length} sources uploaded!`, {
      description:
        "Edge functions + master SQL are now in DB. Click Sync to deploy.",
      id: loadingToast,
    });
    return true;
  } catch (e: any) {
    toast.error("Failed to upload sources", {
      description: e.message,
      id: loadingToast,
    });
    return false;
  }
}

export async function ensureSourcesUploaded(): Promise<boolean> {
  const uploadOk = await uploadSources();
  if (!uploadOk) return false;
  try {
    // Verify EVERY expected source row exists and is non-trivially long.
    // Previously we only checked master_sql, so if a function source failed
    // to upload (RLS/network), sync would silently mark it "Source not found"
    // and skip it. Now we verify all rows up front and abort if any are missing.
    const expectedNames = Object.keys(FN_IMPORTS);
    const { data: rows, error: fetchErr } = await supabase
      .from("edge_function_sources")
      .select("name, source_code")
      .in("name", expectedNames);
    if (fetchErr) {
      toast.error("Source verification failed", {
        description: fetchErr.message,
      });
      return false;
    }
    const rowMap = new Map(
      (rows || []).map((r: any) => [r.name, r.source_code]),
    );
    const missing = expectedNames.filter(
      (n) => !rowMap.has(n) || !rowMap.get(n) || rowMap.get(n)!.length < 50,
    );
    if (missing.length > 0) {
      toast.error("Source upload incomplete", {
        description: `Missing/empty: ${missing.join(", ")}. Sync aborted — click Upload Sources again.`,
        duration: 10000,
      });
      return false;
    }
    // Sanity-check master_sql has critical columns (catches a stale/partial upload)
    const masterSql = rowMap.get("master_sql") || "";
    const criticalColumns = [
      "email_contractor_prep_enabled",
      "email_contractor_prep_subject",
      "email_contractor_prep_template",
      "sms_contractor_prep_enabled",
      "venue_geocodes",
      "email_colors",
    ];
    const missingCols = criticalColumns.filter(
      (col) => !masterSql.includes(col),
    );
    if (missingCols.length > 0) {
      toast.error("Source upload verification failed", {
        description: `master_sql is missing: ${missingCols.join(", ")}. Sync aborted — click Upload Sources again.`,
      });
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("[Territories] Verification error:", e.message);
    return false;
  }
}

export async function syncTerritory(
  territory: Territory,
  opts: {
    functionsOnly?: boolean;
    schemaOnly?: boolean;
    setSyncingId: (id: string | null) => void;
    onDone: () => void;
  },
): Promise<void> {
  const {
    functionsOnly = false,
    schemaOnly = false,
    setSyncingId,
    onDone,
  } = opts;
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
    const verificationMissing: string[] = data.verification?.missing || [];
    if (data.success && fnSkipped === 0 && verificationMissing.length === 0) {
      toast.success(`${t.name} synced!`, {
        description: `Schema: ${schemaOk ? "OK" : "Failed"} | Functions: ${fnCount}/${fnTotal}`,
        id: loadingToast,
        duration: 5000,
      });
    } else if (
      fnSkipped > 0 &&
      fnFailed === 0 &&
      verificationMissing.length === 0
    ) {
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
      const verifyNote =
        verificationMissing.length > 0
          ? ` | Missing on target: ${verificationMissing.join(", ")}`
          : "";
      toast.error(`${t.name} sync had issues`, {
        description: `Schema: ${schemaErrorSummary || "OK"} | ${fnFailed} fn(s) failed, ${fnSkipped} skipped. ${fnErrors.length > 0 ? fnErrors.slice(0, 2).join(" | ") : ""}${schemaErrors.length > 0 ? " | Schema: " + schemaErrors.slice(0, 2).join(" | ") : ""}${verifyNote}`,
        id: loadingToast,
        duration: 12000,
      });
    }
    onDone();
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
}
