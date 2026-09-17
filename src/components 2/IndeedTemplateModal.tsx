import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Briefcase, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const DEFAULT_TEMPLATE = `Pay: {{pay_range}} per hour
Job description:
TO APPLY VISIT {{apply_link}} APPLICATIONS SUBMITTED THROUGH INDEED WILL NOT BE VIEWED.*
Please submit your wedding/highlight video portfolio link when submitting an application. Applications without portfolios will not be considered.
{{company_name}} is a wedding photo/video team looking to hire in our new area of {{area_name}}. This is an amazing way to pick up some extra contract work while still allowing you to work other jobs and build your own business.
Job Requirements
Experience shooting at least 3 weddings REQUIRED. (Applicants that have no experience shooting weddings will not be considered). Please send a gallery and or video links in the application.
-Must be able to shoot and edit consistent with our style.
-Pay is {{pay_min}}-{{pay_max}} per hour for shooting the wedding only, with no editing required for video or images. You will get compensated for working extra hours.
-Expect 20-40 weddings per year through {{company_name}}
**You must have your own camera. See the camera requirements below.
Camera requirements
Video Camera Body:
Can shoot 1080 60fps (anything above is a benefit)
Examples: Panasonic GH5, Sony A7III, Canon EOS R, Canon 80D, Canon 6D MKII, Canon 5D MKIV,
**Some form of stabilization is required for videographers. Monopod, Zhuyin Crane, Ronin S, etc.
Photo Camera Body:
Full frame DSLR or mirrorless
Examples: Nikon D850 D750, Canon 5D, 6D Sony A9, A7R, A7
Lenses:
Fast prime lens 1.2-1.8 for low light
Zoom lens with a wide range (Example 24-70mm)
VISIT {{apply_link}} TO APPLY
Job Types: Part-time, Contract
Work Location: In person`;

function renderBold(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const SECTION_HEADERS = [
  "Job description:",
  "Job Requirements",
  "Camera requirements",
];

function formatPreview(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.trim() === "") return <div key={i} className="h-2" />;
    if (line.startsWith("Pay:")) {
      return (
        <div key={i} className="mb-3 pb-3 border-b">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Compensation
          </span>
          <div className="font-semibold text-base text-primary mt-0.5">
            {line}
          </div>
        </div>
      );
    }
    if (SECTION_HEADERS.includes(line)) {
      return (
        <div
          key={i}
          className="mt-4 mb-2 pt-3 border-t font-semibold text-sm uppercase tracking-wide text-foreground"
        >
          {line.replace(/:$/, "")}
        </div>
      );
    }
    if (line.startsWith("-") || line.startsWith("**")) {
      const clean = line.replace(/^\*\*/, "").replace(/^-/, "").trim();
      return (
        <div key={i} className="flex gap-2 text-sm mb-1.5 pl-1">
          <span className="text-muted-foreground mt-0.5">&#8226;</span>
          <span className="text-foreground/90 flex-1">{renderBold(clean)}</span>
        </div>
      );
    }
    if (line.trim().endsWith(":") && line.length < 40) {
      return (
        <div
          key={i}
          className="mt-2.5 mb-1 font-medium text-sm text-foreground"
        >
          {line}
        </div>
      );
    }
    return (
      <div
        key={i}
        className="text-sm text-foreground/80 mb-1.5 leading-relaxed"
      >
        {renderBold(line)}
      </div>
    );
  });
}

export function IndeedTemplateModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [applyLink, setApplyLink] = useState("");
  const [areaName, setAreaName] = useState("");
  const [payMin, setPayMin] = useState("50");
  const [payMax, setPayMax] = useState("65");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const settings = await api.getPortalSettings();
        const company = settings?.company_name || "Veydra";
        const base = (settings?.app_url || window.location.origin).replace(
          /\/$/,
          "",
        );
        if (cancelled) return;
        setCompanyName(company);
        setApplyLink(`${base}/apply`);

        // Try to resolve this instance's own territory name for the area.
        let area = "";
        try {
          const SELF_PROJECT_REF = "oosmhtzqdmntlzhheofw";
          const { data: selfRow } = await supabase
            .from("territories")
            .select("id, name, project_ref")
            .eq("project_ref", SELF_PROJECT_REF)
            .limit(1)
            .maybeSingle();
          if (selfRow?.name) {
            area = selfRow.name;
          } else {
            const { data: primary } = await supabase
              .from("territories")
              .select("name")
              .eq("is_primary", true)
              .limit(1)
              .maybeSingle();
            area = primary?.name || "";
          }
        } catch {
          area = "";
        }
        if (cancelled) return;
        setAreaName(area);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const fmtMoney = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    return n % 1 === 0 ? `${n}.00` : n.toFixed(2);
  };

  const generated = useCallback(() => {
    const min = fmtMoney(payMin);
    const max = fmtMoney(payMax);
    return DEFAULT_TEMPLATE.replace(/{{pay_range}}/g, `$${min} - $${max}`)
      .replace(/{{pay_min}}/g, min)
      .replace(/{{pay_max}}/g, max)
      .replace(/{{apply_link}}/g, applyLink || "")
      .replace(/{{company_name}}/g, companyName || "")
      .replace(/{{area_name}}/g, areaName || "");
  }, [payMin, payMax, applyLink, companyName, areaName]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generated());
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Indeed job template copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Could not copy to clipboard.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-3 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Indeed Job Posting Template
          </DialogTitle>
          <DialogDescription>
            Master template for posting wedding photo/video contractor jobs on
            Indeed. Edit the fields below — the preview updates live. Copy and
            paste directly into Indeed.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto px-6 py-4 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="grid gap-1.5">
                <Label htmlFor="indeed-company">Company Name</Label>
                <Input
                  id="indeed-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="indeed-area">Area / Market Name</Label>
                <Input
                  id="indeed-area"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="e.g. Nashville, TN"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="indeed-apply">Apply Link</Label>
                <Input
                  id="indeed-apply"
                  value={applyLink}
                  onChange={(e) => setApplyLink(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="indeed-paymin">Pay Min ($/hr)</Label>
                  <Input
                    id="indeed-paymin"
                    type="number"
                    value={payMin}
                    onChange={(e) => setPayMin(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="indeed-paymax">Pay Max ($/hr)</Label>
                  <Input
                    id="indeed-paymax"
                    type="number"
                    value={payMax}
                    onChange={(e) => setPayMax(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="indeed-preview">Preview</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-7"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Text
                    </>
                  )}
                </Button>
              </div>
              <div
                id="indeed-preview"
                className="rounded-lg border bg-muted/20 p-4 min-h-[340px] max-h-[420px] overflow-y-auto"
              >
                <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b bg-muted/40">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
                    <span className="ml-2 text-xs text-muted-foreground">
                      Indeed Job Posting Preview
                    </span>
                  </div>
                  <div className="p-5">{formatPreview(generated())}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
