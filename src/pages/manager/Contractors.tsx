import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  MoreHorizontal,
  Upload,
  Download,
  Undo,
  Database,
  Search,
  ChevronDown,
  RefreshCw,
  Shield,
  FileText,
  CheckCircle2,
  LogIn,
  Calendar,
  ImageIcon,
  Send,
  StickyNote,
  ArrowRight,
  Star,
  Clock,
  Camera,
  Video,
  ExternalLink,
  ShieldCheck,
  Bell,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { ToastAction } from "@/components/ui/toast";
import { api, DbContractor } from "@/lib/api";
import { parseRegions } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";

function PipelineCard({
  contractor,
  isOverlay = false,
  onEdit,
  onRequestGallery,
  onAdvanceStage,
  onSendReminder,
}: {
  contractor: any;
  isOverlay?: boolean;
  onEdit?: (c: any) => void;
  onRequestGallery?: (c: any) => void;
  onAdvanceStage?: (c: any, status: string) => void;
  onSendReminder?: (c: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: contractor.id,
      data: contractor,
    });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const getNextStageInfo = (status: string) => {
    switch (status) {
      case "applied":
        return { id: "interview", label: "Advance to Interview" };
      case "interview":
        return { id: "paperwork", label: "Advance to Paperwork" };
      case "paperwork":
        return { id: "active", label: "Hire Contractor" };
      default:
        return null;
    }
  };

  const nextStage = getNextStageInfo(contractor.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging && !isOverlay ? "opacity-50" : ""}`}
    >
      <Card
        onClick={(e) => {
          if (!isOverlay && onEdit) {
            onEdit(contractor);
          }
        }}
        className={`p-3 mb-2 shadow-sm border-l-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative group cursor-pointer ${isOverlay ? "rotate-2 scale-105" : ""} ${
          contractor.status === "applied"
            ? "border-l-slate-300"
            : contractor.status === "interview"
              ? "border-l-sky-400"
              : contractor.status === "paperwork"
                ? "border-l-indigo-500"
                : contractor.status === "rejected" ||
                    contractor.status === "declined"
                  ? "border-l-red-500"
                  : "border-l-emerald-500"
        }`}
      >
        <div {...listeners} {...attributes} className="min-h-[60px]">
          <div className="flex justify-between items-start">
            <div className="font-semibold text-sm truncate pr-2 flex-1">
              {contractor.first_name} {contractor.last_name}
            </div>
            <div className="flex gap-1.5 shrink-0 mt-0.5">
              {!isDragging && onSendReminder && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendReminder(contractor);
                  }}
                  className="h-5 w-5 flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600 shadow-sm hover:bg-amber-100 transition-colors"
                  title="Send Stage Reminder"
                >
                  <Bell className="h-3 w-3" />
                </button>
              )}
              {contractor.w9_signature && (
                <Badge
                  variant="outline"
                  className="h-5 w-5 p-0 flex items-center justify-center rounded-full border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm"
                  title="W-9 Signed"
                >
                  <ShieldCheck className="h-3 w-3" />
                </Badge>
              )}
              {contractor.contract_signature && (
                <Badge
                  variant="outline"
                  className="h-5 w-5 p-0 flex items-center justify-center rounded-full border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm"
                  title="Agreement Signed"
                >
                  <FileText className="h-3 w-3" />
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 font-medium">
            {contractor.specialty?.toLowerCase().includes("photo") && (
              <Camera className="h-3 w-3" />
            )}
            {contractor.specialty?.toLowerCase().includes("video") && (
              <Video className="h-3 w-3" />
            )}
            <span className="truncate">
              {contractor.specialty || "No Specialty"}
            </span>
            {contractor.rating && (
              <span className="flex items-center gap-0.5 ml-auto text-amber-500 font-bold">
                {contractor.rating}
                <Star className="h-2.5 w-2.5 fill-current" />
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="text-[11px] text-muted-foreground truncate opacity-60 group-hover:opacity-100 transition-opacity flex-1">
              {contractor.email}
            </div>
            {contractor.updated_at && (
              <div className="text-[10px] text-muted-foreground/60 font-medium flex items-center gap-1 shrink-0 ml-2">
                <Clock className="h-2.5 w-2.5" />
                {Math.floor(
                  (Date.now() - new Date(contractor.updated_at).getTime()) /
                    (1000 * 60 * 60 * 24),
                ) === 0
                  ? "Today"
                  : `${Math.floor((Date.now() - new Date(contractor.updated_at).getTime()) / (1000 * 60 * 60 * 24))}d ago`}
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {contractor.portfolio_url && (
              <a
                href={contractor.portfolio_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors"
              >
                Portfolio <ExternalLink className="h-2 w-2" />
              </a>
            )}
            {contractor.gallery_requested_at && (
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded">
                <ImageIcon className="h-2 w-2" />
                Gallery Requested
              </div>
            )}
          </div>

          {contractor.status === "interview" &&
            (contractor.interview_date ? (
              <div className="mt-2.5 text-[11px] font-medium text-blue-700 bg-blue-100/50 border border-blue-200 px-2 py-1.5 rounded-md flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {new Date(contractor.interview_date).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            ) : (
              <div className="mt-2.5 text-[10px] font-medium text-muted-foreground bg-muted/50 border px-2 py-1.5 rounded-md flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70" />
                Waiting for applicant to schedule...
              </div>
            ))}
          {contractor.status === "paperwork" &&
            contractor.w9_signature &&
            contractor.contract_signature && (
              <Badge
                className="mt-2.5 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200 font-medium"
                variant="outline"
              >
                Paperwork Complete
              </Badge>
            )}
          {contractor.status === "applied" &&
            !isOverlay &&
            onRequestGallery &&
            !contractor.gallery_requested_at && (
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestGallery(contractor);
                  }}
                  className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-lg w-full transition-all duration-200"
                >
                  <ImageIcon className="h-3 w-3 shrink-0" />
                  Request Portfolio Gallery
                </button>
              </div>
            )}
          {nextStage && !isOverlay && onAdvanceStage && (
            <div
              className={
                contractor.status === "applied" &&
                !contractor.gallery_requested_at
                  ? "mt-2"
                  : "mt-3"
              }
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvanceStage(contractor, nextStage.id);
                }}
                className={`flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg w-full transition-all duration-200 shadow-sm ${
                  contractor.status === "paperwork" &&
                  contractor.w9_signature &&
                  contractor.contract_signature
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
                    : "bg-white text-muted-foreground border border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"
                }`}
              >
                {nextStage.label}
                <ArrowRight className="h-3 w-3 shrink-0" />
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function PipelineColumn({
  id,
  title,
  description,
  contractors,
  onEdit,
  onRequestGallery,
  onAdvanceStage,
  onSendReminder,
}: {
  id: string;
  title: string;
  description?: string;
  contractors: any[];
  onEdit: (c: any) => void;
  onRequestGallery?: (c: any) => void;
  onAdvanceStage?: (c: any, status: string) => void;
  onSendReminder?: (c: any) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 bg-muted/30 rounded-xl p-4 min-w-[250px] ${isOver ? "bg-muted/50" : ""}`}
    >
      <div className="mb-4">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          {title} ({contractors.length})
        </h3>
        {description && (
          <p className="text-[10px] text-muted-foreground/70 mt-1 leading-tight uppercase font-medium">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-2 min-h-[200px]">
        {contractors.map((c) => (
          <PipelineCard
            key={c.id}
            contractor={c}
            onEdit={onEdit}
            onRequestGallery={onRequestGallery}
            onAdvanceStage={onAdvanceStage}
            onSendReminder={onSendReminder}
          />
        ))}
      </div>
    </div>
  );
}

const parseCSVRow = (str: string) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '"') {
      inQuotes = !inQuotes;
    } else if (str[i] === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += str[i];
    }
  }
  result.push(current.trim());
  return result;
};

export default function ManagerContractors() {
  const { impersonate } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingContractor, setEditingContractor] = useState<any>(null);
  const [deliveryError, setDeliveryError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [viewingDoc, setViewingDoc] = useState<"w9" | "contract" | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [fetchedInterviews, setFetchedInterviews] = useState<
    Record<string, string>
  >({});
  const [portfolioRequestContractor, setPortfolioRequestContractor] =
    useState<any>(null);
  const [sendingPortfolioRequest, setSendingPortfolioRequest] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [terminatingContractor, setTerminatingContractor] = useState<any>(null);

  const handleSendReminder = async (contractor: any) => {
    try {
      toast({ title: "Sending reminder...", description: "Please wait." });
      const settings = await api.getPortalSettings();
      const status = contractor.status;

      let stageName = status;
      if (status === "active" || status === "hired") stageName = "Hired";
      else if (status === "interview") stageName = "Interview";
      else if (status === "paperwork") stageName = "Paperwork & Onboarding";
      else if (status === "applied") stageName = "Application Received";

      const companyName = settings?.company_name || "Veydra";
      const baseUrl = (settings?.app_url || window.location.origin).replace(
        /\/$/,
        "",
      );

      let emailEnabled = false;
      let emailSubject = "";
      let emailTemplate = "";
      let smsEnabled = false;
      let smsTemplate = "";

      if (status === "active" || status === "hired") {
        emailEnabled = settings?.email_pipeline_hired_enabled || false;
        emailSubject =
          settings?.email_pipeline_hired_subject ||
          "Congratulations! You're Hired";
        emailTemplate = settings?.email_pipeline_hired_template || "";
        smsEnabled = settings?.sms_pipeline_hired_enabled || false;
        smsTemplate = settings?.sms_pipeline_hired_template || "";
      } else if (status === "paperwork") {
        emailEnabled = settings?.email_pipeline_paperwork_enabled || false;
        emailSubject =
          settings?.email_pipeline_paperwork_subject ||
          "Application Update: Paperwork Stage";
        emailTemplate = settings?.email_pipeline_paperwork_template || "";
        smsEnabled = settings?.sms_pipeline_paperwork_enabled || false;
        smsTemplate = settings?.sms_pipeline_paperwork_template || "";
      } else if (status === "interview") {
        emailEnabled = settings?.email_pipeline_interview_enabled || false;
        emailSubject =
          settings?.email_pipeline_interview_subject ||
          "Application Update: Interview Stage";
        emailTemplate = settings?.email_pipeline_interview_template || "";
        smsEnabled = settings?.sms_pipeline_interview_enabled || false;
        smsTemplate = settings?.sms_pipeline_interview_template || "";
      } else if (status === "applied") {
        emailEnabled = settings?.email_applicant_welcome_enabled || false;
        emailSubject =
          settings?.email_applicant_welcome_subject || "Application Received";
        emailTemplate = settings?.email_applicant_welcome_template || "";
        smsEnabled = settings?.sms_applicant_welcome_enabled || false;
        smsTemplate = settings?.sms_applicant_welcome_template || "";
      }

      if (emailEnabled && emailTemplate) {
        const subject =
          "Reminder: " +
          emailSubject
            .replace(/{{company_name}}/g, companyName)
            .replace(/{{stage_name}}/g, stageName);

        const msg = emailTemplate
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{logo_url}}/g, settings?.logo_url || "")
          .replace(/{{contractor_name}}/g, contractor.first_name)
          .replace(/{{stage_name}}/g, stageName)
          .replace(/{{portal_link}}/g, baseUrl);

        await api
          .sendOvantaEmail(
            contractor.email,
            subject,
            msg,
            `${contractor.first_name} ${contractor.last_name || ""}`,
            true,
          )
          .catch((err: any) => {
            setDeliveryError({
              title: "Email Delivery Failed",
              message: `Could not send email to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
            });
          });
      } else {
        const subject = `Reminder: Application Update: ${stageName}`;
        const message = `<p>Hi ${contractor.first_name},</p><p>This is a reminder that your application status at ${companyName} is currently: <strong>${stageName}</strong>.</p><p>Please log in to your Candidate Portal to complete any pending action items here:<br><a href="${baseUrl}/login">${baseUrl}/login</a></p>`;

        await api
          .sendOvantaEmail(
            contractor.email,
            subject,
            message,
            `${contractor.first_name} ${contractor.last_name || ""}`,
            true,
          )
          .catch((err: any) => {
            setDeliveryError({
              title: "Email Delivery Failed",
              message: `Could not send email to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
            });
          });
      }

      if (smsEnabled && smsTemplate) {
        const msg =
          "Reminder: " +
          smsTemplate
            .replace(/{{company_name}}/g, companyName)
            .replace(/{{contractor_name}}/g, contractor.first_name)
            .replace(/{{stage_name}}/g, stageName)
            .replace(/{{portal_link}}/g, baseUrl);
        await api
          .sendOvantaSms(
            contractor.email,
            msg,
            `${contractor.first_name} ${contractor.last_name || ""}`,
            true,
          )
          .catch((err: any) => {
            setDeliveryError({
              title: "SMS Delivery Failed",
              message: `Could not send SMS to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
            });
          });
      } else if (!smsTemplate) {
        const msg = `Reminder: Hi ${contractor.first_name}, your application at ${companyName} is in the ${stageName} stage. Please log in to complete pending items: ${baseUrl}/login`;
        await api
          .sendOvantaSms(
            contractor.email,
            msg,
            `${contractor.first_name} ${contractor.last_name || ""}`,
            true,
          )
          .catch((err: any) => {
            setDeliveryError({
              title: "SMS Delivery Failed",
              message: `Could not send SMS to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
            });
          });
      }

      toast({
        title: "Reminder Sent",
        description: `Successfully sent stage reminder to ${contractor.first_name}.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "insurance_url" | "contract_url" | "drone_license_url",
  ) => {
    const file = e.target.files?.[0];
    if (!file || !editingContractor) return;

    try {
      setUploadingDoc(field);

      const fileExt = file.name.split(".").pop();
      const safeEmail = editingContractor.email.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `docs/${field}-${safeEmail}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("contractors")
        .update({ [field]: publicUrl })
        .eq("id", editingContractor.id);

      if (updateError) throw updateError;

      setEditingContractor({ ...editingContractor, [field]: publicUrl });
      queryClient.invalidateQueries({ queryKey: ["contractors"] });

      toast({
        title: "Document uploaded!",
        description: "The document has been securely saved.",
      });
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description:
          error.message || "Please make sure your storage bucket is set up.",
      });
    } finally {
      setUploadingDoc(null);
      if (e.target) e.target.value = "";
    }
  };

  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, specialtyFilter, regionFilter, statusFilter, ratingFilter]);
  const [, setRefreshTrigger] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contractors = [], isLoading } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
  });

  const syncAttempted = useRef<Set<string>>(new Set());

  const syncInterviewFromCRM = async (contractor: any, isAutoSync = false) => {
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("hl_api_key, hl_location_id")
        .limit(1)
        .single();
      if (!settings?.hl_api_key || !settings?.hl_location_id) {
        if (!isAutoSync)
          toast({
            title: "Error",
            description: "CRM credentials missing.",
            variant: "destructive",
          });
        return;
      }

      const headers = {
        Authorization: `Bearer ${settings.hl_api_key}`,
        Version: "2021-07-28",
        Accept: "application/json",
      };

      const searchRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(contractor.email)}`,
        { headers },
      );
      if (!searchRes.ok) throw new Error("Contact not found in CRM");
      const searchData = await searchRes.json();
      const contactId = searchData.contacts?.[0]?.id;
      if (!contactId) throw new Error("Contact not found in CRM");

      let eventsData: any = {};
      const eventsRes = await fetch(
        `https://services.leadconnectorhq.com/calendars/events?locationId=${settings.hl_location_id}&contactId=${contactId}`,
        { headers },
      );

      if (eventsRes.ok) {
        eventsData = await eventsRes.json();
      } else {
        const fallbackRes = await fetch(
          `https://services.leadconnectorhq.com/contacts/${contactId}/appointments`,
          { headers },
        );
        if (fallbackRes.ok) {
          eventsData = await fallbackRes.json();
        } else {
          throw new Error("Failed to fetch appointments");
        }
      }

      const events = eventsData.events || eventsData.appointments || [];
      if (events.length > 0) {
        const upcoming = events
          .filter(
            (e: any) =>
              new Date(e.startTime || e.startAt || e.start_time) >=
              new Date(Date.now() - 86400000),
          )
          .sort(
            (a: any, b: any) =>
              new Date(a.startTime || a.startAt || a.start_time).getTime() -
              new Date(b.startTime || b.startAt || b.start_time).getTime(),
          );

        const targetEvent = upcoming[0] || events[events.length - 1];
        const eventTime =
          targetEvent?.startTime ||
          targetEvent?.startAt ||
          targetEvent?.start_time;

        if (eventTime) {
          supabase
            .from("contractors")
            .update({ interview_date: eventTime })
            .eq("id", contractor.id)
            .then();
          setFetchedInterviews((prev) => ({
            ...prev,
            [contractor.id]: eventTime,
          }));
          setEditingContractor((prev: any) =>
            prev?.id === contractor.id
              ? { ...prev, interview_date: eventTime }
              : prev,
          );
          if (!isAutoSync)
            toast({
              title: "Success",
              description: "Interview date synced from CRM!",
            });
          return;
        }
      }
      if (!isAutoSync)
        toast({
          title: "No Appointments",
          description:
            "No upcoming appointments found in CRM for this contact.",
        });
    } catch (e: any) {
      if (!isAutoSync)
        toast({
          title: "Sync Failed",
          description: e.message,
          variant: "destructive",
        });
      else console.error("Auto-sync failed for", contractor.email, e.message);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (contractors && contractors.length > 0) {
      const interviewees = contractors.filter(
        (c: any) =>
          c.status === "interview" &&
          !c.interview_date &&
          !fetchedInterviews[c.id],
      );
      if (interviewees.length > 0) {
        interviewees.forEach((c: any) => {
          if (!syncAttempted.current.has(c.id)) {
            syncAttempted.current.add(c.id);
            syncInterviewFromCRM(c, true);
          }
        });

        // Poll every 15 seconds for updates
        interval = setInterval(() => {
          interviewees.forEach((c: any) => {
            syncInterviewFromCRM(c, true);
          });
        }, 15000);
      }
    }
    return () => clearInterval(interval);
  }, [contractors, fetchedInterviews]);

  const [selectedContractors, setSelectedContractors] = useState<Set<string>>(
    new Set(),
  );
  const [editingDroneApproved, setEditingDroneApproved] = useState(false);
  const [editingTrainingCompleted, setEditingTrainingCompleted] =
    useState(false);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(
    new Set(),
  );
  const deleteTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    return () => {
      Object.values(deleteTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const settings = await api.getPortalSettings();
      const promises = ids.map(async (id) => {
        const contractor = contractors.find((c: any) => c.id === id);
        const updates: any = { status };

        if (
          status === "active" &&
          !contractor.contract_url &&
          contractor.contract_signature
        ) {
          updates.contract_url = "signed://agreement";
        }

        if (
          contractor &&
          contractor.status !== status &&
          ["active", "interview", "paperwork", "applied", "rejected"].includes(
            status,
          )
        ) {
          let stageName = status;
          if (status === "active") stageName = "Hired";
          else if (status === "interview") stageName = "Interview";
          else if (status === "paperwork") stageName = "Paperwork & Onboarding";
          else if (status === "applied") stageName = "Application Received";
          else if (status === "rejected") stageName = "Application Declined";

          const companyName = settings?.company_name || "Veydra";
          const baseUrl = (settings?.app_url || window.location.origin).replace(
            /\/$/,
            "",
          );

          let emailEnabled = false;
          let emailSubject = "";
          let emailTemplate = "";
          let smsEnabled = false;
          let smsTemplate = "";

          if (status === "active") {
            emailEnabled = settings?.email_pipeline_hired_enabled || false;
            emailSubject =
              settings?.email_pipeline_hired_subject ||
              "Congratulations! You're Hired";
            emailTemplate = settings?.email_pipeline_hired_template || "";
            smsEnabled = settings?.sms_pipeline_hired_enabled || false;
            smsTemplate = settings?.sms_pipeline_hired_template || "";
          } else if (status === "paperwork") {
            emailEnabled = settings?.email_pipeline_paperwork_enabled || false;
            emailSubject =
              settings?.email_pipeline_paperwork_subject ||
              "Application Update: Paperwork Stage";
            emailTemplate = settings?.email_pipeline_paperwork_template || "";
            smsEnabled = settings?.sms_pipeline_paperwork_enabled || false;
            smsTemplate = settings?.sms_pipeline_paperwork_template || "";
          } else if (status === "interview") {
            emailEnabled = settings?.email_pipeline_interview_enabled || false;
            emailSubject =
              settings?.email_pipeline_interview_subject ||
              "Application Update: Interview Stage";
            emailTemplate = settings?.email_pipeline_interview_template || "";
            smsEnabled = settings?.sms_pipeline_interview_enabled || false;
            smsTemplate = settings?.sms_pipeline_interview_template || "";
          } else if (status === "rejected") {
            emailEnabled = settings?.email_pipeline_rejected_enabled || false;
            emailSubject =
              settings?.email_pipeline_rejected_subject ||
              "Update on your application";
            emailTemplate = settings?.email_pipeline_rejected_template || "";
            smsEnabled = settings?.sms_pipeline_rejected_enabled || false;
            smsTemplate = settings?.sms_pipeline_rejected_template || "";
          }

          if (emailEnabled && emailTemplate) {
            const subject = emailSubject
              .replace(/{{company_name}}/g, companyName)
              .replace(/{{stage_name}}/g, stageName);

            let msg = emailTemplate
              .replace(/{{company_name}}/g, companyName)
              .replace(/{{logo_url}}/g, settings?.logo_url || "")
              .replace(/{{contractor_name}}/g, contractor.first_name)
              .replace(/{{stage_name}}/g, stageName)
              .replace(/{{portal_link}}/g, baseUrl);

            if (
              status === "active" &&
              (contractor.contract_signature || contractor.w9_signature)
            ) {
              msg += `<div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                <h3 style="margin-top: 0; font-size: 14px; color: #374151;">Your Signed Documents</h3>
                <p style="font-size: 12px; color: #6b7280;">You can view and download your signed paperwork anytime from your profile.</p>
                <div style="margin-top: 10px;">
                  ${contractor.contract_signature ? `<a href="${baseUrl}/profile?tab=documents" style="display: inline-block; padding: 8px 16px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; margin-right: 10px;">View Signed Agreement</a>` : ""}
                  ${contractor.w9_signature ? `<a href="${baseUrl}/profile?tab=documents" style="display: inline-block; padding: 8px 16px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-size: 12px;">View Signed W-9</a>` : ""}
                </div>
              </div>`;
            }

            api
              .sendOvantaEmail(
                contractor.email,
                subject,
                msg,
                `${contractor.first_name} ${contractor.last_name || ""}`,
                true,
              )
              .catch((err: any) => {
                setDeliveryError({
                  title: "Email Delivery Failed",
                  message: `Could not send email to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
                });
              });
          } else if (status !== "rejected") {
            const subject = `Application Update: ${stageName}`;
            let message = `<p>Hi ${contractor.first_name},</p><p>Your application status at ${companyName} has been updated to: <strong>${stageName}</strong>.</p>`;
            if (status === "active") {
              message += `<p>Congratulations! You have been hired. You can now log in to your portal here:<br><a href="${baseUrl}/login">${baseUrl}/login</a></p>`;
            } else {
              message += `<p>You can track your application progress in your Candidate Portal here:<br><a href="${baseUrl}/login">${baseUrl}/login</a></p>`;
            }
            api
              .sendOvantaEmail(
                contractor.email,
                subject,
                message,
                `${contractor.first_name} ${contractor.last_name || ""}`,
                true,
              )
              .catch((err: any) => {
                setDeliveryError({
                  title: "Email Delivery Failed",
                  message: `Could not send email to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
                });
              });
          }

          if (smsEnabled && smsTemplate) {
            const msg = smsTemplate
              .replace(/{{company_name}}/g, companyName)
              .replace(/{{contractor_name}}/g, contractor.first_name)
              .replace(/{{stage_name}}/g, stageName)
              .replace(/{{portal_link}}/g, baseUrl);
            api
              .sendOvantaSms(
                contractor.email,
                msg,
                `${contractor.first_name} ${contractor.last_name || ""}`,
                true,
              )
              .catch((err: any) => {
                setDeliveryError({
                  title: "SMS Delivery Failed",
                  message: `Could not send SMS to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
                });
              });
          }
        }
        return api.updateContractor(id, updates);
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setSelectedContractors(new Set());
      toast({
        title: "Bulk update successful",
        description: "Contractor statuses have been updated and notified.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Bulk update failed",
        description: error.message,
      });
    },
  });
  const terminateMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.updateContractor(id, { status: "terminated" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setTerminatingContractor(null);
      toast({
        title: "Contractor Terminated",
        description: "The contractor's access has been revoked.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Termination failed",
        description: error.message,
      });
    },
  });

  const handleAdvanceStage = (contractor: any, newStatus: string) => {
    bulkUpdateMutation.mutate({ ids: [contractor.id], status: newStatus });
  };

  const { data: contractorAssignments = [] } = useQuery({
    queryKey: ["assignments", editingContractor?.id],
    queryFn: async () => {
      if (!editingContractor?.id) return [];
      const { data } = await supabase
        .from("assignments")
        .select("*, jobs(role, weddings(client_name, date))")
        .eq("contractor_id", editingContractor.id)
        .in("status", ["Completed", "Paid", "Payment Received"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!editingContractor?.id,
  });

  const { data: portalSettings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: () => api.getPortalSettings(),
  });

  const globalRegions =
    portalSettings?.regions && portalSettings.regions.length > 0
      ? portalSettings.regions
      : ["Charlotte", "Raleigh"];

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<DbContractor> }) =>
      api.updateContractor(data.id, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setEditingContractor(null);
      toast({
        title: "Contractor updated",
        description: "The contractor profile has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteContractor(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setPendingDeletions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    },
    onError: (error: any, id) => {
      setPendingDeletions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    },
  });

  const handleDeleteWithUndo = (contractor: any) => {
    const id = contractor.id;
    setPendingDeletions((prev) => new Set(prev).add(id));
    deleteTimeouts.current[id] = setTimeout(() => {
      deleteMutation.mutate(id);
      delete deleteTimeouts.current[id];
    }, 5000);

    toast({
      title: "Contractor deleted",
      description: `${contractor.first_name} ${contractor.last_name} has been removed.`,
      action: (
        <ToastAction
          altText="Undo deletion"
          onClick={() => {
            clearTimeout(deleteTimeouts.current[id]);
            delete deleteTimeouts.current[id];
            setPendingDeletions((prev) => {
              const newSet = new Set(prev);
              newSet.delete(id);
              return newSet;
            });
            toast({
              title: "Deletion undone",
              description: `${contractor.first_name} ${contractor.last_name} was restored.`,
            });
          }}
        >
          <Undo className="mr-2 h-4 w-4" />
          Undo
        </ToastAction>
      ),
    });
  };

  const handleAddContractor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const specialty = formData.get("specialty") as string;
    const portfolioUrl = formData.get("portfolioUrl") as string;
    const fullName = formData.get("fullName") as string;
    const email = (formData.get("email") as string).trim().toLowerCase();
    const phone = formData.get("phone") as string;
    const selectedRegions = formData.getAll("regions") as string[];

    const { data: existingContractor } = await supabase
      .from("contractors")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existingContractor) {
      toast({
        variant: "destructive",
        title: "Email in use",
        description: "This email is already associated with an account.",
      });
      return;
    }

    const pendingContractor = {
      id: crypto.randomUUID(),
      first_name: fullName.split(" ")[0] || "",
      last_name: fullName.split(" ").slice(1).join(" ") || "",
      email,
      phone,
      status: "invited",
      specialty,
      region: selectedRegions,
      drone_approved: false,
      training_completed: false,
      portfolio_url: portfolioUrl,
    };

    try {
      await api.addContractor(pendingContractor);
      const token = crypto.randomUUID();
      const settings = await api.getPortalSettings();
      const baseUrl = (settings?.app_url || window.location.origin).replace(
        /\/$/,
        "",
      );
      const setupUrl = new URL(`${baseUrl}/setup-password`);
      setupUrl.searchParams.set("email", email);
      setupUrl.searchParams.set("token", token);

      if (settings?.email_invite_enabled && settings?.email_invite_template) {
        const subject = (
          settings.email_invite_subject ||
          `You're invited to ${settings.company_name || "our Portal"}!`
        )
          .replace(/{{company_name}}/g, settings.company_name || "the Portal")
          .replace(/{{contractor_name}}/g, pendingContractor.first_name);
        const msg = settings.email_invite_template
          .replace(/{{company_name}}/g, settings.company_name || "Veydra")
          .replace(/{{logo_url}}/g, settings.logo_url || "")
          .replace(/{{contractor_name}}/g, pendingContractor.first_name)
          .replace(/{{setup_link}}/g, setupUrl.toString());
        await api
          .sendOvantaEmail(email, subject, msg, fullName)
          .catch((err: any) => {
            setDeliveryError({
              title: "Email Delivery Failed",
              message: `Could not send email to ${pendingContractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
            });
          });
      }

      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      toast({
        title: "Contractor Invited",
        description: `${fullName} has been added and invited.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add",
        description: error.message,
      });
    }
  };

  const handleDeleteInvite = async (id: string) => {
    try {
      await api.deleteContractor(id);
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      toast({
        title: "Invite deleted",
        description: "The pending invitation has been removed.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete",
        description: error.message,
      });
    }
  };

  const handleResendInvite = async (contractor: any) => {
    try {
      const token = crypto.randomUUID();
      const settings = await api.getPortalSettings();
      const baseUrl = (settings?.app_url || window.location.origin).replace(
        /\/$/,
        "",
      );
      const setupUrl = new URL(`${baseUrl}/setup-password`);
      setupUrl.searchParams.set("email", contractor.email);
      setupUrl.searchParams.set("token", token);

      if (settings?.email_invite_enabled && settings?.email_invite_template) {
        const subject = (
          settings.email_invite_subject ||
          `You're invited to ${settings.company_name || "our Portal"}!`
        ).replace(/{{company_name}}/g, settings.company_name || "the Portal");
        const msg = settings.email_invite_template
          .replace(/{{company_name}}/g, settings.company_name || "Veydra")
          .replace(/{{setup_link}}/g, setupUrl.toString());
        await api.sendOvantaEmail(
          contractor.email,
          subject,
          msg,
          `${contractor.first_name} ${contractor.last_name || ""}`,
        );
      }
      toast({
        title: "Invite resent",
        description: `A new invitation was sent to ${contractor.email}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to resend",
        description: "Could not send the invitation.",
      });
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      const settings = await api.getPortalSettings();
      const baseUrl = (settings?.app_url || window.location.origin).replace(
        /\/$/,
        "",
      );
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "Reset Link Sent",
        description: `Password reset link sent to ${email}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send",
        description: error.message,
      });
    }
  };

  const handleSendPortfolioRequest = async () => {
    if (!portfolioRequestContractor) return;
    setSendingPortfolioRequest(true);
    try {
      const settings = await api.getPortalSettings();
      const companyName = settings?.company_name || "Veydra";
      const firstName = portfolioRequestContractor.first_name;
      const fullName =
        `${firstName} ${portfolioRequestContractor.last_name || ""}`.trim();

      const emailEnabled = settings?.email_pipeline_gallery_enabled || false;
      const emailSubjectTemplate =
        settings?.email_pipeline_gallery_subject ||
        `${companyName} – Gallery Submission Request`;
      const emailBodyTemplate =
        settings?.email_pipeline_gallery_template ||
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          ${settings?.logo_url ? `<div style="text-align:center; padding: 24px 0 8px;"><img src="${settings.logo_url}" alt="${companyName}" style="max-height:60px;" /></div>` : ""}
          <div style="padding: 32px 24px;">
            <h2 style="margin:0 0 16px;">Hi ${firstName},</h2>
            <p style="line-height:1.7; margin-bottom:16px;">
              Thank you for applying to work with <strong>${companyName}</strong>! We've reviewed your application and would love to learn more about your work.
            </p>
            <p style="line-height:1.7; margin-bottom:16px;">
              To continue your application, please send us a <strong>full gallery from a wedding you shot as lead photographer/videographer</strong>. This helps us assess your style, consistency, and delivery quality.
            </p>
            <p style="line-height:1.7; margin-bottom:8px;"><strong>What to include:</strong></p>
            <ul style="padding-left:20px; line-height:1.9; margin-bottom:24px;">
              <li>A complete gallery (not just highlights) from a real wedding you led</li>
              <li>A link to your gallery (Google Drive, Dropbox, WeTransfer, or online gallery platform)</li>
              <li>The type of coverage (photo, video, or both) and approximate number of files</li>
            </ul>
            <p style="line-height:1.7; margin-bottom:32px;">
              Simply reply to this email with your gallery link and we'll take it from there. We look forward to reviewing your work!
            </p>
            <p style="line-height:1.7;">Warm regards,<br /><strong>The ${companyName} Team</strong></p>
          </div>
        </div>
      `;

      const smsEnabled = settings?.sms_pipeline_gallery_enabled || false;
      const smsBodyTemplate =
        settings?.sms_pipeline_gallery_template ||
        `Hi ${firstName}, ${companyName} here! We'd love to see your work. Please reply with a link to a full wedding gallery you shot as lead. Thanks!`;

      if (emailEnabled) {
        const emailSubject = emailSubjectTemplate
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{contractor_name}}/g, firstName);

        const emailHtml = emailBodyTemplate
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{logo_url}}/g, settings?.logo_url || "")
          .replace(/{{contractor_name}}/g, firstName);

        await api
          .sendOvantaEmail(
            portfolioRequestContractor.email,
            emailSubject,
            emailHtml,
            fullName,
            true,
          )
          .catch((err: any) => {
            setDeliveryError({
              title: "Email Delivery Failed",
              message: `Could not send email to ${firstName}. ${err.message || "Please check your integration settings."}`,
            });
          });
      }

      if (smsEnabled) {
        const smsMsg = smsBodyTemplate
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{contractor_name}}/g, firstName);

        api
          .sendOvantaSms(
            portfolioRequestContractor.email,
            smsMsg,
            fullName,
            true,
          )
          .catch((err: any) => {
            setDeliveryError({
              title: "SMS Delivery Failed",
              message: `Could not send SMS to ${firstName}. ${err.message || "Please check your integration settings."}`,
            });
          });
      }

      await api.updateContractor(portfolioRequestContractor.id, {
        gallery_requested_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["contractors"] });

      toast({
        title: "Gallery Request Sent!",
        description: `${emailEnabled ? "Email" : ""}${emailEnabled && smsEnabled ? " & " : ""}${smsEnabled ? "SMS" : ""} sent to ${firstName}.`,
      });
      setPortfolioRequestContractor(null);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to send",
        description: err.message,
      });
    } finally {
      setSendingPortfolioRequest(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      if (lines.length < 2) throw new Error("File is empty or missing headers");
      toast({
        title: "Import Successful",
        description: `Successfully imported contractors.`,
      });
      setIsImportDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message,
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = "First Name,Last Name,Email,Phone,Specialty,Regions\n";
    const blob = new Blob([headers], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contractor_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const [generatingMock, setGeneratingMock] = useState(false);
  const handleGenerateMockData = async () => {
    setGeneratingMock(true);
    try {
      const mockContractorId = crypto.randomUUID();
      await supabase.from("contractors").insert({
        id: mockContractorId,
        first_name: "John",
        last_name: "Mockson",
        email: `john.mockson+${Date.now()}@example.com`,
        phone: "555-0199",
        status: "active",
        specialty: "Photographer & Videographer",
        region: ["Charlotte", "Raleigh"],
        drone_approved: true,
        rating: 4.8,
      });
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      toast({
        title: "Mock Data Generated",
        description: "A mock contractor has been created.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message,
      });
    } finally {
      setGeneratingMock(false);
    }
  };

  const safeContractors = Array.isArray(contractors) ? contractors : [];
  const allContractors = safeContractors
    .filter((c) => c && c.id && !pendingDeletions.has(c.id))
    .map((c) => ({
      ...c,
      interview_date: fetchedInterviews[c.id] || c.interview_date,
    }));

  const availableRegions = Array.from(
    new Set([
      ...globalRegions,
      ...allContractors.flatMap((c: any) => parseRegions(c.region)),
    ]),
  ).sort();

  const filteredContractors = allContractors.filter((c: any) => {
    if (ratingFilter !== "all") {
      if (ratingFilter === "unrated" && c.rating) return false;
      if (ratingFilter !== "unrated") {
        const minRating = parseFloat(ratingFilter);
        if (!c.rating || c.rating < minRating) return false;
      }
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
      const email = (c.email || "").toLowerCase();
      if (!name.includes(query) && !email.includes(query)) return false;
    }
    if (statusFilter !== "all") {
      if (statusFilter === "active") {
        if (
          c.status?.toLowerCase() !== "active" &&
          c.status?.toLowerCase() !== "hired"
        )
          return false;
      } else if (c.status?.toLowerCase() !== statusFilter) {
        return false;
      }
    } else {
      if (
        [
          "applied",
          "interview",
          "paperwork",
          "rejected",
          "declined",
          "not_selected",
        ].includes(c.status?.toLowerCase() || "")
      ) {
        return false;
      }
    }
    if (specialtyFilter !== "all") {
      const spec = (c.specialty || "").toLowerCase();
      if (specialtyFilter === "both") {
        if (
          !spec.includes("both") &&
          !(spec.includes("photo") && spec.includes("video"))
        )
          return false;
      } else if (specialtyFilter === "photographer") {
        if (!spec.includes("photo")) return false;
      } else if (specialtyFilter === "videographer") {
        if (!spec.includes("video")) return false;
      }
    }
    if (regionFilter !== "all") {
      const regions = parseRegions(c.region).map((r) => r.toLowerCase());
      if (!regions.includes(regionFilter.toLowerCase())) return false;
    }
    return true;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const [activeDragContractor, setActiveDragContractor] = useState<any>(null);

  const handleDragStart = (e: any) => {
    const { active } = e;
    const contractor = allContractors.find((c: any) => c.id === active.id);
    setActiveDragContractor(contractor);
  };

  const handleDragEnd = async (e: any) => {
    setActiveDragContractor(null);
    const { active, over } = e;
    if (!over) return;

    const contractorId = active.id;
    let newStatus = over.id;
    if (newStatus === "hired") newStatus = "active";

    const contractor = allContractors.find((c: any) => c.id === contractorId);
    if (contractor && contractor.status !== newStatus) {
      updateMutation.mutate({
        id: contractorId,
        updates: { status: newStatus },
      });

      try {
        const settings = await api.getPortalSettings();
        let stageName = newStatus;
        if (newStatus === "active") stageName = "Hired";
        else if (newStatus === "interview") stageName = "Interview";
        else if (newStatus === "paperwork")
          stageName = "Paperwork & Onboarding";
        else if (newStatus === "applied") stageName = "Application Received";
        else if (newStatus === "rejected") stageName = "Application Declined";
        else return;

        const companyName = settings?.company_name || "Veydra";
        const baseUrl = (settings?.app_url || window.location.origin).replace(
          /\/$/,
          "",
        );

        let emailEnabled = false;
        let emailSubject = "";
        let emailTemplate = "";
        let smsEnabled = false;
        let smsTemplate = "";

        if (newStatus === "active") {
          emailEnabled = settings?.email_pipeline_hired_enabled || false;
          emailSubject =
            settings?.email_pipeline_hired_subject ||
            "Congratulations! You're Hired";
          emailTemplate = settings?.email_pipeline_hired_template || "";
          smsEnabled = settings?.sms_pipeline_hired_enabled || false;
          smsTemplate = settings?.sms_pipeline_hired_template || "";
        } else if (newStatus === "paperwork") {
          emailEnabled = settings?.email_pipeline_paperwork_enabled || false;
          emailSubject =
            settings?.email_pipeline_paperwork_subject ||
            "Application Update: Paperwork Stage";
          emailTemplate = settings?.email_pipeline_paperwork_template || "";
          smsEnabled = settings?.sms_pipeline_paperwork_enabled || false;
          smsTemplate = settings?.sms_pipeline_paperwork_template || "";
        } else if (newStatus === "interview") {
          emailEnabled = settings?.email_pipeline_interview_enabled || false;
          emailSubject =
            settings?.email_pipeline_interview_subject ||
            "Application Update: Interview Stage";
          emailTemplate = settings?.email_pipeline_interview_template || "";
          smsEnabled = settings?.sms_pipeline_interview_enabled || false;
          smsTemplate = settings?.sms_pipeline_interview_template || "";
        } else if (newStatus === "rejected") {
          emailEnabled = settings?.email_pipeline_rejected_enabled || false;
          emailSubject =
            settings?.email_pipeline_rejected_subject ||
            "Update on your application";
          emailTemplate = settings?.email_pipeline_rejected_template || "";
          smsEnabled = settings?.sms_pipeline_rejected_enabled || false;
          smsTemplate = settings?.sms_pipeline_rejected_template || "";
        }

        if (emailEnabled && emailTemplate) {
          const subject = emailSubject
            .replace(/{{company_name}}/g, companyName)
            .replace(/{{stage_name}}/g, stageName);

          let msg = emailTemplate
            .replace(/{{company_name}}/g, companyName)
            .replace(/{{logo_url}}/g, settings?.logo_url || "")
            .replace(/{{contractor_name}}/g, contractor.first_name)
            .replace(/{{stage_name}}/g, stageName)
            .replace(/{{portal_link}}/g, baseUrl);

          api
            .sendOvantaEmail(
              contractor.email,
              subject,
              msg,
              `${contractor.first_name} ${contractor.last_name || ""}`,
              true,
            )
            .catch((err: any) => {
              setDeliveryError({
                title: "Email Delivery Failed",
                message: `Could not send email to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
              });
            });
        } else if (newStatus !== "rejected") {
          const subject = `Application Update: ${stageName}`;
          let message = `<p>Hi ${contractor.first_name},</p><p>Your application status at ${companyName} has been updated to: <strong>${stageName}</strong>.</p>`;
          if (newStatus === "active") {
            message += `<p>Congratulations! You have been hired. You can now log in to your portal here:<br><a href="${baseUrl}/login">${baseUrl}/login</a></p>`;
          } else {
            message += `<p>You can track your application progress in your Candidate Portal here:<br><a href="${baseUrl}/login">${baseUrl}/login</a></p>`;
          }
          api
            .sendOvantaEmail(
              contractor.email,
              subject,
              message,
              `${contractor.first_name} ${contractor.last_name || ""}`,
              true,
            )
            .catch((err: any) => {
              setDeliveryError({
                title: "Email Delivery Failed",
                message: `Could not send email to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
              });
            });
        }

        if (smsEnabled && smsTemplate) {
          const msg = smsTemplate
            .replace(/{{company_name}}/g, companyName)
            .replace(/{{contractor_name}}/g, contractor.first_name)
            .replace(/{{stage_name}}/g, stageName)
            .replace(/{{portal_link}}/g, baseUrl);
          api
            .sendOvantaSms(
              contractor.email,
              msg,
              `${contractor.first_name} ${contractor.last_name || ""}`,
              true,
            )
            .catch((err: any) => {
              setDeliveryError({
                title: "SMS Delivery Failed",
                message: `Could not send SMS to ${contractor.first_name}. ${err.message || "Please check your Ovanta Integration settings."}`,
              });
            });
        }
      } catch (err: any) {
        setDeliveryError({
          title: "Delivery Failed",
          message:
            err.message || "An error occurred while sending notifications.",
        });
      }
    }
  };

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredContractors.length / itemsPerPage);
  const paginatedContractors = filteredContractors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Contractors
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage contractor profiles and tags.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Quick Actions <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setIsDialogOpen(true)}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" /> Invite Contractor
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsImportDialogOpen(true)}
                className="cursor-pointer"
              >
                <Upload className="mr-2 h-4 w-4" /> Import CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    toast({
                      title: "Recalculating...",
                      description: "Updating all ratings.",
                    });
                    await api.recalculateAllRatings();
                    queryClient.invalidateQueries({
                      queryKey: ["contractors"],
                    });
                    toast({
                      title: "Success",
                      description: "All ratings recalculated!",
                    });
                  } catch (e: any) {
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: e.message,
                    });
                  }
                }}
                className="cursor-pointer"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Recalculate All Ratings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  sonnerToast.promise(
                    (async () => {
                      let successCount = 0;
                      let failCount = 0;
                      for (const c of contractors) {
                        try {
                          await api.syncContractorCRM(c.id);
                          successCount++;
                        } catch (e) {
                          console.error(`Failed to sync ${c.email}:`, e);
                          failCount++;
                        }
                      }
                      if (failCount > 0) {
                        throw new Error(
                          `Successfully synced ${successCount} contractors. Failed to sync ${failCount} contractors.`,
                        );
                      }
                      return `Successfully synced all ${successCount} contractors!`;
                    })(),
                    {
                      loading:
                        "Syncing all contractors to CRM. This may take a minute...",
                      success: (msg) => msg,
                      error: (err) => err.message,
                    },
                  );
                }}
                className="cursor-pointer"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Sync All to CRM
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleGenerateMockData}
                disabled={generatingMock}
                className="cursor-pointer"
              >
                {generatingMock ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Database className="mr-2 h-4 w-4" />
                )}
                Generate Mock Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog
            open={isImportDialogOpen}
            onOpenChange={setIsImportDialogOpen}
          >
            <DialogContent className="sm:max-w-[425px] flex flex-col max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-2 shrink-0">
                <DialogTitle>Import Contractors</DialogTitle>
                <DialogDescription>
                  Upload a CSV file to bulk invite contractors.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 pb-6 overflow-y-auto px-6">
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" /> Download CSV Template
                </Button>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="csv-upload">Upload CSV File</Label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={importing}
                  />
                </div>
                {importing && (
                  <div className="flex items-center justify-center text-sm text-muted-foreground mt-2">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Importing...
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh] p-0">
              <form
                onSubmit={handleAddContractor}
                className="flex flex-col overflow-hidden max-h-[90vh]"
              >
                <DialogHeader className="p-6 pb-2 shrink-0">
                  <DialogTitle>Invite New Contractor</DialogTitle>
                  <DialogDescription>
                    Enter the details for the new contractor.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 pb-6 overflow-y-auto px-6">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="fullName" className="text-right">
                      Full Name
                    </Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      placeholder="Jane Doe"
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="jane@example.com"
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right mt-2">Regions</Label>
                    <div className="col-span-3 flex flex-wrap gap-4 p-3 border rounded-md">
                      {globalRegions.map((r: string) => (
                        <div key={r} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`new-region-${r}`}
                            name="regions"
                            value={r}
                            className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                          />
                          <Label
                            htmlFor={`new-region-${r}`}
                            className="font-normal cursor-pointer"
                          >
                            {r}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="specialty" className="text-right">
                      Specialty
                    </Label>
                    <div className="col-span-3">
                      <Select name="specialty" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select specialty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Photographer">
                            Photographer
                          </SelectItem>
                          <SelectItem value="Videographer">
                            Videographer
                          </SelectItem>
                          <SelectItem value="Photographer & Videographer">
                            Both
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="portfolioUrl" className="text-right">
                      Portfolio URL
                    </Label>
                    <Input
                      id="portfolioUrl"
                      name="portfolioUrl"
                      type="url"
                      placeholder="https://janedoe.com"
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter className="p-6 pt-4 border-t shrink-0">
                  <Button type="submit">Send Invitation</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="roster" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="pipeline">Applicant Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border">
            <div className="flex-1 w-full sm:w-auto relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8 w-full md:max-w-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active (Hired)</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={specialtyFilter}
                onValueChange={setSpecialtyFilter}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Specialty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specialties</SelectItem>
                  <SelectItem value="photographer">Photographer</SelectItem>
                  <SelectItem value="videographer">Videographer</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {availableRegions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Roster</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          filteredContractors.length > 0 &&
                          selectedContractors.size ===
                            filteredContractors.length
                        }
                        onCheckedChange={(checked) =>
                          setSelectedContractors(
                            checked
                              ? new Set(
                                  filteredContractors.map((c: any) => c.id),
                                )
                              : new Set(),
                          )
                        }
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedContractors.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No contractors found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedContractors.map((contractor: any) => (
                      <TableRow key={contractor.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedContractors.has(contractor.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedContractors);
                              if (checked) newSelected.add(contractor.id);
                              else newSelected.delete(contractor.id);
                              setSelectedContractors(newSelected);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {contractor.first_name} {contractor.last_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {parseRegions(contractor.region).map(
                              (r: string) => (
                                <Badge
                                  key={r}
                                  variant="outline"
                                  className="text-xs font-normal"
                                >
                                  {r}
                                </Badge>
                              ),
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant="secondary">
                              {contractor.specialty}
                            </Badge>
                            {contractor.drone_approved && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-blue-50/50 text-blue-600"
                              >
                                Drone Approved
                              </Badge>
                            )}
                            {contractor.training_completed !== false ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-green-50/50 text-green-600"
                              >
                                Certified
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-orange-50/50 text-orange-600"
                              >
                                Training Pending
                              </Badge>
                            )}
                            {contractor.stripe_account_id ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-indigo-50/50 text-indigo-600"
                              >
                                Stripe Connected
                              </Badge>
                            ) : contractor.venmo_handle ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-sky-50/50 text-sky-600"
                              >
                                Venmo Added
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-red-50/50 text-red-600"
                              >
                                No Payment Info
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {contractor.rating ? (
                            <div className="flex items-center text-yellow-500">
                              <span className="font-medium mr-1">
                                {contractor.rating}
                              </span>
                              ★
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={contractor.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                Manage{" "}
                                <MoreHorizontal className="ml-2 h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingContractor(contractor);
                                  setEditingDroneApproved(
                                    contractor.drone_approved === true ||
                                      String(
                                        contractor.drone_approved,
                                      ).toLowerCase() === "true",
                                  );
                                  setEditingTrainingCompleted(
                                    contractor.training_completed !== false,
                                  );
                                  setReviewNotes(contractor.review_notes || "");
                                }}
                              >
                                Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  impersonate({
                                    id: contractor.id,
                                    email: contractor.email,
                                    name: `${contractor.first_name} ${contractor.last_name}`,
                                    role: "contractor",
                                  })
                                }
                              >
                                Log in as
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleSendPasswordReset(contractor.email)
                                }
                              >
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  sonnerToast.promise(
                                    api.syncContractorCRM(contractor.id),
                                    {
                                      loading: "Syncing contractor to CRM...",
                                      success: "Contractor synced to CRM.",
                                      error: (err) =>
                                        err.message ||
                                        "Failed to sync contractor.",
                                    },
                                  );
                                }}
                              >
                                Sync to CRM
                              </DropdownMenuItem>
                              {contractor.status !== "rejected" &&
                                contractor.status !== "inactive" &&
                                contractor.status !== "declined" &&
                                contractor.status !== "terminated" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleSendReminder(contractor)
                                    }
                                  >
                                    <Bell className="mr-2 h-4 w-4" /> Send Stage
                                    Reminder
                                  </DropdownMenuItem>
                                )}
                              {contractor.status === "active" && (
                                <DropdownMenuItem
                                  className="text-destructive font-medium focus:text-destructive focus:bg-destructive/10"
                                  onClick={() =>
                                    setTerminatingContractor(contractor)
                                  }
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Terminate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteWithUndo(contractor)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="flex items-center justify-center text-sm font-medium px-4">
                          Page {currentPage} of {totalPages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
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
        </TabsContent>

        <TabsContent value="pipeline" className="h-[calc(100vh-220px)]">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full gap-4 overflow-x-auto pb-4 no-scrollbar">
              <PipelineColumn
                id="applied"
                title="Applied"
                contractors={allContractors.filter(
                  (c: any) => c.status === "applied",
                )}
                onEdit={(c) => {
                  setEditingContractor(c);
                  setEditingDroneApproved(
                    c.drone_approved === true ||
                      String(c.drone_approved).toLowerCase() === "true",
                  );
                  setEditingTrainingCompleted(c.training_completed !== false);
                  setReviewNotes(c.review_notes || "");
                }}
                onRequestGallery={setPortfolioRequestContractor}
                onAdvanceStage={handleAdvanceStage}
                onSendReminder={handleSendReminder}
              />
              <PipelineColumn
                id="interview"
                title="Interview"
                contractors={allContractors.filter(
                  (c: any) => c.status === "interview",
                )}
                onEdit={(c) => {
                  setEditingContractor(c);
                  setEditingDroneApproved(
                    c.drone_approved === true ||
                      String(c.drone_approved).toLowerCase() === "true",
                  );
                  setEditingTrainingCompleted(c.training_completed !== false);
                  setReviewNotes(c.review_notes || "");
                }}
                onAdvanceStage={handleAdvanceStage}
                onSendReminder={handleSendReminder}
              />
              <PipelineColumn
                id="paperwork"
                title="Paperwork"
                description="Interview passed. Hired after paperwork & training."
                contractors={allContractors.filter(
                  (c: any) => c.status === "paperwork",
                )}
                onEdit={(c) => {
                  setEditingContractor(c);
                  setEditingDroneApproved(
                    c.drone_approved === true ||
                      String(c.drone_approved).toLowerCase() === "true",
                  );
                  setEditingTrainingCompleted(c.training_completed !== false);
                  setReviewNotes(c.review_notes || "");
                }}
                onAdvanceStage={handleAdvanceStage}
                onSendReminder={handleSendReminder}
              />
              <PipelineColumn
                id="hired"
                title="Hired"
                description="Account activated. Contractor must pass training to unlock jobs."
                contractors={allContractors.filter(
                  (c: any) => c.status === "active" || c.status === "hired",
                )}
                onEdit={(c) => {
                  setEditingContractor(c);
                  setEditingDroneApproved(
                    c.drone_approved === true ||
                      String(c.drone_approved).toLowerCase() === "true",
                  );
                  setEditingTrainingCompleted(c.training_completed !== false);
                  setReviewNotes(c.review_notes || "");
                }}
                onSendReminder={handleSendReminder}
              />
              <PipelineColumn
                id="rejected"
                title="Rejected"
                contractors={allContractors.filter(
                  (c: any) =>
                    c.status === "rejected" || c.status === "declined",
                )}
                onEdit={(c) => {
                  setEditingContractor(c);
                  setEditingDroneApproved(
                    c.drone_approved === true ||
                      String(c.drone_approved).toLowerCase() === "true",
                  );
                  setEditingTrainingCompleted(c.training_completed !== false);
                  setReviewNotes(c.review_notes || "");
                }}
              />
            </div>
            <DragOverlay>
              {activeDragContractor ? (
                <PipelineCard contractor={activeDragContractor} isOverlay />
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!editingContractor}
        onOpenChange={(open) => !open && setEditingContractor(null)}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <form
            className="flex flex-col overflow-hidden max-h-[90vh]"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const updates: any = {};

              const stringFields = [
                "first_name",
                "last_name",
                "email",
                "phone",
                "specialty",
                "status",
                "gear_list",
                "portfolio_url",
                "insurance_expiry",
                "drone_license_expiry",
                "contract_expiry",
              ];
              stringFields.forEach((f) => {
                if (formData.has(f)) updates[f] = formData.get(f) as string;
              });

              if (formData.has("rating"))
                updates.rating = formData.get("rating")
                  ? parseFloat(formData.get("rating") as string)
                  : null;
              if (formData.has("regions"))
                updates.region = formData.getAll("regions") as string[];

              updates.drone_approved = editingDroneApproved;
              updates.training_completed = editingTrainingCompleted;
              updates.review_notes = reviewNotes || null;

              updateMutation.mutate({ id: editingContractor.id, updates });
            }}
          >
            <DialogHeader className="p-6 pb-2 shrink-0">
              <DialogTitle>Edit Contractor</DialogTitle>
              <DialogDescription>
                Update details for {editingContractor?.first_name}{" "}
                {editingContractor?.last_name}.
              </DialogDescription>
            </DialogHeader>

            {editingContractor && (
              <Tabs
                defaultValue={
                  ["applied", "interview", "paperwork"].includes(
                    editingContractor.status,
                  )
                    ? "documents"
                    : "profile"
                }
                className="px-6 pb-6 flex-1 overflow-y-auto"
              >
                <TabsList
                  className={`grid w-full shrink-0 mb-4 ${["applied", "interview", "paperwork"].includes(editingContractor.status) ? "grid-cols-3" : "grid-cols-5"}`}
                >
                  {!["applied", "interview", "paperwork"].includes(
                    editingContractor.status,
                  ) && <TabsTrigger value="profile">Profile</TabsTrigger>}
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="application">Application</TabsTrigger>
                  {!["applied", "interview", "paperwork"].includes(
                    editingContractor.status,
                  ) && <TabsTrigger value="ratings">Ratings</TabsTrigger>}
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <div className="mt-4">
                  {!["applied", "interview", "paperwork"].includes(
                    editingContractor.status,
                  ) && (
                    <TabsContent value="profile" className="space-y-4 m-0">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">First Name</Label>
                        <Input
                          name="first_name"
                          defaultValue={editingContractor.first_name}
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Last Name</Label>
                        <Input
                          name="last_name"
                          defaultValue={editingContractor.last_name}
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Email</Label>
                        <Input
                          name="email"
                          type="email"
                          defaultValue={editingContractor.email}
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Phone</Label>
                        <Input
                          name="phone"
                          defaultValue={editingContractor.phone}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Specialty</Label>
                        <div className="col-span-3">
                          <Select
                            name="specialty"
                            defaultValue={editingContractor.specialty}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Photographer">
                                Photographer
                              </SelectItem>
                              <SelectItem value="Videographer">
                                Videographer
                              </SelectItem>
                              <SelectItem value="Photographer & Videographer">
                                Both
                              </SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Status</Label>
                        <select
                          name="status"
                          defaultValue={editingContractor.status}
                          className="col-span-3 h-10 w-full rounded-md border bg-background px-3 text-sm"
                        >
                          <option value="applied">Applied</option>
                          <option value="interview">Interview</option>
                          <option value="paperwork">Paperwork</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Drone</Label>
                        <div className="col-span-3 flex items-center gap-2">
                          <Switch
                            checked={editingDroneApproved}
                            onCheckedChange={setEditingDroneApproved}
                          />
                          <span className="text-sm text-muted-foreground">
                            Drone Approved
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Training</Label>
                        <div className="col-span-3 flex items-center gap-2">
                          <Switch
                            checked={editingTrainingCompleted}
                            onCheckedChange={setEditingTrainingCompleted}
                          />
                          <span className="text-sm text-muted-foreground">
                            Training Completed
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right mt-2">Regions</Label>
                        <div className="col-span-3 flex flex-wrap gap-2 p-3 border rounded-md">
                          {globalRegions.map((r: string) => (
                            <div
                              key={r}
                              className="flex items-center space-x-2"
                            >
                              <input
                                type="checkbox"
                                name="regions"
                                value={r}
                                defaultChecked={parseRegions(
                                  editingContractor.region,
                                ).includes(r)}
                                className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                              />
                              <Label className="font-normal">{r}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  )}

                  <TabsContent value="application" className="space-y-4 m-0">
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase font-bold">
                          Full Name
                        </Label>
                        <p className="text-sm mt-1 font-medium">
                          {editingContractor.first_name}{" "}
                          {editingContractor.last_name}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase font-bold">
                          Email Address
                        </Label>
                        <p className="text-sm mt-1">
                          <a
                            href={`mailto:${editingContractor.email}`}
                            className="text-primary hover:underline"
                          >
                            {editingContractor.email}
                          </a>
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase font-bold">
                          Phone Number
                        </Label>
                        <p className="text-sm mt-1">
                          {editingContractor.phone || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase font-bold">
                          Specialty
                        </Label>
                        <p className="text-sm mt-1">
                          {editingContractor.specialty || "Not provided"}
                        </p>
                      </div>
                      {editingContractor.interview_date ? (
                        <div>
                          <Label className="text-xs text-muted-foreground uppercase font-bold text-blue-600">
                            Interview Scheduled
                          </Label>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm font-medium">
                              {new Date(
                                editingContractor.interview_date,
                              ).toLocaleString([], {
                                dateStyle: "long",
                                timeStyle: "short",
                              })}
                            </p>
                          </div>
                        </div>
                      ) : editingContractor.status === "interview" ? (
                        <div>
                          <Label className="text-xs text-muted-foreground uppercase font-bold text-blue-600">
                            Interview Scheduled
                          </Label>
                          <div className="mt-1">
                            <p className="text-sm text-muted-foreground italic flex items-center">
                              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                              Checking automatically...
                            </p>
                          </div>
                        </div>
                      ) : null}
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground uppercase font-bold">
                          Regions
                        </Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {editingContractor.region &&
                          editingContractor.region.length > 0 ? (
                            (Array.isArray(editingContractor.region)
                              ? editingContractor.region
                              : [editingContractor.region]
                            ).map((r: string) => (
                              <Badge
                                key={r}
                                variant="secondary"
                                className="font-normal"
                              >
                                {r}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm">Not provided</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase font-bold">
                        Portfolio URL
                      </Label>
                      <p className="text-sm mt-1">
                        {editingContractor.portfolio_url ? (
                          <a
                            href={editingContractor.portfolio_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            {editingContractor.portfolio_url}
                          </a>
                        ) : (
                          "Not provided"
                        )}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase font-bold">
                        Gear List
                      </Label>
                      <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap mt-1 border">
                        {editingContractor.gear_list ||
                          "No gear list provided."}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-6 m-0">
                    {/* Native Digital Paperwork */}
                    {(editingContractor.w9_signature ||
                      editingContractor.contract_signature) && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Shield className="h-4 w-4" /> Native Digital
                          Paperwork
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {editingContractor.w9_signature && (
                            <Card className="p-3 border-blue-200 bg-blue-50/50">
                              <div className="flex flex-col gap-2">
                                <span className="font-semibold text-xs">
                                  Verified W-9 Form
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px]"
                                  onClick={() => setViewingDoc("w9")}
                                >
                                  View Document
                                </Button>
                              </div>
                            </Card>
                          )}
                          {editingContractor.contract_signature && (
                            <Card className="p-3 border-emerald-200 bg-emerald-50/50">
                              <div className="flex flex-col gap-2">
                                <span className="font-semibold text-xs">
                                  Signed Agreement
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px]"
                                  onClick={() => setViewingDoc("contract")}
                                >
                                  View Document
                                </Button>
                              </div>
                            </Card>
                          )}
                        </div>
                        {editingContractor.status === "paperwork" &&
                          editingContractor.w9_signature &&
                          editingContractor.contract_signature && (
                            <Button
                              type="button"
                              className="w-full bg-emerald-600 hover:bg-emerald-700"
                              onClick={() =>
                                bulkUpdateMutation.mutate({
                                  ids: [editingContractor.id],
                                  status: "active",
                                })
                              }
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                              Paperwork & Hire
                            </Button>
                          )}
                      </div>
                    )}

                    {/* Uploaded Files */}
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Upload className="h-4 w-4" /> Uploaded Compliance Files
                      </h3>

                      {/* Insurance */}
                      <div className="flex flex-col p-3 border rounded-lg gap-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">
                            Liability Insurance
                          </Label>
                          <div className="flex gap-2">
                            {editingContractor.insurance_url && (
                              <Button variant="outline" size="sm" asChild>
                                <a
                                  href={editingContractor.insurance_url}
                                  target="_blank"
                                >
                                  View
                                </a>
                              </Button>
                            )}
                            <div className="relative">
                              <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) =>
                                  handleDocumentUpload(e, "insurance_url")
                                }
                              />
                              <Button size="sm" variant="secondary">
                                {uploadingDoc === "insurance_url" ? (
                                  <Loader2 className="animate-spin h-4 w-4" />
                                ) : (
                                  <Upload className="h-4 w-4 mr-1" />
                                )}{" "}
                                {editingContractor.insurance_url
                                  ? "Replace"
                                  : "Upload"}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <Input
                          name="insurance_expiry"
                          type="date"
                          defaultValue={editingContractor.insurance_expiry}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Drone License */}
                      <div className="flex flex-col p-3 border rounded-lg gap-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">
                            Drone License (Part 107)
                          </Label>
                          <div className="flex gap-2">
                            {editingContractor.drone_license_url && (
                              <Button variant="outline" size="sm" asChild>
                                <a
                                  href={editingContractor.drone_license_url}
                                  target="_blank"
                                >
                                  View
                                </a>
                              </Button>
                            )}
                            <div className="relative">
                              <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) =>
                                  handleDocumentUpload(e, "drone_license_url")
                                }
                              />
                              <Button size="sm" variant="secondary">
                                {uploadingDoc === "drone_license_url" ? (
                                  <Loader2 className="animate-spin h-4 w-4" />
                                ) : (
                                  <Upload className="h-4 w-4 mr-1" />
                                )}{" "}
                                {editingContractor.drone_license_url
                                  ? "Replace"
                                  : "Upload"}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <Input
                          name="drone_license_expiry"
                          type="date"
                          defaultValue={editingContractor.drone_license_expiry}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {!["applied", "interview", "paperwork"].includes(
                    editingContractor.status,
                  ) && (
                    <TabsContent value="ratings" className="space-y-4 m-0">
                      {contractorAssignments.length === 0 ? (
                        <p className="text-sm text-center py-8 text-muted-foreground">
                          No completed assignments found.
                        </p>
                      ) : (
                        contractorAssignments.map((a: any) => (
                          <div
                            key={a.id}
                            className="p-3 border rounded text-sm space-y-2"
                          >
                            <div className="flex justify-between font-semibold">
                              <span>{a.jobs?.weddings?.client_name}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {a.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {a.jobs?.role} •{" "}
                              {new Date(
                                a.jobs?.weddings?.date,
                              ).toLocaleDateString()}
                            </div>
                            <div className="grid grid-cols-4 gap-2 pt-2 border-t text-[10px] uppercase font-bold text-muted-foreground">
                              <div>Client: {a.client_rating || "—"}/5</div>
                              <div>Editor: {a.editor_rating || "—"}/5</div>
                              <div>System: {a.system_rating || "—"}/5</div>
                              <div>Speed: {a.speed_rating || "—"}/5</div>
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  )}

                  <TabsContent value="notes" className="space-y-4 m-0">
                    <div className="rounded-lg border bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <StickyNote className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                            Internal Review Notes
                          </p>
                          <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
                            Only visible to the management team. Never shown to
                            the contractor.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Add internal notes — interview impressions, follow-up items, concerns, or anything the team should know..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="min-h-[200px] text-sm resize-none"
                    />
                    {editingContractor?.review_notes && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />{" "}
                        Notes previously saved for this contractor.
                      </p>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            )}

            <DialogFooter className="p-6 pt-4 border-t flex justify-between items-center sm:justify-between w-full shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  impersonate({
                    id: editingContractor.id,
                    email: editingContractor.email,
                    name: `${editingContractor.first_name} ${editingContractor.last_name}`,
                    role: "contractor",
                  })
                }
              >
                <LogIn className="mr-2 h-4 w-4" /> Log in as
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Document Viewer */}
      <Dialog
        open={!!viewingDoc}
        onOpenChange={(open) => !open && setViewingDoc(null)}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b">
            <DialogTitle>
              {viewingDoc === "w9" ? "Form W-9" : "Contractor Agreement"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pb-8 bg-muted/30 contract-content">
            <div id="printable-document">
              {viewingDoc === "w9" && editingContractor && (
                <div className="space-y-6">
                  <h1 className="text-xl font-bold">
                    Request for Taxpayer Identification Number and Certification
                    (Form W-9)
                  </h1>
                  <div className="grid gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-bold text-lg">
                        {editingContractor.w9_name}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Address</Label>
                      <p className="font-bold">
                        {editingContractor.w9_address},{" "}
                        {editingContractor.w9_city_state_zip}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        TIN (SSN/EIN)
                      </Label>
                      <p className="font-bold">
                        {editingContractor.w9_ssn_ein}
                      </p>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <p className="italic">
                      Digitally signed by {editingContractor.w9_signature}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Date:{" "}
                      {new Date(
                        editingContractor.w9_signed_at,
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {viewingDoc === "contract" && editingContractor && (
                <div className="space-y-6">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: (portalSettings?.contract_template || "")
                        .replace(
                          /{{company_name}}/g,
                          portalSettings?.company_name || "Veydra",
                        )
                        .replace(
                          /{{contractor_name}}/g,
                          `${editingContractor.first_name} ${editingContractor.last_name}`,
                        )
                        .replace(
                          /{{date}}/g,
                          new Date(
                            editingContractor.contract_signed_at,
                          ).toLocaleDateString(),
                        ),
                    }}
                  />
                  <div className="border-t pt-4">
                    <p className="italic font-serif text-2xl">
                      Agreed and signed by{" "}
                      {editingContractor.contract_signature}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Signed on:{" "}
                      {new Date(
                        editingContractor.contract_signed_at,
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setViewingDoc(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                const printContent =
                  document.getElementById("printable-document")?.innerHTML;
                if (printContent) {
                  const win = window.open("", "_blank");
                  win?.document.write(
                    `<html><head><title>Document</title><style>body { font-family: sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }</style></head><body>${printContent}</body></html>`,
                  );
                  win?.document.close();
                  win?.print();
                }
              }}
            >
              Print / Save PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deliveryError}
        onOpenChange={(open) => !open && setDeliveryError(null)}
      >
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              {deliveryError?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center pt-2" asChild>
              <div>
                <div className="bg-muted p-3 rounded-md text-left text-xs font-mono text-muted-foreground break-words overflow-auto max-h-[150px]">
                  {deliveryError?.message}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  The action was completed, but we couldn't send the
                  notification. You may need to update this contact manually in
                  Ovanta.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center mt-2">
            <AlertDialogAction
              onClick={() => setDeliveryError(null)}
              className="w-full sm:w-auto"
            >
              Acknowledge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Portfolio Gallery Request Confirmation */}
      <AlertDialog
        open={!!portfolioRequestContractor}
        onOpenChange={(open) => !open && setPortfolioRequestContractor(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Request Portfolio Gallery
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-1">
              <span className="block">
                Send{" "}
                <strong>
                  {portfolioRequestContractor?.first_name}{" "}
                  {portfolioRequestContractor?.last_name}
                </strong>{" "}
                an email and SMS asking them to submit a full gallery from a
                wedding they shot as lead photographer/videographer.
              </span>
              <span className="block text-xs pt-1 text-muted-foreground">
                They will be asked to reply with a gallery link (Google Drive,
                Dropbox, or similar) along with coverage type and file count.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setPortfolioRequestContractor(null)}
              disabled={sendingPortfolioRequest}
            >
              Cancel
            </Button>
            <AlertDialogAction
              onClick={handleSendPortfolioRequest}
              disabled={sendingPortfolioRequest}
              className="gap-2"
            >
              {sendingPortfolioRequest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!terminatingContractor}
        onOpenChange={(open) => !open && setTerminatingContractor(null)}
      >
        <AlertDialogContent className="max-w-md border-destructive/20">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Terminate Contractor?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base">
              Are you sure you want to terminate{" "}
              <strong>
                {terminatingContractor?.first_name}{" "}
                {terminatingContractor?.last_name}
              </strong>
              ?
              <br />
              <br />
              This will immediately revoke their access to the platform (except
              for viewing past invoices and payouts). No automated email or SMS
              will be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center flex-col sm:flex-row gap-3 mt-6">
            <Button
              variant="outline"
              className="sm:w-full"
              onClick={() => setTerminatingContractor(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="sm:w-full"
              disabled={terminateMutation.isPending}
              onClick={() =>
                terminateMutation.mutate(terminatingContractor?.id)
              }
            >
              {terminateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm Termination
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
