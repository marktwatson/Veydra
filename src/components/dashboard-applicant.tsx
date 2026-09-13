import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  FileText,
  User,
  Sparkles,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";
import { ContractorInterviewSection } from "@/components/ContractorInterviewSection";

export const AgreementSigner = ({
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

export const formatSSNEIN = (value: string) => {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 9) {
    if (
      value.includes("-") &&
      value.split("-")[0].length === 2 &&
      cleaned.length > 2
    ) {
      if (cleaned.length <= 2) return cleaned;
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    } else {
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 5)
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    }
  }
  return value.slice(0, 11);
};

export const W9Form = ({ contractor }: { contractor: any }) => {
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

export const ApplicantDashboard = ({
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
