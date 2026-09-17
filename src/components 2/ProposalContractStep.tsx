import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  PenTool,
  CheckCircle2,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import { renderContractSnapshot } from "@/lib/booking-fallbacks";
import { useProposalResume } from "@/lib/use-proposal-resume";
import { ProposalResumeView } from "@/components/ProposalResumeView";
import { useCoverageGate } from "@/lib/use-coverage-gate";

/**
 * Step 3 of the proposal flow: the service agreement + electronic signature.
 * Extracted from ProposalReview.tsx to keep that file under the size cap.
 */
export function ProposalContractStep({
  proposal,
  companyName,
  companyState,
  packageString,
  ADDONS,
  signature,
  setSignature,
  isSubmitting,
  paymentPlan,
  calculatePaymentAmount,
  onSign,
  onBack,
  remaining,
  isUpgrade,
}: {
  proposal: any;
  companyName: string;
  companyState: string;
  packageString: string;
  ADDONS: any[];
  signature: string;
  setSignature: (v: string) => void;
  isSubmitting: boolean;
  paymentPlan: string;
  calculatePaymentAmount: () => number;
  onSign: () => void;
  onBack: () => void;
  remaining?: number;
  isUpgrade?: boolean;
}) {
  // Resume check: if the contract is already signed or the wedding has an
  // invoice / off-platform / confirmed state, render the resume view instead
  // of the sign pad. A returning bride lands here at step 3 and sees her
  // current state without re-signing.
  const resume = useProposalResume(proposal?.id, proposal);
  const [resumeNonce, setResumeNonce] = useState(0);
  const coverage = useCoverageGate(proposal, proposal?.wedding_id);

  if (resume.state !== "fresh" && resume.state !== "signed_changed") {
    return (
      <ProposalResumeView
        key={resumeNonce}
        resume={resume}
        proposal={proposal}
        remaining={
          remaining ??
          Math.max(
            0,
            (proposal?.total_amount || 0) - (proposal?.amount_paid_so_far || 0),
          )
        }
        clientName={proposal?.client_name || ""}
        weddingDate={proposal?.wedding_date}
        isUpgrade={isUpgrade}
      />
    );
  }

  // Already signed at the proposal level but resume hook hasn't resolved a
  // wedding yet — show a "signed" checklist with a continue button so the
  // bride can proceed to payment without re-signing. Skip this when the
  // snapshot changed — the pad below handles re-signing.
  const alreadySigned =
    (proposal?.contract_signed_at || proposal?.contract_status === "signed") &&
    resume.state !== "signed_changed";
  if (alreadySigned) {
    return (
      <div className="p-8 md:p-12 space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-3xl font-serif">Contract Signed</h2>
          <div className="h-px w-24 bg-primary/30 mx-auto" />
          <p className="text-muted-foreground font-sans">
            You signed this agreement on{" "}
            {proposal.contract_signed_at
              ? formatDisplayDate(proposal.contract_signed_at)
              : "a previous visit"}
            . No need to sign again — continue to payment.
          </p>
        </div>
        <div className="flex justify-between pt-8 border-t">
          <Button variant="ghost" onClick={onBack} className="font-sans">
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button
            onClick={() => {
              // Pre-fill the signature from the saved contract so the sign
              // handler's name-match validation passes, then advance.
              if (proposal?.contract_signature && !signature) {
                setSignature(proposal.contract_signature);
              }
              // Defer to next tick so state updates before onSign reads it.
              setTimeout(() => onSign(), 0);
            }}
            size="lg"
            className="font-sans tracking-wide"
          >
            Continue to Payment <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-serif">Service Agreement</h2>
        <div className="h-px w-24 bg-primary/30 mx-auto" />
      </div>

      <ScrollArea className="h-[500px] w-full rounded-sm border bg-muted/10 p-8 shadow-inner">
        {proposal.custom_contract_snapshot ? (
          <div
            className="contract-content space-y-6 max-w-3xl mx-auto font-serif prose dark:prose-invert max-w-none text-foreground"
            dangerouslySetInnerHTML={{
              __html: renderContractSnapshot(
                proposal.custom_contract_snapshot,
                {
                  companyName,
                  companyState,
                  client_name: proposal.client_name,
                  partner_name: proposal.partner_name,
                  wedding_date: proposal.wedding_date,
                  venue: proposal.venue,
                  venue_address: proposal.venue_address,
                  city: proposal.city,
                  state: proposal.state,
                  packageString,
                  total_amount: proposal.total_amount,
                  contract_signed_at: proposal.contract_signed_at,
                  addons: proposal.addons,
                  second_shooter_hours: proposal.second_shooter_hours,
                  second_shooter_type: proposal.second_shooter_type,
                  custom_prices: proposal.custom_prices,
                  addonsLookup: ADDONS,
                },
              ),
            }}
          />
        ) : (
          <div className="contract-content space-y-8 max-w-3xl mx-auto font-serif">
            <div className="text-center space-y-4 mb-12">
              <h1 className="text-2xl font-bold uppercase tracking-widest border-b pb-4">
                {proposal.is_upgrade
                  ? "Amendment to Wedding Photography & Videography Agreement"
                  : "Wedding Photography & Videography Agreement"}
              </h1>
              <p className="text-muted-foreground italic">
                ({companyName} — {companyState})
              </p>
              <p className="text-muted-foreground italic">
                This{" "}
                {proposal.is_upgrade
                  ? "Amendment"
                  : "Wedding Agreement (“Agreement”)"}{" "}
                is entered into on{" "}
                <strong>
                  {proposal.contract_signed_at
                    ? formatDisplayDate(proposal.contract_signed_at)
                    : formatDisplayDate(new Date().toISOString())}
                </strong>{" "}
                by and between:
              </p>
            </div>

            <section className="space-y-4">
              <p>
                <strong>Client(s):</strong> {proposal.client_name}{" "}
                {proposal.partner_name ? `& ${proposal.partner_name}` : ""}
              </p>
              <p>
                <strong>Service Provider:</strong> {companyName}, an
                independently owned and operated limited liability company based
                in {companyState} (“Photographer/Videographer”).
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-wider">
                1. Services
              </h2>
              <p>
                {proposal.is_upgrade
                  ? `This amendment modifies the original agreement. ${companyName} agrees to provide the following upgraded services for the Client’s event:`
                  : `${companyName} agrees to provide professional wedding photography and/or videography services for the Client’s event as follows:`}
              </p>
              <ul className="list-none space-y-2">
                <li>
                  <strong>Wedding Date:</strong>{" "}
                  {formatDisplayDate(proposal.wedding_date)}
                </li>
                <li>
                  <strong>Venue:</strong> {proposal.venue}{" "}
                  {proposal.venue_address ? `- ${proposal.venue_address}` : ""}{" "}
                  {proposal.city}, {proposal.state}
                </li>
                {proposal.package_id && (
                  <li>
                    <strong>Package Booked:</strong> {packageString}
                  </li>
                )}
                {(proposal.addons?.length > 0 ||
                  proposal.custom_prices?.items?.length > 0) && (
                  <li>
                    <strong>Add-ons:</strong>
                    {proposal.addons
                      ?.map((a: string) => {
                        const name =
                          ADDONS.find((ad) => ad.id === a)?.name || a;
                        return a === "second_shooter"
                          ? `${name} (${proposal.second_shooter_hours} hrs - ${proposal.second_shooter_type === "video" ? "Videographer" : "Photographer"})`
                          : name;
                      })
                      .join(", ")}
                    {proposal.addons?.length > 0 &&
                    proposal.custom_prices?.items?.length > 0
                      ? ", "
                      : ""}
                    {proposal.custom_prices?.items
                      ?.map((item: any) => item.name)
                      .join(", ")}
                  </li>
                )}
                <li>
                  <strong>Assigned Team:</strong>{" "}
                  {proposal.coverage_type === "both"
                    ? "1 Photographer + 1 Videographer"
                    : proposal.coverage_type === "photo"
                      ? "1 Photographer"
                      : "1 Videographer"}{" "}
                  (unless otherwise noted)
                </li>
              </ul>
              <p>
                {companyName} reserves the right to assign qualified creative
                professionals from its trusted network to ensure timely,
                high-quality coverage.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-wider">
                2. Deliverables
              </h2>
              <p>
                The Photographer/Videographer agrees to deliver the following:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                {(proposal.coverage_type === "photo" ||
                  proposal.coverage_type === "both") && (
                  <li>Professionally edited digital photo gallery</li>
                )}
                {(proposal.coverage_type === "video" ||
                  proposal.coverage_type === "both") && (
                  <li>
                    Edited wedding film (highlight + optional documentary/full
                    ceremony edits, depending on package)
                  </li>
                )}
              </ul>
              <p>
                <strong>Delivery Timeline:</strong> Within approximately 3–4
                weeks following the wedding date. During high-volume months
                (such as October), timelines may extend slightly to maintain
                editing quality.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-wider">
                3. Payment Terms
              </h2>
              <p>
                <strong>Total Investment:</strong> $
                {proposal.total_amount.toLocaleString()}
              </p>
              <div className="bg-primary/5 p-4 rounded-sm space-y-2 border border-primary/10">
                <p>
                  <strong>Retainer (Non-Refundable):</strong> $
                  {(proposal.total_amount / 2).toLocaleString()} due upon
                  signing to reserve your wedding date. The retainer is 50% of
                  the contract value.
                </p>
              </div>
              <p>
                <strong>Remaining Balance:</strong> Due no later than 10 days
                before the wedding date.
              </p>
              <p>
                <strong>Accepted Payments:</strong> Credit Card only (processed
                securely through {companyName}’s online payment system).
              </p>
              <p>
                Payments made via credit card include standard merchant
                processing fees, which are built into the total investment.
                <br />
                Cash, check, or alternative payment methods are not accepted.
              </p>
              <p>
                Failure to make timely payments may result in suspension or
                cancellation of services and forfeiture of the retainer.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-wider">
                4. Rescheduling & Cancellation
              </h2>
              <p>
                <strong>Rescheduling:</strong> The retainer may be applied to a
                new wedding date, subject to availability.
              </p>
              <p>
                <strong>Cancellation:</strong> The retainer is non-refundable.
                Any additional payments made beyond the retainer will be
                refunded if cancellation occurs.
              </p>
              <p>
                If {companyName} must cancel due to emergency or unforeseen
                circumstances, all payments made by the Client will be refunded
                in full, and best efforts will be made to assist in finding an
                alternate provider.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-wider">
                5. Creative Rights
              </h2>
              <p>
                The Client acknowledges that {companyName} maintains complete
                creative control over style, editing, and artistic decisions.
                The Client has reviewed the company’s portfolio and understands
                the creative nature of the work.
              </p>
              <p>
                All photographs and videos remain the copyrighted property of{" "}
                {companyName}, which grants the Client a perpetual,
                non-exclusive, personal-use license to download, print, share,
                and display the media for personal use.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-wider">
                6. Substitutions & Liability
              </h2>
              <p>
                If a scheduled Photographer or Videographer is unable to attend
                due to illness, emergency, or unforeseen event, {companyName}{" "}
                will provide a qualified replacement whenever possible.
              </p>
              <p>
                {companyName} is not responsible for circumstances beyond
                reasonable control (e.g., weather, equipment failure, venue
                restrictions, or interference by guests).
                <br />
                Liability is limited to the return of all payments received.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-wider">
                7. Client Cooperation
              </h2>
              <p>
                The Client agrees to provide a safe and cooperative environment
                for all team members. The Client understands that full
                cooperation—including adherence to schedules, communication, and
                participation from key individuals—directly impacts the final
                quality of results.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-wider">
                8. Model Release
              </h2>
              <p>
                The Client grants {companyName} permission to use images and/or
                video clips from the event for portfolio, social media, website,
                and promotional use.
                <br />
                (Optional: Clients may request in writing to opt out prior to
                the wedding date.)
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-wider">
                9. Entire Agreement
              </h2>
              <p>
                This Agreement represents the full understanding between the
                Client and {companyName}. Any modifications or additions must be
                made in writing and signed by both parties.
              </p>
            </section>
          </div>
        )}
      </ScrollArea>

      <div className="bg-primary/5 p-8 rounded-sm border border-primary/10 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="signature" className="text-lg font-serif">
            Electronic Signature
          </Label>
          <p className="text-sm font-sans text-muted-foreground">
            By typing your name below, you agree to the terms outlined in this
            agreement.
          </p>
        </div>
        <div className="relative max-w-md">
          <PenTool className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            id="signature"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder={`Type "${proposal.client_name}"`}
            className="pl-12 py-6 text-lg font-serif bg-background"
          />
        </div>
      </div>

      <div className="flex justify-between pt-8 border-t">
        <Button variant="ghost" onClick={onBack} className="font-sans">
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button
          onClick={onSign}
          disabled={
            !signature ||
            signature.trim().toLowerCase().replace(/\s+/g, "") !==
              proposal.client_name.toLowerCase().replace(/\s+/g, "") ||
            isSubmitting ||
            coverage.blocked ||
            coverage.loading ||
            (paymentPlan === "custom" &&
              proposal.custom_payment_plan?.enabled &&
              Math.abs(
                (proposal.custom_payment_plan.deposit || 0) +
                  (proposal.custom_payment_plan.installments || []).reduce(
                    (s: number, i: any) => s + (Number(i.amount) || 0),
                    0,
                  ) -
                  proposal.total_amount,
              ) > 0.01)
          }
          size="lg"
          className="font-sans tracking-wide"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ChevronRight className="w-4 h-4 ml-2" />
          )}
          {isSubmitting
            ? "Initializing..."
            : `Sign & Pay $${calculatePaymentAmount().toLocaleString()}`}
        </Button>
      </div>
      {coverage.blocked && (
        <div className="rounded-sm border border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium mb-1">Coverage confirmation required</p>
          <p className="text-xs text-muted-foreground">
            Your wedding date is coming up soon. Our team is confirming a
            photographer
            {coverage.status?.videoNeeded ? " and videographer" : ""} for this
            date. Sign &amp; Pay will unlock once coverage is confirmed — we'll
            be in touch shortly.
          </p>
        </div>
      )}
      {coverage.status?.required && coverage.status.confirmed && (
        <div className="rounded-sm border border-emerald-300/70 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <p className="text-xs">
            A team member is confirmed for this date. Sign and pay to book.
          </p>
        </div>
      )}
    </div>
  );
}
