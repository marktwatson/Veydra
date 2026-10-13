import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Item = {
  territoryId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  territory: string;
  completedAt: string | null;
  status: string;
  error: string;
};

type Draft = {
  companyName: string;
  legalName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  onboardingAddress: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  website: string;
  timezone: string;
  logoUrl: string;
  regions: string[];
  territory: string;
};

const empty: Draft = {
  companyName: "", legalName: "", firstName: "", lastName: "", email: "", phone: "",
  address: "", onboardingAddress: "", city: "", state: "", country: "US", postalCode: "",
  website: "", timezone: "", logoUrl: "", regions: [], territory: "",
};

async function call(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again.");
  const res = await fetch(`${supabaseUrl}/functions/v1/ghl-provision`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "That request failed.");
  return payload;
}

export default function GhlProvision() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<Draft>(empty);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const payload = await call({ action: "list" });
      setItems(payload.items || []);
    } catch (error: any) {
      setNotice(error?.message || "The queue did not load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const open = async (territoryId: string) => {
    setBusy(true);
    setPreview(null);
    setNotice("");
    try {
      const payload = await call({ action: "detail", territoryId });
      setSelected(territoryId);
      setDraft({ ...empty, ...(payload.draft || {}) });
      setStatus(payload.status || "");
      if (payload.error) setNotice(payload.error);
    } catch (error: any) {
      setNotice(error?.message || "That area did not open.");
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const review = async () => {
    setBusy(true);
    setNotice("");
    try {
      const payload = await call({ action: "provision", dryRun: true, territoryId: selected, ...draft });
      setPreview(payload);
    } catch (error: any) {
      setPreview(null);
      setNotice(error?.message || "The check failed.");
    } finally {
      setBusy(false);
    }
  };

  const provision = async () => {
    setBusy(true);
    setNotice("");
    try {
      const payload = await call({ action: "provision", dryRun: false, territoryId: selected, ...draft });
      setPreview(null);
      setSelected("");
      setNotice(`Created ${payload.companyName}. Location ${payload.locationId}.${payload.warnings?.length ? ` ${payload.warnings.join(" ")}` : ""}`);
      await load();
    } catch (error: any) {
      setNotice(error?.message || "It was not created.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (user?.role !== "super_admin") return <p className="p-6 text-sm">Only a super admin can open this.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">Ovanta provisioning</h1>
        <p className="text-sm text-muted-foreground">Finished onboardings that do not have an Ovanta location yet.</p>
      </div>
      {notice && <p className="rounded-xl border border-stone-200 px-3 py-2 text-sm">{notice}</p>}
      {loading ? (
        <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading</p>
      ) : !selected ? (
        <div className="space-y-3">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing is waiting.</p>}
          {items.map((item) => (
            <button key={item.territoryId} type="button" onClick={() => open(item.territoryId)} className="w-full rounded-2xl border border-stone-200 p-4 text-left">
              <span className="block font-medium">{item.companyName || "Unnamed studio"}</span>
              <span className="mt-1 block text-sm text-stone-500">{item.contactName || "No owner"} · {item.contactEmail || "No email"} · {item.territory}</span>
              <span className="mt-1 block text-xs uppercase tracking-wide text-stone-400">{item.status}{item.completedAt ? ` · ${new Date(item.completedAt).toLocaleDateString()}` : ""}</span>
              {item.error && <span className="mt-1 block text-sm text-red-700">{item.error}</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <Button type="button" variant="ghost" onClick={() => { setSelected(""); setPreview(null); }}>Back</Button>
          <p className="text-sm text-stone-500">{draft.territory} · {status || "needs provisioning"}</p>
          {draft.logoUrl && <img src={draft.logoUrl} alt="" className="h-16 rounded-lg bg-white" />}
          <p className="text-sm text-stone-500">Cities from onboarding: {draft.regions.join(", ") || "none"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name" required value={draft.companyName} onChange={(value) => set("companyName", value)} />
            <Field label="Legal name" value={draft.legalName} onChange={(value) => set("legalName", value)} />
            <Field label="First name" required value={draft.firstName} onChange={(value) => set("firstName", value)} />
            <Field label="Last name" required value={draft.lastName} onChange={(value) => set("lastName", value)} />
            <Field label="Email" required value={draft.email} onChange={(value) => set("email", value)} />
            <Field label="Phone" value={draft.phone} onChange={(value) => set("phone", value)} />
            <Field label="Street address" value={draft.address} onChange={(value) => set("address", value)} />
            <Field label="City" value={draft.city} onChange={(value) => set("city", value)} />
            <Field label="State" value={draft.state} onChange={(value) => set("state", value)} />
            <Field label="Country" value={draft.country} onChange={(value) => set("country", value)} />
            <Field label="Postal code" value={draft.postalCode} onChange={(value) => set("postalCode", value)} />
            <Field label="Website" value={draft.website} onChange={(value) => set("website", value)} />
            <Field label="Timezone" value={draft.timezone} onChange={(value) => set("timezone", value)} />
          </div>
          {draft.onboardingAddress && <p className="text-sm text-stone-500">Address from onboarding: {draft.onboardingAddress}</p>}
          <p className="text-xs text-stone-500">Ovanta requires the company name. The agency company id is added on the server. Address, phone, website, and timezone are optional there.</p>
          {!preview ? (
            <Button type="button" onClick={review} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Review before creating</Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-stone-200 p-4">
              <p className="font-medium">This is exactly what will be sent</p>
              <pre className="overflow-auto text-xs">{JSON.stringify(preview.payload, null, 2)}</pre>
              {(preview.skipped || []).map((line: string) => <p key={line} className="text-sm text-stone-500">{line}</p>)}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={busy}>Back</Button>
                <Button type="button" onClick={provision} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Provision Ovanta location</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
