import { useState, useEffect } from "react";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Plus,
  X,
  Briefcase,
  Shield,
  Video,
  Heart,
  Trash2,
  Users,
  CreditCard,
  Loader2,
  AlertCircle,
  Copy,
  CheckCircle2,
  XCircle,
  UploadCloud,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  formatDisplayDate,
  formatTime,
  DEFAULT_LOGO_URL,
  cn,
} from "@/lib/utils";
import { api, sendOvantaSms, sendOvantaEmail } from "@/lib/api";
import { AppIconUploader } from "@/components/AppIconUploader";
import EmailPreviewModal from "@/components/EmailPreviewModal";
import MarginCalculator from "@/components/MarginCalculator";
import BartendingUpsellCard from "@/components/BartendingUpsellCard";

const getPreviewHtml = (html: string) => {
  const logoUrl =
    localStorage.getItem("veydra_logo_url_preview") ||
    localStorage.getItem("veydra_logo_url") ||
    DEFAULT_LOGO_URL;
  const companyName =
    localStorage.getItem("veydra_company_name_preview") ||
    localStorage.getItem("veydra_company_name") ||
    "Company";
  const companyState =
    localStorage.getItem("veydra_company_state_preview") ||
    localStorage.getItem("veydra_company_state") ||
    "Tennessee";
  const appUrl = (
    localStorage.getItem("veydra_app_url_preview") ||
    localStorage.getItem("veydra_app_url") ||
    window.location.origin
  ).replace(/\/$/, "");
  return html
    .replace(/{{company_name}}/g, companyName)
    .replace(/{{company_state}}/g, companyState)
    .replace(/{{logo_url}}/g, logoUrl)
    .replace(/{{contractor_name}}/g, "Jane Doe")
    .replace(/{{manager_name}}/g, "Admin Alex")
    .replace(
      /{{setup_link}}/g,
      `${appUrl}/setup-password?email=jane.doe@example.com&token=mock-secure-token-12345`,
    )
    .replace(/{{role}}/g, "Lead Videographer")
    .replace(/{{location}}/g, "Charlotte, NC")
    .replace(/{{date}}/g, "October 24, 2026")
    .replace(/{{amount}}/g, "500.00")
    .replace(/{{new_bid}}/g, "450.00")
    .replace(/{{bride_name}}/g, "Sarah")
    .replace(/{{partner_name}}/g, "& John")
    .replace(/{{client_name}}/g, "Sarah")
    .replace(/{{wedding_name}}/g, "Smith & Johnson Wedding")
    .replace(/{{wedding_date}}/g, "October 24, 2026")
    .replace(/{{venue}}/g, "The Grand Ballroom")
    .replace(/{{venue_address}}/g, "123 Main Street")
    .replace(/{{city}}/g, "Nashville")
    .replace(/{{state}}/g, "TN")
    .replace(/{{package_name}}/g, "Diamond Special (Photo & Video)")
    .replace(/{{add_ons}}/g, "Aerial Drone Footage, 2nd Shooter (3 hrs)")
    .replace(/{{total_amount}}/g, "$3,150")
    .replace(/{{retainer_amount}}/g, "$1,575")
    .replace(/{{start_time}}/g, "1:00 PM")
    .replace(/{{stage_name}}/g, "Interview")
    .replace(/{{portal_link}}/g, `${appUrl}/bride-portal/test-sample`)
    .replace(/{{temp_password}}/g, "xY7!pQ9z")
    .replace(/{{arrival_time}}/g, "1:00 PM")
    .replace(/{{gallery_link}}/g, `${appUrl}/gallery/sarah-john`)
    .replace(/{{feedback_link}}/g, `${appUrl}/feedback/123`)
    .replace(/{{client_email}}/g, "sarah@example.com")
    .replace(/{{wedding_date}}/g, "October 24, 2026")
    .replace(/{{venue}}/g, "The Grand Ballroom");
};

function NotificationSetting({
  title,
  description,
  enabled,
  onEnabledChange,
  template,
  onTemplateChange,
  variables,
  onTest,
  isTesting,
  testDisabled,
  extraContent,
  isEmail,
  subject,
  onSubjectChange,
  logoUrl,
  onReset,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (val: boolean) => void;
  template: string;
  onTemplateChange: (val: string) => void;
  variables: string[];
  onTest: () => void;
  isTesting: boolean;
  testDisabled: boolean;
  extraContent?: React.ReactNode;
  isEmail?: boolean;
  subject?: string;
  onSubjectChange?: (val: string) => void;
  logoUrl?: string;
  onReset?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="pr-4">
          <Label className="text-base font-medium">{title}</Label>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="text-muted-foreground h-8 px-2 sm:px-3"
          >
            {isOpen ? "Hide Template" : "Edit Template"}
          </Button>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
      </div>

      {isOpen && (
        <div className="grid gap-4 border rounded-md p-4 bg-muted/10 animate-in fade-in slide-in-from-top-2">
          {variables.includes("{{portal_link}}") &&
            template &&
            !template.includes("{{portal_link}}") && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div className="text-xs text-red-700 dark:text-red-300">
                  <strong>
                    Missing{" "}
                    <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">
                      &#123;&#123;portal_link&#125;&#125;
                    </code>{" "}
                    variable!
                  </strong>{" "}
                  This template has no portal link placeholder — buttons will
                  point to whatever URL is hardcoded in the template. Add{" "}
                  <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">
                    &#123;&#123;portal_link&#125;&#125;
                  </code>{" "}
                  to your button's{" "}
                  <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">
                    href
                  </code>{" "}
                  attribute so it resolves to the correct bride portal.
                </div>
              </div>
            )}
          {extraContent}
          {isEmail && onSubjectChange && (
            <div className="grid gap-2 mb-2">
              <Label>Email Subject</Label>
              <Input
                value={subject || ""}
                onChange={(e) => onSubjectChange(e.target.value)}
                placeholder="Enter subject line"
                autoComplete="off"
                name="template-subject"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label>
              {isEmail ? "Email Body (HTML supported)" : "Message Template"}
            </Label>
            <Textarea
              value={template}
              onChange={(e) => onTemplateChange(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mt-1">
            <p className="text-xs text-muted-foreground flex-1">
              Available variables:{" "}
              {variables.map((v, i) => (
                <span key={v}>
                  <code className="bg-muted px-1 py-0.5 rounded">{v}</code>
                  {i < variables.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {isEmail && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Preview HTML
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Email Preview</DialogTitle>
                    </DialogHeader>
                    <div
                      className="mt-4 border rounded-md p-0 overflow-hidden bg-white"
                      dangerouslySetInnerHTML={{
                        __html: getPreviewHtml(template),
                      }}
                    />
                  </DialogContent>
                </Dialog>
              )}
              {onReset && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReset}
                  className="text-muted-foreground"
                >
                  Reset Default
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={onTest}
                disabled={testDisabled || isTesting}
              >
                <Send className="mr-2 h-3 w-3" />
                {isTesting ? "Sending..." : "Test Template"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Default email theme colors — can be overridden per-instance via Settings
const DEFAULT_EMAIL_COLORS = {
  bg: "#f0ede7", // email background
  cardBg: "#ffffff", // card background
  headerBg1: "#ffffff", // header gradient start
  headerBg2: "#faf7f2", // header gradient end
  accent: "#c9a96e", // champagne gold accent
  buttonText: "#ffffff",
  buttonBg: "#1a1a1a", // near-black button
  heading: "#1a1a1a", // heading text
  body: "#2a2724", // body text
  footerBg: "#faf7f2", // footer background
  footerText: "#9a8b75", // footer text
  signature: "#b89a58", // signature accent
};

const getEmailColors = () => {
  try {
    const stored = localStorage.getItem("veydra_email_colors");
    if (stored) return { ...DEFAULT_EMAIL_COLORS, ...JSON.parse(stored) };
  } catch (e) {}
  return DEFAULT_EMAIL_COLORS;
};

const getBaseEmailTemplate = (
  title: string,
  content: string,
  ctaText?: string,
  ctaLink?: string,
  planningTip?: string,
) => {
  const c = getEmailColors();

  // Normalize content: ensure paragraphs and lists have proper spacing and typography
  const normalizedContent = content
    // Handle tags with existing style
    .replace(
      /<(p|li|ul|ol|h1|h2|h3) style="([^"]*?)">/g,
      (_match, tag, styles) => {
        const baseStyles = "line-height: 1.85; font-size: 16px;";
        if (!styles.includes("margin")) {
          const margin =
            tag === "li" ? "margin-bottom: 16px;" : "margin-bottom: 28px;";
          return `<${tag} style="${baseStyles} ${margin} ${styles}">`;
        }
        return `<${tag} style="${baseStyles} ${styles}">`;
      },
    )
    // Handle plain tags
    .replace(
      /<p>/g,
      '<p style="margin-bottom: 28px; line-height: 1.85; font-size: 16px;">',
    )
    .replace(
      /<li>/g,
      '<li style="margin-bottom: 16px; line-height: 1.85; font-size: 16px;">',
    )
    .replace(
      /<ul>/g,
      '<ul style="margin-bottom: 28px; padding-left: 24px; list-style-type: disc;">',
    )
    .replace(/<ol>/g, '<ol style="margin-bottom: 28px; padding-left: 24px;">')
    .replace(
      /<strong>/g,
      `<strong style="color: ${c.heading}; font-weight: 700;">`,
    );

  const ctaSection =
    ctaText && ctaLink
      ? `
      <div style="text-align: center; margin: 48px 0 28px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaLink}" style="height:54px;v-text-anchor:middle;width:240px;" arcsize="8%" stroke="f" fillcolor="${c.buttonBg}">
          <w:anchorlock/>
          <center style="color:${c.buttonText};font-family:sans-serif;font-size:14px;font-weight:bold;">${ctaText}</center>
        </v:roundrect>
        <![endif]-->
        <a href="${ctaLink}" style="background-color: ${c.buttonBg}; border-radius: 4px; color: ${c.buttonText} !important; display: inline-block; font-size: 14px; font-weight: 700; line-height: 54px; text-align: center; text-decoration: none; width: 240px; -webkit-text-size-adjust: none; mso-hide: all; letter-spacing: 1px; text-transform: uppercase;">
          ${ctaText}
        </a>
      </div>
      <div style="background-color: #f9f7f4; padding: 20px 24px; border-radius: 6px; font-size: 11px; margin-bottom: 40px; border: 1px solid #eee5d8; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 11px; color: #a19582; text-transform: uppercase; letter-spacing: 1px;">Direct Link</p>
        <a href="${ctaLink}" style="color: ${c.heading}; font-size: 12px; word-break: break-all; text-decoration: underline;">${ctaLink}</a>
      </div>`
      : "";

  const tipSection = planningTip
    ? `
      <div style="background-color: #faf8f5; border: 1px solid #f0ede7; border-left: 4px solid ${c.accent}; padding: 32px; margin: 40px 0; border-radius: 0 8px 8px 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align: top;">
              <p style="margin: 0 0 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2.5px; color: ${c.accent};">Pro Planning Tip</p>
              <p style="margin: 0; font-size: 15px; color: #5c5448; line-height: 1.8; font-style: italic;">"${planningTip}"</p>
            </td>
          </tr>
        </table>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Fira+Sans:wght@400;700&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <title>${title}</title>
  <style>
    body { font-family: 'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    h1 { font-family: 'DM Serif Display', serif; font-weight: 400 !important; }
    @media only screen and (max-width: 600px) {
      .inner-body { width: 100% !important; padding: 32px 20px !important; }
      .header { padding: 40px 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 40px 0; width: 100%; background-color: ${c.bg}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${c.bg};">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table class="inner-body" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; margin: 0 auto;">
          
          <!-- Header -->
          <tr>
            <td class="header" style="background: linear-gradient(to bottom, ${c.headerBg1}, ${c.headerBg2}); padding: 60px 40px; text-align: center; border-radius: 8px 8px 0 0; border: 1px solid #f0ede7; border-bottom: none;">
              <img src="{{logo_url}}" alt="{{company_name}}" style="max-height: 80px; max-width: 260px; height: auto; width: auto;" />
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: ${c.cardBg}; padding: 60px 50px 50px; border: 1px solid #f0ede7; border-top: none; border-bottom: none;">
              <h1 style="margin: 0 0 40px; font-size: 32px; color: ${c.heading}; line-height: 1.2; text-align: left;">${title}</h1>

              <div style="color: ${c.body}; font-size: 16px; line-height: 1.85;">
                ${normalizedContent}
              </div>

              ${tipSection}
              ${ctaSection}

              <!-- Signature -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 50px; border-top: 1px solid #f0ede7; padding-top: 30px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; font-size: 15px; color: ${c.body};">Warmly,</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 700; color: ${c.signature};">{{company_name}} Team</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${c.footerBg}; padding: 32px 40px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #f0ede7; border-top: 1px solid #f0ede7;">
              <p style="margin: 0 0 8px; font-size: 12px; color: ${c.footerText}; letter-spacing: 1px; font-weight: 400;">&copy; ${new Date().getFullYear()} {{company_name}}</p>
              <p style="margin: 0; font-size: 11px; color: ${c.signature}; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Timeless Wedding Stories</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export default function ManagerSettings() {
  const { toast } = useToast();
  const [hlApiKey, setHlApiKey] = useState("");
  const [hlLocationId, setHlLocationId] = useState("");
  const [fbAccessToken, setFbAccessToken] = useState("");
  const [fbAdAccountId, setFbAdAccountId] = useState("");
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [isTestingFbApi, setIsTestingFbApi] = useState(false);
  const [testSmsEmail, setTestSmsEmail] = useState("");
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    isTest?: boolean;
    businessName?: string;
    email?: string;
    accountId?: string;
    country?: string;
    payoutsEnabled?: boolean;
    detailsSubmitted?: boolean;
    defaultCurrency?: string;
  } | null>(null);
  const [isCheckingStripe, setIsCheckingStripe] = useState(false);
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadEmail, setUploadEmail] = useState("");
  const [uploadPassword, setUploadPassword] = useState("");
  const [uploadInstructions, setUploadInstructions] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);
  const [emailColors, setEmailColors] = useState(DEFAULT_EMAIL_COLORS);
  const [isSavingEmailColors, setIsSavingEmailColors] = useState(false);
  const [contractTemplate, setContractTemplate] = useState("");
  const [weddingContractTemplate, setWeddingContractTemplate] = useState("");
  const [weddingContractEditorMode, setWeddingContractEditorMode] = useState<
    "formatted" | "plain"
  >("formatted");
  const [contractEditorMode, setContractEditorMode] = useState<
    "formatted" | "plain"
  >("formatted");
  const [isSavingLegal, setIsSavingLegal] = useState(false);

  // Pipeline Templates
  const [smsPipelineInterviewEnabled, setSmsPipelineInterviewEnabled] =
    useState(false);
  const [smsPipelineInterviewTemplate, setSmsPipelineInterviewTemplate] =
    useState(
      "Hi {{contractor_name}}, your application to {{company_name}} has advanced to the Interview stage! Please check your portal for details: {{portal_link}}",
    );
  const [emailPipelineInterviewEnabled, setEmailPipelineInterviewEnabled] =
    useState(false);
  const [emailPipelineInterviewSubject, setEmailPipelineInterviewSubject] =
    useState("Application Update: Interview Stage");
  const [emailPipelineInterviewTemplate, setEmailPipelineInterviewTemplate] =
    useState(
      getBaseEmailTemplate(
        "Interview Stage",
        "<p>Hi {{contractor_name}},</p><p>Great news! Your application at {{company_name}} has advanced to the <strong>Interview</strong> stage.</p>",
        "View Candidate Portal",
        "{{portal_link}}",
      ),
    );

  const [smsPipelinePaperworkEnabled, setSmsPipelinePaperworkEnabled] =
    useState(false);
  const [smsPipelinePaperworkTemplate, setSmsPipelinePaperworkTemplate] =
    useState(
      "Hi {{contractor_name}}, your application to {{company_name}} has advanced to the Paperwork stage! Please check your portal for details: {{portal_link}}",
    );
  const [emailPipelinePaperworkEnabled, setEmailPipelinePaperworkEnabled] =
    useState(false);
  const [emailPipelinePaperworkSubject, setEmailPipelinePaperworkSubject] =
    useState("Application Update: Paperwork Stage");
  const [emailPipelinePaperworkTemplate, setEmailPipelinePaperworkTemplate] =
    useState(
      getBaseEmailTemplate(
        "Paperwork Stage",
        "<p>Hi {{contractor_name}},</p><p>Great news! Your application at {{company_name}} has advanced to the <strong>Paperwork</strong> stage.</p>",
        "View Candidate Portal",
        "{{portal_link}}",
      ),
    );

  const [smsPipelineHiredEnabled, setSmsPipelineHiredEnabled] = useState(false);
  const [smsPipelineHiredTemplate, setSmsPipelineHiredTemplate] = useState(
    "Hi {{contractor_name}}, congratulations! You have been hired at {{company_name}}. Please check your portal to get started: {{portal_link}}",
  );
  const [emailPipelineHiredEnabled, setEmailPipelineHiredEnabled] =
    useState(false);
  const [emailPipelineHiredSubject, setEmailPipelineHiredSubject] = useState(
    "Congratulations! You're Hired",
  );
  const [emailPipelineHiredTemplate, setEmailPipelineHiredTemplate] = useState(
    getBaseEmailTemplate(
      "You're Hired!",
      "<p>Hi {{contractor_name}},</p><p>Congratulations! You have been hired at <strong>{{company_name}}</strong>.</p><p>You can now log in to your portal to complete your training and start accepting assignments.</p>",
      "Log In to Portal",
      "{{portal_link}}/login",
    ),
  );

  const [smsPipelineRejectedEnabled, setSmsPipelineRejectedEnabled] =
    useState(false);
  const [smsPipelineRejectedTemplate, setSmsPipelineRejectedTemplate] =
    useState(
      "Hi {{contractor_name}}, thank you for applying to {{company_name}}. We have decided to move forward with other candidates at this time. We wish you the best!",
    );
  const [emailPipelineRejectedEnabled, setEmailPipelineRejectedEnabled] =
    useState(true);
  const [emailPipelineRejectedSubject, setEmailPipelineRejectedSubject] =
    useState("Update on your application to {{company_name}}");
  const [emailPipelineRejectedTemplate, setEmailPipelineRejectedTemplate] =
    useState(
      getBaseEmailTemplate(
        "Application Update",
        "<p>Hi {{contractor_name}},</p><p>Thank you for taking the time to apply and speak with our team at {{company_name}}.</p><p>While we were impressed with your background, we have decided to move forward with other candidates who more closely align with our current needs for this position.</p><p>We will keep your information on file and may reach out if a better fit opens up in the future.</p><p>We wish you the best in your professional endeavors.</p>",
      ),
    );

  const [emailApplicantWelcomeEnabled, setEmailApplicantWelcomeEnabled] =
    useState(false);
  const [emailApplicantWelcomeSubject, setEmailApplicantWelcomeSubject] =
    useState("Application Received!");
  const [emailApplicantWelcomeTemplate, setEmailApplicantWelcomeTemplate] =
    useState(
      getBaseEmailTemplate(
        "Application Received",
        "<p>Hi {{contractor_name}},</p><p>Thank you for applying to join the {{company_name}} team!</p><p>You can track the status of your application by logging into your Candidate Portal using the email and password you just created.</p>",
        "Log In to Candidate Portal",
        "{{portal_link}}/login",
      ),
    );
  const [smsApplicantWelcomeEnabled, setSmsApplicantWelcomeEnabled] =
    useState(false);
  const [smsApplicantWelcomeTemplate, setSmsApplicantWelcomeTemplate] =
    useState(
      "Hi {{contractor_name}}, your application to {{company_name}} has been received! You can track your status by logging in here: {{portal_link}}/login",
    );

  const [emailPipelineGalleryEnabled, setEmailPipelineGalleryEnabled] =
    useState(false);
  const [emailPipelineGallerySubject, setEmailPipelineGallerySubject] =
    useState("Gallery Submission Request - {{company_name}}");
  const [emailPipelineGalleryTemplate, setEmailPipelineGalleryTemplate] =
    useState(
      getBaseEmailTemplate(
        "Gallery Submission Request",
        "<p>Hi {{contractor_name}},</p><p>Thank you for applying to join the {{company_name}} team!</p><p>To continue your application, please send us a <strong>full gallery from a wedding you shot as lead photographer/videographer</strong>.</p><p>Simply reply to this email with your gallery link (Google Drive, Dropbox, etc.) and we'll take it from there.</p>",
      ),
    );
  const [smsPipelineGalleryEnabled, setSmsPipelineGalleryEnabled] =
    useState(false);
  const [smsPipelineGalleryTemplate, setSmsPipelineGalleryTemplate] = useState(
    "Hi {{contractor_name}}, we'd love to see more of your work! Please reply with a link to a full wedding gallery you shot as lead. Thanks!",
  );

  // Document Expiry
  const [emailDocExpiryEnabled, setEmailDocExpiryEnabled] = useState(false);
  const [emailDocExpirySubject, setEmailDocExpirySubject] = useState(
    "Document Expiring Soon: {{document_name}}",
  );
  const [emailDocExpiryTemplate, setEmailDocExpiryTemplate] = useState(
    getBaseEmailTemplate(
      "Document Expiration Notice",
      "<p>Hi {{contractor_name}},</p><p>Your <strong>{{document_name}}</strong> is set to expire on <strong>{{expiry_date}}</strong>.</p><p>Please log in to your portal to upload a renewed version to remain eligible for assignments.</p>",
      "Update Document",
      "{{portal_link}}/profile",
    ),
  );
  const [smsDocExpiryEnabled, setSmsDocExpiryEnabled] = useState(false);
  const [smsDocExpiryTemplate, setSmsDocExpiryTemplate] = useState(
    "Hi {{contractor_name}}, your {{document_name}} expires on {{expiry_date}}. Please upload a renewed version in your portal: {{portal_link}}/profile",
  );
  const [docExpiryReminderDays, setDocExpiryReminderDays] = useState(30);

  // Invite & Reset
  const [smsInviteEnabled, setSmsInviteEnabled] = useState(false);
  const [smsInviteTemplate, setSmsInviteTemplate] = useState(
    "Hi {{contractor_name}}, you've been invited to join the {{company_name}} team! Set up your account here: {{setup_link}}",
  );
  const [smsResetEnabled, setSmsResetEnabled] = useState(false);
  const [smsResetTemplate, setSmsResetTemplate] = useState(
    "Hi {{contractor_name}}, a password reset was requested for your account. Please check your email for the secure link.",
  );

  const [emailInviteEnabled, setEmailInviteEnabled] = useState(false);
  const [emailInviteSubject, setEmailInviteSubject] = useState(
    "You've been invited to {{company_name}}!",
  );
  const [emailInviteTemplate, setEmailInviteTemplate] = useState(
    getBaseEmailTemplate(
      "Welcome to {{company_name}}",
      "<p>Hi {{contractor_name}},</p><p>You've been invited to join the {{company_name}} team! Set up your account to start receiving job opportunities and managing your assignments.</p>",
      "Set Up Account",
      "{{setup_link}}",
    ),
  );

  const [emailResetEnabled, setEmailResetEnabled] = useState(false);
  const [emailResetSubject, setEmailResetSubject] = useState(
    "Password Reset Request",
  );
  const [emailResetTemplate, setEmailResetTemplate] = useState(
    getBaseEmailTemplate(
      "Password Reset Request",
      "<p>Hi {{contractor_name}},</p><p>A password reset was requested for your {{company_name}} account. Please check your email inbox for the secure password reset link from our system. If you didn't request this, you can safely ignore this email.</p>",
    ),
  );

  const [emailManagerResetTemplate, setEmailManagerResetTemplate] = useState(
    getBaseEmailTemplate(
      "Admin Password Reset",
      "<p>Hi {{manager_name}},</p><p>A password reset was requested for your Admin account. Please check your email inbox for the secure password reset link from our system. If you didn't request this, you can safely ignore this email.</p>",
    ),
  );
  const [emailManagerResetEnabled, setEmailManagerResetEnabled] =
    useState(false);
  const [emailManagerResetSubject, setEmailManagerResetSubject] = useState(
    "Admin Password Reset Request",
  );
  const [emailManagerInviteEnabled, setEmailManagerInviteEnabled] =
    useState(false);
  const [emailManagerInviteSubject, setEmailManagerInviteSubject] = useState(
    "Admin Invitation: {{company_name}}",
  );
  const [emailManagerInviteTemplate, setEmailManagerInviteTemplate] = useState(
    getBaseEmailTemplate(
      "Admin Invitation",
      "<p>Hi {{manager_name}},</p><p>You've been invited as an Admin to the {{company_name}} portal! Set up your account to start managing the team and assignments.</p>",
      "Set Up Admin Account",
      "{{setup_link}}",
    ),
  );
  const [smsManagerInviteEnabled, setSmsManagerInviteEnabled] = useState(false);
  const [smsManagerInviteTemplate, setSmsManagerInviteTemplate] = useState(
    "Hi {{manager_name}}, you've been invited as an Admin to the {{company_name}} portal! Set up your account here: {{setup_link}}",
  );
  const [smsManagerResetEnabled, setSmsManagerResetEnabled] = useState(false);
  const [smsManagerResetTemplate, setSmsManagerResetTemplate] = useState(
    "Hi {{manager_name}}, an Admin password reset was requested. Please check your email for the secure link.",
  );
  const [emailPaymentFailedEnabled, setEmailPaymentFailedEnabled] =
    useState(false);

  // Assignment & Job Templates
  const [smsAssignmentEnabled, setSmsAssignmentEnabled] = useState(false);
  const [smsAssignmentTemplate, setSmsAssignmentTemplate] = useState(
    "Hi {{contractor_name}}! You have been assigned to a new {{role}} position in {{location}} on {{date}}. Check your {{company_name}} portal for details: {{portal_link}}",
  );
  const [smsNewJobEnabled, setSmsNewJobEnabled] = useState(false);
  const [smsNewJobTemplate, setSmsNewJobTemplate] = useState(
    "Hi {{contractor_name}}, a new {{role}} position is open for a wedding in {{location}} on {{date}}. Check the portal to apply: {{portal_link}}/opportunities",
  );
  const [smsReminderEnabled, setSmsReminderEnabled] = useState(false);
  const [smsReminderTemplate, setSmsReminderTemplate] = useState(
    "Hi {{contractor_name}}, friendly reminder about your upcoming {{role}} job for {{wedding_name}} in {{location}} tomorrow, {{date}} at {{start_time}}. Please review the portal for timeline details: {{portal_link}}",
  );
  const [smsReminderHours, setSmsReminderHours] = useState(48);
  const [smsContractorPrepEnabled, setSmsContractorPrepEnabled] =
    useState(false);
  const [smsContractorPrepTemplate, setSmsContractorPrepTemplate] = useState(
    "Hi {{contractor_name}}, you have action items due for the {{wedding_name}} wedding in {{days}} days. Please log in to complete them: {{portal_link}}",
  );
  const [smsContractorPrepDays, setSmsContractorPrepDays] = useState(5);
  const [emailContractorPrepEnabled, setEmailContractorPrepEnabled] =
    useState(false);
  const [emailContractorPrepSubject, setEmailContractorPrepSubject] = useState(
    "Action Items Due for {{wedding_name}} Wedding",
  );
  const [emailContractorPrepTemplate, setEmailContractorPrepTemplate] =
    useState(
      getBaseEmailTemplate(
        "Action Items Due",
        "<p>Hi {{contractor_name}},</p><p>You have incomplete action items for the upcoming <strong>{{wedding_name}}</strong> wedding in <strong>{{location}}</strong> on <strong>{{date}}</strong> ({{days}} days away).</p><p>Please log in to your portal to complete your prep checklist before the wedding day. This helps us deliver the best possible experience for our clients.</p>",
        "Complete My Action Items",
        "{{portal_link}}",
        "Completing your action items early ensures you're fully prepared and helps the team coordinate seamlessly on wedding day.",
      ),
    );

  const [emailAssignmentEnabled, setEmailAssignmentEnabled] = useState(false);
  const [emailAssignmentSubject, setEmailAssignmentSubject] = useState(
    "New Assignment: {{role}} in {{location}}",
  );
  const [emailAssignmentTemplate, setEmailAssignmentTemplate] = useState(
    getBaseEmailTemplate(
      "New Assignment",
      "<p>Hi {{contractor_name}},</p><p>You have been assigned to a new <strong>{{role}}</strong> position in <strong>{{location}}</strong> on <strong>{{date}}</strong>.</p><p>Log in to your portal to view the full details, timeline, and requirements.</p>",
      "View Assignment",
      "{{portal_link}}",
    ),
  );
  const [emailNewJobEnabled, setEmailNewJobEnabled] = useState(false);
  const [emailNewJobSubject, setEmailNewJobSubject] = useState(
    "New Job Available: {{role}} in {{location}}",
  );
  const [emailNewJobTemplate, setEmailNewJobTemplate] = useState(
    getBaseEmailTemplate(
      "New Job Available",
      "<p>Hi {{contractor_name}},</p><p>A new <strong>{{role}}</strong> position is open for a wedding in <strong>{{location}}</strong> on <strong>{{date}}</strong>.</p><p>Check the portal to apply before the position is filled!</p>",
      "View Job Board",
      "{{portal_link}}/opportunities",
    ),
  );
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [emailReminderSubject, setEmailReminderSubject] = useState(
    "Reminder: Upcoming {{role}} job in {{location}}",
  );
  const [emailReminderTemplate, setEmailReminderTemplate] = useState(
    getBaseEmailTemplate(
      "Upcoming Job Reminder",
      "<p>Hi {{contractor_name}},</p><p>Friendly reminder about your upcoming <strong>{{role}}</strong> job for <strong>{{wedding_name}}</strong> in <strong>{{location}}</strong> on <strong>{{date}}</strong> at <strong>{{start_time}}</strong>.</p><p>Please review the portal for timeline details, VIP names, and any special requests.</p>",
      "View Details",
      "{{portal_link}}",
    ),
  );
  const [emailPayoutEnabled, setEmailPayoutEnabled] = useState(false);
  const [emailPayoutSubject, setEmailPayoutSubject] =
    useState("Payout Processed");
  const [emailPayoutTemplate, setEmailPayoutTemplate] = useState(
    getBaseEmailTemplate(
      "Payout Processed",
      "<p>Great news {{contractor_name}}!</p><p>Your payout of <strong>${{amount}}</strong> for the <strong>{{location}}</strong> job on <strong>{{date}}</strong> has been processed.</p><p>Thank you for your hard work!</p>",
    ),
  );
  const [smsPayoutEnabled, setSmsPayoutEnabled] = useState(false);
  const [smsPayoutTemplate, setSmsPayoutTemplate] = useState(
    "Great news {{contractor_name}}! Your payout of ${{amount}} for the {{location}} job on {{date}} has been processed.",
  );

  const [smsOutbidEnabled, setSmsOutbidEnabled] = useState(false);
  const [smsOutbidTemplate, setSmsOutbidTemplate] = useState(
    "Hi {{contractor_name}}, someone has placed a lower bid (${{new_bid}}) on a job you applied for. Update your bid in the portal if you still want the position: {{portal_link}}",
  );
  const [emailOutbidEnabled, setEmailOutbidEnabled] = useState(false);
  const [emailOutbidSubject, setEmailOutbidSubject] = useState(
    "You've been outbid!",
  );
  const [emailOutbidTemplate, setEmailOutbidTemplate] = useState(
    getBaseEmailTemplate(
      "You've been outbid",
      "<p>Hi {{contractor_name}},</p><p>Someone has placed a lower bid (<strong>${{new_bid}}</strong>) on a job you applied for.</p><p>If you still want the position, you can update your bid in the portal.</p>",
      "Update My Bid",
      "{{portal_link}}/opportunities",
    ),
  );

  // Bride Templates
  const [smsBrideWelcomeEnabled, setSmsBrideWelcomeEnabled] = useState(false);
  const [smsBrideWelcomeTemplate, setSmsBrideWelcomeTemplate] = useState(
    "Hi {{bride_name}}! Welcome to {{company_name}}. Your private Bride Hub is ready — complete your wedding details here: {{portal_link}}",
  );
  const [emailBrideWelcomeEnabled, setEmailBrideWelcomeEnabled] =
    useState(false);
  const [emailBrideWelcomeSubject, setEmailBrideWelcomeSubject] = useState(
    "Welcome to your Bride Hub, {{bride_name}}!",
  );
  const [emailBrideWelcomeTemplate, setEmailBrideWelcomeTemplate] = useState(
    getBaseEmailTemplate(
      "You're Officially Booked!",
      "<p>Hi {{bride_name}},</p><p>We are absolutely thrilled to have you as part of the {{company_name}} family. Your wedding date is officially reserved, and the countdown to your big day begins now.</p><p>Your private <strong>Bride Hub</strong> is your home base for everything leading up to your wedding. Here's what you can do right now:</p><ul><li>Complete your <strong>Style & Details Questionnaire</strong> — this tells our team exactly what you envision</li><li>Review your <strong>wedding timeline</strong> and venue details</li><li>Track your <strong>payment balance</strong> and view invoices</li><li>Meet your <strong>media team</strong> once they're assigned</li></ul><p>If you don't see a team assigned yet, don't worry — we're carefully matching you with the perfect crew and they'll appear in your Hub soon.</p>",
      "Go to My Bride Hub",
      "{{portal_link}}",
      "The earlier you complete your questionnaire, the better we can tailor your wedding day coverage to your unique vision. Most brides take about 10–15 minutes to fill it out.",
    ),
  );

  const resetBrideWelcomeEmail = () => {
    setEmailBrideWelcomeSubject("Welcome to your Bride Hub, {{bride_name}}!");
    setEmailBrideWelcomeTemplate(
      getBaseEmailTemplate(
        "You're Officially Booked!",
        "<p>Hi {{bride_name}},</p><p>We are absolutely thrilled to have you as part of the {{company_name}} family. Your wedding date is officially reserved, and the countdown to your big day begins now.</p><p>Your private <strong>Bride Hub</strong> is your home base for everything leading up to your wedding. Here's what you can do right now:</p><ul><li>Complete your <strong>Style & Details Questionnaire</strong> — this tells our team exactly what you envision</li><li>Review your <strong>wedding timeline</strong> and venue details</li><li>Track your <strong>payment balance</strong> and view invoices</li><li>Meet your <strong>media team</strong> once they're assigned</li></ul><p>If you don't see a team assigned yet, don't worry — we're carefully matching you with the perfect crew and they'll appear in your Hub soon.</p>",
        "Go to My Bride Hub",
        "{{portal_link}}",
        "The earlier you complete your questionnaire, the better we can tailor your wedding day coverage to your unique vision. Most brides take about 10–15 minutes to fill it out.",
      ),
    );
  };

  const [smsBrideSongsEnabled, setSmsBrideSongsEnabled] = useState(false);
  const [smsBrideSongsTemplate, setSmsBrideSongsTemplate] = useState(
    "Hi {{bride_name}}! We need your song choices for your wedding highlight video. Pick your songs in your Bride Hub: {{portal_link}}",
  );
  const [emailBrideSongsEnabled, setEmailBrideSongsEnabled] = useState(false);
  const [emailBrideSongsSubject, setEmailBrideSongsSubject] = useState(
    "Pick Your Highlight Video Songs!",
  );
  const [emailBrideSongsTemplate, setEmailBrideSongsTemplate] = useState(
    getBaseEmailTemplate(
      "Choose Your Highlight Video Songs",
      "<p>Hi {{bride_name}},</p><p>Your wedding highlight film is one of the most personal pieces of your final gallery — and the music sets the entire tone.</p><p>We'd love for you to pick the songs that feel most <em>you</em>. You can add the song title, artist, and a direct link (Spotify, YouTube, Apple Music — whichever is easiest) so our editors know exactly which version to use.</p><p>Aim for <strong>2–3 songs</strong>: one for your ceremony, one for the reception highlights, and a backup in case of licensing issues.</p>",
      "Choose My Songs",
      "{{portal_link}}",
      "Tip: Choose songs that reflect your relationship — the song from your first date, a favorite concert, or the track you always dance to in the kitchen. These personal touches make your highlight film unforgettable.",
    ),
  );

  const resetBrideSongsEmail = () => {
    setEmailBrideSongsSubject("Pick Your Highlight Video Songs!");
    setEmailBrideSongsTemplate(
      getBaseEmailTemplate(
        "Choose Your Highlight Video Songs",
        "<p>Hi {{bride_name}},</p><p>Your wedding highlight film is one of the most personal pieces of your final gallery — and the music sets the entire tone.</p><p>We'd love for you to pick the songs that feel most <em>you</em>. You can add the song title, artist, and a direct link (Spotify, YouTube, Apple Music — whichever is easiest) so our editors know exactly which version to use.</p><p>Aim for <strong>2–3 songs</strong>: one for your ceremony, one for the reception highlights, and a backup in case of licensing issues.</p>",
        "Choose My Songs",
        "{{portal_link}}",
        "Tip: Choose songs that reflect your relationship — the song from your first date, a favorite concert, or the track you always dance to in the kitchen. These personal touches make your highlight film unforgettable.",
      ),
    );
  };

  const [smsBridePreWeddingEnabled, setSmsBridePreWeddingEnabled] =
    useState(false);
  const [smsBridePreWeddingTemplate, setSmsBridePreWeddingTemplate] = useState(
    "Hi {{bride_name}}, your big day is almost here! Your media team will arrive at {{arrival_time}}. We can't wait to celebrate with you!",
  );
  const [smsBridePreWeddingHours, setSmsBridePreWeddingHours] = useState(48);
  const [emailBridePreWeddingEnabled, setEmailBridePreWeddingEnabled] =
    useState(false);
  const [emailBridePreWeddingSubject, setEmailBridePreWeddingSubject] =
    useState("Your big day is almost here, {{bride_name}}!");
  const [emailBridePreWeddingTemplate, setEmailBridePreWeddingTemplate] =
    useState(
      getBaseEmailTemplate(
        "The Countdown Is On",
        "<p>Hi {{bride_name}},</p><p>Your wedding day is just around the corner, and we wanted to reach out with a few final details.</p><p>Your media team will arrive at <strong>{{arrival_time}}</strong>. They'll be ready to capture every glance, every laugh, and every moment that makes your day uniquely yours.</p><p>Take a deep breath — you've planned an incredible day, and we're honored to be part of it.</p>",
        "View My Timeline",
        "{{portal_link}}",
        'Pack an "emergency kit" the night before: blotting papers, mints, safety pins, a phone charger, and your vendor contact list. You\'ll thank yourself when something small comes up.',
      ),
    );

  const [smsBrideDeliveryEnabled, setSmsBrideDeliveryEnabled] = useState(false);
  const [smsBrideDeliveryTemplate, setSmsBrideDeliveryTemplate] = useState(
    "Great news {{bride_name}}! Your wedding media is ready. View and download your gallery here: {{gallery_link}}",
  );
  const [emailBrideDeliveryEnabled, setEmailBrideDeliveryEnabled] =
    useState(false);
  const [emailBrideDeliverySubject, setEmailBrideDeliverySubject] = useState(
    "Your Wedding Media is Ready, {{bride_name}}!",
  );
  const [emailBrideDeliveryTemplate, setEmailBrideDeliveryTemplate] = useState(
    getBaseEmailTemplate(
      "Your Wedding Media is Ready",
      "<p>Hi {{bride_name}},</p><p>The moment you've been waiting for is here — your wedding media is finalized and ready to view.</p><p>Your gallery includes all your edited photos and video links. You can download, share with family, and relive every moment whenever you'd like.</p><p>We poured our hearts into capturing your day, and we hope these images and films bring you joy for years to come.</p>",
      "View My Gallery",
      "{{gallery_link}}",
      "Download your photos within 30 days and back them up to two locations (cloud + external drive). Your gallery link will remain active, but having your own copy ensures your memories are always safe.",
    ),
  );

  const [smsBrideRatingEnabled, setSmsBrideRatingEnabled] = useState(false);
  const [smsBrideRatingTemplate, setSmsBrideRatingTemplate] = useState(
    "Hi {{bride_name}}, we hope you loved your wedding media! Could you take a moment to share your feedback? {{feedback_link}}",
  );
  const [emailBrideRatingEnabled, setEmailBrideRatingEnabled] = useState(false);
  const [emailBrideRatingSubject, setEmailBrideRatingSubject] = useState(
    "We'd love to hear from you, {{bride_name}}",
  );
  const [emailBrideRatingTemplate, setEmailBrideRatingTemplate] = useState(
    getBaseEmailTemplate(
      "How Was Your Experience?",
      "<p>Hi {{bride_name}},</p><p>We hope you're still glowing from your wedding day — and that your photos and films brought back every beautiful moment.</p><p>Your feedback means the world to our team. It helps us grow, helps other couples find us, and lets your specific crew know they made a difference.</p><p>It takes less than two minutes, and we'd be so grateful.</p>",
      "Share My Feedback",
      "{{feedback_link}}",
      "Reviews are the lifeblood of small wedding businesses. If you loved your experience, sharing a Google or Facebook review helps couples just like you find us. We'd be honored if you took a moment to share.",
    ),
  );

  const [smsBrideDayAfterEnabled, setSmsBrideDayAfterEnabled] = useState(false);
  const [smsBrideDayAfterTemplate, setSmsBrideDayAfterTemplate] = useState(
    "Hi {{bride_name}}, it was a pleasure to be part of your wedding! Your photos and video are being uploaded and sent to our editing team. Follow your portal for updates: {{portal_link}}",
  );
  const [emailBrideDayAfterEnabled, setEmailBrideDayAfterEnabled] =
    useState(false);
  const [emailBrideDayAfterSubject, setEmailBrideDayAfterSubject] = useState(
    "Congratulations from {{company_name}}, {{bride_name}}!",
  );
  const [emailBrideDayAfterTemplate, setEmailBrideDayAfterTemplate] = useState(
    getBaseEmailTemplate(
      "Congratulations, Newlyweds!",
      "<p>Hi {{bride_name}},</p><p>It was an absolute honor to be part of your wedding yesterday. We hope you're soaking in every moment of this new chapter together.</p><p>Your photos and video footage are currently being uploaded and will be sent to our editing team shortly. We carefully curate every frame to tell your story beautifully — this process typically takes a few weeks.</p><p>You can follow along in your Bride Hub for real-time updates on your project status.</p>",
      "Track My Project",
      "{{portal_link}}",
      "Don't forget to change your name on your social media profiles, update your address with the post office, and send your thank-you notes within three months. Enjoy this season — it goes fast!",
    ),
  );

  const [smsBrideGiftEnabled, setSmsBrideGiftEnabled] = useState(false);
  const [smsBrideGiftTemplate, setSmsBrideGiftTemplate] = useState(
    "Hi {{bride_name}}, you just received a gift of ${{amount}} towards your wedding! Check your portal for details: {{portal_link}}",
  );
  const [emailBrideGiftEnabled, setEmailBrideGiftEnabled] = useState(false);
  const [emailBrideGiftSubject, setEmailBrideGiftSubject] = useState(
    "Someone sent you a wedding gift!",
  );
  const [emailBrideGiftTemplate, setEmailBrideGiftTemplate] = useState(
    getBaseEmailTemplate(
      "You Received a Wedding Gift",
      "<p>Hi {{bride_name}},</p><p>Someone who loves you just sent a gift of <strong>${{amount}}</strong> towards your wedding with {{company_name}}.</p><p>This gift has been automatically applied to your account balance, bringing you one step closer to your dream wedding coverage. You can view your updated balance in your Bride Hub.</p><p>What a beautiful way to celebrate your love story.</p>",
      "View My Balance",
      "{{portal_link}}",
      "Wedding gifts from loved ones are a wonderful way to offset costs. Consider sharing your portal link with family who may want to contribute — many couples are surprised by the generosity they receive.",
    ),
  );

  // Editor Templates
  const [smsEditorAssignedEnabled, setSmsEditorAssignedEnabled] =
    useState(false);
  const [smsEditorAssignedTemplate, setSmsEditorAssignedTemplate] = useState(
    "Hi {{editor_name}}, you have been assigned to edit the {{wedding_name}} wedding! Check your {{company_name}} portal for details: {{portal_link}}",
  );
  const [smsEditorRawMediaEnabled, setSmsEditorRawMediaEnabled] =
    useState(false);
  const [smsEditorRawMediaTemplate, setSmsEditorRawMediaTemplate] = useState(
    "Hi {{editor_name}}, the raw media for {{wedding_name}} is uploaded and ready to edit! You can start working on it in your portal: {{portal_link}}",
  );
  const [smsEditorRevisionsEnabled, setSmsEditorRevisionsEnabled] =
    useState(false);
  const [smsEditorRevisionsTemplate, setSmsEditorRevisionsTemplate] = useState(
    "Hi {{editor_name}}, revisions have been requested for the {{wedding_name}} wedding. Please check the portal for feedback: {{portal_link}}",
  );
  const [smsEditorPayoutEnabled, setSmsEditorPayoutEnabled] = useState(false);
  const [smsEditorPayoutTemplate, setSmsEditorPayoutTemplate] = useState(
    "Great news {{editor_name}}! Your payout of ${{amount}} for the {{wedding_name}} edit has been processed.",
  );
  const [smsEditorInviteEnabled, setSmsEditorInviteEnabled] = useState(false);
  const [smsEditorInviteTemplate, setSmsEditorInviteTemplate] = useState(
    "Hi {{editor_name}}, you've been invited to join the {{company_name}} editing team! Your temporary password is: {{temp_password}}. Log in here: {{setup_link}}",
  );
  const [smsEditorResetEnabled, setSmsEditorResetEnabled] = useState(false);
  const [smsEditorResetTemplate, setSmsEditorResetTemplate] = useState(
    "Hi {{editor_name}}, a password reset was requested for your editor account. Please check your email for the secure link.",
  );

  const [emailEditorInviteEnabled, setEmailEditorInviteEnabled] =
    useState(false);
  const [emailEditorInviteSubject, setEmailEditorInviteSubject] = useState(
    "You've been invited as an Editor!",
  );
  const [emailEditorInviteTemplate, setEmailEditorInviteTemplate] = useState(
    getBaseEmailTemplate(
      "Editor Invitation",
      '<p>Hi {{editor_name}},</p><p>You\'ve been invited to join the {{company_name}} editing team! Set up your account to start receiving editing assignments.</p><div style="background: #f4f4f5; padding: 14px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 1px; text-align: center; margin: 24px 0;"><strong>{{temp_password}}</strong></div><p><em>Please make sure to change your password from your Profile page after logging in.</em></p>',
      "Log In & Change Password",
      "{{setup_link}}",
    ),
  );
  const [emailEditorResetEnabled, setEmailEditorResetEnabled] = useState(false);
  const [emailEditorResetSubject, setEmailEditorResetSubject] = useState(
    "Editor Password Reset Request",
  );
  const [emailEditorResetTemplate, setEmailEditorResetTemplate] = useState(
    getBaseEmailTemplate(
      "Editor Password Reset",
      "<p>Hi {{editor_name}},</p><p>A password reset was requested for your Editor account. Please check your email inbox for the secure password reset link from our system. If you didn't request this, you can safely ignore this email.</p>",
    ),
  );
  const [emailEditorAssignedEnabled, setEmailEditorAssignedEnabled] =
    useState(false);
  const [emailEditorAssignedSubject, setEmailEditorAssignedSubject] = useState(
    "New Editing Assignment: {{wedding_name}}",
  );
  const [emailEditorAssignedTemplate, setEmailEditorAssignedTemplate] =
    useState(
      getBaseEmailTemplate(
        "New Editing Assignment",
        "<p>Hi {{editor_name}},</p><p>You have been assigned to edit the <strong>{{wedding_name}}</strong> wedding!</p><p>Log in to your portal to view the details.</p>",
        "View Assignment",
        "{{portal_link}}",
      ),
    );
  const [emailEditorRawMediaEnabled, setEmailEditorRawMediaEnabled] =
    useState(false);
  const [emailEditorRawMediaSubject, setEmailEditorRawMediaSubject] = useState(
    "Raw Media Ready: {{wedding_name}}",
  );
  const [emailEditorRawMediaTemplate, setEmailEditorRawMediaTemplate] =
    useState(
      getBaseEmailTemplate(
        "Raw Media Ready",
        "<p>Hi {{editor_name}},</p><p>The raw media for the <strong>{{wedding_name}}</strong> wedding is uploaded and ready to edit!</p><p>You can start working on it in your portal.</p>",
        "View Portal",
        "{{portal_link}}",
      ),
    );
  const [emailEditorRevisionsEnabled, setEmailEditorRevisionsEnabled] =
    useState(false);
  const [emailEditorRevisionsSubject, setEmailEditorRevisionsSubject] =
    useState("Revisions Requested: {{wedding_name}}");
  const [emailEditorRevisionsTemplate, setEmailEditorRevisionsTemplate] =
    useState(
      getBaseEmailTemplate(
        "Revisions Requested",
        "<p>Hi {{editor_name}},</p><p>Revisions have been requested for the <strong>{{wedding_name}}</strong> wedding.</p><p>Please check the portal for feedback.</p>",
        "View Feedback",
        "{{portal_link}}",
      ),
    );
  const [emailEditorPayoutEnabled, setEmailEditorPayoutEnabled] =
    useState(false);
  const [emailEditorPayoutSubject, setEmailEditorPayoutSubject] = useState(
    "Editor Payout Processed",
  );
  const [emailEditorPayoutTemplate, setEmailEditorPayoutTemplate] = useState(
    getBaseEmailTemplate(
      "Payout Processed",
      "<p>Great news {{editor_name}}!</p><p>Your payout of <strong>${{amount}}</strong> for the <strong>{{wedding_name}}</strong> edit has been processed.</p><p>Thank you for your hard work!</p>",
    ),
  );

  // Admin Templates
  const [smsAdminApplicationEnabled, setSmsAdminApplicationEnabled] =
    useState(false);
  const [smsAdminApplicationTemplate, setSmsAdminApplicationTemplate] =
    useState(
      "New application received! {{contractor_name}} has applied for the {{role}} position in {{location}}.",
    );
  const [
    smsAdminAssignmentAcceptedEnabled,
    setSmsAdminAssignmentAcceptedEnabled,
  ] = useState(false);
  const [
    smsAdminAssignmentAcceptedTemplate,
    setSmsAdminAssignmentAcceptedTemplate,
  ] = useState(
    "Assignment accepted: {{contractor_name}} has accepted the {{role}} position for the {{wedding_name}} wedding on {{date}}.",
  );
  const [smsAdminRawMediaEnabled, setSmsAdminRawMediaEnabled] = useState(false);
  const [smsAdminRawMediaTemplate, setSmsAdminRawMediaTemplate] = useState(
    "Raw media uploaded! {{contractor_name}} has uploaded the raw media for the {{wedding_name}} wedding.",
  );
  const [smsAdminFeedbackEnabled, setSmsAdminFeedbackEnabled] = useState(false);
  const [smsAdminFeedbackTemplate, setSmsAdminFeedbackTemplate] = useState(
    "New client feedback! {{bride_name}} has submitted feedback for the {{wedding_name}} wedding.",
  );
  const [smsAdminEditCompletedEnabled, setSmsAdminEditCompletedEnabled] =
    useState(false);
  const [smsAdminEditCompletedTemplate, setSmsAdminEditCompletedTemplate] =
    useState(
      "Edit completed! {{editor_name}} has finished the edit for the {{wedding_name}} wedding.",
    );

  const [adminNotificationEmails, setAdminNotificationEmails] = useState("");
  const [smsAdminBookingEnabled, setSmsAdminBookingEnabled] = useState(false);
  const [smsAdminBookingTemplate, setSmsAdminBookingTemplate] = useState(
    "New booking! {{bride_name}} just booked the {{package_name}} package for {{wedding_date}} at {{venue}}. Amount: ${{amount}}.",
  );
  const [emailAdminBookingEnabled, setEmailAdminBookingEnabled] =
    useState(false);
  const [emailAdminBookingSubject, setEmailAdminBookingSubject] = useState(
    "New Booking: {{bride_name}} — {{wedding_date}}",
  );
  const [emailAdminBookingTemplate, setEmailAdminBookingTemplate] = useState(
    getBaseEmailTemplate(
      "New Booking Received",
      '<p>A new booking just came in.</p><div style="background: #faf7f2; border: 1px solid #e8e0d4; border-radius: 6px; padding: 22px 26px; margin: 24px 0;"><p style="margin: 0 0 14px; font-size: 15px;"><strong style="color: #c9a96e;">Client:</strong> {{bride_name}}<br><strong style="color: #c9a96e;">Email:</strong> {{client_email}}<br><strong style="color: #c9a96e;">Wedding Date:</strong> {{wedding_date}}<br><strong style="color: #c9a96e;">Venue:</strong> {{venue}}<br><strong style="color: #c9a96e;">Package:</strong> {{package_name}}<br><strong style="color: #c9a96e;">Amount Paid:</strong> ${{amount}}</p></div>',
      "View Wedding in Portal",
      "{{portal_link}}",
    ),
  );

  // Coupons & Pricing State
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: 10,
    max_uses: "" as string | number,
    expires_at: "",
  });

  const [photoPayRate, setPhotoPayRate] = useState<number | "">("");
  const [videoPayRate, setVideoPayRate] = useState<number | "">("");
  const [photoBidMin, setPhotoBidMin] = useState<number | "">("");
  const [photoBidMax, setPhotoBidMax] = useState<number | "">("");
  const [videoBidMin, setVideoBidMin] = useState<number | "">("");
  const [videoBidMax, setVideoBidMax] = useState<number | "">("");
  const [editorVideoPricing, setEditorVideoPricing] = useState<any[]>([]);
  const [isSavingRates, setIsSavingRates] = useState(false);

  const [regions, setRegions] = useState<string[]>([]);
  const [newRegion, setNewRegion] = useState("");

  const [pricingPackages, setPricingPackages] = useState<any[]>([]);
  const [pricingAddons, setPricingAddons] = useState<any[]>([]);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any | null>(null);
  const [editingAddon, setEditingAddon] = useState<any | null>(null);
  const [showArchivedPricing, setShowArchivedPricing] = useState(false);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number | "">("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [emailDeliveryMethod, setEmailDeliveryMethod] = useState<
    "webhook" | "smtp"
  >("webhook");
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);

  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [upcomingLogs, setUpcomingLogs] = useState<any[]>([]);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [templateTestEmail, setTemplateTestEmail] = useState("");
  const [testingTemplate, setTestingTemplate] = useState<string | null>(null);
  const [testPreviewData, setTestPreviewData] = useState<any>(null);
  const [testPreviewOpen, setTestPreviewOpen] = useState(false);
  const [logsTab, setLogsTab] = useState<"sms" | "upcoming" | "api">("sms");
  const [messageFilter, setMessageFilter] = useState<
    "all" | "success" | "error"
  >("all");
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  const handleRetryMessage = async (log: any) => {
    setIsRetrying(log.id);
    try {
      const isEmail = log.message.startsWith("[EMAIL:");
      let success = false;
      if (isEmail) {
        const subjectMatch = log.message.match(/\[EMAIL:\s*(.*?)\]/);
        const subject = subjectMatch
          ? subjectMatch[1]
          : `Message from ${companyName || "the Portal"}`;
        const body = log.message.replace(/\[EMAIL:\s*.*?\]\n/, "");
        success = await api.sendOvantaEmail(
          log.recipient_email,
          subject,
          body,
          undefined,
          true,
        );
      } else {
        success = await api.sendOvantaSms(
          log.recipient_email,
          log.message,
          undefined,
          true,
        );
      }

      if (success) {
        toast({
          title: "Retry Successful",
          description: "Message sent successfully.",
        });
        loadLogs();
      } else {
        throw new Error("Failed to send message.");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Retry Failed",
        description: err.message,
      });
    } finally {
      setIsRetrying(null);
    }
  };

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      if (logsTab === "sms") {
        const logs = await api.getSmsLogs();
        setSmsLogs(logs);
      } else if (logsTab === "upcoming") {
        const upcoming = await api.getUpcomingAutomations();
        setUpcomingLogs(upcoming);
      } else {
        const logs = await api.getApiLogs();
        setApiLogs(logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadLogs();
    loadCoupons();
  }, [logsTab]);

  const loadCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setCoupons(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCoupon = async () => {
    if (!newCoupon.code || !newCoupon.discount_value) {
      toast({
        title: "Error",
        description: "Code and discount value are required.",
        variant: "destructive",
      });
      return;
    }
    try {
      const { data, error } = await supabase
        .from("coupons")
        .insert({
          code: newCoupon.code.toUpperCase(),
          discount_type: newCoupon.discount_type,
          discount_value: Number(newCoupon.discount_value),
          max_uses: newCoupon.max_uses ? Number(newCoupon.max_uses) : null,
          expires_at: newCoupon.expires_at || null,
          current_uses: 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      setCoupons([data, ...coupons]);
      setIsAddingCoupon(false);
      setNewCoupon({
        code: "",
        discount_type: "percentage",
        discount_value: 10,
        max_uses: "",
        expires_at: "",
      });
      toast({ title: "Success", description: "Coupon created successfully." });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to create coupon.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
      setCoupons(coupons.filter((c) => c.id !== id));
      toast({ title: "Success", description: "Coupon deleted." });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to delete coupon.",
        variant: "destructive",
      });
    }
  };

  const toggleCouponStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      setCoupons(
        coupons.map((c) =>
          c.id === id ? { ...c, is_active: !currentStatus } : c,
        ),
      );
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to update coupon status.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    localStorage.setItem("veydra_company_name_preview", companyName);
  }, [companyName]);

  useEffect(() => {
    // Load local first for speed
    try {
      const savedLogoUrl = localStorage.getItem("veydra_logo_url");
      if (savedLogoUrl) setLogoUrl(savedLogoUrl);
      const savedCompanyName = localStorage.getItem("veydra_company_name");
      if (savedCompanyName) setCompanyName(savedCompanyName);
      const savedAppUrl = localStorage.getItem("veydra_app_url");
      if (savedAppUrl) setAppUrl(savedAppUrl);
    } catch (e) {}

    // Try to load from Supabase
    api
      .getPortalSettings()
      .then((settings: any) => {
        if (settings) {
          if (settings.company_name) {
            setCompanyName(settings.company_name);
          }
          if (settings.app_url) {
            setAppUrl(settings.app_url);
            try {
              localStorage.setItem("veydra_app_url", settings.app_url);
            } catch (e) {}
          }
          const logo = settings.logo_url || DEFAULT_LOGO_URL;
          setLogoUrl(logo);
          try {
            localStorage.setItem("veydra_logo_url", logo);
          } catch (e) {}

          // Load contractor upload credentials
          if (settings.upload_account_email)
            setUploadEmail(settings.upload_account_email);
          if (settings.upload_account_password)
            setUploadPassword(settings.upload_account_password);
          if (settings.upload_instructions)
            setUploadInstructions(settings.upload_instructions);

          // Load custom email colors
          if (settings.email_colors) {
            try {
              const parsed =
                typeof settings.email_colors === "string"
                  ? JSON.parse(settings.email_colors)
                  : settings.email_colors;
              const merged = { ...DEFAULT_EMAIL_COLORS, ...parsed };
              setEmailColors(merged);
              try {
                localStorage.setItem(
                  "veydra_email_colors",
                  JSON.stringify(merged),
                );
              } catch (e) {}
            } catch (e) {}
          } else {
            const stored = getEmailColors();
            setEmailColors(stored);
          }

          if (
            settings.sms_invite_enabled !== undefined &&
            settings.sms_invite_enabled !== null
          )
            setSmsInviteEnabled(settings.sms_invite_enabled);
          if (settings.sms_invite_template)
            setSmsInviteTemplate(settings.sms_invite_template);
          if (
            settings.sms_reset_enabled !== undefined &&
            settings.sms_reset_enabled !== null
          )
            setSmsResetEnabled(settings.sms_reset_enabled);
          if (settings.sms_reset_template)
            setSmsResetTemplate(settings.sms_reset_template);

          if (
            settings.email_invite_enabled !== undefined &&
            settings.email_invite_enabled !== null
          )
            setEmailInviteEnabled(settings.email_invite_enabled);
          if (settings.email_invite_subject)
            setEmailInviteSubject(settings.email_invite_subject);
          if (settings.email_invite_template)
            setEmailInviteTemplate(settings.email_invite_template);
          if (
            settings.email_reset_enabled !== undefined &&
            settings.email_reset_enabled !== null
          )
            setEmailResetEnabled(settings.email_reset_enabled);
          if (settings.email_reset_subject)
            setEmailResetSubject(settings.email_reset_subject);
          if (settings.email_reset_template)
            setEmailResetTemplate(settings.email_reset_template);

          if (
            settings.sms_assignment_enabled !== undefined &&
            settings.sms_assignment_enabled !== null
          ) {
            setSmsAssignmentEnabled(settings.sms_assignment_enabled);
          }
          if (settings.sms_assignment_template) {
            setSmsAssignmentTemplate(settings.sms_assignment_template);
          }
          if (
            settings.email_assignment_enabled !== undefined &&
            settings.email_assignment_enabled !== null
          ) {
            setEmailAssignmentEnabled(settings.email_assignment_enabled);
          }
          if (settings.email_assignment_subject)
            setEmailAssignmentSubject(settings.email_assignment_subject);
          if (settings.email_assignment_template)
            setEmailAssignmentTemplate(settings.email_assignment_template);

          if (
            settings.sms_new_job_enabled !== undefined &&
            settings.sms_new_job_enabled !== null
          ) {
            setSmsNewJobEnabled(settings.sms_new_job_enabled);
          }
          if (settings.sms_new_job_template) {
            setSmsNewJobTemplate(settings.sms_new_job_template);
          }
          if (
            settings.email_new_job_enabled !== undefined &&
            settings.email_new_job_enabled !== null
          ) {
            setEmailNewJobEnabled(settings.email_new_job_enabled);
          }
          if (settings.email_new_job_subject)
            setEmailNewJobSubject(settings.email_new_job_subject);
          if (settings.email_new_job_template)
            setEmailNewJobTemplate(settings.email_new_job_template);

          if (
            settings.sms_reminder_enabled !== undefined &&
            settings.sms_reminder_enabled !== null
          ) {
            setSmsReminderEnabled(settings.sms_reminder_enabled);
          }
          if (settings.contract_template) {
            setContractTemplate(settings.contract_template);
          }
          if ((settings as any).wedding_contract_template) {
            setWeddingContractTemplate(
              (settings as any).wedding_contract_template,
            );
          }
          if (settings.sms_reminder_template) {
            setSmsReminderTemplate(settings.sms_reminder_template);
          }
          if (
            settings.email_reminder_enabled !== undefined &&
            settings.email_reminder_enabled !== null
          ) {
            setEmailReminderEnabled(settings.email_reminder_enabled);
          }
          if (settings.email_reminder_subject)
            setEmailReminderSubject(settings.email_reminder_subject);
          if (settings.email_reminder_template)
            setEmailReminderTemplate(settings.email_reminder_template);

          if (
            settings.sms_reminder_hours !== undefined &&
            settings.sms_reminder_hours !== null
          ) {
            setSmsReminderHours(settings.sms_reminder_hours);
          }
          if (
            settings.sms_contractor_prep_enabled !== undefined &&
            settings.sms_contractor_prep_enabled !== null
          ) {
            setSmsContractorPrepEnabled(settings.sms_contractor_prep_enabled);
          }
          if (settings.sms_contractor_prep_template) {
            setSmsContractorPrepTemplate(settings.sms_contractor_prep_template);
          }
          if (
            settings.sms_contractor_prep_days !== undefined &&
            settings.sms_contractor_prep_days !== null
          ) {
            setSmsContractorPrepDays(settings.sms_contractor_prep_days);
          }
          if (
            settings.email_contractor_prep_enabled !== undefined &&
            settings.email_contractor_prep_enabled !== null
          ) {
            setEmailContractorPrepEnabled(
              settings.email_contractor_prep_enabled,
            );
          }
          if (settings.email_contractor_prep_subject)
            setEmailContractorPrepSubject(
              settings.email_contractor_prep_subject,
            );
          if (settings.email_contractor_prep_template)
            setEmailContractorPrepTemplate(
              settings.email_contractor_prep_template,
            );
          if (
            settings.sms_payout_enabled !== undefined &&
            settings.sms_payout_enabled !== null
          ) {
            setSmsPayoutEnabled(settings.sms_payout_enabled);
          }
          if (settings.sms_payout_template) {
            setSmsPayoutTemplate(settings.sms_payout_template);
          }
          if (
            settings.email_payout_enabled !== undefined &&
            settings.email_payout_enabled !== null
          ) {
            setEmailPayoutEnabled(settings.email_payout_enabled);
          }
          if (settings.email_payout_subject)
            setEmailPayoutSubject(settings.email_payout_subject);
          if (settings.email_payout_template)
            setEmailPayoutTemplate(settings.email_payout_template);

          if (
            settings.sms_outbid_enabled !== undefined &&
            settings.sms_outbid_enabled !== null
          ) {
            setSmsOutbidEnabled(settings.sms_outbid_enabled);
          }
          if (settings.sms_outbid_template) {
            setSmsOutbidTemplate(settings.sms_outbid_template);
          }
          if (
            settings.email_outbid_enabled !== undefined &&
            settings.email_outbid_enabled !== null
          ) {
            setEmailOutbidEnabled(settings.email_outbid_enabled);
          }
          if (settings.email_outbid_subject)
            setEmailOutbidSubject(settings.email_outbid_subject);
          if (settings.email_outbid_template)
            setEmailOutbidTemplate(settings.email_outbid_template);
          if (settings.sms_payout_template) {
            setSmsPayoutTemplate(settings.sms_payout_template);
          }
          if (
            settings.email_payout_enabled !== undefined &&
            settings.email_payout_enabled !== null
          ) {
            setEmailPayoutEnabled(settings.email_payout_enabled);
          }
          if (settings.email_payout_subject)
            setEmailPayoutSubject(settings.email_payout_subject);
          if (settings.email_payout_template)
            setEmailPayoutTemplate(settings.email_payout_template);
          if (
            settings.sms_bride_welcome_enabled !== undefined &&
            settings.sms_bride_welcome_enabled !== null
          ) {
            setSmsBrideWelcomeEnabled(settings.sms_bride_welcome_enabled);
          }
          if (settings.sms_bride_welcome_template) {
            setSmsBrideWelcomeTemplate(settings.sms_bride_welcome_template);
          }
          if (
            settings.email_bride_welcome_enabled !== undefined &&
            settings.email_bride_welcome_enabled !== null
          ) {
            setEmailBrideWelcomeEnabled(settings.email_bride_welcome_enabled);
          }
          if (settings.email_bride_welcome_subject)
            setEmailBrideWelcomeSubject(settings.email_bride_welcome_subject);
          if (settings.email_bride_welcome_template)
            setEmailBrideWelcomeTemplate(settings.email_bride_welcome_template);
          if (
            settings.sms_bride_songs_enabled !== undefined &&
            settings.sms_bride_songs_enabled !== null
          ) {
            setSmsBrideSongsEnabled(settings.sms_bride_songs_enabled);
          }
          if (settings.sms_bride_songs_template) {
            setSmsBrideSongsTemplate(settings.sms_bride_songs_template);
          }
          if (
            settings.email_bride_songs_enabled !== undefined &&
            settings.email_bride_songs_enabled !== null
          ) {
            setEmailBrideSongsEnabled(settings.email_bride_songs_enabled);
          }
          if (settings.email_bride_songs_subject)
            setEmailBrideSongsSubject(settings.email_bride_songs_subject);
          if (settings.email_bride_songs_template)
            setEmailBrideSongsTemplate(settings.email_bride_songs_template);
          if (
            settings.sms_bride_pre_wedding_enabled !== undefined &&
            settings.sms_bride_pre_wedding_enabled !== null
          ) {
            setSmsBridePreWeddingEnabled(
              settings.sms_bride_pre_wedding_enabled,
            );
          }
          if (settings.sms_bride_pre_wedding_template) {
            setSmsBridePreWeddingTemplate(
              settings.sms_bride_pre_wedding_template,
            );
          }
          if (
            settings.sms_bride_pre_wedding_hours !== undefined &&
            settings.sms_bride_pre_wedding_hours !== null
          ) {
            setSmsBridePreWeddingHours(settings.sms_bride_pre_wedding_hours);
          }
          if (
            settings.email_bride_pre_wedding_enabled !== undefined &&
            settings.email_bride_pre_wedding_enabled !== null
          ) {
            setEmailBridePreWeddingEnabled(
              settings.email_bride_pre_wedding_enabled,
            );
          }
          if (settings.email_bride_pre_wedding_subject)
            setEmailBridePreWeddingSubject(
              settings.email_bride_pre_wedding_subject,
            );
          if (settings.email_bride_pre_wedding_template)
            setEmailBridePreWeddingTemplate(
              settings.email_bride_pre_wedding_template,
            );

          if (
            settings.sms_bride_delivery_enabled !== undefined &&
            settings.sms_bride_delivery_enabled !== null
          ) {
            setSmsBrideDeliveryEnabled(settings.sms_bride_delivery_enabled);
          }
          if (settings.sms_bride_delivery_template) {
            setSmsBrideDeliveryTemplate(settings.sms_bride_delivery_template);
          }
          if (
            settings.email_bride_delivery_enabled !== undefined &&
            settings.email_bride_delivery_enabled !== null
          ) {
            setEmailBrideDeliveryEnabled(settings.email_bride_delivery_enabled);
          }
          if (settings.email_bride_delivery_subject)
            setEmailBrideDeliverySubject(settings.email_bride_delivery_subject);
          if (settings.email_bride_delivery_template)
            setEmailBrideDeliveryTemplate(
              settings.email_bride_delivery_template,
            );

          if (
            settings.sms_bride_rating_enabled !== undefined &&
            settings.sms_bride_rating_enabled !== null
          ) {
            setSmsBrideRatingEnabled(settings.sms_bride_rating_enabled);
          }
          if (settings.sms_bride_rating_template) {
            setSmsBrideRatingTemplate(settings.sms_bride_rating_template);
          }
          if (
            settings.email_bride_rating_enabled !== undefined &&
            settings.email_bride_rating_enabled !== null
          ) {
            setEmailBrideRatingEnabled(settings.email_bride_rating_enabled);
          }
          if (settings.email_bride_rating_subject)
            setEmailBrideRatingSubject(settings.email_bride_rating_subject);
          if (settings.email_bride_rating_template)
            setEmailBrideRatingTemplate(settings.email_bride_rating_template);

          if (
            settings.sms_bride_day_after_enabled !== undefined &&
            settings.sms_bride_day_after_enabled !== null
          ) {
            setSmsBrideDayAfterEnabled(settings.sms_bride_day_after_enabled);
          }
          if (settings.sms_bride_day_after_template) {
            setSmsBrideDayAfterTemplate(settings.sms_bride_day_after_template);
          }
          if (
            settings.email_bride_day_after_enabled !== undefined &&
            settings.email_bride_day_after_enabled !== null
          ) {
            setEmailBrideDayAfterEnabled(
              settings.email_bride_day_after_enabled,
            );
          }
          if (settings.email_bride_day_after_subject)
            setEmailBrideDayAfterSubject(
              settings.email_bride_day_after_subject,
            );
          if (settings.email_bride_day_after_template)
            setEmailBrideDayAfterTemplate(
              settings.email_bride_day_after_template,
            );

          if (
            settings.sms_bride_gift_enabled !== undefined &&
            settings.sms_bride_gift_enabled !== null
          ) {
            setSmsBrideGiftEnabled(settings.sms_bride_gift_enabled);
          }
          if (settings.sms_bride_gift_template) {
            setSmsBrideGiftTemplate(settings.sms_bride_gift_template);
          }
          if (
            settings.email_bride_gift_enabled !== undefined &&
            settings.email_bride_gift_enabled !== null
          ) {
            setEmailBrideGiftEnabled(settings.email_bride_gift_enabled);
          }
          if (settings.email_bride_gift_subject)
            setEmailBrideGiftSubject(settings.email_bride_gift_subject);
          if (settings.email_bride_gift_template)
            setEmailBrideGiftTemplate(settings.email_bride_gift_template);

          if (
            settings.sms_editor_assigned_enabled !== undefined &&
            settings.sms_editor_assigned_enabled !== null
          )
            setSmsEditorAssignedEnabled(settings.sms_editor_assigned_enabled);
          if (settings.sms_editor_assigned_template)
            setSmsEditorAssignedTemplate(settings.sms_editor_assigned_template);
          if (
            settings.sms_editor_raw_media_enabled !== undefined &&
            settings.sms_editor_raw_media_enabled !== null
          )
            setSmsEditorRawMediaEnabled(settings.sms_editor_raw_media_enabled);
          if (settings.sms_editor_raw_media_template)
            setSmsEditorRawMediaTemplate(
              settings.sms_editor_raw_media_template,
            );
          if (
            settings.sms_editor_revisions_enabled !== undefined &&
            settings.sms_editor_revisions_enabled !== null
          )
            setSmsEditorRevisionsEnabled(settings.sms_editor_revisions_enabled);
          if (settings.sms_editor_revisions_template)
            setSmsEditorRevisionsTemplate(
              settings.sms_editor_revisions_template,
            );
          if (
            settings.sms_editor_payout_enabled !== undefined &&
            settings.sms_editor_payout_enabled !== null
          )
            setSmsEditorPayoutEnabled(settings.sms_editor_payout_enabled);
          if (settings.sms_editor_payout_template)
            setSmsEditorPayoutTemplate(settings.sms_editor_payout_template);

          if (
            settings.sms_editor_invite_enabled !== undefined &&
            settings.sms_editor_invite_enabled !== null
          )
            setSmsEditorInviteEnabled(settings.sms_editor_invite_enabled);
          if (settings.sms_editor_invite_template)
            setSmsEditorInviteTemplate(settings.sms_editor_invite_template);
          if (
            settings.sms_editor_reset_enabled !== undefined &&
            settings.sms_editor_reset_enabled !== null
          )
            setSmsEditorResetEnabled(settings.sms_editor_reset_enabled);
          if (settings.sms_editor_reset_template)
            setSmsEditorResetTemplate(settings.sms_editor_reset_template);

          if (
            settings.email_editor_invite_enabled !== undefined &&
            settings.email_editor_invite_enabled !== null
          )
            setEmailEditorInviteEnabled(settings.email_editor_invite_enabled);
          if (settings.email_editor_invite_subject)
            setEmailEditorInviteSubject(settings.email_editor_invite_subject);
          if (settings.email_editor_invite_template)
            setEmailEditorInviteTemplate(settings.email_editor_invite_template);
          if (
            settings.email_editor_reset_enabled !== undefined &&
            settings.email_editor_reset_enabled !== null
          )
            setEmailEditorResetEnabled(settings.email_editor_reset_enabled);
          if (settings.email_editor_reset_subject)
            setEmailEditorResetSubject(settings.email_editor_reset_subject);
          if (settings.email_editor_reset_template)
            setEmailEditorResetTemplate(settings.email_editor_reset_template);
          if (
            settings.email_editor_assigned_enabled !== undefined &&
            settings.email_editor_assigned_enabled !== null
          )
            setEmailEditorAssignedEnabled(
              settings.email_editor_assigned_enabled,
            );
          if (settings.email_editor_assigned_subject)
            setEmailEditorAssignedSubject(
              settings.email_editor_assigned_subject,
            );
          if (settings.email_editor_assigned_template)
            setEmailEditorAssignedTemplate(
              settings.email_editor_assigned_template,
            );
          if (
            settings.email_editor_raw_media_enabled !== undefined &&
            settings.email_editor_raw_media_enabled !== null
          )
            setEmailEditorRawMediaEnabled(
              settings.email_editor_raw_media_enabled,
            );
          if (settings.email_editor_raw_media_subject)
            setEmailEditorRawMediaSubject(
              settings.email_editor_raw_media_subject,
            );
          if (settings.email_editor_raw_media_template)
            setEmailEditorRawMediaTemplate(
              settings.email_editor_raw_media_template,
            );
          if (
            settings.email_editor_revisions_enabled !== undefined &&
            settings.email_editor_revisions_enabled !== null
          )
            setEmailEditorRevisionsEnabled(
              settings.email_editor_revisions_enabled,
            );
          if (settings.email_editor_revisions_subject)
            setEmailEditorRevisionsSubject(
              settings.email_editor_revisions_subject,
            );
          if (settings.email_editor_revisions_template)
            setEmailEditorRevisionsTemplate(
              settings.email_editor_revisions_template,
            );
          if (
            settings.email_editor_payout_enabled !== undefined &&
            settings.email_editor_payout_enabled !== null
          )
            setEmailEditorPayoutEnabled(settings.email_editor_payout_enabled);
          if (settings.email_editor_payout_subject)
            setEmailEditorPayoutSubject(settings.email_editor_payout_subject);
          if (settings.email_editor_payout_template)
            setEmailEditorPayoutTemplate(settings.email_editor_payout_template);

          if (
            settings.sms_admin_application_enabled !== undefined &&
            settings.sms_admin_application_enabled !== null
          )
            setSmsAdminApplicationEnabled(
              settings.sms_admin_application_enabled,
            );
          if (settings.sms_admin_application_template)
            setSmsAdminApplicationTemplate(
              settings.sms_admin_application_template,
            );
          if (
            settings.sms_admin_assignment_accepted_enabled !== undefined &&
            settings.sms_admin_assignment_accepted_enabled !== null
          )
            setSmsAdminAssignmentAcceptedEnabled(
              settings.sms_admin_assignment_accepted_enabled,
            );
          if (settings.sms_admin_assignment_accepted_template)
            setSmsAdminAssignmentAcceptedTemplate(
              settings.sms_admin_assignment_accepted_template,
            );
          if (
            settings.sms_admin_raw_media_enabled !== undefined &&
            settings.sms_admin_raw_media_enabled !== null
          )
            setSmsAdminRawMediaEnabled(settings.sms_admin_raw_media_enabled);
          if (settings.sms_admin_raw_media_template)
            setSmsAdminRawMediaTemplate(settings.sms_admin_raw_media_template);
          if (
            settings.sms_admin_feedback_enabled !== undefined &&
            settings.sms_admin_feedback_enabled !== null
          )
            setSmsAdminFeedbackEnabled(settings.sms_admin_feedback_enabled);
          if (settings.sms_admin_feedback_template)
            setSmsAdminFeedbackTemplate(settings.sms_admin_feedback_template);
          if (
            settings.sms_admin_edit_completed_enabled !== undefined &&
            settings.sms_admin_edit_completed_enabled !== null
          )
            setSmsAdminEditCompletedEnabled(
              settings.sms_admin_edit_completed_enabled,
            );
          if (settings.sms_admin_edit_completed_template)
            setSmsAdminEditCompletedTemplate(
              settings.sms_admin_edit_completed_template,
            );

          if (settings.admin_notification_emails)
            setAdminNotificationEmails(settings.admin_notification_emails);
          if (
            settings.sms_admin_booking_enabled !== undefined &&
            settings.sms_admin_booking_enabled !== null
          )
            setSmsAdminBookingEnabled(settings.sms_admin_booking_enabled);
          if (settings.sms_admin_booking_template)
            setSmsAdminBookingTemplate(settings.sms_admin_booking_template);
          if (
            settings.email_admin_booking_enabled !== undefined &&
            settings.email_admin_booking_enabled !== null
          )
            setEmailAdminBookingEnabled(settings.email_admin_booking_enabled);
          if (settings.email_admin_booking_subject)
            setEmailAdminBookingSubject(settings.email_admin_booking_subject);
          if (settings.email_admin_booking_template)
            setEmailAdminBookingTemplate(settings.email_admin_booking_template);

          if (settings.hl_api_key) setHlApiKey(settings.hl_api_key);
          if (settings.hl_location_id) setHlLocationId(settings.hl_location_id);
          if (settings.fb_access_token)
            setFbAccessToken(settings.fb_access_token);
          if (settings.fb_ad_account_id)
            setFbAdAccountId(settings.fb_ad_account_id);
          if (settings.timezone) setTimezone(settings.timezone);
          if (settings.photo_pay_rate) setPhotoPayRate(settings.photo_pay_rate);
          if (settings.video_pay_rate) setVideoPayRate(settings.video_pay_rate);
          if (settings.photo_bid_min) setPhotoBidMin(settings.photo_bid_min);
          if (settings.photo_bid_max) setPhotoBidMax(settings.photo_bid_max);
          if (settings.video_bid_min) setVideoBidMin(settings.video_bid_min);
          if (settings.video_bid_max) setVideoBidMax(settings.video_bid_max);
          if (settings.editor_video_pricing) {
            try {
              setEditorVideoPricing(
                typeof settings.editor_video_pricing === "string"
                  ? JSON.parse(settings.editor_video_pricing)
                  : settings.editor_video_pricing,
              );
            } catch (e) {}
          }
          if (settings.regions) setRegions(settings.regions);

          if (settings.smtp_host) setSmtpHost(settings.smtp_host);
          if (settings.smtp_port) setSmtpPort(settings.smtp_port);
          if (settings.smtp_user) setSmtpUser(settings.smtp_user);
          if (settings.smtp_pass) setSmtpPass(settings.smtp_pass);
          if (settings.smtp_from_email)
            setSmtpFromEmail(settings.smtp_from_email);
          if (settings.smtp_from_name) setSmtpFromName(settings.smtp_from_name);
          if (settings.email_delivery_method)
            setEmailDeliveryMethod(settings.email_delivery_method);
        }
      })
      .catch((err) => console.error("Error fetching settings:", err));

    // Auto-check Stripe connection status on load
    checkStripeStatus();

    try {
      const savedRegions = localStorage.getItem("veydra_regions");
      if (savedRegions) {
        try {
          setRegions(JSON.parse(savedRegions));
        } catch (e) {
          setRegions(["Charlotte", "Raleigh"]);
        }
      } else {
        setRegions(["Charlotte", "Raleigh"]);
        try {
          localStorage.setItem(
            "veydra_regions",
            JSON.stringify(["Charlotte", "Raleigh"]),
          );
        } catch (e) {}
      }
    } catch (e) {
      setRegions(["Charlotte", "Raleigh"]);
    }
  }, []);

  // Load pricing packages & addons
  const loadPricing = async () => {
    setIsLoadingPricing(true);
    try {
      const [pkgs, adns] = await Promise.all([
        api.getPackages(true),
        api.getAddons(true),
      ]);
      setPricingPackages(pkgs);
      setPricingAddons(adns);
    } catch (err) {
      console.error("Error loading pricing:", err);
    } finally {
      setIsLoadingPricing(false);
    }
  };

  useEffect(() => {
    loadPricing();
  }, []);

  const handleSavePackage = async (pkg: any) => {
    setIsSavingPricing(true);
    try {
      await api.savePackage(pkg);
      await loadPricing();
      setEditingPackage(null);
      toast({
        title: "Package saved",
        description: `${pkg.name} has been saved.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleDuplicatePackage = (pkg: any) => {
    setEditingPackage({
      name: `${pkg.name} (Copy)`,
      desc: pkg.desc || "",
      priceBoth: pkg.priceBoth || 0,
      priceSingle: pkg.priceSingle || 0,
      photoFeatures: [...(pkg.photoFeatures || [])],
      videoFeatures: [...(pkg.videoFeatures || [])],
      isArchived: false,
      // explicitly no id — will generate a new unique one on save
    });
    toast({
      title: "Package duplicated",
      description: "Edit the copy and save to create a new package.",
    });
  };

  const handleDeletePackage = async (id: string) => {
    if (
      !confirm(
        "Delete this package? Existing proposals that reference it will keep their snapshot.",
      )
    )
      return;
    try {
      await api.deletePackage(id);
      await loadPricing();
      toast({ title: "Package deleted" });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const handleSaveAddon = async (addon: any) => {
    setIsSavingPricing(true);
    try {
      await api.saveAddon(addon);
      await loadPricing();
      setEditingAddon(null);
      toast({
        title: "Addon saved",
        description: `${addon.name} has been saved.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleDeleteAddon = async (id: string) => {
    if (
      !confirm(
        "Delete this addon? Existing proposals that reference it will keep their snapshot.",
      )
    )
      return;
    try {
      await api.deleteAddon(id);
      await loadPricing();
      toast({ title: "Addon deleted" });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false);

  const handleTestApiConnection = async () => {
    if (!hlApiKey || !hlLocationId) {
      toast({
        variant: "destructive",
        title: "Missing Credentials",
        description: "Please enter both an API Key and Location ID.",
      });
      return;
    }

    setIsTestingApi(true);
    try {
      const response = await fetch(
        `https://services.leadconnectorhq.com/locations/${hlLocationId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${hlApiKey}`,
            Version: "2021-07-28",
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();

      toast({
        title: "Connection Successful! 🎉",
        description: `Successfully connected to location: ${data.location?.name || hlLocationId}`,
      });
    } catch (error: any) {
      console.error("API Test Failed:", error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description:
          error.message ||
          "Failed to connect to the Ovanta API. Please check your credentials.",
      });
    } finally {
      setIsTestingApi(false);
    }
  };
  const handleTestFbApiConnection = async () => {
    const cleanToken = fbAccessToken?.trim();
    const cleanAccountId = fbAdAccountId?.trim();

    if (!cleanToken || !cleanAccountId) {
      toast({
        variant: "destructive",
        title: "Missing Credentials",
        description: "Please enter both a Meta Access Token and Ad Account ID.",
      });
      return;
    }

    setIsTestingFbApi(true);
    try {
      // Strip any accidental 'act_' duplication or whitespace
      const numericId = cleanAccountId.replace(/^act_/, "").trim();
      const formattedAccountId = `act_${numericId}`;

      const response = await fetch(
        `https://graph.facebook.com/v19.0/${formattedAccountId}?fields=name,account_status,currency&access_token=${encodeURIComponent(cleanToken)}`,
      );

      if (!response.ok) {
        const errData = await response.json();
        const msg = errData.error?.message || `API returned ${response.status}`;
        if (msg.includes("Session has expired") || msg.includes("OAuth")) {
          throw new Error(
            "Token expired or invalid. Please generate a new Access Token in Meta Graph API Explorer or System Users.",
          );
        }
        if (
          msg.includes("Unsupported get request") ||
          msg.includes("Object with ID")
        ) {
          throw new Error(
            "Ad Account ID not found. Ensure your account ID is correct and your token has permissions for this ad account.",
          );
        }
        throw new Error(msg);
      }

      const data = await response.json();

      toast({
        title: "Facebook Connection Successful! 🎉",
        description: `Successfully connected to Ad Account: ${data.name || formattedAccountId} (${data.currency || "USD"})`,
      });
    } catch (error: any) {
      console.error("FB API Test Failed:", error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description:
          error.message ||
          "Failed to connect to the Facebook Graph API. Please check your token and account ID.",
      });
    } finally {
      setIsTestingFbApi(false);
    }
  };

  const checkStripeStatus = async () => {
    setIsCheckingStripe(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[Stripe Status] HTTP Error:", res.status, errText);

        // Show helpful message based on status code
        if (res.status === 404) {
          toast({
            variant: "destructive",
            title: "Stripe Function Not Deployed",
            description:
              "The stripe-status edge function doesn't exist on this instance yet. You need to create it in Supabase Dashboard > Edge Functions.",
          });
        } else if (res.status === 401 || res.status === 403) {
          toast({
            variant: "destructive",
            title: "Auth Error",
            description: "Could not authenticate with your Supabase instance.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Stripe Check Failed",
            description: `Server returned ${res.status}: ${errText.slice(0, 200)}`,
          });
        }

        setStripeStatus({ connected: false });
        return;
      }

      const data = await res.json();
      console.log("[Stripe Status] Response:", data);
      setStripeStatus(data);

      if (!data.connected) {
        toast({
          title: "Stripe Not Configured",
          description:
            data.reason === "no_key"
              ? "STRIPE_SECRET_KEY environment variable not set on this instance."
              : data.reason === "invalid_key"
                ? "The STRIPE_SECRET_KEY is invalid or expired."
                : "Stripe connection failed. Check server logs for details.",
          variant: "default",
        });
      }
    } catch (err: any) {
      console.error("[Stripe Status] Fetch Error:", err);
      setStripeStatus({ connected: false });
      toast({
        variant: "destructive",
        title: "Connection Error",
        description:
          err.message ||
          "Failed to reach Stripe status endpoint. Check your internet connection and Supabase URL.",
      });
    } finally {
      setIsCheckingStripe(false);
    }
  };

  const handleTestSms = async () => {
    if (!testSmsEmail) {
      toast({
        variant: "destructive",
        title: "Missing Email",
        description: "Please enter a contractor's email to send the test SMS.",
      });
      return;
    }

    setIsTestingSms(true);
    try {
      const success = await sendOvantaSms(
        testSmsEmail,
        `This is a test SMS from your ${companyName || "portal"} integration!`,
        undefined,
        true,
      );
      if (success) {
        toast({
          title: "SMS Sent! 🎉",
          description: `Successfully sent test SMS to the contact associated with ${testSmsEmail}`,
        });
      } else {
        throw new Error(
          "Failed to send SMS. Ensure the contact exists in Ovanta and has a valid phone number.",
        );
      }
    } catch (error: any) {
      console.error("SMS Test Failed:", error);
      toast({
        variant: "destructive",
        title: "SMS Test Failed",
        description: error.message || "Failed to send SMS via Ovanta.",
      });
    } finally {
      setIsTestingSms(false);
    }
  };

  const handleTestTemplate = async (
    templateText: string,
    templateId: string,
    isEmail: boolean = false,
    subject: string = "",
  ) => {
    if (!templateTestEmail) {
      toast({
        variant: "destructive",
        title: "Missing Email",
        description:
          "Please enter a test email address in the templates section.",
      });
      return;
    }

    if (!hlApiKey || !hlLocationId) {
      toast({
        variant: "destructive",
        title: "Missing Credentials",
        description:
          "Please configure your Ovanta API credentials on the 'Integrations' tab first.",
      });
      return;
    }

    setTestingTemplate(templateId);
    try {
      const baseUrl = (appUrl || window.location.origin).replace(/\/$/, "");
      const parsedMessage = templateText
        .replace(/{{company_name}}/g, companyName || "Veydra")
        .replace(/{{logo_url}}/g, logoUrl || DEFAULT_LOGO_URL)
        .replace(/{{contractor_name}}/g, "Jane Doe")
        .replace(/{{manager_name}}/g, "Admin Alex")
        .replace(
          /{{setup_link}}/g,
          `${baseUrl}/setup-password?email=jane.doe@example.com&token=mock-secure-token-12345`,
        )
        .replace(/{{role}}/g, "Lead Videographer")
        .replace(/{{location}}/g, "Charlotte, NC")
        .replace(/{{date}}/g, "October 24, 2026")
        .replace(/{{amount}}/g, "500.00")
        .replace(/{{new_bid}}/g, "450.00")
        .replace(/{{bride_name}}/g, "Sarah")
        .replace(/{{wedding_name}}/g, "Smith & Johnson Wedding")
        .replace(/{{days}}/g, "5")
        .replace(/{{portal_link}}/g, `${baseUrl}/bride-portal/test-sample`)
        .replace(/{{arrival_time}}/g, "1:00 PM")
        .replace(/{{gallery_link}}/g, `${baseUrl}/gallery/sarah-john`)
        .replace(/{{feedback_link}}/g, `${baseUrl}/feedback/123`)
        .replace(/{{temp_password}}/g, "TestPass123!")
        .replace(/{{client_email}}/g, "sarah@example.com")
        .replace(/{{wedding_date}}/g, "October 24, 2026")
        .replace(/{{venue}}/g, "The Grand Ballroom");

      let success;
      if (isEmail) {
        const parsedSubject = subject
          .replace(/{{company_name}}/g, companyName || "Veydra")
          .replace(/{{manager_name}}/g, "Admin Alex")
          .replace(/{{contractor_name}}/g, "Jane Doe")
          .replace(/{{role}}/g, "Lead Videographer")
          .replace(/{{location}}/g, "Charlotte, NC")
          .replace(/{{date}}/g, "October 24, 2026");
        // Show preview modal for emails before sending
        setTestPreviewData({
          to: templateTestEmail,
          subject: parsedSubject || "Test Email",
          html: parsedMessage,
          sendFn: async () => {
            const ok = await sendOvantaEmail(
              templateTestEmail,
              parsedSubject || "Test Email",
              parsedMessage,
              undefined,
              true,
            );
            if (!ok) throw new Error("Failed to send Email.");
          },
        });
        setTestPreviewOpen(true);
        setTestingTemplate(null);
        return;
      } else {
        success = await sendOvantaSms(
          templateTestEmail,
          parsedMessage,
          undefined,
          true,
        );
      }

      if (success) {
        toast({
          title: isEmail ? "Test Email Sent! 🎉" : "Test SMS Sent! 🎉",
          description: `Successfully sent template test to ${templateTestEmail}`,
        });
      } else {
        throw new Error(
          isEmail
            ? "Failed to send Email."
            : "Failed to send SMS. Ensure the contact exists in Ovanta and has a valid phone number.",
        );
      }
    } catch (error: any) {
      console.error("Template Test Failed:", error);
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: error.message || "Failed to send via Ovanta.",
      });
    } finally {
      setTestingTemplate(null);
    }
  };

  const handleSaveIntegrations = async () => {
    if (isSavingIntegrations) return;
    setIsSavingIntegrations(true);
    try {
      const savePromise = api.updatePortalSettings({
        company_name: companyName || null,
        hl_api_key: hlApiKey || null,
        hl_location_id: hlLocationId || null,
        fb_access_token: fbAccessToken || null,
        fb_ad_account_id: fbAdAccountId || null,
        sms_invite_enabled: smsInviteEnabled,
        sms_invite_template: smsInviteTemplate || null,
        sms_reset_enabled: smsResetEnabled,
        sms_reset_template: smsResetTemplate || null,
        email_invite_enabled: emailInviteEnabled,
        email_invite_subject: emailInviteSubject || null,
        email_invite_template: emailInviteTemplate || null,
        email_reset_enabled: emailResetEnabled,
        email_reset_subject: emailResetSubject || null,
        email_reset_template: emailResetTemplate || null,
        sms_manager_invite_enabled: smsManagerInviteEnabled,
        sms_manager_invite_template: smsManagerInviteTemplate || null,
        sms_manager_reset_enabled: smsManagerResetEnabled,
        sms_manager_reset_template: smsManagerResetTemplate || null,
        email_manager_invite_enabled: emailManagerInviteEnabled,
        email_manager_invite_subject: emailManagerInviteSubject || null,
        email_manager_invite_template: emailManagerInviteTemplate || null,
        email_manager_reset_enabled: emailManagerResetEnabled,
        email_manager_reset_subject: emailManagerResetSubject || null,
        email_manager_reset_template: emailManagerResetTemplate || null,
        sms_assignment_enabled: smsAssignmentEnabled,
        sms_assignment_template: smsAssignmentTemplate || null,
        email_assignment_enabled: emailAssignmentEnabled,
        email_assignment_subject: emailAssignmentSubject || null,
        email_assignment_template: emailAssignmentTemplate || null,
        sms_new_job_enabled: smsNewJobEnabled,
        sms_new_job_template: smsNewJobTemplate || null,
        email_new_job_enabled: emailNewJobEnabled,
        email_new_job_subject: emailNewJobSubject || null,
        email_new_job_template: emailNewJobTemplate || null,
        email_pipeline_interview_enabled: emailPipelineInterviewEnabled,
        email_pipeline_interview_subject: emailPipelineInterviewSubject || null,
        email_pipeline_interview_template:
          emailPipelineInterviewTemplate || null,
        sms_pipeline_interview_enabled: smsPipelineInterviewEnabled,
        sms_pipeline_interview_template: smsPipelineInterviewTemplate || null,
        email_pipeline_paperwork_enabled: emailPipelinePaperworkEnabled,
        email_pipeline_paperwork_subject: emailPipelinePaperworkSubject || null,
        email_pipeline_paperwork_template:
          emailPipelinePaperworkTemplate || null,
        sms_pipeline_paperwork_enabled: smsPipelinePaperworkEnabled,
        sms_pipeline_paperwork_template: smsPipelinePaperworkTemplate || null,
        email_pipeline_hired_enabled: emailPipelineHiredEnabled,
        email_pipeline_hired_subject: emailPipelineHiredSubject || null,
        email_pipeline_hired_template: emailPipelineHiredTemplate || null,
        sms_pipeline_hired_enabled: smsPipelineHiredEnabled,
        sms_pipeline_hired_template: smsPipelineHiredTemplate || null,

        email_pipeline_rejected_enabled: emailPipelineRejectedEnabled,
        email_pipeline_rejected_subject: emailPipelineRejectedSubject || null,
        email_pipeline_rejected_template: emailPipelineRejectedTemplate || null,
        sms_pipeline_rejected_enabled: smsPipelineRejectedEnabled,
        sms_pipeline_rejected_template: smsPipelineRejectedTemplate || null,
        email_applicant_welcome_enabled: emailApplicantWelcomeEnabled,
        email_applicant_welcome_subject: emailApplicantWelcomeSubject || null,
        email_applicant_welcome_template: emailApplicantWelcomeTemplate || null,
        sms_applicant_welcome_enabled: smsApplicantWelcomeEnabled,
        sms_applicant_welcome_template: smsApplicantWelcomeTemplate || null,
        email_pipeline_gallery_enabled: emailPipelineGalleryEnabled,
        email_pipeline_gallery_subject: emailPipelineGallerySubject || null,
        email_pipeline_gallery_template: emailPipelineGalleryTemplate || null,
        sms_pipeline_gallery_enabled: smsPipelineGalleryEnabled,
        sms_pipeline_gallery_template: smsPipelineGalleryTemplate || null,
        email_doc_expiry_enabled: emailDocExpiryEnabled,
        email_doc_expiry_subject: emailDocExpirySubject || null,
        email_doc_expiry_template: emailDocExpiryTemplate || null,
        sms_doc_expiry_enabled: smsDocExpiryEnabled,
        sms_doc_expiry_template: smsDocExpiryTemplate || null,
        doc_expiry_reminder_days: docExpiryReminderDays,
        sms_reminder_enabled: smsReminderEnabled,
        sms_reminder_template: smsReminderTemplate || null,
        email_reminder_enabled: emailReminderEnabled,
        email_reminder_subject: emailReminderSubject || null,
        email_reminder_template: emailReminderTemplate || null,
        sms_reminder_hours: smsReminderHours,
        sms_contractor_prep_enabled: smsContractorPrepEnabled,
        sms_contractor_prep_template: smsContractorPrepTemplate || null,
        sms_contractor_prep_days: smsContractorPrepDays,
        email_contractor_prep_enabled: emailContractorPrepEnabled,
        email_contractor_prep_subject: emailContractorPrepSubject || null,
        email_contractor_prep_template: emailContractorPrepTemplate || null,
        sms_payout_enabled: smsPayoutEnabled,
        sms_payout_template: smsPayoutTemplate || null,
        email_payout_enabled: emailPayoutEnabled,
        email_payout_subject: emailPayoutSubject || null,
        email_payout_template: emailPayoutTemplate || null,
        sms_outbid_enabled: smsOutbidEnabled,
        sms_outbid_template: smsOutbidTemplate || null,
        email_outbid_enabled: emailOutbidEnabled,
        email_outbid_subject: emailOutbidSubject || null,
        email_outbid_template: emailOutbidTemplate || null,
        sms_bride_welcome_enabled: smsBrideWelcomeEnabled,
        sms_bride_welcome_template: smsBrideWelcomeTemplate || null,
        email_bride_welcome_enabled: emailBrideWelcomeEnabled,
        email_bride_welcome_subject: emailBrideWelcomeSubject || null,
        email_bride_welcome_template: emailBrideWelcomeTemplate || null,
        sms_bride_songs_enabled: smsBrideSongsEnabled,
        sms_bride_songs_template: smsBrideSongsTemplate || null,
        email_bride_songs_enabled: emailBrideSongsEnabled,
        email_bride_songs_subject: emailBrideSongsSubject || null,
        email_bride_songs_template: emailBrideSongsTemplate || null,
        sms_bride_pre_wedding_enabled: smsBridePreWeddingEnabled,
        sms_bride_pre_wedding_template: smsBridePreWeddingTemplate || null,
        sms_bride_pre_wedding_hours: smsBridePreWeddingHours,
        email_bride_pre_wedding_enabled: emailBridePreWeddingEnabled,
        email_bride_pre_wedding_subject: emailBridePreWeddingSubject || null,
        email_bride_pre_wedding_template: emailBridePreWeddingTemplate || null,
        sms_bride_delivery_enabled: smsBrideDeliveryEnabled,
        sms_bride_delivery_template: smsBrideDeliveryTemplate || null,
        email_bride_delivery_enabled: emailBrideDeliveryEnabled,
        email_bride_delivery_subject: emailBrideDeliverySubject || null,
        email_bride_delivery_template: emailBrideDeliveryTemplate || null,
        sms_bride_rating_enabled: smsBrideRatingEnabled,
        sms_bride_rating_template: smsBrideRatingTemplate || null,
        email_bride_rating_enabled: emailBrideRatingEnabled,
        email_bride_rating_subject: emailBrideRatingSubject || null,
        email_bride_rating_template: emailBrideRatingTemplate || null,
        sms_bride_day_after_enabled: smsBrideDayAfterEnabled,
        sms_bride_day_after_template: smsBrideDayAfterTemplate || null,
        email_bride_day_after_enabled: emailBrideDayAfterEnabled,
        email_bride_day_after_subject: emailBrideDayAfterSubject || null,
        email_bride_day_after_template: emailBrideDayAfterTemplate || null,
        sms_bride_gift_enabled: smsBrideGiftEnabled,
        sms_bride_gift_template: smsBrideGiftTemplate || null,
        email_bride_gift_enabled: emailBrideGiftEnabled,
        email_bride_gift_subject: emailBrideGiftSubject || null,
        email_bride_gift_template: emailBrideGiftTemplate || null,
        email_payment_failed_enabled: emailPaymentFailedEnabled,
        sms_editor_assigned_enabled: smsEditorAssignedEnabled,
        sms_editor_assigned_template: smsEditorAssignedTemplate || null,
        sms_editor_raw_media_enabled: smsEditorRawMediaEnabled,
        sms_editor_raw_media_template: smsEditorRawMediaTemplate || null,
        sms_editor_revisions_enabled: smsEditorRevisionsEnabled,
        sms_editor_revisions_template: smsEditorRevisionsTemplate || null,
        sms_editor_payout_enabled: smsEditorPayoutEnabled,
        sms_editor_payout_template: smsEditorPayoutTemplate || null,
        sms_editor_invite_enabled: smsEditorInviteEnabled,
        sms_editor_invite_template: smsEditorInviteTemplate || null,
        sms_editor_reset_enabled: smsEditorResetEnabled,
        sms_editor_reset_template: smsEditorResetTemplate || null,
        email_editor_invite_enabled: emailEditorInviteEnabled,
        email_editor_invite_subject: emailEditorInviteSubject || null,
        email_editor_invite_template: emailEditorInviteTemplate || null,
        email_editor_reset_enabled: emailEditorResetEnabled,
        email_editor_reset_subject: emailEditorResetSubject || null,
        email_editor_reset_template: emailEditorResetTemplate || null,
        email_editor_assigned_enabled: emailEditorAssignedEnabled,
        email_editor_assigned_subject: emailEditorAssignedSubject || null,
        email_editor_assigned_template: emailEditorAssignedTemplate || null,
        email_editor_raw_media_enabled: emailEditorRawMediaEnabled,
        email_editor_raw_media_subject: emailEditorRawMediaSubject || null,
        email_editor_raw_media_template: emailEditorRawMediaTemplate || null,
        email_editor_revisions_enabled: emailEditorRevisionsEnabled,
        email_editor_revisions_subject: emailEditorRevisionsSubject || null,
        email_editor_revisions_template: emailEditorRevisionsTemplate || null,
        email_editor_payout_enabled: emailEditorPayoutEnabled,
        email_editor_payout_subject: emailEditorPayoutSubject || null,
        email_editor_payout_template: emailEditorPayoutTemplate || null,
        sms_admin_application_enabled: smsAdminApplicationEnabled,
        sms_admin_application_template: smsAdminApplicationTemplate || null,
        sms_admin_assignment_accepted_enabled:
          smsAdminAssignmentAcceptedEnabled,
        sms_admin_assignment_accepted_template:
          smsAdminAssignmentAcceptedTemplate || null,
        sms_admin_raw_media_enabled: smsAdminRawMediaEnabled,
        sms_admin_raw_media_template: smsAdminRawMediaTemplate || null,
        sms_admin_feedback_enabled: smsAdminFeedbackEnabled,
        sms_admin_feedback_template: smsAdminFeedbackTemplate || null,
        sms_admin_edit_completed_enabled: smsAdminEditCompletedEnabled,
        sms_admin_edit_completed_template:
          smsAdminEditCompletedTemplate || null,
        admin_notification_emails: adminNotificationEmails || null,
        sms_admin_booking_enabled: smsAdminBookingEnabled,
        sms_admin_booking_template: smsAdminBookingTemplate || null,
        email_admin_booking_enabled: emailAdminBookingEnabled,
        email_admin_booking_subject: emailAdminBookingSubject || null,
        email_admin_booking_template: emailAdminBookingTemplate || null,
      });

      await savePromise;

      toast({
        title: "Integrations Saved",
        description:
          "Webhook URLs and API settings have been updated successfully.",
      });
    } catch (e: any) {
      console.error("Error saving integrations:", e);
      toast({
        variant: "destructive",
        title: "Error saving integrations",
        description: e?.message || "Could not save settings. Please try again.",
      });
    } finally {
      setIsSavingIntegrations(false);
    }
  };

  const handleSaveRates = async () => {
    setIsSavingRates(true);
    try {
      if (photoPayRate !== "")
        try {
          localStorage.setItem(
            "veydra_photo_pay_rate",
            photoPayRate.toString(),
          );
        } catch (e) {}
      if (videoPayRate !== "")
        try {
          localStorage.setItem(
            "veydra_video_pay_rate",
            videoPayRate.toString(),
          );
        } catch (e) {}

      await api.updatePortalSettings({
        photo_pay_rate: photoPayRate === "" ? null : Number(photoPayRate),
        video_pay_rate: videoPayRate === "" ? null : Number(videoPayRate),
        photo_bid_min: photoBidMin === "" ? null : Number(photoBidMin),
        photo_bid_max: photoBidMax === "" ? null : Number(photoBidMax),
        video_bid_min: videoBidMin === "" ? null : Number(videoBidMin),
        video_bid_max: videoBidMax === "" ? null : Number(videoBidMax),
        editor_video_pricing: JSON.stringify(editorVideoPricing),
      });
      toast({
        title: "Pay Rates Saved",
        description: "Global pay rates have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving pay rates",
        description: error.message || "Could not save the pay rates.",
      });
    } finally {
      setIsSavingRates(false);
    }
  };

  const handleSaveTimezone = async () => {
    setIsSavingTimezone(true);
    try {
      try {
        localStorage.setItem("veydra_timezone", timezone);
      } catch (e) {}
      await api.updatePortalSettings({ timezone });
      toast({
        title: "Timezone Saved",
        description: "Company timezone has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving timezone",
        description: error.message || "Could not save the timezone setting.",
      });
    } finally {
      setIsSavingTimezone(false);
    }
  };

  const handleSaveSmtp = async () => {
    setIsSavingSmtp(true);
    try {
      await api.updatePortalSettings({
        smtp_host: smtpHost || null,
        smtp_port: smtpPort === "" ? null : Number(smtpPort),
        smtp_user: smtpUser || null,
        smtp_pass: smtpPass || null,
        smtp_from_email: smtpFromEmail || null,
        smtp_from_name: smtpFromName || null,
        email_delivery_method: emailDeliveryMethod,
      });
      toast({
        title: "Email Settings Saved",
        description: "Your email configuration has been securely saved.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving SMTP",
        description:
          error.message ||
          "Could not save the SMTP settings. Make sure the columns exist in Supabase.",
      });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      if (logoUrl) {
        try {
          localStorage.setItem("veydra_logo_url", logoUrl);
        } catch (e) {}
      } else {
        try {
          localStorage.removeItem("veydra_logo_url");
        } catch (e) {}
      }

      if (companyName) {
        try {
          localStorage.setItem("veydra_company_name", companyName);
        } catch (e) {}
      }

      if (appUrl) {
        try {
          localStorage.setItem("veydra_app_url", appUrl);
        } catch (e) {}
      } else {
        try {
          localStorage.removeItem("veydra_app_url");
        } catch (e) {}
      }

      await api.updatePortalSettings({
        logo_url: logoUrl || null,
        company_name: companyName || null,
        app_url: appUrl || null,
        upload_account_email: uploadEmail || null,
        upload_account_password: uploadPassword || null,
        upload_instructions: uploadInstructions || null,
      });

      toast({
        title: "Branding Saved",
        description: "Your company branding has been updated globally.",
      });

      window.dispatchEvent(new Event("logo-updated"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving branding",
        description:
          error.message ||
          "Have you created the portal_settings table in Supabase yet?",
      });
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleSaveEmailColors = async () => {
    setIsSavingEmailColors(true);
    try {
      try {
        localStorage.setItem(
          "veydra_email_colors",
          JSON.stringify(emailColors),
        );
      } catch (e) {}
      await api.updatePortalSettings({
        email_colors: JSON.stringify(emailColors),
      } as any);
      toast({
        title: "Email Colors Saved",
        description:
          "New email templates will use your custom colors. Existing templates need to be reset to apply.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving colors",
        description: error.message,
      });
    } finally {
      setIsSavingEmailColors(false);
    }
  };

  const handleSaveLegal = async () => {
    setIsSavingLegal(true);
    try {
      await api.updatePortalSettings({
        contract_template: contractTemplate,
        wedding_contract_template: weddingContractTemplate,
      } as any);
      toast({
        title: "Legal settings saved",
        description: "Your contract agreements have been updated.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error saving legal settings",
        description: e.message,
      });
    } finally {
      setIsSavingLegal(false);
    }
  };

  const handleAddRegion = async () => {
    if (!newRegion.trim()) return;
    if (regions.includes(newRegion.trim())) {
      toast({
        variant: "destructive",
        title: "Region exists",
        description: "This region is already in your list.",
      });
      return;
    }

    const updatedRegions = [...regions, newRegion.trim()].sort();
    setRegions(updatedRegions);
    try {
      localStorage.setItem("veydra_regions", JSON.stringify(updatedRegions));
    } catch (e) {}
    setNewRegion("");

    try {
      await api.updatePortalSettings({ regions: updatedRegions });
      toast({
        title: "Region added",
        description: `${newRegion.trim()} has been added to your regions.`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error saving region",
        description: "Added locally, but failed to save to database.",
      });
    }
  };

  const handleRemoveRegion = async (regionToRemove: string) => {
    const updatedRegions = regions.filter((r) => r !== regionToRemove);
    setRegions(updatedRegions);
    try {
      localStorage.setItem("veydra_regions", JSON.stringify(updatedRegions));
    } catch (e) {}

    try {
      await api.updatePortalSettings({ regions: updatedRegions });
      toast({
        title: "Region removed",
        description: `${regionToRemove} has been removed.`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error removing region",
        description: "Removed locally, but failed to save to database.",
      });
    }
  };

  const handleAddEditorPricing = () => {
    setEditorVideoPricing([
      ...editorVideoPricing,
      { id: `item_${Date.now()}`, label: "New Video Type", price: 0 },
    ]);
  };

  const handleUpdateEditorPricing = (
    index: number,
    field: "label" | "price",
    value: any,
  ) => {
    const updated = [...editorVideoPricing];
    updated[index] = { ...updated[index], [field]: value };
    setEditorVideoPricing(updated);
  };

  const handleRemoveEditorPricing = (index: number) => {
    const updated = [...editorVideoPricing];
    updated.splice(index, 1);
    setEditorVideoPricing(updated);
  };

  const renderCouponsTab = () => (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-semibold mb-2 tracking-tight">
          Coupon Manager
        </h2>
        <p className="text-muted-foreground">
          Create and manage discount codes for the booking checkout flow.
        </p>
      </div>

      <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-900/20">
          <div>
            <CardTitle className="text-lg">Active Coupons</CardTitle>
            <CardDescription>
              Manage your currently active discount codes
            </CardDescription>
          </div>
          <Dialog open={isAddingCoupon} onOpenChange={setIsAddingCoupon}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" /> Create Coupon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Coupon</DialogTitle>
                <DialogDescription>
                  Add a new discount code for your clients to use at checkout.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Coupon Code</Label>
                  <Input
                    placeholder="e.g. SUMMER20"
                    value={newCoupon.code}
                    onChange={(e) =>
                      setNewCoupon({
                        ...newCoupon,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Code clients will enter at checkout
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select
                      value={newCoupon.discount_type}
                      onValueChange={(v: "percentage" | "fixed") =>
                        setNewCoupon({ ...newCoupon, discount_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">
                          Percentage (%)
                        </SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Value</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newCoupon.discount_value}
                      onChange={(e) =>
                        setNewCoupon({
                          ...newCoupon,
                          discount_value: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Maximum Uses (Optional)</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={newCoupon.max_uses}
                      onChange={(e) =>
                        setNewCoupon({ ...newCoupon, max_uses: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiration Date (Optional)</Label>
                    <Input
                      type="date"
                      value={newCoupon.expires_at}
                      onChange={(e) =>
                        setNewCoupon({
                          ...newCoupon,
                          expires_at: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddingCoupon(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddCoupon}>Create Coupon</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50/50 dark:bg-stone-900/20 hover:bg-stone-50/50 dark:hover:bg-stone-900/20">
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No coupons found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-medium font-mono uppercase">
                      {coupon.code}
                    </TableCell>
                    <TableCell>
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}%`
                        : `$${coupon.discount_value}`}
                    </TableCell>
                    <TableCell>
                      {coupon.current_uses}{" "}
                      {coupon.max_uses ? `/ ${coupon.max_uses}` : "uses"}
                    </TableCell>
                    <TableCell>
                      {coupon.expires_at
                        ? new Date(coupon.expires_at).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={coupon.is_active}
                        onCheckedChange={() =>
                          toggleCouponStatus(coupon.id, coupon.is_active)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCoupon(coupon.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Settings
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage system preferences and integrations.
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full space-y-6">
        <TabsList className="mb-8 overflow-x-auto overflow-y-hidden flex-nowrap w-full justify-start border-b border-stone-200 dark:border-stone-800 rounded-none bg-transparent h-auto p-0">
          <TabsTrigger
            value="general"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-stone-900 dark:data-[state=active]:border-stone-100 data-[state=active]:bg-transparent px-4 py-3 shrink-0"
          >
            General
          </TabsTrigger>
          <TabsTrigger
            value="rates"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-stone-900 dark:data-[state=active]:border-stone-100 data-[state=active]:bg-transparent px-4 py-3 shrink-0"
          >
            Rates & Regions
          </TabsTrigger>
          <TabsTrigger
            value="pricing"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-stone-900 dark:data-[state=active]:border-stone-100 data-[state=active]:bg-transparent px-4 py-3 shrink-0"
          >
            Packages & Pricing
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-stone-900 dark:data-[state=active]:border-stone-100 data-[state=active]:bg-transparent px-4 py-3 shrink-0"
          >
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="coupons"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-stone-900 dark:data-[state=active]:border-stone-100 data-[state=active]:bg-transparent px-4 py-3 shrink-0"
          >
            Coupons
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-stone-900 dark:data-[state=active]:border-stone-100 data-[state=active]:bg-transparent px-4 py-3 shrink-0"
          >
            Integrations
          </TabsTrigger>
          <TabsTrigger
            value="legal"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-stone-900 dark:data-[state=active]:border-stone-100 data-[state=active]:bg-transparent px-4 py-3 shrink-0"
          >
            Legal
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-stone-900 dark:data-[state=active]:border-stone-100 data-[state=active]:bg-transparent px-4 py-3 shrink-0"
          >
            Outbox & Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>
                  Customize the look and feel of your portal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    placeholder="e.g. Veydra"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used in email templates and portal text.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="app-url">Public App URL</Label>
                  <Input id="app-url" placeholder="https://your-domain.com" />
                  <p className="text-xs text-muted-foreground">
                    Your published site URL. Used for bride portal links,
                    feedback links, and setup links in all emails/SMS. Must be
                    the full public domain (no trailing slash). Leave blank to
                    use current domain.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="logo-url">Portal Logo URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="logo-url"
                      placeholder="https://example.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Provide a direct link to an image to replace the default
                    portal logo.
                  </p>
                </div>

                <AppIconUploader />

                <div className="grid gap-2 pt-2 border-t">
                  <Label
                    htmlFor="upload-email"
                    className="flex items-center gap-2"
                  >
                    <UploadCloud className="h-4 w-4" /> Contractor Upload
                    Account Email
                  </Label>
                  <Input
                    id="upload-email"
                    placeholder="uploads@yourcompany.com"
                    value={uploadEmail}
                    onChange={(e) => setUploadEmail(e.target.value)}
                  />
                  <Label htmlFor="upload-password" className="pt-2">
                    Contractor Upload Account Password
                  </Label>
                  <Input
                    id="upload-password"
                    type="text"
                    placeholder="Shared upload account password"
                    value={uploadPassword}
                    onChange={(e) => setUploadPassword(e.target.value)}
                  />
                  <Label htmlFor="upload-instructions" className="pt-2">
                    Custom Upload Instructions (optional)
                  </Label>
                  <Textarea
                    id="upload-instructions"
                    placeholder="Leave blank to use the default upload instructions. Override the text shown to contractors after a wedding."
                    value={uploadInstructions}
                    onChange={(e) => setUploadInstructions(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    These shared Google Drive login details are shown to
                    contractors on the assignment page so they can upload raw
                    files. Change per area as needed.
                  </p>
                </div>

                <Button
                  className="mt-4"
                  onClick={handleSaveBranding}
                  disabled={isSavingBranding}
                >
                  {isSavingBranding ? "Saving..." : "Save Branding"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Theme Colors</CardTitle>
                <CardDescription>
                  Customize the colors used in all outgoing email templates.
                  Reset templates after changing to apply.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Background</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailColors.bg}
                        onChange={(e) =>
                          setEmailColors({ ...emailColors, bg: e.target.value })
                        }
                        className="h-8 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={emailColors.bg}
                        onChange={(e) =>
                          setEmailColors({ ...emailColors, bg: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Card Background</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailColors.cardBg}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            cardBg: e.target.value,
                          })
                        }
                        className="h-8 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={emailColors.cardBg}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            cardBg: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Accent / Gold</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailColors.accent}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            accent: e.target.value,
                          })
                        }
                        className="h-8 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={emailColors.accent}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            accent: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Button Background</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailColors.buttonBg}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            buttonBg: e.target.value,
                          })
                        }
                        className="h-8 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={emailColors.buttonBg}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            buttonBg: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Button Text</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailColors.buttonText}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            buttonText: e.target.value,
                          })
                        }
                        className="h-8 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={emailColors.buttonText}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            buttonText: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Heading Text</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailColors.heading}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            heading: e.target.value,
                          })
                        }
                        className="h-8 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={emailColors.heading}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            heading: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Body Text</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailColors.body}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            body: e.target.value,
                          })
                        }
                        className="h-8 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={emailColors.body}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            body: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Footer Background</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailColors.footerBg}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            footerBg: e.target.value,
                          })
                        }
                        className="h-8 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={emailColors.footerBg}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            footerBg: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Signature Accent</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailColors.signature}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            signature: e.target.value,
                          })
                        }
                        className="h-8 w-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={emailColors.signature}
                        onChange={(e) =>
                          setEmailColors({
                            ...emailColors,
                            signature: e.target.value,
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleSaveEmailColors}
                    disabled={isSavingEmailColors}
                  >
                    {isSavingEmailColors ? "Saving..." : "Save Email Colors"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEmailColors(DEFAULT_EMAIL_COLORS);
                      toast({
                        title: "Colors Reset",
                        description: "Click Save to apply defaults.",
                      });
                    }}
                  >
                    Reset to Defaults
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  After saving, click "Reset All Templates" in the Notifications
                  tab to regenerate all email templates with your new colors.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Company Timezone</CardTitle>
                <CardDescription>
                  Set the default timezone for assignments and dates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone" className="w-full">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">
                        Eastern Time (ET)
                      </SelectItem>
                      <SelectItem value="America/Chicago">
                        Central Time (CT)
                      </SelectItem>
                      <SelectItem value="America/Denver">
                        Mountain Time (MT)
                      </SelectItem>
                      <SelectItem value="America/Phoenix">
                        Mountain Time (Arizona)
                      </SelectItem>
                      <SelectItem value="America/Los_Angeles">
                        Pacific Time (PT)
                      </SelectItem>
                      <SelectItem value="America/Anchorage">
                        Alaska Time (AKT)
                      </SelectItem>
                      <SelectItem value="Pacific/Honolulu">
                        Hawaii-Aleutian Time (HAT)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This ensures dates and times display correctly across the
                    portal.
                  </p>
                </div>

                <Button
                  className="mt-4"
                  onClick={handleSaveTimezone}
                  disabled={isSavingTimezone}
                >
                  {isSavingTimezone ? "Saving..." : "Save Timezone"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rates" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Global Pay Rates & Bidding</CardTitle>
                <CardDescription>
                  Set default hourly rates and suggested bidding ranges.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
                    <div className="grid gap-2">
                      <Label htmlFor="photo-rate">Photo Flat Rate ($/hr)</Label>
                      <Input
                        id="photo-rate"
                        type="number"
                        placeholder="e.g. 50"
                        value={photoPayRate}
                        onChange={(e) =>
                          setPhotoPayRate(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="photo-bid-min">
                        Photo Bid Min ($/hr)
                      </Label>
                      <Input
                        id="photo-bid-min"
                        type="number"
                        placeholder="e.g. 60"
                        value={photoBidMin}
                        onChange={(e) =>
                          setPhotoBidMin(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="photo-bid-max">
                        Photo Bid Max ($/hr)
                      </Label>
                      <Input
                        id="photo-bid-max"
                        type="number"
                        placeholder="e.g. 75"
                        value={photoBidMax}
                        onChange={(e) =>
                          setPhotoBidMax(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="video-rate">Video Flat Rate ($/hr)</Label>
                      <Input
                        id="video-rate"
                        type="number"
                        placeholder="e.g. 50"
                        value={videoPayRate}
                        onChange={(e) =>
                          setVideoPayRate(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="video-bid-min">
                        Video Bid Min ($/hr)
                      </Label>
                      <Input
                        id="video-bid-min"
                        type="number"
                        placeholder="e.g. 60"
                        value={videoBidMin}
                        onChange={(e) =>
                          setVideoBidMin(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="video-bid-max">
                        Video Bid Max ($/hr)
                      </Label>
                      <Input
                        id="video-bid-max"
                        type="number"
                        placeholder="e.g. 75"
                        value={videoBidMax}
                        onChange={(e) =>
                          setVideoBidMax(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Flat rates calculate total pay when you add hours. Bid ranges
                  show suggested amounts to contractors.
                </p>

                <Button
                  className="mt-4"
                  onClick={handleSaveRates}
                  disabled={isSavingRates}
                >
                  {isSavingRates ? "Saving..." : "Save Rates"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Editor Pricing Tiers</CardTitle>
                <CardDescription>
                  Configure the video deliverables and prices for your editors.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {editorVideoPricing.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-muted/30 p-2 rounded-md border"
                    >
                      <div className="flex-1">
                        <Input
                          value={item.label}
                          onChange={(e) =>
                            handleUpdateEditorPricing(
                              index,
                              "label",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. Wedding Highlight (9-10 min)"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="w-24 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) =>
                            handleUpdateEditorPricing(
                              index,
                              "price",
                              Number(e.target.value),
                            )
                          }
                          className="h-8 pl-6 text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveEditorPricing(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddEditorPricing}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                  <Button onClick={handleSaveRates} disabled={isSavingRates}>
                    {isSavingRates ? "Saving..." : "Save Pricing"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Company Regions</CardTitle>
                <CardDescription>
                  Manage the designated regions for your business.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  {regions.map((region) => (
                    <Badge
                      key={region}
                      variant="secondary"
                      className="px-3 py-1 flex items-center gap-1 text-sm"
                    >
                      {region}
                      <button
                        onClick={() => handleRemoveRegion(region)}
                        className="ml-1 text-muted-foreground hover:text-foreground rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {regions.length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      No regions configured.
                    </span>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new-region">Add New Region</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-region"
                      placeholder="e.g. Atlanta"
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddRegion();
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      onClick={handleAddRegion}
                      disabled={!newRegion.trim()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          {isLoadingPricing ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <MarginCalculator packages={pricingPackages} />

              <BartendingUpsellCard />

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Packages & Addons</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage your wedding packages and add-ons. Changes sync
                    instantly to the booking page, proposal builder, and
                    proposal review.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <Switch
                      checked={showArchivedPricing}
                      onCheckedChange={setShowArchivedPricing}
                    />
                    Show archived
                  </label>
                </div>
              </div>

              {/* PACKAGES */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Wedding Packages</CardTitle>
                      <CardDescription>
                        Core packages shown on the booking page and proposal
                        builder.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        setEditingPackage({
                          name: "",
                          description: "",
                          priceBoth: 0,
                          priceSingle: 0,
                          photoFeatures: [],
                          videoFeatures: [],
                          isArchived: false,
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Package
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pricingPackages
                    .filter((p) => showArchivedPricing || !p.isArchived)
                    .map((pkg) => (
                      <div
                        key={pkg.id}
                        className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{pkg.name}</span>
                            {pkg.isArchived && (
                              <Badge variant="secondary">Archived</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {pkg.desc} &middot; Both: ${pkg.priceBoth} &middot;
                            Single: ${pkg.priceSingle}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pkg.photoFeatures?.length || 0} photo features
                            &middot; {pkg.videoFeatures?.length || 0} video
                            features
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPackage({ ...pkg })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicatePackage(pkg)}
                        >
                          <Copy className="h-4 w-4 mr-1" /> Duplicate
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeletePackage(pkg.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  {pricingPackages.filter(
                    (p) => showArchivedPricing || !p.isArchived,
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No packages yet. Click "Add Package" to create one.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* ADDONS */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Add-Ons</CardTitle>
                      <CardDescription>
                        Optional extras brides can add to their package.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        setEditingAddon({
                          name: "",
                          price: 0,
                          isHourly: false,
                          minHours: 0,
                          isArchived: false,
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Addon
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pricingAddons
                    .filter((a) => showArchivedPricing || !a.isArchived)
                    .map((addon) => (
                      <div
                        key={addon.id}
                        className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{addon.name}</span>
                            {addon.isArchived && (
                              <Badge variant="secondary">Archived</Badge>
                            )}
                            {addon.isHourly && (
                              <Badge variant="outline">Hourly</Badge>
                            )}
                            {addon.isBartending && (
                              <Badge
                                variant="outline"
                                className="border-[#c9a96e]/50 text-[#c9a96e]"
                              >
                                Bartending
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            ${addon.price}
                            {addon.isHourly
                              ? `/hr (min ${addon.minHours} hrs)`
                              : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingAddon({ ...addon })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteAddon(addon.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  {pricingAddons.filter(
                    (a) => showArchivedPricing || !a.isArchived,
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No addons yet. Click "Add Addon" to create one.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Package edit dialog */}
        <Dialog
          open={!!editingPackage}
          onOpenChange={(open) => !open && setEditingPackage(null)}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPackage?.id ? "Edit Package" : "New Package"}
              </DialogTitle>
            </DialogHeader>
            {editingPackage && (
              <PackageEditor
                pkg={editingPackage}
                onSave={(p) => handleSavePackage(p)}
                onCancel={() => setEditingPackage(null)}
                isSaving={isSavingPricing}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Addon edit dialog */}
        <Dialog
          open={!!editingAddon}
          onOpenChange={(open) => !open && setEditingAddon(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAddon?.id ? "Edit Addon" : "New Addon"}
              </DialogTitle>
            </DialogHeader>
            {editingAddon && (
              <AddonEditor
                addon={editingAddon}
                onSave={(a) => handleSaveAddon(a)}
                onCancel={() => setEditingAddon(null)}
                isSaving={isSavingPricing}
              />
            )}
          </DialogContent>
        </Dialog>

        <TabsContent value="integrations" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="md:col-span-2 max-w-3xl">
              <CardHeader>
                <CardTitle>Ovanta API Connection</CardTitle>
                <CardDescription>
                  Directly sync data with Ovanta without webhooks. These keys
                  are stored securely.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="hl-api-key">Ovanta API Key</Label>
                  <Input
                    id="hl-api-key"
                    type="password"
                    placeholder="sk_..."
                    value={hlApiKey}
                    onChange={(e) => setHlApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used by backend Edge Functions to make secure direct API
                    calls.
                  </p>
                </div>

                <div className="grid gap-2 pt-4 border-t mt-2">
                  <Label htmlFor="hl-location-id">Ovanta Location ID</Label>
                  <Input
                    id="hl-location-id"
                    placeholder="e.g. fkA7m9pf9sdKd1sNoKJv"
                    value={hlLocationId}
                    onChange={(e) => setHlLocationId(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleSaveIntegrations}
                    disabled={isSavingIntegrations}
                  >
                    {isSavingIntegrations
                      ? "Saving..."
                      : "Save Ovanta Settings"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleTestApiConnection}
                    disabled={isTestingApi || !hlApiKey || !hlLocationId}
                  >
                    {isTestingApi ? "Testing..." : "Test Connection"}
                  </Button>
                </div>

                <div className="grid gap-2 pt-4 border-t mt-4">
                  <Label htmlFor="test-sms-email">Test Automated SMS</Label>
                  <div className="flex gap-2">
                    <Input
                      id="test-sms-email"
                      placeholder="Enter contractor email in Ovanta..."
                      value={testSmsEmail}
                      onChange={(e) => setTestSmsEmail(e.target.value)}
                    />
                    <Button
                      variant="secondary"
                      onClick={handleTestSms}
                      disabled={
                        isTestingSms ||
                        !testSmsEmail ||
                        !hlApiKey ||
                        !hlLocationId
                      }
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isTestingSms ? "Sending..." : "Test SMS"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will look up the contact by email in Ovanta and send
                    them a test SMS.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 max-w-3xl">
              <CardHeader>
                <CardTitle>Facebook Ads Integration</CardTitle>
                <CardDescription>
                  Connect your Meta account to pull live campaign metrics and ad
                  performance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-muted/30 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#1877F2] p-2.5 rounded-md text-white shrink-0">
                      <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-base">Facebook Ads</h4>
                      <p className="text-sm text-muted-foreground">
                        {fbAccessToken
                          ? "Connected to Meta Graph API"
                          : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {fbAccessToken ? (
                      <>
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                        >
                          Connected
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFbAccessToken("");
                            setFbAdAccountId("");
                            handleSaveIntegrations();
                          }}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="pt-2 space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200 dark:border-blue-900 text-xs space-y-1.5 text-blue-900 dark:text-blue-200">
                    <p className="font-bold flex items-center gap-1">
                      💡 Quick Token Guide & Extending Token Lifetime:
                    </p>
                    <p>
                      Short-lived Graph API Explorer tokens expire in 1–2 hours.
                      To generate a <strong>60-day token</strong> or{" "}
                      <strong>never-expiring System User token</strong>:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 mt-1">
                      <li>
                        Open Meta's{" "}
                        <a
                          href="https://developers.facebook.com/tools/explorer/"
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-bold text-blue-700 dark:text-blue-300"
                        >
                          Graph API Explorer ↗
                        </a>
                        , choose your App, add permissions{" "}
                        <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono">
                          ads_read
                        </code>{" "}
                        &{" "}
                        <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono">
                          read_insights
                        </code>
                        , and click <strong>Generate Access Token</strong>.
                      </li>
                      <li>
                        To convert to a <strong>60-Day Token</strong>: Open
                        Meta's{" "}
                        <a
                          href="https://developers.facebook.com/tools/accesstoken/"
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-bold text-blue-700 dark:text-blue-300"
                        >
                          Access Token Tool ↗
                        </a>
                        , click <strong>Debug</strong> on your token, and click{" "}
                        <strong>Extend Access Token</strong> at the bottom.
                      </li>
                      <li>
                        Or create a <strong>Never-Expiring Token</strong>: Go
                        directly to{" "}
                        <a
                          href="https://business.facebook.com/settings/system-users"
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-bold text-blue-700 dark:text-blue-300"
                        >
                          Meta Business Settings System Users ↗
                        </a>{" "}
                        → Add System User → Assign Ad Account → Generate Token
                        with{" "}
                        <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono">
                          ads_read
                        </code>{" "}
                        &{" "}
                        <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono">
                          read_insights
                        </code>
                        .
                      </li>
                    </ol>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="fb-access-token">Meta Access Token</Label>
                      <a
                        href="https://developers.facebook.com/tools/explorer/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline hover:opacity-80 font-medium"
                      >
                        Open Graph API Explorer ↗
                      </a>
                    </div>
                    <Textarea
                      id="fb-access-token"
                      placeholder="Paste your long Meta Access Token (EAA...)"
                      value={fbAccessToken}
                      onChange={(e) => setFbAccessToken(e.target.value)}
                      className="min-h-[90px] font-mono text-xs"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="fb-ad-account-id">Ad Account ID</Label>
                    <Input
                      id="fb-ad-account-id"
                      placeholder="e.g. 123456789012345 or act_123456789012345"
                      value={fbAdAccountId}
                      onChange={(e) => setFbAdAccountId(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      onClick={handleSaveIntegrations}
                      disabled={isSavingIntegrations}
                      className="w-full sm:w-auto"
                    >
                      {isSavingIntegrations
                        ? "Saving..."
                        : "Save Meta Credentials"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleTestFbApiConnection}
                      disabled={
                        isTestingFbApi || !fbAccessToken || !fbAdAccountId
                      }
                      className="w-full sm:w-auto"
                    >
                      {isTestingFbApi ? "Testing..." : "Test Connection"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stripe Connection Status */}
            <Card className="md:col-span-2 max-w-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Stripe Connection
                </CardTitle>
                <CardDescription>
                  Payment processing for bride deposits, invoices, and
                  contractor payouts. Keys are stored securely as environment
                  variables on the server.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCheckingStripe ? (
                  <div className="flex items-center gap-3 p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Checking Stripe connection...
                    </span>
                  </div>
                ) : stripeStatus?.connected ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 gap-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2.5 rounded-md text-emerald-600 dark:text-emerald-400 shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-base">
                            {stripeStatus.businessName ||
                              stripeStatus.email ||
                              "Stripe Account Connected"}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {stripeStatus.isTest ? "Test Mode" : "Live Mode"}
                            {stripeStatus.country
                              ? ` • ${stripeStatus.country}`
                              : ""}
                            {stripeStatus.defaultCurrency
                              ? ` • ${stripeStatus.defaultCurrency.toUpperCase()}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                      >
                        Connected
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          Account ID
                        </span>
                        <p className="font-mono text-xs">
                          {stripeStatus.accountId}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          Payouts
                        </span>
                        <p className="flex items-center gap-1.5">
                          {stripeStatus.payoutsEnabled ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{" "}
                              Enabled
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-amber-500" />{" "}
                              Pending setup
                            </>
                          )}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                          Account Details
                        </span>
                        <p className="flex items-center gap-1.5">
                          {stripeStatus.detailsSubmitted ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{" "}
                              Verified
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-amber-500" />{" "}
                              Incomplete
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={checkStripeStatus}
                        disabled={isCheckingStripe}
                      >
                        <Loader2
                          className={cn(
                            "h-3.5 w-3.5 mr-1.5",
                            isCheckingStripe && "animate-spin",
                          )}
                        />
                        Refresh Status
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30 gap-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-muted p-2.5 rounded-md text-muted-foreground shrink-0">
                          <XCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-base">
                            Not Connected
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Stripe keys are not configured on this instance.
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-muted text-muted-foreground border-border"
                      >
                        Disconnected
                      </Badge>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900 text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
                      <p className="font-bold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> How to connect
                        Stripe:
                      </p>
                      <p>
                        Stripe keys are stored as server-side environment
                        variables for security. To set or change the Stripe
                        account:
                      </p>
                      <ol className="list-decimal pl-4 space-y-1 mt-1">
                        <li>
                          Go to your{" "}
                          <a
                            href="https://dashboard.stripe.com/apikeys"
                            target="_blank"
                            rel="noreferrer"
                            className="underline font-bold"
                          >
                            Stripe Dashboard API Keys
                          </a>{" "}
                          and copy your Secret Key (
                          <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">
                            sk_live_...
                          </code>{" "}
                          or{" "}
                          <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">
                            sk_test_...
                          </code>
                          ).
                        </li>
                        <li>
                          In your Supabase Dashboard, go to{" "}
                          <strong>Edge Functions - Secrets</strong> and set{" "}
                          <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">
                            STRIPE_SECRET_KEY
                          </code>{" "}
                          to your key.
                        </li>
                        <li>
                          Also set{" "}
                          <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">
                            STRIPE_WEBHOOK_SECRET
                          </code>{" "}
                          (from Stripe Dashboard - Developers - Webhooks).
                        </li>
                        <li>
                          Click "Refresh Status" below to verify the connection.
                        </li>
                      </ol>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkStripeStatus}
                      disabled={isCheckingStripe}
                    >
                      <Loader2
                        className={cn(
                          "h-3.5 w-3.5 mr-1.5",
                          isCheckingStripe && "animate-spin",
                        )}
                      />
                      Refresh Status
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="md:col-span-2 max-w-3xl">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>Notification Templates</CardTitle>
                  <CardDescription>
                    Configure automatic text messages and emails sent to
                    different user groups.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (
                      !confirm(
                        "Are you sure you want to reset ALL email and SMS templates to the default theme? This will overwrite any custom changes and save immediately.",
                      )
                    )
                      return;

                    // Contractor emails
                    setEmailInviteTemplate(
                      getBaseEmailTemplate(
                        "Welcome to {{company_name}}",
                        "<p>Hi {{contractor_name}},</p><p>You've been invited to join the {{company_name}} team! Set up your account to start receiving job opportunities and managing your assignments.</p>",
                        "Set Up Account",
                        "{{setup_link}}",
                      ),
                    );
                    setEmailResetTemplate(
                      getBaseEmailTemplate(
                        "Password Reset Request",
                        "<p>Hi {{contractor_name}},</p><p>A password reset was requested for your {{company_name}} account. Please check your email inbox for the secure password reset link from our system. If you didn't request this, you can safely ignore this email.</p>",
                      ),
                    );
                    setEmailManagerInviteTemplate(
                      getBaseEmailTemplate(
                        "Admin Invitation",
                        "<p>Hi {{manager_name}},</p><p>You've been invited as an Admin to the {{company_name}} portal! Set up your account to start managing the team and assignments.</p>",
                        "Set Up Admin Account",
                        "{{setup_link}}",
                      ),
                    );
                    setEmailManagerResetTemplate(
                      getBaseEmailTemplate(
                        "Admin Password Reset",
                        "<p>Hi {{manager_name}},</p><p>A password reset was requested for your Admin account. Please check your email inbox for the secure password reset link from our system. If you didn't request this, you can safely ignore this email.</p>",
                      ),
                    );
                    setEmailAssignmentTemplate(
                      getBaseEmailTemplate(
                        "New Assignment",
                        "<p>Hi {{contractor_name}},</p><p>You have been assigned to a new <strong>{{role}}</strong> position in <strong>{{location}}</strong> on <strong>{{date}}</strong>.</p><p>Log in to your portal to view the full details, timeline, and requirements.</p>",
                        "View Assignment",
                        "{{portal_link}}",
                      ),
                    );
                    setEmailNewJobTemplate(
                      getBaseEmailTemplate(
                        "New Job Available",
                        "<p>Hi {{contractor_name}},</p><p>A new <strong>{{role}}</strong> position is open for a wedding in <strong>{{location}}</strong> on <strong>{{date}}</strong>.</p><p>Check the portal to apply before the position is filled!</p>",
                        "View Job Board",
                        "{{portal_link}}/opportunities",
                      ),
                    );
                    setEmailReminderTemplate(
                      getBaseEmailTemplate(
                        "Upcoming Job Reminder",
                        "<p>Hi {{contractor_name}},</p><p>Friendly reminder about your upcoming <strong>{{role}}</strong> job for <strong>{{wedding_name}}</strong> in <strong>{{location}}</strong> on <strong>{{date}}</strong> at <strong>{{start_time}}</strong>.</p><p>Please review the portal for timeline details, VIP names, and any special requests.</p>",
                        "View Details",
                        "{{portal_link}}",
                      ),
                    );
                    setEmailPayoutTemplate(
                      getBaseEmailTemplate(
                        "Payout Processed",
                        "<p>Great news {{contractor_name}}!</p><p>Your payout of <strong>${{amount}}</strong> for the <strong>{{location}}</strong> job on <strong>{{date}}</strong> has been processed.</p><p>Thank you for your hard work!</p>",
                      ),
                    );
                    setEmailOutbidTemplate(
                      getBaseEmailTemplate(
                        "You've been outbid",
                        "<p>Hi {{contractor_name}},</p><p>Someone has placed a lower bid (<strong>${{new_bid}}</strong>) on a job you applied for.</p><p>If you still want the position, you can update your bid in the portal.</p>",
                        "Update My Bid",
                        "{{portal_link}}/opportunities",
                      ),
                    );

                    // Editor emails
                    setEmailEditorInviteTemplate(
                      getBaseEmailTemplate(
                        "Editor Invitation",
                        '<p>Hi {{editor_name}},</p><p>You\'ve been invited to join the {{company_name}} editing team! Set up your account to start receiving editing assignments.</p><div style="background: #f4f4f5; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 1px; text-align: center; margin: 20px 0;"><strong>{{temp_password}}</strong></div><p><em>Please make sure to change your password from your Profile page after logging in.</em></p>',
                        "Log In & Change Password",
                        "{{setup_link}}",
                      ),
                    );
                    setEmailEditorResetTemplate(
                      getBaseEmailTemplate(
                        "Editor Password Reset",
                        "<p>Hi {{editor_name}},</p><p>A password reset was requested for your Editor account. Please check your email inbox for the secure password reset link from our system. If you didn't request this, you can safely ignore this email.</p>",
                      ),
                    );
                    setEmailEditorAssignedTemplate(
                      getBaseEmailTemplate(
                        "New Editing Assignment",
                        "<p>Hi {{editor_name}},</p><p>You have been assigned to edit the <strong>{{wedding_name}}</strong> wedding!</p><p>Log in to your portal to view the details.</p>",
                        "View Assignment",
                        "{{portal_link}}",
                      ),
                    );
                    setEmailEditorRawMediaTemplate(
                      getBaseEmailTemplate(
                        "Raw Media Ready",
                        "<p>Hi {{editor_name}},</p><p>The raw media for the <strong>{{wedding_name}}</strong> wedding is uploaded and ready to edit!</p><p>You can start working on it in your portal.</p>",
                        "View Portal",
                        "{{portal_link}}",
                      ),
                    );
                    setEmailEditorRevisionsTemplate(
                      getBaseEmailTemplate(
                        "Revisions Requested",
                        "<p>Hi {{editor_name}},</p><p>Revisions have been requested for the <strong>{{wedding_name}}</strong> wedding.</p><p>Please check the portal for feedback.</p>",
                        "View Feedback",
                        "{{portal_link}}",
                      ),
                    );
                    setEmailEditorPayoutTemplate(
                      getBaseEmailTemplate(
                        "Payout Processed",
                        "<p>Great news {{editor_name}}!</p><p>Your payout of <strong>${{amount}}</strong> for the <strong>{{wedding_name}}</strong> edit has been processed.</p><p>Thank you for your hard work!</p>",
                      ),
                    );

                    // Pipeline emails
                    setEmailPipelineInterviewTemplate(
                      getBaseEmailTemplate(
                        "Interview Stage",
                        "<p>Hi {{contractor_name}},</p><p>Great news! Your application at {{company_name}} has advanced to the <strong>Interview</strong> stage.</p>",
                        "View Candidate Portal",
                        "{{portal_link}}",
                      ),
                    );
                    setEmailPipelinePaperworkTemplate(
                      getBaseEmailTemplate(
                        "Paperwork Stage",
                        "<p>Hi {{contractor_name}},</p><p>Great news! Your application at {{company_name}} has advanced to the <strong>Paperwork</strong> stage.</p>",
                        "View Candidate Portal",
                        "{{portal_link}}",
                      ),
                    );
                    setEmailPipelineHiredTemplate(
                      getBaseEmailTemplate(
                        "You're Hired!",
                        "<p>Hi {{contractor_name}},</p><p>Congratulations! You have been hired at <strong>{{company_name}}</strong>.</p><p>You can now log in to your portal to complete your training and start accepting assignments.</p>",
                        "Log In to Portal",
                        "{{portal_link}}/login",
                      ),
                    );
                    setEmailPipelineRejectedTemplate(
                      getBaseEmailTemplate(
                        "Application Update",
                        "<p>Hi {{contractor_name}},</p><p>Thank you for taking the time to apply and speak with our team at {{company_name}}.</p><p>While we were impressed with your background, we have decided to move forward with other candidates who more closely align with our current needs for this position.</p><p>We will keep your information on file and may reach out if a better fit opens up in the future.</p><p>We wish you the best in your professional endeavors.</p>",
                      ),
                    );
                    setEmailApplicantWelcomeTemplate(
                      getBaseEmailTemplate(
                        "Application Received",
                        "<p>Hi {{contractor_name}},</p><p>Thank you for applying to join the {{company_name}} team!</p><p>You can track the status of your application by logging into your Candidate Portal using the email and password you just created.</p>",
                        "Log In to Candidate Portal",
                        "{{portal_link}}/login",
                      ),
                    );
                    setEmailPipelineGalleryTemplate(
                      getBaseEmailTemplate(
                        "Gallery Submission Request",
                        "<p>Hi {{contractor_name}},</p><p>Thank you for applying to join the {{company_name}} team!</p><p>To continue your application, please send us a <strong>full gallery from a wedding you shot as lead photographer/videographer</strong>.</p><p>Simply reply to this email with your gallery link (Google Drive, Dropbox, etc.) and we'll take it from there.</p>",
                      ),
                    );
                    setEmailDocExpiryTemplate(
                      getBaseEmailTemplate(
                        "Document Expiration Notice",
                        "<p>Hi {{contractor_name}},</p><p>Your <strong>{{document_name}}</strong> is set to expire on <strong>{{expiry_date}}</strong>.</p><p>Please log in to your portal to upload a renewed version to remain eligible for assignments.</p>",
                        "Update Document",
                        "{{portal_link}}/profile",
                      ),
                    );

                    // Bride emails
                    setEmailBrideWelcomeTemplate(
                      getBaseEmailTemplate(
                        "You're Officially Booked!",
                        '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">We are absolutely thrilled to have you as part of the {{company_name}} family. Your wedding date is officially reserved, and the countdown to your big day begins now.</p><p style="font-size: 16px;">Your private <strong>Bride Hub</strong> is your home base for everything leading up to your wedding. Here\'s what you can do right now:</p><ul style="font-size: 15px; color: #5c5448; padding-left: 20px;"><li style="margin-bottom: 8px;">Complete your <strong>Style & Details Questionnaire</strong> — this tells our team exactly what you envision</li><li style="margin-bottom: 8px;">Review your <strong>wedding timeline</strong> and venue details</li><li style="margin-bottom: 8px;">Track your <strong>payment balance</strong> and view invoices</li><li style="margin-bottom: 8px;">Meet your <strong>media team</strong> once they\'re assigned</li></ul><p style="font-size: 16px;">If you don\'t see a team assigned yet, don\'t worry — we\'re carefully matching you with the perfect crew and they\'ll appear in your Hub soon.</p>',
                        "Go to My Bride Hub",
                        "{{portal_link}}",
                        "The earlier you complete your questionnaire, the better we can tailor your wedding day coverage to your unique vision. Most brides take about 10–15 minutes to fill it out.",
                      ),
                    );
                    setEmailBrideSongsTemplate(
                      getBaseEmailTemplate(
                        "Choose Your Highlight Video Songs",
                        '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">Your wedding highlight film is one of the most personal pieces of your final gallery — and the music sets the entire tone.</p><p style="font-size: 16px;">We\'d love for you to pick the songs that feel most <em>you</em>. You can add the song title, artist, and a direct link (Spotify, YouTube, Apple Music — whichever is easiest) so our editors know exactly which version to use.</p><p style="font-size: 16px;">Aim for <strong>2–3 songs</strong>: one for your ceremony, one for the reception highlights, and a backup in case of licensing issues.</p>',
                        "Choose My Songs",
                        "{{portal_link}}",
                        "Tip: Choose songs that reflect your relationship — the song from your first date, a favorite concert, or the track you always dance to in the kitchen. These personal touches make your highlight film unforgettable.",
                      ),
                    );
                    setEmailBridePreWeddingTemplate(
                      getBaseEmailTemplate(
                        "The Countdown Is On",
                        '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">Your wedding day is just around the corner, and we wanted to reach out with a few final details.</p><p style="font-size: 16px;">Your media team will arrive at <strong>{{arrival_time}}</strong>. They\'ll be ready to capture every glance, every laugh, and every moment that makes your day uniquely yours.</p><p style="font-size: 16px;">Take a deep breath — you\'ve planned an incredible day, and we\'re honored to be part of it.</p>',
                        "View My Timeline",
                        "{{portal_link}}",
                        'Pack an "emergency kit" the night before: blotting papers, mints, safety pins, a phone charger, and your vendor contact list. You\'ll thank yourself when something small comes up.',
                      ),
                    );
                    setEmailBrideDeliveryTemplate(
                      getBaseEmailTemplate(
                        "Your Wedding Media is Ready",
                        '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">The moment you\'ve been waiting for is here — your wedding media is finalized and ready to view.</p><p style="font-size: 16px;">Your gallery includes all your edited photos and video links. You can download, share with family, and relive every moment whenever you\'d like.</p><p style="font-size: 16px;">We poured our hearts into capturing your day, and we hope these images and films bring you joy for years to come.</p>',
                        "View My Gallery",
                        "{{gallery_link}}",
                        "Download your photos within 30 days and back them up to two locations (cloud + external drive). Your gallery link will remain active, but having your own copy ensures your memories are always safe.",
                      ),
                    );
                    setEmailBrideRatingTemplate(
                      getBaseEmailTemplate(
                        "How Was Your Experience?",
                        '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">We hope you\'re still glowing from your wedding day — and that your photos and films brought back every beautiful moment.</p><p style="font-size: 16px;">Your feedback means the world to our team. It helps us grow, helps other couples find us, and lets your specific crew know they made a difference.</p><p style="font-size: 16px;">It takes less than two minutes, and we\'d be so grateful.</p>',
                        "Share My Feedback",
                        "{{feedback_link}}",
                        "Reviews are the lifeblood of small wedding businesses. If you loved your experience, sharing a Google or Facebook review helps couples just like you find us. We'd be honored if you took a moment to share.",
                      ),
                    );
                    setEmailBrideDayAfterTemplate(
                      getBaseEmailTemplate(
                        "Congratulations, Newlyweds!",
                        '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">It was an absolute honor to be part of your wedding yesterday. We hope you\'re soaking in every moment of this new chapter together.</p><p style="font-size: 16px;">Your photos and video footage are currently being uploaded and will be sent to our editing team shortly. We carefully curate every frame to tell your story beautifully — this process typically takes a few weeks.</p><p style="font-size: 16px;">You can follow along in your Bride Hub for real-time updates on your project status.</p>',
                        "Track My Project",
                        "{{portal_link}}",
                        "Don't forget to change your name on your social media profiles, update your address with the post office, and send your thank-you notes within three months. Enjoy this season — it goes fast!",
                      ),
                    );
                    setEmailBrideGiftTemplate(
                      getBaseEmailTemplate(
                        "You Received a Wedding Gift",
                        '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">Someone who loves you just sent a gift of <strong>${{amount}}</strong> towards your wedding with {{company_name}}.</p><p style="font-size: 16px;">This gift has been automatically applied to your account balance, bringing you one step closer to your dream wedding coverage. You can view your updated balance in your Bride Hub.</p><p style="font-size: 16px;">What a beautiful way to celebrate your love story.</p>',
                        "View My Balance",
                        "{{portal_link}}",
                        "Wedding gifts from loved ones are a wonderful way to offset costs. Consider sharing your portal link with family who may want to contribute — many couples are surprised by the generosity they receive.",
                      ),
                    );

                    // Admin booking email
                    setEmailAdminBookingTemplate(
                      getBaseEmailTemplate(
                        "New Booking Received",
                        '<p style="font-size: 16px;">A new booking just came in.</p><div style="background: #faf7f2; border: 1px solid #e8e0d4; border-radius: 6px; padding: 20px 24px; margin: 20px 0;"><p style="margin: 0 0 12px; font-size: 15px;"><strong style="color: #c9a96e;">Client:</strong> {{bride_name}}<br><strong style="color: #c9a96e;">Email:</strong> {{client_email}}<br><strong style="color: #c9a96e;">Wedding Date:</strong> {{wedding_date}}<br><strong style="color: #c9a96e;">Venue:</strong> {{venue}}<br><strong style="color: #c9a96e;">Package:</strong> {{package_name}}<br><strong style="color: #c9a96e;">Amount Paid:</strong> ${{amount}}</p></div>',
                        "View Wedding in Portal",
                        "{{portal_link}}",
                      ),
                    );

                    // All SMS templates
                    setSmsInviteTemplate(
                      "Hi {{contractor_name}}, you've been invited to join the {{company_name}} team! Set up your account here: {{setup_link}}",
                    );
                    setSmsResetTemplate(
                      "Hi {{contractor_name}}, a password reset was requested for your account. Please check your email for the secure link.",
                    );
                    setSmsManagerInviteTemplate(
                      "Hi {{manager_name}}, you've been invited as an Admin to the {{company_name}} portal! Set up your account here: {{setup_link}}",
                    );
                    setSmsManagerResetTemplate(
                      "Hi {{manager_name}}, a password reset was requested for your Admin account. Please check your email for the secure link.",
                    );
                    setSmsAssignmentTemplate(
                      "Hi {{contractor_name}}! You have been assigned to a new {{role}} position in {{location}} on {{date}}. Check your {{company_name}} portal for details: {{portal_link}}",
                    );
                    setSmsNewJobTemplate(
                      "Hi {{contractor_name}}, a new {{role}} position is open for a wedding in {{location}} on {{date}}. Check the portal to apply: {{portal_link}}/opportunities",
                    );
                    setSmsReminderTemplate(
                      "Hi {{contractor_name}}, friendly reminder about your upcoming {{role}} job for {{wedding_name}} in {{location}} tomorrow, {{date}} at {{start_time}}. Please review the portal for timeline details: {{portal_link}}",
                    );
                    setSmsPayoutTemplate(
                      "Great news {{contractor_name}}! Your payout of ${{amount}} for the {{location}} job on {{date}} has been processed.",
                    );
                    setSmsOutbidTemplate(
                      "Hi {{contractor_name}}, someone has placed a lower bid (${{new_bid}}) on a job you applied for. Update your bid in the portal if you still want the position: {{portal_link}}",
                    );
                    setSmsContractorPrepTemplate(
                      "Hi {{contractor_name}}, you have action items due for the {{wedding_name}} wedding in {{days}} days. Please log in to complete them: {{portal_link}}",
                    );
                    setSmsBrideWelcomeTemplate(
                      "Hi {{bride_name}}! Welcome to {{company_name}}. Your private Bride Hub is ready — complete your wedding details here: {{portal_link}}",
                    );
                    setSmsBrideSongsTemplate(
                      "Hi {{bride_name}}! We need your song choices for your wedding highlight video. Pick your songs in your Bride Hub: {{portal_link}}",
                    );
                    setSmsBridePreWeddingTemplate(
                      "Hi {{bride_name}}, your big day is almost here! Your media team will arrive at {{arrival_time}}. We can't wait to celebrate with you!",
                    );
                    setSmsBrideDeliveryTemplate(
                      "Great news {{bride_name}}! Your wedding media is ready. View and download your gallery here: {{gallery_link}}",
                    );
                    setSmsBrideRatingTemplate(
                      "Hi {{bride_name}}, we hope you loved your wedding media! Could you take a moment to share your feedback? {{feedback_link}}",
                    );
                    setSmsBrideDayAfterTemplate(
                      "Hi {{bride_name}}, it was a pleasure to be part of your wedding! Your photos and video are being uploaded and sent to our editing team. Follow your portal for updates: {{portal_link}}",
                    );
                    setSmsBrideGiftTemplate(
                      "Hi {{bride_name}}, you just received a gift of ${{amount}} towards your wedding! Check your portal for details: {{portal_link}}",
                    );
                    setSmsEditorInviteTemplate(
                      "Hi {{editor_name}}, you've been invited to join the {{company_name}} editing team! Set up your account here: {{setup_link}}",
                    );
                    setSmsEditorResetTemplate(
                      "Hi {{editor_name}}, a password reset was requested for your editor account. Please check your email for the secure link.",
                    );
                    setSmsEditorAssignedTemplate(
                      "Hi {{editor_name}}, you have been assigned to edit the {{wedding_name}} wedding! Check your {{company_name}} portal for details: {{portal_link}}",
                    );
                    setSmsEditorRawMediaTemplate(
                      "Hi {{editor_name}}, the raw media for {{wedding_name}} is uploaded and ready to edit! You can start working on it in your portal: {{portal_link}}",
                    );
                    setSmsEditorRevisionsTemplate(
                      "Hi {{editor_name}}, revisions have been requested for the {{wedding_name}} wedding. Please check the portal for feedback: {{portal_link}}",
                    );
                    setSmsEditorPayoutTemplate(
                      "Great news {{editor_name}}! Your payout of ${{amount}} for the {{wedding_name}} edit has been processed.",
                    );
                    setSmsAdminApplicationTemplate(
                      "New application received! {{contractor_name}} has applied for the {{role}} position in {{location}}.",
                    );
                    setSmsAdminAssignmentAcceptedTemplate(
                      "Assignment accepted: {{contractor_name}} has accepted the {{role}} position for the {{wedding_name}} wedding on {{date}}.",
                    );
                    setSmsAdminRawMediaTemplate(
                      "Raw media uploaded! {{contractor_name}} has uploaded the raw media for the {{wedding_name}} wedding.",
                    );
                    setSmsAdminFeedbackTemplate(
                      "New client feedback! {{bride_name}} has submitted feedback for the {{wedding_name}} wedding.",
                    );
                    setSmsAdminEditCompletedTemplate(
                      "Edit completed! {{editor_name}} has finished the edit for the {{wedding_name}} wedding.",
                    );
                    setSmsAdminBookingTemplate(
                      "New booking! {{bride_name}} just booked the {{package_name}} package for {{wedding_date}} at {{venue}}. Amount: ${{amount}}.",
                    );
                    setSmsPipelineInterviewTemplate(
                      "Hi {{contractor_name}}, your application to {{company_name}} has advanced to the Interview stage! Please check your portal for details: {{portal_link}}",
                    );
                    setSmsPipelinePaperworkTemplate(
                      "Hi {{contractor_name}}, your application to {{company_name}} has advanced to the Paperwork stage! Please check your portal for details: {{portal_link}}",
                    );
                    setSmsPipelineHiredTemplate(
                      "Hi {{contractor_name}}, congratulations! You have been hired at {{company_name}}. Please check your portal to get started: {{portal_link}}",
                    );
                    setSmsPipelineRejectedTemplate(
                      "Hi {{contractor_name}}, thank you for applying to {{company_name}}. We have decided to move forward with other candidates at this time. We wish you the best!",
                    );
                    setSmsApplicantWelcomeTemplate(
                      "Hi {{contractor_name}}, your application to {{company_name}} has been received! You can track your status by logging in here: {{portal_link}}/login",
                    );
                    setSmsPipelineGalleryTemplate(
                      "Hi {{contractor_name}}, we'd love to see more of your work! Please reply with a link to a full wedding gallery you shot as lead. Thanks!",
                    );
                    setSmsDocExpiryTemplate(
                      "Hi {{contractor_name}}, your {{document_name}} expires on {{expiry_date}}. Please upload a renewed version in your portal: {{portal_link}}/profile",
                    );

                    // Auto-save to database — build payload directly with reset values
                    // (can't use handleSaveIntegrations because React state hasn't updated yet)
                    toast({
                      title: "Templates Reset",
                      description: "All templates reset. Saving to database...",
                    });
                    try {
                      const r = (
                        title: string,
                        content: string,
                        ctaText?: string,
                        ctaLink?: string,
                        planningTip?: string,
                      ) =>
                        getBaseEmailTemplate(
                          title,
                          content,
                          ctaText,
                          ctaLink,
                          planningTip,
                        );
                      await api.updatePortalSettings({
                        email_invite_template: r(
                          "Welcome to {{company_name}}",
                          "<p>Hi {{contractor_name}},</p><p>You've been invited to join the {{company_name}} team! Set up your account to start receiving job opportunities and managing your assignments.</p>",
                          "Set Up Account",
                          "{{setup_link}}",
                        ),
                        email_reset_template: r(
                          "Password Reset Request",
                          "<p>Hi {{contractor_name}},</p><p>A password reset was requested for your {{company_name}} account. Please check your email inbox for the secure password reset link from our system. If you didn't request this, you can safely ignore this email.</p>",
                        ),
                        email_manager_invite_template: r(
                          "Admin Invitation",
                          "<p>Hi {{manager_name}},</p><p>You've been invited as an Admin to the {{company_name}} portal! Set up your account to start managing the team and assignments.</p>",
                          "Set Up Admin Account",
                          "{{setup_link}}",
                        ),
                        email_manager_reset_template: r(
                          "Admin Password Reset",
                          "<p>Hi {{manager_name}},</p><p>A password reset was requested for your Admin account. Please check your email inbox for the secure password reset link from our system. If you didn't request this, you can safely ignore this email.</p>",
                        ),
                        email_assignment_template: r(
                          "New Assignment",
                          "<p>Hi {{contractor_name}},</p><p>You have been assigned to a new <strong>{{role}}</strong> position in <strong>{{location}}</strong> on <strong>{{date}}</strong>.</p><p>Log in to your portal to view the full details, timeline, and requirements.</p>",
                          "View Assignment",
                          "{{portal_link}}",
                        ),
                        email_new_job_template: r(
                          "New Job Available",
                          "<p>Hi {{contractor_name}},</p><p>A new <strong>{{role}}</strong> position is open for a wedding in <strong>{{location}}</strong> on <strong>{{date}}</strong>.</p><p>Check the portal to apply before the position is filled!</p>",
                          "View Job Board",
                          "{{portal_link}}/opportunities",
                        ),
                        email_reminder_template: r(
                          "Upcoming Job Reminder",
                          "<p>Hi {{contractor_name}},</p><p>Friendly reminder about your upcoming <strong>{{role}}</strong> job for <strong>{{wedding_name}}</strong> in <strong>{{location}}</strong> on <strong>{{date}}</strong> at <strong>{{start_time}}</strong>.</p><p>Please review the portal for timeline details, VIP names, and any special requests.</p>",
                          "View Details",
                          "{{portal_link}}",
                        ),
                        email_payout_template: r(
                          "Payout Processed",
                          "<p>Great news {{contractor_name}}!</p><p>Your payout of <strong>${{amount}}</strong> for the <strong>{{location}}</strong> job on <strong>{{date}}</strong> has been processed.</p><p>Thank you for your hard work!</p>",
                        ),
                        email_outbid_template: r(
                          "You've been outbid",
                          "<p>Hi {{contractor_name}},</p><p>Someone has placed a lower bid (<strong>${{new_bid}}</strong>) on a job you applied for.</p><p>If you still want the position, you can update your bid in the portal.</p>",
                          "Update My Bid",
                          "{{portal_link}}/opportunities",
                        ),
                        email_editor_invite_template: r(
                          "Editor Invitation",
                          '<p>Hi {{editor_name}},</p><p>You\'ve been invited to join the {{company_name}} editing team! Set up your account to start receiving editing assignments.</p><div style="background: #f4f4f5; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 1px; text-align: center; margin: 20px 0;"><strong>{{temp_password}}</strong></div><p><em>Please make sure to change your password from your Profile page after logging in.</em></p>',
                          "Log In & Change Password",
                          "{{setup_link}}",
                        ),
                        email_editor_reset_template: r(
                          "Editor Password Reset",
                          "<p>Hi {{editor_name}},</p><p>A password reset was requested for your Editor account. Please check your email inbox for the secure password reset link from our system. If you didn't request this, you can safely ignore this email.</p>",
                        ),
                        email_editor_assigned_template: r(
                          "New Editing Assignment",
                          "<p>Hi {{editor_name}},</p><p>You have been assigned to edit the <strong>{{wedding_name}}</strong> wedding!</p><p>Log in to your portal to view the details.</p>",
                          "View Assignment",
                          "{{portal_link}}",
                        ),
                        email_editor_raw_media_template: r(
                          "Raw Media Ready",
                          "<p>Hi {{editor_name}},</p><p>The raw media for the <strong>{{wedding_name}}</strong> wedding is uploaded and ready to edit!</p><p>You can start working on it in your portal.</p>",
                          "View Portal",
                          "{{portal_link}}",
                        ),
                        email_editor_revisions_template: r(
                          "Revisions Requested",
                          "<p>Hi {{editor_name}},</p><p>Revisions have been requested for the <strong>{{wedding_name}}</strong> wedding.</p><p>Please check the portal for feedback.</p>",
                          "View Feedback",
                          "{{portal_link}}",
                        ),
                        email_editor_payout_template: r(
                          "Payout Processed",
                          "<p>Great news {{editor_name}}!</p><p>Your payout of <strong>${{amount}}</strong> for the <strong>{{wedding_name}}</strong> edit has been processed.</p><p>Thank you for your hard work!</p>",
                        ),
                        email_pipeline_interview_template: r(
                          "Interview Stage",
                          "<p>Hi {{contractor_name}},</p><p>Great news! Your application at {{company_name}} has advanced to the <strong>Interview</strong> stage.</p>",
                          "View Candidate Portal",
                          "{{portal_link}}",
                        ),
                        email_pipeline_paperwork_template: r(
                          "Paperwork Stage",
                          "<p>Hi {{contractor_name}},</p><p>Great news! Your application at {{company_name}} has advanced to the <strong>Paperwork</strong> stage.</p>",
                          "View Candidate Portal",
                          "{{portal_link}}",
                        ),
                        email_pipeline_hired_template: r(
                          "You're Hired!",
                          "<p>Hi {{contractor_name}},</p><p>Congratulations! You have been hired at <strong>{{company_name}}</strong>.</p><p>You can now log in to your portal to complete your training and start accepting assignments.</p>",
                          "Log In to Portal",
                          "{{portal_link}}/login",
                        ),
                        email_pipeline_rejected_template: r(
                          "Application Update",
                          "<p>Hi {{contractor_name}},</p><p>Thank you for taking the time to apply and speak with our team at {{company_name}}.</p><p>While we were impressed with your background, we have decided to move forward with other candidates who more closely align with our current needs for this position.</p><p>We will keep your information on file and may reach out if a better fit opens up in the future.</p><p>We wish you the best in your professional endeavors.</p>",
                        ),
                        email_applicant_welcome_template: r(
                          "Application Received",
                          "<p>Hi {{contractor_name}},</p><p>Thank you for applying to join the {{company_name}} team!</p><p>You can track the status of your application by logging into your Candidate Portal using the email and password you just created.</p>",
                          "Log In to Candidate Portal",
                          "{{portal_link}}/login",
                        ),
                        email_pipeline_gallery_template: r(
                          "Gallery Submission Request",
                          "<p>Hi {{contractor_name}},</p><p>Thank you for applying to join the {{company_name}} team!</p><p>To continue your application, please send us a <strong>full gallery from a wedding you shot as lead photographer/videographer</strong>.</p><p>Simply reply to this email with your gallery link (Google Drive, Dropbox, etc.) and we'll take it from there.</p>",
                        ),
                        email_doc_expiry_template: r(
                          "Document Expiration Notice",
                          "<p>Hi {{contractor_name}},</p><p>Your <strong>{{document_name}}</strong> is set to expire on <strong>{{expiry_date}}</strong>.</p><p>Please log in to your portal to upload a renewed version to remain eligible for assignments.</p>",
                          "Update Document",
                          "{{portal_link}}/profile",
                        ),
                        email_bride_welcome_template: r(
                          "You're Officially Booked!",
                          '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">We are absolutely thrilled to have you as part of the {{company_name}} family. Your wedding date is officially reserved, and the countdown to your big day begins now.</p><p style="font-size: 16px;">Your private <strong>Bride Hub</strong> is your home base for everything leading up to your wedding. Here\'s what you can do right now:</p><ul style="font-size: 15px; color: #5c5448; padding-left: 20px;"><li style="margin-bottom: 8px;">Complete your <strong>Style & Details Questionnaire</strong> — this tells our team exactly what you envision</li><li style="margin-bottom: 8px;">Review your <strong>wedding timeline</strong> and venue details</li><li style="margin-bottom: 8px;">Track your <strong>payment balance</strong> and view invoices</li><li style="margin-bottom: 8px;">Meet your <strong>media team</strong> once they\'re assigned</li></ul><p style="font-size: 16px;">If you don\'t see a team assigned yet, don\'t worry — we\'re carefully matching you with the perfect crew and they\'ll appear in your Hub soon.</p>',
                          "Go to My Bride Hub",
                          "{{portal_link}}",
                          "The earlier you complete your questionnaire, the better we can tailor your wedding day coverage to your unique vision. Most brides take about 10–15 minutes to fill it out.",
                        ),
                        email_bride_songs_template: r(
                          "Choose Your Highlight Video Songs",
                          '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">Your wedding highlight film is one of the most personal pieces of your final gallery — and the music sets the entire tone.</p><p style="font-size: 16px;">We\'d love for you to pick the songs that feel most <em>you</em>. You can add the song title, artist, and a direct link (Spotify, YouTube, Apple Music — whichever is easiest) so our editors know exactly which version to use.</p><p style="font-size: 16px;">Aim for <strong>2–3 songs</strong>: one for your ceremony, one for the reception highlights, and a backup in case of licensing issues.</p>',
                          "Choose My Songs",
                          "{{portal_link}}",
                          "Tip: Choose songs that reflect your relationship — the song from your first date, a favorite concert, or the track you always dance to in the kitchen. These personal touches make your highlight film unforgettable.",
                        ),
                        email_bride_pre_wedding_template: r(
                          "The Countdown Is On",
                          '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">Your wedding day is just around the corner, and we wanted to reach out with a few final details.</p><p style="font-size: 16px;">Your media team will arrive at <strong>{{arrival_time}}</strong>. They\'ll be ready to capture every glance, every laugh, and every moment that makes your day uniquely yours.</p><p style="font-size: 16px;">Take a deep breath — you\'ve planned an incredible day, and we\'re honored to be part of it.</p>',
                          "View My Timeline",
                          "{{portal_link}}",
                          'Pack an "emergency kit" the night before: blotting papers, mints, safety pins, a phone charger, and your vendor contact list. You\'ll thank yourself when something small comes up.',
                        ),
                        email_bride_delivery_template: r(
                          "Your Wedding Media is Ready",
                          '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">The moment you\'ve been waiting for is here — your wedding media is finalized and ready to view.</p><p style="font-size: 16px;">Your gallery includes all your edited photos and video links. You can download, share with family, and relive every moment whenever you\'d like.</p><p style="font-size: 16px;">We poured our hearts into capturing your day, and we hope these images and films bring you joy for years to come.</p>',
                          "View My Gallery",
                          "{{gallery_link}}",
                          "Download your photos within 30 days and back them up to two locations (cloud + external drive). Your gallery link will remain active, but having your own copy ensures your memories are always safe.",
                        ),
                        email_bride_rating_template: r(
                          "How Was Your Experience?",
                          '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">We hope you\'re still glowing from your wedding day — and that your photos and films brought back every beautiful moment.</p><p style="font-size: 16px;">Your feedback means the world to our team. It helps us grow, helps other couples find us, and lets your specific crew know they made a difference.</p><p style="font-size: 16px;">It takes less than two minutes, and we\'d be so grateful.</p>',
                          "Share My Feedback",
                          "{{feedback_link}}",
                          "Reviews are the lifeblood of small wedding businesses. If you loved your experience, sharing a Google or Facebook review helps couples just like you find us. We'd be honored if you took a moment to share.",
                        ),
                        email_bride_day_after_template: r(
                          "Congratulations, Newlyweds!",
                          '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">It was an absolute honor to be part of your wedding yesterday. We hope you\'re soaking in every moment of this new chapter together.</p><p style="font-size: 16px;">Your photos and video footage are currently being uploaded and will be sent to our editing team shortly. We carefully curate every frame to tell your story beautifully — this process typically takes a few weeks.</p><p style="font-size: 16px;">You can follow along in your Bride Hub for real-time updates on your project status.</p>',
                          "Track My Project",
                          "{{portal_link}}",
                          "Don't forget to change your name on your social media profiles, update your address with the post office, and send your thank-you notes within three months. Enjoy this season — it goes fast!",
                        ),
                        email_bride_gift_template: r(
                          "You Received a Wedding Gift",
                          '<p style="font-size: 16px;">Hi {{bride_name}},</p><p style="font-size: 16px;">Someone who loves you just sent a gift of <strong>${{amount}}</strong> towards your wedding with {{company_name}}.</p><p style="font-size: 16px;">This gift has been automatically applied to your account balance, bringing you one step closer to your dream wedding coverage. You can view your updated balance in your Bride Hub.</p><p style="font-size: 16px;">What a beautiful way to celebrate your love story.</p>',
                          "View My Balance",
                          "{{portal_link}}",
                          "Wedding gifts from loved ones are a wonderful way to offset costs. Consider sharing your portal link with family who may want to contribute — many couples are surprised by the generosity they receive.",
                        ),
                        email_admin_booking_template: r(
                          "New Booking Received",
                          '<p style="font-size: 16px;">A new booking just came in.</p><div style="background: #faf7f2; border: 1px solid #e8e0d4; border-radius: 6px; padding: 20px 24px; margin: 20px 0;"><p style="margin: 0 0 12px; font-size: 15px;"><strong style="color: #c9a96e;">Client:</strong> {{bride_name}}<br><strong style="color: #c9a96e;">Email:</strong> {{client_email}}<br><strong style="color: #c9a96e;">Wedding Date:</strong> {{wedding_date}}<br><strong style="color: #c9a96e;">Venue:</strong> {{venue}}<br><strong style="color: #c9a96e;">Package:</strong> {{package_name}}<br><strong style="color: #c9a96e;">Amount Paid:</strong> ${{amount}}</p></div>',
                          "View Wedding in Portal",
                          "{{portal_link}}",
                        ),
                        sms_invite_template:
                          "Hi {{contractor_name}}, you've been invited to join the {{company_name}} team! Set up your account here: {{setup_link}}",
                        sms_reset_template:
                          "Hi {{contractor_name}}, a password reset was requested for your account. Please check your email for the secure link.",
                        sms_manager_invite_template:
                          "Hi {{manager_name}}, you've been invited as an Admin to the {{company_name}} portal! Set up your account here: {{setup_link}}",
                        sms_manager_reset_template:
                          "Hi {{manager_name}}, a password reset was requested for your Admin account. Please check your email for the secure link.",
                        sms_assignment_template:
                          "Hi {{contractor_name}}! You have been assigned to a new {{role}} position in {{location}} on {{date}}. Check your {{company_name}} portal for details: {{portal_link}}",
                        sms_new_job_template:
                          "Hi {{contractor_name}}, a new {{role}} position is open for a wedding in {{location}} on {{date}}. Check the portal to apply: {{portal_link}}/opportunities",
                        sms_reminder_template:
                          "Hi {{contractor_name}}, friendly reminder about your upcoming {{role}} job for {{wedding_name}} in {{location}} tomorrow, {{date}} at {{start_time}}. Please review the portal for timeline details: {{portal_link}}",
                        sms_payout_template:
                          "Great news {{contractor_name}}! Your payout of ${{amount}} for the {{location}} job on {{date}} has been processed.",
                        sms_outbid_template:
                          "Hi {{contractor_name}}, someone has placed a lower bid (${{new_bid}}) on a job you applied for. Update your bid in the portal if you still want the position: {{portal_link}}",
                        sms_contractor_prep_template:
                          "Hi {{contractor_name}}, you have action items due for the {{wedding_name}} wedding in {{days}} days. Please log in to complete them: {{portal_link}}",
                        email_contractor_prep_subject:
                          "Action Items Due for {{wedding_name}} Wedding",
                        email_contractor_prep_template: getBaseEmailTemplate(
                          "Action Items Due for {{wedding_name}} Wedding",
                          `<p style="font-size: 17px; margin: 0 0 20px;">Hi {{contractor_name}},</p><p style="font-size: 17px; margin: 0 0 20px;">You have incomplete action items for the <strong>{{wedding_name}}</strong> wedding, which is in <strong>{{days}} days</strong>.</p><p style="font-size: 17px; margin: 0 0 24px;">Please log in to the portal and complete your to-do list before the wedding day. This ensures our team is fully prepared and your assignment goes smoothly.</p><p style="text-center margin: 24px 0;"><a href="{{portal_link}}" style="display:inline-block;background:#1a1a1a;color:#f7f3ee;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Complete Your To-Dos</a></p><p style="font-size: 14px; color: #8b7355; margin: 0 0 20px; text-align:center;">Or copy this link: {{portal_link}}</p>`,
                          "{{company_name}}",
                          "{{logo_url}}",
                        ),
                        sms_bride_welcome_template:
                          "Hi {{bride_name}}! Welcome to {{company_name}}. Your private Bride Hub is ready — complete your wedding details here: {{portal_link}}",
                        sms_bride_songs_template:
                          "Hi {{bride_name}}! We need your song choices for your wedding highlight video. Pick your songs in your Bride Hub: {{portal_link}}",
                        sms_bride_pre_wedding_template:
                          "Hi {{bride_name}}, your big day is almost here! Your media team will arrive at {{arrival_time}}. We can't wait to celebrate with you!",
                        sms_bride_delivery_template:
                          "Great news {{bride_name}}! Your wedding media is ready. View and download your gallery here: {{gallery_link}}",
                        sms_bride_rating_template:
                          "Hi {{bride_name}}, we hope you loved your wedding media! Could you take a moment to share your feedback? {{feedback_link}}",
                        sms_bride_day_after_template:
                          "Hi {{bride_name}}, it was a pleasure to be part of your wedding! Your photos and video are being uploaded and sent to our editing team. Follow your portal for updates: {{portal_link}}",
                        sms_bride_gift_template:
                          "Hi {{bride_name}}, you just received a gift of ${{amount}} towards your wedding! Check your portal for details: {{portal_link}}",
                        sms_editor_invite_template:
                          "Hi {{editor_name}}, you've been invited to join the {{company_name}} editing team! Set up your account here: {{setup_link}}",
                        sms_editor_reset_template:
                          "Hi {{editor_name}}, a password reset was requested for your editor account. Please check your email for the secure link.",
                        sms_editor_assigned_template:
                          "Hi {{editor_name}}, you have been assigned to edit the {{wedding_name}} wedding! Check your {{company_name}} portal for details: {{portal_link}}",
                        sms_editor_raw_media_template:
                          "Hi {{editor_name}}, the raw media for {{wedding_name}} is uploaded and ready to edit! You can start working on it in your portal: {{portal_link}}",
                        sms_editor_revisions_template:
                          "Hi {{editor_name}}, revisions have been requested for the {{wedding_name}} wedding. Please check the portal for feedback: {{portal_link}}",
                        sms_editor_payout_template:
                          "Great news {{editor_name}}! Your payout of ${{amount}} for the {{wedding_name}} edit has been processed.",
                        sms_admin_application_template:
                          "New application received! {{contractor_name}} has applied for the {{role}} position in {{location}}.",
                        sms_admin_assignment_accepted_template:
                          "Assignment accepted: {{contractor_name}} has accepted the {{role}} position for the {{wedding_name}} wedding on {{date}}.",
                        sms_admin_raw_media_template:
                          "Raw media uploaded! {{contractor_name}} has uploaded the raw media for the {{wedding_name}} wedding.",
                        sms_admin_feedback_template:
                          "New client feedback! {{bride_name}} has submitted feedback for the {{wedding_name}} wedding.",
                        sms_admin_edit_completed_template:
                          "Edit completed! {{editor_name}} has finished the edit for the {{wedding_name}} wedding.",
                        sms_admin_booking_template:
                          "New booking! {{bride_name}} just booked the {{package_name}} package for {{wedding_date}} at {{venue}}. Amount: ${{amount}}.",
                        sms_pipeline_interview_template:
                          "Hi {{contractor_name}}, your application to {{company_name}} has advanced to the Interview stage! Please check your portal for details: {{portal_link}}",
                        sms_pipeline_paperwork_template:
                          "Hi {{contractor_name}}, your application to {{company_name}} has advanced to the Paperwork stage! Please check your portal for details: {{portal_link}}",
                        sms_pipeline_hired_template:
                          "Hi {{contractor_name}}, congratulations! You have been hired at {{company_name}}. Please check your portal to get started: {{portal_link}}",
                        sms_pipeline_rejected_template:
                          "Hi {{contractor_name}}, thank you for applying to {{company_name}}. We have decided to move forward with other candidates at this time. We wish you the best!",
                        sms_applicant_welcome_template:
                          "Hi {{contractor_name}}, your application to {{company_name}} has been received! You can track your status by logging in here: {{portal_link}}/login",
                        sms_pipeline_gallery_template:
                          "Hi {{contractor_name}}, we'd love to see more of your work! Please reply with a link to a full wedding gallery you shot as lead. Thanks!",
                        sms_doc_expiry_template:
                          "Hi {{contractor_name}}, your {{document_name}} expires on {{expiry_date}}. Please upload a renewed version in your portal: {{portal_link}}/profile",
                      } as any);
                      toast({
                        title: "All Templates Reset & Saved",
                        description:
                          "All email and SMS templates have been reset and saved to the database.",
                      });
                    } catch (e: any) {
                      toast({
                        variant: "destructive",
                        title: "Reset done but save failed",
                        description:
                          "Templates were reset locally but could not be saved to the database. Click 'Save Ovanta Settings' on the Integrations tab.",
                      });
                    }
                  }}
                >
                  Reset All Templates
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border rounded-xl p-6 bg-muted/30">
                  <Label
                    htmlFor="template-test-email"
                    className="text-base font-medium"
                  >
                    Test Recipient Email
                  </Label>
                  <div className="mt-3">
                    <Input
                      id="template-test-email"
                      placeholder="Enter email in Ovanta..."
                      value={templateTestEmail}
                      onChange={(e) => setTemplateTestEmail(e.target.value)}
                      className="max-w-md bg-background"
                      autoComplete="off"
                      name="template-test-recipient"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    Enter an email that exists in your Ovanta CRM to receive
                    template tests.
                  </p>
                </div>

                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  defaultValue="contractors"
                >
                  <AccordionItem
                    value="contractors"
                    className="border rounded-lg mb-4 px-4 bg-card shadow-sm data-[state=open]:border-primary/50"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-lg">
                          Contractor Notifications
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-8">
                      <div className="space-y-6">
                        <NotificationSetting
                          title="Contractor Invite SMS"
                          description="Sent when you invite a new contractor to the portal."
                          enabled={smsInviteEnabled}
                          onEnabledChange={setSmsInviteEnabled}
                          template={smsInviteTemplate}
                          onTemplateChange={setSmsInviteTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{setup_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(smsInviteTemplate, "invite")
                          }
                          isTesting={testingTemplate === "invite"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Contractor Invite Email"
                          description="Sent when you invite a new contractor to the portal."
                          enabled={emailInviteEnabled}
                          onEnabledChange={setEmailInviteEnabled}
                          template={emailInviteTemplate}
                          onTemplateChange={setEmailInviteTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{setup_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailInviteTemplate,
                              "email_invite",
                              true,
                              emailInviteSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_invite"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailInviteSubject}
                          onSubjectChange={setEmailInviteSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Password Reset Alert SMS"
                          description="Alerts the contractor to check their email for the secure reset link."
                          enabled={smsResetEnabled}
                          onEnabledChange={setSmsResetEnabled}
                          template={smsResetTemplate}
                          onTemplateChange={setSmsResetTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(smsResetTemplate, "reset")
                          }
                          isTesting={testingTemplate === "reset"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Password Reset Email"
                          description="Sends the secure reset link directly via email."
                          enabled={emailResetEnabled}
                          onEnabledChange={setEmailResetEnabled}
                          template={emailResetTemplate}
                          onTemplateChange={setEmailResetTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{setup_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailResetTemplate,
                              "email_reset",
                              true,
                              emailResetSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_reset"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailResetSubject}
                          onSubjectChange={setEmailResetSubject}
                        />

                        <NotificationSetting
                          title="Contractor Assigned SMS"
                          description="Sent to a contractor when they are officially assigned to a job."
                          enabled={smsAssignmentEnabled}
                          onEnabledChange={setSmsAssignmentEnabled}
                          template={smsAssignmentTemplate}
                          onTemplateChange={setSmsAssignmentTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{role}}",
                            "{{location}}",
                            "{{date}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsAssignmentTemplate,
                              "assignment",
                            )
                          }
                          isTesting={testingTemplate === "assignment"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Contractor Assigned Email"
                          description="Sent to a contractor when they are officially assigned to a job."
                          enabled={emailAssignmentEnabled}
                          onEnabledChange={setEmailAssignmentEnabled}
                          template={emailAssignmentTemplate}
                          onTemplateChange={setEmailAssignmentTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{role}}",
                            "{{location}}",
                            "{{date}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailAssignmentTemplate,
                              "email_assignment",
                              true,
                              emailAssignmentSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_assignment"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailAssignmentSubject}
                          onSubjectChange={setEmailAssignmentSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="New Job Alert SMS"
                          description="Sent to eligible contractors when a new position opens up."
                          enabled={smsNewJobEnabled}
                          onEnabledChange={setSmsNewJobEnabled}
                          template={smsNewJobTemplate}
                          onTemplateChange={setSmsNewJobTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{role}}",
                            "{{location}}",
                            "{{date}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(smsNewJobTemplate, "new_job")
                          }
                          isTesting={testingTemplate === "new_job"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="New Job Alert Email"
                          description="Sent to eligible contractors when a new position opens up."
                          enabled={emailNewJobEnabled}
                          onEnabledChange={setEmailNewJobEnabled}
                          template={emailNewJobTemplate}
                          onTemplateChange={setEmailNewJobTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{role}}",
                            "{{location}}",
                            "{{date}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailNewJobTemplate,
                              "email_new_job",
                              true,
                              emailNewJobSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_new_job"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailNewJobSubject}
                          onSubjectChange={setEmailNewJobSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Upcoming Job Reminder SMS"
                          description="Sent to the assigned contractor before the job starts."
                          enabled={smsReminderEnabled}
                          onEnabledChange={setSmsReminderEnabled}
                          template={smsReminderTemplate}
                          onTemplateChange={setSmsReminderTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{role}}",
                            "{{wedding_name}}",
                            "{{location}}",
                            "{{date}}",
                            "{{start_time}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(smsReminderTemplate, "reminder")
                          }
                          isTesting={testingTemplate === "reminder"}
                          testDisabled={!templateTestEmail}
                          extraContent={
                            <div className="grid gap-2 mb-2">
                              <Label htmlFor="sms-reminder-hours">
                                Send Timing
                              </Label>
                              <Select
                                value={smsReminderHours.toString()}
                                onValueChange={(v) =>
                                  setSmsReminderHours(Number(v))
                                }
                              >
                                <SelectTrigger
                                  id="sms-reminder-hours"
                                  className="w-full sm:w-[200px]"
                                >
                                  <SelectValue placeholder="Select timing" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="24">
                                    24 hours before
                                  </SelectItem>
                                  <SelectItem value="48">
                                    48 hours before
                                  </SelectItem>
                                  <SelectItem value="72">
                                    72 hours before
                                  </SelectItem>
                                  <SelectItem value="168">
                                    1 week before
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          }
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Upcoming Job Reminder Email"
                          description="Sent to the assigned contractor before the job starts."
                          enabled={emailReminderEnabled}
                          onEnabledChange={setEmailReminderEnabled}
                          template={emailReminderTemplate}
                          onTemplateChange={setEmailReminderTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{role}}",
                            "{{wedding_name}}",
                            "{{location}}",
                            "{{date}}",
                            "{{start_time}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailReminderTemplate,
                              "email_reminder",
                              true,
                              emailReminderSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_reminder"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailReminderSubject}
                          onSubjectChange={setEmailReminderSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Contractor Prep Alert SMS"
                          description="Sent to contractors with incomplete action items. Fires daily within the window you set (e.g. 5 days = fires at 5, 4, 3, 2, 1 days out)."
                          enabled={smsContractorPrepEnabled}
                          onEnabledChange={setSmsContractorPrepEnabled}
                          template={smsContractorPrepTemplate}
                          onTemplateChange={setSmsContractorPrepTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{wedding_name}}",
                            "{{days}}",
                            "{{location}}",
                            "{{date}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsContractorPrepTemplate,
                              "contractor_prep",
                            )
                          }
                          isTesting={testingTemplate === "contractor_prep"}
                          testDisabled={!templateTestEmail}
                          extraContent={
                            <div className="grid gap-2 mb-2">
                              <Label htmlFor="sms-contractor-prep-days">
                                Reminder Window (days before)
                              </Label>
                              <Select
                                value={smsContractorPrepDays.toString()}
                                onValueChange={(v) =>
                                  setSmsContractorPrepDays(Number(v))
                                }
                              >
                                <SelectTrigger
                                  id="sms-contractor-prep-days"
                                  className="w-full sm:w-[200px]"
                                >
                                  <SelectValue placeholder="Select timing" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="3">
                                    3 days before
                                  </SelectItem>
                                  <SelectItem value="5">
                                    5 days before
                                  </SelectItem>
                                  <SelectItem value="7">
                                    7 days before
                                  </SelectItem>
                                  <SelectItem value="14">
                                    14 days before
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Fires every day within this window until todos
                                are complete.
                              </p>
                            </div>
                          }
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Contractor Prep Alert Email"
                          description="Email version of the prep alert. Same window logic — fires daily until todos are done."
                          enabled={emailContractorPrepEnabled}
                          onEnabledChange={setEmailContractorPrepEnabled}
                          template={emailContractorPrepTemplate}
                          onTemplateChange={setEmailContractorPrepTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{wedding_name}}",
                            "{{days}}",
                            "{{location}}",
                            "{{date}}",
                            "{{portal_link}}",
                            "{{logo_url}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailContractorPrepTemplate,
                              "contractor_prep_email",
                              true,
                              emailContractorPrepSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "contractor_prep_email"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailContractorPrepSubject}
                          onSubjectChange={setEmailContractorPrepSubject}
                        />
                        <NotificationSetting
                          title="Payout Processed SMS"
                          description="Sent to the contractor when a payout is approved/processed."
                          enabled={smsPayoutEnabled}
                          onEnabledChange={setSmsPayoutEnabled}
                          template={smsPayoutTemplate}
                          onTemplateChange={setSmsPayoutTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{location}}",
                            "{{date}}",
                            "{{amount}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(smsPayoutTemplate, "payout")
                          }
                          isTesting={testingTemplate === "payout"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Payout Processed Email"
                          description="Sent to the contractor when a payout is approved/processed."
                          enabled={emailPayoutEnabled}
                          onEnabledChange={setEmailPayoutEnabled}
                          template={emailPayoutTemplate}
                          onTemplateChange={setEmailPayoutTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{location}}",
                            "{{date}}",
                            "{{amount}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailPayoutTemplate,
                              "email_payout",
                              true,
                              emailPayoutSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_payout"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailPayoutSubject}
                          onSubjectChange={setEmailPayoutSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Outbid Alert SMS"
                          description="Sent to a contractor when someone places a lower bid on a job they applied for."
                          enabled={smsOutbidEnabled}
                          onEnabledChange={setSmsOutbidEnabled}
                          template={smsOutbidTemplate}
                          onTemplateChange={setSmsOutbidTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{new_bid}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(smsOutbidTemplate, "outbid")
                          }
                          isTesting={testingTemplate === "outbid"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Outbid Alert Email"
                          description="Sent to a contractor when someone places a lower bid on a job they applied for."
                          enabled={emailOutbidEnabled}
                          onEnabledChange={setEmailOutbidEnabled}
                          template={emailOutbidTemplate}
                          onTemplateChange={setEmailOutbidTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{new_bid}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailOutbidTemplate,
                              "email_outbid",
                              true,
                              emailOutbidSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_outbid"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailOutbidSubject}
                          onSubjectChange={setEmailOutbidSubject}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="hiring"
                    className="border rounded-lg mb-4 px-4 bg-card shadow-sm data-[state=open]:border-primary/50"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-lg">
                          Hiring Pipeline Notifications
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-8">
                      <div className="space-y-6">
                        <NotificationSetting
                          title="Application Received SMS"
                          description="Sent to applicants immediately after they submit their application."
                          enabled={smsApplicantWelcomeEnabled}
                          onEnabledChange={setSmsApplicantWelcomeEnabled}
                          template={smsApplicantWelcomeTemplate}
                          onTemplateChange={setSmsApplicantWelcomeTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsApplicantWelcomeTemplate,
                              "applicant_welcome",
                            )
                          }
                          isTesting={testingTemplate === "applicant_welcome"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Application Received Email"
                          description="Sent to applicants immediately after they submit their application."
                          enabled={emailApplicantWelcomeEnabled}
                          onEnabledChange={setEmailApplicantWelcomeEnabled}
                          template={emailApplicantWelcomeTemplate}
                          onTemplateChange={setEmailApplicantWelcomeTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailApplicantWelcomeTemplate,
                              "email_applicant_welcome",
                              true,
                              emailApplicantWelcomeSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_applicant_welcome"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailApplicantWelcomeSubject}
                          onSubjectChange={setEmailApplicantWelcomeSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Gallery Request SMS"
                          description="Sent to applicants when you manually request a wedding gallery portfolio."
                          enabled={smsPipelineGalleryEnabled}
                          onEnabledChange={setSmsPipelineGalleryEnabled}
                          template={smsPipelineGalleryTemplate}
                          onTemplateChange={setSmsPipelineGalleryTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsPipelineGalleryTemplate,
                              "pipeline_gallery",
                            )
                          }
                          isTesting={testingTemplate === "pipeline_gallery"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Gallery Request Email"
                          description="Sent to applicants when you manually request a wedding gallery portfolio."
                          enabled={emailPipelineGalleryEnabled}
                          onEnabledChange={setEmailPipelineGalleryEnabled}
                          template={emailPipelineGalleryTemplate}
                          onTemplateChange={setEmailPipelineGalleryTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailPipelineGalleryTemplate,
                              "email_pipeline_gallery",
                              true,
                              emailPipelineGallerySubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_pipeline_gallery"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailPipelineGallerySubject}
                          onSubjectChange={setEmailPipelineGallerySubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Interview Stage SMS"
                          description="Sent to applicants when moved to the Interview stage."
                          enabled={smsPipelineInterviewEnabled}
                          onEnabledChange={setSmsPipelineInterviewEnabled}
                          template={smsPipelineInterviewTemplate}
                          onTemplateChange={setSmsPipelineInterviewTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsPipelineInterviewTemplate,
                              "pipeline_interview",
                            )
                          }
                          isTesting={testingTemplate === "pipeline_interview"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Interview Stage Email"
                          description="Sent to applicants when moved to the Interview stage."
                          enabled={emailPipelineInterviewEnabled}
                          onEnabledChange={setEmailPipelineInterviewEnabled}
                          template={emailPipelineInterviewTemplate}
                          onTemplateChange={setEmailPipelineInterviewTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailPipelineInterviewTemplate,
                              "email_pipeline_interview",
                              true,
                              emailPipelineInterviewSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_pipeline_interview"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailPipelineInterviewSubject}
                          onSubjectChange={setEmailPipelineInterviewSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Paperwork Stage SMS"
                          description="Sent to applicants when moved to the Paperwork stage."
                          enabled={smsPipelinePaperworkEnabled}
                          onEnabledChange={setSmsPipelinePaperworkEnabled}
                          template={smsPipelinePaperworkTemplate}
                          onTemplateChange={setSmsPipelinePaperworkTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsPipelinePaperworkTemplate,
                              "pipeline_paperwork",
                            )
                          }
                          isTesting={testingTemplate === "pipeline_paperwork"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Paperwork Stage Email"
                          description="Sent to applicants when moved to the Paperwork stage."
                          enabled={emailPipelinePaperworkEnabled}
                          onEnabledChange={setEmailPipelinePaperworkEnabled}
                          template={emailPipelinePaperworkTemplate}
                          onTemplateChange={setEmailPipelinePaperworkTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailPipelinePaperworkTemplate,
                              "email_pipeline_paperwork",
                              true,
                              emailPipelinePaperworkSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_pipeline_paperwork"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailPipelinePaperworkSubject}
                          onSubjectChange={setEmailPipelinePaperworkSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Hired Stage SMS"
                          description="Sent to applicants when moved to the Hired stage."
                          enabled={smsPipelineHiredEnabled}
                          onEnabledChange={setSmsPipelineHiredEnabled}
                          template={smsPipelineHiredTemplate}
                          onTemplateChange={setSmsPipelineHiredTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsPipelineHiredTemplate,
                              "pipeline_hired",
                            )
                          }
                          isTesting={testingTemplate === "pipeline_hired"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Hired Stage Email"
                          description="Sent to applicants when moved to the Hired stage."
                          enabled={emailPipelineHiredEnabled}
                          onEnabledChange={setEmailPipelineHiredEnabled}
                          template={emailPipelineHiredTemplate}
                          onTemplateChange={setEmailPipelineHiredTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailPipelineHiredTemplate,
                              "email_pipeline_hired",
                              true,
                              emailPipelineHiredSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_pipeline_hired"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailPipelineHiredSubject}
                          onSubjectChange={setEmailPipelineHiredSubject}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="pipeline-rejected"
                    className="border rounded-lg mb-4 px-4 bg-card shadow-sm data-[state=open]:border-primary/50"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-lg">
                          Application Rejected / Declined
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-8">
                      <div className="space-y-6">
                        <NotificationSetting
                          title="Application Rejected SMS"
                          description="Sent to candidate when their application is declined."
                          enabled={smsPipelineRejectedEnabled}
                          onEnabledChange={setSmsPipelineRejectedEnabled}
                          template={smsPipelineRejectedTemplate}
                          onTemplateChange={setSmsPipelineRejectedTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{stage_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsPipelineRejectedTemplate,
                              "sms_pipeline_rejected",
                            )
                          }
                          isTesting={
                            testingTemplate === "sms_pipeline_rejected"
                          }
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Application Rejected Email"
                          description="Sent to candidate when their application is declined."
                          enabled={emailPipelineRejectedEnabled}
                          onEnabledChange={setEmailPipelineRejectedEnabled}
                          template={emailPipelineRejectedTemplate}
                          onTemplateChange={setEmailPipelineRejectedTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{stage_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailPipelineRejectedTemplate,
                              "email_pipeline_rejected",
                              true,
                              emailPipelineRejectedSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_pipeline_rejected"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailPipelineRejectedSubject}
                          onSubjectChange={setEmailPipelineRejectedSubject}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="compliance"
                    className="border rounded-lg mb-4 px-4 bg-card shadow-sm data-[state=open]:border-primary/50"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-lg">
                          Compliance & Document Reminders
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-8">
                      <div className="space-y-6">
                        <div className="p-4 bg-muted/30 rounded-lg flex items-center justify-between border">
                          <div className="space-y-0.5">
                            <Label>Reminder Lead Time</Label>
                            <p className="text-xs text-muted-foreground">
                              How many days before expiration should reminders
                              be sent?
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={docExpiryReminderDays}
                              onChange={(e) =>
                                setDocExpiryReminderDays(
                                  parseInt(e.target.value) || 30,
                                )
                              }
                              className="w-20 h-9"
                            />
                            <span className="text-sm font-medium">Days</span>
                          </div>
                        </div>

                        <NotificationSetting
                          title="Document Expiring SMS"
                          description="Sent to contractors before their document reaches its expiration date."
                          enabled={smsDocExpiryEnabled}
                          onEnabledChange={setSmsDocExpiryEnabled}
                          template={smsDocExpiryTemplate}
                          onTemplateChange={setSmsDocExpiryTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{document_name}}",
                            "{{expiry_date}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsDocExpiryTemplate,
                              "doc_expiry",
                            )
                          }
                          isTesting={testingTemplate === "doc_expiry"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Document Expiring Email"
                          description="Sent to contractors before their document reaches its expiration date."
                          enabled={emailDocExpiryEnabled}
                          onEnabledChange={setEmailDocExpiryEnabled}
                          template={emailDocExpiryTemplate}
                          onTemplateChange={setEmailDocExpiryTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{contractor_name}}",
                            "{{document_name}}",
                            "{{expiry_date}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailDocExpiryTemplate,
                              "email_doc_expiry",
                              true,
                              emailDocExpirySubject,
                            )
                          }
                          isTesting={testingTemplate === "email_doc_expiry"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailDocExpirySubject}
                          onSubjectChange={setEmailDocExpirySubject}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="admin"
                    className="border rounded-lg mb-4 px-4 bg-card shadow-sm data-[state=open]:border-primary/50"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-lg">
                          Admin Notifications
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-8">
                      <div className="space-y-6">
                        <NotificationSetting
                          title="Admin Invite SMS"
                          description="Sent when you invite a new manager/admin to the portal."
                          enabled={smsManagerInviteEnabled}
                          onEnabledChange={setSmsManagerInviteEnabled}
                          template={smsManagerInviteTemplate}
                          onTemplateChange={setSmsManagerInviteTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{manager_name}}",
                            "{{setup_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsManagerInviteTemplate,
                              "manager_invite",
                            )
                          }
                          isTesting={testingTemplate === "manager_invite"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Admin Invite Email"
                          description="Sent when you invite a new manager/admin to the portal."
                          enabled={emailManagerInviteEnabled}
                          onEnabledChange={setEmailManagerInviteEnabled}
                          template={emailManagerInviteTemplate}
                          onTemplateChange={setEmailManagerInviteTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{manager_name}}",
                            "{{setup_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailManagerInviteTemplate,
                              "email_manager_invite",
                              true,
                              emailManagerInviteSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_manager_invite"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailManagerInviteSubject}
                          onSubjectChange={setEmailManagerInviteSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Admin Password Reset SMS"
                          description="Alerts the admin to check their email for the secure reset link."
                          enabled={smsManagerResetEnabled}
                          onEnabledChange={setSmsManagerResetEnabled}
                          template={smsManagerResetTemplate}
                          onTemplateChange={setSmsManagerResetTemplate}
                          variables={["{{company_name}}", "{{manager_name}}"]}
                          onTest={() =>
                            handleTestTemplate(
                              smsManagerResetTemplate,
                              "manager_reset",
                            )
                          }
                          isTesting={testingTemplate === "manager_reset"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Admin Password Reset Email"
                          description="Sends the secure reset link directly via email."
                          enabled={emailManagerResetEnabled}
                          onEnabledChange={setEmailManagerResetEnabled}
                          template={emailManagerResetTemplate}
                          onTemplateChange={setEmailManagerResetTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{manager_name}}",
                            "{{setup_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailManagerResetTemplate,
                              "email_manager_reset",
                              true,
                              emailManagerResetSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_manager_reset"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailManagerResetSubject}
                          onSubjectChange={setEmailManagerResetSubject}
                        />
                        <div className="border-t"></div>
                        <div className="space-y-3 py-2">
                          <div>
                            <Label className="text-sm font-medium">
                              Admin Notification Recipients
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1 mb-2">
                              Comma-separated email addresses of admin team
                              members who should receive booking and other admin
                              notifications. These must exist as contacts in
                              your CRM.
                            </p>
                            <Input
                              autoComplete="off"
                              placeholder="admin@veydra.com, manager@veydra.com"
                              value={adminNotificationEmails}
                              onChange={(e) =>
                                setAdminNotificationEmails(e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="New Booking SMS"
                          description="Sent to admin team when a bride books a wedding."
                          enabled={smsAdminBookingEnabled}
                          onEnabledChange={setSmsAdminBookingEnabled}
                          template={smsAdminBookingTemplate}
                          onTemplateChange={setSmsAdminBookingTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{bride_name}}",
                            "{{client_email}}",
                            "{{wedding_date}}",
                            "{{venue}}",
                            "{{package_name}}",
                            "{{amount}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsAdminBookingTemplate,
                              "admin_booking",
                            )
                          }
                          isTesting={testingTemplate === "admin_booking"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="New Booking Email"
                          description="Sent to admin team when a bride books a wedding."
                          enabled={emailAdminBookingEnabled}
                          onEnabledChange={setEmailAdminBookingEnabled}
                          template={emailAdminBookingTemplate}
                          onTemplateChange={setEmailAdminBookingTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{bride_name}}",
                            "{{client_email}}",
                            "{{wedding_date}}",
                            "{{venue}}",
                            "{{package_name}}",
                            "{{amount}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailAdminBookingTemplate,
                              "email_admin_booking",
                              true,
                              emailAdminBookingSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_admin_booking"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailAdminBookingSubject}
                          onSubjectChange={setEmailAdminBookingSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="New Application SMS"
                          description="Sent when a contractor applies for a position."
                          enabled={smsAdminApplicationEnabled}
                          onEnabledChange={setSmsAdminApplicationEnabled}
                          template={smsAdminApplicationTemplate}
                          onTemplateChange={setSmsAdminApplicationTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{role}}",
                            "{{location}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsAdminApplicationTemplate,
                              "admin_application",
                            )
                          }
                          isTesting={testingTemplate === "admin_application"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Assignment Accepted SMS"
                          description="Sent when a contractor accepts an assignment."
                          enabled={smsAdminAssignmentAcceptedEnabled}
                          onEnabledChange={setSmsAdminAssignmentAcceptedEnabled}
                          template={smsAdminAssignmentAcceptedTemplate}
                          onTemplateChange={
                            setSmsAdminAssignmentAcceptedTemplate
                          }
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{role}}",
                            "{{wedding_name}}",
                            "{{date}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsAdminAssignmentAcceptedTemplate,
                              "admin_assignment_accepted",
                            )
                          }
                          isTesting={
                            testingTemplate === "admin_assignment_accepted"
                          }
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Raw Media Uploaded SMS"
                          description="Sent when a contractor uploads raw media."
                          enabled={smsAdminRawMediaEnabled}
                          onEnabledChange={setSmsAdminRawMediaEnabled}
                          template={smsAdminRawMediaTemplate}
                          onTemplateChange={setSmsAdminRawMediaTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{contractor_name}}",
                            "{{wedding_name}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsAdminRawMediaTemplate,
                              "admin_raw_media",
                            )
                          }
                          isTesting={testingTemplate === "admin_raw_media"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Client Feedback Received SMS"
                          description="Sent when a bride submits feedback."
                          enabled={smsAdminFeedbackEnabled}
                          onEnabledChange={setSmsAdminFeedbackEnabled}
                          template={smsAdminFeedbackTemplate}
                          onTemplateChange={setSmsAdminFeedbackTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{bride_name}}",
                            "{{wedding_name}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsAdminFeedbackTemplate,
                              "admin_feedback",
                            )
                          }
                          isTesting={testingTemplate === "admin_feedback"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Edit Completed SMS"
                          description="Sent when an editor finishes an edit."
                          enabled={smsAdminEditCompletedEnabled}
                          onEnabledChange={setSmsAdminEditCompletedEnabled}
                          template={smsAdminEditCompletedTemplate}
                          onTemplateChange={setSmsAdminEditCompletedTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{editor_name}}",
                            "{{wedding_name}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsAdminEditCompletedTemplate,
                              "admin_edit_completed",
                            )
                          }
                          isTesting={testingTemplate === "admin_edit_completed"}
                          testDisabled={!templateTestEmail}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="editors"
                    className="border rounded-lg mb-4 px-4 bg-card shadow-sm data-[state=open]:border-primary/50"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-lg">
                          Editor Notifications
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-8">
                      <div className="space-y-6">
                        <NotificationSetting
                          title="Editor Invite SMS"
                          description="Sent when you invite a new editor to the portal."
                          enabled={smsEditorInviteEnabled}
                          onEnabledChange={setSmsEditorInviteEnabled}
                          template={smsEditorInviteTemplate}
                          onTemplateChange={setSmsEditorInviteTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{editor_name}}",
                            "{{setup_link}}",
                            "{{temp_password}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsEditorInviteTemplate,
                              "editor_invite",
                            )
                          }
                          isTesting={testingTemplate === "editor_invite"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Editor Invite Email"
                          description="Sent when you invite a new editor to the portal."
                          enabled={emailEditorInviteEnabled}
                          onEnabledChange={setEmailEditorInviteEnabled}
                          template={emailEditorInviteTemplate}
                          onTemplateChange={setEmailEditorInviteTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{editor_name}}",
                            "{{setup_link}}",
                            "{{temp_password}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailEditorInviteTemplate,
                              "email_editor_invite",
                              true,
                              emailEditorInviteSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_editor_invite"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailEditorInviteSubject}
                          onSubjectChange={setEmailEditorInviteSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Editor Password Reset SMS"
                          description="Alerts the editor to check their email for the secure reset link."
                          enabled={smsEditorResetEnabled}
                          onEnabledChange={setSmsEditorResetEnabled}
                          template={smsEditorResetTemplate}
                          onTemplateChange={setSmsEditorResetTemplate}
                          variables={["{{company_name}}", "{{editor_name}}"]}
                          onTest={() =>
                            handleTestTemplate(
                              smsEditorResetTemplate,
                              "editor_reset",
                            )
                          }
                          isTesting={testingTemplate === "editor_reset"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Payout Processed Email"
                          description="Sent when an editor's payout is approved and processed."
                          enabled={emailEditorPayoutEnabled}
                          onEnabledChange={setEmailEditorPayoutEnabled}
                          template={emailEditorPayoutTemplate}
                          onTemplateChange={setEmailEditorPayoutTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{editor_name}}",
                            "{{wedding_name}}",
                            "{{amount}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailEditorPayoutTemplate,
                              "email_editor_payout",
                              true,
                              emailEditorPayoutSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_editor_payout"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailEditorPayoutSubject}
                          onSubjectChange={setEmailEditorPayoutSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Editor Password Reset Email"
                          description="Sends the secure reset link directly via email."
                          enabled={emailEditorResetEnabled}
                          onEnabledChange={setEmailEditorResetEnabled}
                          template={emailEditorResetTemplate}
                          onTemplateChange={setEmailEditorResetTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{editor_name}}",
                            "{{setup_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailEditorResetTemplate,
                              "email_editor_reset",
                              true,
                              emailEditorResetSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_editor_reset"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailEditorResetSubject}
                          onSubjectChange={setEmailEditorResetSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Editor Assigned SMS"
                          description="Sent when an editor is officially assigned to a wedding."
                          enabled={smsEditorAssignedEnabled}
                          onEnabledChange={setSmsEditorAssignedEnabled}
                          template={smsEditorAssignedTemplate}
                          onTemplateChange={setSmsEditorAssignedTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{editor_name}}",
                            "{{wedding_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsEditorAssignedTemplate,
                              "editor_assigned",
                            )
                          }
                          isTesting={testingTemplate === "editor_assigned"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Editor Assigned Email"
                          description="Sent when an editor is officially assigned to a wedding."
                          enabled={emailEditorAssignedEnabled}
                          onEnabledChange={setEmailEditorAssignedEnabled}
                          template={emailEditorAssignedTemplate}
                          onTemplateChange={setEmailEditorAssignedTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{editor_name}}",
                            "{{wedding_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailEditorAssignedTemplate,
                              "email_editor_assigned",
                              true,
                              emailEditorAssignedSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_editor_assigned"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailEditorAssignedSubject}
                          onSubjectChange={setEmailEditorAssignedSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Raw Media Ready SMS"
                          description="Sent when raw media is uploaded and the wedding is ready to edit."
                          enabled={smsEditorRawMediaEnabled}
                          onEnabledChange={setSmsEditorRawMediaEnabled}
                          template={smsEditorRawMediaTemplate}
                          onTemplateChange={setSmsEditorRawMediaTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{editor_name}}",
                            "{{wedding_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsEditorRawMediaTemplate,
                              "editor_raw_media",
                            )
                          }
                          isTesting={testingTemplate === "editor_raw_media"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Raw Media Ready Email"
                          description="Sent when raw media is uploaded and the wedding is ready to edit."
                          enabled={emailEditorRawMediaEnabled}
                          onEnabledChange={setEmailEditorRawMediaEnabled}
                          template={emailEditorRawMediaTemplate}
                          onTemplateChange={setEmailEditorRawMediaTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{editor_name}}",
                            "{{wedding_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailEditorRawMediaTemplate,
                              "email_editor_raw_media",
                              true,
                              emailEditorRawMediaSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_editor_raw_media"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailEditorRawMediaSubject}
                          onSubjectChange={setEmailEditorRawMediaSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Revisions Requested SMS"
                          description="Sent when the client or manager requests revisions."
                          enabled={smsEditorRevisionsEnabled}
                          onEnabledChange={setSmsEditorRevisionsEnabled}
                          template={smsEditorRevisionsTemplate}
                          onTemplateChange={setSmsEditorRevisionsTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{editor_name}}",
                            "{{wedding_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsEditorRevisionsTemplate,
                              "editor_revisions",
                            )
                          }
                          isTesting={testingTemplate === "editor_revisions"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Revisions Requested Email"
                          description="Sent when the client or manager requests revisions."
                          enabled={emailEditorRevisionsEnabled}
                          onEnabledChange={setEmailEditorRevisionsEnabled}
                          template={emailEditorRevisionsTemplate}
                          onTemplateChange={setEmailEditorRevisionsTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{editor_name}}",
                            "{{wedding_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailEditorRevisionsTemplate,
                              "email_editor_revisions",
                              true,
                              emailEditorRevisionsSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_editor_revisions"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailEditorRevisionsSubject}
                          onSubjectChange={setEmailEditorRevisionsSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Payout Processed SMS"
                          description="Sent when an editor's payout is approved and processed."
                          enabled={smsEditorPayoutEnabled}
                          onEnabledChange={setSmsEditorPayoutEnabled}
                          template={smsEditorPayoutTemplate}
                          onTemplateChange={setSmsEditorPayoutTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{editor_name}}",
                            "{{wedding_name}}",
                            "{{amount}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsEditorPayoutTemplate,
                              "editor_payout",
                            )
                          }
                          isTesting={testingTemplate === "editor_payout"}
                          testDisabled={!templateTestEmail}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="brides"
                    className="border rounded-lg px-4 bg-card shadow-sm data-[state=open]:border-primary/50"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-lg">
                          Bride Notifications
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-8">
                      <div className="space-y-6">
                        <NotificationSetting
                          title="Welcome & Questionnaire SMS"
                          description="Sent 3 days after a wedding is added to the system."
                          enabled={smsBrideWelcomeEnabled}
                          onEnabledChange={setSmsBrideWelcomeEnabled}
                          template={smsBrideWelcomeTemplate}
                          onTemplateChange={setSmsBrideWelcomeTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{bride_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsBrideWelcomeTemplate,
                              "bride_welcome",
                            )
                          }
                          isTesting={testingTemplate === "bride_welcome"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Welcome & Questionnaire Email"
                          description="Sent 3 days after a wedding is added to the system."
                          enabled={emailBrideWelcomeEnabled}
                          onEnabledChange={setEmailBrideWelcomeEnabled}
                          template={emailBrideWelcomeTemplate}
                          onTemplateChange={setEmailBrideWelcomeTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{bride_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailBrideWelcomeTemplate,
                              "email_bride_welcome",
                              true,
                              emailBrideWelcomeSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_bride_welcome"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailBrideWelcomeSubject}
                          onSubjectChange={setEmailBrideWelcomeSubject}
                          onReset={resetBrideWelcomeEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Highlight Songs Request SMS"
                          description="Sent manually from the Weddings page to ask the bride to pick highlight video songs."
                          enabled={smsBrideSongsEnabled}
                          onEnabledChange={setSmsBrideSongsEnabled}
                          template={smsBrideSongsTemplate}
                          onTemplateChange={setSmsBrideSongsTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{bride_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsBrideSongsTemplate,
                              "bride_songs",
                            )
                          }
                          isTesting={testingTemplate === "bride_songs"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Highlight Songs Request Email"
                          description="Sent manually from the Weddings page to ask the bride to pick highlight video songs."
                          enabled={emailBrideSongsEnabled}
                          onEnabledChange={setEmailBrideSongsEnabled}
                          template={emailBrideSongsTemplate}
                          onTemplateChange={setEmailBrideSongsTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{bride_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailBrideSongsTemplate,
                              "email_bride_songs",
                              true,
                              emailBrideSongsSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_bride_songs"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailBrideSongsSubject}
                          onSubjectChange={setEmailBrideSongsSubject}
                          onReset={resetBrideSongsEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Pre-Wedding Check-in SMS"
                          description="Sent before the wedding to confirm arrival times."
                          enabled={smsBridePreWeddingEnabled}
                          onEnabledChange={setSmsBridePreWeddingEnabled}
                          template={smsBridePreWeddingTemplate}
                          onTemplateChange={setSmsBridePreWeddingTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{bride_name}}",
                            "{{arrival_time}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsBridePreWeddingTemplate,
                              "bride_pre_wedding",
                            )
                          }
                          isTesting={testingTemplate === "bride_pre_wedding"}
                          testDisabled={!templateTestEmail}
                          extraContent={
                            <div className="grid gap-2 mb-2">
                              <Label htmlFor="sms-bride-pre-wedding-hours">
                                Send Timing
                              </Label>
                              <Select
                                value={smsBridePreWeddingHours.toString()}
                                onValueChange={(v) =>
                                  setSmsBridePreWeddingHours(Number(v))
                                }
                              >
                                <SelectTrigger
                                  id="sms-bride-pre-wedding-hours"
                                  className="w-full sm:w-[200px]"
                                >
                                  <SelectValue placeholder="Select timing" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="24">
                                    24 hours before
                                  </SelectItem>
                                  <SelectItem value="48">
                                    48 hours before
                                  </SelectItem>
                                  <SelectItem value="72">
                                    72 hours before
                                  </SelectItem>
                                  <SelectItem value="168">
                                    1 week before
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          }
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Pre-Wedding Check-in Email"
                          description="Sent before the wedding to confirm arrival times."
                          enabled={emailBridePreWeddingEnabled}
                          onEnabledChange={setEmailBridePreWeddingEnabled}
                          template={emailBridePreWeddingTemplate}
                          onTemplateChange={setEmailBridePreWeddingTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{bride_name}}",
                            "{{arrival_time}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailBridePreWeddingTemplate,
                              "email_bride_pre_wedding",
                              true,
                              emailBridePreWeddingSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_bride_pre_wedding"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailBridePreWeddingSubject}
                          onSubjectChange={setEmailBridePreWeddingSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Media Delivery SMS"
                          description="Sent when photos/videos are finalized and ready to view."
                          enabled={smsBrideDeliveryEnabled}
                          onEnabledChange={setSmsBrideDeliveryEnabled}
                          template={smsBrideDeliveryTemplate}
                          onTemplateChange={setSmsBrideDeliveryTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{bride_name}}",
                            "{{gallery_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsBrideDeliveryTemplate,
                              "bride_delivery",
                            )
                          }
                          isTesting={testingTemplate === "bride_delivery"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Media Delivery Email"
                          description="Sent when photos/videos are finalized and ready to view."
                          enabled={emailBrideDeliveryEnabled}
                          onEnabledChange={setEmailBrideDeliveryEnabled}
                          template={emailBrideDeliveryTemplate}
                          onTemplateChange={setEmailBrideDeliveryTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{bride_name}}",
                            "{{gallery_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailBrideDeliveryTemplate,
                              "email_bride_delivery",
                              true,
                              emailBrideDeliverySubject,
                            )
                          }
                          isTesting={testingTemplate === "email_bride_delivery"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailBrideDeliverySubject}
                          onSubjectChange={setEmailBrideDeliverySubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Rate Contractors SMS"
                          description="Sent 2 days after the wedding to ask the bride to rate their media team."
                          enabled={smsBrideRatingEnabled}
                          onEnabledChange={setSmsBrideRatingEnabled}
                          template={smsBrideRatingTemplate}
                          onTemplateChange={setSmsBrideRatingTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{bride_name}}",
                            "{{feedback_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsBrideRatingTemplate,
                              "bride_rating",
                            )
                          }
                          isTesting={testingTemplate === "bride_rating"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Rate Contractors Email"
                          description="Sent 2 days after the wedding to ask the bride to rate their media team."
                          enabled={emailBrideRatingEnabled}
                          onEnabledChange={setEmailBrideRatingEnabled}
                          template={emailBrideRatingTemplate}
                          onTemplateChange={setEmailBrideRatingTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{bride_name}}",
                            "{{feedback_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailBrideRatingTemplate,
                              "email_bride_rating",
                              true,
                              emailBrideRatingSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_bride_rating"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailBrideRatingSubject}
                          onSubjectChange={setEmailBrideRatingSubject}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Day After Wedding SMS"
                          description="Sent 1 day after the wedding to thank the bride and inform them about editing."
                          enabled={smsBrideDayAfterEnabled}
                          onEnabledChange={setSmsBrideDayAfterEnabled}
                          template={smsBrideDayAfterTemplate}
                          onTemplateChange={setSmsBrideDayAfterTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{bride_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsBrideDayAfterTemplate,
                              "bride_day_after",
                            )
                          }
                          isTesting={testingTemplate === "bride_day_after"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Day After Wedding Email"
                          description="Sent 1 day after the wedding to thank the bride and inform them about editing."
                          enabled={emailBrideDayAfterEnabled}
                          onEnabledChange={setEmailBrideDayAfterEnabled}
                          template={emailBrideDayAfterTemplate}
                          onTemplateChange={setEmailBrideDayAfterTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{bride_name}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailBrideDayAfterTemplate,
                              "email_bride_day_after",
                              true,
                              emailBrideDayAfterSubject,
                            )
                          }
                          isTesting={
                            testingTemplate === "email_bride_day_after"
                          }
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailBrideDayAfterSubject}
                          onSubjectChange={setEmailBrideDayAfterSubject}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="bride-gift">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-primary" />
                        <span>Gift Received</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-6 pt-4">
                        <NotificationSetting
                          title="Gift Received SMS"
                          description="Sent to the bride immediately when someone makes a gift payment."
                          enabled={smsBrideGiftEnabled}
                          onEnabledChange={setSmsBrideGiftEnabled}
                          template={smsBrideGiftTemplate}
                          onTemplateChange={setSmsBrideGiftTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{bride_name}}",
                            "{{amount}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              smsBrideGiftTemplate,
                              "bride_gift",
                            )
                          }
                          isTesting={testingTemplate === "bride_gift"}
                          testDisabled={!templateTestEmail}
                        />
                        <div className="border-t"></div>
                        <NotificationSetting
                          title="Gift Received Email"
                          description="Sent to the bride immediately when someone makes a gift payment."
                          enabled={emailBrideGiftEnabled}
                          onEnabledChange={setEmailBrideGiftEnabled}
                          template={emailBrideGiftTemplate}
                          onTemplateChange={setEmailBrideGiftTemplate}
                          variables={[
                            "{{company_name}}",
                            "{{logo_url}}",
                            "{{bride_name}}",
                            "{{amount}}",
                            "{{portal_link}}",
                          ]}
                          onTest={() =>
                            handleTestTemplate(
                              emailBrideGiftTemplate,
                              "email_bride_gift",
                              true,
                              emailBrideGiftSubject,
                            )
                          }
                          isTesting={testingTemplate === "email_bride_gift"}
                          testDisabled={!templateTestEmail}
                          isEmail={true}
                          subject={emailBrideGiftSubject}
                          onSubjectChange={setEmailBrideGiftSubject}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="payment-failed">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>Failed Auto-Charge Notification</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="space-y-0.5">
                            <Label className="font-semibold text-sm">
                              Send Email On Failed Auto-Charge
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              When enabled, clients receive an automated email
                              if an auto-charge attempt fails, prompting them to
                              update their card.
                            </p>
                          </div>
                          <Switch
                            checked={emailPaymentFailedEnabled}
                            onCheckedChange={setEmailPaymentFailedEnabled}
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div>
                  <Button
                    onClick={handleSaveIntegrations}
                    disabled={isSavingIntegrations}
                  >
                    {isSavingIntegrations
                      ? "Saving..."
                      : "Save Notification Settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 max-w-3xl">
              <CardHeader>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>
                  Configure how automated emails are delivered.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 mb-6">
                  <Label>Email Delivery Method</Label>
                  <RadioGroup
                    value={emailDeliveryMethod}
                    onValueChange={(val: "webhook" | "smtp") =>
                      setEmailDeliveryMethod(val)
                    }
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="webhook" id="method-webhook" />
                      <Label
                        htmlFor="method-webhook"
                        className="font-normal cursor-pointer"
                      >
                        Use Webhooks (Make.com, Zapier, etc.)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="smtp" id="method-smtp" />
                      <Label
                        htmlFor="method-smtp"
                        className="font-normal cursor-pointer"
                      >
                        Direct SMTP Configuration
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {emailDeliveryMethod === "smtp" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="smtp-host">SMTP Host</Label>
                        <Input
                          id="smtp-host"
                          placeholder="smtp.gmail.com"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="smtp-port">SMTP Port</Label>
                        <Input
                          id="smtp-port"
                          type="number"
                          placeholder="587"
                          value={smtpPort}
                          onChange={(e) =>
                            setSmtpPort(
                              e.target.value ? Number(e.target.value) : "",
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="smtp-user">Username / Email</Label>
                        <Input
                          id="smtp-user"
                          placeholder="you@example.com"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="smtp-pass">
                          Password / App Password
                        </Label>
                        <Input
                          id="smtp-pass"
                          type="password"
                          placeholder="••••••••••••"
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="smtp-from-name">From Name</Label>
                        <Input
                          id="smtp-from-name"
                          placeholder="Veydra Notifications"
                          value={smtpFromName}
                          onChange={(e) => setSmtpFromName(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="smtp-from-email">From Email</Label>
                        <Input
                          id="smtp-from-email"
                          placeholder="no-reply@example.com"
                          value={smtpFromEmail}
                          onChange={(e) => setSmtpFromEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                <p className="text-xs text-muted-foreground mt-4">
                  Note: As a secure frontend app, emails cannot be sent directly
                  from the browser. These credentials are saved securely to your
                  database so they can be utilized by your backend Edge
                  Functions or passed to your Make.com/Zapier webhooks for
                  delivery.
                </p>

                <Button
                  className="mt-4"
                  onClick={handleSaveSmtp}
                  disabled={isSavingSmtp}
                >
                  {isSavingSmtp ? "Saving..." : "Save Email Settings"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="legal" className="space-y-6">
          <div className="grid gap-6">
            {/* Wedding Contract Template */}
            <Card className="max-w-4xl">
              <CardHeader>
                <CardTitle className="text-xl flex items-center justify-between">
                  <span>Wedding Photography & Videography Agreement</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={
                        weddingContractEditorMode === "formatted"
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => setWeddingContractEditorMode("formatted")}
                    >
                      Formatted View
                    </Button>
                    <Button
                      variant={
                        weddingContractEditorMode === "plain"
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => setWeddingContractEditorMode("plain")}
                    >
                      Plain Text / HTML Mode
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  This template is applied to all newly created client proposals
                  and booking contracts. Changes here will NOT affect existing
                  or signed bride contracts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="wedding-contract-template">
                      Bride Contract Template
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const defaultWeddingContract = `<div class="contract-container font-serif">
  <h1 class="text-2xl font-bold uppercase text-center mb-2 tracking-widest border-b pb-4">Wedding Photography &amp; Videography Agreement</h1>
  <p class="mb-4 italic text-muted-foreground text-center">({{company_name}} — {{company_state}})</p>
  <p class="mb-4">This Wedding Agreement ("Agreement") is entered into on <strong>{{date}}</strong> by and between:</p>
  <p class="mb-2"><strong>Client(s):</strong> {{bride_name}} {{partner_name}}</p>
  <p class="mb-6"><strong>Service Provider:</strong> {{company_name}}, an independently owned and operated limited liability company based in {{company_state}} ("Photographer/Videographer").</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-8 mb-3 border-b pb-1">1. Services</h2>
  <p class="mb-3">{{company_name}} agrees to provide professional wedding photography and/or videography services for the Client's event as follows:</p>
  <ul class="list-disc pl-5 space-y-2 mb-4">
    <li><strong>Wedding Date:</strong> {{wedding_date}}</li>
    <li><strong>Venue:</strong> {{venue}} {{venue_address}}</li>
    <li><strong>Package Booked:</strong> {{package_name}}</li>
    <li><strong>Add-ons:</strong> {{add_ons}}</li>
    <li><strong>Assigned Team:</strong> 1 Photographer + 1 Videographer (unless otherwise noted)</li>
  </ul>
  <p class="mb-4">{{company_name}} reserves the right to assign qualified creative professionals from its trusted network to ensure timely, high-quality coverage.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-8 mb-3 border-b pb-1">2. Deliverables</h2>
  <p class="mb-3">The Photographer/Videographer agrees to deliver the following:</p>
  <ul class="list-disc pl-5 space-y-2 mb-4">
    <li>Professionally edited digital photo gallery</li>
    <li>Edited wedding film (highlight + optional documentary/full ceremony edits, depending on package)</li>
  </ul>
  <p class="mb-4"><strong>Delivery Timeline:</strong> Within approximately 3–4 weeks following the wedding date. During high-volume months (such as October), timelines may extend slightly to maintain editing quality.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-8 mb-3 border-b pb-1">3. Payment Terms</h2>
  <p class="mb-3"><strong>Total Investment:</strong> {{total_amount}}</p>
  <p class="mb-3"><strong>Retainer (Non-Refundable):</strong> {{retainer_amount}} due upon signing to reserve your wedding date. The retainer is 50% of the contract value.</p>
  <p class="mb-3"><strong>Remaining Balance:</strong> Due no later than 10 days before the wedding date.</p>
  <p class="mb-3"><strong>Accepted Payments:</strong> Credit Card only (processed securely through {{company_name}}'s online payment system).</p>
  <p class="mb-3">Payments made via credit card include standard merchant processing fees, which are built into the total investment.<br/>Cash, check, or alternative payment methods are not accepted.</p>
  <p class="mb-4">Failure to make timely payments may result in suspension or cancellation of services and forfeiture of the retainer.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-8 mb-3 border-b pb-1">4. Rescheduling &amp; Cancellation</h2>
  <p class="mb-3"><strong>Rescheduling:</strong> The retainer may be applied to a new wedding date, subject to availability.</p>
  <p class="mb-3"><strong>Cancellation:</strong> The retainer is non-refundable. Any additional payments made beyond the retainer will be refunded if cancellation occurs.</p>
  <p class="mb-4">If {{company_name}} must cancel due to emergency or unforeseen circumstances, all payments made by the Client will be refunded in full, and best efforts will be made to assist in finding an alternate provider.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-8 mb-3 border-b pb-1">5. Creative Rights</h2>
  <p class="mb-3">The Client acknowledges that {{company_name}} maintains complete creative control over style, editing, and artistic decisions. The Client has reviewed the company's portfolio and understands the creative nature of the work.</p>
  <p class="mb-4">All photographs and videos remain the copyrighted property of {{company_name}}, which grants the Client a perpetual, non-exclusive, personal-use license to download, print, share, and display the media for personal use.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-8 mb-3 border-b pb-1">6. Substitutions &amp; Liability</h2>
  <p class="mb-3">If a scheduled Photographer or Videographer is unable to attend due to illness, emergency, or unforeseen event, {{company_name}} will provide a qualified replacement whenever possible.</p>
  <p class="mb-3">{{company_name}} is not responsible for circumstances beyond reasonable control (e.g., weather, equipment failure, venue restrictions, or interference by guests).</p>
  <p class="mb-4">Liability is limited to the return of all payments received.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-8 mb-3 border-b pb-1">7. Client Cooperation</h2>
  <p class="mb-4">The Client agrees to provide a safe and cooperative environment for all team members. The Client understands that full cooperation—including adherence to schedules, communication, and participation from key individuals—directly impacts the final quality of results.</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-8 mb-3 border-b pb-1">8. Model Release</h2>
  <p class="mb-3">The Client grants {{company_name}} permission to use images and/or video clips from the event for portfolio, social media, website, and promotional use.</p>
  <p class="mb-4">(Optional: Clients may request in writing to opt out prior to the wedding date.)</p>

  <h2 class="text-lg font-semibold uppercase tracking-wider mt-8 mb-3 border-b pb-1">9. Entire Agreement</h2>
  <p class="mb-4">This Agreement represents the full understanding between the Client and {{company_name}}. Any modifications or additions must be made in writing and signed by both parties.</p>
  <p class="mt-10 mb-4"><strong>Client(s) Signature:</strong> ____________________________ &nbsp;&nbsp; <strong>Date:</strong> ____________</p>
</div>`;
                          setWeddingContractTemplate(defaultWeddingContract);
                        }}
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
                            <DialogTitle>Wedding Agreement Preview</DialogTitle>
                          </DialogHeader>
                          <div
                            className="mt-4 border rounded-xl p-8 bg-white text-black prose prose-sm max-w-none shadow-sm font-serif"
                            dangerouslySetInnerHTML={{
                              __html: getPreviewHtml(weddingContractTemplate),
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {weddingContractEditorMode === "formatted" ? (
                    <div className="border rounded-md overflow-hidden">
                      <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">
                          Live Preview (read-only)
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setWeddingContractEditorMode("plain")}
                        >
                          Switch to Edit Mode
                        </Button>
                      </div>
                      <div
                        className="p-8 bg-white text-black prose prose-sm max-w-none shadow-sm font-serif max-h-[450px] overflow-y-auto contract-content"
                        dangerouslySetInnerHTML={{
                          __html:
                            getPreviewHtml(weddingContractTemplate) ||
                            "<p class='text-muted-foreground italic'>No template set. Click 'Load Standard Default' or switch to edit mode.</p>",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="border rounded-md p-4 bg-background space-y-3">
                      <p className="text-xs text-muted-foreground italic">
                        Edit your contract in HTML below. Switch to Formatted
                        View to see a live preview.
                      </p>
                      <Textarea
                        id="wedding-contract-template-plain"
                        placeholder="Type or paste your wedding contract in plain text or HTML..."
                        className="min-h-[450px] font-mono text-sm leading-relaxed"
                        value={weddingContractTemplate}
                        onChange={(e) =>
                          setWeddingContractTemplate(e.target.value)
                        }
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
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {"{{city}}"}
                      </code>
                      ,{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {"{{state}}"}
                      </code>
                      ,{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {"{{package_name}}"}
                      </code>
                      ,{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {"{{add_ons}}"}
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
                        {"{{date}}"}
                      </code>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contractor Agreement */}
            <Card className="max-w-4xl">
              <CardHeader>
                <CardTitle className="text-xl flex items-center justify-between">
                  <span>Independent Contractor Agreement</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={
                        contractEditorMode === "formatted"
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => setContractEditorMode("formatted")}
                    >
                      Formatted View
                    </Button>
                    <Button
                      variant={
                        contractEditorMode === "plain" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setContractEditorMode("plain")}
                    >
                      Plain Text / HTML Mode
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  This text will be displayed to applicants in the Paperwork
                  stage for digital signature.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="contract-template">
                      Agreement Template
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newTemplate = `<div class="contract-container">
  <h1 class="text-3xl font-bold text-center mb-8 uppercase tracking-widest border-b pb-4">Independent Contractor Agreement</h1>
  <div class="mb-8 text-center italic text-muted-foreground">
    <p>Company: <span class="font-semibold text-foreground">{{company_name}}</span></p>
    <p>Effective Date: <span class="font-semibold text-foreground">{{date}}</span></p>
  </div>
  <p class="mb-6 leading-relaxed">
    This Independent Contractor Agreement ("Agreement") is entered into by and between 
    <span class="font-semibold">{{company_name}}</span> ("Company") and 
    <span class="font-semibold">{{contractor_name}}</span> ("Contractor").
  </p>
</div>`;
                          setContractTemplate(newTemplate);
                        }}
                      >
                        Load Brand Default
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm">
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Agreement Preview</DialogTitle>
                          </DialogHeader>
                          <div
                            className="mt-4 border rounded-xl p-10 bg-white text-black prose prose-sm max-w-none shadow-sm"
                            dangerouslySetInnerHTML={{
                              __html: getPreviewHtml(contractTemplate),
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  {contractEditorMode === "formatted" ? (
                    <div className="border rounded-md overflow-hidden">
                      <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">
                          Live Preview (read-only)
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setContractEditorMode("plain")}
                        >
                          Switch to Edit Mode
                        </Button>
                      </div>
                      <div
                        className="p-8 bg-white text-black prose prose-sm max-w-none shadow-sm max-h-[400px] overflow-y-auto contract-content"
                        dangerouslySetInnerHTML={{
                          __html:
                            getPreviewHtml(contractTemplate) ||
                            "<p class='text-muted-foreground italic'>No template set. Click 'Load Brand Default' or switch to edit mode.</p>",
                        }}
                      />
                    </div>
                  ) : (
                    <Textarea
                      id="contract-template"
                      placeholder="Enter your legal agreement text here..."
                      className="min-h-[400px] font-mono text-sm leading-relaxed"
                      value={contractTemplate}
                      onChange={(e) => setContractTemplate(e.target.value)}
                    />
                  )}
                  <div className="flex flex-col gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">
                      Available variables:{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {"{{company_name}}"}
                      </code>
                      ,{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {"{{contractor_name}}"}
                      </code>
                      ,{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {"{{date}}"}
                      </code>
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button onClick={handleSaveLegal} disabled={isSavingLegal}>
                    {isSavingLegal ? "Saving..." : "Save Legal Agreements"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="coupons">{renderCouponsTab()}</TabsContent>
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Outbox & System Logs</CardTitle>
                <CardDescription>
                  View a history of automated text messages, emails, and API
                  requests. Retry failed messages here.
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <Tabs
                  value={logsTab}
                  onValueChange={(v: any) => setLogsTab(v)}
                  className="w-[300px]"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="sms">Sent</TabsTrigger>
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="api">API</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadLogs}
                  disabled={isLoadingLogs}
                >
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logsTab === "upcoming" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingLogs.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No upcoming automations scheduled.
                        </TableCell>
                      </TableRow>
                    ) : (
                      upcomingLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDisplayDate(log.scheduled_for)}
                            <br />
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {log.recipient_name}
                            </span>
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {log.recipient_email}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.description}</Badge>
                          </TableCell>
                          <TableCell
                            className="max-w-xs truncate"
                            title={log.message}
                          >
                            {log.message}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : logsTab === "sms" ? (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Select
                      value={messageFilter}
                      onValueChange={(v: any) => setMessageFilter(v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Messages</SelectItem>
                        <SelectItem value="success">
                          Sent Successfully
                        </SelectItem>
                        <SelectItem value="error">Failed Messages</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {smsLogs.filter(
                        (l) =>
                          messageFilter === "all" || l.status === messageFilter,
                      ).length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No messages found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        smsLogs
                          .filter(
                            (l) =>
                              messageFilter === "all" ||
                              l.status === messageFilter,
                          )
                          .map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap">
                                {formatDisplayDate(log.created_at)}
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(log.created_at)}
                                </span>
                              </TableCell>
                              <TableCell>{log.recipient_email}</TableCell>
                              <TableCell
                                className="max-w-xs truncate"
                                title={log.message}
                              >
                                {log.message.startsWith("[EMAIL:") ? (
                                  <>
                                    <Badge
                                      variant="outline"
                                      className="mr-2 text-[10px]"
                                    >
                                      EMAIL
                                    </Badge>
                                    {log.message.replace(
                                      /\[EMAIL:\s*.*?\]\n/,
                                      "",
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <Badge
                                      variant="outline"
                                      className="mr-2 text-[10px]"
                                    >
                                      SMS
                                    </Badge>
                                    {log.message}
                                  </>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.status === "success"
                                      ? "default"
                                      : "destructive"
                                  }
                                >
                                  {log.status}
                                </Badge>
                                {log.error_details && (
                                  <p
                                    className="text-xs text-destructive mt-1 max-w-[200px] truncate"
                                    title={log.error_details}
                                  >
                                    {log.error_details}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {log.status === "error" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRetryMessage(log)}
                                    disabled={isRetrying === log.id}
                                  >
                                    {isRetrying === log.id
                                      ? "Retrying..."
                                      : "Retry"}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiLogs.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No API logs found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      apiLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDisplayDate(log.created_at)}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {formatTime(log.created_at)}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.endpoint}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                log.status === "success"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>API Request Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  {log.error_details && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1 text-destructive">
                                        Error
                                      </h4>
                                      <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap">
                                        {log.error_details}
                                      </pre>
                                    </div>
                                  )}
                                  <div>
                                    <h4 className="font-semibold text-sm mb-1">
                                      Payload
                                    </h4>
                                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                      {log.payload
                                        ? JSON.stringify(
                                            JSON.parse(log.payload),
                                            null,
                                            2,
                                          )
                                        : "None"}
                                    </pre>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm mb-1">
                                      Response
                                    </h4>
                                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                      {log.response ? log.response : "None"}
                                    </pre>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmailPreviewModal
        open={testPreviewOpen}
        onOpenChange={setTestPreviewOpen}
        emailData={
          testPreviewData
            ? {
                to: testPreviewData.to,
                subject: testPreviewData.subject,
                html: testPreviewData.html,
                recipientName: testPreviewData.recipientName,
              }
            : null
        }
        onConfirm={async () => {
          if (testPreviewData?.sendFn) {
            try {
              await testPreviewData.sendFn();
              toast({
                title: "Test Email Sent!",
                description: `Successfully sent to ${testPreviewData.to}`,
              });
            } catch (err: any) {
              toast({
                variant: "destructive",
                title: "Test Failed",
                description: err.message || "Failed to send via Ovanta.",
              });
              throw err;
            }
          }
        }}
      />
    </div>
  );
}

// --- Package Editor (inline component for Settings pricing tab) ---
function PackageEditor({
  pkg,
  onSave,
  onCancel,
  isSaving,
}: {
  pkg: any;
  onSave: (p: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(pkg.name || "");
  const [description, setDescription] = useState(
    pkg.desc || pkg.description || "",
  );
  const [priceBoth, setPriceBoth] = useState(pkg.priceBoth || 0);
  const [priceSingle, setPriceSingle] = useState(pkg.priceSingle || 0);
  const [photoFeatures, setPhotoFeatures] = useState<string[]>(
    pkg.photoFeatures || [],
  );
  const [videoFeatures, setVideoFeatures] = useState<string[]>(
    pkg.videoFeatures || [],
  );
  const [isArchived, setIsArchived] = useState(pkg.isArchived || false);
  const [newPhoto, setNewPhoto] = useState("");
  const [newVideo, setNewVideo] = useState("");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Package Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Diamond Special"
          />
        </div>
        <div className="grid gap-2">
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 8 hours"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Price (Photo & Video)</Label>
          <Input
            type="number"
            value={priceBoth}
            onChange={(e) => setPriceBoth(Number(e.target.value))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Price (Photo OR Video only)</Label>
          <Input
            type="number"
            value={priceSingle}
            onChange={(e) => setPriceSingle(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Photo Features</Label>
        <div className="space-y-2">
          {photoFeatures.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={f}
                onChange={(e) => {
                  const arr = [...photoFeatures];
                  arr[i] = e.target.value;
                  setPhotoFeatures(arr);
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setPhotoFeatures(photoFeatures.filter((_, idx) => idx !== i))
                }
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newPhoto}
              onChange={(e) => setNewPhoto(e.target.value)}
              placeholder="Add photo feature..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newPhoto.trim()) {
                    setPhotoFeatures([...photoFeatures, newPhoto.trim()]);
                    setNewPhoto("");
                  }
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (newPhoto.trim()) {
                  setPhotoFeatures([...photoFeatures, newPhoto.trim()]);
                  setNewPhoto("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Video Features</Label>
        <div className="space-y-2">
          {videoFeatures.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={f}
                onChange={(e) => {
                  const arr = [...videoFeatures];
                  arr[i] = e.target.value;
                  setVideoFeatures(arr);
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setVideoFeatures(videoFeatures.filter((_, idx) => idx !== i))
                }
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newVideo}
              onChange={(e) => setNewVideo(e.target.value)}
              placeholder="Add video feature..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newVideo.trim()) {
                    setVideoFeatures([...videoFeatures, newVideo.trim()]);
                    setNewVideo("");
                  }
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (newVideo.trim()) {
                  setVideoFeatures([...videoFeatures, newVideo.trim()]);
                  setNewVideo("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={isArchived} onCheckedChange={setIsArchived} />
        <Label className="cursor-pointer">
          Archived (hidden from new bookings, still works on existing proposals)
        </Label>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSave({
              id: pkg.id || undefined,
              name,
              description,
              priceBoth,
              priceSingle,
              photoFeatures,
              videoFeatures,
              isArchived,
            })
          }
          disabled={isSaving || !name.trim()}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Package
        </Button>
      </DialogFooter>
    </div>
  );
}

// --- Addon Editor ---
function AddonEditor({
  addon,
  onSave,
  onCancel,
  isSaving,
}: {
  addon: any;
  onSave: (a: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(addon.name || "");
  const [price, setPrice] = useState(addon.price || 0);
  const [isHourly, setIsHourly] = useState(addon.isHourly || false);
  const [minHours, setMinHours] = useState(addon.minHours || 0);
  const [isArchived, setIsArchived] = useState(addon.isArchived || false);
  const [isBartending, setIsBartending] = useState(addon.isBartending || false);
  const [description, setDescription] = useState(addon.description || "");
  const [features, setFeatures] = useState<string[]>(addon.features || []);
  const [featureInput, setFeatureInput] = useState("");

  const addFeature = () => {
    if (!featureInput.trim()) return;
    setFeatures([...features, featureInput.trim()]);
    setFeatureInput("");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Addon Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aerial Drone Footage"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Price ($)</Label>
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Min Hours (if hourly)</Label>
          <Input
            type="number"
            value={minHours}
            onChange={(e) => setMinHours(Number(e.target.value))}
            disabled={!isHourly}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isHourly} onCheckedChange={setIsHourly} />
        <Label className="cursor-pointer">Hourly rate</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isArchived} onCheckedChange={setIsArchived} />
        <Label className="cursor-pointer">Archived</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isBartending} onCheckedChange={setIsBartending} />
        <Label className="cursor-pointer">
          Bartending upsell (show in bride portal)
        </Label>
      </div>
      {isBartending && (
        <>
          <div className="grid gap-2">
            <Label>Portal Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Up to 4 hours of service with 1 certified bartender"
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label>Portal Features</Label>
            <div className="flex gap-2">
              <Input
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFeature();
                  }
                }}
                placeholder="Add a feature and press Enter"
              />
              <Button type="button" variant="outline" onClick={addFeature}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {features.length > 0 && (
              <ul className="text-sm space-y-1 mt-2">
                {features.map((ft, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between bg-muted/30 rounded px-2 py-1"
                  >
                    <span>{ft}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() =>
                        setFeatures(features.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSave({
              id: addon.id,
              name,
              price,
              isHourly,
              minHours,
              isArchived,
              isBartending,
              description,
              features,
            })
          }
          disabled={isSaving || !name.trim()}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Addon
        </Button>
      </DialogFooter>
    </div>
  );
}
