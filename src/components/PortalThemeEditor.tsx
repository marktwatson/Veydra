import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  DEFAULT_PORTAL_THEME,
  PORTAL_FONT_PAIRS,
  applyPortalTheme,
  parsePortalTheme,
  type PortalTheme,
} from "@/lib/portal-theme";
import { Palette, RotateCcw, Loader2 } from "lucide-react";

const COLOR_FIELDS: { key: keyof PortalTheme; label: string; hint: string }[] =
  [
    {
      key: "primary",
      label: "Primary / Text",
      hint: "Headings, body text, buttons",
    },
    { key: "background", label: "Background", hint: "Page background" },
    { key: "accent", label: "Accent Gold", hint: "Highlights, links, badges" },
    {
      key: "secondary",
      label: "Section Background",
      hint: "Cards & muted areas",
    },
    { key: "border", label: "Border", hint: "Dividers & outlines" },
    { key: "mutedText", label: "Muted Text", hint: "Subtle / secondary text" },
  ];

export function PortalThemeEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<PortalTheme>(DEFAULT_PORTAL_THEME);
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getPortalSettings,
  });

  useEffect(() => {
    const parsed = parsePortalTheme((settings as any)?.portal_theme);
    const next = parsed || DEFAULT_PORTAL_THEME;
    setTheme(next);
    applyPortalTheme(next);
  }, [settings]);

  // Live preview as the user edits.
  useEffect(() => {
    applyPortalTheme(theme);
  }, [theme]);

  const handleColorChange = (key: keyof PortalTheme, value: string) => {
    setTheme((t) => ({ ...t, [key]: value }));
  };

  const handleFontPair = (body: string, heading: string) => {
    setTheme((t) => ({ ...t, bodyFont: body, headingFont: heading }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePortalSettings({
        portal_theme: theme as any,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        title: "Portal theme saved",
        description: "The bride portal will use these colors and fonts.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving theme",
        description: error.message || "Could not save the portal theme.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTheme(DEFAULT_PORTAL_THEME);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" /> Bride Portal Theme
        </CardTitle>
        <CardDescription>
          Customize the colors and fonts shown across the bride portal
          (questionnaire, contract, timeline, gallery). Changes override the
          defaults for this area only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live preview */}
        <div className="bride-portal rounded-2xl border p-5">
          <p className="font-serif text-2xl">Your Wedding Portal</p>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            A warm welcome to your couples — preview how the portal looks.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              Questionnaire
            </span>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: "var(--secondary)",
                color: "var(--secondary-foreground)",
              }}
            >
              Timeline
            </span>
          </div>
          <button
            className="mt-4 rounded-full px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            Save & Continue
          </button>
        </div>

        {/* Colors */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Colors</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{field.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {field.hint}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="color"
                    value={theme[field.key] as string}
                    onChange={(e) =>
                      handleColorChange(field.key, e.target.value)
                    }
                    className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={theme[field.key] as string}
                    onChange={(e) =>
                      handleColorChange(field.key, e.target.value)
                    }
                    className="h-9 w-20 rounded border bg-background px-2 text-xs font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fonts */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Font Pair</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {PORTAL_FONT_PAIRS.map((pair) => {
              const active =
                theme.bodyFont === pair.body &&
                theme.headingFont === pair.heading;
              return (
                <button
                  key={pair.label}
                  type="button"
                  onClick={() => handleFontPair(pair.body, pair.heading)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent/40"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{pair.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {pair.heading} / {pair.body}
                    </p>
                  </div>
                  <span
                    className="font-serif text-lg shrink-0"
                    style={{ fontFamily: `"${pair.heading}", Georgia, serif` }}
                  >
                    Aa
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...
              </>
            ) : (
              "Save Theme"
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
