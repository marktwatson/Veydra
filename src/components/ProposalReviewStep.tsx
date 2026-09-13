import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";

/**
 * Step 1 of the proposal flow: investment summary / review.
 * Extracted from ProposalReview.tsx to keep that file under the size cap.
 */
export function ProposalReviewStep({
  proposal,
  packageString,
  PACKAGES,
  ADDONS,
  onContinue,
}: {
  proposal: any;
  packageString: string;
  PACKAGES: any[];
  ADDONS: any[];
  onContinue: () => void;
}) {
  return (
    <div className="p-8 md:p-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-serif">Investment Summary</h2>
        <div className="h-px w-24 bg-primary/30 mx-auto" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 bg-muted/30 rounded-sm border border-border/50 p-6 font-sans">
        {proposal.wedding_date && (
          <div className="text-center space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Wedding Date
            </p>
            <p className="font-medium">
              {formatDisplayDate(proposal.wedding_date)}
            </p>
          </div>
        )}
        {proposal.venue && (
          <div className="text-center space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Venue
            </p>
            <p className="font-medium">{proposal.venue}</p>
          </div>
        )}
        {(proposal.city || proposal.state) && (
          <div className="text-center space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Location
            </p>
            <p className="font-medium">
              {[proposal.city, proposal.state].filter(Boolean).join(", ")}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {proposal.package_id && (
          <div className="space-y-6 border-b border-border pb-8">
            <div>
              <h3 className="text-xl font-medium">{packageString} Package</h3>
              <p className="text-muted-foreground font-sans mt-1">
                Base coverage includes:
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {(proposal.coverage_type === "photo" ||
                proposal.coverage_type === "both") && (
                <div className="space-y-3">
                  <h4 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
                    Photography
                  </h4>
                  <ul className="space-y-2">
                    {PACKAGES.find(
                      (p) => p.id === proposal.package_id,
                    )?.photoFeatures?.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(proposal.coverage_type === "video" ||
                proposal.coverage_type === "both") && (
                <div className="space-y-3">
                  <h4 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
                    Videography
                  </h4>
                  <ul className="space-y-2">
                    {PACKAGES.find(
                      (p) => p.id === proposal.package_id,
                    )?.videoFeatures?.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {proposal.addons && proposal.addons.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
              Included Enhancements
            </h3>
            <ul className="grid gap-4 sm:grid-cols-2">
              {proposal.addons.map((addon: string) => {
                const addonDetails = ADDONS.find((a) => a.id === addon);
                const addonName =
                  addonDetails?.name || addon.replace(/_/g, " ");
                return (
                  <li
                    key={addon}
                    className="flex items-start bg-muted/30 p-4 rounded-sm"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary mr-3 shrink-0" />
                    <span className="font-medium">
                      {addonName}{" "}
                      {addon === "second_shooter" &&
                      proposal.second_shooter_hours
                        ? `(${proposal.second_shooter_hours} hrs - ${proposal.second_shooter_type === "video" ? "Videographer" : "Photographer"})`
                        : addon === "second_shooter_new"
                          ? `(${proposal.second_shooter_type === "video" ? "Videographer" : "Photographer"})`
                          : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {proposal.custom_prices?.items &&
          proposal.custom_prices.items.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-sans uppercase tracking-widest text-muted-foreground">
                Custom Additions
              </h3>
              <ul className="grid gap-4 sm:grid-cols-2">
                {proposal.custom_prices.items.map((item: any) => (
                  <li
                    key={item.id}
                    className="flex items-start bg-muted/30 p-4 rounded-sm"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary mr-3 shrink-0" />
                    <div>
                      <span className="font-medium block">
                        {item.name}{" "}
                        <span className="text-muted-foreground ml-1">
                          (${item.price.toLocaleString()})
                        </span>
                      </span>
                      {item.description && (
                        <span className="text-sm text-muted-foreground mt-1 block">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {proposal.custom_prices?.discount > 0 && (
          <div className="flex justify-between items-center bg-green-50/50 dark:bg-green-950/20 p-4 rounded-sm text-green-700 dark:text-green-400">
            <span className="font-medium">Special Discount Applied</span>
            <span>
              -
              {proposal.custom_prices.discountType === "percentage"
                ? `${proposal.custom_prices.discount}%`
                : `$${proposal.custom_prices.discount}`}
            </span>
          </div>
        )}

        <div className="bg-primary/5 p-8 rounded-sm border border-primary/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-lg text-muted-foreground">Total Investment</h3>
            <p className="text-sm font-sans text-muted-foreground mt-1">
              Includes all taxes and fees
            </p>
          </div>
          <div className="text-4xl font-serif font-bold text-primary">
            ${proposal.total_amount.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-8">
        <Button
          onClick={onContinue}
          size="lg"
          className="w-full sm:w-auto font-sans tracking-wide"
        >
          Continue to Payment Options <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
