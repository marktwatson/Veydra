import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, Loader2 } from "lucide-react";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { currentTerritoryId, resolveHomeTerritoryId } from "@/lib/current-territory";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ownerPackageKey, ownerSetupClosedKey, packageMath, pricesIn, setupChecks, setupComplete, suggestPricing, type SetupSnapshot } from "@/lib/owner-setup";

const STEPS = ["You", "Studio", "Mark", "Ovanta", "Accounts", "Pricing", "Done"];
const OVANTA_OFFER = "https://ovanta.io/wedding-biz-offer-page";

type Draft = {
  businessName: string;
  state: string;
  cities: string;
  photoHours: string;
  videoHours: string;
  price: string;
  price4: string;
  price8: string;
  deposit: string;
  timezone: string;
  logoUrl: string;
  locationId: string;
  apiKey: string;
  ovantaConnected: boolean;
  ovantaName: string;
  fbAdAccount: string;
  fbToken: string;
  fbConnected: boolean;
  hasContractorStripe: boolean;
  hasEditorStripe: boolean;
};

const emptyDraft: Draft = {
  businessName: "",
  state: "Arizona",
  cities: "",
  photoHours: "8",
  videoHours: "8",
  price: "",
  price4: "",
  price8: "",
  deposit: "",
  timezone: "America/Phoenix",
  logoUrl: "",
  locationId: "",
  apiKey: "",
  ovantaConnected: false,
  ovantaName: "",
  fbAdAccount: "",
  fbToken: "",
  fbConnected: false,
  hasContractorStripe: false,
  hasEditorStripe: false,
};

function draftKey(territoryId: string) {
  return `veydra_owner_welcome:${territoryId}`;
}

function studioCards(text: string) {
  const cleaned = text.replace(/\[\[\d+\]\]/g, "");
  const cards = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]/.test(line))
    .map((line) => {
      const url = line.match(/https?:\/\/[^\s)]+/)?.[0] || "";
      const name = line.match(/\*\*([^*]+)\*\*/)?.[1] || line.replace(/^[-*]\s*/, "").split(",")[0];
      const body = line
        .replace(/^[-*]\s*/, "")
        .replace(/\*\*[^*]+\*\*/, "")
        .replace(url, "")
        .replace(/[()[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const price = body.match(/\$[\d,]+/)?.[0] || "Price not listed";
      const city = body.split(",").map((part) => part.trim()).filter(Boolean)[0] || "";
      return { name: name.trim(), city, price, url };
    })
    .filter((card) => card.name);
  const note = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^[-*]/.test(line) && !/^https?:/.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { cards, note };
}

function MarketResult({ text }: { text: string }) {
  const { cards, note } = studioCards(text);
  if (!cards.length) {
    return <div className="whitespace-pre-wrap rounded-2xl bg-stone-50 p-4 text-sm leading-relaxed dark:bg-stone-900">{text.replace(/\[\[\d+\]\]/g, "")}</div>;
  }
  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <div key={card.name} className="rounded-2xl border border-stone-200 px-4 py-3 dark:border-stone-800">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium text-stone-900 dark:text-stone-50">{card.name}</p>
            <p className="shrink-0 text-sm font-medium">{card.price}</p>
          </div>
          {card.city && <p className="mt-1 text-sm text-stone-500">{card.city}</p>}
          {card.url && (
            <a href={card.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-stone-500 underline">
              Their prices
            </a>
          )}
        </div>
      ))}
      {note && <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{note}</p>}
    </div>
  );
}

function SetupList({ checks }: { checks: { id: string; label: string; done: boolean }[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {checks.map((item) => (
        <li key={item.id} className="flex items-center gap-2 text-sm">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.done ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900" : "border-stone-300 text-transparent"}`}>
            <Check className="h-3 w-3" />
          </span>
          <span className={item.done ? "text-stone-400 line-through" : "text-stone-800 dark:text-stone-100"}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function money(amount: number) {
  if (!Number.isFinite(amount)) return "—";
  return `$${Math.round(amount).toLocaleString()}`;
}

function PricingStep({
  where,
  looking,
  market,
  suggestion,
  price4,
  price8,
  deposit,
  onLookup,
  onUseSuggestion,
  onPrice4,
  onPrice8,
  onDeposit,
}: {
  where: string;
  looking: boolean;
  market: string;
  suggestion: { four: number; eight: number; deposit: number; marketMid: number; samples: number };
  price4: string;
  price8: string;
  deposit: string;
  onLookup: () => void;
  onUseSuggestion: () => void;
  onPrice4: (value: string) => void;
  onPrice8: (value: string) => void;
  onDeposit: (value: string) => void;
}) {
  const four = Number(price4);
  const eight = Number(price8);
  const math4 = four > 0 ? packageMath(four, 4) : null;
  const math8 = eight > 0 ? packageMath(eight, 8) : null;
  return (
    <div className="space-y-5">
      <p className="text-stone-700 dark:text-stone-300">
        See what couples pay near {where}, then start under that so the first bookings come in. Take a {money(suggestion.deposit)} deposit and put the rest on autopay.
      </p>
      <Button type="button" onClick={onLookup} disabled={looking}>
        {looking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Look up studios
      </Button>
      {market && <MarketResult text={market} />}
      <div className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-900">
        <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Suggested starter</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {suggestion.samples
            ? `A typical published price nearby is about ${money(suggestion.marketMid)}. Start near 40% of that.`
            : "Before the lookup, this is the same shape as a $1,600 / 4-hour and $1,950 / 8-hour starter."}
        </p>
        <p className="mt-3 text-sm font-medium">
          4 hours {money(suggestion.four)} · 8 hours {money(suggestion.eight)} · deposit {money(suggestion.deposit)}
        </p>
        <Button type="button" variant="outline" className="mt-3" onClick={onUseSuggestion}>Use these prices</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="price-4">Their 4-hour price</Label>
          <Input id="price-4" value={price4} onChange={(event) => onPrice4(event.target.value)} placeholder={String(suggestion.four)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price-8">Their 8-hour price</Label>
          <Input id="price-8" value={price8} onChange={(event) => onPrice8(event.target.value)} placeholder={String(suggestion.eight)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deposit">Deposit</Label>
          <Input id="deposit" value={deposit} onChange={(event) => onDeposit(event.target.value)} placeholder={String(suggestion.deposit)} />
        </div>
      </div>
      {math8 && (
        <div className="space-y-1 rounded-2xl border border-stone-200 p-4 text-sm dark:border-stone-800">
          <p className="mb-2 font-medium">On an 8-hour wedding at {money(eight)}</p>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Lead contractor, $50 an hour</span><span>{money(math8.contractor)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Edit</span><span>{money(math8.edit)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Sales, 5%</span><span>{money(math8.sales)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Royalty, 5%</span><span>{money(math8.royalty)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Payback, 3%</span><span>{money(math8.payback)}</span></div>
          <div className="flex justify-between gap-3 border-t border-stone-200 pt-2 font-medium dark:border-stone-800"><span>Left for the studio</span><span>{money(math8.left)}</span></div>
          {math4 && <p className="pt-2 text-stone-500">A 4-hour wedding at {money(four)} leaves {money(math4.left)} after the same costs. A second shooter is extra.</p>}
        </div>
      )}
    </div>
  );
}

export default function OwnerWelcome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contractorKey, setContractorKey] = useState("");
  const [editorKey, setEditorKey] = useState("");
  const [step, setStep] = useState(0);
  const [territoryId, setTerritoryId] = useState("");
  const [areaName, setAreaName] = useState("");
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [market, setMarket] = useState("");
  const [suggestion, setSuggestion] = useState(() => suggestPricing([]));
  const [looking, setLooking] = useState(false);
  const [making, setMaking] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [marks, setMarks] = useState<{ url: string; style: string }[]>([]);

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
      const [{ data: area }, settingsResult, { count }] = await Promise.all([
        supabase.from("territories").select("name, contractor_payout_stripe_key, editor_payout_stripe_key").eq("id", id).maybeSingle(),
        supabase
          .from("portal_settings")
          .select("company_name, company_state, regions, logo_url, hl_location_id, hl_api_key, timezone, fb_ad_account_id, fb_access_token, owner_setup")
          .eq("territory_id", id)
          .limit(1)
          .maybeSingle(),
        supabase.from("weddings").select("id", { count: "exact", head: true }).eq("territory_id", id),
      ]);
      let settings: any = settingsResult.data;
      if (settingsResult.error) {
        const fallback = await supabase
          .from("portal_settings")
          .select("company_name, company_state, regions, logo_url, hl_location_id, hl_api_key, timezone, fb_ad_account_id, fb_access_token")
          .eq("territory_id", id)
          .limit(1)
          .maybeSingle();
        settings = fallback.data;
      }
      if (cancelled) return;
      if ((count || 0) > 0) {
        navigate("/manager");
        return;
      }
      setAreaName(area?.name || "This area");
      setLocked((count || 0) > 0);
      const regions = Array.isArray(settings?.regions) ? settings.regions.join(", ") : "";
      const next = {
        ...emptyDraft,
        businessName: settings?.company_name || "",
        state: settings?.company_state || "Arizona",
        cities: regions,
        timezone: settings?.timezone || "America/Phoenix",
        logoUrl: settings?.logo_url || "",
        locationId: settings?.hl_location_id || "",
        ovantaConnected: Boolean(settings?.hl_api_key && settings?.hl_location_id),
        fbAdAccount: settings?.fb_ad_account_id || "",
        fbConnected: Boolean(settings?.fb_ad_account_id && settings?.fb_access_token),
        hasContractorStripe: Boolean(area?.contractor_payout_stripe_key),
        hasEditorStripe: Boolean(area?.editor_payout_stripe_key),
        price: settings?.owner_setup?.package?.price || localStorage.getItem(ownerPackageKey(id)) || "",
        price4: settings?.owner_setup?.package?.price4 || "",
        price8: settings?.owner_setup?.package?.price8 || settings?.owner_setup?.package?.price || localStorage.getItem(ownerPackageKey(id)) || "",
        deposit: settings?.owner_setup?.package?.deposit || "",
        ...(saved || {}),
      };
      next.apiKey = "";
      next.fbToken = "";
      if (settings?.company_name && settings.company_name !== area?.name) next.businessName = settings.company_name;
      if (settings?.hl_api_key && settings?.hl_location_id) next.ovantaConnected = true;
      if (area?.contractor_payout_stripe_key) next.hasContractorStripe = true;
      if (settings?.fb_ad_account_id && settings?.fb_access_token) next.fbConnected = true;
      if ((count || 0) === 0) {
        supabase
          .from("portal_settings")
          .update({ owner_setup: { ...(settings?.owner_setup || {}), started: true } })
          .eq("territory_id", id)
          .then(undefined, () => {});
      }
      setDraft(next);
      setLoading(false);
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!territoryId) return;
    const stored = { ...draft, apiKey: "", fbToken: "" };
    localStorage.setItem(draftKey(territoryId), JSON.stringify(stored));
    localStorage.setItem(ownerPackageKey(territoryId), draft.price4.trim() && draft.price8.trim() ? draft.price8.trim() : "");
  }, [draft, territoryId]);

  const firstName = (user?.name || "there").split(" ")[0];
  const previewName = draft.businessName.trim() || "Your studio";
  const cities = useMemo(
    () => draft.cities.split(",").map((city) => city.trim()).filter(Boolean),
    [draft.cities],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const saveStudio = async () => {
    if (!territoryId || locked) {
      setNotice(locked ? "This area already has weddings, so nothing was saved." : "Pick an area first.");
      return false;
    }
    setSaving(true);
    setNotice("");
    localStorage.setItem(ownerPackageKey(territoryId), draft.price4.trim() && draft.price8.trim() ? draft.price8.trim() : "");
    const payload = {
      company_name: previewName,
      company_state: draft.state.trim(),
      regions: cities,
      timezone: draft.timezone.trim(),
      owner_setup: {
        started: true,
        package: {
          price: draft.price8 || draft.price,
          price4: draft.price4,
          price8: draft.price8,
          deposit: draft.deposit,
          photoHours: "4",
          videoHours: "8",
        },
      },
    };
    let { error } = await supabase.from("portal_settings").update(payload).eq("territory_id", territoryId);
    if (error && /owner_setup/i.test(error.message)) {
      const retry = await supabase
        .from("portal_settings")
        .update({
          company_name: payload.company_name,
          company_state: payload.company_state,
          regions: payload.regions,
          timezone: payload.timezone,
        })
        .eq("territory_id", territoryId);
      error = retry.error;
    }
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
      if (!locked) await saveStudio();
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
      setSuggestion(suggestPricing(pricesIn(payload.reply || "")));
    } catch (error: any) {
      setNotice(error?.message || "The lookup did not finish.");
    } finally {
      setLooking(false);
    }
  };

  const makeMarks = async () => {
    if (!territoryId) return;
    if (previewName === "Your studio") {
      setNotice("Add the business name first.");
      return;
    }
    setMaking(true);
    setNotice("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again.");
      const res = await fetch(`${supabaseUrl}/functions/v1/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          action: "logos",
          territoryId,
          name: previewName,
          place: cities.join(", ") || draft.state || areaName,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "The logos did not come back.");
      const logos = Array.isArray(payload.logos)
        ? payload.logos
            .map((item: any) => (typeof item === "string" ? { url: item, style: "" } : { url: item?.url, style: item?.style || "" }))
            .filter((item: { url?: string }) => !!item.url)
        : [];
      if (!logos.length) {
        throw new Error(
          payload.reply
            ? "Logo generation is not on the server yet. Deploy the assistant function, then try again."
            : payload.error || "No logos came back. Try once more.",
        );
      }
      setMarks(logos);
    } catch (error: any) {
      setNotice(error?.message || "The logos did not come back.");
    } finally {
      setMaking(false);
    }
  };

  const downloadMark = async (src: string, index: number) => {
    const link = document.createElement("a");
    link.download = `${previewName.replace(/\s+/g, "-").toLowerCase()}-logo-${index + 1}.jpg`;
    try {
      const blob = await fetch(src).then((res) => res.blob());
      link.href = URL.createObjectURL(blob);
      link.click();
    } catch {
      window.open(src, "_blank", "noopener");
    }
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
      setDraft((current) => ({ ...current, ovantaName: name, ovantaConnected: !locked }));
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

  const saveAccounts = async () => {
    if (!territoryId || locked) {
      setNotice(locked ? "This area already has weddings, so nothing was saved." : "Pick an area first.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      if (draft.fbAdAccount.trim() && draft.fbToken.trim()) {
        const { error } = await supabase
          .from("portal_settings")
          .update({ fb_ad_account_id: draft.fbAdAccount.trim(), fb_access_token: draft.fbToken.trim() })
          .eq("territory_id", territoryId);
        if (error) throw error;
        set("fbConnected", true);
        set("fbToken", "");
      }
      const patch: Record<string, string> = {};
      if (contractorKey.trim()) patch.contractor_payout_stripe_key = contractorKey.trim();
      if (editorKey.trim()) patch.editor_payout_stripe_key = editorKey.trim();
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("territories").update(patch).eq("id", territoryId);
        if (error) throw error;
        if (patch.contractor_payout_stripe_key) set("hasContractorStripe", true);
        if (patch.editor_payout_stripe_key) set("hasEditorStripe", true);
        setContractorKey("");
        setEditorKey("");
      }
      setNotice("Saved on this area only.");
    } catch (error: any) {
      setNotice(error?.message || "Could not save those accounts.");
    } finally {
      setSaving(false);
    }
  };

  const snapshot: SetupSnapshot = {
    companyName: draft.businessName,
    areaName,
    regions: cities,
    timezone: draft.timezone,
    logoUrl: draft.logoUrl,
    hasOvanta: draft.ovantaConnected,
    hasFacebook: draft.fbConnected,
    hasContractorStripe: draft.hasContractorStripe,
    hasEditorStripe: draft.hasEditorStripe,
    packagePrice: draft.price4.trim() && draft.price8.trim() ? draft.price8 : "",
  };
  const checks = setupChecks(snapshot);
  const finished = setupComplete(snapshot);
  const isSuper = user?.role === "super_admin";

  const closeForMe = () => {
    if (!territoryId || !isSuper) return;
    localStorage.setItem(ownerSetupClosedKey(territoryId), "1");
    navigate("/manager");
  };

  const next = async () => {
    if (step === 1 || step === 5) {
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

      <div className="mt-6 rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
        <SetupList checks={checks} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-1 gap-1">
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
        {isSuper && (
          <button type="button" onClick={closeForMe} className="text-xs text-stone-500 underline">
            Close for now
          </button>
        )}
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
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" value={draft.timezone} onChange={(event) => set("timezone", event.target.value)} placeholder="America/Phoenix" />
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
            <p className="text-stone-700 dark:text-stone-300">Three different directions for {previewName}{cities.length || draft.state ? ` in ${cities.join(", ") || draft.state}` : ""}. Classic, modern, and film. It is a wedding photo and video studio. Pick one, or paste a logo you already have.</p>
            <Button type="button" variant="outline" onClick={makeMarks} disabled={making}>
              {making ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Make three logos
            </Button>
            <div className="grid gap-3">
              {marks.map((mark, index) => (
                <div key={mark.url} className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800">
                  <img src={mark.url} alt="" className="w-full" />
                  <div className="flex items-center justify-between gap-2 p-2">
                    <p className="pl-2 text-sm text-stone-500">{mark.style}</p>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => downloadMark(mark.url, index)}>
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                      </Button>
                      <Button type="button" size="sm" onClick={() => saveLogo(mark.url)}>Use this</Button>
                    </div>
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

        {step === 3 && (
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
            <p className="text-xs text-stone-500">This has to be saved before the setup is finished.</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-stone-700 dark:text-stone-300">These stay on this area. Contractor payouts, editor payouts, and the Facebook ad account.</p>
            <div className="space-y-2">
              <Label htmlFor="contractor-stripe">Contractor payout Stripe secret</Label>
              <Input id="contractor-stripe" type="password" value={contractorKey} onChange={(event) => setContractorKey(event.target.value)} placeholder={draft.hasContractorStripe ? "Saved. Paste a new one to replace it." : "sk_live_..."} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editor-stripe">Editor payout Stripe secret</Label>
              <Input id="editor-stripe" type="password" value={editorKey} onChange={(event) => setEditorKey(event.target.value)} placeholder={draft.hasEditorStripe ? "Saved. Paste a new one to replace it." : "sk_live_..."} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-account">Facebook ad account id</Label>
              <Input id="fb-account" value={draft.fbAdAccount} onChange={(event) => set("fbAdAccount", event.target.value)} placeholder="act_123" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-token">Facebook access token</Label>
              <Input id="fb-token" type="password" value={draft.fbToken} onChange={(event) => set("fbToken", event.target.value)} placeholder={draft.fbConnected ? "Saved. Paste a new one to replace it." : ""} />
            </div>
            <Button type="button" onClick={saveAccounts} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save accounts
            </Button>
          </div>
        )}

        {step === 5 && (
          <PricingStep
            where={cities.join(", ") || draft.state || "this area"}
            looking={looking}
            market={market}
            suggestion={suggestion}
            price4={draft.price4}
            price8={draft.price8}
            deposit={draft.deposit}
            onLookup={lookUpMarket}
            onUseSuggestion={() => {
              set("price4", String(suggestion.four));
              set("price8", String(suggestion.eight));
              set("deposit", String(suggestion.deposit));
            }}
            onPrice4={(value) => set("price4", value)}
            onPrice8={(value) => set("price8", value)}
            onDeposit={(value) => set("deposit", value)}
          />
        )}

        {step === 6 && (
          <p className="text-stone-700 dark:text-stone-300">
            {finished ? "Everything needed for this area is in. You can open the dashboard." : "The setup stays here until every item is checked. An owner cannot close it early."}
          </p>
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
        ) : finished ? (
          <Button type="button" onClick={() => navigate("/manager")}>Go to the dashboard</Button>
        ) : isSuper ? (
          <Button type="button" variant="outline" onClick={closeForMe}>Close for now</Button>
        ) : (
          <p className="text-sm text-stone-500">Finish the open items to leave this setup.</p>
        )}
      </div>
    </div>
  );
}
