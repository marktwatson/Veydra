import { useState } from "react";
import { Loader2, Rocket, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { toast } from "sonner";
import { ALL_FUNCTION_NAMES, THIS_PROJECT_REF } from "./constants";

type ManualResult = { status: string; error?: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ensureSourcesUploaded: () => Promise<boolean>;
}

export function ManualDeployDialog({
  open,
  onOpenChange,
  ensureSourcesUploaded,
}: Props) {
  const [manualDeploying, setManualDeploying] = useState<string | null>(null);
  const [manualResults, setManualResults] = useState<
    Record<string, ManualResult>
  >({});

  const deploySingleFunction = async (fnName: string) => {
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

    setManualDeploying(fnName);
    setManualResults((prev) => ({
      ...prev,
      [fnName]: { status: "deploying" },
    }));

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
          functionNames: [fnName],
        }),
      });

      const text = await res.text();
      let data: any;
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setManualResults({});
        }
        onOpenChange(o);
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
            onClick={() => setManualResults({})}
            className="text-xs"
          >
            Clear Results
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
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
  );
}
