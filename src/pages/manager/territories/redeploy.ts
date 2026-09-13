import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { THIS_PROJECT_REF } from "./constants";
import { toast } from "sonner";

/**
 * Redeploy the deploy-territory edge function to THIS instance using the
 * Supabase Management API. This is the critical first step before a bulk
 * sync: the deployed version of deploy-territory is what actually pushes
 * functions to other territories, so if it's stale (old hardcoded function
 * list missing "scheduler" etc.), sync silently skips functions.
 *
 * Returns true if the redeploy succeeded.
 */
export async function redeploySelf(
  ensureSourcesUploaded: () => Promise<boolean>,
): Promise<boolean> {
  const { data: thisTerritory } = await supabase
    .from("territories")
    .select("*")
    .eq("project_ref", THIS_PROJECT_REF)
    .single();
  if (!thisTerritory?.access_token) {
    toast.error("No access token", {
      description: "Add a Supabase Personal Access Token first.",
    });
    return false;
  }
  const sourcesOk = await ensureSourcesUploaded();
  if (!sourcesOk) return false;
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
          "New dynamic-list sync code is live. Syncing all territories next...",
        id: loadingToast,
        duration: 6000,
      });
      return true;
    } else if (fnResult?.status === "skipped") {
      toast.warning("Function was skipped", {
        description:
          fnResult.note || "Add an access token to enable self-redeploy.",
        id: loadingToast,
      });
      return false;
    } else {
      toast.error("Failed to update deploy-territory", {
        description: fnResult?.error || "Unknown error",
        id: loadingToast,
        duration: 10000,
      });
      return false;
    }
  } catch (e: any) {
    toast.error("Failed to update deploy-territory", {
      description: e.message.includes("fetch")
        ? "Cannot reach the edge function. Try Manual Deploy instead."
        : e.message,
      id: loadingToast,
      duration: 10000,
    });
    return false;
  }
}

/**
 * One-click flow: redeploy deploy-territory (so the dynamic function list is
 * live), then immediately re-sync every territory. This fixes the "sync
 * silently skipped scheduler/royalty-processor" problem without manual steps.
 */
export async function redeploySelfAndSyncAll(
  ensureSourcesUploaded: () => Promise<boolean>,
  syncAll: () => Promise<void>,
  setBusy: (b: boolean) => void,
): Promise<void> {
  setBusy(true);
  try {
    const ok = await redeploySelf(ensureSourcesUploaded);
    if (!ok) {
      setBusy(false);
      return;
    }
    // Small delay so the freshly-deployed function is picked up by the
    // Supabase runtime before we call it again for the bulk sync.
    await new Promise((r) => setTimeout(r, 2500));
    await syncAll();
  } finally {
    setBusy(false);
  }
}
