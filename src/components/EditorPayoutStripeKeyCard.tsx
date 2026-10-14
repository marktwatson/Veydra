import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { currentTerritoryId } from "@/lib/current-territory";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";

/**
 * Owner / super admin only. Lets an admin paste the Stripe secret that editor
 * payouts for THIS area use (territories.editor_payout_stripe_key). The full
 * key is never shown again after save — only a masked presence badge.
 *
 * The key is scoped to the currently viewed territory (currentTerritoryId),
 * never written to portal_settings or the shared Veydra edge secret.
 */
export function EditorPayoutStripeKeyCard({
  column = "editor_payout_stripe_key",
  title = "Editor Payout Stripe Secret",
  who = "Editors",
}: {
  column?: "editor_payout_stripe_key" | "contractor_payout_stripe_key";
  title?: string;
  who?: string;
} = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.role;
  const allowed = role === "super_admin" || role === "owner" || role === "manager";

  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [territoryName, setTerritoryName] = useState<string>("");
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [keyValue, setKeyValue] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    (async () => {
      setLoading(true);
      const tid = await currentTerritoryId();
      if (!active) return;
      setTerritoryId(tid);
      if (!tid) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("territories")
        .select(`name, ${column}`)
        .eq("id", tid)
        .maybeSingle();
      if (!active) return;
      if (error) {
        toast({
          variant: "destructive",
          title: "Failed to load area",
          description: error.message,
        });
        setLoading(false);
        return;
      }
      setTerritoryName(data?.name || "");
      setHasKey(!!data?.[column]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [allowed]);

  if (!allowed) return null;

  const handleSave = async () => {
    const trimmed = keyValue.trim();
    if (!trimmed.startsWith("sk_")) {
      toast({
        variant: "destructive",
        title: "That is not a Stripe secret",
        description: trimmed.startsWith("mk_")
          ? "mk_ is only the key ID. In Stripe, create a secret key and paste the value that starts with sk_live_."
          : "Paste the secret key that starts with sk_live_.",
      });
      return;
    }
    setSaving(true);
    const tid = await currentTerritoryId();
    if (!tid) {
      setSaving(false);
      toast({
        variant: "destructive",
        title: "Pick an area first",
      });
      return;
    }
    const { data, error } = await supabase
      .from("territories")
      .update({ [column]: trimmed })
      .eq("id", tid)
      .select("id, name");
    setSaving(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to save key",
        description: error.message,
      });
      return;
    }
    if (!data?.length) {
      toast({
        variant: "destructive",
        title: "Key was not saved",
        description: "This area blocked the change. The old key is still in place.",
      });
      return;
    }
    setTerritoryId(tid);
    setTerritoryName(data[0].name || territoryName);
    setHasKey(true);
    setKeyValue("");
    toast({
      title: "Editor payout Stripe key saved",
      description: `${who} in ${data[0].name || "this area"} will use this key.`,
    });
  };

  return (
    <Card className="md:col-span-2 max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>
          The Stripe secret {who.toLowerCase()} in this area use to connect and receive
          payouts. Scoped to{" "}
          <span className="font-medium text-foreground">
            {territoryName || "this area"}
          </span>
          . Never shared with other areas or stored in portal settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !territoryId ? (
          <p className="text-sm text-muted-foreground">
            Pick an area before setting its payout key.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {hasKey ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Key set
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  No key yet
                </Badge>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${column}-input`}>
                Stripe Secret Key {hasKey ? "(replace)" : ""}
              </Label>
              <Input
                id={`${column}-input`}
                type="password"
                placeholder={hasKey ? "•••••••••••• (saved)" : "sk_live_..."}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                For security, the full key is never shown again after save.
                Paste a new value to replace it.
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving || !keyValue.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save Key"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ContractorPayoutStripeKeyCard() {
  return (
    <EditorPayoutStripeKeyCard
      column="contractor_payout_stripe_key"
      title="Contractor Payout Stripe Secret"
      who="Contractors"
    />
  );
}
