import { formatDisplayDate } from "@/lib/utils";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

interface ScheduleEntry {
  label: string;
  amount: number;
  date: string;
  status: string;
}

interface ContractBodyProps {
  customTemplate?: string;
  today: string;
  companyName: string;
  companyState: string;
  brideName: string;
  partnerName: string;
  clientEmail: string;
  weddingDateStr: string;
  guestCount: string;
  venueName: string;
  venueAddress: string;
  venueCityState: string;
  serviceHours: string;
  startTime: string;
  endTime: string;
  packageName: string;
  packagePrice: string;
  packageFeatures: string[];
  pkgDetails: any;
  weddingAddons: string[];
  discountNum: number;
  discountAmount: string;
  totalAmount: string;
  retainerAmount: string;
  scheduleEntries: ScheduleEntry[];
  signed: boolean;
  signedBy: string;
  signedDate: string;
  fmtMoney: (n: number) => string;
  safe: (s: any) => string;
}

export function BartendingContractBody({
  customTemplate,
  today,
  companyName,
  companyState,
  brideName,
  partnerName,
  clientEmail,
  weddingDateStr,
  guestCount,
  venueName,
  venueAddress,
  venueCityState,
  serviceHours,
  startTime,
  endTime,
  packageName,
  packagePrice,
  packageFeatures,
  pkgDetails,
  weddingAddons,
  discountNum,
  discountAmount,
  totalAmount,
  retainerAmount,
  scheduleEntries,
  signed,
  signedBy,
  signedDate,
  fmtMoney,
  safe,
}: ContractBodyProps) {
  // If a custom template was saved in Settings → Legal, render it with all
  // variables substituted. Otherwise fall back to the styled structured view.
  if (customTemplate && customTemplate.trim()) {
    const scheduleStr =
      scheduleEntries.length > 0
        ? scheduleEntries
            .map(
              (e, i) =>
                `${e.label || "Installment #" + (i + 1)}: ${fmtMoney(
                  Number(e.amount) || 0,
                )} on ${e.date ? formatDisplayDate(e.date) : "TBD"}`,
            )
            .join("; ")
        : "Pay in full";

    const html = customTemplate
      .replace(/{{company_name}}/g, companyName)
      .replace(/{{company_state}}/g, companyState)
      .replace(/{{bride_name}}/g, brideName)
      .replace(/{{partner_name}}/g, partnerName ? `& ${partnerName}` : "")
      .replace(/{{client_email}}/g, clientEmail)
      .replace(/{{wedding_date}}/g, weddingDateStr)
      .replace(/{{venue}}/g, venueName)
      .replace(/{{venue_address}}/g, venueAddress)
      .replace(/{{city}}/g, venueCityState)
      .replace(/{{state}}/g, companyState)
      .replace(/{{guest_count}}/g, guestCount)
      .replace(/{{service_hours}}/g, serviceHours)
      .replace(/{{start_time}}/g, startTime || "TBD")
      .replace(/{{end_time}}/g, endTime || "TBD")
      .replace(/{{package_name}}/g, packageName)
      .replace(/{{package_price}}/g, packagePrice)
      .replace(
        /{{package_includes}}/g,
        packageFeatures.length > 0
          ? packageFeatures.join(", ")
          : safe(pkgDetails?.description) ||
              "As described in the selected package.",
      )
      .replace(
        /{{add_ons}}/g,
        weddingAddons.length > 0 ? weddingAddons.join(", ") : "None",
      )
      .replace(/{{discount_amount}}/g, discountAmount)
      .replace(/{{total_amount}}/g, totalAmount)
      .replace(/{{retainer_amount}}/g, retainerAmount)
      .replace(/{{payment_schedule}}/g, scheduleStr)
      .replace(/{{date}}/g, today);

    return (
      <div
        className="prose prose-sm max-w-none font-serif"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <>
      {/* Title & Preamble Header */}
      <div className="border-b border-slate-200 pb-6 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {companyName}
            </p>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 mt-1">
              BARTENDING SERVICES AGREEMENT
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Separate from photography and videography services
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
            <p className="font-semibold text-slate-700">Date Issued</p>
            <p>{today}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-600 leading-relaxed mt-4">
          This Bartending Services Agreement (“Agreement”) is entered into as of{" "}
          <strong className="text-slate-900">{today}</strong> between{" "}
          <strong className="text-slate-900">{companyName}</strong> (“Company”),
          located in <strong className="text-slate-900">{companyState}</strong>,
          and{" "}
          <strong className="text-slate-900">
            {brideName}
            {partnerName ? ` & ${partnerName}` : ""}
          </strong>{" "}
          (“Client”). This Agreement covers bartending services only and does
          not amend, replace, or cancel any photography or videography contract
          between the parties. Package name, price, and inclusions are taken
          from the bartending add-on selected for this wedding.
        </div>
      </div>

      {/* Section 1: Parties and Event */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-lg border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-sans">
            1
          </span>
          Parties and Event Details
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-slate-400 uppercase">
              Client
            </p>
            <p className="font-semibold text-slate-900">
              {brideName}
              {partnerName ? ` & ${partnerName}` : ""}
            </p>
            {clientEmail && (
              <p className="text-xs text-slate-500">{clientEmail}</p>
            )}
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Event Date
            </p>
            <p className="font-semibold text-slate-900">{weddingDateStr}</p>
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1">
              <Users className="h-3 w-3" /> Guest Count
            </p>
            <p className="font-semibold text-slate-900">{guestCount}</p>
          </div>

          <div className="sm:col-span-2 space-y-0.5">
            <p className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Venue & Address
            </p>
            <p className="font-semibold text-slate-900">{venueName}</p>
            <p className="text-xs text-slate-500">
              {venueAddress}
              {venueCityState ? `, ${venueCityState}` : ""}
            </p>
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1">
              <Clock className="h-3 w-3" /> Service Window
            </p>
            <p className="font-semibold text-slate-900">{serviceHours}</p>
            {(startTime || endTime) && (
              <p className="text-xs text-slate-500">
                {startTime || "TBD"} to {endTime || "TBD"}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Selected Package & Pricing Breakdown */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-lg border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-sans">
            2
          </span>
          Selected Package & Financial Schedule
        </div>

        <p className="text-xs text-slate-500 italic">
          The following is pulled from the bartending add-on selected for this
          wedding. If Settings prices change later, this signed Agreement
          controls for this Event Date.
        </p>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Package Header Bar */}
          <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                Selected Service
              </span>
              <h3 className="text-lg font-bold mt-1">{packageName}</h3>
            </div>
            <div className="sm:text-right">
              <span className="text-xs text-slate-400">Published Rate:</span>
              <span className="text-xl font-bold text-white block">
                {packagePrice}
              </span>
            </div>
          </div>

          {/* Package Features */}
          <div className="p-4 bg-white space-y-3 border-b border-slate-100">
            <p className="text-xs font-bold uppercase text-slate-400">
              What's Included:
            </p>
            {packageFeatures.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {packageFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">
                {safe(pkgDetails.description) ||
                  "As described in the selected package."}
              </p>
            )}

            {weddingAddons.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-medium text-slate-400">
                  Other Photography/Videography Add-ons on File:
                </p>
                <p className="text-xs text-slate-600">
                  {weddingAddons.join(", ")}
                </p>
              </div>
            )}
          </div>

          {/* Pricing Table */}
          <div className="p-4 bg-slate-50 space-y-3">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2 font-medium text-slate-600">
                    {packageName} Published Rate
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-900">
                    {packagePrice}
                  </td>
                </tr>
                {discountNum > 0 && (
                  <tr className="border-b border-slate-200 text-emerald-700">
                    <td className="py-2 font-medium flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> Existing Client
                      Courtesy Credit
                    </td>
                    <td className="py-2 text-right font-bold">
                      -{discountAmount}
                    </td>
                  </tr>
                )}
                <tr className="border-b border-slate-200 font-bold text-slate-900 text-sm">
                  <td className="py-2.5">Total for this Agreement</td>
                  <td className="py-2.5 text-right text-slate-900">
                    {totalAmount}
                  </td>
                </tr>
                <tr className="text-slate-700 font-medium">
                  <td className="py-2 text-primary">
                    Deposit Due Upon Signing
                  </td>
                  <td className="py-2 text-right font-bold text-primary">
                    {retainerAmount}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Payment Schedule */}
            {scheduleEntries.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Remaining Payment Schedule:
                </p>
                <div className="space-y-1">
                  {scheduleEntries
                    .filter((e) => e.label !== "Deposit")
                    .map((inst, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs py-1 px-2.5 bg-white rounded border border-slate-200/60"
                      >
                        <span className="font-medium text-slate-700">
                          Installment #{idx + 1}: {safe(inst.label)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-[11px]">
                            {inst.date ? formatDisplayDate(inst.date) : "TBD"}
                          </span>
                          <span className="font-bold text-slate-900">
                            {fmtMoney(Number(inst.amount) || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 bg-amber-50/60 border border-amber-200/60 p-3 rounded-lg">
          Existing {companyName} photography or videography clients receive the
          published courtesy credit from honeysucklehaus.com/bartending when
          applied on the upsell. If no courtesy credit was applied, the courtesy
          credit line reads $0.00.
        </p>
      </section>

      {/* Sections 3 to 10 */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-base border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-sans">
            3
          </span>
          Fees and Payment
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Client agrees to pay <strong>{totalAmount}</strong> for{" "}
          <strong>{packageName}</strong>. The deposit of{" "}
          <strong>{retainerAmount}</strong> is due when this Agreement is signed
          and will be charged to the payment method Client already has on file
          with Company, unless the deposit is $0.00. Remaining installments in
          the payment schedule above may be charged to the same payment method
          on the dates shown. Amounts paid under this Agreement are separate
          from photography or videography fees.
        </p>
        <p className="text-xs text-slate-700 leading-relaxed">
          A payment more than seven (7) days late may accrue a late fee of the
          lesser of 1.5% per month or the maximum allowed by law. If a charge to
          the card on file is declined, Company will notify Client; service may
          be withheld until the balance is current.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-base border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-sans">
            4
          </span>
          Scope of Service
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Company will provide TABC-permitted bartending personnel for{" "}
          <strong>{weddingDateStr}</strong> at <strong>{venueName}</strong>,
          within the service window and guest count above, delivering the
          inclusions listed for <strong>{packageName}</strong>.
        </p>
        <p className="text-xs text-slate-700 leading-relaxed">
          Company may refuse service to any guest who appears intoxicated, is
          under 21, or cannot produce valid identification. Extra hours, guest
          counts above the package limit, additional bars, travel beyond
          Company's ordinary area, and specialty items not listed in the
          inclusions above are not included unless added in writing and priced
          separately.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-base border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-sans">
            5
          </span>
          Client Responsibilities
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Client will provide a safe, legal service location and any venue
          permissions the venue requires; name an on-site decision-maker; and
          not pressure staff to overserve or serve minors. If{" "}
          <strong>{packageName}</strong> is a BYO / client-provides-alcohol
          package, Client furnishes all alcohol, mixers, ice, and garnishes and
          arranges lawful leftover alcohol after service. If{" "}
          <strong>{packageName}</strong> is all-inclusive, Company provides the
          standard bar package described in the inclusions above; premium
          bottles beyond that list are extra.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-base border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-sans">
            6
          </span>
          Alcohol Law and Safety
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Personnel serving alcohol will hold current TABC seller-server
          credentials (or the equivalent required at the event location).
          Company may pause or end service immediately if continuing would
          violate law, venue rules, or safe-service standards. Time lost for
          those reasons is not refunded. Company does not promise any guest a
          particular number of drinks.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-base border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-sans">
            7
          </span>
          Cancellation and Date Changes
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          More than 60 days before <strong>{weddingDateStr}</strong>: deposit is
          refundable minus documented third-party costs. 60 to 31 days before:
          deposit (<strong>{retainerAmount}</strong>) is retained; remaining
          balance is waived if the date is released. 30 days or fewer, or
          no-show: <strong>{totalAmount}</strong> is due. A one-time date change
          is allowed if the new date is available and requested at least 30 days
          prior. If Company cancels for reasons within Company's control (other
          than force majeure), Client receives a full refund of amounts paid
          under this Agreement.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-base border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-sans">
            8
          </span>
          Force Majeure
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Neither party is liable for delay or failure caused by events beyond
          reasonable control, including severe weather, venue closure,
          government order, or utility failure. The parties will first try to
          reschedule. If that is not possible, Company refunds amounts paid for
          services not rendered, less documented out-of-pocket costs.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-base border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-sans">
            9
          </span>
          Insurance, Indemnity, and Limits
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Company carries commercially reasonable liability insurance for
          bartending operations and will provide a certificate when the venue
          requires it and the request arrives at least fourteen (14) days before{" "}
          <strong>{weddingDateStr}</strong>.
        </p>
        <p className="text-xs text-slate-700 leading-relaxed">
          To the fullest extent allowed by law, Client indemnifies Company and
          its owners, employees, and contractors from claims arising out of
          Client-provided alcohol, venue conditions, guest conduct, or Client's
          breach of this Agreement, except to the extent caused by Company's
          gross negligence or willful misconduct. Company's total liability
          under this Agreement is limited to the bartending fees Client actually
          paid.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-base border-b border-slate-200 pb-1">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-sans">
            10
          </span>
          General Terms
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          Company is an independent contractor. This is the entire agreement for
          bartending services. Changes must be in writing (email is enough).
          This Agreement is governed by the laws of the State of{" "}
          <strong>{companyState}</strong>. Electronic signatures are originals.
          Company may photograph the bar setup for portfolio use unless Client
          emails an opt-out before <strong>{weddingDateStr}</strong>.
        </p>
      </section>

      {/* Section 11: Signatures Block */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-base">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-sans">
            11
          </span>
          Signatures & Execution
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          By signing, Client confirms <strong>{packageName}</strong>,{" "}
          <strong>{totalAmount}</strong>, <strong>{retainerAmount}</strong>, and
          the payment schedule above are correct, and authorizes Company to
          charge the payment method on file as scheduled.
        </p>

        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
            <span className="font-bold uppercase text-slate-500">
              CLIENT SIGNATURE
            </span>
            <span className="text-slate-400">
              {brideName}
              {partnerName ? ` & ${partnerName}` : ""}
            </span>
          </div>

          {signed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="font-serif italic text-2xl font-bold text-slate-900 bg-white px-4 py-2 rounded border border-slate-200 shadow-inner inline-block">
                  {signedBy}
                </div>
                <span className="text-xs text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified Digital
                  Signature
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Signed on{" "}
                <strong>
                  {signedDate ? formatDisplayDate(signedDate) : today}
                </strong>
              </p>
            </div>
          ) : (
            <div className="py-4 border-2 border-dashed border-slate-300 rounded-lg text-center text-slate-400 text-xs">
              Pending Electronic Signature Below
            </div>
          )}
        </div>
      </section>
    </>
  );
}
