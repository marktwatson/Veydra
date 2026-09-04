import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  CheckCircle2,
  FileText,
  Wine,
  Printer,
  Check,
} from "lucide-react";
import { formatDisplayDate, getCompanyTimezone } from "@/lib/utils";
import { BartendingContractBody } from "@/components/BartendingContractBody";

function fmtMoney(n: number) {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function safe(s: any): string {
  if (s === null || s === undefined) return "";
  return String(s);
}

interface ScheduleEntry {
  label: string;
  amount: number;
  date: string;
  status: string;
}

export default function BartendingContract() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchase, setPurchase] = useState<any>(null);
  const [wedding, setWedding] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [signerName, setSignerName] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signedDate, setSignedDate] = useState<string>("");
  const [signedBy, setSignedBy] = useState<string>("");
  const contractRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data: purchaseData, error: purchaseError } = await supabase
          .from("upsell_purchases")
          .select("*")
          .eq("id", id)
          .single();
        if (purchaseError || !purchaseData) {
          setError("Contract not found.");
          setLoading(false);
          return;
        }
        setPurchase(purchaseData);
        if (purchaseData.contract_snapshot) {
          setSnapshot(purchaseData.contract_snapshot);
        }
        if (purchaseData.contract_status === "signed") {
          setSigned(true);
          setSignedBy(purchaseData.signed_by_name || "");
          setSignedDate(purchaseData.signed_at || "");
        }

        if (purchaseData.wedding_id) {
          const { data: weddingData } = await supabase
            .from("weddings")
            .select("*")
            .eq("id", purchaseData.wedding_id)
            .single();
          if (weddingData) setWedding(weddingData);
        }

        const { data: settingsData } = await supabase
          .from("portal_settings")
          .select("*")
          .limit(1)
          .single();
        if (settingsData) setSettings(settingsData);
      } catch {
        setError("Could not load this contract.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Auto-save contract snapshot when the bride signs
  useEffect(() => {
    if (!justSigned || !contractRef.current || !id) return;
    const html = contractRef.current.innerHTML;
    (async () => {
      try {
        await supabase
          .from("upsell_purchases")
          .update({ contract_snapshot: html })
          .eq("id", id);
        setSnapshot(html);
      } catch {
        // non-fatal — snapshot is best-effort
      } finally {
        setJustSigned(false);
      }
    })();
  }, [justSigned, id]);

  const handleSign = async () => {
    if (!signerName.trim() || !id) return;
    setSigning(true);
    try {
      const { error: signError } = await supabase
        .from("upsell_purchases")
        .update({
          contract_status: "signed",
          signed_at: new Date().toISOString(),
          signed_by_name: signerName.trim(),
        })
        .eq("id", id);
      if (signError) throw signError;
      setSigned(true);
      setSignedBy(signerName.trim());
      setSignedDate(new Date().toISOString());
      setJustSigned(true);
    } catch {
      setError("Could not sign the agreement. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !purchase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Dynamic variables ───
  const companyName = settings?.company_name || "Honeysuckle Haus";
  const companyState = settings?.state || "Tennessee";
  const today = new Date().toLocaleString("en-US", {
    timeZone: getCompanyTimezone(),
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const brideName = safe(wedding?.client_name);
  const partnerName = safe(wedding?.partner_name);
  const clientEmail = safe(wedding?.client_email);
  const weddingDateRaw = wedding?.date;
  const weddingDateStr = weddingDateRaw
    ? formatDisplayDate(safe(weddingDateRaw))
    : "TBD";

  // Parse location
  const locationStr = safe(wedding?.location);
  const locationParts = locationStr.split(",").map((p) => p.trim());
  const lastPart = locationParts[locationParts.length - 1] || "";
  const beforeLast = locationParts.slice(0, -1).join(", ");
  const venueName = beforeLast || locationStr || "Venue TBD";
  const venueAddress = beforeLast || "Address TBD";
  const venueCityState = lastPart || "";

  // Guest count & service times
  const qData =
    wedding?.questionnaire_data &&
    (typeof wedding.questionnaire_data === "string"
      ? (() => {
          try {
            return JSON.parse(wedding.questionnaire_data);
          } catch {
            return null;
          }
        })()
      : wedding.questionnaire_data);

  const guestCount =
    safe(qData?.wedding_party?.wedding_party_size) ||
    safe(qData?.guest_count) ||
    "See venue contract";

  let startTime = "";
  let endTime = "";
  let serviceHours = "";
  if (wedding?.timeline) {
    try {
      const timeline =
        typeof wedding.timeline === "string"
          ? JSON.parse(wedding.timeline)
          : wedding.timeline;
      if (Array.isArray(timeline) && timeline.length > 0) {
        const first = timeline[0];
        const last = timeline[timeline.length - 1];
        if (first?.time) startTime = safe(first.time);
        if (last?.time) endTime = safe(last.time);
        if (startTime && endTime) {
          const sh = parseFloat(startTime);
          const eh = parseFloat(endTime);
          if (!isNaN(sh) && !isNaN(eh) && eh > sh) {
            serviceHours = `${(eh - sh).toFixed(1)} hours`;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  if (!serviceHours) serviceHours = "As agreed in booking";

  // Package details
  const pkgDetails = purchase?.package_details || {};
  const packageName = safe(purchase?.package_name || pkgDetails.name);
  const packagePriceNum = Number(purchase?.list_price || pkgDetails.price) || 0;
  const packagePrice = fmtMoney(packagePriceNum);
  const packageFeatures: string[] = Array.isArray(pkgDetails.features)
    ? pkgDetails.features
    : [];

  const weddingAddons = Array.isArray(wedding?.addons)
    ? wedding.addons.filter((a: string) => !String(a).includes("Bartending"))
    : [];

  const discountNum = Number(purchase?.discount_amount) || 0;
  const discountAmount = fmtMoney(discountNum);
  const totalAmountNum = Number(purchase?.amount) || 0;
  const totalAmount = fmtMoney(totalAmountNum);
  const retainerAmountNum = Number(purchase?.deposit_amount) || 0;
  const retainerAmount = fmtMoney(retainerAmountNum);

  const scheduleEntries: ScheduleEntry[] = Array.isArray(
    purchase?.payment_schedule,
  )
    ? purchase.payment_schedule
    : [];

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6 print:bg-white print:py-0 print:px-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary shrink-0">
              <Wine className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  Bartending Add-On
                </span>
                {signed && (
                  <span className="text-xs font-medium bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Signed
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                {companyName} Services Agreement
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full border-slate-300"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Signed Banner */}
        {signed && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-900 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-base">
                  Agreement Executed & Signed
                </h3>
                <p className="text-sm text-emerald-700">
                  Signed electronically by <strong>{signedBy}</strong> on{" "}
                  {signedDate ? formatDisplayDate(signedDate) : today}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Contract Body Container */}
        <Card className="border border-slate-200 shadow-md rounded-2xl overflow-hidden print:shadow-none print:border-0 print:rounded-none">
          <CardContent className="p-8 sm:p-12 print:p-0 bg-white">
            <div
              ref={contractRef}
              id="bartending-contract-content"
              className="contract-content space-y-8 text-slate-800 font-sans leading-relaxed text-sm"
            >
              {snapshot ? (
                <div dangerouslySetInnerHTML={{ __html: snapshot }} />
              ) : (
                <BartendingContractBody
                  customTemplate={settings?.bartending_contract_template}
                  today={today}
                  companyName={companyName}
                  companyState={companyState}
                  brideName={brideName}
                  partnerName={partnerName}
                  clientEmail={clientEmail}
                  weddingDateStr={weddingDateStr}
                  guestCount={guestCount}
                  venueName={venueName}
                  venueAddress={venueAddress}
                  venueCityState={venueCityState}
                  serviceHours={serviceHours}
                  startTime={startTime}
                  endTime={endTime}
                  packageName={packageName}
                  packagePrice={packagePrice}
                  packageFeatures={packageFeatures}
                  pkgDetails={pkgDetails}
                  weddingAddons={weddingAddons}
                  discountNum={discountNum}
                  discountAmount={discountAmount}
                  totalAmount={totalAmount}
                  retainerAmount={retainerAmount}
                  scheduleEntries={scheduleEntries}
                  signed={signed}
                  signedBy={signedBy}
                  signedDate={signedDate}
                  fmtMoney={fmtMoney}
                  safe={safe}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signature Input Panel (for unsigned) */}
        {!signed && (
          <Card className="border border-slate-200 shadow-md rounded-2xl print:hidden">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base text-slate-900">
                  Electronic Signature Required
                </h3>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="signer-name"
                  className="text-xs font-semibold text-slate-700"
                >
                  Type your full legal name to execute this agreement
                </Label>
                <Input
                  id="signer-name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="e.g., Jane Doe"
                  className="rounded-xl border-slate-300 text-base"
                />
              </div>
              <Button
                className="w-full rounded-xl h-11 text-base font-semibold shadow-sm"
                disabled={!signerName.trim() || signing}
                onClick={handleSign}
              >
                {signing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing
                    Agreement…
                  </>
                ) : (
                  "Sign & Execute Agreement"
                )}
              </Button>
              <p className="text-xs text-slate-500 text-center">
                By typing your name and clicking above, you intend to sign this
                legally binding contract.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Print button footer */}
        {signed && (
          <div className="flex justify-center print:hidden">
            <Button
              variant="outline"
              className="gap-2 rounded-full border-slate-300 shadow-sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Print or Save Copy
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
