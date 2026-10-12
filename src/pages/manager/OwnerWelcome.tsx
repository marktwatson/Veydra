import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, Loader2 } from "lucide-react";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { currentTerritoryId, resolveHomeTerritoryId } from "@/lib/current-territory";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newTerritoryPricing, ownerPackageKey, ownerSetupClosedKey, packageMath, setupChecks, setupComplete, a2pReady, type SetupSnapshot } from "@/lib/owner-setup";
import { largestCities, peopleLabel, studioNameIdeas, timezoneFor } from "@/lib/owner-places";

const STEPS = ["You", "Name", "Cities", "Mark", "Ovanta", "Stripe", "Facebook", "Pricing", "Done"];
const OVANTA_OFFER = "https://signup.ovanta.io";
const ONBOARDING_CALL = "https://links.ovanta.io/widget/bookings/ovanta-walkthrough";
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
  legalName: string;
  ein: string;
  businessAddress: string;
  businessPhone: string;
  ovantaName: string;
  fbAdAccount: string;
  fbToken: string;
  fbConnected: boolean;
  stripeReady: boolean;
  facebookReady: boolean;
  hasContractorStripe: boolean;
  hasEditorStripe: boolean;
  packageSkipped: boolean;
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
  legalName: "",
  ein: "",
  businessAddress: "",
  businessPhone: "",
  ovantaName: "",
  fbAdAccount: "",
  fbToken: "",
  fbConnected: false,
  stripeReady: false,
  facebookReady: false,
  hasContractorStripe: false,
  hasEditorStripe: false,
  packageSkipped: false,
};

function draftKey(territoryId: string) {
  return `veydra_owner_welcome:${territoryId}`;
}

function OnboardingCalendar() {
  useEffect(() => {
    const src = "https://links.ovanta.io/js/form_embed.js";
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.body.appendChild(script);
  }, []);
  return (
    <iframe
      src={ONBOARDING_CALL}
      title="Onboarding call"
      id="urwQfNQJeOKXT96wLPWG_1791821037050"
      allow="payment"
      scrolling="no"
      className="h-[760px] w-full border-0 bg-white"
    />
  );
}

function AssistantSays({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[11px] font-medium text-white dark:bg-stone-100 dark:text-stone-900">V</div>
      <p className="text-lg leading-relaxed text-stone-800 dark:text-stone-100">{children}</p>
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

const STEP_FOR: Record<string, number> = {
  name: 1,
  cities: 2,
  timezone: 2,
  logo: 3,
  ovanta: 4,
  stripe: 5,
  facebook: 6,
  package: 7,
};

function PricingStep({
  approved,
  skipped,
  onApprove,
  onSkip,
}: {
  approved: boolean;
  skipped: boolean;
  onApprove: () => void;
  onSkip: () => void;
}) {
  const math4 = packageMath(newTerritoryPricing.four, 4);
  const math8 = packageMath(newTerritoryPricing.eight, 8);
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-900">
        <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Suggested new territory pricing</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">These are your starting prices. Every new territory opens here.</p>
        <p className="mt-3 text-sm font-medium">
          4 hours {money(newTerritoryPricing.four)} · 8 hours {money(newTerritoryPricing.eight)} · deposit {money(newTerritoryPricing.deposit)}
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-stone-200 p-4 text-sm dark:border-stone-800">
        <p className="font-medium">Expected margin</p>
        <div>
          <p className="mb-1 text-stone-500">4 hours at {money(newTerritoryPricing.four)}</p>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Photographer and videographer, $50 an hour each</span><span className="shrink-0">{money(math4.contractor)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Edit</span><span>{money(math4.edit)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Sales, royalty, and payback</span><span>{money(math4.sales + math4.royalty + math4.payback)}</span></div>
          <div className="flex justify-between gap-3 font-medium"><span>Left for the studio</span><span>{money(math4.left)}</span></div>
        </div>
        <div className="border-t border-stone-200 pt-3 dark:border-stone-800">
          <p className="mb-1 text-stone-500">8 hours at {money(newTerritoryPricing.eight)}</p>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Photographer and videographer, $50 an hour each</span><span className="shrink-0">{money(math8.contractor)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Edit</span><span>{money(math8.edit)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-stone-500">Sales, royalty, and payback</span><span>{money(math8.sales + math8.royalty + math8.payback)}</span></div>
          <div className="flex justify-between gap-3 font-medium"><span>Left for the studio</span><span>{money(math8.left)}</span></div>
        </div>
        <p className="text-xs leading-relaxed text-stone-400">Not exact. This leaves out second shooters and anything else this area pays. It is not final until those costs are added.</p>
      </div>
      {approved && <p className="text-sm text-stone-600 dark:text-stone-300">These prices are saved for this area.</p>}
      {skipped && <p className="text-sm text-stone-600 dark:text-stone-300">You skipped this. Talk with Nik before these packages go out.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onApprove}>Approve these prices</Button>
        <Button type="button" variant="outline" onClick={onSkip}>I need to talk to Nik</Button>
      </div>
      <p className="text-sm text-stone-500">If these prices are not right for you, reach out to Nik and talk it over. You can skip this step until then.</p>
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
  const [openedOffer, setOpenedOffer] = useState(false);
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
        packageSkipped: Boolean(settings?.owner_setup?.package_skipped),
        ...(saved || {}),
      };
      next.apiKey = "";
      next.fbToken = "";
      if (settings?.company_name && settings.company_name !== area?.name) next.businessName = settings.company_name;
      if (settings?.hl_api_key && settings?.hl_location_id) next.ovantaConnected = true;
      if (settings?.owner_setup?.ovanta_signed_up) next.ovantaSignedUp = true;
      if (settings?.owner_setup?.stripe_ready) next.stripeReady = true;
      if (settings?.owner_setup?.package_skipped) {
        next.packageSkipped = true;
        next.price = "";
        next.price4 = "";
        next.price8 = "";
        next.deposit = "";
      }
      const a2p = settings?.owner_setup?.a2p || {};
      if (a2p.legal_name) next.legalName = a2p.legal_name;
      if (a2p.ein) next.ein = a2p.ein;
      if (a2p.address) next.businessAddress = a2p.address;
      if (a2p.phone) next.businessPhone = a2p.phone;
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
    const stored = { ...draft, apiKey: "", fbToken: "", ein: "" };
    localStorage.setItem(draftKey(territoryId), JSON.stringify(stored));
    localStorage.setItem(ownerPackageKey(territoryId), draft.price4.trim() && draft.price8.trim() ? draft.price8.trim() : "");
  }, [draft, territoryId]);

  useEffect(() => {
    setNotice("");
    if (step !== 4) setOpenedOffer(false);
  }, [step]);

  const firstName = (user?.name || "there").split(" ")[0];
  const previewName = draft.businessName.trim() || "Your studio";
  const cities = useMemo(
    () => draft.cities.split(",").map((city) => city.trim()).filter(Boolean),
    [draft.cities],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const saveStudio = async (override?: Partial<Draft>) => {
    const current = { ...draft, ...override };
    if (!territoryId || locked) {
      setNotice(locked ? "This area already has weddings, so nothing was saved." : "Pick an area first.");
      return false;
    }
    setSaving(true);
    setNotice("");
    localStorage.setItem(ownerPackageKey(territoryId), current.price4.trim() && current.price8.trim() && !current.packageSkipped ? current.price8.trim() : "");
    const payload = {
      ...(current.businessName.trim() ? { company_name: current.businessName.trim() } : {}),
      company_state: current.state.trim(),
      regions: cities,
      timezone: current.timezone.trim(),
      owner_setup: {
        started: true,
        package: {
          price: current.packageSkipped ? "" : current.price8 || current.price,
          price4: current.packageSkipped ? "" : current.price4,
          price8: current.packageSkipped ? "" : current.price8,
          deposit: current.packageSkipped ? "" : current.deposit,
          photoHours: "4",
          videoHours: "8",
        },
        package_skipped: current.packageSkipped,
        ovanta_signed_up: current.ovantaSignedUp,
        stripe_ready: current.stripeReady,
        facebook_ready: current.facebookReady,
        a2p: {
          legal_name: current.legalName.trim(),
          ein: current.ein.trim(),
          address: current.businessAddress.trim(),
          phone: current.businessPhone.trim(),
        },
      },
    };
    let { error } = await supabase.from("portal_settings").update(payload).eq("territory_id", territoryId);
    if (error && /owner_setup/i.test(error.message)) {
      const retry = await supabase
        .from("portal_settings")
        .update({
          ...(current.businessName.trim() ? { company_name: current.businessName.trim() } : {}),
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

  const approvePrices = async () => {
    const prices = {
      price4: String(newTerritoryPricing.four),
      price8: String(newTerritoryPricing.eight),
      deposit: String(newTerritoryPricing.deposit),
      price: String(newTerritoryPricing.eight),
      packageSkipped: false,
    };
    setDraft((current) => ({ ...current, ...prices }));
    const ok = await saveStudio(prices);
    if (ok || locked) setStep(8);
  };

  const skipPrices = async () => {
    const prices = { price: "", price4: "", price8: "", deposit: "", packageSkipped: true };
    setDraft((current) => ({ ...current, ...prices }));
    const ok = await saveStudio(prices);
    if (ok || locked) {
      setNotice("Reach out to Nik to talk over pricing. You can come back to this step.");
      setStep(8);
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
    if (!a2pReady(draft)) {
      setNotice("Texting setup needs the legal business name, a 9-digit EIN, the business address, and a phone number.");
      return;
    }
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
          a2p: {
            legal_name: draft.legalName.trim(),
            ein: draft.ein.trim(),
            address: draft.businessAddress.trim(),
            phone: draft.businessPhone.trim(),
          },
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
    packagePrice: draft.packageSkipped ? "" : draft.price4.trim() && draft.price8.trim() ? draft.price8 : "",
    packageSkipped: draft.packageSkipped,
    legalName: draft.legalName,
    ein: draft.ein,
    businessAddress: draft.businessAddress,
    businessPhone: draft.businessPhone,
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
    if (step === 7 && !draft.packageSkipped && !(draft.price4.trim() && draft.price8.trim())) {
      setNotice("Approve these prices, or skip this and talk to Nik.");
      return;
    }
    if (step === 1 || step === 2 || step === 4 || step === 7) {
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
              Ovanta is where the leads live. Open the signup, create the account, and pay there. Texting also needs the legal business name, EIN, address, and phone. Mark connects it after you come back.
            </AssistantSays>
            <div className="space-y-3 pl-11">
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="legal-name">Legal business name</Label>
                  <Input id="legal-name" value={draft.legalName} onChange={(event) => set("legalName", event.target.value)} placeholder="Name on the EIN" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ein">EIN</Label>
                  <Input id="ein" value={draft.ein} onChange={(event) => set("ein", event.target.value)} placeholder="12-3456789" inputMode="numeric" autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-address">Business address</Label>
                  <Input id="business-address" value={draft.businessAddress} onChange={(event) => set("businessAddress", event.target.value)} placeholder="Street, city, state, ZIP" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-phone">Business phone</Label>
                  <Input id="business-phone" value={draft.businessPhone} onChange={(event) => set("businessPhone", event.target.value)} placeholder="(555) 555-5555" inputMode="tel" />
                </div>
              </div>
              {draft.ovantaConnected ? (
                <p className="text-sm text-stone-600 dark:text-stone-300">This area is already connected{draft.ovantaName ? ` to ${draft.ovantaName}` : ""}. Save the business details if they are not stored yet.</p>
              ) : draft.ovantaSignedUp ? (
                <p className="rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-600 dark:border-stone-800 dark:text-stone-300">You confirmed the signup. Mark still has to connect it.</p>
              ) : (
                <>
                  <a
                    href={OVANTA_OFFER}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpenedOffer(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-900"
                  >
                    Launch Your Territory <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {openedOffer && (
                    <div className="rounded-2xl border border-stone-200 px-4 py-4 dark:border-stone-800">
                      <p className="text-sm text-stone-600 dark:text-stone-300">Once the account is created and paid, confirm it here. The four fields above have to be filled in first.</p>
                      <Button type="button" className="mt-3" onClick={confirmOvanta}>I signed up</Button>
                    </div>
                  )}
                </>
              )}
              {(draft.ovantaConnected || draft.ovantaSignedUp) && (
                <Button
                  type="button"
                  onClick={async () => {
                    if (!a2pReady(draft)) {
                      setNotice("Texting setup needs the legal business name, a 9-digit EIN, the business address, and a phone number.");
                      return;
                    }
                    const ok = await saveStudio();
                    if (ok) setNotice("Business details saved for texting setup.");
                  }}
                >
                  Save business details
                </Button>
              )}
            </div>
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
              These are the starting prices for a new territory. Look at the margin, then approve them. If they are not right, talk to Nik and skip this for now.
            </AssistantSays>
            <PricingStep
              approved={Boolean(draft.price4.trim() && draft.price8.trim() && !draft.packageSkipped)}
              skipped={draft.packageSkipped}
              onApprove={approvePrices}
              onSkip={skipPrices}
            />
          </div>
        )}

        {step === 8 && (
          <div className="space-y-4">
            <AssistantSays>
              {finished
                ? draft.packageSkipped
                  ? "The setup steps are done. Pricing still needs a conversation with Nik. Last thing: book the onboarding call."
                  : "That's everything in the setup. Last thing: book the onboarding call."
                : "These are still open. Go back to the step and finish it. Stripe and Facebook have to be marked before you leave."}
            </AssistantSays>
            {finished && (
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800">
                <OnboardingCalendar />
              </div>
            )}
            {!finished && (
              <div className="space-y-2 pl-11">
                {checks.filter((item) => !item.done).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 px-4 py-3 dark:border-stone-800">
                    <p className="text-sm text-stone-800 dark:text-stone-100">{item.label} is not done.</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => setStep(STEP_FOR[item.id] ?? 0)}>
                      Go to {STEPS[STEP_FOR[item.id] ?? 0]}
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
