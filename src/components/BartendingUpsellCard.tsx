import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Wine, Loader2, Save, ArrowRight } from "lucide-react";
import { api, type DbPortalSettings } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function BartendingUpsellCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["portal-settings-upsell"],
    queryFn: () => api.getPortalSettings(),
  });

  const [draft, setDraft] = useState<Partial<DbPortalSettings> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Merge live settings with any unsaved draft edits
  const current: Partial<DbPortalSettings> = { ...(settings as any), ...draft };
  const enabled = !!current.upsell_bartending_enabled;
  const headline = current.upsell_bartending_headline || "";
  const subtext = current.upsell_bartending_subtext || "";
  const emailSubject = current.upsell_bartending_email_subject || "";
  const emailTemplate = current.upsell_bartending_email_template || "";
  const smsTemplate = current.upsell_bartending_sms_template || "";

  const patch = (p: Partial<DbPortalSettings>) =>
    setDraft((prev) => ({ ...(prev || {}), ...p }));

  const save = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      await api.updatePortalSettings(draft as any);
      setDraft(null);
      await queryClient.invalidateQueries({
        queryKey: ["portal-settings-upsell"],
      });
      toast({ title: "Bartending upsell saved" });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wine className="h-5 w-5 text-primary" />
              Bartending Upsell
            </CardTitle>
            <CardDescription>
              Market a bartending add-on to your already-booked brides. Shows as
              a banner in the bride portal and can be pushed via email/SMS.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {draft && (
              <Button size="sm" onClick={save} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Label
                htmlFor="upsell-enabled"
                className="text-sm text-muted-foreground"
              >
                {enabled ? "Active" : "Disabled"}
              </Label>
              <Switch
                id="upsell-enabled"
                checked={enabled}
                onCheckedChange={(v) => patch({ upsell_bartending_enabled: v })}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !enabled ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Enable the toggle to activate the bartending upsell banner in the
            bride portal. Packages are managed in the Add-Ons section above.
          </p>
        ) : (
          <>
            {/* Packages pointer */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <Wine className="h-5 w-5 text-[#c9a96e] shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    Packages are managed in Add-Ons
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tag any addon as "Bartending upsell" in the Add-Ons section
                    to make it appear in the bride portal.
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-[#c9a96e]/50 text-[#c9a96e]"
              >
                Single source of truth
              </Badge>
            </div>

            {/* Banner copy */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <h4 className="text-sm font-semibold">Portal Banner Copy</h4>
              <div className="grid gap-2">
                <Label
                  htmlFor="upsell-headline"
                  className="text-xs text-muted-foreground"
                >
                  Headline
                </Label>
                <Input
                  id="upsell-headline"
                  placeholder="Add Professional Bartending to Your Wedding"
                  value={headline}
                  onChange={(e) =>
                    patch({ upsell_bartending_headline: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="upsell-subtext"
                  className="text-xs text-muted-foreground"
                >
                  Subtext
                </Label>
                <Textarea
                  id="upsell-subtext"
                  placeholder="Let our certified bartenders handle your reception so you can enjoy every moment."
                  value={subtext}
                  onChange={(e) =>
                    patch({ upsell_bartending_subtext: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>

            {/* Outreach templates */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <h4 className="text-sm font-semibold">Outreach Templates</h4>
              <p className="text-xs text-muted-foreground">
                Used when staff pushes the upsell to a bride via email/SMS from
                the Weddings page. Variables: {"{{bride_name}}"},{" "}
                {"{{company_name}}"}, {"{{portal_link}}"}.
              </p>
              <div className="grid gap-2">
                <Label
                  htmlFor="upsell-email-subject"
                  className="text-xs text-muted-foreground"
                >
                  Email Subject
                </Label>
                <Input
                  id="upsell-email-subject"
                  placeholder="Add bartending to your wedding, {{bride_name}}!"
                  value={emailSubject}
                  onChange={(e) =>
                    patch({ upsell_bartending_email_subject: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="upsell-email-template"
                  className="text-xs text-muted-foreground"
                >
                  Email Body (HTML)
                </Label>
                <Textarea
                  id="upsell-email-template"
                  placeholder="<p>Hi {{bride_name}}, we now offer professional bartending...</p>"
                  value={emailTemplate}
                  onChange={(e) =>
                    patch({ upsell_bartending_email_template: e.target.value })
                  }
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="upsell-sms-template"
                  className="text-xs text-muted-foreground"
                >
                  SMS Body
                </Label>
                <Textarea
                  id="upsell-sms-template"
                  placeholder="Hi {{bride_name}}! Add pro bartending to your wedding — see packages here: {{portal_link}}"
                  value={smsTemplate}
                  onChange={(e) =>
                    patch({ upsell_bartending_sms_template: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
