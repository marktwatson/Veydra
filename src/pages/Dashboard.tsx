import { Link } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Star,
  Bell,
  Loader2,
  MapPin,
  Clock,
  FileText,
  DollarSign,
  AlertCircle,
  BookOpen,
  Camera,
  PlayCircle,
  CheckSquare,
  ExternalLink,
  Sparkles,
  Info,
  Check,
  User,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { addDays, parseISO, startOfDay } from "date-fns";
import {
  generateGoogleCalendarUrl,
  formatDisplayDate,
  parseRegions,
  getCompanyTimezone,
} from "@/lib/utils";

// Parse a date string as a local date (no UTC midnight shift)
const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(NaN);
  const datePart = dateStr.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, m - 1, d);
};
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ContractorInterviewSection } from "@/components/ContractorInterviewSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseUrl } from "@/lib/supabase";
import confetti from "canvas-confetti";

const ProfileOnboarding = ({ contractor }: { contractor: any }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    avatar_url: contractor?.avatar_url || "",
    bio: contractor?.bio || "",
    portfolio_url: contractor?.portfolio_url || "",
    venmo_handle: contractor?.venmo_handle || "",
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contractor?.email) return;

    try {
      setUploadingImage(true);
      const fileExt = file.name.split(".").pop();
      const safeEmail = contractor.email.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `contractor-${safeEmail}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      setFormData({ ...formData, avatar_url: publicUrl });
      toast.success("Profile image uploaded!");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleConnectStripe = async () => {
    setIsSubmitting(true);
    try {
      // Save profile first
      const { error: updateError } = await supabase
        .from("contractors")
        .update(formData)
        .eq("id", contractor.id);
      if (updateError) throw updateError;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/stripe-onboard`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            contractorId: contractor.id,
            country: "US",
          }),
        },
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to connect Stripe");

      window.location.href = data.url;
    } catch (error: any) {
      toast.error("Connection Failed: " + error.message);
      setIsSubmitting(false);
    }
  };

  const handleSave = async (skipPayment = false) => {
    if (step === 1 && !formData.avatar_url) {
      toast.error("Please upload a profile image.");
      return;
    }
    if (step === 2 && (!formData.bio || !formData.portfolio_url)) {
      toast.error("Please complete your bio and portfolio URL.");
      return;
    }

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("contractors")
        .update(formData)
        .eq("id", contractor.id);

      if (error) throw error;

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      toast.success("Profile complete! Welcome aboard.");
      queryClient.invalidateQueries({ queryKey: ["contractor"] });
      queryClient.invalidateQueries({ queryKey: ["contractor-avatar"] });
    } catch (error: any) {
      toast.error("Failed to save profile: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Complete Your Profile
        </h1>
        <p className="text-muted-foreground">
          Just a few more details before you can access your dashboard.
        </p>
      </div>

      <div className="flex justify-between items-center mb-8 px-4 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 transition-all duration-500"
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        />
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 ${s <= step ? "bg-primary border-primary text-primary-foreground" : "bg-background border-muted text-muted-foreground"}`}
          >
            {s < step ? <Check className="w-5 h-5" /> : s}
          </div>
        ))}
      </div>

      <Card className="shadow-lg border-border/50">
        <CardContent className="pt-8 pb-10 px-8">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold">Add a Profile Image</h2>
                <p className="text-muted-foreground text-sm">
                  This helps our team and clients recognize you.
                </p>
              </div>
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative group">
                  <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-muted bg-muted flex items-center justify-center">
                    {formData.avatar_url ? (
                      <img
                        src={formData.avatar_url}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-12 w-12 text-muted-foreground/50" />
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
                    <Camera className="h-8 w-8" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
                {uploadingImage && (
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Uploading...
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold">About You</h2>
                <p className="text-muted-foreground text-sm">
                  Share a bit about your experience and your portfolio.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Short Bio</Label>
                  <Textarea
                    placeholder="Tell us about your photography/videography journey..."
                    value={formData.bio}
                    onChange={(e) =>
                      setFormData({ ...formData, bio: e.target.value })
                    }
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Portfolio URL</Label>
                  <Input
                    placeholder="https://yourportfolio.com"
                    value={formData.portfolio_url}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        portfolio_url: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold">
                  Payment Info (Optional)
                </h2>
                <p className="text-muted-foreground text-sm">
                  How should we send your payouts? You can set this up later.
                </p>
              </div>
              <div className="space-y-6">
                <div className="space-y-2 border rounded-lg p-4 bg-muted/20">
                  <Label>Option 1: Venmo</Label>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">
                      @
                    </span>
                    <Input
                      placeholder="username"
                      className="pl-8 bg-background"
                      value={formData.venmo_handle.replace("@", "")}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          venmo_handle: e.target.value,
                        })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Get paid directly to your Venmo account.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4 bg-muted/20">
                  <Label>Option 2: Direct Deposit (Stripe)</Label>
                  <p className="text-xs text-muted-foreground mb-4">
                    Securely connect your bank account to receive direct
                    deposits via Stripe.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full bg-background"
                    onClick={handleConnectStripe}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <DollarSign className="mr-2 h-4 w-4" />
                    )}
                    Connect Stripe Account
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-10 pt-6 border-t items-center">
            <Button
              variant="ghost"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1 || isSubmitting}
            >
              Back
            </Button>
            <div className="flex gap-2">
              {step === 3 && (
                <Button
                  variant="outline"
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting || uploadingImage}
                >
                  Skip for now
                </Button>
              )}
              <Button
                onClick={() => handleSave(false)}
                disabled={isSubmitting || uploadingImage}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {step === 3 ? "Complete Profile" : "Continue"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const AgreementSigner = ({
  contractor,
  template,
  companyName = "the Company",
}: {
  contractor: any;
  template?: string | null;
  companyName?: string;
}) => {
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const contractorName =
    `${contractor?.first_name || ""} ${contractor?.last_name || ""}`.trim() ||
    "Contractor";
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const processedTemplate = template
    ? template
        .replace(/{{company_name}}/g, companyName)
        .replace(/{{contractor_name}}/g, contractorName)
        .replace(/{{date}}/g, today)
    : null;

  const handleSign = async () => {
    if (!signature.trim()) {
      toast.error("Please type your full name to sign.");
      return;
    }
    if (!agreed) {
      toast.error("You must agree to the terms to proceed.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("contractors")
        .update({
          contract_signature: signature.trim(),
          contract_signed_at: new Date().toISOString(),
        })
        .eq("id", contractor.id);

      if (error) throw error;

      toast.success("Agreement signed successfully!");
      if (contractor?.w9_signature) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
      queryClient.invalidateQueries({ queryKey: ["contractor"] });
    } catch (error: any) {
      toast.error("Failed to save signature: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card shadow-inner p-8 h-[500px] overflow-y-auto text-sm">
        {processedTemplate ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none contract-content"
            dangerouslySetInnerHTML={{ __html: processedTemplate }}
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h1 className="text-2xl font-bold text-center mb-8 uppercase tracking-widest border-b pb-4">
              Independent Contractor Agreement
            </h1>
            <p className="italic text-muted-foreground mb-6">
              Effective Date: {today}
            </p>
            <p>
              This Independent Contractor Agreement (the "Agreement") is entered
              into by and between <strong>{companyName}</strong> (the "Company")
              and <strong>{contractorName}</strong> (the "Contractor").
            </p>

            <h2 className="text-lg font-bold mt-6 mb-3">1. Services</h2>
            <p>
              The Contractor agrees to perform photography and/or videography
              services as assigned by the Company through the portal. The
              Contractor will provide all necessary equipment unless otherwise
              specified.
            </p>

            <h2 className="text-lg font-bold mt-6 mb-3">2. Compensation</h2>
            <p>
              The Company shall pay the Contractor the agreed-upon rate for each
              completed assignment. Payments will be processed according to the
              Company's standard payout schedule after media has been
              successfully uploaded and approved.
            </p>

            <h2 className="text-lg font-bold mt-6 mb-3">
              3. Independent Contractor Status
            </h2>
            <p>
              The Contractor is an independent contractor, not an employee. The
              Contractor is responsible for all taxes, insurance, and expenses
              related to the performance of the services.
            </p>

            <h2 className="text-lg font-bold mt-6 mb-3">
              4. Ownership of Media
            </h2>
            <p>
              All photos, videos, and other media captured during the assignment
              are the exclusive property of the Company. The Contractor agrees
              not to use, sell, or distribute the media without prior written
              consent.
            </p>

            <h2 className="text-lg font-bold mt-6 mb-3">5. Confidentiality</h2>
            <p>
              The Contractor agrees to keep confidential all information
              regarding the Company's clients, pricing, and business operations.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked as boolean)}
          />
          <Label htmlFor="terms" className="text-sm font-normal">
            I have read and agree to the terms of the Independent Contractor
            Agreement.
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signature">Digital Signature (Type Full Name)</Label>
          <Input
            id="signature"
            placeholder="e.g. John Doe"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
        </div>

        <Button
          onClick={handleSign}
          disabled={!signature.trim() || !agreed || isSubmitting}
          className="w-full sm:w-auto"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign & Submit Agreement
        </Button>
      </div>
    </div>
  );
};

const formatSSNEIN = (value: string) => {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 9) {
    if (
      value.includes("-") &&
      value.split("-")[0].length === 2 &&
      cleaned.length > 2
    ) {
      // EIN format: XX-XXXXXXX
      if (cleaned.length <= 2) return cleaned;
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    } else {
      // SSN format: XXX-XX-XXXX
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 5)
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    }
  }
  return value.slice(0, 11); // Allow backspace/formatting
};

const W9Form = ({ contractor }: { contractor: any }) => {
  const [formData, setFormData] = useState({
    w9_name: contractor?.w9_name || "",
    w9_business_name: contractor?.w9_business_name || "",
    w9_tax_classification:
      contractor?.w9_tax_classification || "Individual/sole proprietor",
    w9_address: contractor?.w9_address || "",
    w9_city_state_zip: contractor?.w9_city_state_zip || "",
    w9_ssn_ein: contractor?.w9_ssn_ein || "",
    w9_signature: contractor?.w9_signature || "",
  });
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSign = async () => {
    if (
      !formData.w9_name ||
      !formData.w9_address ||
      !formData.w9_city_state_zip ||
      !formData.w9_ssn_ein ||
      !formData.w9_signature
    ) {
      toast.error("Please fill out all required fields and sign.");
      return;
    }
    if (!agreed) {
      toast.error("You must certify the W-9 under penalties of perjury.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("contractors")
        .update({
          ...formData,
          w9_signed_at: new Date().toISOString(),
        })
        .eq("id", contractor.id);

      if (error) throw error;

      toast.success("W-9 submitted successfully!");
      if (contractor?.contract_signature) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
      queryClient.invalidateQueries({ queryKey: ["contractor"] });
    } catch (error: any) {
      toast.error("Failed to save W-9: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card shadow-inner p-6 text-sm space-y-4">
        <h2 className="text-lg font-bold border-b pb-2">
          Form W-9 Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="w9_name">
              Name (as shown on your income tax return) *
            </Label>
            <Input
              id="w9_name"
              value={formData.w9_name}
              onChange={(e) =>
                setFormData({ ...formData, w9_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w9_business_name">
              Business name/disregarded entity name (if different)
            </Label>
            <Input
              id="w9_business_name"
              value={formData.w9_business_name}
              onChange={(e) =>
                setFormData({ ...formData, w9_business_name: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Federal tax classification *</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={formData.w9_tax_classification}
            onChange={(e) =>
              setFormData({
                ...formData,
                w9_tax_classification: e.target.value,
              })
            }
          >
            <option value="Individual/sole proprietor">
              Individual/sole proprietor or single-member LLC
            </option>
            <option value="C Corporation">C Corporation</option>
            <option value="S Corporation">S Corporation</option>
            <option value="Partnership">Partnership</option>
            <option value="Trust/estate">Trust/estate</option>
            <option value="Limited liability company">
              Limited liability company
            </option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="w9_address">
              Address (number, street, and apt. or suite no.) *
            </Label>
            <Input
              id="w9_address"
              value={formData.w9_address}
              onChange={(e) =>
                setFormData({ ...formData, w9_address: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w9_city_state_zip">
              City, state, and ZIP code *
            </Label>
            <Input
              id="w9_city_state_zip"
              value={formData.w9_city_state_zip}
              onChange={(e) =>
                setFormData({ ...formData, w9_city_state_zip: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="w9_ssn_ein">
            Social Security Number (SSN) or Employer Identification Number (EIN)
            *
          </Label>
          <Input
            id="w9_ssn_ein"
            type="password"
            placeholder="XXX-XX-XXXX or XX-XXXXXXX"
            value={formData.w9_ssn_ein}
            onChange={(e) => {
              const formatted = formatSSNEIN(e.target.value);
              setFormData({ ...formData, w9_ssn_ein: formatted });
            }}
          />
          <p className="text-xs text-muted-foreground">
            This information is stored securely for tax reporting purposes.
          </p>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="text-xs text-muted-foreground space-y-2 mb-4">
          <p>
            <strong>Part II Certification</strong>
          </p>
          <p>Under penalties of perjury, I certify that:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>
              The number shown on this form is my correct taxpayer
              identification number, and
            </li>
            <li>I am not subject to backup withholding, and</li>
            <li>I am a U.S. citizen or other U.S. person.</li>
          </ol>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="w9_terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked as boolean)}
          />
          <Label htmlFor="w9_terms" className="text-sm font-bold">
            I certify under penalties of perjury that the statements above are
            true and correct.
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="w9_signature">
            Digital Signature (Type Full Name) *
          </Label>
          <Input
            id="w9_signature"
            placeholder="e.g. John Doe"
            value={formData.w9_signature}
            onChange={(e) =>
              setFormData({ ...formData, w9_signature: e.target.value })
            }
          />
        </div>

        <Button
          onClick={handleSign}
          disabled={!formData.w9_signature.trim() || !agreed || isSubmitting}
          className="w-full sm:w-auto"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign & Submit W-9
        </Button>
      </div>
    </div>
  );
};

const ApplicantDashboard = ({
  contractor,
  template,
  companyName,
}: {
  contractor: any;
  template?: string | null;
  companyName?: string;
}) => {
  const status = contractor?.status?.toLowerCase() || "applied";

  const steps = [
    {
      id: "applied",
      label: "Application Received",
      icon: FileText,
      description: "We are reviewing your portfolio and experience.",
    },
    {
      id: "interview",
      label: "Interview",
      icon: User,
      description: "Schedule and complete a quick intro call with our team.",
    },
    {
      id: "paperwork",
      label: "Paperwork & Onboarding",
      icon: FileText,
      description:
        "Congrats! You passed the interview. Complete your paperwork to finalize your hire.",
    },
    {
      id: "active",
      label: "Hired!",
      icon: CheckCircle2,
      description:
        "Welcome to the team! Complete your training academy to unlock your full dashboard.",
    },
  ];

  const getCurrentStepIndex = () => {
    switch (status) {
      case "applied":
        return 0;
      case "interview":
        return 1;
      case "paperwork":
        return 2;
      case "active":
        return 3;
      case "rejected":
      case "declined":
      case "not_selected":
        return -1;
      default:
        return 0;
    }
  };

  const currentIndex = getCurrentStepIndex();

  if (currentIndex === -1) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center shadow-sm">
          <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center space-y-4">
            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-2">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold">Application Update</h2>
            <p className="text-muted-foreground">
              Thank you for applying. Unfortunately, we have decided to move
              forward with other candidates at this time. We will keep your
              portfolio on file for future opportunities!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Candidate Portal</h1>
        <p className="text-muted-foreground">
          Track your application progress.
        </p>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader className="bg-muted/10 border-b pb-6">
          <CardTitle>Application Status</CardTitle>
          <CardDescription>
            You are currently in the{" "}
            <strong>{steps[currentIndex]?.label}</strong> stage.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8 pb-10">
          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute top-6 left-6 right-6 h-0.5 bg-muted hidden md:block" />
            <div
              className="absolute top-6 left-6 h-0.5 bg-primary hidden md:block transition-all duration-500"
              style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
              {steps.map((step, index) => {
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;
                const isPending = index > currentIndex;

                return (
                  <div
                    key={step.id}
                    className="flex flex-row md:flex-col items-center md:text-center gap-4 md:gap-3"
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                        isCompleted
                          ? "bg-primary border-primary text-primary-foreground"
                          : isCurrent
                            ? "bg-background border-primary text-primary shadow-sm"
                            : "bg-background border-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <step.icon className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h3
                        className={`font-semibold ${isPending ? "text-muted-foreground" : "text-foreground"}`}
                      >
                        {step.label}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 md:px-2">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {currentIndex === 1 && (
        <ContractorInterviewSection contractor={contractor} />
      )}

      {currentIndex === 2 && (
        <div className="space-y-6">
          {contractor?.w9_signature && contractor?.contract_signature && (
            <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400">
              <Sparkles className="h-5 w-5" />
              <AlertTitle className="text-lg">Paperwork Complete!</AlertTitle>
              <AlertDescription className="mt-2 text-base">
                You have successfully completed all required paperwork. Your
                application is now waiting for final manager approval. Once
                hired, these signed documents will be permanently stored in your{" "}
                <strong>Compliance</strong> tab for your records.
              </AlertDescription>
            </Alert>
          )}

          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <CardTitle>Form W-9</CardTitle>
              <CardDescription>
                Please complete and sign your W-9 for tax reporting.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 pb-8">
              {contractor?.w9_signature ? (
                <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>W-9 Submitted</AlertTitle>
                  <AlertDescription className="mt-2">
                    Thank you! Your W-9 has been securely recorded.
                  </AlertDescription>
                </Alert>
              ) : (
                <W9Form contractor={contractor} />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <CardTitle>Contractor Agreement</CardTitle>
              <CardDescription>
                Please review and sign your contractor agreement to proceed.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 pb-8">
              {contractor?.contract_signature ? (
                <div className="space-y-4">
                  <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Agreement Signed</AlertTitle>
                    <AlertDescription className="mt-2">
                      Thank you for signing the agreement! Your signature has
                      been recorded as{" "}
                      <strong>{contractor.contract_signature}</strong>. Our team
                      will review your paperwork and activate your account
                      shortly.
                    </AlertDescription>
                  </Alert>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const content = document.createElement("div");
                      const resolvedCompanyName = companyName || "the Company";
                      const contractorName =
                        `${contractor?.first_name || ""} ${contractor?.last_name || ""}`.trim() ||
                        "Contractor";
                      const signedDate = contractor?.contract_signed_at
                        ? new Date(
                            contractor.contract_signed_at,
                          ).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "";

                      const processedTemplate = template
                        ? template
                            .replace(/{{company_name}}/g, resolvedCompanyName)
                            .replace(/{{contractor_name}}/g, contractorName)
                            .replace(/{{date}}/g, signedDate)
                        : `<h1>Independent Contractor Agreement</h1><p>Effective Date: ${signedDate}</p><p>This Independent Contractor Agreement (the "Agreement") is entered into by and between <strong>${resolvedCompanyName}</strong> (the "Company") and <strong>${contractorName}</strong> (the "Contractor").</p>`;

                      content.innerHTML = `
                      <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
                        ${processedTemplate}
                        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">
                          <p><strong>Digitally Signed By:</strong> ${contractor.contract_signature}</p>
                          <p><strong>Date/Time:</strong> ${new Date(contractor.contract_signed_at).toLocaleString()}</p>
                          <p><strong>IP/Device:</strong> Verified via Contractor Portal</p>
                        </div>
                      </div>
                    `;

                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        printWindow.document.write(
                          "<html><head><title>Contractor Agreement</title></head><body>",
                        );
                        printWindow.document.write(content.innerHTML);
                        printWindow.document.write("</body></html>");
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => {
                          printWindow.print();
                        }, 250);
                      }
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download as PDF
                  </Button>
                </div>
              ) : (
                <AgreementSigner
                  contractor={contractor}
                  template={template}
                  companyName={companyName}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isIOS) {
        toast.error(
          "To enable push notifications on iPhone/iPad, please tap 'Share' then 'Add to Home Screen' first.",
        );
      } else {
        toast.error("Your browser does not support push notifications.");
      }
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        toast.success(
          "Notifications enabled! You'll now receive alerts for new jobs and updates.",
        );

        // Register service worker for push if supported
        if ("serviceWorker" in navigator) {
          try {
            await navigator.serviceWorker.register("/sw.js");
          } catch (e) {
            console.error("Service worker registration failed:", e);
          }
        }
      } else {
        toast.error(
          "Notifications disabled. You can change this in your browser settings.",
        );
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  const { data: contractor, isLoading: loadingProfile } = useQuery({
    queryKey: ["contractor", user?.email],
    queryFn: async () => {
      const contractors = await api.getContractors();
      return contractors.find(
        (c) =>
          c.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase(),
      );
    },
    enabled: !!user?.email,
  });

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  const { data: applications = [], isLoading: loadingApps } = useQuery({
    queryKey: ["applications"],
    queryFn: api.getApplications,
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: api.getJobs,
  });

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
  });

  const isLoading =
    loadingProfile || loadingAssignments || loadingApps || loadingJobs;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (
    contractor &&
    [
      "applied",
      "interview",
      "paperwork",
      "rejected",
      "declined",
      "not_selected",
    ].includes(contractor.status?.toLowerCase())
  ) {
    return (
      <ApplicantDashboard
        contractor={contractor}
        template={settings?.contract_template}
        companyName={settings?.company_name}
      />
    );
  }

  // Filter lists for the current contractor
  const myAssignments = assignments
    .filter((a) => a.contractor_id === contractor?.id)
    .sort((a: any, b: any) => {
      const dateA = parseLocalDate(
        a.jobs?.weddings?.date || "9999-12-31",
      ).getTime();
      const dateB = parseLocalDate(
        b.jobs?.weddings?.date || "9999-12-31",
      ).getTime();
      return dateA - dateB; // Closest first
    });

  const myApplications = applications
    .filter((a) => a.contractor_id === contractor?.id)
    .sort((a: any, b: any) => {
      const dateA = parseLocalDate(
        a.jobs?.weddings?.date || "9999-12-31",
      ).getTime();
      const dateB = parseLocalDate(
        b.jobs?.weddings?.date || "9999-12-31",
      ).getTime();
      return dateA - dateB; // Closest first
    });

  const pendingApplications = myApplications.filter(
    (a) =>
      a.status?.toLowerCase() === "pending" ||
      a.status?.toLowerCase() === "applied",
  );

  // Calculate featured open job
  const myActiveAssignments = myAssignments.filter((a) =>
    [
      "upcoming",
      "accepted",
      "confirmed",
      "assigned",
      "action required",
    ].includes(
      String(a.status || "")
        .trim()
        .toLowerCase(),
    ),
  );
  const myBookedDates = new Set(
    myActiveAssignments.map((a) => a.jobs?.weddings?.date).filter(Boolean),
  );

  const visiblePositions = jobs.filter((p) => {
    if (p.status !== "open") return false;
    if (myBookedDates.has(p.weddings?.date)) return false;

    const isPhotoOnly =
      p.role?.toLowerCase().includes("photo") &&
      !p.role?.toLowerCase().includes("video");
    const requiresDrone =
      (p.drone_required === true || p.drone_required === "true") &&
      !isPhotoOnly;

    if (requiresDrone && !contractor?.drone_approved) return false;

    if (contractor?.specialty) {
      const specialty = (contractor.specialty || "").toLowerCase();
      const role = (p.role || "").toLowerCase();
      if (!specialty.includes("both") && !specialty.includes("&")) {
        if (specialty.includes("video") && !role.includes("video"))
          return false;
        if (specialty.includes("photo") && !role.includes("photo"))
          return false;
        if (specialty.includes("content") && !role.includes("content"))
          return false;
      }
    }

    if (contractor?.region) {
      const regions = parseRegions(contractor.region);
      if (regions.length > 0) {
        const isAllRegions = regions.some(
          (r: string) => r.toLowerCase() === "all regions",
        );
        if (!isAllRegions) {
          const jobLocation = (p.weddings?.location || "").toLowerCase();
          const weddingRegions = parseRegions(p.weddings?.region);

          let matchesRegion = false;
          if (weddingRegions.length > 0) {
            matchesRegion = regions.some((r) =>
              weddingRegions.some((wr) => wr.toLowerCase() === r.toLowerCase()),
            );
          } else {
            matchesRegion = regions.some((r) =>
              jobLocation.includes(r.toLowerCase()),
            );
          }
          if (!matchesRegion) return false;
        }
      }
    }
    return true;
  });

  const myActiveWeddingIds = new Set(
    myApplications
      .filter((a) => a.status !== "declined" && a.status !== "not_selected")
      .map((a) => jobs.find((j) => j.id === a.job_id)?.wedding_id)
      .filter(Boolean),
  );

  const openJobs = visiblePositions.filter(
    (p) =>
      !myApplications.some((a) => a.job_id === p.id) &&
      !myActiveWeddingIds.has(p.wedding_id),
  );

  const featuredJob = openJobs.sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime(),
  )[0];

  const outbidApplications = pendingApplications.filter((myApp) => {
    const job = jobs.find((j) => j.id === myApp.job_id);
    if (job?.pay_type !== "bidding") return false;

    const jobApps = applications.filter(
      (a) =>
        a.job_id === job.id &&
        a.status !== "declined" &&
        a.status !== "not_selected" &&
        a.status !== "withdrawn",
    );

    const lowestBid = jobApps.reduce((min, app) => {
      if (app.bid_amount && app.bid_amount < min) return app.bid_amount;
      return min;
    }, Infinity);

    return lowestBid !== Infinity && lowestBid < (myApp.bid_amount || 0);
  });

  // Calculate upcoming vs completed
  const nowInTz = new Date(
    new Date().toLocaleString("en-US", { timeZone: getCompanyTimezone() }),
  );
  const today = startOfDay(
    new Date(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate()),
  );
  const thirtyDaysFromNow = addDays(today, 30);
  const fourteenDaysFromNow = addDays(today, 14);

  const pendingUploads = myAssignments
    .filter((a) => {
      if (!a.jobs?.weddings?.date) return false;
      const wDate = parseLocalDate(a.jobs.weddings.date);
      const isPastWedding = wDate.getTime() < today.getTime();
      const needsUpload = [
        "confirmed",
        "accepted",
        "action required",
        "assigned",
      ].includes(
        String(a.status || "")
          .trim()
          .toLowerCase(),
      );
      return isPastWedding && needsUpload;
    })
    .sort((a, b) => {
      const dateA = a.jobs?.weddings?.date
        ? parseLocalDate(a.jobs.weddings.date).getTime()
        : 0;
      const dateB = b.jobs?.weddings?.date
        ? parseLocalDate(b.jobs.weddings.date).getTime()
        : 0;
      return dateA - dateB;
    });

  const upcomingAssignments = myAssignments
    .filter((a) => {
      const status = a.status?.toLowerCase() || "";
      const jobStatus = a.jobs?.status?.toLowerCase() || "";
      const weddingStatus = a.jobs?.weddings?.status?.toLowerCase() || "";
      if (jobStatus === "cancelled" || weddingStatus === "cancelled")
        return false;

      if (!a.jobs?.weddings?.date) return false;
      const wDate = parseLocalDate(a.jobs.weddings.date);
      const isPastWedding = wDate.getTime() < today.getTime();
      if (isPastWedding) return false;

      return (
        status === "upcoming" ||
        status === "accepted" ||
        status === "confirmed" ||
        status === "action required" ||
        status === "assigned"
      );
    })
    .sort((a, b) => {
      const dateA = (a as any).jobs?.weddings?.date
        ? parseLocalDate((a as any).jobs.weddings.date).getTime()
        : 0;
      const dateB = (b as any).jobs?.weddings?.date
        ? parseLocalDate((b as any).jobs.weddings.date).getTime()
        : 0;
      return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
    });

  const onDeckAssignments = upcomingAssignments.filter((a) => {
    if (!a.jobs?.weddings?.date) return false;
    const wDate = parseLocalDate(a.jobs.weddings.date);
    return wDate >= today && wDate <= fourteenDaysFromNow;
  });

  const getDaysUntil = (dateStr: string) => {
    if (!dateStr) return "Unknown";
    const target = parseLocalDate(dateStr);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    return `In ${diffDays} days`;
  };

  const getUrgencyStyles = (dateStr: string) => {
    if (!dateStr)
      return {
        border: "border-l-primary",
        pill: "bg-primary",
        badge: "bg-primary/10 text-primary border-primary/20",
        bg: "bg-muted/20",
      };
    const target = parseLocalDate(dateStr);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3) {
      return {
        border: "border-l-destructive",
        pill: "bg-destructive",
        badge: "bg-destructive/10 text-destructive border-destructive/20",
        bg: "bg-destructive/5",
      };
    }
    if (diffDays <= 7) {
      return {
        border: "border-l-amber-500",
        pill: "bg-amber-500",
        badge:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        bg: "bg-amber-500/5",
      };
    }
    return {
      border: "border-l-primary",
      pill: "bg-primary",
      badge: "bg-primary/10 text-primary border-primary/20",
      bg: "bg-primary/5",
    };
  };

  const completedJobs = myAssignments.filter((a) => {
    const s = a.status?.toLowerCase() || "";
    return s === "completed" || s === "paid" || s === "pending payout";
  }).length;

  const currentYear = new Date().getFullYear();
  const ytdEarnings = myAssignments
    .filter((a) => {
      const s = a.status?.toLowerCase() || "";
      const isPaid =
        s === "completed" || s === "paid" || s === "pending payout";
      const dateStr = a.jobs?.weddings?.date || a.created_at;
      const year = dateStr ? new Date(dateStr).getFullYear() : 0;
      return isPaid && year === currentYear;
    })
    .reduce((sum, a) => sum + (Number(a.jobs?.pay_rate) || 0), 0);

  const firstName =
    contractor?.first_name || user?.email?.split("@")[0] || "Contractor";
  const rating = contractor?.rating ? contractor.rating.toFixed(1) : "New";

  const isProfileIncomplete =
    contractor &&
    (!contractor.avatar_url || !contractor.bio || !contractor.portfolio_url);

  if (isProfileIncomplete) {
    return <ProfileOnboarding contractor={contractor} />;
  }

  return (
    <div className="space-y-8">
      {!contractor?.venmo_handle && !contractor?.stripe_account_id && (
        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400">
          <DollarSign className="h-4 w-4" />
          <AlertTitle>Action Required: Add Payment Method</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <span>
              You haven't set up a payment method yet. Add Venmo or connect
              Stripe to receive payouts.
            </span>
            <Button
              size="sm"
              asChild
              variant="outline"
              className="whitespace-nowrap border-amber-500/20 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
            >
              <Link to="/profile">Setup Payment</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {notificationPermission === "default" && (
        <Alert className="bg-primary/10 border-primary/20 text-primary">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Enable Push Notifications</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <span>
              Get instant alerts on your mobile device when new jobs are posted
              or assignments change.
            </span>
            <Button
              size="sm"
              onClick={requestNotificationPermission}
              className="whitespace-nowrap"
            >
              Enable Notifications
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {outbidApplications.length > 0 && (
        <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertTitle className="text-red-800 dark:text-red-300 font-bold flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            You've been outbid!
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-2">
              Another contractor has placed a lower bid on the following
              positions:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              {outbidApplications.map((app) => {
                const job = jobs.find((j) => j.id === app.job_id);
                const jobApps = applications.filter(
                  (a) =>
                    a.job_id === job?.id &&
                    a.status !== "declined" &&
                    a.status !== "not_selected" &&
                    a.status !== "withdrawn",
                );
                const lowestBid = jobApps.reduce(
                  (min, a) =>
                    a.bid_amount && a.bid_amount < min ? a.bid_amount : min,
                  Infinity,
                );

                return (
                  <li key={app.id}>
                    <strong>{job?.role}</strong> for{" "}
                    {job?.weddings?.client_name} (Lowest: ${lowestBid}, Yours: $
                    {app.bid_amount})
                    <Button
                      variant="link"
                      asChild
                      className="h-auto p-0 ml-2 text-red-700 dark:text-red-400 font-semibold underline"
                    >
                      <Link to={`/opportunities/${job?.id}`}>Update Bid</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {featuredJob && (
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-background to-background p-6 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Sparkles className="w-32 h-32 text-primary" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-primary text-primary-foreground animate-pulse shadow-sm rounded-full">
                  New Opportunity
                </Badge>
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />{" "}
                  {formatDisplayDate(featuredJob.weddings?.date)}
                </span>
              </div>
              <h3 className="text-xl font-bold">
                {featuredJob.role} needed for{" "}
                {featuredJob.weddings?.client_name || "Wedding"}
              </h3>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
                <MapPin className="h-4 w-4" />{" "}
                {featuredJob.weddings?.location || "Location TBD"}
                <span className="mx-2">•</span>
                <DollarSign className="h-4 w-4" />{" "}
                {featuredJob.pay_type === "bidding"
                  ? "Bidding Open"
                  : `$${featuredJob.pay_rate}`}
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="shrink-0 shadow-md rounded-full"
            >
              <Link to={`/opportunities/${featuredJob.id}`}>
                View Details & Apply
              </Link>
            </Button>
          </div>
        </div>
      )}

      {pendingUploads.map((upload) => {
        const weddingDate = new Date(upload.jobs?.weddings?.date || new Date());
        const deadline = new Date(weddingDate);
        deadline.setDate(deadline.getDate() + 7);
        const now = new Date();
        const diffTime = deadline.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const isOverdue = diffDays < 0;

        return (
          <div
            key={`urgent-${upload.id}`}
            className="relative overflow-hidden rounded-2xl border border-destructive/50 bg-destructive/10 p-6 shadow-sm animate-in fade-in slide-in-from-top-4"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <AlertCircle className="w-32 h-32 text-destructive" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="destructive"
                    className="animate-pulse shadow-sm rounded-full"
                  >
                    Action Required
                  </Badge>
                  <span
                    className={`text-sm font-bold ${isOverdue ? "text-destructive" : "text-destructive/80"}`}
                  >
                    {isOverdue
                      ? `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`
                      : `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-destructive">
                  Upload Media for{" "}
                  {upload.jobs?.weddings?.client_name || "Wedding"}
                </h3>
                <p className="text-destructive/80 text-sm mt-1 max-w-2xl">
                  You have 7 days from the wedding date to upload your raw files
                  and submit your file count to receive payment.
                </p>
              </div>
              <Button
                asChild
                size="lg"
                variant="destructive"
                className="shrink-0 shadow-md rounded-full"
              >
                <Link to={`/assignments/${upload.id}`}>
                  Upload & Request Payout
                </Link>
              </Button>
            </div>
          </div>
        );
      })}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Here's what's happening with your upcoming assignments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/opportunities">Find Jobs</Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="flex flex-col justify-between shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight text-muted-foreground truncate">
              Upcoming Jobs
            </CardTitle>
            <div className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {upcomingAssignments.length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Assigned to you
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-between shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight text-muted-foreground truncate">
              Active Applications
            </CardTitle>
            <div className="p-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 shrink-0">
              <Briefcase className="h-3.5 w-3.5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {pendingApplications.length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Pending review
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-between shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight text-muted-foreground truncate">
              Completed Jobs
            </CardTitle>
            <div className="p-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {completedJobs}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Lifetime
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-between shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight text-muted-foreground truncate">
              YTD Earnings
            </CardTitle>
            <div className="p-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 shrink-0">
              <DollarSign className="h-3.5 w-3.5 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              ${ytdEarnings.toLocaleString()}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              In {currentYear}
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-between shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight text-muted-foreground truncate">
              Rating
            </CardTitle>
            <div className="p-1.5 rounded-full bg-yellow-50 dark:bg-yellow-950/30 shrink-0">
              <Star className="h-3.5 w-3.5 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {rating}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {rating === "New"
                ? "No reviews"
                : `From ${completedJobs} reviews`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {onDeckAssignments.length > 0 && (
          <div className="col-span-full space-y-4 animate-in fade-in slide-in-from-bottom-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-xl font-bold tracking-tight">
                On Deck (Next 14 Days)
              </h2>
              <Badge
                variant="secondary"
                className="rounded-full bg-secondary/50 hover:bg-secondary/70"
              >
                {onDeckAssignments.length} Upcoming
              </Badge>
            </div>

            {onDeckAssignments.some((a) => {
              const defaultTodos = [
                {
                  id: "1",
                  task: "Contact the couple to introduce yourself",
                  completed: false,
                },
                {
                  id: "2",
                  task: "Review timeline and questionnaire",
                  completed: false,
                },
                {
                  id: "3",
                  task: "Prep gear and charge all batteries",
                  completed: false,
                },
              ];
              const todos =
                a.jobs?.contractor_todos &&
                Array.isArray(a.jobs.contractor_todos) &&
                a.jobs.contractor_todos.length > 0
                  ? a.jobs.contractor_todos
                  : defaultTodos;
              return todos.some((t: any) => !t.completed);
            }) && (
              <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-2xl shadow-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-semibold">
                  Pre-Wedding Action Items Due
                </AlertTitle>
                <AlertDescription className="mt-1">
                  You have upcoming weddings with incomplete preparation
                  checklists. Please review your On Deck assignments below and
                  complete your required tasks.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {onDeckAssignments.map((assignment) => {
                const urgency = getUrgencyStyles(
                  assignment.jobs?.weddings?.date || "",
                );

                const defaultTodos = [
                  {
                    id: "1",
                    task: "Contact the couple to introduce yourself",
                    completed: false,
                  },
                  {
                    id: "2",
                    task: "Review timeline and questionnaire",
                    completed: false,
                  },
                  {
                    id: "3",
                    task: "Prep gear and charge all batteries",
                    completed: false,
                  },
                ];
                const todos =
                  assignment.jobs?.contractor_todos &&
                  Array.isArray(assignment.jobs.contractor_todos) &&
                  assignment.jobs.contractor_todos.length > 0
                    ? assignment.jobs.contractor_todos
                    : defaultTodos;

                const completedCount = todos.filter(
                  (t: any) => t.completed,
                ).length;
                const readinessScore = Math.round(
                  (completedCount / todos.length) * 100,
                );

                let scoreColor = "text-destructive";
                if (readinessScore === 100)
                  scoreColor = "text-green-600 dark:text-green-500";
                else if (readinessScore >= 50)
                  scoreColor = "text-amber-600 dark:text-amber-400";

                const pendingTasks = todos.filter((t: any) => !t.completed);

                return (
                  <Card
                    key={assignment.id}
                    className="flex flex-col overflow-hidden shadow-sm border-border/40 hover:shadow-md transition-all duration-300 rounded-2xl bg-gradient-to-b from-card to-muted/10"
                  >
                    <CardHeader className="p-4 pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 pr-2">
                          <CardTitle className="text-base truncate font-semibold">
                            {assignment.jobs?.weddings?.client_name}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1.5 flex items-center gap-1.5 truncate text-muted-foreground font-medium">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />{" "}
                            {formatDisplayDate(assignment.jobs?.weddings?.date)}
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full bg-background/50 backdrop-blur-sm shrink-0 whitespace-nowrap border-border/50 shadow-sm"
                        >
                          {getDaysUntil(assignment.jobs?.weddings?.date || "")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {assignment.jobs?.weddings?.location ||
                                "Location TBD"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Briefcase className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {assignment.jobs?.role}
                            </span>
                          </div>
                        </div>

                        <div className="bg-muted/30 p-3 rounded-xl border border-border/50 space-y-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="space-y-2 cursor-help">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    Readiness <Info className="h-3 w-3" />
                                  </span>
                                  <span
                                    className={`text-sm font-bold ${scoreColor}`}
                                  >
                                    {readinessScore}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 rounded-full ${readinessScore === 100 ? "bg-green-500" : "bg-amber-500"}`}
                                    style={{ width: `${readinessScore}%` }}
                                  />
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="w-64 p-3 text-xs">
                              <div className="font-semibold mb-2">
                                Checklist Status
                              </div>
                              <ul className="space-y-1.5">
                                {todos.map((t: any) => (
                                  <li
                                    key={t.id}
                                    className="flex justify-between gap-2"
                                  >
                                    <span className="text-muted-foreground truncate">
                                      {t.task}
                                    </span>
                                    <span
                                      className={
                                        t.completed
                                          ? "text-emerald-500 shrink-0"
                                          : "text-destructive shrink-0"
                                      }
                                    >
                                      {t.completed ? "Done" : "Pending"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>

                          {pendingTasks.length === 0 && (
                            <div className="flex items-center gap-1.5 mt-3 text-xs font-medium text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 p-2 rounded-full">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              All Prep Completed!
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-4 mt-auto border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          asChild
                        >
                          <a
                            href={generateGoogleCalendarUrl(assignment)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Calendar className="mr-2 h-3 w-3" />
                            Calendar
                          </a>
                        </Button>
                        <Button size="sm" className="flex-1" asChild>
                          <Link to={`/assignments/${assignment.id}`}>
                            View Details
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Assignments */}
        <Card className="col-span-full lg:col-span-4 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle>Upcoming Assignments</CardTitle>
            <CardDescription>Your scheduled weddings</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-4">
            {upcomingAssignments.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {upcomingAssignments.map((assignment: any) => (
                  <div
                    key={assignment.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-border/40 p-3 sm:p-4 shadow-sm bg-gradient-to-r from-primary/10 to-transparent gap-3 hover:shadow-md transition-all"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm truncate">
                          {assignment.jobs?.weddings?.client_name || "Wedding"}
                        </h4>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-2 py-0.5 whitespace-nowrap rounded-full"
                        >
                          {assignment.jobs?.role || "Role"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 truncate">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {formatDisplayDate(assignment.jobs?.weddings?.date)}
                        </span>
                        {assignment.jobs?.weddings?.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {assignment.jobs.weddings.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto rounded-full shadow-sm hover:shadow-md transition-all bg-background"
                          >
                            Quick View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-3xl shadow-xl border-border/40">
                          <DialogHeader>
                            <DialogTitle className="text-xl">
                              {assignment.jobs?.weddings?.client_name ||
                                "Wedding"}{" "}
                              - {assignment.jobs?.role}
                            </DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[60vh] pr-4 -mr-4">
                            <div className="space-y-6 pb-4">
                              <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/50">
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4 text-primary" />{" "}
                                  {formatDisplayDate(
                                    assignment.jobs?.weddings?.date,
                                  )}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="h-4 w-4 text-primary" />{" "}
                                  {assignment.jobs?.weddings?.location || "TBD"}
                                </span>
                              </div>

                              <div>
                                <h4 className="font-semibold flex items-center gap-2 mb-3">
                                  <Clock className="h-4 w-4 text-primary" />{" "}
                                  Day-of Timeline
                                </h4>
                                {assignment.jobs?.weddings?.timeline ? (
                                  (() => {
                                    try {
                                      const parsed =
                                        typeof assignment.jobs.weddings
                                          .timeline === "string"
                                          ? JSON.parse(
                                              assignment.jobs.weddings.timeline,
                                            )
                                          : assignment.jobs.weddings.timeline;
                                      if (
                                        Array.isArray(parsed) &&
                                        parsed.length > 0
                                      ) {
                                        return (
                                          <div className="relative border-l-2 border-primary/20 ml-3 space-y-4 pb-2">
                                            {parsed.map(
                                              (item: any, i: number) => (
                                                <div
                                                  key={i}
                                                  className="relative pl-6"
                                                >
                                                  <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full bg-primary border-4 border-card" />
                                                  <div className="font-semibold text-sm">
                                                    {item.time}
                                                  </div>
                                                  <div className="text-sm text-muted-foreground mt-0.5">
                                                    {item.event}
                                                  </div>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        );
                                      }
                                    } catch (e) {}
                                    return (
                                      <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                                        {assignment.jobs.weddings.timeline}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div className="text-sm text-muted-foreground italic bg-muted/20 p-3 rounded-xl border border-dashed">
                                    No timeline submitted yet.
                                  </div>
                                )}
                              </div>

                              {(assignment.jobs?.weddings?.vip_names ||
                                assignment.jobs?.weddings?.vendors ||
                                assignment.jobs?.weddings
                                  ?.special_requests) && (
                                <div className="space-y-4 pt-4 border-t">
                                  <h4 className="font-semibold flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />{" "}
                                    Additional Details
                                  </h4>
                                  {assignment.jobs?.weddings?.vip_names && (
                                    <div>
                                      <h5 className="text-sm font-medium mb-1">
                                        VIPs & Family
                                      </h5>
                                      <p className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/20 p-3 rounded-xl">
                                        {assignment.jobs.weddings.vip_names}
                                      </p>
                                    </div>
                                  )}
                                  {assignment.jobs?.weddings?.vendors && (
                                    <div>
                                      <h5 className="text-sm font-medium mb-1">
                                        Vendors
                                      </h5>
                                      <p className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/20 p-3 rounded-xl">
                                        {assignment.jobs.weddings.vendors}
                                      </p>
                                    </div>
                                  )}
                                  {assignment.jobs?.weddings
                                    ?.special_requests && (
                                    <div>
                                      <h5 className="text-sm font-medium mb-1">
                                        Special Requests
                                      </h5>
                                      <p className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/20 p-3 rounded-xl">
                                        {
                                          assignment.jobs.weddings
                                            .special_requests
                                        }
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                          <div className="pt-4 border-t mt-auto flex justify-between items-center gap-4 flex-wrap">
                            <Button
                              variant="outline"
                              className="rounded-full shadow-sm"
                              asChild
                            >
                              <a
                                href={generateGoogleCalendarUrl(assignment)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                Add to Google Calendar
                              </a>
                            </Button>
                            <Button className="rounded-full shadow-sm" asChild>
                              <Link to={`/assignments/${assignment.id}`}>
                                Open Full Assignment
                              </Link>
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-border/60">
                <Calendar className="mx-auto h-12 w-12 opacity-50 mb-4" />
                <p>No upcoming assignments.</p>
                <Button
                  asChild
                  variant="link"
                  className="mt-2 text-primary font-semibold"
                >
                  <Link to="/opportunities">Browse open positions</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Alerts & Resource Hub */}
        <div className="col-span-full lg:col-span-3 space-y-4">
          {/* Recent Notifications & Status */}
          <Card className="shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle>Recent Alerts & Status</CardTitle>
              <CardDescription>
                Updates on your jobs and applications
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-4">
              <div className="space-y-3 sm:space-y-4">
                {myAssignments
                  .filter((a) => {
                    const isPastWedding =
                      a.jobs?.weddings?.date &&
                      parseLocalDate(a.jobs.weddings.date).getTime() <
                        today.getTime();
                    return (
                      isPastWedding &&
                      (a.status?.toLowerCase() === "confirmed" ||
                        a.status?.toLowerCase() === "accepted")
                    );
                  })
                  .map((a) => (
                    <div
                      key={`upload-${a.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border border-border/40 shadow-sm bg-gradient-to-r from-red-500/10 to-transparent hover:shadow-md transition-all"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 truncate">
                          Media Upload Required
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Please upload your raw files for{" "}
                          {a.jobs?.weddings?.client_name || "Wedding"} and
                          submit your invoice.
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto shrink-0 mt-2 sm:mt-0 rounded-full bg-background shadow-sm"
                      >
                        <Link to={`/assignments/${a.id}`}>Submit Now</Link>
                      </Button>
                    </div>
                  ))}

                {myAssignments
                  .filter((a) => a.status?.toLowerCase() === "pending payout")
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border border-border/40 shadow-sm bg-gradient-to-r from-green-500/10 to-transparent hover:shadow-md transition-all"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="text-sm font-semibold truncate text-green-700 dark:text-green-400">
                          Payment Pending
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Your invoice for{" "}
                          {a.jobs?.weddings?.client_name || "Wedding"} is under
                          review.
                        </p>
                      </div>
                    </div>
                  ))}

                {pendingApplications.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border border-border/40 shadow-sm bg-gradient-to-r from-orange-500/10 to-transparent hover:shadow-md transition-all"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <h4 className="text-sm font-semibold truncate text-orange-700 dark:text-orange-400">
                        Application Under Review
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Your application for {a.jobs?.role} is pending.
                      </p>
                    </div>
                  </div>
                ))}

                {myAssignments.filter(
                  (a) => a.status?.toLowerCase() === "pending payout",
                ).length === 0 &&
                  pendingApplications.length === 0 &&
                  myAssignments.filter((a) => {
                    const isPastWedding =
                      a.jobs?.weddings?.date &&
                      parseLocalDate(a.jobs.weddings.date).getTime() <
                        today.getTime();
                    return (
                      isPastWedding &&
                      (a.status?.toLowerCase() === "confirmed" ||
                        a.status?.toLowerCase() === "accepted")
                    );
                  }).length === 0 && (
                    <div className="py-8 text-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/60">
                      <Bell className="mx-auto h-8 w-8 opacity-50 mb-2 text-primary" />
                      <p className="text-sm font-medium">
                        You're all caught up!
                      </p>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* Resource Hub */}
          <Card className="shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle>Resource Hub</CardTitle>
              <CardDescription>
                Quick links and training materials
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-4">
              <div className="grid gap-3">
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-muted/50 transition-colors group shadow-sm bg-background/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          <Camera className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">
                            Standard Shot Lists
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Required shots by role
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto sm:rounded-l-3xl border-l-border/40">
                    <SheetHeader className="mb-6">
                      <SheetTitle className="text-2xl">
                        Standard Shot Lists
                      </SheetTitle>
                      <SheetDescription>
                        Required shots by role for every wedding.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 pb-8">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          Lead Photographer
                        </h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                          <li>Getting ready (Bride & Groom)</li>
                          <li>First look</li>
                          <li>
                            Ceremony (wide shots, vows, ring exchange, first
                            kiss)
                          </li>
                          <li>Family portraits</li>
                          <li>Couples portraits</li>
                          <li>
                            Reception (grand entrance, first dance, speeches,
                            cake cutting)
                          </li>
                          <li>Grand exit</li>
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          Second Photographer
                        </h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                          <li>Groom getting ready</li>
                          <li>Alternative angles during ceremony</li>
                          <li>Cocktail hour candids</li>
                          <li>
                            Reception details (decor, table settings, empty
                            room)
                          </li>
                          <li>Guest reactions during speeches</li>
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          Lead Videographer
                        </h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                          <li>Establishing shots of venue</li>
                          <li>Audio of vows and speeches</li>
                          <li>Full ceremony coverage</li>
                          <li>Cinematic couples portraits</li>
                          <li>Key reception moments</li>
                          <li className="text-foreground mt-2 font-medium">
                            Important: Record in many short clips rather than
                            one long continuous recording (we create shorter
                            highlight videos for most customers, so short clips
                            work much better for our editors!).
                          </li>
                        </ul>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                <Sheet>
                  <SheetTrigger asChild>
                    <button className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-muted/50 transition-colors group shadow-sm bg-background/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">
                            Raw File Workflow
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Upload guidelines & structure
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto sm:rounded-l-3xl border-l-border/40">
                    <SheetHeader className="mb-6">
                      <SheetTitle className="text-2xl">
                        Raw File Workflow
                      </SheetTitle>
                      <SheetDescription>
                        Guidelines for organizing and uploading your unedited
                        files.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 pb-8">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          1. Local Backup (Crucial)
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          Before doing anything, immediately back up all memory
                          cards to a local hard drive. Do not format your cards
                          until the Google Drive upload is 100% complete and
                          verified by the manager.
                        </p>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          2. Folder Structure
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          Organize your raw files locally before dragging them
                          to the Google Drive link provided in your assignment
                          details. Use this exact structure:
                        </p>
                        <div className="bg-muted/30 p-4 rounded-md font-mono text-sm text-muted-foreground mb-3">
                          [Date]_[ClientName]_[YourRole]/
                          <br />
                          ├── Camera_A/
                          <br />
                          │ └── [All Raw Files]
                          <br />
                          ├── Camera_B/
                          <br />
                          │ └── [All Raw Files]
                          <br />
                          └── Audio/ (Videographers only)
                          <br />
                          └── [All External Audio Files]
                        </div>
                        <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-md text-sm">
                          <strong>Videography Note:</strong> Please record in
                          many short clips rather than one long continuous
                          recording. We create shorter highlight videos for most
                          customers, so short clips are much easier and faster
                          for our editing team to work with!
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          3. Uploading to Google Drive
                        </h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                          <li>
                            Click the Google Drive link in your assignment
                            details page.
                          </li>
                          <li>
                            Drag and drop your entire organized folder into the
                            drive.
                          </li>
                          <li>
                            Leave your computer on and awake until the upload
                            finishes.
                          </li>
                          <li>
                            Verify the file count in Google Drive matches the
                            file count on your local drive.
                          </li>
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          4. Submission & Invoicing
                        </h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                          <li>
                            Once the upload is complete, go to the Assignment
                            Details page.
                          </li>
                          <li>Click "Submit Files & Invoice".</li>
                          <li>
                            We will verify the files and process your payout!
                          </li>
                        </ul>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                <Sheet>
                  <SheetTrigger asChild>
                    <button className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-muted/50 transition-colors group shadow-sm bg-background/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          <PlayCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">
                            Training Materials
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Video tutorials & guides
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto sm:rounded-l-3xl border-l-border/40">
                    <SheetHeader className="mb-6">
                      <SheetTitle className="text-2xl">
                        Training Materials
                      </SheetTitle>
                      <SheetDescription>
                        Guides and tutorials to help you succeed.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 pb-8">
                      <div className="grid gap-6 grid-cols-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="rounded-lg border p-4 space-y-2 cursor-pointer group hover:bg-muted/50 transition-colors">
                              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                                <img
                                  src="https://img.youtube.com/vi/CsOliZHuAcw/hqdefault.jpg"
                                  alt="Posing Guide"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                  <PlayCircle className="h-12 w-12 text-white opacity-90 group-hover:scale-110 transition-transform" />
                                </div>
                              </div>
                              <h4 className="font-medium text-sm mt-3">
                                Posing Guide: Couples
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                Learn our go-to poses for natural, romantic
                                couples portraits.
                              </p>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black border-none">
                            <div className="aspect-video w-full">
                              <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/CsOliZHuAcw?autoplay=1"
                                title="Posing Guide: Couples"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                              ></iframe>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="rounded-lg border p-4 space-y-2 cursor-pointer group hover:bg-muted/50 transition-colors">
                              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                                <img
                                  src="https://img.youtube.com/vi/esXlSgdZth4/hqdefault.jpg"
                                  alt="Audio Setup"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                  <PlayCircle className="h-12 w-12 text-white opacity-90 group-hover:scale-110 transition-transform" />
                                </div>
                              </div>
                              <h4 className="font-medium text-sm mt-3">
                                Audio Setup for Ceremonies
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                Best practices for mic'ing the groom and
                                officiant.
                              </p>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black border-none">
                            <div className="aspect-video w-full">
                              <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/esXlSgdZth4?autoplay=1"
                                title="Audio Setup for Ceremonies"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                              ></iframe>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="rounded-lg border p-4 space-y-2 cursor-pointer group hover:bg-muted/50 transition-colors">
                              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                                <img
                                  src="https://img.youtube.com/vi/WPScbsv12n0/hqdefault.jpg"
                                  alt="Lighting Receptions"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                  <PlayCircle className="h-12 w-12 text-white opacity-90 group-hover:scale-110 transition-transform" />
                                </div>
                              </div>
                              <h4 className="font-medium text-sm mt-3">
                                Lighting Receptions
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                How to use off-camera flash to light dark
                                reception halls.
                              </p>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black border-none">
                            <div className="aspect-video w-full">
                              <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/WPScbsv12n0?autoplay=1"
                                title="Lighting Receptions"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                              ></iframe>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="rounded-lg border p-4 space-y-2 cursor-pointer group hover:bg-muted/50 transition-colors">
                              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                                <img
                                  src="https://img.youtube.com/vi/dyROBCmub3o/hqdefault.jpg"
                                  alt="File Management"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                  <PlayCircle className="h-12 w-12 text-white opacity-90 group-hover:scale-110 transition-transform" />
                                </div>
                              </div>
                              <h4 className="font-medium text-sm mt-3">
                                File Management & Uploads
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                Our required folder structure and upload
                                process.
                              </p>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black border-none">
                            <div className="aspect-video w-full">
                              <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/dyROBCmub3o?autoplay=1"
                                title="File Management & Uploads"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                              ></iframe>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                <Sheet>
                  <SheetTrigger asChild>
                    <button className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-muted/50 transition-colors group shadow-sm bg-background/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          <CheckSquare className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">
                            Pre & Post-Wedding Checklists
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Gear prep & file management
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto sm:rounded-l-3xl border-l-border/40">
                    <SheetHeader className="mb-6">
                      <SheetTitle className="text-2xl">
                        Pre & Post-Wedding Checklists
                      </SheetTitle>
                      <SheetDescription>
                        Ensure you are fully prepared before the wedding and
                        handle files correctly afterward.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 pb-8">
                      <div>
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">
                            1
                          </span>
                          The Night Before (Pre-Wedding)
                        </h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Format all memory cards</strong> in-camera
                              to ensure they are completely clean and ready.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Charge all batteries</strong> (cameras,
                              speedlights, audio recorders, drones, gimbals).
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Clean all lenses and sensors</strong> to
                              avoid dust spots.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Review the timeline and shot list</strong>{" "}
                              in your assignment details.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Sync camera times</strong> if shooting
                              with multiple bodies or a second shooter.
                            </span>
                          </li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">
                            2
                          </span>
                          Wedding Day Essentials
                        </h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Dual Slot Recording:</strong> Always shoot
                              to two cards simultaneously for immediate backup.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Professionalism:</strong> Arrive 15
                              minutes early, wear all-black professional attire.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Audio (Video Only):</strong> Mic the groom
                              and officiant, and plug into the DJ's soundboard.
                            </span>
                          </li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-sm">
                            3
                          </span>
                          Post-Wedding Workflow
                        </h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Immediate Local Backup:</strong> As soon
                              as you get home, copy all raw files to your
                              computer/hard drive.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Organize Folders:</strong> Separate Camera
                              A, Camera B, and Audio into clear folders.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Upload to Google Drive:</strong> Drag the
                              folder to the assignment's Google Drive link.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>
                              <strong>Submit Invoice:</strong> Go to the
                              assignment in the portal and click "Submit Files &
                              Invoice".
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckSquare className="h-4 w-4 mt-0.5 shrink-0 text-destructive/80" />
                            <span className="text-destructive font-medium">
                              DO NOT format your SD cards until the manager
                              confirms they have safely downloaded the files.
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
