import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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
import { Loader2, CreditCard, CheckCircle, AlertCircle } from "lucide-react";

// ─── Royalty Stripe Account settings (Super Admin only) ───
// This is a SEPARATE Stripe account used to collect royalty + payback from
// territory owners. It is distinct from the Stripe account that processes
// bride booking payments. Keys are stored server-side in royalty_settings and
// only the publishable key is ever exposed to the browser.
export function RoyaltyStripeAccountCard({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["royalty-settings"],
    queryFn: api.getRoyaltySettings,
  });

  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  // The secret key lives in royalty_secrets (RLS-locked) and is never returned
  // to the browser. We only know if it's configured via the stripe_royalty_configured flag.
  const hasKeysConfigured = !!(
    settings?.stripe_royalty_configured ||
    settings?.stripe_royalty_publishable_key
  );

  const handleSave = async () => {
    if (!secretKey && !publishableKey && !webhookSecret) {
      toast({
        variant: "destructive",
        title: "Nothing to Save",
        description: "Enter at least one key to update.",
      });
      return;
    }
    setSaving(true);
    try {
      const result: any = await api.setRoyaltyStripeKeys({
        secret_key: secretKey || undefined,
        publishable_key: publishableKey || undefined,
        webhook_secret: webhookSecret || undefined,
      });
      toast({
        title: "Royalty Stripe Keys Saved",
        description: result?.account
          ? `Connected to ${result.account.businessName || result.account.id} (${result.account.isTest ? "test" : "live"} mode).`
          : "Keys updated successfully.",
      });
      setSecretKey("");
      setPublishableKey("");
      setWebhookSecret("");
      // Invalidate so the card re-fetches and shows "Configured" state
      queryClient.invalidateQueries({ queryKey: ["royalty-settings"] });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm border-border/40 rounded-2xl bg-card max-w-2xl mt-6">
      <CardHeader className="p-5 pb-3 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Royalty Stripe Account
        </CardTitle>
        <CardDescription className="text-xs">
          This is a separate Stripe account for collecting royalty + payback
          payments from territory owners. It is NOT the account used for bride
          booking payments. Keys are stored securely server-side.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          {hasKeysConfigured ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">
              <CheckCircle className="h-3 w-3 mr-1" />
              Royalty Stripe Account Configured
            </Badge>
          ) : (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not Configured — owners cannot connect bank accounts until set
            </Badge>
          )}
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Enter the keys from your dedicated HQ royalty Stripe account. Leave
            a field blank to keep the existing value. The secret key is never
            shown again after saving.
          </span>
        </div>

        <div className="space-y-2">
          <Label>Secret Key (sk_live_... or sk_test_...)</Label>
          <div className="flex gap-2">
            <Input
              type={showSecret ? "text" : "password"}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={
                settings?.stripe_royalty_configured
                  ? "•••••••• (stored securely — enter new key to replace)"
                  : "sk_live_..."
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full shrink-0"
              onClick={() => setShowSecret((s) => !s)}
            >
              {showSecret ? "Hide" : "Show"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Publishable Key (pk_live_... or pk_test_...)</Label>
          <Input
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder={
              settings?.stripe_royalty_publishable_key
                ? `${settings.stripe_royalty_publishable_key.substring(0, 14)}... (stored)`
                : "pk_live_..."
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Webhook Signing Secret (whsec_...) — optional</Label>
          <Input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={
              settings?.stripe_royalty_configured
                ? "•••••••• (stored securely — enter new to replace)"
                : "whsec_..."
            }
          />
        </div>

        <Button
          className="rounded-full w-full"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4 mr-2" />
          )}
          Save Royalty Stripe Keys
        </Button>
      </CardContent>
    </Card>
  );
}
