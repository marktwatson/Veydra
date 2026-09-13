import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CreditCard,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";

/**
 * Royalty health banner shown to owners immediately on login.
 * Surfaces issues that block royalty collection:
 *  - No payment method (bank account) connected
 *  - Stripe not configured for the royalty account
 *  - One or more failed payment periods
 *
 * Only renders for the "owner" role. Returns null for everyone else
 * and when there are no issues (so it stays out of the way).
 */
export function RoyaltyHealthAlert() {
  const { user } = useAuth();

  // Only owners see this. owner_readonly is view-only but still benefits
  // from knowing there's a problem — so include it too.
  const isOwner = user?.role === "owner" || user?.role === "owner_readonly";

  const { data: territory, isLoading } = useQuery({
    queryKey: ["owner-territory", user?.id],
    queryFn: () => api.getOwnerTerritory(user!.id),
    enabled: !!isOwner && !!user?.id,
    retry: false,
  });

  // Secondary source of truth: the royalty_settings table holds the
  // stripe_royalty_configured flag set by the edge function when keys are
  // saved. We check it as a fallback so the alert clears even if the
  // territory row flags haven't been synced yet.
  const { data: royaltySettings } = useQuery({
    queryKey: ["royalty-settings-config"],
    queryFn: async () => {
      // Order by configured DESC so we read the real row, not an empty clone.
      const { data, error } = await supabase
        .from("royalty_settings")
        .select("stripe_royalty_configured")
        .order("stripe_royalty_configured", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn(
          "[RoyaltyHealthAlert] royalty_settings read error:",
          error.message,
        );
        return null;
      }
      return data;
    },
    enabled: !!isOwner,
    retry: false,
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["owner-royalty-periods", territory?.id],
    queryFn: () => api.getRoyaltyPeriods(territory!.id),
    enabled: !!isOwner && !!territory?.id,
    retry: false,
  });

  if (!isOwner) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking royalty status…
      </div>
    );
  }

  if (!territory) return null;

  const hasPaymentMethod = !!(
    territory.primary_payment_method_id || territory.stripe_payment_method_id
  );
  // Configured if either the territory row OR the royalty_settings row says so.
  const stripeConfigured =
    territory.stripe_royalty_configured ||
    territory.stripe_connected ||
    royaltySettings?.stripe_royalty_configured === true;

  const failedPeriods = (periods as any[]).filter((p) => p.status === "failed");

  // Build the list of issues, most severe first.
  const issues: { title: string; description: string }[] = [];

  if (!stripeConfigured) {
    issues.push({
      title: "Royalty Stripe account not configured",
      description:
        "The royalty Stripe account keys haven't been set up yet. Contact your Super Admin to configure them so automatic collection can run.",
    });
  }

  if (!hasPaymentMethod) {
    issues.push({
      title: "No bank account connected",
      description:
        "Automatic weekly royalty + payback collection is disabled until you connect a bank account. Connect one now to avoid falling behind.",
    });
  }

  if (failedPeriods.length > 0) {
    const totalFailed = failedPeriods.reduce(
      (sum, p) => sum + (Number(p.total_due) || 0),
      0,
    );
    issues.push({
      title: `${failedPeriods.length} failed royalty payment${failedPeriods.length === 1 ? "" : "s"}`,
      description: `$${totalFailed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in royalty charges failed to collect. Update your payment method and retry from the Royalty dashboard to settle the balance.`,
    });
  }

  if (issues.length === 0) return null;

  return (
    <Alert className="bg-red-500/5 border-red-500/30 text-foreground rounded-2xl shadow-sm">
      <AlertTriangle className="h-5 w-5 text-red-600" />
      <AlertTitle className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
        Royalty Action Required
        <span className="text-xs font-normal text-muted-foreground">
          {issues.length} issue{issues.length === 1 ? "" : "s"} need
          {issues.length === 1 ? "s" : ""} your attention
        </span>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        {issues.map((issue, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">{issue.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {issue.description}
              </p>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-1">
          {!hasPaymentMethod && (
            <Button size="sm" asChild className="rounded-full shadow-sm">
              <Link to="/owner/royalty">
                <CreditCard className="h-4 w-4 mr-2" />
                Connect Bank Account
              </Link>
            </Button>
          )}
          {failedPeriods.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="rounded-full"
            >
              <Link to="/owner/royalty">
                Review Failed Payments
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )}
          {hasPaymentMethod && failedPeriods.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="rounded-full"
            >
              <Link to="/owner/royalty">
                Go to Royalty Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
