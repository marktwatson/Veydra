import { useRef, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, ImageIcon, Trash2 } from "lucide-react";

// Keeps <link rel="icon"> and <link rel="apple-touch-icon"> in sync with the
// configured app icon so the browser tab + home-screen icon update live without
// a rebuild. Also rewrites the PWA manifest so the install icon reflects it.
export function applyAppIcon(url: string | null) {
  if (!url) return;
  try {
    localStorage.setItem("veydra_app_icon_url", url);
  } catch {}

  const setLink = (rel: string, href: string) => {
    let el = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.href = href;
  };

  setLink("icon", url);
  setLink("apple-touch-icon", url);

  // Rewrite the PWA manifest icons at runtime so the install / home-screen
  // icon reflects the uploaded image.
  try {
    const manifest = {
      name: "Veydra — Wedding Media Management",
      short_name: "Veydra",
      description:
        "Wedding photo/video operations, bookings, and royalty management portal.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#000000",
      icons: [
        { src: url, sizes: "192x192", type: "image/png", purpose: "any" },
        {
          src: url,
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], {
      type: "application/json",
    });
    const manifestUrl = URL.createObjectURL(blob);
    let manifestLink = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    );
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;
  } catch {}
}

// The hardcoded dragon icon in index.html / manifest.json is the permanent
// default. We intentionally do NOT auto-apply a stored localStorage icon on
// load, so the hardcoded emblem stays unless an owner explicitly uploads a
// different one via Settings (which saves to the DB and applies live).

export function AppIconUploader() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [iconUrl, setIconUrl] = useState<string>("");
  const [manualUrl, setManualUrl] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["portal_settings"],
    queryFn: () => api.getPortalSettings(),
  });

  useEffect(() => {
    if (settings?.app_icon_url) {
      setIconUrl(settings.app_icon_url);
      setManualUrl(settings.app_icon_url);
      applyAppIcon(settings.app_icon_url);
    }
  }, [settings?.app_icon_url]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload an image file (PNG, JPG, or SVG).",
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description:
          "Icon must be under 2MB. Use a 512x512 PNG for best results.",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `app-icon/app-icon-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      await api.updatePortalSettings({
        app_icon_url: publicUrl,
      } as any);

      setIconUrl(publicUrl);
      setManualUrl(publicUrl);
      applyAppIcon(publicUrl);

      toast({
        title: "App icon updated",
        description:
          "Your app icon has been uploaded. It may take a moment to appear on your home screen.",
      });

      queryClient.invalidateQueries({ queryKey: ["portal_settings"] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description:
          error.message ||
          "Could not upload the icon. Make sure the avatars storage bucket exists.",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSaveManualUrl = async () => {
    if (!manualUrl.trim()) return;
    setUploading(true);
    try {
      await api.updatePortalSettings({
        app_icon_url: manualUrl.trim(),
      } as any);

      setIconUrl(manualUrl.trim());
      applyAppIcon(manualUrl.trim());

      toast({
        title: "App icon updated",
        description: "Your app icon URL has been saved.",
      });

      queryClient.invalidateQueries({ queryKey: ["portal_settings"] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to save",
        description: error.message || "Could not save the icon URL.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveIcon = async () => {
    setUploading(true);
    try {
      await api.updatePortalSettings({
        app_icon_url: null,
      } as any);

      setIconUrl("");
      setManualUrl("");
      try {
        localStorage.removeItem("veydra_app_icon_url");
      } catch {}

      toast({
        title: "App icon removed",
        description: "The default icon will be used.",
      });

      queryClient.invalidateQueries({ queryKey: ["portal_settings"] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to remove",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor="app-icon">App Icon (Home Screen & Favicon)</Label>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 overflow-hidden">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt="App icon"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <ImageIcon className="h-7 w-7 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleFileUpload}
              className="hidden"
              id="app-icon-file"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              Upload Icon
            </Button>

            {iconUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={handleRemoveIcon}
                className="rounded-lg text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Remove
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              id="app-icon"
              placeholder="https://example.com/icon.png"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              className="text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading || !manualUrl.trim()}
              onClick={handleSaveManualUrl}
              className="shrink-0"
            >
              Save URL
            </Button>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Upload a square image (ideally 512×512 PNG) for the home screen icon and
        browser tab. This replaces the default icon everywhere the app is
        installed or bookmarked.
      </p>
    </div>
  );
}
