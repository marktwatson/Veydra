import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOGO_URL } from "@/lib/utils";
import { api, sendOvantaEmail, sendOvantaSms } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function Apply() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState("");

  const { data: portalSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
  });

  const regions = portalSettings?.regions || ["Charlotte", "Raleigh"];
  const companyName = portalSettings?.company_name || "Veydra";
  const logoUrl = portalSettings?.logo_url;

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region],
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedRegions.length === 0) {
      toast({
        variant: "destructive",
        title: "Required",
        description: "Please select at least one region.",
      });
      return;
    }
    if (!specialty) {
      toast({
        variant: "destructive",
        title: "Required",
        description: "Please select your specialty.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      const email = (formData.get("email") as string).trim().toLowerCase();
      const phone = formData.get("phone") as string;
      const portfolioUrl = formData.get("portfolioUrl") as string;
      const gearList = formData.get("gearList") as string;
      const password = formData.get("password") as string;
      const leadWeddingsStr = formData.get("leadWeddings") as string;
      const leadWeddings = parseInt(leadWeddingsStr, 10) || 0;
      const isRejected = leadWeddings < 3;

      // Check if email already exists
      const { data: existingContractor } = await supabase
        .from("contractors")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      const { data: existingEditor } = await supabase
        .from("editors")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      const { data: existingManager } = await supabase
        .from("managers")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (existingContractor || existingEditor || existingManager) {
        throw new Error(
          "An account with this email already exists in our system.",
        );
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: `${firstName} ${lastName}`,
            role: "contractor",
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const newContractor = {
        id: authData.user?.id || crypto.randomUUID(),
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        status: isRejected ? "rejected" : "applied",
        specialty,
        region: selectedRegions,
        drone_approved: false,
        training_completed: false,
        portfolio_url: portfolioUrl,
        gear_list: `Lead Weddings Shot: ${leadWeddings}\n\nGear:\n${gearList}`,
      };

      await api.addContractor(newContractor);

      // Send to CRM tracking
      const trackingPayload = {
        type: "external_form_submission",
        timestamp: Date.now(),
        formId: "Contractor Application",
        formData: {
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          website: portfolioUrl,
          "contact.specialty": specialty,
          "contact.regions": selectedRegions.join(", "),
        },
        formLabels: {
          first_name: "First Name",
          last_name: "Last Name",
          email: "Email",
          phone: "Phone",
          website: "Portfolio URL",
          "contact.specialty": "Specialty",
          "contact.regions": "Regions",
        },
        url: window.location.href,
        title: document.title,
        path: window.location.pathname,
        userAgent: navigator.userAgent,
        trackingId: portalSettings?.hl_location_id
          ? "tk_02f0b02f7766475e8e0dd257bf546895"
          : undefined, // Will be replaced by actual tracking ID if provided
        locationId: portalSettings?.hl_location_id,
        sessionId: crypto.randomUUID(),
        properties: {
          deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent)
            ? "mobile"
            : "desktop",
        },
      };

      if (portalSettings?.hl_location_id) {
        fetch("https://backend.leadconnectorhq.com/external-tracking/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            version: "2021-07-28",
          },
          body: JSON.stringify(trackingPayload),
        }).catch(() => {});
      }

      if (portalSettings?.hl_api_key && portalSettings?.hl_location_id) {
        try {
          await api.syncContractorCRM(newContractor.id);
        } catch (e) {
          console.error("Failed to sync new applicant to CRM natively:", e);
        }
      }

      // Send Applicant Welcome or Rejected Email / SMS
      try {
        const appUrl = (
          portalSettings?.app_url || window.location.origin
        ).replace(/\/$/, "");

        if (isRejected) {
          if (
            portalSettings?.email_pipeline_rejected_enabled &&
            portalSettings?.email_pipeline_rejected_template
          ) {
            const subject = (
              portalSettings.email_pipeline_rejected_subject ||
              "Application Update"
            )
              .replace(/{{company_name}}/g, companyName)
              .replace(/{{contractor_name}}/g, firstName);

            const content = portalSettings.email_pipeline_rejected_template
              .replace(/{{company_name}}/g, companyName)
              .replace(/{{logo_url}}/g, logoUrl || DEFAULT_LOGO_URL)
              .replace(/{{contractor_name}}/g, firstName)
              .replace(/{{portal_link}}/g, appUrl);

            await sendOvantaEmail(email, subject, content);
          }
          if (
            portalSettings?.sms_pipeline_rejected_enabled &&
            portalSettings?.sms_pipeline_rejected_template
          ) {
            const message = portalSettings.sms_pipeline_rejected_template
              .replace(/{{company_name}}/g, companyName)
              .replace(/{{contractor_name}}/g, firstName)
              .replace(/{{portal_link}}/g, appUrl);

            await sendOvantaSms(email, message);
          }
        } else {
          if (
            portalSettings?.email_applicant_welcome_enabled &&
            portalSettings?.email_applicant_welcome_template
          ) {
            const subject = (
              portalSettings.email_applicant_welcome_subject ||
              "Application Received!"
            )
              .replace(/{{company_name}}/g, companyName)
              .replace(/{{contractor_name}}/g, firstName);

            const content = portalSettings.email_applicant_welcome_template
              .replace(/{{company_name}}/g, companyName)
              .replace(/{{logo_url}}/g, logoUrl || DEFAULT_LOGO_URL)
              .replace(/{{contractor_name}}/g, firstName)
              .replace(/{{portal_link}}/g, appUrl);

            await sendOvantaEmail(email, subject, content);
          }

          if (
            portalSettings?.sms_applicant_welcome_enabled &&
            portalSettings?.sms_applicant_welcome_template
          ) {
            const message = portalSettings.sms_applicant_welcome_template
              .replace(/{{company_name}}/g, companyName)
              .replace(/{{contractor_name}}/g, firstName)
              .replace(/{{portal_link}}/g, appUrl);

            await sendOvantaSms(email, message);
          }
        }
      } catch (e) {
        console.error("Failed to send welcome/rejected email:", e);
      }

      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Application Failed",
        description: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className="h-16 mx-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_LOGO_URL;
              }}
            />
          ) : (
            <div className="h-16 w-16 bg-primary text-primary-foreground rounded-xl flex items-center justify-center mx-auto text-2xl font-bold shadow-sm">
              {companyName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Join Our Team
            </h1>
            <p className="text-muted-foreground mt-2">
              Apply to become a contractor for {companyName}
            </p>
          </div>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="border-b bg-muted/10 pb-6">
            <CardTitle className="text-xl">Contractor Application</CardTitle>
            <CardDescription>
              Tell us a bit about yourself and your experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="Jane"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="jane@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Create Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  minLength={6}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  You will use this to log in and track your application status.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="portfolioUrl">
                  Portfolio URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="portfolioUrl"
                  name="portfolioUrl"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  required
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (
                      val &&
                      !val.startsWith("http://") &&
                      !val.startsWith("https://")
                    ) {
                      e.target.value = `https://${val}`;
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Please provide a link to your best wedding work.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Label>
                  Primary Specialty <span className="text-destructive">*</span>
                </Label>
                <Select value={specialty} onValueChange={setSpecialty} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your primary role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Photographer">Photographer</SelectItem>
                    <SelectItem value="Videographer">Videographer</SelectItem>
                    <SelectItem value="Photographer & Videographer">
                      Both (Photo & Video)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-2">
                <Label>
                  Regions You Cover <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border rounded-xl bg-muted/10">
                  {regions.map((r: string) => (
                    <div key={r} className="flex items-center space-x-2">
                      <Checkbox
                        id={`region-${r}`}
                        checked={selectedRegions.includes(r)}
                        onCheckedChange={() => toggleRegion(r)}
                      />
                      <Label
                        htmlFor={`region-${r}`}
                        className="font-normal cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {r}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="leadWeddings">
                  How many weddings have you shot as a lead?{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="leadWeddings"
                  name="leadWeddings"
                  type="number"
                  min="0"
                  placeholder="e.g., 5"
                  required
                />
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="gearList">
                  Gear List <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="gearList"
                  name="gearList"
                  placeholder="Please list your camera bodies, lenses, audio equipment, lighting, and any drones you use..."
                  className="min-h-[120px]"
                  required
                />
              </div>

              <div className="pt-4 border-t">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting Application...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-primary hover:underline font-medium"
          >
            Log in here
          </Link>
        </div>
      </div>

      <Dialog
        open={isSuccess}
        onOpenChange={(open) => {
          if (!open) navigate("/login");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="flex flex-col items-center sm:text-center">
            <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
            </div>
            <DialogTitle className="text-2xl text-center">
              Application Received!
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              We got your application and will be emailing and calling you
              shortly. If you prefer text, you can reply back to us saying that.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pt-4">
            <Button onClick={() => navigate("/login")} className="w-full">
              Return to Login <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
