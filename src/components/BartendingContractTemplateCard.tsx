import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export const BARTENDING_CONTRACT_DEFAULT = `<div class="contract-container font-serif">
  <h1 class="text-2xl font-bold uppercase text-center mb-2 tracking-widest border-b pb-4">Bartending Services Agreement</h1>
  <p class="mb-2 italic text-muted-foreground text-center">Separate from photography and videography services</p>
  <p class="mb-4">This Bartending Services Agreement ("Agreement") is entered into as of <strong>{{date}}</strong> between <strong>{{company_name}}</strong> ("Company"), located in <strong>{{company_state}}</strong>, and <strong>{{bride_name}} {{partner_name}}</strong> ("Client"). This Agreement covers bartending services only and does not amend, replace, or cancel any photography or videography contract between the parties.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">1. Parties and Event</h2>
  <ul class="list-disc pl-5 space-y-1 mb-4">
    <li><strong>Client:</strong> {{bride_name}} {{partner_name}}</li>
    <li><strong>Email:</strong> {{client_email}}</li>
    <li><strong>Event date:</strong> {{wedding_date}}</li>
    <li><strong>Venue:</strong> {{venue}}, {{venue_address}}, {{city}}, {{state}}</li>
    <li><strong>Guest count:</strong> {{guest_count}}</li>
    <li><strong>Service window:</strong> {{service_hours}} hours &middot; {{start_time}} to {{end_time}}</li>
  </ul>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">2. Selected Package</h2>
  <p class="mb-2">The following is pulled from the bartending add-on used on this upsell. If Settings prices change later, this signed Agreement controls for this Event Date.</p>
  <ul class="list-disc pl-5 space-y-1 mb-4">
    <li><strong>Package:</strong> {{package_name}}</li>
    <li><strong>Published package price:</strong> {{package_price}}</li>
    <li><strong>What's included:</strong> {{package_includes}}</li>
    <li><strong>Other add-ons on this file:</strong> {{add_ons}}</li>
    <li><strong>Existing-bride courtesy credit:</strong> {{discount_amount}}</li>
    <li><strong>Total for this Agreement:</strong> {{total_amount}}</li>
    <li><strong>Deposit due on signing:</strong> {{retainer_amount}}</li>
    <li><strong>Remaining payment schedule:</strong> {{payment_schedule}}</li>
  </ul>
  <p class="mb-4">Existing {{company_name}} photography or videography clients receive the published courtesy credit from honeysucklehaus.com/bartending when that credit is applied on the upsell. {{discount_amount}} will read $0.00 when the credit is not applied.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">3. Fees and Payment</h2>
  <p class="mb-4">Client agrees to pay {{total_amount}} for {{package_name}}. The deposit of {{retainer_amount}} is due when this Agreement is signed and will be charged to the payment method Client already has on file with Company, unless the deposit is $0.00. Remaining installments in {{payment_schedule}} may be charged to the same payment method on the dates shown. Amounts paid under this Agreement are separate from photography or videography fees.</p>
  <p class="mb-4">A payment more than seven (7) days late may accrue a late fee of the lesser of 1.5% per month or the maximum allowed by law. If a charge to the card on file is declined, Company will notify Client; service may be withheld until the balance is current.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">4. Scope of Service</h2>
  <p class="mb-4">Company will provide TABC-permitted bartending personnel for {{wedding_date}} at {{venue}}, within the service window and guest count above, delivering the inclusions listed for {{package_name}}: {{package_includes}}.</p>
  <p class="mb-4">Company may refuse service to any guest who appears intoxicated, is under 21, or cannot produce valid identification. Extra hours, guest counts above the package limit, additional bars, travel beyond Company's ordinary area, and specialty items not listed in {{package_includes}} are not included unless added in writing and priced separately.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">5. Client Responsibilities</h2>
  <p class="mb-4">Client will provide a safe, legal service location and any venue permissions the venue requires; name an on-site decision-maker; and not pressure staff to overserve or serve minors. If {{package_name}} is a BYO / client-provides-alcohol package, Client furnishes all alcohol, mixers, ice, and garnishes and arranges lawful leftover alcohol after service. If {{package_name}} is all-inclusive, Company provides the standard bar package described in {{package_includes}}; premium bottles beyond that list are extra.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">6. Alcohol Law and Safety</h2>
  <p class="mb-4">Personnel serving alcohol will hold current TABC seller-server credentials (or the equivalent required at the event location). Company may pause or end service immediately if continuing would violate law, venue rules, or safe-service standards. Time lost for those reasons is not refunded. Company does not promise any guest a particular number of drinks.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">7. Cancellation and Date Changes</h2>
  <p class="mb-4">More than 60 days before {{wedding_date}}: deposit is refundable minus documented third-party costs. 60 to 31 days before: deposit ({{retainer_amount}}) is retained; remaining balance is waived if the date is released. 30 days or fewer, or no-show: {{total_amount}} is due. A one-time date change is allowed if the new date is available and requested at least 30 days prior. If Company cancels for reasons within Company's control (other than force majeure), Client receives a full refund of amounts paid under this Agreement.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">8. Force Majeure</h2>
  <p class="mb-4">Neither party is liable for delay or failure caused by events beyond reasonable control, including severe weather, venue closure, government order, or utility failure. The parties will first try to reschedule. If that is not possible, Company refunds amounts paid for services not rendered, less documented out-of-pocket costs.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">9. Insurance, Indemnity, and Limits</h2>
  <p class="mb-4">Company carries commercially reasonable liability insurance for bartending operations and will provide a certificate when the venue requires it and the request arrives at least fourteen (14) days before {{wedding_date}}.</p>
  <p class="mb-4">To the fullest extent allowed by law, Client indemnifies Company and its owners, employees, and contractors from claims arising out of Client-provided alcohol, venue conditions, guest conduct, or Client's breach of this Agreement, except to the extent caused by Company's gross negligence or willful misconduct. Company's total liability under this Agreement is limited to the bartending fees Client actually paid.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">10. General</h2>
  <p class="mb-4">Company is an independent contractor. This is the entire agreement for bartending services. Changes must be in writing (email is enough). This Agreement is governed by the laws of the State of {{company_state}}. Electronic signatures are originals. Company may photograph the bar setup for portfolio use unless Client emails an opt-out before {{wedding_date}}.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-6 mb-2 border-b pb-1">11. Signatures</h2>
  <p class="mb-4">By signing, Client confirms {{package_name}}, {{total_amount}}, {{retainer_amount}}, and {{payment_schedule}} are correct, and authorizes Company to charge the payment method on file as scheduled.</p>
  <p class="mt-8 mb-2"><strong>CLIENT — {{bride_name}} {{partner_name}}</strong></p>
  <p class="mb-4">Signature: ______________________________ &nbsp;&nbsp; Date: {{date}}</p>
</div>`;

function previewHtml(html: string): string {
  return html
    .replace(/{{company_name}}/g, "Honeysuckle Haus")
    .replace(/{{company_state}}/g, "Tennessee")
    .replace(/{{bride_name}}/g, "Sarah")
    .replace(/{{partner_name}}/g, "& John")
    .replace(/{{client_email}}/g, "sarah@example.com")
    .replace(/{{wedding_date}}/g, "October 24, 2026")
    .replace(/{{venue}}/g, "The Grand Ballroom")
    .replace(/{{venue_address}}/g, "123 Main Street")
    .replace(/{{city}}/g, "Nashville")
    .replace(/{{state}}/g, "TN")
    .replace(/{{guest_count}}/g, "150")
    .replace(/{{service_hours}}/g, "5")
    .replace(/{{start_time}}/g, "5:00 PM")
    .replace(/{{end_time}}/g, "10:00 PM")
    .replace(/{{package_name}}/g, "All-Inclusive Wedding Bar")
    .replace(/{{package_price}}/g, "$5,995")
    .replace(
      /{{package_includes}}/g,
      "Full bar, 2 bartenders, glassware, mixers, garnishes",
    )
    .replace(/{{add_ons}}/g, "Aerial Drone Footage")
    .replace(/{{discount_amount}}/g, "$800.00")
    .replace(/{{total_amount}}/g, "$5,195")
    .replace(/{{retainer_amount}}/g, "$1,000")
    .replace(
      /{{payment_schedule}}/g,
      "Installment #1: $1,000 on Nov 1, 2026; Final: $4,195 on Oct 14, 2026",
    )
    .replace(/{{date}}/g, "September 3, 2026");
}

export function BartendingContractTemplateCard() {
  const [template, setTemplate] = useState("");
  const [editorMode, setEditorMode] = useState<"formatted" | "plain">(
    "formatted",
  );
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const settings = await api.getPortalSettings();
        const t = (settings as any)?.bartending_contract_template;
        if (t) setTemplate(t);
      } catch {
        // ignore — defaults to empty
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePortalSettings({
        bartending_contract_template: template,
      } as any);
      toast({
        title: "Bartending contract saved",
        description: "Your bartending agreement template has been updated.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error saving bartending contract",
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle className="text-xl flex items-center justify-between">
          <span>Bartending Services Agreement</span>
          <div className="flex items-center gap-2">
            <Button
              variant={editorMode === "formatted" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditorMode("formatted")}
            >
              Formatted View
            </Button>
            <Button
              variant={editorMode === "plain" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditorMode("plain")}
            >
              Plain Text / HTML Mode
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          This template is used when a bartending add-on is upsold to a booked
          bride and sent for signature. Changes here will NOT affect already
          signed bartending contracts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="bartending-contract-template">
              Bartending Contract Template
            </Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setBartendingContractTemplateDefault(setTemplate)
                }
              >
                Load Standard Default
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Preview Contract
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Bartending Agreement Preview</DialogTitle>
                  </DialogHeader>
                  <div
                    className="mt-4 border rounded-xl p-8 bg-white text-black prose prose-sm max-w-none shadow-sm font-serif"
                    dangerouslySetInnerHTML={{
                      __html: previewHtml(template),
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {!loaded ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : editorMode === "formatted" ? (
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  Live Preview (read-only)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditorMode("plain")}
                >
                  Switch to Edit Mode
                </Button>
              </div>
              <div
                className="p-8 bg-white text-black prose prose-sm max-w-none shadow-sm font-serif max-h-[450px] overflow-y-auto contract-content"
                dangerouslySetInnerHTML={{
                  __html:
                    previewHtml(template) ||
                    "<p class='text-muted-foreground italic'>No template set. Click 'Load Standard Default' or switch to edit mode.</p>",
                }}
              />
            </div>
          ) : (
            <div className="border rounded-md p-4 bg-background space-y-3">
              <p className="text-xs text-muted-foreground italic">
                Edit your bartending contract in HTML below. Switch to Formatted
                View to see a live preview.
              </p>
              <Textarea
                id="bartending-contract-template-plain"
                placeholder="Type or paste your bartending contract in plain text or HTML..."
                className="min-h-[450px] font-mono text-sm leading-relaxed"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              Dynamic Variables:{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{company_name}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{company_state}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{bride_name}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{partner_name}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{client_email}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{wedding_date}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{venue}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{venue_address}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">{"{{city}}"}</code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{state}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{guest_count}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{service_hours}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{start_time}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{end_time}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{package_name}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{package_price}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{package_includes}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{add_ons}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{discount_amount}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{total_amount}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{retainer_amount}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                {"{{payment_schedule}}"}
              </code>
              ,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">{"{{date}}"}</code>
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Bartending Contract"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function setBartendingContractTemplateDefault(set: (v: string) => void) {
  set(BARTENDING_CONTRACT_DEFAULT);
}

export { previewHtml as previewBartendingHtml };
