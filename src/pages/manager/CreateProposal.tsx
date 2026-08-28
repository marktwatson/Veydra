import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Loader2,
  Copy,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Save,
} from "lucide-react";

// Fallbacks used while DB data loads or if DB is unreachable
const FALLBACK_PACKAGES = [
  {
    id: "pearl",
    name: "Pearl",
    desc: "4 hours",
    priceBoth: 1950,
    priceSingle: 1150,
    isArchived: true,
  },
  {
    id: "emerald",
    name: "Emerald",
    desc: "6 hours",
    priceBoth: 2550,
    priceSingle: 1450,
    isArchived: true,
  },
  {
    id: "diamond",
    name: "Diamond Special",
    desc: "8 hours",
    priceBoth: 3150,
    priceSingle: 1750,
    isArchived: true,
  },
  {
    id: "platinum",
    name: "Platinum",
    desc: "10 hours",
    priceBoth: 3750,
    priceSingle: 2050,
    isArchived: true,
  },
  {
    id: "all_in_bride",
    name: "All-In Bride",
    desc: "10 hours",
    priceBoth: 1950,
    priceSingle: 1150,
  },
];

const FALLBACK_ADDONS = [
  {
    id: "audio",
    name: "Audio of Vows & Speeches",
    price: 125,
    isArchived: true,
  },
  { id: "drone", name: "Aerial Drone Footage", price: 250, isArchived: true },
  {
    id: "second_shooter",
    name: "2nd Shooter",
    price: 200,
    isHourly: true,
    minHours: 3,
    isArchived: true,
  },
  { id: "raw", name: "4K RAW Footage Delivery", price: 200, isArchived: true },
  {
    id: "highlight_30",
    name: "30-Min Highlight Video",
    price: 350,
    isArchived: true,
  },
  {
    id: "highlight_60",
    name: "60-Min Highlight Video",
    price: 500,
    isArchived: true,
  },
  {
    id: "extra_session",
    name: "Extra Session (Engagement/Bridals)",
    price: 450,
    isArchived: true,
  },
  { id: "drone_new", name: "Aerial Drone Footage", price: 300 },
  {
    id: "second_shooter_new",
    name: "2nd Shooter (up to 10 hours)",
    price: 750,
  },
];

export default function CreateProposal() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const upgradeWeddingId = searchParams.get("upgrade");
  const [loading, setLoading] = useState(false);
  const [PACKAGES, setPackages] = useState<any[]>(FALLBACK_PACKAGES);
  const [ADDONS, setAddons] = useState<any[]>(FALLBACK_ADDONS);

  useEffect(() => {
    Promise.all([api.getPackages(true), api.getAddons(true)])
      .then(([pkgs, adns]) => {
        if (pkgs.length) setPackages(pkgs);
        if (adns.length) setAddons(adns);
      })
      .catch(() => {});
  }, []);
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
  const [newCustomItem, setNewCustomItem] = useState({
    name: "",
    price: 0,
    description: "",
  });
  const [amountPaidSoFar, setAmountPaidSoFar] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proposalLink, setProposalLink] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      loadProposal();
    } else if (upgradeWeddingId) {
      loadWeddingForUpgrade();
    }
  }, [id, upgradeWeddingId]);

  const loadWeddingForUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("weddings")
        .select("*")
        .eq("id", upgradeWeddingId)
        .single();

      if (error) throw error;

      const locParts = data.location ? data.location.split(", ") : ["", ""];
      const qData =
        data.questionnaire_data?.contact_info || data.questionnaire_data || {};

      setFormData((prev) => ({
        ...prev,
        clientName: data.client_name || "",
        clientEmail: qData.email || "",
        clientPhone: qData.phone_bride || qData.phone || "",
        partnerName: data.partner_name || "",
        weddingDate: data.date ? data.date.split("T")[0] : "",
        isLgbtq: data.is_lgbtq || false,
        city: locParts[0] || "",
        state: locParts[1] || "",
        venue: data.notes || "",
      }));

      setAmountPaidSoFar(data.paid_amount || 0);
      toast({
        title: "Upgrade Mode",
        description: `Loaded details for ${data.client_name}. Amount paid so far: $${data.paid_amount || 0}`,
      });
    } catch (err: any) {
      console.error("Error loading wedding for upgrade:", err);
      toast({
        title: "Error",
        description: "Failed to load wedding details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProposal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const rawPlan = data.custom_payment_plan;
      const parsedPlan =
        typeof rawPlan === "string" ? JSON.parse(rawPlan) : rawPlan;

      setFormData({
        clientName: data.client_name || "",
        clientEmail: data.client_email || "",
        clientPhone: data.client_phone || "",
        partnerName: data.partner_name || "",
        weddingDate: data.wedding_date ? data.wedding_date.split("T")[0] : "",
        isLgbtq: data.is_lgbtq || false,
        venue: data.venue || "",
        venueAddress: data.venue_address || "",
        city: data.city || "",
        state: data.state || "",
        coverageType: data.coverage_type || "both",
        packageId: data.package_id || "",
        addons: data.addons || [],
        secondShooterHours: data.second_shooter_hours || 3,
        secondShooterType: data.second_shooter_type || "photo",
        notes: data.notes || "",
        customDiscount: data.custom_prices?.discount || 0,
        customDiscountType: data.custom_prices?.discountType || "fixed",
        customPaymentPlan: parsedPlan
          ? {
              enabled:
                parsedPlan.enabled === true ||
                parsedPlan.enabled === "true" ||
                parsedPlan.enabled === 1,
              deposit: Number(parsedPlan.deposit) || 0,
              installments: Array.isArray(parsedPlan.installments)
                ? parsedPlan.installments
                : [],
            }
          : { enabled: false, deposit: 0, installments: [] },
      });

      if (data.custom_prices?.items) {
        setCustomItems(data.custom_prices.items);
      }
    } catch (err: any) {
      console.error("Error loading proposal:", err);
      toast({
        title: "Error",
        description: "Failed to load proposal details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAddon = (id: string) => {
    setFormData((prev) => {
      if (prev.addons.includes(id)) {
        return { ...prev, addons: prev.addons.filter((a) => a !== id) };
      }
      return { ...prev, addons: [...prev.addons, id] };
    });
  };

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

  const handleAddCustomItem = () => {
    if (!newCustomItem.name) return;
    setCustomItems([
      ...customItems,
      { ...newCustomItem, id: crypto.randomUUID() },
    ]);
    setNewCustomItem({ name: "", price: 0, description: "" });
  };

  const removeCustomItem = (id: string) => {
    setCustomItems(customItems.filter((item) => item.id !== id));
  };

  const handleCreateProposal = async () => {
    if (
      !formData.clientName ||
      !formData.clientEmail ||
      !formData.clientPhone ||
      !formData.weddingDate ||
      !formData.city ||
      !formData.state ||
      (!formData.packageId && customItems.length === 0)
    ) {
      toast({
        title: "Missing Fields",
        description:
          "Please fill out all required fields (name, email, phone, wedding date, city, state) and select a package or add custom items.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Snapshot the current wedding contract template from portal_settings at time of creation so existing proposals/contracts never change retroactively
      let snapshotTemplate: string | null = null;
      try {
        const { data: settingsData } = await supabase
          .from("portal_settings")
          .select("wedding_contract_template")
          .single();
        if (settingsData && (settingsData as any).wedding_contract_template) {
          snapshotTemplate = (settingsData as any).wedding_contract_template;
        }
      } catch (e) {
        console.warn("Could not fetch wedding_contract_template snapshot:", e);
      }

      const payload = {
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
        package_id: formData.packageId,
        addons: formData.addons,
        second_shooter_hours: formData.secondShooterHours,
        second_shooter_type: formData.secondShooterType,
        total_amount: totalPrice,
        notes: formData.notes,
        custom_prices: {
          discount: formData.customDiscount,
          discountType: formData.customDiscountType,
          items: customItems,
        },
        custom_payment_plan: formData.customPaymentPlan.enabled
          ? {
              enabled: true,
              deposit: formData.customPaymentPlan.deposit,
              installments: formData.customPaymentPlan.installments,
            }
          : { enabled: false, deposit: 0, installments: [] },
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        is_upgrade: !!upgradeWeddingId,
        original_wedding_id: upgradeWeddingId || null,
        amount_paid_so_far: amountPaidSoFar,
        ...(snapshotTemplate
          ? { custom_contract_snapshot: snapshotTemplate }
          : {}),
      };

      if (id) {
        const { data: updateData, error } = await supabase
          .from("proposals")
          .update(payload)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          console.error("Supabase update error:", JSON.stringify(error));
          throw new Error(error.message || JSON.stringify(error));
        }
        if (!updateData) {
          throw new Error(
            "Update returned no data — the row may be blocked by a database policy. Please run the SQL policy fix in Supabase.",
          );
        }
        toast({
          title: "Proposal Updated",
          description: "The proposal has been successfully updated.",
        });
        api.logAdminActivity(
          "Proposal Updated",
          `Updated proposal for ${formData.clientName} ($${totalPrice})`,
        );
        navigate("/manager/proposals");
      } else {
        const { data, error } = await supabase
          .from("proposals")
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        const link = `${window.location.origin}/proposal/${data.id}`;
        setProposalLink(link);
        toast({
          title: "Proposal Created",
          description: "The proposal has been successfully generated.",
        });
        api.logAdminActivity(
          "Proposal Created",
          `Generated new proposal for ${formData.clientName} ($${totalPrice})`,
        );
      }
    } catch (err: any) {
      console.error("Error creating proposal:", err);
      api.logAdminActivity(
        "Proposal Error",
        `Failed to create/update proposal for ${formData.clientName}: ${err.message}`,
      );
      toast({
        title: "Error",
        description: err.message || "Failed to create proposal.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = () => {
    const fallbackCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = proposalLink;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Proposal link copied to clipboard.",
      });
    };
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(proposalLink)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({
              title: "Copied!",
              description: "Proposal link copied to clipboard.",
            });
          })
          .catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
  };

  if (proposalLink) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-serif">
                Proposal Generated
              </CardTitle>
              <CardDescription>
                Share this unique link with {formData.clientName} to review and
                sign their contract.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center space-x-2">
                <Input
                  value={proposalLink}
                  readOnly
                  className="bg-white/50 dark:bg-stone-900/50"
                />
                <Button onClick={copyLink} variant="secondary">
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => window.open(proposalLink, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Preview Proposal
                </Button>
                <Button onClick={() => setProposalLink("")}>
                  Create Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-foreground">
              {id ? "Edit Proposal" : "Create Proposal"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {id
                ? "Update the custom package and save changes"
                : "Build a custom package and generate a booking link"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
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
                      onChange={(e) => updateForm("clientName", e.target.value)}
                      placeholder="Jane Doe"
                    />
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
                    onChange={(e) => updateForm("weddingDate", e.target.value)}
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
                <div className="space-y-2">
                  <Label>Venue Address</Label>
                  <Input
                    value={formData.venueAddress}
                    onChange={(e) => updateForm("venueAddress", e.target.value)}
                    placeholder="123 Wedding Lane"
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
                    id="isLgbtqProposal"
                    checked={formData.isLgbtq}
                    onCheckedChange={(checked) =>
                      updateForm("isLgbtq", checked)
                    }
                  />
                  <Label
                    htmlFor="isLgbtqProposal"
                    className="font-normal cursor-pointer text-muted-foreground"
                  >
                    LGBTQ+ Wedding
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Package Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Coverage Type *</Label>
                  <Select
                    value={formData.coverageType}
                    onValueChange={(v) => updateForm("coverageType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select coverage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Photo & Video</SelectItem>
                      <SelectItem value="photo">Photo Only</SelectItem>
                      <SelectItem value="video">Video Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Package (Optional if adding custom items)</Label>
                  <Select
                    value={formData.packageId || "none"}
                    onValueChange={(v) =>
                      updateForm("packageId", v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a package" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Base Package</SelectItem>
                      {PACKAGES.filter(
                        (p) => !p.isArchived || p.id === formData.packageId,
                      ).map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.name} ({pkg.desc}) - $
                          {formData.coverageType === "both"
                            ? pkg.priceBoth
                            : pkg.priceSingle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base">Add-ons</Label>
                  <div className="grid gap-3">
                    {ADDONS.filter(
                      (a) => !a.isArchived || formData.addons.includes(a.id),
                    ).map((addon) => (
                      <div
                        key={addon.id}
                        className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-stone-50/50 dark:hover:bg-stone-900/50 transition-colors"
                      >
                        <Checkbox
                          id={`addon-${addon.id}`}
                          checked={formData.addons.includes(addon.id)}
                          onCheckedChange={() => toggleAddon(addon.id)}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`addon-${addon.id}`}
                            className="font-medium cursor-pointer"
                          >
                            {addon.name}{" "}
                            {addon.isHourly && (
                              <span className="text-muted-foreground font-normal text-xs ml-1">
                                (${addon.price}/hr, {addon.minHours}-hr min)
                              </span>
                            )}
                          </Label>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          +$
                          {addon.isHourly
                            ? addon.price * formData.secondShooterHours
                            : addon.price}
                        </div>
                      </div>
                    ))}
                  </div>

                  {(formData.addons.includes("second_shooter") ||
                    formData.addons.includes("second_shooter_new")) && (
                    <div className="p-4 bg-muted/30 rounded-lg space-y-4 mt-2">
                      {formData.addons.includes("second_shooter") && (
                        <div className="flex items-center justify-between">
                          <Label>Second Shooter Hours</Label>
                          <div className="flex items-center gap-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateForm(
                                  "secondShooterHours",
                                  Math.max(3, formData.secondShooterHours - 1),
                                )
                              }
                            >
                              -
                            </Button>
                            <span className="w-4 text-center font-medium">
                              {formData.secondShooterHours}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateForm(
                                  "secondShooterHours",
                                  formData.secondShooterHours + 1,
                                )
                              }
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Second Shooter Role</Label>
                        <Select
                          value={formData.secondShooterType}
                          onValueChange={(v) =>
                            updateForm("secondShooterType", v)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="photo">Photographer</SelectItem>
                            <SelectItem value="video">Videographer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Line Items</CardTitle>
                <CardDescription>
                  Add custom products, deals, or unique services to this
                  proposal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  {customItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium">
                          ${item.price.toLocaleString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomItem(item.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="space-y-4 p-4 border rounded-lg bg-muted/10">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Item Name</Label>
                        <Input
                          value={newCustomItem.name}
                          onChange={(e) =>
                            setNewCustomItem((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="e.g. Travel Fee, Custom Deal"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Price ($)</Label>
                        <Input
                          type="number"
                          value={newCustomItem.price || ""}
                          onChange={(e) =>
                            setNewCustomItem((prev) => ({
                              ...prev,
                              price: parseFloat(e.target.value) || 0,
                            }))
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description (Optional)</Label>
                      <Input
                        value={newCustomItem.description}
                        onChange={(e) =>
                          setNewCustomItem((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Brief details about this item..."
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddCustomItem}
                      className="w-full"
                      disabled={!newCustomItem.name}
                    >
                      Add Custom Item
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Payment Plan</CardTitle>
                <CardDescription>
                  Offer a specialized payment schedule in addition to the
                  standard options.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enable-custom-plan"
                    checked={formData.customPaymentPlan.enabled}
                    onCheckedChange={(c) =>
                      updateForm("customPaymentPlan", {
                        ...formData.customPaymentPlan,
                        enabled: !!c,
                      })
                    }
                  />
                  <Label htmlFor="enable-custom-plan">
                    Enable Custom Payment Plan
                  </Label>
                </div>

                {formData.customPaymentPlan.enabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/10">
                    <div className="space-y-2">
                      <Label>Deposit Amount ($)</Label>
                      <Input
                        type="number"
                        value={formData.customPaymentPlan.deposit || ""}
                        onChange={(e) =>
                          updateForm("customPaymentPlan", {
                            ...formData.customPaymentPlan,
                            deposit: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="e.g. 500"
                      />
                    </div>

                    <div className="space-y-4">
                      <Label>Future Installments</Label>
                      {formData.customPaymentPlan.installments.map(
                        (inst, idx) => (
                          <div key={idx} className="flex items-center gap-4">
                            <div className="flex-1 space-y-1">
                              <Input
                                type="date"
                                value={inst.date}
                                onChange={(e) => {
                                  const newInst = [
                                    ...formData.customPaymentPlan.installments,
                                  ];
                                  newInst[idx].date = e.target.value;
                                  updateForm("customPaymentPlan", {
                                    ...formData.customPaymentPlan,
                                    installments: newInst,
                                  });
                                }}
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <Input
                                type="number"
                                value={inst.amount || ""}
                                onChange={(e) => {
                                  const newInst = [
                                    ...formData.customPaymentPlan.installments,
                                  ];
                                  newInst[idx].amount =
                                    parseFloat(e.target.value) || 0;
                                  updateForm("customPaymentPlan", {
                                    ...formData.customPaymentPlan,
                                    installments: newInst,
                                  });
                                }}
                                placeholder="Amount ($)"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                const newInst =
                                  formData.customPaymentPlan.installments.filter(
                                    (_, i) => i !== idx,
                                  );
                                updateForm("customPaymentPlan", {
                                  ...formData.customPaymentPlan,
                                  installments: newInst,
                                });
                              }}
                            >
                              &times;
                            </Button>
                          </div>
                        ),
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          updateForm("customPaymentPlan", {
                            ...formData.customPaymentPlan,
                            installments: [
                              ...formData.customPaymentPlan.installments,
                              { date: "", amount: 0 },
                            ],
                          });
                        }}
                      >
                        Add Installment
                      </Button>
                    </div>

                    {(() => {
                      const planTotal =
                        (formData.customPaymentPlan.deposit || 0) +
                        formData.customPaymentPlan.installments.reduce(
                          (sum, i) => sum + (i.amount || 0),
                          0,
                        );
                      const remaining = totalPrice - planTotal;
                      const isBalanced = Math.abs(remaining) < 0.01;
                      return (
                        <div className="pt-4 border-t space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              Proposal Total
                            </span>
                            <span className="font-medium">
                              ${totalPrice.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              Deposit
                            </span>
                            <span className="font-medium">
                              $
                              {(
                                formData.customPaymentPlan.deposit || 0
                              ).toLocaleString()}
                            </span>
                          </div>
                          {formData.customPaymentPlan.installments.map(
                            (inst, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center text-sm"
                              >
                                <span className="text-muted-foreground">
                                  Installment {idx + 1}
                                  {inst.date
                                    ? ` (${new Date(inst.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`
                                    : ""}
                                </span>
                                <span className="font-medium">
                                  ${(inst.amount || 0).toLocaleString()}
                                </span>
                              </div>
                            ),
                          )}
                          <div
                            className={`flex justify-between items-center pt-3 border-t font-semibold text-sm ${isBalanced ? "text-emerald-600 dark:text-emerald-400" : remaining > 0 ? "text-destructive" : "text-orange-600 dark:text-orange-400"}`}
                          >
                            <span>
                              {isBalanced
                                ? "Fully Covered ✓"
                                : remaining > 0
                                  ? "Remaining to Assign"
                                  : "Over by"}
                            </span>
                            <span>
                              {isBalanced
                                ? "All $" +
                                  totalPrice.toLocaleString() +
                                  " covered"
                                : `$${Math.abs(remaining).toLocaleString()}`}
                            </span>
                          </div>
                          {!isBalanced && (
                            <p className="text-xs text-muted-foreground">
                              {remaining > 0
                                ? `Add $${remaining.toLocaleString()} more in installments to cover the full amount.`
                                : `Plan exceeds the total by $${Math.abs(remaining).toLocaleString()}.`}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

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
            <Card className="sticky top-8">
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
                  <div key={addon.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{addon.name}</span>
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
                      <Select
                        value={formData.customDiscountType}
                        onValueChange={(v: any) =>
                          updateForm("customDiscountType", v)
                        }
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">$ Fixed</SelectItem>
                          <SelectItem value="percentage">% Percent</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-xl font-bold font-serif">
                      ${totalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t p-6">
                <Button
                  onClick={handleCreateProposal}
                  className="w-full"
                  size="lg"
                  disabled={
                    isSubmitting ||
                    !formData.clientName ||
                    !formData.weddingDate ||
                    (!formData.packageId && customItems.length === 0)
                  }
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : id ? (
                    <Save className="w-4 h-4 mr-2" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2" />
                  )}
                  {isSubmitting
                    ? id
                      ? "Saving..."
                      : "Generating..."
                    : id
                      ? "Save Changes"
                      : "Generate Proposal Link"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
