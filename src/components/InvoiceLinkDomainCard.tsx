import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

/** Normalize the invoice link domain: trim, strip trailing slash, and if the
 *  user pasted a full invoice URL keep only the origin (host only). */
export function normalizeInvoiceBaseUrl(raw: string): string {
  let v = (raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) {
    try {
      v = new URL(v).origin;
    } catch {
      /* keep trimmed value */
    }
  }
  return v.replace(/\/+$/, "");
}

/** Self-contained "Invoice link domain" card for the Integrations tab.
 *  Loads + saves ghl_invoice_base_url on portal_settings by itself so it
 *  doesn't need to hook into the giant parent save payload. */
export function InvoiceLinkDomainCard({
  savedBaseUrl,
  savedWebhookSecret,
}: {
  savedBaseUrl?: string | null;
  savedWebhookSecret?: string | null;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(savedBaseUrl || "");
  const [webhookSecret, setWebhookSecret] = useState(savedWebhookSecret || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const normalized = normalizeInvoiceBaseUrl(value);
    setValue(normalized);
    setSaving(true);
    try {
      // Self-heal: ensure columns exist and notify PostgREST to refresh schema cache
      try {
        await supabase.rpc("exec_sql", {
          sql_text:
            "ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_invoice_base_url TEXT; ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ghl_webhook_secret TEXT; NOTIFY pgrst, 'reload schema';",
        });
      } catch {
        /* Ignore if exec_sql isn't present */
      }

      const patch: Record<string, string | null> = {
        ghl_invoice_base_url: normalized || null,
        ghl_webhook_secret: webhookSecret.trim() || null,
      };
      let { error } = await supabase
        .from("portal_settings")
        .update(patch)
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // If schema cache hasn't refreshed yet, wait 300ms and retry once
      if (error && error.message?.includes("schema cache")) {
        await new Promise((r) => setTimeout(r, 300));
        const retry = await supabase
          .from("portal_settings")
          .update(patch)
          .neq("id", "00000000-0000-0000-0000-000000000000");
        error = retry.error;
      }

      if (error) throw error;
      toast({
        title: "Saved",
        description: "Invoice link domain and webhook secret updated.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description:
          err?.message ||
          "Could not save. Make sure ghl_invoice_base_url column is synced.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="md:col-span-2 max-w-3xl">
      <CardHeader>
        <CardTitle>Invoice Link Domain</CardTitle>
        <CardDescription>
          The customer-facing host for invoices generated from Payment Audit.
          Each area has its own host.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <Label htmlFor="hl-invoice-base-url">Invoice link domain</Label>
          <Input
            id="hl-invoice-base-url"
            placeholder="https://links.honeysucklehaus.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Host only, no /invoice/id. Example:
            https://links.honeysucklehaus.com
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ghl-webhook-secret">Invoice webhook secret</Label>
          <Input
            id="ghl-webhook-secret"
            placeholder="shared secret sent as x-webhook-secret"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Set this in your CRM workflow webhook header
            (x-webhook-secret) so only your CRM can post payment events to the
            ghl-invoice-webhook function.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
