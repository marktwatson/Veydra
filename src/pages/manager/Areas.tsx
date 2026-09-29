import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { HONEYSUCKLE_TERRITORY_ID } from "@/lib/territory";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Loader2,
  MapPin,
  ExternalLink,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface AreaRow {
  id: string;
  name: string;
  slug: string | null;
  is_primary: boolean;
}

interface SettingsLite {
  territory_id: string | null;
  hl_api_key: string | null;
  hl_location_id: string | null;
  hl_user_id: string | null;
  ghl_invoice_base_url: string | null;
  ghl_webhook_secret: string | null;
  proposal_expiry_days: number | null;
  app_url: string | null;
  company_name: string | null;
  sales_pin: string | null;
  timezone: string | null;
}

const SETTINGS_FIELDS: Array<{
  key: keyof SettingsLite;
  label: string;
  type?: "number" | "text" | "password";
}> = [
  { key: "hl_api_key", label: "CRM API Key" },
  { key: "hl_location_id", label: "CRM Location ID" },
  { key: "hl_user_id", label: "CRM User ID" },
  { key: "ghl_invoice_base_url", label: "Invoice Link Domain" },
  { key: "ghl_webhook_secret", label: "Webhook Secret" },
  {
    key: "proposal_expiry_days",
    label: "Proposal Expiry (days)",
    type: "number",
  },
  { key: "app_url", label: "App URL" },
  { key: "company_name", label: "Company Name" },
  { key: "sales_pin", label: "Sales PIN (public builder)", type: "password" },
  { key: "timezone", label: "Timezone" },
];

const isHoneysuckle = (t: AreaRow) =>
  t.is_primary || t.id === HONEYSUCKLE_TERRITORY_ID;

export default function Areas() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newArea, setNewArea] = useState({ name: "", slug: "" });
  const [editingArea, setEditingArea] = useState<AreaRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: areas = [], isLoading } = useQuery<AreaRow[]>({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("territories")
        .select("id, name, slug, is_primary")
        .order("is_primary", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as AreaRow[];
    },
  });

  const { data: settingsByTerritory = {} } = useQuery<
    Record<string, SettingsLite>
  >({
    queryKey: ["areas-settings", areas.map((a) => a.id).join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_settings")
        .select(
          "territory_id, hl_api_key, hl_location_id, hl_user_id, ghl_invoice_base_url, ghl_webhook_secret, proposal_expiry_days, app_url, company_name, sales_pin, timezone",
        )
        .not("territory_id", "is", null);
      if (error) throw error;
      const map: Record<string, SettingsLite> = {};
      (data || []).forEach((s: SettingsLite) => {
        if (s.territory_id) map[s.territory_id] = s;
      });
      return map;
    },
    enabled: areas.length > 0,
  });

  const hasSettings = (t: AreaRow) => {
    if (!settingsByTerritory[t.id]) return false;
    const s = settingsByTerritory[t.id];
    return Boolean(s.hl_api_key || s.hl_location_id || s.company_name);
  };

  const hasPin = (t: AreaRow) => {
    const s = settingsByTerritory[t.id];
    return Boolean(s?.sales_pin && s.sales_pin.trim());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newArea.name.trim();
    const slug = newArea.slug.trim().toLowerCase();
    if (!name || !slug) {
      toast.error("Name and slug are required");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error("Slug must be lowercase letters, numbers, or hyphens only");
      return;
    }
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      const { error: terrError } = await supabase.from("territories").insert({
        id,
        name,
        slug,
        is_primary: false,
      });
      if (terrError) throw terrError;

      // Seed an empty portal_settings row for this territory.
      const { error: settingsError } = await supabase
        .from("portal_settings")
        .insert({
          territory_id: id,
          hl_api_key: "",
          hl_location_id: "",
          hl_user_id: "",
          ghl_invoice_base_url: "",
          ghl_webhook_secret: "",
          proposal_expiry_days: 2,
          app_url: window.location.origin,
          company_name: name,
          sales_pin: "",
          timezone: "",
        });
      if (settingsError) {
        // Non-fatal — the area still exists; owner can edit + save later.
        console.warn("portal_settings seed failed", settingsError.message);
      }

      toast.success("Area created", {
        description: `${name} is ready. Builder: /build-proposal/${slug} · Apply: /apply/${slug}`,
      });
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      queryClient.invalidateQueries({ queryKey: ["areas-settings"] });
      queryClient.invalidateQueries({ queryKey: ["team-territories"] });
      setNewArea({ name: "", slug: "" });
      setIsCreateOpen(false);
    } catch (e: any) {
      toast.error("Failed to create area", { description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const copyApplyPath = (t: AreaRow) => {
    const path = t.slug ? `/apply/${t.slug}` : "/apply/honeysuckle";
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopiedId(`${t.id}-apply`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const copyBuilderPath = (t: AreaRow) => {
    const path = t.slug
      ? `/build-proposal/${t.slug}`
      : "/build-proposal/honeysuckle";
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopiedId(`${t.id}-builder`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Areas
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage contractor areas, their public apply slugs, and per-area CRM
            settings.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Area
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Create New Area</DialogTitle>
              <DialogDescription>
                Adds a territory and an empty portal_settings row for it. No
                Supabase project is created — this is local metadata only.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="area-name">Name</Label>
                <Input
                  id="area-name"
                  placeholder="e.g. San Antonio / Austin"
                  value={newArea.name}
                  onChange={(e) =>
                    setNewArea({ ...newArea, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area-slug">Slug</Label>
                <Input
                  id="area-slug"
                  placeholder="e.g. san-antonio"
                  value={newArea.slug}
                  onChange={(e) =>
                    setNewArea({ ...newArea, slug: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens only. Applies at
                  /apply/&lt;slug&gt;.
                </p>
              </div>
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Create Area
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Areas
          </CardTitle>
          <CardDescription>
            Each row is a public.territories record. Honeysuckle is the legacy
            primary area and cannot be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : areas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <MapPin className="mx-auto h-12 w-12 opacity-20 mb-4" />
              <p>No areas yet.</p>
              <p className="text-sm mt-1">Create one using the button above.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Public Links</TableHead>
                    <TableHead>CRM Settings</TableHead>
                    <TableHead>Sales Access</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areas.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {t.name}
                          {isHoneysuckle(t) && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal"
                            >
                              Honeysuckle
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.slug || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono">
                              {t.slug
                                ? `/apply/${t.slug}`
                                : "/apply/honeysuckle"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyApplyPath(t)}
                              title="Copy contractor apply link"
                            >
                              {copiedId === `${t.id}-apply` ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono">
                              {t.slug
                                ? `/build-proposal/${t.slug}`
                                : "/build-proposal/honeysuckle"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyBuilderPath(t)}
                              title="Copy sales proposal builder link"
                            >
                              {copiedId === `${t.id}-builder` ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasSettings(t) ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                          >
                            Configured
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50/60 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                          >
                            Missing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasPin(t) ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                          >
                            PIN set
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50/60 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                          >
                            Open access
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingArea(t)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingArea && (
        <EditAreaSheet
          area={editingArea}
          onClose={() => setEditingArea(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["areas-settings"] });
            setEditingArea(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Edit sheet for a single area: territory name/slug + the portal_settings
 * fields scoped to that territory only. Saves via upsert on territory_id.
 */
function EditAreaSheet({
  area,
  onClose,
  onSaved,
}: {
  area: AreaRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(area.name);
  const [slug, setSlug] = useState(area.slug || "");
  const [settings, setSettings] = useState<SettingsLite>({
    territory_id: area.id,
    hl_api_key: "",
    hl_location_id: "",
    hl_user_id: "",
    ghl_invoice_base_url: "",
    ghl_webhook_secret: "",
    proposal_expiry_days: 2,
    app_url: "",
    company_name: area.name,
    sales_pin: "",
    timezone: "",
  });
  const [open, setOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Load the existing portal_settings row for THIS territory only.
  useQuery({
    queryKey: ["area-settings", area.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_settings")
        .select(
          "territory_id, hl_api_key, hl_location_id, hl_user_id, ghl_invoice_base_url, ghl_webhook_secret, proposal_expiry_days, app_url, company_name, sales_pin, timezone",
        )
        .eq("territory_id", area.id)
        .maybeSingle();
      if (error && error.code !== "42P01") throw error;
      if (data) {
        setSettings({
          territory_id: area.id,
          hl_api_key: data.hl_api_key ?? "",
          hl_location_id: data.hl_location_id ?? "",
          hl_user_id: data.hl_user_id ?? "",
          ghl_invoice_base_url: data.ghl_invoice_base_url ?? "",
          ghl_webhook_secret: data.ghl_webhook_secret ?? "",
          proposal_expiry_days: data.proposal_expiry_days ?? 2,
          app_url: data.app_url ?? "",
          company_name: data.company_name ?? "",
          sales_pin: data.sales_pin ?? "",
          timezone: data.timezone ?? "",
        });
      }
      setLoaded(true);
      return data;
    },
    enabled: !!area.id,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    if (cleanSlug && !/^[a-z0-9-]+$/.test(cleanSlug)) {
      toast.error("Slug must be lowercase letters, numbers, or hyphens only");
      return;
    }
    setSaving(true);
    try {
      // Update territory name/slug.
      const { error: terrError } = await supabase
        .from("territories")
        .update({ name: name.trim(), slug: cleanSlug || null })
        .eq("id", area.id);
      if (terrError) throw terrError;

      // Upsert portal_settings scoped to this territory_id. We update the
      // matching row if it exists; otherwise insert a new one. Never use a
      // bare .limit(1) without the territory filter.
      const payload = {
        territory_id: area.id,
        hl_api_key: settings.hl_api_key || null,
        hl_location_id: settings.hl_location_id || null,
        hl_user_id: settings.hl_user_id || null,
        ghl_invoice_base_url: settings.ghl_invoice_base_url || null,
        ghl_webhook_secret: settings.ghl_webhook_secret || null,
        proposal_expiry_days:
          settings.proposal_expiry_days == null
            ? 2
            : Number(settings.proposal_expiry_days),
        app_url: settings.app_url || null,
        company_name: settings.company_name || null,
        sales_pin: settings.sales_pin || null,
        timezone: settings.timezone || null,
      };

      const { data: existing } = await supabase
        .from("portal_settings")
        .select("id")
        .eq("territory_id", area.id)
        .maybeSingle();

      let upsertError: any = null;
      if (existing?.id) {
        const { error } = await supabase
          .from("portal_settings")
          .update(payload)
          .eq("id", existing.id);
        upsertError = error;
      } else {
        const { error } = await supabase
          .from("portal_settings")
          .insert(payload);
        upsertError = error;
      }
      if (upsertError) throw upsertError;

      toast.success("Area saved", {
        description: `${name.trim()} settings updated.`,
      });
      onSaved();
    } catch (e: any) {
      toast.error("Failed to save area", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <SheetContent className="sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Area — {area.name}</SheetTitle>
          <SheetDescription>
            Update the area name, slug, and per-area CRM settings. Saves to
            portal_settings scoped by territory_id.
          </SheetDescription>
        </SheetHeader>
        {loaded ? (
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-area-name">Name</Label>
              <Input
                id="edit-area-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-area-slug">Slug</Label>
              <Input
                id="edit-area-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="san-antonio"
              />
            </div>
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                CRM Settings (this area only)
              </p>
              {SETTINGS_FIELDS.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={`s-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`s-${f.key}`}
                    type={
                      f.type === "number"
                        ? "number"
                        : f.type === "password"
                          ? "password"
                          : "text"
                    }
                    value={(settings[f.key] as any) ?? ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [f.key]:
                          f.type === "number"
                            ? e.target.value === ""
                              ? null
                              : Number(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <SheetFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  onClose();
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
