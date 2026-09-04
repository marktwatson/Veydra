import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Plus,
  Loader2,
  CheckCircle,
  Trash2,
  CalendarDays,
  AlertTriangle,
  DollarSign,
  ListChecks,
  List,
  LayoutGrid,
  Send,
  Upload,
  Link as LinkIcon,
  Info,
  Copy,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  Music,
  MessageSquare,
  Calendar,
  MapPin,
  Clock,
  AlertCircle,
  Bell,
  Users,
  FileText,
  ArrowUpDown,
  Rows3,
  CalendarCheck,
  Search,
  Wine,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, DbWedding } from "@/lib/api";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  cn,
  parseTimeTo24Hour,
  formatTime,
  getRateCalculationTooltip,
  formatPhoneNumber,
  formatDisplayDate,
  generatePaymentSchedule,
  generateHTMLReceipt,
  DEFAULT_LOGO_URL,
  getCompanyTimezone,
} from "@/lib/utils";
import PositionsTab from "./Positions";
import { CallSheetGenerator } from "@/components/CallSheetGenerator";
import { ContractModal } from "@/components/ContractModal";
import { CancelWeddingModal } from "@/components/CancelWeddingModal";
import EmailPreviewModal, {
  EmailPreviewData,
} from "@/components/EmailPreviewModal";
import { ChangePaymentPlanDialog } from "@/components/ChangePaymentPlanDialog";
import { BartendingUpsellDialog } from "@/components/BartendingUpsellDialog";
import { useBartendingModule } from "@/hooks/use-bartending-module";
import { ChangePendingBadge } from "@/components/ChangePendingBadge";
import { WeddingActionsMenu } from "@/components/WeddingActionsMenu";
const VIDEO_PRICING = [
  { id: "highlight_9_10", label: "Wedding Highlight (9-10 min)", price: 190 },
  { id: "highlight_7_8", label: "Wedding Highlight (7-8 min)", price: 170 },
  { id: "highlight_5_6", label: "Wedding Highlight (5-6 min)", price: 150 },
  { id: "highlight_3_4", label: "Wedding Highlight (3-4 min)", price: 130 },
  { id: "highlight_1_2", label: "Wedding Highlight (1-2 min)", price: 110 },
  { id: "social_teaser", label: "Social Media Teaser (≤1min)", price: 80 },
  { id: "ceremony_30", label: "Ceremony Reel (≤30 mins)", price: 70 },
  { id: "ceremony_60", label: "Ceremony Reel (≤60 mins)", price: 110 },
  { id: "speeches", label: "Speeches & Toasts Reel", price: 70 },
  { id: "other_reel", label: "Other Wedding Reels (≤30 mins)", price: 50 },
  { id: "long_highlight", label: "Long Highlight (11-15mins)", price: 230 },
  { id: "doc_16_30", label: "Documentary (16-30mins)", price: 260 },
  { id: "doc_31_60", label: "Documentary (31-60mins)", price: 290 },
];

const PACKAGES = [
  { id: "pearl", name: "Pearl", isArchived: true },
  { id: "emerald", name: "Emerald", isArchived: true },
  { id: "diamond", name: "Diamond Special", isArchived: true },
  { id: "platinum", name: "Platinum", isArchived: true },
  { id: "all_in_bride", name: "All-In Bride" },
];

const ADDONS = [
  { id: "audio", name: "Audio of Vows & Speeches", isArchived: true },
  { id: "drone", name: "Aerial Drone Footage", isArchived: true },
  { id: "second_shooter", name: "2nd Shooter", isArchived: true },
  { id: "raw", name: "4K RAW Footage Delivery", isArchived: true },
  { id: "highlight_30", name: "30-Min Highlight Video", isArchived: true },
  { id: "highlight_60", name: "60-Min Highlight Video", isArchived: true },
  { id: "extra_session", name: "Extra Session", isArchived: true },
  { id: "drone_new", name: "Aerial Drone Footage" },
  { id: "second_shooter_new", name: "2nd Shooter (up to 10 hours)" },
];

// Module-level cache that sub-components can reference; updated by ManagerWeddings on DB load
let DB_PACKAGES: any[] = PACKAGES;
let DB_ADDONS: any[] = ADDONS;

function ImportWeddingsDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDownloadTemplate = () => {
    const headers = [
      "Client Name",
      "Date (YYYY-MM-DD)",
      "Location",
      "Region",
      "Notes",
    ];
    const sampleRow = [
      "Smith & Jones",
      "2024-10-15",
      "Austin, TX",
      "Austin",
      "Outdoor ceremony",
    ];
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "weddings_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (str: string) => {
    const arr: string[][] = [];
    let quote = false;
    for (let row = 0, col = 0, c = 0; c < str.length; c++) {
      let cc = str[c],
        nc = str[c + 1];
      arr[row] = arr[row] || [];
      arr[row][col] = arr[row][col] || "";

      if (cc == '"' && quote && nc == '"') {
        arr[row][col] += cc;
        ++c;
        continue;
      }
      if (cc == '"') {
        quote = !quote;
        continue;
      }
      if (cc == "," && !quote) {
        ++col;
        continue;
      }
      if (cc == "\r" && nc == "\n" && !quote) {
        ++row;
        col = 0;
        ++c;
        continue;
      }
      if (cc == "\n" && !quote) {
        ++row;
        col = 0;
        continue;
      }
      if (cc == "\r" && !quote) {
        ++row;
        col = 0;
        continue;
      }
      arr[row][col] += cc;
    }
    return arr;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);

        if (rows.length < 2) {
          throw new Error("CSV file is empty or missing data rows");
        }

        const headers = rows[0].map((h: string) => h.toLowerCase().trim());
        const nameIdx = headers.findIndex(
          (h: string) => h.includes("name") || h.includes("client"),
        );
        const dateIdx = headers.findIndex((h: string) => h.includes("date"));
        const locIdx = headers.findIndex(
          (h: string) => h.includes("location") || h.includes("city"),
        );
        const regIdx = headers.findIndex((h: string) => h.includes("region"));
        const notesIdx = headers.findIndex((h: string) => h.includes("note"));

        if (nameIdx === -1 || dateIdx === -1 || locIdx === -1) {
          throw new Error("Missing required columns. Please use the template.");
        }

        let successCount = 0;
        let errorCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[nameIdx]) continue;

          try {
            await api.createWedding({
              client_name: row[nameIdx].trim(),
              date: row[dateIdx].trim(),
              location: row[locIdx].trim(),
              region:
                regIdx !== -1 && row[regIdx] ? [row[regIdx].trim()] : null,
              notes:
                notesIdx !== -1 && row[notesIdx] ? row[notesIdx].trim() : null,
              status: "upcoming",
            });
            successCount++;
          } catch (err) {
            console.error("Failed to import row", i, err);
            errorCount++;
          }
        }

        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} weddings. ${errorCount > 0 ? `Failed to import ${errorCount} rows.` : ""}`,
        });

        queryClient.invalidateQueries({ queryKey: ["weddings"] });
        setIsOpen(false);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: error.message || "Failed to parse CSV file",
        });
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = "";
      }
    };

    reader.readAsText(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Weddings</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import weddings. Download the template
            first to ensure correct formatting.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            variant="secondary"
            onClick={handleDownloadTemplate}
            className="w-full"
          >
            Download CSV Template
          </Button>
          <div className="relative">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isImporting}
              className="cursor-pointer"
            />
            {isImporting && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewWeddingDialog({
  wedding,
  onPublish,
}: {
  wedding: any;
  onPublish: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [clientName, setClientName] = useState(wedding.client_name);
  const [date, setDate] = useState(
    wedding.date ? wedding.date.split("T")[0] : "",
  );
  const [location, setLocation] = useState(wedding.location);
  const [region, setRegion] = useState(
    Array.isArray(wedding.region)
      ? wedding.region[0] || ""
      : wedding.region || "",
  );
  const [weddingPackage, setWeddingPackage] = useState("");
  const [weddingAddons, setWeddingAddons] = useState("");

  const notesParts = (wedding.notes || "").split("--- Raw Data Backup ---");
  const initialNotes = notesParts[0].trim();
  const rawData = notesParts.length > 1 ? notesParts[1].trim() : null;

  const [notes, setNotes] = useState(initialNotes);
  const [totalAmount, setTotalAmount] = useState<number>(
    wedding.total_amount || 0,
  );
  const [paidAmount, setPaidAmount] = useState<number>(
    wedding.paid_amount || 0,
  );
  const [stripeCustomerId, setStripeCustomerId] = useState<string>(
    wedding.stripe_customer_id || "",
  );
  const [isSyncingStripe, setIsSyncingStripe] = useState(false);

  useEffect(() => {
    if (wedding) {
      setWeddingPackage(
        PACKAGES.find((p) => p.id === wedding.package)?.name ||
          wedding.package ||
          "",
      );
      setWeddingAddons(
        Array.isArray(wedding.addons)
          ? wedding.addons
              .map((id: string) => ADDONS.find((a) => a.id === id)?.name || id)
              .join(", ")
          : wedding.addons || "",
      );
    }
  }, [wedding]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSyncStripe = async (showToast = true) => {
    setIsSyncingStripe(true);
    try {
      // Always re-fetch from DB first to pick up any manual edits
      const { data: freshWedding } = await supabase
        .from("weddings")
        .select("stripe_customer_id, client_email, questionnaire_data")
        .eq("id", wedding.id)
        .single();

      const dbCustomerId = (freshWedding?.stripe_customer_id || "").trim();
      const dbEmail = (
        freshWedding?.client_email ||
        (freshWedding?.questionnaire_data as any)?.contact_info?.email ||
        ""
      ).trim();

      // Update local state if DB has a new ID
      if (dbCustomerId && dbCustomerId !== stripeCustomerId) {
        setStripeCustomerId(dbCustomerId);
      }

      const effectiveCustomerId = (stripeCustomerId || dbCustomerId).trim();
      const effectiveEmail = (wedding.client_email || dbEmail).trim();

      if (!effectiveCustomerId && !effectiveEmail) {
        if (showToast)
          toast({
            variant: "destructive",
            title: "No Customer Info",
            description:
              "No Stripe Customer ID or email on file for this wedding.",
          });
        return;
      }

      console.log(
        "[Stripe Sync] Using customer ID:",
        JSON.stringify(effectiveCustomerId),
        "email:",
        JSON.stringify(effectiveEmail),
      );

      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          customerId: effectiveCustomerId,
          customerEmail: effectiveEmail,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        console.error("[Stripe Sync] HTTP error:", res.status, errText);
        throw new Error(`Stripe API error: ${res.status}`);
      }
      const data = await res.json();
      console.log("[Stripe Sync] Response:", data);

      if (data) {
        if (data.customerId) setStripeCustomerId(data.customerId);
        if (typeof data.totalPaid === "number" && data.totalPaid > 0) {
          setPaidAmount(data.totalPaid);
          if (showToast)
            toast({
              title: "Stripe Synced!",
              description: `Found $${data.totalPaid.toLocaleString()} paid in Stripe.`,
            });
        } else if (showToast) {
          // Show more helpful message with customer ID for debugging
          toast({
            title: "Stripe Checked",
            description: `No paid transactions found${effectiveCustomerId ? ` for ${effectiveCustomerId}` : ""}. Verify the ID matches your live Stripe dashboard.`,
            variant: "default",
          });
        }
      }
    } catch (err: any) {
      console.error("[Stripe Sync] Error:", err);
      if (showToast)
        toast({
          variant: "destructive",
          title: "Sync Failed",
          description: err.message,
        });
    } finally {
      setIsSyncingStripe(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleSyncStripe(false);
    }
  }, [isOpen]);

  const [jobs, setJobs] = useState<
    {
      role: string;
      pay_rate: number;
      pay_type: "flat" | "bidding";
      hours: number | null;
      addons?: string[];
    }[]
  >(() => [
    {
      role: "Lead Videographer",
      pay_rate: 500,
      pay_type: "flat",
      hours: null,
      addons: [],
    },
  ]);

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
  });
  const regions = Array.isArray(settings?.regions) ? settings.regions : [];

  const updateWeddingMutation = useMutation({
    mutationFn: async () => {
      for (const job of jobs) {
        await api.createJob({
          wedding_id: wedding.id,
          role: job.role,
          pay_type: job.pay_type,
          pay_rate: job.pay_rate || 0,
          hours: job.hours,
          addons: job.addons || [],
          status: "open",
          requirements: "",
        });
      }

      const fullNotes = rawData
        ? `${notes}\n\n--- Raw Data Backup ---\n${rawData}`
        : notes;

      await api.updateWedding(wedding.id, {
        status: "upcoming",
        region: region ? [region] : null,
        client_name: clientName,
        date: date,
        location: location,
        notes: fullNotes,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        stripe_customer_id: stripeCustomerId || null,
        package: weddingPackage,
        addons: weddingAddons
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      } as any);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setIsOpen(false);
      onPublish();
      toast({
        title: "Wedding Published",
        description: "The wedding and its jobs are now live.",
      });

      // Welcome & Questionnaire email — sent once on publish (pending -> upcoming).
      // Guarded by `welcome_email_sent` so it never double-sends if a wedding is
      // re-published or the daily cron runs later.
      const brideEmail =
        wedding.client_email ||
        (wedding.questionnaire_data as any)?.contact_info?.email;
      const welcomeAlreadySent = (wedding as any).welcome_email_sent === true;
      if (brideEmail && !welcomeAlreadySent) {
        try {
          let sentAny = false;

          // SMS
          if (
            settings?.sms_bride_welcome_enabled &&
            settings?.sms_bride_welcome_template
          ) {
            const smsMsg = settings.sms_bride_welcome_template
              .replace(/{{company_name}}/g, settings.company_name || "us")
              .replace(/{{bride_name}}/g, clientName || "Bride")
              .replace(
                /{{portal_link}}/g,
                `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/bride-portal/${wedding.id}`,
              );
            await api
              .sendOvantaSms(brideEmail, smsMsg, clientName)
              .catch(() => {});
            sentAny = true;
          }

          // Email
          if (
            settings?.email_bride_welcome_enabled &&
            settings?.email_bride_welcome_template &&
            settings?.email_bride_welcome_subject
          ) {
            const subject = settings.email_bride_welcome_subject
              .replace(/{{company_name}}/g, settings.company_name || "us")
              .replace(/{{bride_name}}/g, clientName || "Bride");
            const msg = settings.email_bride_welcome_template
              .replace(/{{company_name}}/g, settings.company_name || "us")
              .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
              .replace(/{{bride_name}}/g, clientName || "Bride")
              .replace(
                /{{portal_link}}/g,
                `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/bride-portal/${wedding.id}`,
              );
            await api.sendOvantaEmail(
              brideEmail,
              subject,
              msg,
              clientName,
              true,
            );
            sentAny = true;
          }

          // Mark as sent so it never fires again (publish re-clicks, cron, etc.)
          await api.updateWedding(wedding.id, {
            welcome_email_sent: true,
          } as any);

          if (sentAny) {
            toast({
              title: "Welcome Email Sent",
              description: `Welcome & questionnaire email sent to ${brideEmail}`,
            });
          }
        } catch (err: any) {
          toast({
            variant: "destructive",
            title: "Welcome Email Failed",
            description: err.message,
          });
        }
      }

      // Reschedule offset notifications (pre-wedding, day-after, rating) for
      // this wedding now that it's published. The next scheduler worker tick
      // will recreate the pending jobs with correct run_at values.
      api.rescheduleWeddingJobs(wedding.id).catch(() => {});
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to publish wedding",
        description: error.message,
      });
    },
  });

  const handlePublish = () => {
    updateWeddingMutation.mutate();
  };

  const addJob = () => {
    setJobs([
      ...jobs,
      {
        role: "Second Videographer",
        pay_rate: 300,
        pay_type: "flat",
        hours: null,
        addons: [],
      },
    ]);
  };

  const toggleAddon = (index: number, addon: string) => {
    const newJobs = [...jobs];
    const job = newJobs[index];
    const addons = job.addons || [];
    const hasAddon = addons.includes(addon);

    if (hasAddon) {
      job.addons = addons.filter((a) => a !== addon);
      if (addon === "Engagements" || addon === "Bridals")
        job.hours = (job.hours || 0) - 1.5;
      if (addon === "Drone Operator") job.pay_rate = (job.pay_rate || 0) - 50;
      if (addon === "Audio & Vows") job.pay_rate = (job.pay_rate || 0) - 25;
    } else {
      job.addons = [...addons, addon];
      if (addon === "Engagements" || addon === "Bridals")
        job.hours = (job.hours || 0) + 1.5;
      if (addon === "Drone Operator") job.pay_rate = (job.pay_rate || 0) + 50;
      if (addon === "Audio & Vows") job.pay_rate = (job.pay_rate || 0) + 25;
    }
    setJobs(newJobs);
  };

  const removeJob = (index: number) => {
    setJobs(jobs.filter((_, i) => i !== index));
  };

  const updateJob = (
    index: number,
    field: "role" | "pay_rate" | "pay_type" | "hours",
    value: any,
  ) => {
    const newJobs = [...jobs];
    newJobs[index] = { ...newJobs[index], [field]: value };

    if (
      (field === "hours" || field === "role" || field === "pay_type") &&
      newJobs[index].hours &&
      newJobs[index].pay_type === "flat"
    ) {
      const role = newJobs[index].role?.toLowerCase() || "";
      if (role.includes("photo") && settings?.photo_pay_rate != null) {
        newJobs[index].pay_rate =
          newJobs[index].hours * settings.photo_pay_rate;
      } else if (role.includes("video") && settings?.video_pay_rate != null) {
        newJobs[index].pay_rate =
          newJobs[index].hours * settings.video_pay_rate;
      }
    }
    setJobs(newJobs);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          Review & Publish
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Wedding</DialogTitle>
          <DialogDescription>
            Review the details and add required positions before publishing.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Client
              </Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Location
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Total Investment ($)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={totalAmount || ""}
                onChange={(e) =>
                  setTotalAmount(parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-muted-foreground font-medium">
                  Paid Amount ($)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-primary px-2"
                  onClick={() => handleSyncStripe(true)}
                  disabled={isSyncingStripe}
                >
                  <RefreshCw
                    className={cn(
                      "h-3 w-3 mr-1",
                      isSyncingStripe && "animate-spin",
                    )}
                  />
                  Sync Stripe
                </Button>
              </div>
              <Input
                type="number"
                step="0.01"
                value={paidAmount || 0}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-muted-foreground font-medium">
                Region
              </Label>
              <Select value={region || undefined} onValueChange={setRegion}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Select a region..." />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r: string) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Package
              </Label>
              <Input
                value={weddingPackage}
                onChange={(e) => setWeddingPackage(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Addons
              </Label>
              <Input
                value={weddingAddons}
                onChange={(e) => setWeddingAddons(e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-muted-foreground font-medium">
                Notes & Details
              </Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold">Required Positions</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addJob}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Position
              </Button>
            </div>
            {jobs.map((job, index) => (
              <div
                key={index}
                className="flex flex-col gap-4 bg-muted/20 p-4 rounded-xl border relative shadow-sm"
              >
                <div className="absolute top-3 right-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeJob(index)}
                    disabled={jobs.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2 pr-10">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Role
                    </Label>
                    <Select
                      value={job.role}
                      onValueChange={(val) => updateJob(index, "role", val)}
                    >
                      <SelectTrigger className="h-9 w-full font-medium">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lead Photographer">
                          Lead Photographer
                        </SelectItem>
                        <SelectItem value="Second Photographer">
                          Second Photographer
                        </SelectItem>
                        <SelectItem value="Lead Videographer">
                          Lead Videographer
                        </SelectItem>
                        <SelectItem value="Second Videographer">
                          Second Videographer
                        </SelectItem>
                        <SelectItem value="Content Creator">
                          Content Creator
                        </SelectItem>
                        <SelectItem value="Drone Operator">
                          Drone Operator
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Hours
                    </Label>
                    <Input
                      type="number"
                      value={job.hours || ""}
                      onChange={(e) =>
                        updateJob(
                          index,
                          "hours",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      placeholder="Hrs"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {job.pay_type === "bidding"
                        ? "Budget ($)"
                        : "Pay Rate ($)"}
                    </Label>
                    {job.pay_type === "flat" ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          type="number"
                          value={job.pay_rate}
                          onChange={(e) =>
                            updateJob(index, "pay_rate", Number(e.target.value))
                          }
                          className="h-9 pl-7"
                          required
                        />
                      </div>
                    ) : (
                      <div className="h-9"></div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Pay Type
                    </Label>
                    <Select
                      value={job.pay_type || "flat"}
                      onValueChange={(val: any) =>
                        updateJob(index, "pay_type", val)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Pay Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate</SelectItem>
                        <SelectItem value="bidding">Bidding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border/50">
                  {job.role?.toLowerCase().includes("photo") && (
                    <>
                      <Badge
                        variant={
                          job.addons?.includes("Engagements")
                            ? "default"
                            : "secondary"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleAddon(index, "Engagements")}
                      >
                        + Engagements
                      </Badge>
                      <Badge
                        variant={
                          job.addons?.includes("Bridals")
                            ? "default"
                            : "secondary"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleAddon(index, "Bridals")}
                      >
                        + Bridals
                      </Badge>
                    </>
                  )}
                  {job.role?.toLowerCase().includes("video") && (
                    <>
                      <Badge
                        variant={
                          job.addons?.includes("Drone Operator")
                            ? "default"
                            : "secondary"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleAddon(index, "Drone Operator")}
                      >
                        + Drone Operator
                      </Badge>
                      <Badge
                        variant={
                          job.addons?.includes("Audio & Vows")
                            ? "default"
                            : "secondary"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleAddon(index, "Audio & Vows")}
                      >
                        + Audio & Vows
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={updateWeddingMutation.isPending}
          >
            {updateWeddingMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Publish Wedding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ManageWeddingSheet({
  wedding,
  trigger,
}: {
  wedding: any;
  trigger?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clientName, setClientName] = useState(wedding.client_name);
  const [partnerName, setPartnerName] = useState(wedding.partner_name || "");
  const [clientEmail, setClientEmail] = useState(wedding.client_email || "");
  const [date, setDate] = useState(
    wedding.date ? wedding.date.split("T")[0] : "",
  );
  const [contractDate, setContractDate] = useState(
    wedding.contract_date ? wedding.contract_date.split("T")[0] : "",
  );
  const [location, setLocation] = useState(wedding.location);
  const [region, setRegion] = useState(
    Array.isArray(wedding.region)
      ? wedding.region[0] || ""
      : wedding.region || "",
  );
  const [notes, setNotes] = useState(wedding.notes || "");
  const [weddingPackage, setWeddingPackage] = useState(
    PACKAGES.find((p) => p.id === wedding.package)?.name ||
      wedding.package ||
      "",
  );
  const [weddingAddons, setWeddingAddons] = useState(
    Array.isArray(wedding.addons)
      ? wedding.addons
          .map((id: string) => ADDONS.find((a) => a.id === id)?.name || id)
          .join(", ")
      : wedding.addons || "",
  );
  const [driveLink, setDriveLink] = useState(wedding.drive_link || "");
  const [uploadLink, setUploadLink] = useState(wedding.upload_link || "");
  const [editingNotes, setEditingNotes] = useState(wedding.editing_notes || "");
  const [revisionsNotes, setRevisionsNotes] = useState(
    wedding.revisions_notes || "",
  );
  const [isLgbtq, setIsLgbtq] = useState<boolean>(wedding.is_lgbtq || false);
  const [photoTarget, setPhotoTarget] = useState<number>(
    wedding.editor_photo_target || 0,
  );
  const [videoTargets, setVideoTargets] = useState<string[]>(
    Array.isArray(wedding.editor_video_targets)
      ? wedding.editor_video_targets
      : [],
  );

  // Financials
  const [stripeCustomerId, setStripeCustomerId] = useState(
    wedding.stripe_customer_id || "",
  );
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState(
    wedding.stripe_subscription_id || "",
  );
  const [paidAmount, setPaidAmount] = useState<number>(
    wedding.paid_amount || 0,
  );
  const [totalAmount, setTotalAmount] = useState<number>(
    wedding.total_amount || 0,
  );
  const [paymentPlan, setPaymentPlan] = useState(wedding.payment_plan || "");
  const [customPaymentPlan, setCustomPaymentPlan] = useState<any>(
    typeof wedding.custom_payment_plan === "string"
      ? JSON.parse(wedding.custom_payment_plan)
      : wedding.custom_payment_plan || {
          enabled: false,
          deposit: 0,
          installments: [],
        },
  );
  const [invoicesData, setInvoicesData] = useState<{
    upcoming: any;
    pastInvoices: any[];
  } | null>(null);

  const [timelineEvents, setTimelineEvents] = useState<
    { time: string; event: string }[]
  >([]);
  const [isLegacyTimeline, setIsLegacyTimeline] = useState(false);
  const [legacyTimeline, setLegacyTimeline] = useState("");
  const [templates, setTemplates] = useState<{ name: string; events: any[] }[]>(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem("veydra_timeline_templates") || "[]",
        );
      } catch (e) {
        return [];
      }
    },
  );

  const handleSaveTemplate = () => {
    if (timelineEvents.length === 0) {
      toast({ variant: "destructive", title: "Cannot save empty template" });
      return;
    }
    const name = prompt("Enter a name for this template:");
    if (name) {
      const newTemplates = [...templates, { name, events: timelineEvents }];
      setTemplates(newTemplates);
      localStorage.setItem(
        "veydra_timeline_templates",
        JSON.stringify(newTemplates),
      );
      toast({ title: "Template Saved", description: `Saved as "${name}"` });
    }
  };

  const handleLoadTemplate = (template: { name: string; events: any[] }) => {
    if (timelineEvents.length > 0) {
      if (!confirm("This will replace the current timeline. Continue?")) return;
    }
    setTimelineEvents(template.events);
    toast({
      title: "Template Loaded",
      description: `Loaded "${template.name}"`,
    });
  };

  const handleDeleteTemplate = (index: number) => {
    if (!confirm("Delete this template?")) return;
    const newTemplates = templates.filter((_, i) => i !== index);
    setTemplates(newTemplates);
    localStorage.setItem(
      "veydra_timeline_templates",
      JSON.stringify(newTemplates),
    );
  };
  const [vipNames, setVipNames] = useState(wedding.vip_names || "");
  const [vendors, setVendors] = useState(wedding.vendors || "");
  const [specialRequests, setSpecialRequests] = useState(
    wedding.special_requests || "",
  );
  const [questionnaireData, setQuestionnaireData] = useState<any>(
    wedding.questionnaire_data || {},
  );
  const [status, setStatus] = useState(wedding.status);

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
  });
  const regions = Array.isArray(settings?.regions) ? settings.regions : [];

  const { data: initialJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["jobs", "wedding", wedding.id],
    queryFn: () => api.getJobsForWedding(wedding.id),
    enabled: isOpen,
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
    enabled: isOpen,
  });

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["assignments", "wedding", wedding.id],
    queryFn: async () => {
      const jobs = await api.getJobsForWedding(wedding.id);
      const jobIds = jobs.map((j) => j.id);
      if (jobIds.length === 0) return [];
      const allAssignments = await api.getAssignments();
      return allAssignments.filter((a) => jobIds.includes(a.job_id));
    },
    enabled: isOpen,
  });

  const [jobs, setJobs] = useState<any[]>([]);
  const [isJobsInitialized, setIsJobsInitialized] = useState(false);
  const [jobsToDelete, setJobsToDelete] = useState<string[]>([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Update jobs when query finishes loading (only once per open to prevent overwriting local edits)
  useEffect(() => {
    if (
      isOpen &&
      !isJobsInitialized &&
      !isLoadingJobs &&
      !isLoadingAssignments
    ) {
      if (initialJobs && initialJobs.length > 0) {
        const jobsWithAssignments = initialJobs.map((job) => {
          const assignment = assignments.find((a) => {
            if (a.job_id !== job.id) return false;
            const s = String(a.status || "")
              .trim()
              .toLowerCase();
            return ![
              "cancelled",
              "canceled",
              "declined",
              "not_selected",
            ].includes(s);
          });
          return {
            ...job,
            contractor_id: assignment?.contractor_id || "unassigned",
          };
        });
        setJobs(jobsWithAssignments);
      } else {
        setJobs([]);
      }
      setIsJobsInitialized(true);
    } else if (!isOpen && isJobsInitialized) {
      setIsJobsInitialized(false);
    }
  }, [
    initialJobs,
    assignments,
    isOpen,
    isJobsInitialized,
    isLoadingJobs,
    isLoadingAssignments,
  ]);

  // Reset form when opened or when initial jobs load
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setIsJobsInitialized(false);
      setClientName(wedding.client_name);
      setPartnerName(wedding.partner_name || "");
      setClientEmail(wedding.client_email || "");
      setDate(wedding.date ? wedding.date.split("T")[0] : "");
      setLocation(wedding.location);
      setRegion(
        Array.isArray(wedding.region)
          ? wedding.region[0] || ""
          : wedding.region || "",
      );
      setNotes(wedding.notes || "");
      setWeddingPackage(
        PACKAGES.find((p) => p.id === wedding.package)?.name ||
          wedding.package ||
          "",
      );
      setWeddingAddons(
        Array.isArray(wedding.addons)
          ? wedding.addons
              .map((id: string) => ADDONS.find((a) => a.id === id)?.name || id)
              .join(", ")
          : wedding.addons || "",
      );
      setDriveLink(wedding.drive_link || "");
      setUploadLink(wedding.upload_link || "");
      setEditingNotes(wedding.editing_notes || "");
      setRevisionsNotes(wedding.revisions_notes || "");
      setIsLgbtq(wedding.is_lgbtq || false);
      setPhotoTarget(wedding.editor_photo_target || 0);
      setVideoTargets(
        Array.isArray(wedding.editor_video_targets)
          ? wedding.editor_video_targets
          : [],
      );
      setStripeCustomerId(wedding.stripe_customer_id || "");
      setStripeSubscriptionId(wedding.stripe_subscription_id || "");
      setPaidAmount(wedding.paid_amount || 0);
      setTotalAmount(wedding.total_amount || 0);
      setPaymentPlan(wedding.payment_plan || "");
      if (wedding.timeline) {
        try {
          const parsed =
            typeof wedding.timeline === "string"
              ? JSON.parse(wedding.timeline)
              : wedding.timeline;
          if (Array.isArray(parsed)) {
            setTimelineEvents(
              parsed.map((e: any) => ({
                ...e,
                time: parseTimeTo24Hour(e.time),
              })),
            );
            setIsLegacyTimeline(false);
          } else {
            throw new Error();
          }
        } catch {
          setIsLegacyTimeline(true);
          setLegacyTimeline(
            typeof wedding.timeline === "string"
              ? wedding.timeline
              : JSON.stringify(wedding.timeline),
          );
        }
      } else {
        setTimelineEvents([]);
        setIsLegacyTimeline(false);
      }
      setVipNames(wedding.vip_names || "");
      setVendors(wedding.vendors || "");
      setSpecialRequests(wedding.special_requests || "");
      setQuestionnaireData(wedding.questionnaire_data || {});
      setStatus(wedding.status);
      setJobsToDelete([]);

      // Auto-check Stripe for payments if customer ID or email exists
      fetch(`${supabaseUrl}/functions/v1/stripe-invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          customerId: wedding.stripe_customer_id,
          customerEmail:
            wedding.client_email ||
            (wedding.questionnaire_data as any)?.contact_info?.email,
        }),
      })
        .then((r) => (r ? r.json() : null))
        .then((data) => {
          if (data) {
            if (data.customerId) setStripeCustomerId(data.customerId);
            if (data.pastInvoices) setInvoicesData(data);
            if (typeof data.totalPaid === "number" && data.totalPaid >= 0) {
              setPaidAmount(data.totalPaid);
            }
          }
        })
        .catch(console.error);
    }
  };

  const resetQuestionnaireMutation = useMutation({
    mutationFn: async () => {
      await api.updateWedding(wedding.id, {
        questionnaire_data: {},
        questionnaire_completed: false,
      });
    },
    onSuccess: () => {
      setQuestionnaireData({});
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({
        title: "Questionnaire Reset",
        description:
          "All form data has been cleared and the bride can now resubmit.",
      });
      setShowResetConfirm(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to reset",
        description: error.message,
      });
    },
  });

  const updateWeddingAndJobsMutation = useMutation({
    mutationFn: async () => {
      // 1. Update Wedding
      await api.updateWedding(wedding.id, {
        client_name: clientName,
        client_email: clientEmail,
        partner_name: partnerName,
        date,
        location,
        region: region ? [region] : null,
        notes,
        package: weddingPackage,
        addons: weddingAddons
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        drive_link: driveLink,
        upload_link: uploadLink,
        editing_notes: editingNotes,
        revisions_notes: revisionsNotes,
        is_lgbtq: isLgbtq,
        editor_photo_target: photoTarget,
        editor_video_targets: videoTargets,
        timeline: isLegacyTimeline
          ? legacyTimeline
          : (timelineEvents.map((e) => ({
              ...e,
              time: formatTime(e.time),
            })) as any),
        vip_names: vipNames,
        vendors,
        special_requests: specialRequests,
        questionnaire_data: questionnaireData,
        status,
        stripe_customer_id: stripeCustomerId || null,
        stripe_subscription_id: stripeSubscriptionId || null,
        paid_amount: paidAmount,
        total_amount: totalAmount,
        payment_plan: paymentPlan,
        custom_payment_plan: customPaymentPlan,
        contract_date: contractDate || null,
      });

      // Reschedule offset notifications if the wedding date changed.
      api.rescheduleWeddingJobs(wedding.id).catch(() => {});

      // 2. Delete removed jobs
      for (const id of jobsToDelete) {
        await api.deleteJob(id);
      }

      // 3. Update existing or Create new jobs
      for (const job of jobs) {
        let currentJobId = job.id;
        const jobStatus =
          job.contractor_id && job.contractor_id !== "unassigned"
            ? "filled"
            : job.status;

        if (job.id && !job.id.startsWith("new-")) {
          await api.updateJob(job.id, {
            role: job.role,
            pay_type: job.pay_type,
            pay_rate: job.pay_rate || 0,
            hours: job.hours,
            addons: job.addons || [],
            status: status === "cancelled" ? "cancelled" : jobStatus,
          });
        } else if (status !== "cancelled") {
          const newJob = await api.createJob({
            wedding_id: wedding.id,
            role: job.role,
            pay_type: job.pay_type,
            pay_rate: job.pay_rate || 0,
            hours: job.hours,
            addons: job.addons || [],
            status: jobStatus || "open",
            requirements: "",
          });
          currentJobId = newJob.id;
        }

        if (status !== "cancelled" && currentJobId) {
          const existingAssignment = assignments.find((a) => {
            if (a.job_id !== currentJobId) return false;
            const s = String(a.status || "")
              .trim()
              .toLowerCase();
            return ![
              "cancelled",
              "canceled",
              "declined",
              "not_selected",
            ].includes(s);
          });

          if (job.contractor_id && job.contractor_id !== "unassigned") {
            if (
              !existingAssignment ||
              existingAssignment.contractor_id !== job.contractor_id
            ) {
              if (existingAssignment) {
                await api.updateAssignmentStatus(
                  existingAssignment.id,
                  "Cancelled",
                );
              }
              await api.createAssignment({
                job_id: currentJobId,
                contractor_id: job.contractor_id,
                status: "Upcoming",
              });
            }
          } else if (existingAssignment) {
            await api.updateAssignmentStatus(
              existingAssignment.id,
              "Cancelled",
            );
            await api.updateJob(currentJobId, { status: "open" });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setIsOpen(false);
      toast({
        title: "Wedding Updated",
        description: "The wedding and positions have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update wedding",
        description: error.message,
      });
    },
  });

  const resendAlertsMutation = useMutation({
    mutationFn: (jobId: string) => api.resendJobAlerts(jobId),
    onSuccess: (sentCount) => {
      toast({
        title: "Alerts Resent",
        description: `Successfully sent alerts to ${sentCount} eligible contractors.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to resend alerts",
        description: error.message,
      });
    },
  });

  const addJob = () => {
    setJobs([
      ...jobs,
      {
        id: `new-${Date.now()}`,
        role: "",
        pay_rate: 0,
        pay_type: "flat",
        hours: null,
        addons: [],
        status: "open",
        contractor_id: "unassigned",
      },
    ]);
  };

  const toggleAddon = (index: number, addon: string) => {
    const newJobs = [...jobs];
    const job = newJobs[index];
    const addons = job.addons || [];
    const hasAddon = addons.includes(addon);

    if (hasAddon) {
      job.addons = addons.filter((a: string) => a !== addon);
      if (addon === "Engagements" || addon === "Bridals")
        job.hours = (job.hours || 0) - 1.5;
      if (addon === "Drone Operator") job.pay_rate = (job.pay_rate || 0) - 50;
      if (addon === "Audio & Vows") job.pay_rate = (job.pay_rate || 0) - 25;
    } else {
      job.addons = [...addons, addon];
      if (addon === "Engagements" || addon === "Bridals")
        job.hours = (job.hours || 0) + 1.5;
      if (addon === "Drone Operator") job.pay_rate = (job.pay_rate || 0) + 50;
      if (addon === "Audio & Vows") job.pay_rate = (job.pay_rate || 0) + 25;
    }
    setJobs(newJobs);
  };

  const removeJob = (index: number) => {
    const jobToRemove = jobs[index];
    if (jobToRemove.id && !jobToRemove.id.startsWith("new-")) {
      setJobsToDelete([...jobsToDelete, jobToRemove.id]);
    }
    setJobs(jobs.filter((_, i) => i !== index));
  };

  const updateJob = (index: number, field: string, value: any) => {
    const newJobs = [...jobs];
    newJobs[index] = { ...newJobs[index], [field]: value };

    // Auto calculate pay rate based on global settings when hours or role change
    if ((field === "hours" || field === "role") && newJobs[index].hours) {
      const role = newJobs[index].role?.toLowerCase() || "";
      if (role.includes("photo") && settings?.photo_pay_rate != null) {
        newJobs[index].pay_rate =
          newJobs[index].hours * settings.photo_pay_rate;
      } else if (role.includes("video") && settings?.video_pay_rate != null) {
        newJobs[index].pay_rate =
          newJobs[index].hours * settings.video_pay_rate;
      }
    }

    setJobs(newJobs);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "cancelled" && wedding.status !== "cancelled") {
      setShowCancelConfirm(true);
    } else {
      updateWeddingAndJobsMutation.mutate();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Manage
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage Wedding</SheetTitle>
          <SheetDescription>
            Update details and assigned positions for {wedding.client_name}.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSave} className="py-6 space-y-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="questionnaire">Questionnaire</TabsTrigger>
              <TabsTrigger value="jobs">Positions</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partnerName">Partner Name</Label>
                    <Input
                      id="partnerName"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Client Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="pending">Pending Review</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select
                      value={region || undefined}
                      onValueChange={setRegion}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                        {regions.length === 0 && (
                          <SelectItem value="none" disabled>
                            No regions configured
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="isLgbtq"
                    checked={isLgbtq}
                    onCheckedChange={setIsLgbtq}
                  />
                  <Label
                    htmlFor="isLgbtq"
                    className="font-normal cursor-pointer text-muted-foreground"
                  >
                    LGBTQ+ Wedding
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="driveLink">
                    Drive Folder Link (For Raw Media)
                  </Label>
                  <Input
                    id="driveLink"
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uploadLink">
                    Final Delivery Upload Folder
                  </Label>
                  <Input
                    id="uploadLink"
                    value={uploadLink}
                    onChange={(e) => setUploadLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editingNotes">
                    Editor Notes / Instructions
                  </Label>
                  <textarea
                    id="editingNotes"
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="revisionsNotes" className="text-destructive">
                    Revisions Feedback
                  </Label>
                  <textarea
                    id="revisionsNotes"
                    value={revisionsNotes}
                    onChange={(e) => setRevisionsNotes(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm">Editor Targets</h4>

                  <div className="space-y-2">
                    <Label>Target Photo Count</Label>
                    <Input
                      type="number"
                      value={photoTarget || ""}
                      onChange={(e) =>
                        setPhotoTarget(parseInt(e.target.value) || 0)
                      }
                      placeholder="e.g. 500"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Target Videos</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setVideoTargets([
                            ...videoTargets,
                            VIDEO_PRICING[0].id,
                          ])
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Video
                      </Button>
                    </div>

                    {videoTargets.length === 0 ? (
                      <div className="text-sm text-muted-foreground italic">
                        No videos targeted.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {videoTargets.map((vidId, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Select
                              value={vidId}
                              onValueChange={(val) => {
                                const newTargets = [...videoTargets];
                                newTargets[index] = val;
                                setVideoTargets(newTargets);
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VIDEO_PRICING.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive shrink-0"
                              onClick={() => {
                                const newTargets = [...videoTargets];
                                newTargets.splice(index, 1);
                                setVideoTargets(newTargets);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="package">Package</Label>
                    <Input
                      id="package"
                      value={weddingPackage}
                      onChange={(e) => setWeddingPackage(e.target.value)}
                      placeholder="e.g. Gold Package"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addons">Addons</Label>
                    <Input
                      id="addons"
                      value={weddingAddons}
                      onChange={(e) => setWeddingAddons(e.target.value)}
                      placeholder="e.g. Drone, Extra Hour"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Internal Notes</Label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">
                        Financials & Stripe Integration
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Link an existing Stripe customer to sync future payments
                        to the Bride Portal.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          toast({
                            title: "Syncing...",
                            description:
                              "Fetching payment history from Stripe...",
                          });
                          const res = await fetch(
                            `${supabaseUrl}/functions/v1/stripe-invoices`,
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${supabaseAnonKey}`,
                              },
                              body: JSON.stringify({
                                customerId:
                                  stripeCustomerId ||
                                  wedding.stripe_customer_id,
                                customerEmail:
                                  clientEmail ||
                                  wedding.client_email ||
                                  questionnaireData?.contact_info?.email,
                              }),
                            },
                          );

                          if (!res.ok) {
                            const errData = await res.text();
                            throw new Error(
                              errData || "Failed to fetch invoices",
                            );
                          }

                          const data = await res.json();
                          if (data) {
                            if (data.customerId)
                              setStripeCustomerId(data.customerId);
                            if (data.pastInvoices) setInvoicesData(data);
                            const stripeTotal =
                              typeof data.totalPaid === "number"
                                ? data.totalPaid
                                : data.pastInvoices?.reduce(
                                    (sum: number, inv: any) =>
                                      sum +
                                      Math.max(
                                        0,
                                        inv.amount - (inv.refunded || 0),
                                      ),
                                    0,
                                  ) || 0;
                            setPaidAmount(stripeTotal);
                            toast({
                              title: "Synced!",
                              description: `Synced $${stripeTotal} from Stripe past payments.`,
                            });
                          }
                        } catch (err: any) {
                          toast({
                            variant: "destructive",
                            title: "Sync Failed",
                            description: err.message,
                          });
                        }
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-2" />
                      Sync Amount
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Stripe Customer ID</Label>
                      <Input
                        value={stripeCustomerId}
                        onChange={(e) => setStripeCustomerId(e.target.value)}
                        placeholder="cus_..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Stripe Subscription ID</Label>
                      <Input
                        value={stripeSubscriptionId}
                        onChange={(e) =>
                          setStripeSubscriptionId(e.target.value)
                        }
                        placeholder="sub_..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Contract Signed Date</Label>
                      <Input
                        type="date"
                        value={contractDate}
                        onChange={(e) => setContractDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Total Investment ($)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={totalAmount || ""}
                          onChange={(e) =>
                            setTotalAmount(parseFloat(e.target.value) || 0)
                          }
                          className="pl-7"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Total Amount Paid ($)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={paidAmount || ""}
                          onChange={(e) =>
                            setPaidAmount(parseFloat(e.target.value) || 0)
                          }
                          className="pl-7"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs">Payment Plan</Label>
                    <Select
                      value={
                        paymentPlan === "monthly"
                          ? "deposit"
                          : paymentPlan || "full"
                      }
                      onValueChange={setPaymentPlan}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Payment Plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Paid in Full</SelectItem>
                        <SelectItem value="half">50/50 Split</SelectItem>
                        <SelectItem value="deposit">
                          Monthly ($99 Deposit)
                        </SelectItem>
                        <SelectItem value="quarterly">
                          Quarterly ($99 Deposit)
                        </SelectItem>
                        <SelectItem value="custom">
                          Custom Payment Plan
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentPlan !== "full" && (
                    <div className="space-y-3 mt-6 bg-muted/30 p-3 rounded-lg border">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Payment Schedule
                      </Label>
                      <ChangePendingBadge weddingId={wedding.id} />

                      {paymentPlan === "custom" && (
                        <div className="space-y-4 mb-4 pb-4 border-b">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="enable-custom-plan"
                              checked={customPaymentPlan.enabled}
                              onCheckedChange={(c) =>
                                setCustomPaymentPlan({
                                  ...customPaymentPlan,
                                  enabled: !!c,
                                })
                              }
                            />
                            <Label htmlFor="enable-custom-plan">
                              Enable Custom Payment Plan
                            </Label>
                          </div>

                          {customPaymentPlan.enabled && (
                            <div className="space-y-4 pt-2">
                              <div className="space-y-2">
                                <Label className="text-xs">
                                  Deposit Amount ($)
                                </Label>
                                <Input
                                  type="number"
                                  value={customPaymentPlan.deposit || ""}
                                  onChange={(e) =>
                                    setCustomPaymentPlan({
                                      ...customPaymentPlan,
                                      deposit: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">
                                  Future Installments
                                </Label>
                                {customPaymentPlan.installments.map(
                                  (inst: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2"
                                    >
                                      <Input
                                        type="date"
                                        value={inst.date}
                                        onChange={(e) => {
                                          const newInst = [
                                            ...customPaymentPlan.installments,
                                          ];
                                          newInst[idx].date = e.target.value;
                                          setCustomPaymentPlan({
                                            ...customPaymentPlan,
                                            installments: newInst,
                                          });
                                        }}
                                      />
                                      <Input
                                        type="number"
                                        value={inst.amount || ""}
                                        onChange={(e) => {
                                          const newInst = [
                                            ...customPaymentPlan.installments,
                                          ];
                                          newInst[idx].amount =
                                            parseFloat(e.target.value) || 0;
                                          setCustomPaymentPlan({
                                            ...customPaymentPlan,
                                            installments: newInst,
                                          });
                                        }}
                                        placeholder="Amount"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => {
                                          const newInst =
                                            customPaymentPlan.installments.filter(
                                              (_: any, i: number) => i !== idx,
                                            );
                                          setCustomPaymentPlan({
                                            ...customPaymentPlan,
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
                                  className="w-full mt-2"
                                  onClick={() => {
                                    setCustomPaymentPlan({
                                      ...customPaymentPlan,
                                      installments: [
                                        ...customPaymentPlan.installments,
                                        { date: "", amount: 0 },
                                      ],
                                    });
                                  }}
                                >
                                  Add Installment
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        {(() => {
                          const sortedPast = invoicesData?.pastInvoices
                            ? [...invoicesData.pastInvoices].sort(
                                (a, b) =>
                                  new Date(a.date).getTime() -
                                  new Date(b.date).getTime(),
                              )
                            : [];
                          const firstInvoiceDate =
                            sortedPast.length > 0 ? sortedPast[0].date : null;
                          const baseDate =
                            wedding.contract_date ||
                            firstInvoiceDate ||
                            wedding.created_at ||
                            "";

                          let schedule = generatePaymentSchedule(
                            totalAmount,
                            paymentPlan || "full",
                            date,
                            baseDate,
                            paidAmount,
                            customPaymentPlan,
                          );

                          if (invoicesData) {
                            let pastIdx = 0;
                            schedule = schedule.map((item) => {
                              if (
                                item.status === "paid" &&
                                pastIdx < sortedPast.length
                              ) {
                                const inv = sortedPast[pastIdx++];
                                return {
                                  ...item,
                                  date: formatDisplayDate(inv.date),
                                };
                              }
                              return item;
                            });
                          }

                          return schedule.map((payment: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm py-1 border-b last:border-0 border-border/50"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    payment.status === "paid"
                                      ? "bg-green-500"
                                      : "bg-amber-500",
                                  )}
                                />
                                <span>{payment.label}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-muted-foreground">
                                  {payment.date}
                                </span>
                                <span className="font-medium w-16 text-right">
                                  ${payment.amount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="questionnaire" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Timeline</Label>
                    {!isLegacyTimeline && (
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs px-2"
                            >
                              Templates
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {templates.length > 0 ? (
                              templates.map((t, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between gap-4 px-2 py-1.5 text-sm hover:bg-accent rounded-sm cursor-pointer group"
                                >
                                  <span
                                    className="flex-1"
                                    onClick={() => handleLoadTemplate(t)}
                                  >
                                    {t.name}
                                  </span>
                                  <Trash2
                                    className="h-3 w-3 text-destructive opacity-0 group-hover:opacity-100 hover:text-destructive/80"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTemplate(i);
                                    }}
                                  />
                                </div>
                              ))
                            ) : (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                No templates saved
                              </div>
                            )}
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                handleSaveTemplate();
                              }}
                              className="mt-2 border-t pt-2 text-primary font-medium"
                            >
                              <Plus className="h-3 w-3 mr-1" /> Save Current as
                              Template
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setTimelineEvents([
                              ...timelineEvents,
                              { time: "", event: "" },
                            ])
                          }
                          className="h-8 px-2 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Event
                        </Button>
                      </div>
                    )}
                  </div>
                  {isLegacyTimeline ? (
                    <textarea
                      id="timeline"
                      value={legacyTimeline}
                      onChange={(e) => setLegacyTimeline(e.target.value)}
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  ) : (
                    <div className="space-y-2">
                      {timelineEvents.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          No timeline events added yet.
                        </p>
                      )}
                      {timelineEvents.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 bg-muted/20 p-2 rounded-md border"
                        >
                          <Input
                            type="time"
                            placeholder="Time"
                            value={item.time}
                            onChange={(e) => {
                              const newEvents = [...timelineEvents];
                              newEvents[index].time = e.target.value;
                              setTimelineEvents(newEvents);
                            }}
                            className="w-28 h-8 text-xs"
                          />
                          <Input
                            placeholder="Event"
                            value={item.event}
                            onChange={(e) => {
                              const newEvents = [...timelineEvents];
                              newEvents[index].event = e.target.value;
                              setTimelineEvents(newEvents);
                            }}
                            className="flex-1 h-8 text-xs"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive shrink-0"
                            onClick={() => {
                              const newEvents = [...timelineEvents];
                              newEvents.splice(index, 1);
                              setTimelineEvents(newEvents);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vipNames">VIP & Family Names</Label>
                  <textarea
                    id="vipNames"
                    value={vipNames}
                    onChange={(e) => setVipNames(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendors">Vendors</Label>
                  <textarea
                    id="vendors"
                    value={vendors}
                    onChange={(e) => setVendors(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialRequests">Special Requests</Label>
                  <textarea
                    id="specialRequests"
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Your Full Name</Label>
                      <Input
                        value={questionnaireData?.contact_info?.full_name || ""}
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            contact_info: {
                              ...questionnaireData?.contact_info,
                              full_name: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Email</Label>
                      <Input
                        value={questionnaireData?.contact_info?.email || ""}
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            contact_info: {
                              ...questionnaireData?.contact_info,
                              email: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Bride's Full Name</Label>
                      <Input
                        value={
                          questionnaireData?.contact_info?.bride_full_name || ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            contact_info: {
                              ...questionnaireData?.contact_info,
                              bride_full_name: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Groom's Full Name</Label>
                      <Input
                        value={
                          questionnaireData?.contact_info?.groom_full_name || ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            contact_info: {
                              ...questionnaireData?.contact_info,
                              groom_full_name: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Phone (Bride)</Label>
                      <Input
                        value={
                          questionnaireData?.contact_info?.phone_bride || ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            contact_info: {
                              ...questionnaireData?.contact_info,
                              phone_bride: formatPhoneNumber(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Phone (Groom)</Label>
                      <Input
                        value={
                          questionnaireData?.contact_info?.phone_groom || ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            contact_info: {
                              ...questionnaireData?.contact_info,
                              phone_groom: formatPhoneNumber(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">
                        Preferred Contact Method
                      </Label>
                      <Input
                        value={
                          questionnaireData?.contact_info
                            ?.preferred_contact_method || ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            contact_info: {
                              ...questionnaireData?.contact_info,
                              preferred_contact_method: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Best Contact Time</Label>
                      <Input
                        value={
                          questionnaireData?.contact_info?.best_contact_time ||
                          ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            contact_info: {
                              ...questionnaireData?.contact_info,
                              best_contact_time: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm">Style & Vibe</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Wedding Theme</Label>
                      <Input
                        value={
                          questionnaireData?.style_vibe?.wedding_theme || ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            style_vibe: {
                              ...questionnaireData?.style_vibe,
                              wedding_theme: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Dress Code</Label>
                      <Input
                        value={questionnaireData?.style_vibe?.dress_code || ""}
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            style_vibe: {
                              ...questionnaireData?.style_vibe,
                              dress_code: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Decor Style</Label>
                      <Input
                        value={questionnaireData?.style_vibe?.decor_style || ""}
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            style_vibe: {
                              ...questionnaireData?.style_vibe,
                              decor_style: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Florist Name</Label>
                      <Input
                        value={
                          questionnaireData?.style_vibe?.florist_name || ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            style_vibe: {
                              ...questionnaireData?.style_vibe,
                              florist_name: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm">
                    Wedding Party & Traditions
                  </h4>
                  <div className="space-y-2">
                    <Label className="text-xs">Wedding Party Size</Label>
                    <Input
                      value={
                        questionnaireData?.wedding_party?.wedding_party_size ||
                        ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          wedding_party: {
                            ...questionnaireData?.wedding_party,
                            wedding_party_size: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Special Traditions or Events
                    </Label>
                    <textarea
                      value={
                        questionnaireData?.wedding_party
                          ?.special_traditions_events || ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          wedding_party: {
                            ...questionnaireData?.wedding_party,
                            special_traditions_events: e.target.value,
                          },
                        })
                      }
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm">Family Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Bride's Parents' Names</Label>
                      <Input
                        value={
                          questionnaireData?.family_details
                            ?.bride_parents_names || ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            family_details: {
                              ...questionnaireData?.family_details,
                              bride_parents_names: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Groom's Parents' Names</Label>
                      <Input
                        value={
                          questionnaireData?.family_details
                            ?.groom_parents_names || ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            family_details: {
                              ...questionnaireData?.family_details,
                              groom_parents_names: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Family Members to Prioritize in Photos
                    </Label>
                    <textarea
                      value={
                        questionnaireData?.family_details
                          ?.family_members_to_prioritize || ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          family_details: {
                            ...questionnaireData?.family_details,
                            family_members_to_prioritize: e.target.value,
                          },
                        })
                      }
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Any Sensitive Family Situations?
                    </Label>
                    <textarea
                      value={
                        questionnaireData?.family_details
                          ?.sensitive_family_situations || ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          family_details: {
                            ...questionnaireData?.family_details,
                            sensitive_family_situations: e.target.value,
                          },
                        })
                      }
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Emergency Contact (on wedding day)
                    </Label>
                    <Input
                      value={
                        questionnaireData?.family_details?.emergency_contact ||
                        ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          family_details: {
                            ...questionnaireData?.family_details,
                            emergency_contact: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm">
                    Photo & Video Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">
                        First Look before ceremony?
                      </Label>
                      <Input
                        value={questionnaireData?.photo_video?.first_look || ""}
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            photo_video: {
                              ...questionnaireData?.photo_video,
                              first_look: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">
                        Audio of vows/toasts included?
                      </Label>
                      <Input
                        value={
                          questionnaireData?.photo_video?.audio_vows_toasts ||
                          ""
                        }
                        onChange={(e) =>
                          setQuestionnaireData({
                            ...questionnaireData,
                            photo_video: {
                              ...questionnaireData?.photo_video,
                              audio_vows_toasts: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Must-Have Photos</Label>
                    <textarea
                      value={
                        questionnaireData?.photo_video?.must_have_photos || ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          photo_video: {
                            ...questionnaireData?.photo_video,
                            must_have_photos: e.target.value,
                          },
                        })
                      }
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Must-Have Video Moments</Label>
                    <textarea
                      value={
                        questionnaireData?.photo_video
                          ?.must_have_video_moments || ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          photo_video: {
                            ...questionnaireData?.photo_video,
                            must_have_video_moments: e.target.value,
                          },
                        })
                      }
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Any photography restrictions at your venue?
                    </Label>
                    <textarea
                      value={
                        questionnaireData?.photo_video
                          ?.photography_restrictions || ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          photo_video: {
                            ...questionnaireData?.photo_video,
                            photography_restrictions: e.target.value,
                          },
                        })
                      }
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Any special photo locations planned?
                    </Label>
                    <textarea
                      value={
                        questionnaireData?.photo_video
                          ?.special_photo_locations || ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          photo_video: {
                            ...questionnaireData?.photo_video,
                            special_photo_locations: e.target.value,
                          },
                        })
                      }
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Is there anything you don't want captured?
                    </Label>
                    <textarea
                      value={
                        questionnaireData?.photo_video?.dont_want_captured || ""
                      }
                      onChange={(e) =>
                        setQuestionnaireData({
                          ...questionnaireData,
                          photo_video: {
                            ...questionnaireData?.photo_video,
                            dont_want_captured: e.target.value,
                          },
                        })
                      }
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" />
                    Highlight Video Songs
                    {wedding.songs_submitted_at && (
                      <Badge variant="secondary" className="text-[10px]">
                        Submitted{" "}
                        {formatDisplayDate(wedding.songs_submitted_at)}
                      </Badge>
                    )}
                  </h4>
                  {(() => {
                    const songs = Array.isArray(wedding.highlight_songs)
                      ? wedding.highlight_songs
                      : [];
                    if (songs.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground italic">
                          No songs submitted yet. Use "Request Highlight Songs"
                          in the Actions menu to ask the bride.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {songs.map((s: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 bg-muted/20 p-3 rounded-lg border"
                          >
                            <div className="bg-primary/10 p-2 rounded-full shrink-0">
                              <Music className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {s.title} — {s.artist}
                              </p>
                              {s.moment && (
                                <p className="text-xs text-muted-foreground">
                                  Moment: {s.moment}
                                </p>
                              )}
                              {s.link && (
                                <a
                                  href={s.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline break-all"
                                >
                                  {s.link}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-6 border-t mt-6 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={async () => {
                        const email =
                          wedding.client_email ||
                          questionnaireData?.contact_info?.email;
                        if (!email) {
                          toast({
                            variant: "destructive",
                            title: "No Email",
                            description:
                              "Please add an email address in the Details tab first.",
                          });
                          return;
                        }
                        const link = `${(settings?.app_url || window.location.origin).replace(/\/$/, "")}/bride-portal/${wedding.id}`;
                        const subject =
                          "Please complete your wedding questionnaire";
                        const msg = `Hi ${wedding.client_name.split(" ")[0]},<br><br>Please fill out your wedding details and timeline questionnaire here: <a href="${link}">${link}</a><br><br>Thank you!`;

                        toast({
                          title: "Sending...",
                          description: `Sending reminder to ${email}`,
                        });
                        try {
                          await api.sendOvantaEmail(
                            email,
                            subject,
                            msg,
                            wedding.client_name,
                            true,
                          );
                          toast({
                            title: "Sent!",
                            description: `Reminder sent to ${email}`,
                          });
                        } catch (err: any) {
                          toast({
                            variant: "destructive",
                            title: "Failed",
                            description: err.message,
                          });
                        }
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Email Reminder
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={async () => {
                        const email =
                          wedding.client_email ||
                          questionnaireData?.contact_info?.email;
                        if (!email) {
                          toast({
                            variant: "destructive",
                            title: "No Email",
                            description:
                              "An email is required to look up the contact for SMS.",
                          });
                          return;
                        }
                        const link = `${(settings?.app_url || window.location.origin).replace(/\/$/, "")}/bride-portal/${wedding.id}`;
                        const smsMsg = `Hi ${wedding.client_name.split(" ")[0]}! Please complete your wedding details and timeline questionnaire here: ${link}`;

                        toast({
                          title: "Sending...",
                          description: `Sending SMS reminder to ${email}`,
                        });
                        try {
                          await api.sendOvantaSms(
                            email,
                            smsMsg,
                            wedding.client_name,
                            true,
                          );
                          toast({
                            title: "Sent!",
                            description: `SMS reminder sent to ${email}`,
                          });
                        } catch (err: any) {
                          toast({
                            variant: "destructive",
                            title: "SMS Failed",
                            description: err.message,
                          });
                        }
                      }}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      SMS Reminder
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full rounded-full"
                    onClick={() => setShowResetConfirm(true)}
                  >
                    Reset Questionnaire Data
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-sm font-semibold">Positions (Jobs)</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addJob}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Position
                  </Button>
                </div>

                {isLoadingJobs ? (
                  <div className="py-4 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    No positions added yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {jobs.map((job, index) => (
                      <div
                        key={job.id}
                        className={cn(
                          "flex flex-col gap-4 p-4 rounded-xl border relative shadow-sm transition-colors",
                          !job.contractor_id ||
                            job.contractor_id === "unassigned"
                            ? "bg-amber-50/40 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50"
                            : "bg-muted/20 border-border",
                        )}
                      >
                        <div className="absolute top-3 right-3 flex gap-1 bg-background/80 backdrop-blur-sm rounded-md p-0.5 border shadow-sm z-10">
                          {!job.id?.startsWith("new-") &&
                            job.status === "open" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary"
                                title="Resend Job Alerts"
                                onClick={() =>
                                  resendAlertsMutation.mutate(job.id)
                                }
                                disabled={resendAlertsMutation.isPending}
                              >
                                {resendAlertsMutation.isPending &&
                                resendAlertsMutation.variables === job.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeJob(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 sm:col-span-2 pr-16">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Role
                            </Label>
                            <Select
                              value={job.role}
                              onValueChange={(val) =>
                                updateJob(index, "role", val)
                              }
                            >
                              <SelectTrigger className="h-9 w-full font-medium">
                                <SelectValue placeholder="Select Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Lead Photographer">
                                  Lead Photographer
                                </SelectItem>
                                <SelectItem value="Second Photographer">
                                  Second Photographer
                                </SelectItem>
                                <SelectItem value="Lead Videographer">
                                  Lead Videographer
                                </SelectItem>
                                <SelectItem value="Second Videographer">
                                  Second Videographer
                                </SelectItem>
                                <SelectItem value="Content Creator">
                                  Content Creator
                                </SelectItem>
                                <SelectItem value="Drone Operator">
                                  Drone Operator
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Hours
                            </Label>
                            <Input
                              type="number"
                              value={job.hours || ""}
                              onChange={(e) =>
                                updateJob(
                                  index,
                                  "hours",
                                  e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                )
                              }
                              placeholder="Hrs"
                              className="h-9"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-muted-foreground">
                                {job.pay_type === "bidding"
                                  ? job.status === "filled" ||
                                    job.status === "completed"
                                    ? "Approved Bid ($)"
                                    : "Budget ($)"
                                  : "Pay Rate ($)"}
                              </Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="whitespace-pre-wrap text-xs">
                                  {getRateCalculationTooltip(job, settings)}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                $
                              </span>
                              <Input
                                type="number"
                                value={job.pay_rate}
                                onChange={(e) =>
                                  updateJob(
                                    index,
                                    "pay_rate",
                                    Number(e.target.value),
                                  )
                                }
                                className="h-9 pl-7"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Pay Type
                            </Label>
                            <Select
                              value={job.pay_type || "flat"}
                              onValueChange={(val) =>
                                updateJob(index, "pay_type", val)
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Pay Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="flat">Flat Rate</SelectItem>
                                <SelectItem value="bidding">Bidding</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Status
                            </Label>
                            <Select
                              value={
                                job.contractor_id &&
                                job.contractor_id !== "unassigned"
                                  ? "filled"
                                  : job.status
                              }
                              onValueChange={(val) =>
                                updateJob(index, "status", val)
                              }
                              disabled={
                                job.contractor_id &&
                                job.contractor_id !== "unassigned"
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="filled">Filled</SelectItem>
                                <SelectItem value="completed">
                                  Completed
                                </SelectItem>
                                <SelectItem value="cancelled">
                                  Cancelled
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Assigned To
                            </Label>
                            <Select
                              value={job.contractor_id || "unassigned"}
                              onValueChange={(val) =>
                                updateJob(index, "contractor_id", val)
                              }
                            >
                              <SelectTrigger className="h-9 w-full">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">
                                  Unassigned
                                </SelectItem>
                                {contractors.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.first_name} {c.last_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-3 border-t border-border/50">
                          {job.role?.toLowerCase().includes("photo") && (
                            <>
                              <Badge
                                variant={
                                  job.addons?.includes("Engagements")
                                    ? "default"
                                    : "secondary"
                                }
                                className="cursor-pointer text-xs font-medium px-2.5 py-0.5 rounded-full"
                                onClick={() =>
                                  toggleAddon(index, "Engagements")
                                }
                              >
                                + Engagements
                              </Badge>
                              <Badge
                                variant={
                                  job.addons?.includes("Bridals")
                                    ? "default"
                                    : "secondary"
                                }
                                className="cursor-pointer text-xs font-medium px-2.5 py-0.5 rounded-full"
                                onClick={() => toggleAddon(index, "Bridals")}
                              >
                                + Bridals
                              </Badge>
                            </>
                          )}
                          {job.role?.toLowerCase().includes("video") && (
                            <>
                              <Badge
                                variant={
                                  job.addons?.includes("Drone Operator")
                                    ? "default"
                                    : "secondary"
                                }
                                className="cursor-pointer text-xs font-medium px-2.5 py-0.5 rounded-full"
                                onClick={() =>
                                  toggleAddon(index, "Drone Operator")
                                }
                              >
                                + Drone Operator
                              </Badge>
                              <Badge
                                variant={
                                  job.addons?.includes("Audio & Vows")
                                    ? "default"
                                    : "secondary"
                                }
                                className="cursor-pointer text-xs font-medium px-2.5 py-0.5 rounded-full"
                                onClick={() =>
                                  toggleAddon(index, "Audio & Vows")
                                }
                              >
                                + Audio & Vows
                              </Badge>
                            </>
                          )}
                          {(!job.role ||
                            (!job.role.toLowerCase().includes("photo") &&
                              !job.role.toLowerCase().includes("video"))) && (
                            <span className="text-xs text-muted-foreground italic">
                              Select a role to see addons
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateWeddingAndJobsMutation.isPending}
            >
              {updateWeddingAndJobsMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </form>

        <AlertDialog
          open={showCancelConfirm}
          onOpenChange={setShowCancelConfirm}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Wedding?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel {wedding.client_name}'s wedding?
                This will update the status for all associated positions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowCancelConfirm(false);
                  updateWeddingAndJobsMutation.mutate();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, Cancel Wedding
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Questionnaire Data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all questionnaire responses for{" "}
                {wedding.client_name} and allow the bride to fill the form out
                again. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  resetQuestionnaireMutation.mutate();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {resetQuestionnaireMutation.isPending
                  ? "Resetting..."
                  : "Yes, Reset Data"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

export default function ManagerWeddings() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("active");

  // On Deck controls
  const [onDeckSort, setOnDeckSort] = useState<string>("date-asc");
  const [onDeckFilter, setOnDeckFilter] = useState<string>("all");
  const [onDeckView, setOnDeckView] = useState<"table" | "cards">("table");
  const [weddingSearch, setWeddingSearch] = useState<string>("");

  const filterBySearch = (list: DbWedding[]) => {
    const q = weddingSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((w) => {
      const haystack = [
        w.client_name,
        w.partner_name,
        w.client_email,
        w.location,
        w.region,
        w.date,
        (w as any).wedding_package,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  };

  useEffect(() => {
    Promise.all([api.getPackages(true), api.getAddons(true)])
      .then(([pkgs, adns]) => {
        if (pkgs.length) DB_PACKAGES = pkgs;
        if (adns.length) DB_ADDONS = adns;
      })
      .catch(() => {});
  }, []);
  const [hasInitializedTab, setHasInitializedTab] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const [cancelledPage, setCancelledPage] = useState(1);
  const [cancelWeddingTarget, setCancelWeddingTarget] =
    useState<DbWedding | null>(null);
  const [emailPreview, setEmailPreview] = useState<EmailPreviewData | null>(
    null,
  );
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewSend, setEmailPreviewSend] = useState<
    (() => Promise<void>) | null
  >(null);
  const [sendingPrepReminder, setSendingPrepReminder] = useState<string | null>(
    null,
  );
  const [changePlanWedding, setChangePlanWedding] = useState<any>(null);
  const [upsellWedding, setUpsellWedding] = useState<any>(null);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleVerifyPayment = async (weddingId: string, verified: boolean) => {
    try {
      await api.updateWedding(weddingId, {
        final_payment_verified: verified,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({
        title: verified ? "Payment Verified" : "Verification Removed",
        description: verified
          ? "Wedding marked as fully paid."
          : "Wedding status updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    }
  };

  const handleToggleVerified = handleVerifyPayment;

  const bartendingModuleOn = useBartendingModule();
  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
  });
  const regions = Array.isArray(settings?.regions) ? settings.regions : [];

  const { data: weddings = [], isLoading } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: api.getJobs,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  // Use company timezone for "today" to ensure consistent date comparisons
  const nowInTz = new Date(
    new Date().toLocaleString("en-US", { timeZone: getCompanyTimezone() }),
  );
  const today = new Date(
    nowInTz.getFullYear(),
    nowInTz.getMonth(),
    nowInTz.getDate(),
  );

  // Parse a date string as a local date (no UTC midnight shift)
  const parseLocalDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(NaN);
    const datePart = dateStr.split("T")[0];
    const [y, m, d] = datePart.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const pendingWeddings = filterBySearch(
    weddings.filter(
      (w) => w.status === "pending" && !w.notes?.includes("[UNPAID_DRAFT]"),
    ),
  ).sort((a, b) => {
    const dateA = parseLocalDate(a.date || "9999-12-31").getTime();
    const dateB = parseLocalDate(b.date || "9999-12-31").getTime();
    return dateA - dateB;
  });

  const activeWeddings = filterBySearch(
    weddings
      .filter(
        (w) => w.status !== "pending" && !w.notes?.includes("[UNPAID_DRAFT]"),
      )
      .filter((w) => {
        if (
          w.status?.toLowerCase() === "completed" ||
          w.status?.toLowerCase() === "cancelled"
        )
          return false;
        if (!w.date) return true;
        const wDate = parseLocalDate(w.date);
        return wDate.getTime() >= today.getTime();
      }),
  ).sort((a, b) => {
    const dateA = parseLocalDate(a.date || "9999-12-31").getTime();
    const dateB = parseLocalDate(b.date || "9999-12-31").getTime();
    return dateA - dateB; // Closest first
  });

  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  const onDeckWeddings = activeWeddings.filter((w) => {
    if (!w.date) return false;
    const wDate = parseLocalDate(w.date);
    return (
      wDate.getTime() >= today.getTime() &&
      wDate.getTime() <= thirtyDaysFromNow.getTime()
    );
  });

  const pastWeddings = filterBySearch(
    weddings
      .filter(
        (w) => w.status !== "pending" && !w.notes?.includes("[UNPAID_DRAFT]"),
      )
      .filter((w) => {
        if (w.status?.toLowerCase() === "completed") return true;
        if (w.status?.toLowerCase() === "cancelled") return false; // Cancelled weddings have their own tab
        if (w.date) {
          const wDate = parseLocalDate(w.date);
          return wDate.getTime() < today.getTime();
        }
        return false;
      }),
  ).sort((a, b) => {
    const dateA = parseLocalDate(a.date || "1970-01-01").getTime();
    const dateB = parseLocalDate(b.date || "1970-01-01").getTime();
    return dateB - dateA; // Most recent past first
  });

  const cancelledWeddings = filterBySearch(
    weddings.filter(
      (w) =>
        w.status?.toLowerCase() === "cancelled" &&
        !w.notes?.includes("[UNPAID_DRAFT]"),
    ),
  ).sort((a, b) => {
    const dateA = new Date(a.cancelled_at || a.date || 0).getTime();
    const dateB = new Date(b.cancelled_at || b.date || 0).getTime();
    return dateB - dateA; // Most recently cancelled first
  });

  useEffect(() => {
    if (!isLoading && !hasInitializedTab) {
      setActiveTab(
        pendingWeddings.length > 0
          ? "needs-review"
          : onDeckWeddings.length > 0
            ? "on-deck"
            : "active",
      );
      setHasInitializedTab(true);
    }
  }, [
    isLoading,
    pendingWeddings.length,
    onDeckWeddings.length,
    hasInitializedTab,
  ]);

  useEffect(() => {
    if (pendingWeddings.length === 0 && activeTab === "needs-review") {
      setActiveTab(onDeckWeddings.length > 0 ? "on-deck" : "active");
    }
  }, [pendingWeddings.length, onDeckWeddings.length, activeTab]);

  const getDaysUntil = (dateStr: string) => {
    const target = parseLocalDate(dateStr);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 0) return "Past";
    return `${diffDays} days`;
  };

  // Sorted + filtered on-deck weddings
  const onDeckSorted = useMemo(() => {
    const list = onDeckWeddings.filter((w) => {
      if (onDeckFilter === "urgent") {
        const d = parseLocalDate(w.date || "9999-12-31");
        const within7 =
          d.getTime() - today.getTime() <= 7 * 24 * 60 * 60 * 1000 &&
          d.getTime() >= today.getTime();
        if (!within7) return false;
        // only truly urgent if it needs attention
        const tA = Number(w.total_amount) || 0;
        const pA = Number(w.paid_amount) || 0;
        const unpaid = Math.max(0, tA - pA);
        const isFullyPaid = tA > 0 && pA >= tA - 0.01;
        const isVerified = w.final_payment_verified;
        const readiness = calculateReadiness(w);
        const needsAttention =
          (tA > 0 && unpaid > 0.01) ||
          (isFullyPaid && !isVerified) ||
          readiness < 100;
        return needsAttention;
      }
      if (onDeckFilter === "unpaid") {
        const tA = Number(w.total_amount) || 0;
        const pA = Number(w.paid_amount) || 0;
        return tA > 0 && pA < tA - 0.01;
      }
      if (onDeckFilter === "attention") {
        return getMissingItems(w).length > 0;
      }
      return true;
    });

    const daysOf = (w: DbWedding) =>
      parseLocalDate(w.date || "9999-12-31").getTime() - today.getTime();

    return [...list].sort((a, b) => {
      switch (onDeckSort) {
        case "date-asc":
          return daysOf(a) - daysOf(b);
        case "date-desc":
          return daysOf(b) - daysOf(a);
        case "readiness-asc":
          return calculateReadiness(a, []) - calculateReadiness(b, []);
        case "readiness-desc":
          return calculateReadiness(b, []) - calculateReadiness(a, []);
        case "unpaid-desc": {
          const ua =
            (Number(a.total_amount) || 0) - (Number(a.paid_amount) || 0);
          const ub =
            (Number(b.total_amount) || 0) - (Number(b.paid_amount) || 0);
          return ub - ua;
        }
        default:
          return daysOf(a) - daysOf(b);
      }
    });
  }, [onDeckWeddings, onDeckSort, onDeckFilter, today, assignments, jobs]);

  const handleSendPrepReminder = async (wedding: DbWedding) => {
    setSendingPrepReminder(wedding.id);
    try {
      const s = settings as any;
      const portalLink = (s?.app_url || "https://veydra.com").replace(
        /\/$/,
        "",
      );
      const daysUntil = wedding.date
        ? getDaysUntil(wedding.date).replace(" days", "")
        : "soon";

      const weddingJobs = jobs.filter(
        (j) => j.wedding_id === wedding.id && j.status === "filled",
      );
      // @ts-ignore - assignments is in scope from the useQuery at the top
      const weddingAssignments = (assignments as any[]).filter((a) =>
        weddingJobs.some((j) => j.id === a.job_id),
      );

      let sent = 0;
      for (const assignment of weddingAssignments) {
        const contractor = assignment.contractors;
        if (!contractor?.email) continue;

        const job = weddingJobs.find((j) => j.id === assignment.job_id);
        const todos = job?.contractor_todos || [];
        let hasPendingTodos = false;
        if (Array.isArray(todos) && todos.length > 0) {
          hasPendingTodos = todos.some((t: any) => !t.completed);
        } else if (!todos || todos.length === 0) {
          hasPendingTodos = true;
        }
        if (!hasPendingTodos) continue;

        if (s?.sms_contractor_prep_enabled && s?.sms_contractor_prep_template) {
          const msg = s.sms_contractor_prep_template
            .replace(/{{company_name}}/g, s.company_name || "Veydra")
            .replace(/{{contractor_name}}/g, contractor.first_name)
            .replace(/{{wedding_name}}/g, wedding.client_name)
            .replace(/{{days}}/g, daysUntil)
            .replace(/{{location}}/g, wedding.location || "TBD")
            .replace(
              /{{date}}/g,
              wedding.date ? formatDisplayDate(wedding.date) : "TBD",
            )
            .replace(/{{portal_link}}/g, portalLink);
          await api
            .sendOvantaSms(
              contractor.email,
              msg,
              `${contractor.first_name} ${contractor.last_name || ""}`,
              true,
            )
            .catch(() => {});
          sent++;
        }

        if (
          s?.email_contractor_prep_enabled &&
          s?.email_contractor_prep_template
        ) {
          const subject = (
            s.email_contractor_prep_subject ||
            "Action Items Due for {{wedding_name}} Wedding"
          )
            .replace(/{{company_name}}/g, s.company_name || "Veydra")
            .replace(/{{contractor_name}}/g, contractor.first_name)
            .replace(/{{wedding_name}}/g, wedding.client_name)
            .replace(/{{days}}/g, daysUntil);
          const msg = s.email_contractor_prep_template
            .replace(/{{company_name}}/g, s.company_name || "Veydra")
            .replace(/{{logo_url}}/g, s.logo_url || DEFAULT_LOGO_URL)
            .replace(/{{contractor_name}}/g, contractor.first_name)
            .replace(/{{wedding_name}}/g, wedding.client_name)
            .replace(/{{days}}/g, daysUntil)
            .replace(/{{location}}/g, wedding.location || "TBD")
            .replace(
              /{{date}}/g,
              wedding.date ? formatDisplayDate(wedding.date) : "TBD",
            )
            .replace(/{{portal_link}}/g, portalLink);
          await api
            .sendOvantaEmail(
              contractor.email,
              subject,
              msg,
              `${contractor.first_name} ${contractor.last_name || ""}`,
              true,
            )
            .catch(() => {});
          sent++;
        }

        await api
          .createNotification({
            contractor_id: contractor.id,
            title: "Action Items Due",
            message: `You have incomplete action items for ${wedding.client_name}'s wedding. Please log in to complete them.`,
            type: "assignment",
          })
          .catch(() => {});
      }

      if (sent > 0) {
        toast({
          title: "Prep Reminders Sent",
          description: `${sent} reminder(s) sent to contractors with incomplete to-dos.`,
        });
      } else {
        toast({
          title: "No Reminders Sent",
          description:
            "Either no contractors have incomplete todos, or SMS/Email prep alerts are disabled in Settings.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Failed to Send",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSendingPrepReminder(null);
    }
  };

  // NOTE: This must match calculateWeddingReadiness in src/pages/manager/Dashboard.tsx
  // exactly so readiness % is consistent across the app.
  // NOTE: This must match calculateWeddingReadiness in src/pages/manager/Dashboard.tsx
  // exactly so readiness % is consistent across the app (6 checks).
  const calculateReadiness = (
    wedding: DbWedding,
    weddingAssignments: any[] = [],
  ) => {
    let score = 0;
    const total = 6;
    const w = wedding as any;
    const allAssignments = (assignments as any[]).filter(
      (a) => a.jobs?.wedding_id === wedding.id,
    );

    if (
      w.questionnaire_completed ||
      (w.questionnaire_data &&
        Object.keys(w.questionnaire_data || {}).length > 0)
    )
      score += 1;
    if (w.timeline && w.timeline.length > 0 && w.timeline !== "[]") score += 1;

    // Drive link added
    if (w.drive_link) score += 1;

    const weddingJobs = jobs.filter(
      (j) => j.wedding_id === wedding.id && j.status !== "cancelled",
    );
    const filledJobs = weddingJobs.filter(
      (j) => j.status === "filled" || j.status === "completed",
    );
    if (weddingJobs.length > 0 && weddingJobs.length === filledJobs.length)
      score += 1;

    // Assignments confirmed
    const activeAssignments = allAssignments.filter((a) =>
      ["upcoming", "accepted", "confirmed", "assigned"].includes(
        a.status?.toLowerCase(),
      ),
    );
    const unconfirmedAssignments = activeAssignments.filter(
      (a) => !a.attendance_confirmed,
    );
    if (activeAssignments.length > 0 && unconfirmedAssignments.length === 0) {
      score += 1;
    }

    // Final payment verified
    if (w.final_payment_verified) score += 1;

    return (score / total) * 100;
  };

  const getMissingItems = (wedding: DbWedding): string[] => {
    const missing: string[] = [];
    const w = wedding as any;
    if (
      !w.questionnaire_completed &&
      !(
        w.questionnaire_data &&
        Object.keys(w.questionnaire_data || {}).length > 0
      )
    ) {
      missing.push("Questionnaire");
    }
    if (!w.timeline || w.timeline.length === 0 || w.timeline === "[]") {
      missing.push("Timeline");
    }
    if (!w.drive_link) {
      missing.push("Drive Link");
    }
    const weddingJobs = jobs.filter(
      (j) => j.wedding_id === wedding.id && j.status !== "cancelled",
    );
    const filledJobs = weddingJobs.filter(
      (j) => j.status === "filled" || j.status === "completed",
    );
    if (weddingJobs.length === 0) {
      missing.push("No positions posted");
    } else if (weddingJobs.length !== filledJobs.length) {
      const unfilled = weddingJobs.length - filledJobs.length;
      missing.push(`${unfilled} unfilled position${unfilled > 1 ? "s" : ""}`);
    }
    // Assignments confirmed
    const allAssignments = (assignments as any[]).filter(
      (a) => a.jobs?.wedding_id === wedding.id,
    );
    const activeAssignments = allAssignments.filter((a) =>
      ["upcoming", "accepted", "confirmed", "assigned"].includes(
        a.status?.toLowerCase(),
      ),
    );
    const unconfirmedAssignments = activeAssignments.filter(
      (a) => !a.attendance_confirmed,
    );
    if (activeAssignments.length === 0) {
      missing.push("No assignments");
    } else if (unconfirmedAssignments.length > 0) {
      missing.push(
        `${unconfirmedAssignments.length} unconfirmed assignment${unconfirmedAssignments.length > 1 ? "s" : ""}`,
      );
    }
    if (!w.final_payment_verified) {
      missing.push("Final payment not verified");
    }
    return missing;
  };

  const deleteWeddingMutation = useMutation({
    mutationFn: (id: string) => api.deleteWedding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({
        title: "Wedding Deleted",
        description: "The wedding has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete wedding",
        description: error.message,
      });
    },
  });

  // Toggle final payment verification (manual override)
  const verifyFinalPaymentMutation = useMutation({
    mutationFn: async ({
      weddingId,
      verified,
    }: {
      weddingId: string;
      verified: boolean;
    }) => {
      await api.updateWedding(weddingId, {
        final_payment_verified: verified,
      } as any);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({
        title: vars.verified ? "Payment Verified" : "Payment Unverified",
        description: vars.verified
          ? "Final payment marked as verified."
          : "Final payment verification removed.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: error.message,
      });
    },
  });

  const createWeddingMutation = useMutation({
    mutationFn: (wedding: Omit<DbWedding, "id" | "created_at">) =>
      api.createWedding(wedding, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setIsDialogOpen(false);
      toast({
        title: "Wedding Created",
        description: "The wedding has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create wedding",
        description: error.message,
      });
    },
  });

  const handleAddWedding = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    createWeddingMutation.mutate({
      client_name: formData.get("brideName") as string,
      partner_name: formData.get("partnerName") as string,
      date: formData.get("date") as string,
      location: `${formData.get("city")}, ${formData.get("state")}`,
      region: formData.get("region")
        ? [formData.get("region") as string]
        : null,
      status: "upcoming",
      notes: formData.get("venue") as string,
      total_amount: formData.get("totalAmount")
        ? parseFloat(formData.get("totalAmount") as string)
        : 0,
      is_lgbtq: formData.get("isLgbtq") === "on",
    });
  };

  const renderCancelledTable = () => {
    const totalPages = Math.ceil(cancelledWeddings.length / itemsPerPage);
    const paginatedList = cancelledWeddings.slice(
      (cancelledPage - 1) * itemsPerPage,
      cancelledPage * itemsPerPage,
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle>Cancelled Weddings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Wedding Date</TableHead>
                <TableHead>Cancelled On</TableHead>
                <TableHead>Refund</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : paginatedList.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No cancelled weddings.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedList.map((wedding) => (
                  <TableRow key={wedding.id} className="opacity-75">
                    <TableCell className="font-medium">
                      {wedding.client_name}
                    </TableCell>
                    <TableCell>
                      {wedding.date ? formatDisplayDate(wedding.date) : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {wedding.cancelled_at
                        ? formatDisplayDate(wedding.cancelled_at)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {wedding.refund_processed ? (
                        <span className="text-emerald-600 font-medium text-sm">
                          ${(wedding.refund_amount || 0).toLocaleString()}
                          {wedding.refund_date && (
                            <span className="text-xs text-muted-foreground block">
                              {formatDisplayDate(wedding.refund_date)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          No refund
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-[200px] truncate text-sm text-muted-foreground"
                      title={wedding.cancellation_reason || ""}
                    >
                      {wedding.cancellation_reason || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <ManageWeddingSheet wedding={wedding} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (
                              confirm(
                                `Restore ${wedding.client_name}'s wedding back to active status?`,
                              )
                            ) {
                              api
                                .updateWedding(wedding.id, {
                                  status: "upcoming",
                                  cancelled_at: null,
                                  cancelled_by: null,
                                  cancellation_reason: null,
                                  refund_amount: 0,
                                  refund_processed: false,
                                  refund_date: null,
                                  cancellation_notes: null,
                                })
                                .then(() => {
                                  queryClient.invalidateQueries({
                                    queryKey: ["weddings"],
                                  });
                                  toast({
                                    title: "Wedding Restored",
                                    description: `${wedding.client_name}'s wedding is now active again.`,
                                  });
                                })
                                .catch((err: any) => {
                                  toast({
                                    variant: "destructive",
                                    title: "Failed to restore",
                                    description: err.message,
                                  });
                                });
                            }
                          }}
                        >
                          Restore
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="mt-4 flex justify-end">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCancelledPage((prev) => Math.max(prev - 1, 1))
                      }
                      className={
                        cancelledPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm text-muted-foreground px-4">
                      Page {cancelledPage} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCancelledPage((prev) =>
                          Math.min(prev + 1, totalPages),
                        )
                      }
                      className={
                        cancelledPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderTable = (
    weddingList: DbWedding[],
    isPending: boolean,
    currentPage: number,
    setCurrentPage: (page: number | ((prev: number) => number)) => void,
    title?: string,
  ) => {
    const totalPages = Math.ceil(weddingList.length / itemsPerPage);
    const paginatedList = weddingList.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {title || (isPending ? "Pending Weddings" : "Wedding Roster")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : paginatedList.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No weddings found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedList.map((wedding) => {
                  const readiness = calculateReadiness(wedding);

                  let displayStatus = wedding.status;
                  if (
                    wedding.status?.toLowerCase() === "upcoming" &&
                    wedding.date
                  ) {
                    const wDate = parseLocalDate(wedding.date);

                    if (wDate.getTime() === today.getTime())
                      displayStatus = "Today";
                    else if (wDate.getTime() < today.getTime())
                      displayStatus = "Past";
                  }

                  return (
                    <TableRow key={wedding.id}>
                      <TableCell className="font-medium">
                        {wedding.client_name}
                      </TableCell>
                      <TableCell>
                        {wedding.date ? formatDisplayDate(wedding.date) : ""}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {DB_PACKAGES.find((p) => p.id === wedding.package)
                            ?.name ||
                            wedding.package ||
                            "Custom"}
                        </div>
                        {wedding.addons && wedding.addons.length > 0 && (
                          <div
                            className="text-xs text-muted-foreground truncate max-w-[200px]"
                            title={
                              Array.isArray(wedding.addons)
                                ? wedding.addons
                                    .map(
                                      (id: string) =>
                                        ADDONS.find((a) => a.id === id)?.name ||
                                        id,
                                    )
                                    .join(", ")
                                : wedding.addons
                            }
                          >
                            {Array.isArray(wedding.addons)
                              ? wedding.addons
                                  .map(
                                    (id: string) =>
                                      ADDONS.find((a) => a.id === id)?.name ||
                                      id,
                                  )
                                  .join(", ")
                              : wedding.addons}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${(wedding.total_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-emerald-600 font-medium">
                        ${(wedding.paid_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={displayStatus} />
                        {(() => {
                          const songs = Array.isArray(wedding.highlight_songs)
                            ? wedding.highlight_songs
                            : [];
                          if (wedding.songs_submitted_at && songs.length > 0) {
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="secondary"
                                    className="ml-1 text-[10px] gap-1 cursor-help"
                                  >
                                    <Music className="h-2.5 w-2.5" />
                                    {songs.length}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="whitespace-normal max-w-[250px]">
                                  <p className="font-semibold mb-1">
                                    Highlight Songs ({songs.length})
                                  </p>
                                  {songs.map((s: any, i: number) => (
                                    <p key={i} className="text-xs">
                                      • {s.title} — {s.artist}
                                      {s.moment ? ` (${s.moment})` : ""}
                                    </p>
                                  ))}
                                </TooltipContent>
                              </Tooltip>
                            );
                          }
                          return null;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col gap-1.5 w-24 cursor-help">
                              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                                <span>Readiness</span>
                                <span>{Math.round(readiness)}%</span>
                              </div>
                              <Progress value={readiness} className="h-1.5" />
                            </div>
                          </TooltipTrigger>
                          {readiness < 100 && (
                            <TooltipContent className="p-3 whitespace-normal max-w-[200px]">
                              <p className="font-bold text-xs mb-2 uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                Missing Items
                              </p>
                              <ul className="space-y-1.5">
                                {getMissingItems(wedding).map((item, i) => (
                                  <li
                                    key={i}
                                    className="text-[11px] flex items-start gap-1.5 leading-tight"
                                  >
                                    <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right">
                        {isPending ? (
                          <div className="flex justify-end items-center gap-2">
                            <ReviewWeddingDialog
                              wedding={wedding}
                              onPublish={() => {}}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-primary"
                              title="Send booking confirmation email"
                              onClick={async () => {
                                const email =
                                  wedding.client_email ||
                                  (wedding.questionnaire_data as any)
                                    ?.contact_info?.email;
                                if (!email) {
                                  toast({
                                    variant: "destructive",
                                    title: "No Email Found",
                                    description:
                                      "Add the bride's email in Manage > Details first.",
                                  });
                                  return;
                                }
                                if (
                                  !settings?.email_bride_welcome_template ||
                                  !settings?.email_bride_welcome_subject
                                ) {
                                  toast({
                                    variant: "destructive",
                                    title: "Template Missing",
                                    description:
                                      "Configure the Bride Welcome email template in Settings.",
                                  });
                                  return;
                                }
                                const subject =
                                  settings.email_bride_welcome_subject
                                    .replace(
                                      /{{company_name}}/g,
                                      settings.company_name || "us",
                                    )
                                    .replace(
                                      /{{bride_name}}/g,
                                      wedding.client_name || "Bride",
                                    );
                                const msg =
                                  settings.email_bride_welcome_template
                                    .replace(
                                      /{{company_name}}/g,
                                      settings.company_name || "us",
                                    )
                                    .replace(
                                      /{{logo_url}}/g,
                                      settings.logo_url || DEFAULT_LOGO_URL,
                                    )
                                    .replace(
                                      /{{bride_name}}/g,
                                      wedding.client_name || "Bride",
                                    )
                                    .replace(
                                      /{{portal_link}}/g,
                                      `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/bride-portal/${wedding.id}`,
                                    );
                                toast({
                                  title: "Sending...",
                                  description: `Sending confirmation to ${email}`,
                                });
                                try {
                                  await api.sendOvantaEmail(
                                    email,
                                    subject,
                                    msg,
                                    wedding.client_name,
                                    true,
                                  );
                                  toast({
                                    title: "Confirmation Sent!",
                                    description: `Booking confirmation sent to ${email}`,
                                  });
                                } catch (err: any) {
                                  toast({
                                    variant: "destructive",
                                    title: "Failed to send",
                                    description: err.message,
                                  });
                                }
                              }}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Confirm
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete pending wedding?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the pending
                                    wedding for {wedding.client_name}. This
                                    action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      deleteWeddingMutation.mutate(wedding.id)
                                    }
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : (
                          <div className="flex justify-end items-center gap-2">
                            {(() => {
                              const totalAmount =
                                Number(wedding.total_amount) || 0;
                              const paidAmount =
                                Number(wedding.paid_amount) || 0;
                              const fullyPaid =
                                totalAmount > 0 &&
                                paidAmount >= totalAmount - 0.01;
                              return (
                                <Button
                                  size="sm"
                                  variant={
                                    wedding.final_payment_verified
                                      ? "secondary"
                                      : fullyPaid
                                        ? "default"
                                        : "outline"
                                  }
                                  className="text-xs"
                                  disabled={
                                    verifyFinalPaymentMutation.isPending
                                  }
                                  onClick={() =>
                                    verifyFinalPaymentMutation.mutate({
                                      weddingId: wedding.id,
                                      verified: !wedding.final_payment_verified,
                                    })
                                  }
                                >
                                  {wedding.final_payment_verified ? (
                                    <>
                                      <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                                      Verified
                                    </>
                                  ) : fullyPaid ? (
                                    <>
                                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                      Confirm Payment
                                    </>
                                  ) : (
                                    <>
                                      <DollarSign className="h-3.5 w-3.5 mr-1" />
                                      Verify Payment
                                    </>
                                  )}
                                </Button>
                              );
                            })()}
                            <WeddingActionsMenu
                              wedding={wedding}
                              settings={settings}
                              navigate={navigate}
                              onChangePlan={setChangePlanWedding}
                              onUpsell={setUpsellWedding}
                              onVerifyPayment={handleVerifyPayment}
                              verifyPaymentPending={
                                verifyFinalPaymentMutation.isPending
                              }
                              onEmailPreview={(data, sendFn) => {
                                setEmailPreview(data);
                                setEmailPreviewSend(() => sendFn);
                                setEmailPreviewOpen(true);
                              }}
                            />
                            <ContractModal wedding={wedding} showSaveSnapshot />
                            <ManageWeddingSheet wedding={wedding} />
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              title="Cancel & Archive Wedding"
                              onClick={() => setCancelWeddingTarget(wedding)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="mt-4 flex justify-end">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm text-muted-foreground px-4">
                      Page {currentPage} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Tabs defaultValue="weddings" className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Operations
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage upcoming weddings and staffing needs.
          </p>
        </div>
        <TabsList className="hidden md:flex">
          <TabsTrigger value="weddings">Weddings</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
        </TabsList>
      </div>

      <div className="md:hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="weddings">Weddings</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="weddings" className="space-y-6 mt-0">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ImportWeddingsDialog />
          <Button
            variant="outline"
            onClick={() => {
              const link = `${window.location.origin}/book`;
              const fallbackCopy = () => {
                const textArea = document.createElement("textarea");
                textArea.value = link;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                  document.execCommand("copy");
                  toast({
                    title: "Booking Link Copied!",
                    description:
                      "Share this link with potential clients to let them book their wedding and pay the deposit.",
                  });
                } catch (e) {
                  toast({
                    variant: "destructive",
                    title: "Failed to copy",
                    description: "Could not copy link automatically.",
                  });
                }
                document.body.removeChild(textArea);
              };
              try {
                if (navigator.clipboard && window.isSecureContext) {
                  navigator.clipboard
                    .writeText(link)
                    .then(() => {
                      toast({
                        title: "Booking Link Copied!",
                        description:
                          "Share this link with potential clients to let them book their wedding and pay the deposit.",
                      });
                    })
                    .catch(fallbackCopy);
                } else {
                  fallbackCopy();
                }
              } catch (err) {
                fallbackCopy();
              }
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Booking Link
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Wedding
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleAddWedding}>
                <DialogHeader>
                  <DialogTitle>Add New Wedding</DialogTitle>
                  <DialogDescription>
                    Enter the details for the new wedding. Click save when
                    you're done.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">
                      Title
                    </Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="Smith & Jones Wedding"
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="brideName" className="text-right">
                      Client 1
                    </Label>
                    <Input
                      id="brideName"
                      name="brideName"
                      placeholder="Sarah Smith"
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="partnerName" className="text-right">
                      Client 2
                    </Label>
                    <Input
                      id="partnerName"
                      name="partnerName"
                      placeholder="John Jones"
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="date" className="text-right">
                      Date
                    </Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="venue" className="text-right">
                      Venue
                    </Label>
                    <Input
                      id="venue"
                      name="venue"
                      placeholder="The Grand Estate"
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="city" className="text-right">
                      City
                    </Label>
                    <Input
                      id="city"
                      name="city"
                      placeholder="Austin"
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="state" className="text-right">
                      State
                    </Label>
                    <Input
                      id="state"
                      name="state"
                      placeholder="TX"
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="isLgbtqNew" className="text-right">
                      LGBTQ+
                    </Label>
                    <div className="col-span-3 flex items-center">
                      <Switch id="isLgbtqNew" name="isLgbtq" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="totalAmount" className="text-right">
                      Investment ($)
                    </Label>
                    <Input
                      id="totalAmount"
                      name="totalAmount"
                      type="number"
                      step="0.01"
                      placeholder="3500.00"
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="region" className="text-right">
                      Region
                    </Label>
                    <div className="col-span-3">
                      <Select name="region" required>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                          {regions.length === 0 && (
                            <SelectItem value="none" disabled>
                              No regions configured
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Save Wedding</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Global search across all wedding statuses */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={weddingSearch}
            onChange={(e) => setWeddingSearch(e.target.value)}
            placeholder="Search weddings by bride, partner, email, venue, region, date, or package…"
            className="pl-9"
          />
          {weddingSearch && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-muted-foreground"
              onClick={() => setWeddingSearch("")}
            >
              Clear
            </Button>
          )}
        </div>

        {/* On Deck moved into its own tab below */}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="on-deck" className="relative">
              On Deck
              {onDeckSorted.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-semibold">
                  {onDeckSorted.length}
                </span>
              )}
            </TabsTrigger>
            {pendingWeddings.length > 0 && (
              <TabsTrigger value="needs-review" className="relative">
                Needs Review
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                  {pendingWeddings.length}
                </span>
              </TabsTrigger>
            )}
            <TabsTrigger value="active">Active Weddings</TabsTrigger>
            <TabsTrigger value="past">Past Weddings</TabsTrigger>
            <TabsTrigger
              value="cancelled"
              className="text-destructive data-[state=active]:text-destructive"
            >
              Cancelled
              {cancelledWeddings.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive/15 text-[10px] text-destructive font-medium">
                  {cancelledWeddings.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="on-deck">
            {onDeckSorted.length > 0 ? (
              <div className="space-y-4">
                {/* Summary stats strip */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {onDeckSorted.length} On Deck
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-600 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {
                      onDeckSorted.filter((w: any) => {
                        const d = parseLocalDate(w.date);
                        const daysUntil = Math.ceil(
                          (d.getTime() - today.getTime()) /
                            (1000 * 60 * 60 * 24),
                        );
                        if (daysUntil > 7 || daysUntil < 0) return false;
                        const tA = Number(w.total_amount) || 0;
                        const pA = Number(w.paid_amount) || 0;
                        const unpaid = Math.max(0, tA - pA);
                        const isFullyPaid = tA > 0 && pA >= tA - 0.01;
                        const isVerified = w.final_payment_verified;
                        const readiness = calculateReadiness(w);
                        const wAssignments = (assignments as any[]).filter(
                          (a) => a.jobs?.wedding_id === w.id,
                        );
                        return (
                          (tA > 0 && unpaid > 0.01) ||
                          (isFullyPaid && !isVerified) ||
                          readiness < 100 ||
                          wAssignments.length === 0
                        );
                      }).length
                    }{" "}
                    Urgent (≤7 days)
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">
                    <DollarSign className="h-3.5 w-3.5" />$
                    {onDeckSorted
                      .reduce(
                        (sum: number, w: any) =>
                          sum +
                          Math.max(
                            0,
                            (Number(w.total_amount) || 0) -
                              (Number(w.paid_amount) || 0),
                          ),
                        0,
                      )
                      .toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{" "}
                    Unpaid
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold">
                    <Users className="h-3.5 w-3.5" />
                    {
                      new Set(
                        onDeckSorted.flatMap((w: any) =>
                          (assignments as any[])
                            .filter((a) => a.jobs?.wedding_id === w.id)
                            .map((a) => a.contractor_id),
                        ),
                      ).size
                    }{" "}
                    Contractors Assigned
                  </div>
                </div>

                {/* Dense table view */}
                <Card className="shadow-sm border-border/40 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/40 bg-muted/30">
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                              Wedding
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                              Date
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                              Package
                            </th>
                            <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                              Payment
                            </th>
                            <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                              Ready
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                              Team
                            </th>
                            <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {onDeckSorted.map((wedding: any) => {
                            const weddingDate = parseLocalDate(wedding.date);
                            const daysUntil = Math.ceil(
                              (weddingDate.getTime() - today.getTime()) /
                                (1000 * 60 * 60 * 24),
                            );
                            const total = Number(wedding.total_amount) || 0;
                            const paid = Number(wedding.paid_amount) || 0;
                            const unpaid = Math.max(0, total - paid);
                            const isFullyPaid =
                              total > 0 && paid >= total - 0.01;
                            const isVerified = wedding.final_payment_verified;
                            // Round readiness to max 2 decimals
                            const readiness =
                              Math.round(calculateReadiness(wedding) * 100) /
                              100;
                            // Contractors come from assignments (not a wedding field)
                            const weddingAssignments = (
                              assignments as any[]
                            ).filter((a) => a.jobs?.wedding_id === wedding.id);
                            const contractors = weddingAssignments.map((a) => ({
                              id: a.contractor_id,
                              first_name:
                                a.contractors?.first_name || "Unknown",
                              last_name: a.contractors?.last_name || "",
                              role: a.jobs?.role || "Team",
                            }));
                            // Hours come from jobs
                            const weddingJobs = jobs.filter(
                              (j) => j.wedding_id === wedding.id,
                            );
                            const totalHours = weddingJobs.reduce(
                              (s, j) => s + (Number(j.hours) || 0),
                              0,
                            );
                            const pkgName =
                              wedding.package ||
                              (wedding.addons &&
                              Array.isArray(wedding.addons) &&
                              wedding.addons.length > 0
                                ? wedding.addons[0]
                                : null);

                            // Only mark urgent if the wedding is close AND actually needs attention
                            const needsAttention =
                              (total > 0 && unpaid > 0.01) || // outstanding balance
                              (isFullyPaid && !isVerified) || // paid but not verified
                              readiness < 100 || // missing prep items
                              contractors.length === 0; // no team assigned
                            const isUrgent =
                              daysUntil >= 0 &&
                              daysUntil <= 7 &&
                              needsAttention;

                            return (
                              <tr
                                key={wedding.id}
                                className={`border-b border-border/20 hover:bg-muted/30 transition-colors ${
                                  isUrgent ? "bg-red-500/5" : ""
                                }`}
                              >
                                {/* Client name + venue + status */}
                                <td className="px-4 py-4">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-foreground">
                                        {wedding.client_name}
                                      </span>
                                      {isUrgent && (
                                        <Badge
                                          variant="destructive"
                                          className="text-[9px] h-4 px-1.5"
                                        >
                                          URGENT
                                        </Badge>
                                      )}
                                      <Badge
                                        variant={
                                          wedding.status === "upcoming"
                                            ? "default"
                                            : "secondary"
                                        }
                                        className="text-[9px] h-4 px-1.5"
                                      >
                                        {(
                                          wedding.status || "pending"
                                        ).toUpperCase()}
                                      </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      {wedding.location || "Venue TBD"}
                                    </span>
                                  </div>
                                </td>

                                {/* Date */}
                                <td className="px-4 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-xs">
                                      {formatDisplayDate(wedding.date)}
                                    </span>
                                    <span
                                      className={`text-[11px] font-medium ${
                                        daysUntil < 0
                                          ? "text-muted-foreground"
                                          : daysUntil <= 7
                                            ? "text-red-600"
                                            : daysUntil <= 14
                                              ? "text-amber-600"
                                              : "text-emerald-600"
                                      }`}
                                    >
                                      {daysUntil < 0
                                        ? "Past"
                                        : daysUntil === 0
                                          ? "Today"
                                          : `${daysUntil} days`}
                                    </span>
                                  </div>
                                </td>

                                {/* Package + hours */}
                                <td className="px-4 py-4 hidden lg:table-cell">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-medium text-foreground">
                                      {pkgName || "—"}
                                    </span>
                                    {totalHours > 0 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {totalHours} hrs booked
                                      </span>
                                    )}
                                    {weddingJobs.length > 0 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {
                                          weddingJobs.filter(
                                            (j) =>
                                              j.status === "filled" ||
                                              j.status === "completed",
                                          ).length
                                        }
                                        /{weddingJobs.length} roles filled
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Payment status */}
                                <td className="px-4 py-4">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      {isFullyPaid ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                      ) : (
                                        <Clock className="h-4 w-4 text-amber-500" />
                                      )}
                                      <span
                                        className={`font-bold text-xs ${
                                          isFullyPaid
                                            ? "text-emerald-600"
                                            : "text-foreground"
                                        }`}
                                      >
                                        $
                                        {paid.toLocaleString(undefined, {
                                          minimumFractionDigits: 0,
                                        })}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        / $
                                        {total.toLocaleString(undefined, {
                                          minimumFractionDigits: 0,
                                        })}
                                      </span>
                                    </div>
                                    {!isFullyPaid && unpaid > 0 && (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                        ${unpaid.toLocaleString()} unpaid
                                      </span>
                                    )}
                                    {isFullyPaid && !isVerified && (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="h-6 text-[10px] rounded-full bg-primary hover:bg-primary/90"
                                        onClick={() =>
                                          handleVerifyPayment(wedding.id, true)
                                        }
                                      >
                                        Confirm Final Payment
                                      </Button>
                                    )}
                                    {isVerified && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                      >
                                        Verified ✓
                                      </Badge>
                                    )}
                                  </div>
                                </td>

                                {/* Readiness */}
                                <td className="px-4 py-4 hidden md:table-cell">
                                  <div className="flex flex-col items-center gap-1">
                                    <div
                                      className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold ${
                                        readiness >= 100
                                          ? "bg-emerald-500/10 text-emerald-600"
                                          : readiness >= 80
                                            ? "bg-amber-500/10 text-amber-600"
                                            : "bg-red-500/10 text-red-600"
                                      }`}
                                    >
                                      {Math.round(readiness)}%
                                    </div>
                                    {readiness < 100 && (
                                      <ManageWeddingSheet
                                        wedding={wedding}
                                        trigger={
                                          <button className="text-[10px] text-primary hover:underline cursor-pointer">
                                            View gaps
                                          </button>
                                        }
                                      />
                                    )}
                                  </div>
                                </td>

                                {/* Team/Contractors */}
                                <td className="px-4 py-4 hidden xl:table-cell">
                                  {contractors.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                                      {contractors.slice(0, 3).map((c: any) => (
                                        <Tooltip key={c.id}>
                                          <TooltipTrigger asChild>
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] gap-1 py-0.5 px-2"
                                            >
                                              <Avatar className="h-4 w-4">
                                                <AvatarFallback className="text-[8px]">
                                                  {(c.first_name?.[0] || "") +
                                                    (c.last_name?.[0] || "")}
                                                </AvatarFallback>
                                              </Avatar>
                                              <span className="truncate max-w-[80px]">
                                                {c.first_name}{" "}
                                                {c.last_name?.[0]}.
                                              </span>
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            <p className="font-semibold">
                                              {c.first_name} {c.last_name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {c.role || "Team Member"}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ))}
                                      {contractors.length > 3 && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px]"
                                        >
                                          +{contractors.length - 3} more
                                        </Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">
                                      No team assigned
                                    </span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="px-4 py-4">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <CallSheetGenerator
                                      weddingId={wedding.id}
                                      weddingName={wedding.client_name}
                                    />
                                    <ManageWeddingSheet
                                      wedding={wedding}
                                      trigger={
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 text-xs rounded-lg"
                                        >
                                          Manage
                                        </Button>
                                      }
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-1">
                    No weddings on deck
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Weddings published and scheduled within the next 30 days
                    will appear here.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          {pendingWeddings.length > 0 && (
            <TabsContent value="needs-review">
              {renderTable(
                pendingWeddings,
                true,
                pendingPage,
                setPendingPage,
                "Pending Weddings",
              )}
            </TabsContent>
          )}
          <TabsContent value="active">
            {renderTable(
              activeWeddings,
              false,
              activePage,
              setActivePage,
              "Active Weddings",
            )}
          </TabsContent>
          <TabsContent value="past">
            {renderTable(
              pastWeddings,
              false,
              pastPage,
              setPastPage,
              "Past Weddings",
            )}
          </TabsContent>
          <TabsContent value="cancelled">{renderCancelledTable()}</TabsContent>
        </Tabs>
      </TabsContent>
      <TabsContent value="positions" className="mt-0">
        <PositionsTab />
      </TabsContent>

      {cancelWeddingTarget && (
        <CancelWeddingModal
          wedding={cancelWeddingTarget}
          open={!!cancelWeddingTarget}
          onOpenChange={(open) => {
            if (!open) setCancelWeddingTarget(null);
          }}
        />
      )}

      <ChangePaymentPlanDialog
        wedding={changePlanWedding}
        open={!!changePlanWedding}
        onOpenChange={(open) => {
          if (!open) setChangePlanWedding(null);
        }}
        settings={settings}
        onEmailPreview={(email, subject, html, name, sendFn) => {
          setEmailPreview({ to: email, subject, html, recipientName: name });
          setEmailPreviewSend(() => sendFn);
          setEmailPreviewOpen(true);
        }}
      />
      {bartendingModuleOn && (
        <BartendingUpsellDialog
          wedding={upsellWedding}
          open={!!upsellWedding}
          onOpenChange={(open) => {
            if (!open) setUpsellWedding(null);
          }}
          settings={settings}
          onEmailPreview={(email, subject, html, name, sendFn) => {
            setEmailPreview({ to: email, subject, html, recipientName: name });
            setEmailPreviewSend(() => sendFn);
            setEmailPreviewOpen(true);
          }}
        />
      )}
      <EmailPreviewModal
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
        emailData={emailPreview}
        onConfirm={async () => {
          if (emailPreviewSend) {
            try {
              await emailPreviewSend();
            } catch (err: any) {
              toast({
                variant: "destructive",
                title: "Failed to send",
                description: err.message,
              });
              throw err;
            }
          }
        }}
      />
    </Tabs>
  );
}
