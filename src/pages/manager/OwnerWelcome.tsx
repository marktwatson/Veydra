import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, Loader2 } from "lucide-react";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { currentTerritoryId, resolveHomeTerritoryId } from "@/lib/current-territory";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ownerPackageKey, ownerSetupClosedKey, packageMath, pricesIn, setupChecks, setupComplete, suggestPricing, type SetupSnapshot } from "@/lib/owner-setup";
import { largestCities, peopleLabel, studioNameIdeas, timezoneFor } from "@/lib/owner-places";

const STEPS = ["You", "Name", "Cities", "Mark", "Ovanta", "Stripe", "Facebook", "Pricing", "Done"];
const OVANTA_OFFER = "https://ovanta.io/wedding-biz-offer-page";
const MARK_EMAIL = "mark@kavoddigital.com";

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
  ovantaSignedUp: boolean;
  ovantaName: string;
  fbAdAccount: string;
  fbToken: string;
  fbConnected: boolean;
  stripeReady: boolean;
  facebookReady: boolean;
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
  ovantaSignedUp: false,
  ovantaName: "",
  fbAdAccount: "",
  fbToken: "",
  fbConnected: false,
  stripeReady: false,
  facebookReady: false,
  hasContractorStripe: false,
  hasEditorStripe: false,
};

function draftKey(territoryId: string) {
  return `veydra_owner_welcome:${territoryId}`;
}

function AssistantSays({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[11px] font-medium text-white dark:bg-stone-100 dark:text-stone-900">V</div>
      <p className="text-lg leading-relaxed text-stone-800 dark:text-stone-100">{children}</p>
    </div>
  );
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
    .filter((card) => card.name && card.name.length < 48 && card.name.split(" ").length <= 6 && !/no studios|not found|should notice|competitors|published pricing|search/i.test(card.name));
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
    return <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Studios around here are not publishing a starting price. Use the starter below. You can change both numbers.</p>;
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
      {note && note.length < 180 && !/no studios|should notice|do not appear|published pricing/i.test(note) && (
        <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{note}</p>
      )}
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
      <Button type="button" onClick={onLookup} disabled={looking}>
        {looking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Look up studios
      </Button>
      {market && <MarketResult text={market} />}
      <div className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-900">
        <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Suggested starter</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {suggestion.samples
            ? `A typical published price near ${where} is about ${money(suggestion.marketMid)}. Start near 40% of that.`
            : `Before the lookup, this is the same shape as a $1,600 / 4-hour and $1,950 / 8-hour starter near ${where}.`}
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
  const [step, setStep] = useState(0);
  const [naming, setNaming] = useState<"ask" | "have" | "ideas">("ask");
  const [vibe, setVibe] = useState<"classic" | "film" | "rooted" | "short">("classic");
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
        ovantaSignedUp: Boolean(settings?.owner_setup?.ovanta_signed_up),
        fbAdAccount: settings?.fb_ad_account_id || "",
        fbConnected: Boolean(settings?.fb_ad_account_id && settings?.fb_access_token),
        stripeReady: Boolean(settings?.owner_setup?.stripe_ready),
        facebookReady: Boolean(settings?.owner_setup?.facebook_ready),
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
      if (settings?.owner_setup?.ovanta_signed_up) next.ovantaSignedUp = true;
      if (settings?.owner_setup?.stripe_ready) next.stripeReady = true;
      if (settings?.company_name && area?.name && settings.company_name !== area.name) setNaming("have");
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

  useEffect(() => {
    setNotice("");
  }, [step]);

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
      ...(draft.businessName.trim() ? { company_name: draft.businessName.trim() } : {}),
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
        ovanta_signed_up: draft.ovantaSignedUp,
        stripe_ready: draft.stripeReady,
        facebook_ready: draft.facebookReady,
      },
    };
    let { error } = await supabase.from("portal_settings").update(payload).eq("territory_id", territoryId);
    if (error && /owner_setup/i.test(error.message)) {
      const retry = await supabase
        .from("portal_settings")
        .update({
          ...(draft.businessName.trim() ? { company_name: draft.businessName.trim() } : {}),
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
              content: `List wedding photo and video studios near ${where} that publish a package price. One studio per line, exactly like this: - **Studio Name**, City, $3500, https://example.com. Skip any studio with no price. If none publish a price, reply with exactly NONE. No paragraphs.`,
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

  const confirmReady = async (field: "stripe_ready" | "facebook_ready", key: "stripeReady" | "facebookReady", message: string) => {
    set(key, true);
    setNotice("");
    if (!territoryId || locked) return;
    const { data } = await supabase.from("portal_settings").select("owner_setup").eq("territory_id", territoryId).maybeSingle();
    const { error } = await supabase
      .from("portal_settings")
      .update({
        owner_setup: {
          ...(data?.owner_setup || {}),
          started: true,
          [field]: true,
        },
      })
      .eq("territory_id", territoryId);
    setNotice(error ? error.message : message);
  };

  const confirmOvanta = async () => {
    set("ovantaSignedUp", true);
    setNotice("");
    if (!territoryId || locked) return;
    const { data } = await supabase.from("portal_settings").select("owner_setup").eq("territory_id", territoryId).maybeSingle();
    const { error } = await supabase
      .from("portal_settings")
      .update({
        owner_setup: {
          ...(data?.owner_setup || {}),
          started: true,
          ovanta_signed_up: true,
          ovanta_signed_up_at: new Date().toISOString(),
        },
      })
      .eq("territory_id", territoryId);
    setNotice(error ? error.message : "Marked as signed up. Mark will connect it.");
  };

  const snapshot: SetupSnapshot = {
    companyName: draft.businessName,
    areaName,
    regions: cities,
    timezone: draft.timezone,
    logoUrl: draft.logoUrl,
    hasOvanta: draft.ovantaConnected,
    ovantaSignedUp: draft.ovantaSignedUp,
    hasFacebook: draft.fbConnected,
    facebookReady: draft.facebookReady,
    hasContractorStripe: draft.hasContractorStripe,
    hasEditorStripe: draft.hasEditorStripe,
    stripeReady: draft.stripeReady,
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
    if (step === 1 || step === 2 || step === 7) {
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
        {step === 0 ? `Hey ${firstName}.` : step === 1 ? "Do you have a name yet?" : step === 2 ? "Where will you cover?" : STEPS[step]}
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
            <AssistantSays>
              Hey {firstName}. I'm the Veydra assistant. I'm here to help you open this studio. We'll name it, pick the cities that are actually big enough to cover, then the logo, Ovanta, Stripe, and ads. You can leave and come back. Nothing goes live for brides until you publish it.
            </AssistantSays>
            <p className="pl-11 text-sm text-stone-500">Signed in as {user?.email}</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <AssistantSays>
              {naming === "ideas"
                ? `No name yet. That's fine. Tell me the feeling and I'll throw out a few for ${draft.state || "this state"}. Steal one, or type your own.`
                : "If brides would already recognize the name, tell me. If you don't have one, I'll help you find it."}
            </AssistantSays>
            {naming === "ask" && (
              <div className="flex flex-wrap gap-2 pl-11">
                <Button type="button" onClick={() => setNaming("have")}>I have a name</Button>
                <Button type="button" variant="outline" onClick={() => setNaming("ideas")}>Help me name it</Button>
              </div>
            )}
            {naming === "ideas" && (
              <div className="space-y-3 pl-11">
                <div className="flex flex-wrap gap-2">
                  {(["classic", "film", "rooted", "short"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setVibe(item)}
                      className={`rounded-full border px-3 py-1 text-sm capitalize ${vibe === item ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 text-stone-700"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {studioNameIdeas(draft.state || "Arizona", vibe).map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => set("businessName", idea)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${draft.businessName === idea ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300"}`}
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {naming !== "ask" && (
              <div className="space-y-4 pl-11">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business name</Label>
                  <Input id="business-name" value={draft.businessName} onChange={(event) => set("businessName", event.target.value)} placeholder="The name a bride should see" />
                </div>
                <div className="rounded-2xl bg-stone-50 p-5 dark:bg-stone-900">
                  <p className="text-xs uppercase tracking-[0.16em] text-stone-500">A bride would see</p>
                  <p className="mt-3 font-serif text-3xl text-stone-900 dark:text-stone-50">{previewName}</p>
                </div>
                {naming === "have" && (
                  <button type="button" className="text-sm text-stone-500 underline" onClick={() => setNaming("ideas")}>I don't have one yet</button>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <AssistantSays>
              {largestCities(draft.state).length
                ? `These are the largest cities in ${draft.state}. I'd start here. A new studio gets spread too thin if it tries to cover every small town.`
                : `Tell me the state, then the cities you'll actually cover.`}
            </AssistantSays>
            <div className="space-y-4 pl-11">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={draft.state}
                  onChange={(event) => {
                    const state = event.target.value;
                    set("state", state);
                    set("timezone", timezoneFor(state, cities));
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {largestCities(draft.state).map((city) => {
                  const on = cities.some((item) => item.toLowerCase() === city.name.toLowerCase());
                  return (
                    <button
                      key={city.name}
                      type="button"
                      onClick={() => {
                        const next = on ? cities.filter((item) => item.toLowerCase() !== city.name.toLowerCase()) : [...cities, city.name];
                        set("cities", next.join(", "));
                        set("timezone", timezoneFor(draft.state, next));
                      }}
                      className={`rounded-2xl border px-3 py-2 text-left text-sm ${on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300"}`}
                    >
                      <span className="block font-medium">{city.name}</span>
                      <span className={on ? "text-stone-300" : "text-stone-500"}>about {peopleLabel(city.people)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cities">Add a city I left off</Label>
                <Input id="cities" value={draft.cities} onChange={(event) => set("cities", event.target.value)} placeholder="Phoenix, Scottsdale" />
              </div>
              <p className="text-sm text-stone-500">I'll use {draft.timezone || "the state timezone"} for texts and deadlines.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <AssistantSays>
              I'll make three marks for {previewName}{cities.length || draft.state ? ` in ${cities.join(", ") || draft.state}` : ""}. Classic, modern, and film. This is a wedding photo and video studio. Pick one, or paste a logo you already have.
            </AssistantSays>
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
            {/^https?:\/\//.test(draft.logoUrl) && (
              <div className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800">
                <img src={draft.logoUrl} alt="Chosen logo" className="w-full bg-white" />
                <p className="px-3 py-2 text-sm text-stone-500">This is the logo saved on the area.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="logo-url">Logo URL</Label>
              <div className="flex gap-2">
                <Input id="logo-url" value={draft.logoUrl.startsWith("data:") ? "" : draft.logoUrl} onChange={(event) => set("logoUrl", event.target.value)} placeholder="https://" />
                <Button type="button" variant="outline" onClick={() => saveLogo(draft.logoUrl)}>Save</Button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <AssistantSays>
              Ovanta is where the leads live. Open it, create the account, and pay there. Come back and tell me you did. You will not see a location id. Mark connects that after you confirm.
            </AssistantSays>
            <a href={OVANTA_OFFER} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium underline">
              Launch Your Territory <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {draft.ovantaConnected ? (
              <p className="text-sm text-stone-600 dark:text-stone-300">This area is already connected{draft.ovantaName ? ` to ${draft.ovantaName}` : ""}.</p>
            ) : draft.ovantaSignedUp ? (
              <p className="text-sm text-stone-600 dark:text-stone-300">You confirmed the signup. Mark still has to connect it.</p>
            ) : (
              <Button type="button" onClick={confirmOvanta}>I signed up</Button>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-stone-700 dark:text-stone-300">
            <AssistantSays>Set up the studio's Stripe account, finish identity and payouts, turn on Connect, then invite {MARK_EMAIL} as an admin. Don't paste any secret keys. Mark adds those after he's on the account.</AssistantSays>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Create the account in the studio name. <a className="underline" href="https://dashboard.stripe.com/register" target="_blank" rel="noreferrer">Open Stripe</a>.</li>
              <li>Finish identity verification when Stripe asks for the owner and the business.</li>
              <li>Add the bank account Stripe pays the studio into. That is under Settings, then Payouts.</li>
              <li>Open Connect and finish the profile. This is what lets contractors and editors get paid later. <a className="underline" href="https://dashboard.stripe.com/connect" target="_blank" rel="noreferrer">Open Connect</a>.</li>
              <li>Invite <span className="font-medium">{MARK_EMAIL}</span> as an administrator. <a className="underline" href="https://dashboard.stripe.com/settings/team" target="_blank" rel="noreferrer">Open Team</a>.</li>
            </ol>
            {draft.stripeReady || (draft.hasContractorStripe && draft.hasEditorStripe) ? (
              <p className="text-sm text-stone-600 dark:text-stone-300">Stripe is marked ready. Mark still connects the payout keys.</p>
            ) : (
              <Button type="button" onClick={() => confirmReady("stripe_ready", "stripeReady", "Stripe is marked ready. Mark still connects the payout keys.")}>
                Stripe is set up and Mark is an admin
              </Button>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 text-stone-700 dark:text-stone-300">
            <AssistantSays>Facebook ads need their own account, a card on file, and {MARK_EMAIL} as an admin. Don't paste a token. I'll just mark it ready once you've done that.</AssistantSays>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Open Meta Business Suite and create a business in the studio name if you do not already have one. <a className="underline" href="https://business.facebook.com/overview" target="_blank" rel="noreferrer">Open Business Suite</a>.</li>
              <li>Create an ad account for this studio. <a className="underline" href="https://business.facebook.com/settings/ad-accounts" target="_blank" rel="noreferrer">Ad accounts</a>.</li>
              <li>Add a payment method so the account can be billed. <a className="underline" href="https://business.facebook.com/billing_hub/payment_settings" target="_blank" rel="noreferrer">Billing</a>.</li>
              <li>Add <span className="font-medium">{MARK_EMAIL}</span> as an admin on the business and on that ad account. <a className="underline" href="https://business.facebook.com/settings/people" target="_blank" rel="noreferrer">People</a>.</li>
            </ol>
            {draft.facebookReady || draft.fbConnected ? (
              <p className="text-sm text-stone-600 dark:text-stone-300">The ad account is marked ready.</p>
            ) : (
              <Button type="button" onClick={() => confirmReady("facebook_ready", "facebookReady", "The ad account is marked ready.")}>
                The ad account is set up and Mark is an admin
              </Button>
            )}
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <AssistantSays>
              Start low so the first bookings come in. I'll look at what couples around {cities.join(", ") || draft.state || "here"} are paying, then you tell me the two prices you want to open with.
            </AssistantSays>
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
          </div>
        )}

        {step === 8 && (
          <div className="space-y-4">
            <AssistantSays>
              {finished
                ? "That's everything I need from you. The dashboard is yours."
                : "A few things are still open. I'll keep this here until they're done. You can't skip them."}
            </AssistantSays>
          </div>
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
