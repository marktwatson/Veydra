import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase, supabaseUrl } from "@/lib/supabase";
import {
  Shield,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  KeyRound,
  Webhook,
  Building2,
  Banknote,
  Lock,
  Users,
} from "lucide-react";

/**
 * Super-admin-only guide for configuring the Stripe account used for
 * contractor & editor PAYROLL (payouts). This is the per-area Stripe
 * account whose secret key lives in the Supabase Edge Function
 * environment variable named `Veydra` (or `STRIPE_SECRET_KEY`).
 *
 * This is COMPLETELY SEPARATE from royalty collection. The royalty
 * Stripe account is configured elsewhere (Royalty & Payback). This page
 * only covers the account that pays contractors and editors.
 *
 * The secret key is stored as a Supabase Edge Function secret (env var)
 * for security — it is never stored in the database or exposed to the
 * browser. This page is instructions-only; it does not save keys.
 */
export function StripePayoutSetupGuide() {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  // We can't read the secret key (it's an env var), but we can check
  // whether the payout function responds successfully, which tells us a
  // key is set.
  const checkStatus = async () => {
    setChecking(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token || ""}`,
        },
        body: JSON.stringify({ amount: 0, destination_account: "self" }),
      });
      const data = await res.json();
      // A "balance_insufficient" / "no such destination" / similar Stripe
      // error means the key IS set and Stripe responded — only a missing-
      // key error means not configured.
      const missingKey =
        data?.error && /missing|STRIPE_SECRET_KEY|Veydra/i.test(data.error);
      setConfigured(!missingKey);
    } catch (e: any) {
      setConfigured(false);
    } finally {
      setChecking(false);
    }
  };

  const projectRef = supabaseUrl.replace("https://", "").split(".")[0];

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Payroll Stripe Account
            {configured === true && (
              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Configured
              </Badge>
            )}
            {configured === false && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-600 border-amber-200"
              >
                <AlertCircle className="h-3 w-3 mr-1" /> Not configured
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            This is the Stripe account that pays your contractors and editors in
            this area. It is separate from royalty collection. Only Super Admins
            can change it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            disabled={checking}
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            Check current status
          </Button>
        </CardContent>
      </Card>

      {/* Step-by-step guide */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Step-by-Step Setup Guide
          </CardTitle>
          <CardDescription>
            Follow these steps to create or switch the Stripe account that
            handles contractor and editor payouts for this area.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <Step
            number={1}
            title="Create or log in to the Stripe account for this area"
          >
            <p className="text-sm text-muted-foreground mb-3">
              Each area uses its own Stripe account for payroll. Go to the
              Stripe Dashboard and log in to the account you want payouts to
              come from for this area.
            </p>
            <Button asChild variant="outline" size="sm">
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noreferrer"
              >
                Open Stripe Dashboard{" "}
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </a>
            </Button>
          </Step>

          {/* Step 2 */}
          <Step number={2} title="Complete the account for sending payouts">
            <p className="text-sm text-muted-foreground mb-2">
              Make sure the account is set up to send money OUT (payouts), not
              just receive payments:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
              <li>
                In <strong>Settings → Business details</strong>, fill in your
                business name, address, and industry.
              </li>
              <li>
                In <strong>Settings → Payouts</strong>, add a bank account so
                Stripe can fund payouts to your contractors and editors.
              </li>
              <li>
                Complete identity verification (KYC) under{" "}
                <strong>Settings → Team</strong> / account owner verification.
                Payouts are blocked until this is done.
              </li>
            </ul>
          </Step>

          {/* Step 3 */}
          <Step number={3} title="Copy your secret key">
            <p className="text-sm text-muted-foreground mb-3">
              Go to <strong>Developers → API keys</strong> and copy the secret
              key (starts with{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                sk_test_
              </code>{" "}
              or{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                sk_live_
              </code>
              ). Use test keys while testing, live keys for production.
            </p>
            <Button asChild variant="outline" size="sm">
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noreferrer"
              >
                Open API Keys <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </a>
            </Button>
          </Step>

          {/* Step 4 */}
          <Step
            number={4}
            title="Add the secret key as a Supabase Edge Function secret"
          >
            <p className="text-sm text-muted-foreground mb-2">
              The payout function reads the key from an environment variable.
              Open your Supabase project's Edge Function secrets and set the
              variable named{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                Veydra
              </code>{" "}
              (or{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                STRIPE_SECRET_KEY
              </code>
              ) to the secret key you copied.
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2.5">
              <code className="text-xs flex-1 break-all">
                {`Veydra = sk_live_...`}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copy("Veydra", "Variable name")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <a
                href={`https://supabase.com/dashboard/project/${projectRef}/settings/functions`}
                target="_blank"
                rel="noreferrer"
              >
                Open Supabase Edge Function Secrets{" "}
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              After saving the secret, redeploy the{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                stripe-payout
              </code>{" "}
              function (Territories → Manual Deploy) so it picks up the new key.
            </p>
          </Step>

          {/* Step 5 */}
          <Step number={5} title="(Optional) Create a webhook endpoint">
            <p className="text-sm text-muted-foreground mb-2">
              If you want payout events logged in the app, add a webhook in{" "}
              <strong>Developers → Webhooks → Add endpoint</strong> pointing at
              the payout webhook, then copy the signing secret (starts with{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                whsec_
              </code>
              ).
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2.5">
              <code className="text-xs flex-1 break-all">
                {supabaseUrl}/functions/v1/stripe-webhook
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  copy(
                    `${supabaseUrl}/functions/v1/stripe-webhook`,
                    "Webhook URL",
                  )
                }
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Events to listen for:{" "}
              <code className="bg-muted px-1 py-0.5 rounded">payout.paid</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                payout.failed
              </code>
              .
            </p>
          </Step>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="max-w-3xl border-amber-200 dark:border-amber-900/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <Building2 className="h-4 w-4 shrink-0 mt-0.5" />
            This is the per-area payroll account — it pays contractors and
            editors. It is separate from royalty collection, which has its own
            Stripe account configured under Royalty &amp; Payback.
          </p>
          <p className="flex items-start gap-2">
            <Lock className="h-4 w-4 shrink-0 mt-0.5" />
            The secret key lives only in Supabase Edge Function secrets (env
            var). It is never stored in the database or sent to the browser, so
            it can only be changed here in the Supabase dashboard.
          </p>
          <p className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            After switching accounts, contractors and editors who connected a
            Stripe account on the old one will need to re-connect on the new
            account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <h4 className="font-semibold text-sm mb-2">{title}</h4>
        {children}
      </div>
    </div>
  );
}
