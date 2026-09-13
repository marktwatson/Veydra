import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { healOffPlatformColumns } from "@/lib/off-platform-payment";

const HEAL_SQL = `
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS accept_venmo boolean DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS venmo_handle text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS accept_cashapp boolean DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS cashapp_cashtag text;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS accept_zelle boolean DEFAULT false;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS zelle_target text;
NOTIFY pgrst, 'reload schema';
`;

export function OffPlatformPaymentCard({ saved }: { saved?: any }) {
  const { toast } = useToast();
  const [acceptVenmo, setAcceptVenmo] = useState(!!saved?.accept_venmo);
  const [venmoHandle, setVenmoHandle] = useState(saved?.venmo_handle || "");
  const [acceptCashapp, setAcceptCashapp] = useState(!!saved?.accept_cashapp);
  const [cashappCashtag, setCashappCashtag] = useState(
    saved?.cashapp_cashtag || "",
  );
  const [acceptZelle, setAcceptZelle] = useState(!!saved?.accept_zelle);
  const [zelleTarget, setZelleTarget] = useState(saved?.zelle_target || "");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Self-load saved values so this card can be dropped into Settings with no
  // parent wiring.
  useEffect(() => {
    (async () => {
      try {
        await healOffPlatformColumns();
        const { data } = await supabase
          .from("portal_settings")
          .select(
            "accept_venmo, venmo_handle, accept_cashapp, cashapp_cashtag, accept_zelle, zelle_target",
          )
          .limit(1)
          .maybeSingle();
        if (data) {
          setAcceptVenmo(!!data.accept_venmo);
          setVenmoHandle((data.venmo_handle as string) || "");
          setAcceptCashapp(!!data.accept_cashapp);
          setCashappCashtag((data.cashapp_cashtag as string) || "");
          setAcceptZelle(!!data.accept_zelle);
          setZelleTarget((data.zelle_target as string) || "");
        }
      } catch {
        /* ignore */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      try {
        await supabase.rpc("exec_sql", { sql_text: HEAL_SQL });
      } catch {
        /* ignore */
      }
      const patch: Record<string, any> = {
        accept_venmo: acceptVenmo,
        venmo_handle: acceptVenmo ? venmoHandle.trim() || null : null,
        accept_cashapp: acceptCashapp,
        cashapp_cashtag: acceptCashapp ? cashappCashtag.trim() || null : null,
        accept_zelle: acceptZelle,
        zelle_target: acceptZelle ? zelleTarget.trim() || null : null,
      };
      let { error } = await supabase
        .from("portal_settings")
        .update(patch)
        .neq("id", "00000000-0000-0000-0000-000000000000");
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
        description: "Off-platform payment options updated.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err?.message || "Could not save off-platform settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="md:col-span-2 max-w-3xl">
      <CardHeader>
        <CardTitle>Off-Platform Payment Options</CardTitle>
        <CardDescription>
          Offer Venmo / Cash App / Zelle as a "Pay in full instead" option on
          the booking payment step. Only full remaining balance — no
          installments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Venmo */}
        <div className="space-y-2 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between">
            <Label htmlFor="accept-venmo" className="font-semibold">
              Venmo
            </Label>
            <Switch
              id="accept-venmo"
              checked={acceptVenmo}
              onCheckedChange={setAcceptVenmo}
            />
          </div>
          {acceptVenmo && (
            <div className="grid gap-1">
              <Label htmlFor="venmo-handle" className="text-xs">
                Venmo handle
              </Label>
              <Input
                id="venmo-handle"
                placeholder="@yourbusiness"
                value={venmoHandle}
                onChange={(e) => setVenmoHandle(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Cash App */}
        <div className="space-y-2 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between">
            <Label htmlFor="accept-cashapp" className="font-semibold">
              Cash App
            </Label>
            <Switch
              id="accept-cashapp"
              checked={acceptCashapp}
              onCheckedChange={setAcceptCashapp}
            />
          </div>
          {acceptCashapp && (
            <div className="grid gap-1">
              <Label htmlFor="cashapp-cashtag" className="text-xs">
                Cash App $cashtag
              </Label>
              <Input
                id="cashapp-cashtag"
                placeholder="$yourbusiness"
                value={cashappCashtag}
                onChange={(e) => setCashappCashtag(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Zelle */}
        <div className="space-y-2 pb-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="accept-zelle" className="font-semibold">
              Zelle
            </Label>
            <Switch
              id="accept-zelle"
              checked={acceptZelle}
              onCheckedChange={setAcceptZelle}
            />
          </div>
          {acceptZelle && (
            <div className="grid gap-1">
              <Label htmlFor="zelle-target" className="text-xs">
                Zelle target (email or phone)
              </Label>
              <Input
                id="zelle-target"
                placeholder="payments@yourbusiness.com"
                value={zelleTarget}
                onChange={(e) => setZelleTarget(e.target.value)}
              />
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving || !loaded}>
          {saving ? "Saving..." : "Save Off-Platform Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
