import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "react-router-dom";
import { Loader2, ChevronRight, List } from "lucide-react";
import { checkCustomPlanBalance } from "@/lib/custom-plan-balance";
import ProposalShareModal from "@/components/ProposalShareModal";
import {
  loadPublicBuilderTerritory,
  loadPublicBuilderPackages,
} from "@/lib/public-builder-territory";
import { publicCreateProposal } from "@/lib/public-create-proposal-api";
import { sendProposalToClient } from "@/lib/send-proposal-api";
import { DEFAULT_LOGO_URL } from "@/lib/utils";
import {
  FALLBACK_PACKAGES_SLIM as FALLBACK_PACKAGES,
  FALLBACK_ADDONS_SLIM as FALLBACK_ADDONS,
} from "@/lib/booking-fallbacks";
import { PackageSelectionCard } from "@/components/build-proposal/PackageSelectionCard";
import { CustomLineItemsCard } from "@/components/build-proposal/CustomLineItemsCard";
import { CustomPaymentPlanCard } from "@/components/build-proposal/CustomPaymentPlanCard";
import { PublicBuilderMyProposals } from "@/components/build-proposal/PublicBuilderMyProposals";
import { PublicBuilderGateModal } from "@/components/build-proposal/PublicBuilderGateModal";
import { PublicBuilderYourDetailsCard } from "@/components/build-proposal/PublicBuilderYourDetailsCard";

export default function BuildProposal() {
  const { slug } = useParams<{ slug?: string }>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"build" | "mine">("build");

  const { data: territory, isLoading: isLoadingTerritory } = useQuery({
    queryKey: ["public-builder-territory", slug ?? ""],
    queryFn: () => loadPublicBuilderTerritory(slug),
  });

  const [PACKAGES, setPackages] = useState<any[]>(FALLBACK_PACKAGES);
  const [ADDONS, setAddons] = useState<any[]>(FALLBACK_ADDONS);
  const [loadingPackages, setLoadingPackages] = useState(false);

  useEffect(() => {
    if (!territory?.found || !territory.id) return;
    let active = true;
    setLoadingPackages(true);
    loadPublicBuilderPackages(territory.id)
      .then(({ packages, addons }) => {
        if (!active) return;
        setPackages(packages);
        setAddons(addons);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingPackages(false);
      });
    return () => {
      active = false;
    };
  }, [territory?.id, territory?.found]);

  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    partnerName: "",
    weddingDate: "",
    venue: "",
    venueAddress: "",
    city: "",
    state: "",
    coverageType: "both",
    packageId: "",
    addons: [] as string[],
    secondShooterHours: 3,
    secondShooterType: "photo",
    isLgbtq: false,
    notes: "",
    customDiscount: 0,
    customDiscountType: "fixed" as "fixed" | "percentage",
    customPaymentPlan: {
      enabled: false,
      deposit: 0,
      installments: [] as { date: string; amount: number }[],
    },
  });

  const [customItems, setCustomItems] = useState<
    { id: string; name: string; price: number; description: string }[]
  >([]);
  const [salespersonName, setSalespersonName] = useState("");
  const [salespersonEmail, setSalespersonEmail] = useState("");
  const [salesPin, setSalesPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proposalLink, setProposalLink] = useState("");
  const [savedProposalId, setSavedProposalId] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const updateForm = (key: string, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const toggleAddon = (id: string) =>
    setFormData((prev) =>
      prev.addons.includes(id)
        ? { ...prev, addons: prev.addons.filter((a) => a !== id) }
        : { ...prev, addons: [...prev.addons, id] },
    );

  const selectedPackage = PACKAGES.find((p) => p.id === formData.packageId);
  const selectedAddons = ADDONS.filter((a) => formData.addons.includes(a.id));
  const packagePrice = selectedPackage
    ? formData.coverageType === "photo"
      ? selectedPackage.priceSingle
      : formData.coverageType === "video"
        ? selectedPackage.priceSingle
        : selectedPackage.priceBoth
    : 0;

  const baseTotalPrice =
    packagePrice +
    selectedAddons.reduce((sum, a) => {
      if (a.id === "second_shooter")
        return sum + a.price * formData.secondShooterHours;
      return sum + a.price;
    }, 0) +
    customItems.reduce((sum, item) => sum + item.price, 0);

  const discountAmount =
    formData.customDiscountType === "percentage"
      ? baseTotalPrice * (formData.customDiscount / 100)
      : formData.customDiscount;
  const totalPrice = Math.max(0, baseTotalPrice - discountAmount);

  const planBalance = checkCustomPlanBalance(
    formData.customPaymentPlan.enabled ? formData.customPaymentPlan : null,
    totalPrice,
  );
  const customPlanBlocked =
    formData.customPaymentPlan.enabled && !planBalance.balanced;

  const hasFullClientName =
    formData.clientName.trim().split(/\s+/).filter(Boolean).length >= 2;
  const missingFields =
    !hasFullClientName ||
    !formData.clientEmail ||
    !formData.clientPhone ||
    !formData.weddingDate ||
    !formData.city ||
    !formData.state ||
    (!formData.packageId && customItems.length === 0);

  const disabled = isSubmitting || missingFields || customPlanBlocked;

  const handleGenerate = async () => {
    if (disabled) return;
    if (!territory?.found || !territory.id) return;
    setIsSubmitting(true);
    try {
      const result = await publicCreateProposal({
        slug: (slug ?? "").toLowerCase(),
        salespersonName,
        salespersonEmail,
        pin: salesPin || undefined,
        proposal: {
          client_name: formData.clientName,
          client_email: formData.clientEmail,
          client_phone: formData.clientPhone,
          partner_name: formData.partnerName,
          wedding_date: formData.weddingDate,
          is_lgbtq: formData.isLgbtq,
          venue: formData.venue,
          venue_address: formData.venueAddress,
          city: formData.city,
          state: formData.state,
          coverage_type: formData.coverageType,
          package_id: formData.packageId || null,
          addons: formData.addons,
          second_shooter_hours: formData.secondShooterHours,
          second_shooter_type: formData.secondShooterType,
          total_amount: totalPrice,
          notes: formData.notes,
          custom_discount: formData.customDiscount,
          custom_discount_type: formData.customDiscountType,
          custom_items: customItems,
          custom_payment_plan: formData.customPaymentPlan,
        },
      });
      setProposalLink(result.link);
      setSavedProposalId(result.proposalId);
      setShareOpen(true);
      toast({
        title: "Proposal Created",
        description: "The proposal has been generated for this area.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create proposal.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!savedProposalId) return;
    if (!salespersonName.trim() || !salespersonEmail.trim()) {
      toast({
        title: "Your details required",
        description: "Enter your name and email before sending to the client.",
        variant: "destructive",
      });
      return;
    }
    // The area PIN (if any) was already verified server-side by the gate
    // modal before the builder unlocked, so no client-side check is needed
    // here. Sending uses the authenticated send-proposal function.
    setSending(true);
    try {
      const result = await sendProposalToClient(savedProposalId);
      toast({
        title: "Sent to client",
        description: `Review clock started. Expires ${new Date(result.expires_at || "").toLocaleString()}.`,
      });
    } catch (err: any) {
      toast({
        title: "Send failed",
        description: err?.message || "Failed to send proposal.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setFormData({
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      partnerName: "",
      weddingDate: "",
      venue: "",
      venueAddress: "",
      city: "",
      state: "",
      coverageType: "both",
      packageId: "",
      addons: [],
      secondShooterHours: 3,
      secondShooterType: "photo",
      isLgbtq: false,
      notes: "",
      customDiscount: 0,
      customDiscountType: "fixed",
      customPaymentPlan: { enabled: false, deposit: 0, installments: [] },
    });
    setCustomItems([]);
    setProposalLink("");
    setSavedProposalId("");
    setShareOpen(false);
    toast({ title: "Form reset", description: "Ready for the next proposal." });
  };

  if (isLoadingTerritory) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!territory?.found) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-3xl font-serif text-foreground">
            Unknown location
          </h1>
          <p className="text-muted-foreground">
            This proposal builder link isn't tied to a recognized area. Check
            the link with your manager.
          </p>
        </div>
      </div>
    );
  }

  const logoUrl = territory.settings?.logo_url || DEFAULT_LOGO_URL;
  const companyName = territory.settings?.company_name || "Proposal Builder";

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center gap-4">
          <img
            src={logoUrl}
            alt={companyName}
            className="h-12 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_LOGO_URL;
            }}
          />
          <div>
            <h1 className="text-3xl font-serif text-foreground">
              Build a Proposal
            </h1>
            <p className="text-muted-foreground mt-1">
              {companyName} — create a proposal and send it to the client.
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab("build")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "build"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Build Proposal
          </button>
          <button
            onClick={() => setActiveTab("mine")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "mine"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="w-4 h-4" />
            My Proposals
          </button>
        </div>

        {activeTab === "mine" ? (
          <PublicBuilderMyProposals
            slug={(slug ?? "").toLowerCase()}
            areaHasPin={territory.hasPin}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
              <PublicBuilderYourDetailsCard
                salespersonName={salespersonName}
                salespersonEmail={salespersonEmail}
                salesPin={salesPin}
                hasPin={territory.hasPin}
                onName={setSalespersonName}
                onEmail={setSalespersonEmail}
                onPin={setSalesPin}
              />

              {loadingPackages && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Client Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client Name *</Label>
                      <Input
                        value={formData.clientName}
                        onChange={(e) =>
                          updateForm("clientName", e.target.value)
                        }
                        placeholder="Jane Doe"
                      />
                      {!hasFullClientName && formData.clientName.trim() && (
                        <p className="text-xs text-destructive">
                          Enter a first and last name.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Partner Name</Label>
                      <Input
                        value={formData.partnerName}
                        onChange={(e) =>
                          updateForm("partnerName", e.target.value)
                        }
                        placeholder="John Smith"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={formData.clientEmail}
                        onChange={(e) =>
                          updateForm("clientEmail", e.target.value)
                        }
                        placeholder="jane@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone *</Label>
                      <Input
                        type="tel"
                        value={formData.clientPhone}
                        onChange={(e) =>
                          updateForm("clientPhone", e.target.value)
                        }
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Wedding Date *</Label>
                    <Input
                      type="date"
                      value={formData.weddingDate}
                      onChange={(e) =>
                        updateForm("weddingDate", e.target.value)
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Venue Name</Label>
                    <Input
                      value={formData.venue}
                      onChange={(e) => updateForm("venue", e.target.value)}
                      placeholder="The Grand Estate"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>City *</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => updateForm("city", e.target.value)}
                        placeholder="Charleston"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State *</Label>
                      <Input
                        value={formData.state}
                        onChange={(e) => updateForm("state", e.target.value)}
                        placeholder="SC"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isLgbtqPublic"
                      checked={formData.isLgbtq}
                      onCheckedChange={(checked) =>
                        updateForm("isLgbtq", checked)
                      }
                    />
                    <Label
                      htmlFor="isLgbtqPublic"
                      className="font-normal cursor-pointer text-muted-foreground"
                    >
                      LGBTQ+ Wedding
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <PackageSelectionCard
                packages={PACKAGES}
                addons={ADDONS}
                coverageType={formData.coverageType}
                packageId={formData.packageId}
                selectedAddons={formData.addons}
                secondShooterHours={formData.secondShooterHours}
                secondShooterType={formData.secondShooterType}
                onCoverageType={(v) => updateForm("coverageType", v)}
                onPackageId={(v) => updateForm("packageId", v)}
                onToggleAddon={toggleAddon}
                onSecondShooterHours={(v) =>
                  updateForm("secondShooterHours", v)
                }
                onSecondShooterType={(v) => updateForm("secondShooterType", v)}
              />

              <CustomLineItemsCard
                customItems={customItems}
                setCustomItems={setCustomItems}
              />

              <CustomPaymentPlanCard
                plan={formData.customPaymentPlan}
                setPlan={(p) => updateForm("customPaymentPlan", p)}
                total={totalPrice}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Internal Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Any special instructions or notes for this booking..."
                    value={formData.notes}
                    onChange={(e) => updateForm("notes", e.target.value)}
                    className="min-h-[100px]"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="lg:sticky lg:top-8 shadow-sm">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-lg">Investment Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {selectedPackage ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {selectedPackage.name} Package
                      </span>
                      <span className="font-medium">
                        ${packagePrice.toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      No package selected
                    </div>
                  )}
                  {selectedAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {addon.name}
                      </span>
                      <span className="font-medium">
                        +$
                        {(addon.isHourly
                          ? addon.price * formData.secondShooterHours
                          : addon.price
                        ).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {customItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium">
                        +${item.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="pt-4 border-t space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Custom Discount
                      </Label>
                      <div className="flex gap-2">
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={formData.customDiscountType}
                          onChange={(e) =>
                            updateForm("customDiscountType", e.target.value)
                          }
                        >
                          <option value="fixed">$ Fixed</option>
                          <option value="percentage">% Percent</option>
                        </select>
                        <Input
                          type="number"
                          min="0"
                          value={formData.customDiscount || ""}
                          onChange={(e) =>
                            updateForm(
                              "customDiscount",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="Amount"
                        />
                      </div>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-500">
                        <span>Discount Applied</span>
                        <span>-${discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-semibold text-foreground">
                        Total
                      </span>
                      <span className="text-xl font-bold font-serif">
                        ${totalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t flex flex-col gap-2 items-stretch p-6">
                  <Button
                    onClick={handleGenerate}
                    className="w-full"
                    size="lg"
                    disabled={disabled}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ChevronRight className="w-4 h-4 mr-2" />
                    )}
                    {isSubmitting ? "Generating..." : "Generate Proposal Link"}
                  </Button>
                  {savedProposalId && (
                    <Button
                      onClick={handleSend}
                      className="w-full"
                      size="lg"
                      disabled={sending}
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mr-2" />
                      )}
                      {sending ? "Sending..." : "Send to Client"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          </div>
        )}
      </div>

      <ProposalShareModal
        link={proposalLink}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        proposalId={savedProposalId}
        clientEmail={formData.clientEmail}
        clientPhone={formData.clientPhone}
        coveragePending={false}
        onSent={() => {}}
        onReset={handleReset}
      />

      <PublicBuilderGateModal
        slug={(slug ?? "").toLowerCase()}
        areaHasPin={territory.hasPin}
        companyName={companyName}
        logoUrl={logoUrl}
        onUnlock={(info) => {
          setSalespersonName(info.name);
          setSalespersonEmail(info.email);
          setSalesPin(info.pin);
        }}
      />
    </div>
  );
}
