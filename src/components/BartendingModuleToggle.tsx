import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Wine, Loader2 } from "lucide-react";
import { api, type DbPortalSettings } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useBartendingModule } from "@/hooks/use-bartending-module";

/**
 * Super-admin-only master switch for the entire Bartending module.
 * When off, no bartending UI appears anywhere in the app.
 */
export default function BartendingModuleToggle() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const enabled = useBartendingModule();
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (v: boolean) => {
    setToggling(true);
    try {
      await api.updatePortalSettings({
        bartending_module_enabled: v,
      } as Partial<DbPortalSettings>);

      // Verify the write actually persisted — the column may not exist yet on
      // territories that haven't synced the latest schema, in which case the
      // field-by-field retry silently swallows the error.
      const verify = await api.getPortalSettings();
      const persisted = !!verify?.bartending_module_enabled;
      if (persisted !== v) {
        toast({
          variant: "destructive",
          title: "Setting did not save",
          description:
            "The bartending_module_enabled column is missing from this database. Sync your schema (Territories → Sync) then try again.",
        });
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ["portal-settings-bartending-module"],
      });
      await queryClient.invalidateQueries({ queryKey: ["portalSettings"] });
      toast({
        title: v ? "Bartending module enabled" : "Bartending module disabled",
        description: v
          ? "Bartending is now visible across the app."
          : "All bartending UI is now hidden.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Could not update setting",
        description: e.message,
      });
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card className="border-[#c9a96e]/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wine className="h-5 w-5 text-[#c9a96e]" />
              Bartending Module
            </CardTitle>
            <CardDescription>
              Master switch for the entire bartending feature. When off, no
              bartending UI appears anywhere — Settings cards, addon tagging,
              the bride-portal banner, and the wedding-actions menu are all
              hidden. Super admin only.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {toggling && <Loader2 className="h-4 w-4 animate-spin" />}
            <Label className="text-sm text-muted-foreground">
              {enabled ? "On" : "Off"}
            </Label>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Bartending is active. Configure packages and the upsell below."
            : "Turn this on to reveal bartending packages, the upsell card, the portal banner, and the wedding-actions menu items."}
        </p>
      </CardContent>
    </Card>
  );
}
