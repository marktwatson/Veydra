import { useState } from "react";
import { CreditCard, Rocket, ChevronDown, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StripeSetupGuide() {
  const [open, setOpen] = useState(false);
  const code = "text-[10px] bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded";
  return (
    <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-indigo-100/30 dark:hover:bg-indigo-900/20 transition-colors"
      >
        <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
          <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
            Stripe Payment Setup (Per Territory)
          </p>
          {!open && (
            <p className="text-xs text-indigo-700 dark:text-indigo-300 truncate mt-0.5">
              Each territory needs its own Stripe keys to process payments.
              Click to expand...
            </p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-indigo-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
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
                <strong>Get your API keys</strong> — In Stripe Dashboard, go to{" "}
                <em>Developers → API Keys</em>. Copy the{" "}
                <strong>Secret Key</strong> (starts with{" "}
                <code className={code}>sk_live_</code> for production or{" "}
                <code className={code}>sk_test_</code> for test mode).
              </li>
              <li>
                <strong>Add the key to Supabase</strong> — Go to the territory's{" "}
                <em>Supabase Dashboard → Edge Functions → Secrets</em>. Add a
                new secret named <code className={code}>STRIPE_SECRET_KEY</code>{" "}
                with the secret key value. Also add{" "}
                <code className={code}>STRIPE_WEBHOOK_SECRET</code> (from Stripe
                Dashboard → Developers → Webhooks → your endpoint's signing
                secret) and <code className={code}>APP_URL</code> (your
                territory's app URL, e.g.{" "}
                <code className={code}>
                  https://veydra-nashville.honeysucklehaus.com
                </code>
                ).
              </li>
              <li>
                <strong>Deploy edge functions</strong> — In this page, click{" "}
                <strong>Upload Sources + SQL</strong>, then{" "}
                <strong>Sync</strong> (or <strong>Manual Deploy</strong>) to
                push all Stripe edge functions (
                <code className={code}>stripe-checkout</code>,{" "}
                <code className={code}>stripe-invoices</code>,{" "}
                <code className={code}>stripe-payout</code>,{" "}
                <code className={code}>stripe-portal</code>,{" "}
                <code className={code}>stripe-onboard</code>,{" "}
                <code className={code}>stripe-webhook</code>,{" "}
                <code className={code}>stripe-status</code>) to the territory.
              </li>
              <li>
                <strong>Set up the Stripe webhook</strong> — In Stripe Dashboard
                → Developers → Webhooks, add an endpoint pointing to{" "}
                <code className={code}>
                  https://[project-ref].supabase.co/functions/v1/stripe-webhook
                </code>
                . Subscribe to these events:{" "}
                <code className={code}>checkout.session.completed</code>,{" "}
                <code className={code}>invoice.payment_succeeded</code>,{" "}
                <code className={code}>invoice.payment_failed</code>,{" "}
                <code className={code}>account.updated</code>. Copy the signing
                secret and add it as{" "}
                <code className={code}>STRIPE_WEBHOOK_SECRET</code> in Supabase
                Edge Function Secrets (if not done in step 3).
              </li>
              <li>
                <strong>Verify the connection</strong> — Go to{" "}
                <em>Settings → Integrations</em> in the Veydra app. The Stripe
                Connection card should show <strong>Connected</strong> with your
                account details. Click <strong>Refresh Status</strong> if it
                doesn't update automatically.
              </li>
            </ol>
            <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Important:</strong> Each territory needs its own Stripe
                keys — keys are NOT shared across instances. Test mode keys (
                <code className="text-[10px] bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                  sk_test_
                </code>
                ) will show a "Test Mode" badge in Settings. Switch to live keys
                before going live.
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function SyncGuide() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-blue-100/30 dark:hover:bg-blue-900/20 transition-colors"
      >
        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/40 shrink-0">
          <Rocket className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
            How Syncing Works
          </p>
          {!open && (
            <p className="text-xs text-blue-700 dark:text-blue-300 truncate mt-0.5">
              Upload sources, set tokens, sync schema & functions. Click to
              expand...
            </p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-blue-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
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
                <strong>Sync</strong> — Pushes the latest master SQL + all edge
                functions to the territory's Supabase project. Sources are
                auto-uploaded before every sync.
              </li>
            </ol>
            <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>One-time setup per territory:</strong> Click{" "}
                <strong>Manual Deploy</strong> then <strong>Deploy All</strong>{" "}
                to push all edge functions to a new territory. For the main
                instance, use <strong>Redeploy Self</strong> to update the
                deploy-territory function directly via the Management API.
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
