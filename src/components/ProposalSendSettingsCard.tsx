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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { currentTerritoryId } from "@/lib/current-territory";
import { HONEYSUCKLE_TERRITORY_ID } from "@/lib/territory";

const HEAL_SQL = `
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS proposal_expiry_days integer DEFAULT 2;
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS salesperson_send_fee numeric DEFAULT 25;
NOTIFY pgrst, 'reload schema';
`;

/** Self-contained "Proposal send" card for the Integrations tab.
 *  Loads + saves proposal_expiry_days and salesperson_send_fee on the
 *  portal_settings row scoped to the current territory (Honeysuckle for
 *  super admin) so it doesn't need to hook into the giant parent save
 *  payload. Fee is clamped to 0–500. */
export function ProposalSendSettingsCard() {
  const { toast } = useToast();
  const [days, setDays] = useState<number>(2);
  const [fee, setFee] = useState<number>(25);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await supabase.rpc("exec_sql", { sql_text: HEAL_SQL });
      } catch {
        /* ignore */
      }
      try {
        const territoryId =
          (await currentTerritoryId()) || HONEYSUCKLE_TERRITORY_ID;
        const { data } = await supabase
          .from("portal_settings")
          .select("proposal_expiry_days, salesperson_send_fee")
          .eq("territory_id", territoryId)
          .limit(1)
          .maybeSingle();
        if (data) {
          if (data.proposal_expiry_days != null)
            setDays(Number(data.proposal_expiry_days) || 2);
          if (data.salesperson_send_fee != null)
            setFee(Number(data.salesperson_send_fee) || 25);
        }
      } catch {
        /* ignore */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const handleSave = async () => {
    const clampedDays = Math.min(30, Math.max(1, Number(days) || 2));
    const clampedFee = Math.min(500, Math.max(0, Number(fee) || 0));
    setDays(clampedDays);
    setFee(clampedFee);
    setSaving(true);
    try {
      try {
        await supabase.rpc("exec_sql", { sql_text: HEAL_SQL });
      } catch {
        /* ignore */
      }
      const patch: Record<string, any> = {
        proposal_expiry_days: clampedDays,
        salesperson_send_fee: clampedFee,
      };
      const territoryId =
        (await currentTerritoryId()) || HONEYSUCKLE_TERRITORY_ID;
      let { error } = await supabase
        .from("portal_settings")
        .update(patch)
        .eq("territory_id", territoryId);
      if (error && error.message?.includes("schema cache")) {
        await new Promise((r) => setTimeout(r, 300));
        const retry = await supabase
          .from("portal_settings")
          .update(patch)
          .eq("territory_id", territoryId);
        error = retry.error;
      }
      if (error) throw error;
      toast({
        title: "Saved",
        description: `Proposals expire after ${clampedDays} day${clampedDays === 1 ? "" : "s"}. Salesperson send fee set to $${clampedFee}.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err?.message || "Could not save proposal send settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="md:col-span-2 max-w-3xl">
      <CardHeader>
        <CardTitle>Proposal Send</CardTitle>
        <CardDescription>
          How long a client has to review a proposal after you click Send to
          client, and the send fee earned by salespeople per first send.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <Label htmlFor="proposal-expiry-days">Expire after (days)</Label>
          <Input
            id="proposal-expiry-days"
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Clock starts when you click Send to client, not when the proposal is
            generated. Clamped to 1–30 days.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="salesperson-send-fee">
            Salesperson fee per sent proposal ($)
          </Label>
          <Input
            id="salesperson-send-fee"
            type="number"
            min={0}
            max={500}
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Paid to a salesperson the first time they send a proposal they built
            via the public builder link. Clamped to 0–500. Staff only — not
            shown to salespeople.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !loaded}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
