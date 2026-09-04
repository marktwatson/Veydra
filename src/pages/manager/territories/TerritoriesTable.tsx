import React from "react";
import {
  Loader2,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  Rocket,
  Database,
  Cloud,
  Star,
  Key,
  Trash2,
  RefreshCw,
} from "lucide-react";
// All icons above are used in the table rows and status badges.
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Territory, THIS_PROJECT_REF } from "./constants";

export function getStatusBadge(status: string) {
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
}

interface Props {
  territories: Territory[];
  syncingId: string | null;
  onSync: (t: Territory, functionsOnly?: boolean, schemaOnly?: boolean) => void;
  onUpdateToken: (t: Territory) => void;
  onDelete: (id: string) => void;
  onRedeploySelf: () => void;
}

export function TerritoriesTable({
  territories,
  syncingId,
  onSync,
  onUpdateToken,
  onDelete,
  onRedeploySelf,
}: Props) {
  return (
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
          const verificationMissing: string[] =
            result?.verification?.missing || [];

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
                    {t.project_ref === THIS_PROJECT_REF && !t.is_primary && (
                      <Badge variant="secondary" className="text-[10px]">
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
                      {format(new Date(t.last_synced_at), "MMM d, h:mm a")}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Never</span>
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
                      onClick={() => onUpdateToken(t)}
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
                      onClick={() => onSync(t, true)}
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
                      onClick={() => onSync(t)}
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
                      onClick={() => onSync(t, false, true)}
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
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs bg-primary"
                        onClick={onRedeploySelf}
                        title="Deploy the latest deploy-territory code directly to this instance via the Supabase Management API"
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        Redeploy Self
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive h-7"
                      onClick={() => onDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {fnFailed.length > 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-destructive/5 px-6 py-3">
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
                              {(fnResults[fnName] as any)?.error?.substring(
                                0,
                                300,
                              ) || "Unknown error"}
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
                  <TableCell colSpan={5} className="bg-destructive/5 px-6 py-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
                        Schema Errors ({result?.schema?.error || "failed"})
                      </p>
                      {schemaErrors.map((err: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
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
                        <strong>Set Token</strong> and add a Supabase Personal
                        Access Token to deploy these.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {verificationMissing.length > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="bg-red-50 dark:bg-red-950/20 px-6 py-3"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                        Missing on Target — Sync Did Not Push These
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {verificationMissing.join(", ")} — These functions were
                        not found on the target project after sync. Click{" "}
                        <strong>Redeploy & Sync All</strong> to push the latest
                        deploy-territory (with the dynamic function list) and
                        re-sync.
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
  );
}
