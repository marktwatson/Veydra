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

const HEAL_SQL = `
ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS proposal_expiry_days integer DEFAULT 2;
NOTIFY pgrst, 'reload schema';
`;

/** Self-contained "Proposal send" card for the Integrations tab.
 *  Loads + saves proposal_expiry_days on portal_settings by itself so it
 *  doesn't need to hook into the giant parent save payload. */
export function ProposalSendSettingsCard() {
  const { toast } = useToast();
  const [days, setDays] = useState<number>(2);
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
        const { data } = await supabase
          .from("portal_settings")
          .select("proposal_expiry_days")
          .limit(1)
          .maybeSingle();
        if (data && data.proposal_expiry_days != null) {
          setDays(Number(data.proposal_expiry_days) || 2);
        }
      } catch {
        /* ignore */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const handleSave = async () => {
    const clamped = Math.min(30, Math.max(1, Number(days) || 2));
    setDays(clamped);
    setSaving(true);
    try {
      try {
        await supabase.rpc("exec_sql", { sql_text: HEAL_SQL });
      } catch {
        /* ignore */
      }
      const patch: Record<string, any> = { proposal_expiry_days: clamped };
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
        description: `Proposals will expire after ${clamped} day${clamped === 1 ? "" : "s"}.`,
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
          client.
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
        <Button onClick={handleSave} disabled={saving || !loaded}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
