import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Download, ExternalLink, Loader2 } from "lucide-react";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { currentTerritoryId, resolveHomeTerritoryId } from "@/lib/current-territory";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = ["You", "Studio", "Market", "Packages", "Mark", "Ovanta", "Payouts", "Done"];
const OVANTA_OFFER = "https://ovanta.io/wedding-biz-offer-page";

type Draft = {
  businessName: string;
  state: string;
  cities: string;
  photoHours: string;
  videoHours: string;
  price: string;
  logoUrl: string;
  locationId: string;
  apiKey: string;
  ovantaName: string;
};

const emptyDraft: Draft = {
  businessName: "",
  state: "Arizona",
  cities: "",
  photoHours: "8",
  videoHours: "8",
  price: "",
  logoUrl: "",
  locationId: "",
  apiKey: "",
  ovantaName: "",
};

function draftKey(territoryId: string) {
  return `veydra_owner_welcome:${territoryId}`;
}

function drawMark(name: string, style: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const palettes = [
    ["#f6f1e8", "#1c1917", "#9a7b4f"],
    ["#1c1917", "#f6f1e8", "#d6c4a8"],
    ["#f4f7f5", "#1f3d32", "#c4a574"],
  ];
  const [paper, ink, accent] = palettes[style] || palettes[0];
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(80, 78, 64, 4);
  ctx.fillStyle = ink;
  ctx.font = style === 1 ? "600 64px Georgia, serif" : "500 58px Georgia, serif";
  ctx.fillText(name || "Your studio", 80, 190);
  ctx.font = "400 22px Georgia, serif";
  ctx.fillStyle = accent;
  ctx.fillText("WEDDINGS", 80, 236);
  return canvas.toDataURL("image/png");
}

export default function OwnerWelcome() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [territoryId, setTerritoryId] = useState("");
  const [areaName, setAreaName] = useState("");
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [market, setMarket] = useState("");
  const [looking, setLooking] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [marks, setMarks] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      const id = user?.role === "super_admin" ? await currentTerritoryId() : await resolveHomeTerritoryId();
      if (!id || cancelled) {
        setLoading(false);
        return;
      }
      setTerritoryId(id);
      const savedRaw = localStorage.getItem(draftKey(id));
      let saved: Partial<Draft> = {};
      try {
        saved = savedRaw ? JSON.parse(savedRaw) : {};
      } catch {
        saved = {};
      }
      const [{ data: area }, { data: settings }, { count }] = await Promise.all([
        supabase.from("territories").select("name").eq("id", id).maybeSingle(),
        supabase
          .from("portal_settings")
          .select("company_name, company_state, regions, logo_url, hl_location_id")
          .eq("territory_id", id)
          .limit(1)
          .maybeSingle(),
        supabase.from("weddings").select("id", { count: "exact", head: true }).eq("territory_id", id),
      ]);
      if (cancelled) return;
      setAreaName(area?.name || "This area");
      setLocked((count || 0) > 0);
      const regions = Array.isArray(settings?.regions) ? settings.regions.join(", ") : "";
      const next = {
        ...emptyDraft,
        businessName: settings?.company_name || "",
        state: settings?.company_state || "Arizona",
        cities: regions,
        logoUrl: settings?.logo_url || "",
        locationId: settings?.hl_location_id || "",
        ...(saved || {}),
      };
      if (settings?.company_name && settings.company_name !== area?.name) next.businessName = settings.company_name;
      setDraft(next);
      setLoading(false);
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!territoryId) return;
    const stored = { ...draft };
    stored.apiKey = "";
    localStorage.setItem(draftKey(territoryId), JSON.stringify(stored));
  }, [draft, territoryId]);

  const firstName = (user?.name || "there").split(" ")[0];
  const previewName = draft.businessName.trim() || "Your studio";
  const cities = useMemo(
    () => draft.cities.split(",").map((city) => city.trim()).filter(Boolean),
    [draft.cities],
  );

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const saveStudio = async () => {
    if (!territoryId || locked) {
      setNotice(locked ? "This area already has weddings, so nothing was saved." : "Pick an area first.");
      return false;
    }
    setSaving(true);
    setNotice("");
    const { error } = await supabase
      .from("portal_settings")
      .update({
        company_name: previewName,
        company_state: draft.state.trim(),
        regions: cities,
      })
      .eq("territory_id", territoryId);
    setSaving(false);
    if (error) {
      setNotice(error.message);
      return false;
    }
    return true;
  };

  const lookUpMarket = async () => {
    if (!territoryId) return;
    setLooking(true);
    setMarket("");
    setNotice("");
    try {
      await saveStudio();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again.");
      const where = cities.length ? cities.join(", ") : draft.state;
      const res = await fetch(`${supabaseUrl}/functions/v1/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          territoryId,
          messages: [
            {
              role: "user",
              content: `Who are the other wedding studios around ${where}, and what do they publish for prices?`,
            },
          ],
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "The lookup did not finish.");
      setMarket(payload.reply || "Nothing came back. Try it once more.");
    } catch (error: any) {
      setNotice(error?.message || "The lookup did not finish.");
    } finally {
      setLooking(false);
    }
  };

  const makeMarks = () => {
    setMarks([0, 1, 2].map((style) => drawMark(previewName, style)));
  };

  const downloadMark = (src: string, index: number) => {
    const link = document.createElement("a");
    link.href = src;
    link.download = `${previewName.replace(/\s+/g, "-").toLowerCase()}-mark-${index + 1}.png`;
    link.click();
  };

  const saveLogo = async (url: string) => {
    set("logoUrl", url);
    if (!territoryId || locked || !url.startsWith("http")) return;
    const { error } = await supabase.from("portal_settings").update({ logo_url: url }).eq("territory_id", territoryId);
    setNotice(error ? error.message : "Logo saved on this area.");
  };

  const testOvanta = async () => {
    const key = draft.apiKey.trim();
    const locationId = draft.locationId.trim();
    if (!key || !locationId) {
      setNotice("Paste both the location id and the private token.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch(
        `https://services.leadconnectorhq.com/contacts?locationId=${encodeURIComponent(locationId)}&limit=1`,
        { headers: { Authorization: `Bearer ${key}`, Version: "2021-07-28", Accept: "application/json" } },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Ovanta refused that key.");
      const name = payload?.location?.name || payload?.name || "Connected";
      set("ovantaName", name);
      if (!locked && territoryId) {
        const { error } = await supabase
          .from("portal_settings")
          .update({ hl_api_key: key, hl_location_id: locationId })
          .eq("territory_id", territoryId);
        if (error) throw error;
      }
      setNotice(locked ? `Connected to ${name}, but this area was not updated.` : `Connected to ${name}. Saved on this area only.`);
    } catch (error: any) {
      setNotice(error?.message || "Could not reach Ovanta.");
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step === 1) {
      const ok = await saveStudio();
      if (!ok && !locked) return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening this area
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">New owner setup</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight text-stone-900 dark:text-stone-50">
        {step === 0 ? `Hey ${firstName}.` : STEPS[step]}
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        Writing to <span className="font-medium text-stone-800 dark:text-stone-200">{areaName || "no area selected"}</span>
        {locked ? ". This area already has weddings, so this is a walkthrough only." : ". Other areas are not touched."}
      </p>

      <div className="mt-6 flex gap-1">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            onClick={() => setStep(index)}
            className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-stone-900 dark:bg-stone-100" : "bg-stone-200 dark:bg-stone-800"}`}
          />
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950 sm:p-8">
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-lg leading-relaxed text-stone-700 dark:text-stone-300">
              We'll set the studio name, the cities, a first package, a mark, and the Ovanta connection. You can leave and come back. Nothing goes live for brides until you publish it yourself.
            </p>
            <p className="text-sm text-stone-500">Signed in as {user?.email}</p>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-name">Business name</Label>
                <Input id="business-name" value={draft.businessName} onChange={(event) => set("businessName", event.target.value)} placeholder="The name a bride should see" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={draft.state} onChange={(event) => set("state", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cities">Cities, separated by commas</Label>
                <Input id="cities" value={draft.cities} onChange={(event) => set("cities", event.target.value)} placeholder="Phoenix, Scottsdale, Tucson" />
              </div>
            </div>
            <div className="rounded-2xl bg-stone-50 p-6 dark:bg-stone-900">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">A bride would see</p>
              <p className="mt-6 font-serif text-3xl text-stone-900 dark:text-stone-50">{previewName}</p>
              <p className="mt-2 text-sm text-stone-500">{cities.join(" · ") || draft.state}</p>
              <p className="mt-6 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                {previewName} will not use images or video from this event for portfolio or promotional use unless the client agrees.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-stone-700 dark:text-stone-300">
              Look up other wedding studios near {cities.join(", ") || draft.state} and the prices they publish. Nothing is invented if a price is not on their site.
            </p>
            <Button type="button" onClick={lookUpMarket} disabled={looking}>
              {looking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Look up studios
            </Button>
            {market && <div className="whitespace-pre-wrap rounded-2xl bg-stone-50 p-4 text-sm leading-relaxed dark:bg-stone-900">{market}</div>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-stone-700 dark:text-stone-300">A first package. This stays in the setup for now. It is not added to the live package list until you do that in Settings.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="photo-hours">Photo hours</Label>
                <Input id="photo-hours" value={draft.photoHours} onChange={(event) => set("photoHours", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-hours">Video hours</Label>
                <Input id="video-hours" value={draft.videoHours} onChange={(event) => set("videoHours", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input id="price" value={draft.price} onChange={(event) => set("price", event.target.value)} placeholder="4500" />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-stone-700 dark:text-stone-300">Three wordmarks from the business name. Download the one you like, or paste a logo URL.</p>
            <Button type="button" variant="outline" onClick={makeMarks}>Make three marks</Button>
            <div className="grid gap-3">
              {marks.map((src, index) => (
                <div key={index} className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800">
                  <img src={src} alt="" className="w-full" />
                  <div className="flex justify-end p-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => downloadMark(src, index)}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-url">Logo URL</Label>
              <div className="flex gap-2">
                <Input id="logo-url" value={draft.logoUrl.startsWith("data:") ? "" : draft.logoUrl} onChange={(event) => set("logoUrl", event.target.value)} placeholder="https://" />
                <Button type="button" variant="outline" onClick={() => saveLogo(draft.logoUrl)}>Save</Button>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-stone-700 dark:text-stone-300">
              Ovanta is where their leads live. They start it on Ovanta's page, then come back with the location id and the private integration token.
            </p>
            <a href={OVANTA_OFFER} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium underline">
              Launch Your Territory <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <div className="space-y-2">
              <Label htmlFor="location-id">Location id</Label>
              <Input id="location-id" value={draft.locationId} onChange={(event) => set("locationId", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key">Private integration token</Label>
              <Input id="api-key" type="password" value={draft.apiKey} onChange={(event) => set("apiKey", event.target.value)} />
            </div>
            <Button type="button" onClick={testOvanta} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test and save
            </Button>
            <p className="text-xs text-stone-500">Skip this if they have not signed up yet. You can paste the key later.</p>
          </div>
        )}

        {step === 6 && (
          <p className="text-lg leading-relaxed text-stone-700 dark:text-stone-300">
            Contractor and editor payouts can wait until the first job. Stripe is not required to finish this setup, and this step does not connect a bank.
          </p>
        )}

        {step === 7 && (
          <ul className="space-y-3 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
            <li>Studio name: {previewName}</li>
            <li>Cities: {cities.join(", ") || "Not set"}</li>
            <li>First package: {draft.photoHours} photo hours, {draft.videoHours} video hours{draft.price ? `, $${draft.price}` : ""}. Not on the public list yet.</li>
            <li>Logo: {draft.logoUrl && !draft.logoUrl.startsWith("data:") ? "Saved" : "Not saved yet"}</li>
            <li>Ovanta: {draft.ovantaName || "Not connected"}</li>
            <li>Payouts: Later</li>
          </ul>
        )}

        {notice && <p className="mt-6 text-sm text-stone-600 dark:text-stone-300">{notice}</p>}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (territoryId) localStorage.setItem(`veydra_owner_setup_done:${territoryId}`, "1");
            }}
            asChild
          >
            <Link to="/manager">Go to the dashboard</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
