import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Briefcase,
  Calendar,
  Inbox,
  Loader2,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  Star,
  CheckCircle,
  Activity,
  Info,
  ChevronDown,
  CalendarPlus,
  MapPin,
  Clock,
  FileText,
  Mail,
  DollarSign,
  Video,
  Settings,
  HardDrive,
  Upload,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDisplayDate,
  generatePaymentSchedule,
  getCompanyTimezone,
} from "@/lib/utils";

// Parse a date string as a local date (no UTC midnight shift)
const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(NaN);
  const datePart = dateStr.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, m - 1, d);
};
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CallSheetGenerator } from "@/components/CallSheetGenerator";
import { ClientPrepSheetGenerator } from "@/components/ClientPrepSheetGenerator";
import { ManageWeddingSheet } from "@/pages/manager/Weddings";
import { RoyaltyHealthAlert } from "@/components/RoyaltyHealthAlert";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export default function ManagerDashboard() {
  const [reviewApp, setReviewApp] = useState<any>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageRecipientType, setMessageRecipientType] = useState("all");
  const [messageRegion, setMessageRegion] = useState("");
  const [messageContractorId, setMessageContractorId] = useState("");
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingAssignment, setRatingAssignment] = useState<any>(null);
  const [editorRating, setEditorRating] = useState<number>(5);

  const [speedRating, setSpeedRating] = useState<number>(5);
  const [editorFeedback, setEditorFeedback] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Venmo");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [markReadyToEdit, setMarkReadyToEdit] = useState<boolean>(true);

  const [driveLinkModalOpen, setDriveLinkModalOpen] = useState(false);
  const [selectedWeddingForDrive, setSelectedWeddingForDrive] =
    useState<any>(null);
  const [driveLinkInput, setDriveLinkInput] = useState("");

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isIOS) {
        toast({
          variant: "destructive",
          title: "Add to Home Screen required",
          description:
            "To enable push notifications on iPhone/iPad, please tap 'Share' then 'Add to Home Screen' first.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Not supported",
          description: "Your browser does not support push notifications.",
        });
      }
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        toast({
          title: "Notifications enabled",
          description: "You'll now receive alerts for messages and updates.",
        });
        if ("serviceWorker" in navigator) {
          try {
            await navigator.serviceWorker.register("/sw.js");
          } catch (e) {
            console.error("Service worker registration failed:", e);
          }
        }
      } else {
        toast({
          variant: "destructive",
          title: "Notifications disabled",
          description: "You can change this in your browser settings.",
        });
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  const updateWeddingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await api.updateWedding(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({ title: "Updated", description: "Wedding updated successfully." });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      app,
    }: {
      id: string;
      status: string;
      app: any;
    }) => {
      const updatedApp = await api.updateApplicationStatus(id, status);

      const job = app.jobs;
      const wedding = job?.weddings;

      try {
        await api.createNotification({
          contractor_id: app.contractor_id,
          title:
            status === "awarded"
              ? "Application Accepted!"
              : "Application Update",
          message:
            status === "awarded"
              ? `You have been assigned as ${job?.role} for ${wedding?.client_name}'s wedding.`
              : `Your application for ${job?.role} at ${wedding?.client_name}'s wedding was declined.`,
          type: status === "awarded" ? "assignment" : "job",
        });
      } catch (e) {
        console.error("Failed to create notification", e);
      }

      if (status === "awarded") {
        const jobUpdates: any = { status: "filled" };
        if (job?.pay_type === "bidding" && app.bid_amount != null) {
          jobUpdates.pay_rate = app.bid_amount;
        }
        await api.updateJob(app.job_id, jobUpdates);
        await api.createAssignment({
          job_id: app.job_id,
          contractor_id: app.contractor_id,
          status: "upcoming",
        });
      }
      return updatedApp;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({
        title: "Application Updated",
        description: `Status changed to ${data.status}.`,
      });
      setReviewApp(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: error.message,
      });
    },
  });
  const { data: weddings = [], isLoading: loadingWeddings } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });
  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: api.getJobs,
  });
  const { data: apps = [], isLoading: loadingApps } = useQuery({
    queryKey: ["applications"],
    queryFn: api.getApplications,
  });
  const { data: contractors = [], isLoading: loadingContractors } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getPortalSettings,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      let targetContractors = [];
      if (messageRecipientType === "all") {
        targetContractors = contractors.filter((c) => c.status === "active");
      } else if (messageRecipientType === "region") {
        targetContractors = contractors.filter(
          (c) =>
            c.status === "active" &&
            c.region &&
            c.region.includes(messageRegion),
        );
      } else if (messageRecipientType === "contractor") {
        targetContractors = contractors.filter(
          (c) => c.id === messageContractorId,
        );
      }

      if (targetContractors.length === 0) {
        throw new Error("No contractors found for the selected criteria.");
      }

      if (!messageTitle.trim() || !messageBody.trim()) {
        throw new Error("Subject and message are required.");
      }

      const promises = targetContractors.map((c) =>
        api.createNotification({
          contractor_id: c.id,
          title: messageTitle,
          message: messageBody,
          type: "announcement",
        }),
      );

      await Promise.all(promises);
      return targetContractors.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Message Sent",
        description: `Successfully sent to ${count} contractor(s).`,
      });
      setIsMessageModalOpen(false);
      setMessageTitle("");
      setMessageBody("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to send",
        description: error.message,
      });
    },
  });

  const activeWeddings = weddings.filter((w) => w.status === "upcoming").length;
  const pendingWeddings = weddings.filter(
    (w) => w.status === "pending" && !w.notes?.includes("[UNPAID_DRAFT]"),
  ).length;
  const openPositions = jobs.filter((j) => j.status === "open").length;
  const pendingApps = apps.filter((a) => a.status === "pending").length;
  const activeContractors = contractors.filter(
    (c) => c.status === "active" || c.status === "invited",
  ).length;

  const isLoading =
    loadingWeddings || loadingJobs || loadingApps || loadingContractors;

  const nowInTz = new Date(
    new Date().toLocaleString("en-US", { timeZone: getCompanyTimezone() }),
  );
  const today = new Date(
    nowInTz.getFullYear(),
    nowInTz.getMonth(),
    nowInTz.getDate(),
  );
  // Calculate overdue payments list
  const overduePaymentsList = weddings.flatMap((w: any) => {
    if (w.status !== "upcoming" || w.notes?.includes("[UNPAID_DRAFT]"))
      return [];
    const schedule = generatePaymentSchedule(
      w.total_amount || 0,
      w.payment_plan || "full",
      w.date || "",
      w.contract_date || w.created_at || "",
      w.paid_amount || 0,
      w.custom_payment_plan,
    );
    return schedule
      .filter((p: any) => p.status === "pending" && new Date(p.date) < today)
      .map((p: any) => ({ ...p, wedding: w }));
  });
  const pendingWeddingsList = weddings
    .filter(
      (w) => w.status === "pending" && !w.notes?.includes("[UNPAID_DRAFT]"),
    )
    .sort(
      (a, b) =>
        parseLocalDate(a.date || "9999-12-31").getTime() -
        parseLocalDate(b.date || "9999-12-31").getTime(),
    );

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const openJobsList = jobs
    .filter((j) => {
      if (j.status !== "open") return false;
      const hasApps = apps.some((a) => a.job_id === j.id);
      const postedDate = new Date(j.created_at || new Date());
      return !hasApps && postedDate < twoWeeksAgo;
    })
    .sort(
      (a, b) =>
        parseLocalDate(a.weddings?.date || "9999-12-31").getTime() -
        parseLocalDate(b.weddings?.date || "9999-12-31").getTime(),
    );

  const allPendingApps = apps.filter((a) => a.status === "pending");
  const groupedAppsMap = allPendingApps.reduce((acc: any, app: any) => {
    if (!acc[app.job_id]) {
      acc[app.job_id] = { job: app.jobs, apps: [] };
    }
    acc[app.job_id].apps.push(app);
    return acc;
  }, {});
  const pendingAppsGrouped = Object.values(groupedAppsMap);

  // Hiring pipeline action items
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const newApplicantsList = contractors.filter(
    (c: any) =>
      c.status === "applied" &&
      (!c.updated_at || new Date(c.updated_at) < sevenDaysAgo),
  );

  const interviewUnscheduledList = contractors.filter(
    (c: any) => c.status === "interview" && !c.interview_date,
  );

  const stuckInPipelineList = contractors.filter(
    (c: any) =>
      (c.status === "interview" || c.status === "paperwork") &&
      (!c.updated_at || new Date(c.updated_at) < sevenDaysAgo),
  );

  const paperworkReadyList = contractors.filter(
    (c: any) =>
      c.status === "paperwork" && c.w9_signature && c.contract_signature,
  );

  const hiringItemsCount =
    newApplicantsList.length +
    interviewUnscheduledList.length +
    stuckInPipelineList.length +
    paperworkReadyList.length;

  const pendingQuestionnairesList = weddings
    .filter(
      (w) =>
        w.status === "upcoming" &&
        !w.questionnaire_completed &&
        !(w.questionnaire_data && Object.keys(w.questionnaire_data).length > 0),
    )
    .sort(
      (a, b) =>
        parseLocalDate(a.date || "9999-12-31").getTime() -
        parseLocalDate(b.date || "9999-12-31").getTime(),
    );

  const missingDriveLinksList = weddings
    .filter((w) => w.status === "upcoming" && !w.drive_link)
    .sort(
      (a, b) =>
        parseLocalDate(a.date || "9999-12-31").getTime() -
        parseLocalDate(b.date || "9999-12-31").getTime(),
    )
    .slice(0, 5);

  const missingUploadLinksList = weddings
    .filter(
      (w) =>
        (w.status === "upcoming" || w.status === "completed") &&
        w.editing_status &&
        ["ready_to_edit", "in_progress", "revisions_requested"].includes(
          w.editing_status,
        ) &&
        !w.upload_link,
    )
    .sort(
      (a, b) =>
        parseLocalDate(a.date || "9999-12-31").getTime() -
        parseLocalDate(b.date || "9999-12-31").getTime(),
    )
    .slice(0, 5);

  // Get assignments pending payout
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });
  const pendingPayoutsList = assignments
    .filter((a: any) => a.status === "Pending Payout")
    .sort(
      (a: any, b: any) =>
        parseLocalDate(a.jobs?.weddings?.date || "9999-12-31").getTime() -
        parseLocalDate(b.jobs?.weddings?.date || "9999-12-31").getTime(),
    );

  const sevenDaysAhead = new Date(today);
  sevenDaysAhead.setDate(today.getDate() + 7);
  const unconfirmedAttendanceList = assignments
    .filter((a: any) => {
      if (
        !["upcoming", "accepted", "confirmed", "assigned"].includes(
          a.status?.toLowerCase(),
        )
      )
        return false;
      if (a.attendance_confirmed) return false;
      const wDate = a.jobs?.weddings?.date;
      if (!wDate) return false;
      const d = parseLocalDate(wDate);
      return d >= today && d <= sevenDaysAhead;
    })
    .sort(
      (a: any, b: any) =>
        parseLocalDate(a.jobs?.weddings?.date || "9999-12-31").getTime() -
        parseLocalDate(b.jobs?.weddings?.date || "9999-12-31").getTime(),
    );

  const approvePayoutMutation = useMutation({
    mutationFn: async ({
      id,
      rating,
      speed_rating,
      feedback,
      contractorId,
    }: {
      id: string;
      rating: number;
      speed_rating: number;
      feedback: string;
      contractorId: string;
    }) => {
      const assignment = ratingAssignment;
      if (!assignment) throw new Error("Assignment not found");

      if (paymentMethod === "Stripe") {
        const stripeAccountId = assignment.contractors?.stripe_account_id;
        if (!stripeAccountId) {
          throw new Error(
            "Contractor does not have a connected Stripe account. Please select another payment method.",
          );
        }
        const amount = assignment.jobs?.pay_rate || 0;
        if (amount > 0) {
          await api.processStripePayout(
            amount,
            stripeAccountId,
            `Payout for ${assignment.jobs?.weddings?.client_name || "Wedding"} - ${assignment.jobs?.role || "Job"}`,
            idempotencyKey,
          );
        }
      }

      await api.approvePayoutWithRating(
        id,
        rating,
        feedback,
        contractorId,
        paymentMethod,
        speed_rating,
      );

      if (assignment.jobs?.wedding_id && markReadyToEdit) {
        const weddingId = assignment.jobs.wedding_id;
        try {
          await api.updateWedding(weddingId, {
            editing_status: "ready_to_edit",
          } as any);
        } catch (e) {
          console.error("Failed to update wedding status", e);
        }
      }

      try {
        const settings = await api.getPortalSettings();
        const webhookUrl =
          settings?.payout_webhook ||
          localStorage.getItem("veydra_payout_webhook");
        if (webhookUrl) {
          const payload = {
            event: "payout_approved",
            assignment_id: assignment.id,
            amount: assignment.jobs?.pay_rate || 0,
            contractor_id: assignment.contractor_id,
            contractor_name: `${assignment.contractors?.first_name} ${assignment.contractors?.last_name}`,
            contractor_email: assignment.contractors?.email,
            venmo_handle: assignment.contractors?.venmo_handle,
            stripe_account_id: assignment.contractors?.stripe_account_id,
            payment_method: paymentMethod,
            wedding_name: assignment.jobs?.weddings?.client_name,
            role: assignment.jobs?.role,
          };

          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
            .then(async (res) => {
              api.logApiEvent(
                "Webhook: payout_approved",
                JSON.stringify(payload),
                await res.text(),
                res.ok ? "success" : "error",
              );
            })
            .catch((err) => {
              api.logApiEvent(
                "Webhook: payout_approved",
                JSON.stringify(payload),
                null,
                "error",
                err.message,
              );
            });
        }
      } catch (e) {
        console.error("Failed to trigger payout webhook", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setRatingModalOpen(false);
      toast({
        title: "Payout Approved",
        description:
          "Payment is approved and sent to the owner for processing. Please allow 12-24 hours for it to come through.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to approve payout",
        description: error.message,
      });
    },
  });

  // Toggle final payment verification directly from on-deck cards
  const verifyFinalPaymentMutation = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      return await api.updateWedding(id, {
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

  const updateDriveLinkMutation = useMutation({
    mutationFn: async ({ id, link }: { id: string; link: string }) => {
      return await api.updateWedding(id, { drive_link: link } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      setDriveLinkModalOpen(false);
      setDriveLinkInput("");
      toast({
        title: "Drive Link Added",
        description: "The raw media folder link has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to save link",
        description: error.message,
      });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async ({
      unconfirmedAssignments,
    }: {
      unconfirmedAssignments: any[];
    }) => {
      const promises = unconfirmedAssignments.map(async (a: any) => {
        const contractor = contractors.find((c) => c.id === a.contractor_id);
        if (contractor?.email && contractor.sms_notifications !== false) {
          const msg = `Hi ${contractor.first_name}, please log in to the portal to confirm your attendance for ${a.jobs?.weddings?.client_name}'s wedding. Failure to confirm by the 7-day mark will result in automatic removal.`;
          await api.sendOvantaSms(
            contractor.email,
            msg,
            `${contractor.first_name} ${contractor.last_name || ""}`,
            true,
          );
        }
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Reminders Sent",
        description: "SMS reminders have been sent to unconfirmed contractors.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to send reminders",
        description: error.message,
      });
    },
  });

  const fourteenDaysFromNow = new Date(today);
  fourteenDaysFromNow.setDate(today.getDate() + 14);

  const onDeckWeddings = weddings
    .filter((w) => {
      if (w.status !== "upcoming") return false;
      if (!w.date) return false;
      const wDate = parseLocalDate(w.date);
      return wDate >= today && wDate <= fourteenDaysFromNow;
    })
    .sort(
      (a, b) =>
        parseLocalDate(a.date || "9999-12-31").getTime() -
        parseLocalDate(b.date || "9999-12-31").getTime(),
    );

  const getDaysUntil = (dateStr: string) => {
    const target = parseLocalDate(dateStr);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    return `In ${diffDays} days`;
  };

  const upcomingPayments = weddings
    .flatMap((w) => {
      if (w.status !== "upcoming") return [];
      if (!w.date || w.payment_plan === "full") return [];

      // We only have estimated schedule here because we don't fetch Stripe invoices for all weddings on dashboard
      // But it's enough to show what's expected in the next 14 days
      const schedule = generatePaymentSchedule(
        w.total_amount || 0,
        w.payment_plan || "full",
        w.date,
        w.contract_date || w.created_at || "",
        w.paid_amount || 0,
        w.custom_payment_plan,
      );

      return schedule
        .filter((p) => p.status === "pending")
        .map((p) => {
          const pDate = new Date(p.date);
          return {
            ...p,
            wedding: w,
            parsedDate: pDate,
          };
        })
        .filter(
          (p) => p.parsedDate >= today && p.parsedDate <= fourteenDaysFromNow,
        );
    })
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  const calculateWeddingReadiness = (wedding: any) => {
    let score = 0;
    const total = 6;
    const missing = [];

    if (
      wedding.questionnaire_completed ||
      (wedding.questionnaire_data &&
        Object.keys(wedding.questionnaire_data).length > 0)
    ) {
      score += 1;
    } else {
      missing.push({ type: "questionnaire", label: "Missing Questionnaire" });
    }

    if (
      wedding.timeline &&
      wedding.timeline.length > 0 &&
      wedding.timeline !== "[]"
    ) {
      score += 1;
    } else {
      missing.push({ type: "timeline", label: "Missing Timeline" });
    }

    if (wedding.drive_link) {
      score += 1;
    } else {
      missing.push({ type: "drive_link", label: "Add Drive Link" });
    }

    const weddingJobs = jobs.filter(
      (j: any) => j.wedding_id === wedding.id && j.status !== "cancelled",
    );
    const filledJobs = weddingJobs.filter(
      (j: any) => j.status === "filled" || j.status === "completed",
    );

    if (weddingJobs.length > 0 && weddingJobs.length === filledJobs.length) {
      score += 1;
    } else {
      const unfilled = weddingJobs.length - filledJobs.length;
      missing.push({
        type: "staffing",
        label: `${unfilled} Unfilled Role${unfilled > 1 ? "s" : ""}`,
      });
    }

    const activeAssignments = assignments.filter(
      (a: any) =>
        a.jobs?.wedding_id === wedding.id &&
        ["upcoming", "accepted", "confirmed", "assigned"].includes(
          a.status?.toLowerCase(),
        ),
    );
    const unconfirmedAssignments = activeAssignments.filter(
      (a: any) => !a.attendance_confirmed,
    );

    if (activeAssignments.length > 0 && unconfirmedAssignments.length === 0) {
      score += 1;
    } else if (unconfirmedAssignments.length > 0) {
      missing.push({
        type: "unconfirmed",
        label: `${unconfirmedAssignments.length} Unconfirmed`,
        unconfirmedAssignments,
      });
    } else {
      // No active assignments yet
      missing.push({ type: "unconfirmed", label: `No Assignments` });
    }

    if (wedding.final_payment_verified) {
      score += 1;
    } else {
      missing.push({ type: "payment", label: "Verify Final Payment" });
    }

    return {
      score: Math.round((score / total) * 100),
      missing,
      totalJobs: weddingJobs.length,
      filledJobs: filledJobs.length,
    };
  };

  const recentActivity = [
    ...apps.slice(0, 5).map((a) => ({
      id: a.id,
      type: "application",
      date: a.created_at || new Date().toISOString(),
      title: `New application for ${a.jobs?.role || "Position"}`,
      desc: a.contractors?.first_name
        ? `${a.contractors.first_name} applied`
        : "Someone applied",
    })),
    ...weddings
      .filter((w) => !w.notes?.includes("[UNPAID_DRAFT]"))
      .slice(0, 5)
      .map((w) => ({
        id: w.id,
        type: "wedding",
        date: w.created_at || new Date().toISOString(),
        title: `New wedding: ${w.client_name}`,
        desc: w.location,
      })),
    ...jobs.slice(0, 5).map((j) => ({
      id: j.id,
      type: "job",
      date: j.created_at || new Date().toISOString(),
      title: `New position: ${j.role}`,
      desc: j.weddings?.client_name || "Unknown Wedding",
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const monthlyWeddingData = useMemo(() => {
    const data: { label: string; weddings: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + i + 1,
        0,
        23,
        59,
        59,
      );
      const count = weddings.filter((w) => {
        if (!w.date) return false;
        const d = parseLocalDate(w.date);
        return d >= monthStart && d <= monthEnd;
      }).length;
      data.push({
        label: monthStart.toLocaleDateString("en", { month: "short" }),
        weddings: count,
      });
    }
    return data;
  }, [weddings]);

  return (
    <div className="space-y-6">
      <RoyaltyHealthAlert />
      {notificationPermission === "default" && (
        <Alert className="bg-primary/5 border-primary/10 text-primary rounded-2xl shadow-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-semibold">
            Enable Push Notifications
          </AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <span className="text-muted-foreground">
              Get instant alerts on your device when contractors apply, message
              you, or when jobs are updated.
            </span>
            <Button
              size="sm"
              onClick={requestNotificationPermission}
              className="whitespace-nowrap rounded-full shadow-sm hover:shadow-md transition-all"
            >
              Enable Notifications
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Manager Dashboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Overview of your staffing and weddings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="rounded-full shadow-sm hover:shadow-md transition-all"
              >
                Quick Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem
                onClick={() => setIsMessageModalOpen(true)}
                className="cursor-pointer"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Message Team
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link to="/manager/weddings">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Add Wedding
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link to="/manager/contractors">
                  <Users className="mr-2 h-4 w-4" />
                  Invite Contractor
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bento Grid - Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Featured: Active Weddings with mini chart */}
        <Card className="col-span-2 min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Weddings
                </CardTitle>
                <div className="text-4xl font-bold tracking-tight mt-1">
                  {isLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    activeWeddings
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {onDeckWeddings.length} in next 14 days
                </p>
              </div>
              <div className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                <Calendar className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="h-16 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyWeddingData}>
                  <defs>
                    <linearGradient
                      id="weddingGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="weddings"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#weddingGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-1">
              {monthlyWeddingData.map((d, i) => (
                <span
                  key={i}
                  className="text-[10px] text-muted-foreground font-medium"
                >
                  {d.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Weddings */}
        <Card className="min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Pending Weddings
              </CardTitle>
              <div className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                pendingWeddings
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        {/* Open Positions */}
        <Card className="min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Open Positions
              </CardTitle>
              <div className="p-1.5 rounded-full bg-purple-50 dark:bg-purple-950/30">
                <Briefcase className="h-3.5 w-3.5 text-purple-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                openPositions
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Need staffing</p>
          </CardContent>
        </Card>

        {/* Upcoming Revenue */}
        <Card className="col-span-2 min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Upcoming Revenue (14 days)
              </CardTitle>
              <div className="p-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                `$${upcomingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toLocaleString()}`
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(upcomingPayments.length * 25, 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                {upcomingPayments.length} payments
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Applications */}
        <Card className="min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Applications
              </CardTitle>
              <div className="p-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30">
                <Inbox className="h-3.5 w-3.5 text-amber-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                pendingApps
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending review</p>
          </CardContent>
        </Card>

        {/* Active Contractors */}
        <Card className="min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Contractors
              </CardTitle>
              <div className="p-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30">
                <Users className="h-3.5 w-3.5 text-indigo-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                activeContractors
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active & invited
            </p>
          </CardContent>
        </Card>
      </div>

      {/* On Deck - Compact Horizontal Scroll */}
      {onDeckWeddings.length > 0 && (
        <Card className="shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">
                On Deck (Next 14 Days)
              </CardTitle>
              <Badge variant="secondary" className="rounded-full">
                {onDeckWeddings.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {onDeckWeddings.map((wedding) => {
                const readiness = calculateWeddingReadiness(wedding);
                const totalAmount = Number(wedding.total_amount) || 0;
                const paidAmount = Number(wedding.paid_amount) || 0;
                const unpaidAmount = Math.max(totalAmount - paidAmount, 0);
                const fullyPaid =
                  totalAmount > 0 && paidAmount >= totalAmount - 0.01;
                return (
                  <div key={wedding.id} className="shrink-0 w-60 group">
                    <div className="rounded-xl border border-border/40 p-3 hover:shadow-md hover:border-primary/30 transition-all bg-card h-full flex flex-col">
                      <Link to="/manager/weddings" className="block">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <span className="font-semibold text-sm truncate">
                            {wedding.client_name}
                          </span>
                          <Badge
                            variant="outline"
                            className="rounded-full text-[10px] shrink-0 whitespace-nowrap"
                          >
                            {getDaysUntil(wedding.date)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{" "}
                            {formatDisplayDate(wedding.date)}
                          </div>
                          <div className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />{" "}
                            {wedding.location || "TBD"}
                          </div>
                        </div>
                      </Link>

                      {/* Payment breakdown */}
                      <div className="mt-2.5 rounded-lg bg-muted/40 p-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-semibold">
                            ${totalAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <DollarSign className="h-3 w-3" /> Paid
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            ${paidAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className={
                              unpaidAmount > 0
                                ? "text-red-600 dark:text-red-400 font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            Unpaid
                          </span>
                          <span
                            className={`font-semibold ${unpaidAmount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                          >
                            ${unpaidAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${readiness.score === 100 ? "bg-emerald-400" : "bg-primary/70"}`}
                            style={{ width: `${readiness.score}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {readiness.score}%
                        </span>
                      </div>

                      {/* Verify final payment button */}
                      <Button
                        size="sm"
                        variant={
                          wedding.final_payment_verified
                            ? "secondary"
                            : fullyPaid
                              ? "default"
                              : "outline"
                        }
                        className="mt-2.5 h-7 text-[11px] rounded-full w-full"
                        disabled={verifyFinalPaymentMutation.isPending}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          verifyFinalPaymentMutation.mutate({
                            id: wedding.id,
                            verified: !wedding.final_payment_verified,
                          });
                        }}
                      >
                        {wedding.final_payment_verified ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" />
                            Payment Verified
                          </>
                        ) : fullyPaid ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confirm Final Payment
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-3 w-3 mr-1" />
                            Mark Payment Verified
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items + Quick Jump */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Action Items - Grouped Accordion */}
        <Card className="md:col-span-2 min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle>Action Items</CardTitle>
            <CardDescription>
              Priority tasks that need your attention
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-4">
            {isLoading || loadingAssignments ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : overduePaymentsList.length > 0 ||
              pendingWeddingsList.length > 0 ||
              pendingQuestionnairesList.length > 0 ||
              openJobsList.length > 0 ||
              pendingAppsGrouped.length > 0 ||
              hiringItemsCount > 0 ||
              pendingPayoutsList.length > 0 ||
              missingDriveLinksList.length > 0 ||
              missingUploadLinksList.length > 0 ||
              unconfirmedAttendanceList.length > 0 ? (
              <Accordion
                type="multiple"
                defaultValue={overduePaymentsList.length > 0 ? ["overdue"] : []}
                className="w-full"
              >
                {/* Overdue Payments Group */}
                {overduePaymentsList.length > 0 && (
                  <AccordionItem
                    value="overdue"
                    className="border border-red-500/30 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-red-500/15 shrink-0">
                          <DollarSign className="h-4 w-4 text-red-500" />
                        </div>
                        <span className="font-bold text-sm text-red-700 dark:text-red-400">
                          Overdue Payments
                        </span>
                        <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider shrink-0">
                          {overduePaymentsList.length} • $
                          {overduePaymentsList
                            .reduce(
                              (sum: number, p: any) =>
                                sum + (Number(p.amount) || 0),
                              0,
                            )
                            .toLocaleString()}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {overduePaymentsList.map((item: any) => (
                          <div
                            key={`op-${item.id}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-red-500/20 p-2.5 bg-card gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {item.wedding?.client_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                ${Number(item.amount).toLocaleString()} • Due{" "}
                                {formatDisplayDate(item.date)}
                              </p>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="destructive"
                          size="sm"
                          asChild
                          className="w-full sm:w-auto rounded-full shadow-sm font-semibold mt-1"
                        >
                          <Link to="/manager/payments">Collect Payments</Link>
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Pending Weddings Group */}
                {pendingWeddingsList.length > 0 && (
                  <AccordionItem
                    value="weddings"
                    className="border border-border/40 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-blue-500/10 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-blue-500/15 shrink-0">
                          <Calendar className="h-4 w-4 text-blue-500" />
                        </div>
                        <span className="font-semibold text-sm text-blue-700 dark:text-blue-400">
                          Pending Weddings
                        </span>
                        <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider shrink-0">
                          {pendingWeddingsList.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {pendingWeddingsList.map((w) => (
                          <div
                            key={`w-${w.id}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/40 p-2.5 bg-card gap-2"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-sm font-medium truncate">
                                {w.client_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {formatDisplayDate(w.date)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="shrink-0 w-full sm:w-auto rounded-full bg-background text-xs h-8"
                            >
                              <Link to="/manager/weddings">Review</Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Missing Questionnaires Group */}
                {pendingQuestionnairesList.length > 0 && (
                  <AccordionItem
                    value="questionnaires"
                    className="border border-border/40 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-pink-500/10 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-pink-500/15 shrink-0">
                          <FileText className="h-4 w-4 text-pink-500" />
                        </div>
                        <span className="font-semibold text-sm text-pink-700 dark:text-pink-400">
                          Missing Questionnaires
                        </span>
                        <span className="rounded-full bg-pink-500/15 border border-pink-500/30 px-2.5 py-0.5 text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider shrink-0">
                          {pendingQuestionnairesList.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {pendingQuestionnairesList.map((w) => (
                          <div
                            key={`q-${w.id}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/40 p-2.5 bg-card gap-2"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-sm font-medium truncate">
                                {w.client_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {formatDisplayDate(w.date)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="shrink-0 w-full sm:w-auto rounded-full bg-background text-xs h-8"
                            >
                              <Link to="/manager/weddings">Send Reminder</Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Unassigned Positions Group */}
                {openJobsList.length > 0 && (
                  <AccordionItem
                    value="positions"
                    className="border border-border/40 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-purple-500/10 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-purple-500/15 shrink-0">
                          <Briefcase className="h-4 w-4 text-purple-500" />
                        </div>
                        <span className="font-semibold text-sm text-purple-700 dark:text-purple-400">
                          Unassigned Positions
                        </span>
                        <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider shrink-0">
                          {openJobsList.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {openJobsList.map((j) => {
                          const isUrgent =
                            j.weddings?.date &&
                            parseLocalDate(j.weddings.date).getTime() -
                              today.getTime() <
                              14 * 24 * 60 * 60 * 1000;
                          return (
                            <div
                              key={`j-${j.id}`}
                              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/40 p-2.5 bg-card gap-2"
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">
                                    {j.role}
                                  </p>
                                  {isUrgent && (
                                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive shrink-0">
                                      Urgent
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {j.weddings?.client_name}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="shrink-0 w-full sm:w-auto rounded-full bg-background text-xs h-8"
                              >
                                <Link to="/manager/positions">Assign</Link>
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Pending Applications Group */}
                {pendingAppsGrouped.length > 0 && (
                  <AccordionItem
                    value="applications"
                    className="border border-border/40 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-orange-500/10 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-orange-500/15 shrink-0">
                          <Inbox className="h-4 w-4 text-orange-500" />
                        </div>
                        <span className="font-semibold text-sm text-orange-700 dark:text-orange-400">
                          Pending Applications
                        </span>
                        <span className="rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider shrink-0">
                          {String(
                            pendingAppsGrouped.reduce(
                              (sum: number, g: any) => sum + g.apps.length,
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {pendingAppsGrouped.map((group: any) => (
                          <div
                            key={`ag-${group.job?.id || Math.random()}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/40 p-2.5 bg-card gap-2"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-sm font-medium truncate">
                                {group.job?.role} for{" "}
                                {group.job?.weddings?.client_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {group.apps.length} application
                                {group.apps.length > 1 ? "s" : ""} pending
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="shrink-0 w-full sm:w-auto rounded-full bg-background text-xs h-8"
                            >
                              <Link to="/manager/applications">Review</Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Hiring Pipeline Group */}
                {hiringItemsCount > 0 && (
                  <AccordionItem
                    value="hiring"
                    className="border border-border/40 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-teal-500/10 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-teal-500/15 shrink-0">
                          <Users className="h-4 w-4 text-teal-500" />
                        </div>
                        <span className="font-semibold text-sm text-teal-700 dark:text-teal-400">
                          Hiring Pipeline
                        </span>
                        <span className="rounded-full bg-teal-500/15 border border-teal-500/30 px-2.5 py-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider shrink-0">
                          {hiringItemsCount}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {newApplicantsList.length > 0 && (
                          <div className="rounded-lg border border-amber-500/20 p-2.5 bg-amber-50/30 dark:bg-amber-950/10">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5">
                              New Applicants ({newApplicantsList.length})
                            </p>
                            {newApplicantsList.map((c: any) => (
                              <div
                                key={`na-${c.id}`}
                                className="flex items-center justify-between py-1"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="text-sm font-medium truncate">
                                    {c.first_name} {c.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {c.specialty || "No specialty"}
                                  </p>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  Not advanced
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {interviewUnscheduledList.length > 0 && (
                          <div className="rounded-lg border border-blue-500/20 p-2.5 bg-blue-50/30 dark:bg-blue-950/10">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                              Interview Unscheduled (
                              {interviewUnscheduledList.length})
                            </p>
                            {interviewUnscheduledList.map((c: any) => (
                              <div
                                key={`iu-${c.id}`}
                                className="flex items-center justify-between py-1"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="text-sm font-medium truncate">
                                    {c.first_name} {c.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {c.email}
                                  </p>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  No date set
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {stuckInPipelineList.length > 0 && (
                          <div className="rounded-lg border border-orange-500/20 p-2.5 bg-orange-50/30 dark:bg-orange-950/10">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-1.5">
                              Stuck in Pipeline ({stuckInPipelineList.length})
                            </p>
                            {stuckInPipelineList.map((c: any) => (
                              <div
                                key={`sp-${c.id}`}
                                className="flex items-center justify-between py-1"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="text-sm font-medium truncate">
                                    {c.first_name} {c.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate capitalize">
                                    {c.status} stage
                                  </p>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  7+ days
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {paperworkReadyList.length > 0 && (
                          <div className="rounded-lg border border-emerald-500/20 p-2.5 bg-emerald-50/30 dark:bg-emerald-950/10">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">
                              Paperwork Ready ({paperworkReadyList.length})
                            </p>
                            {paperworkReadyList.map((c: any) => (
                              <div
                                key={`pr-${c.id}`}
                                className="flex items-center justify-between py-1"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="text-sm font-medium truncate">
                                    {c.first_name} {c.last_name}
                                  </p>
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                                    W-9 + Agreement signed
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="shrink-0 rounded-full bg-background text-xs h-7"
                                >
                                  <Link to="/manager/contractors">Approve</Link>
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="w-full sm:w-auto rounded-full shadow-sm font-semibold mt-1"
                        >
                          <Link to="/manager/contractors">Manage Pipeline</Link>
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Pending Payouts Group */}
                {pendingPayoutsList.length > 0 && (
                  <AccordionItem
                    value="payouts"
                    className="border border-border/40 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-green-500/10 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-green-500/15 shrink-0">
                          <DollarSign className="h-4 w-4 text-green-500" />
                        </div>
                        <span className="font-semibold text-sm text-green-700 dark:text-green-400">
                          Pending Payouts
                        </span>
                        <span className="rounded-full bg-green-500/15 border border-green-500/30 px-2.5 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider shrink-0">
                          {pendingPayoutsList.length} • $
                          {pendingPayoutsList
                            .reduce(
                              (sum: number, a: any) =>
                                sum + (a.jobs?.pay_rate || 0),
                              0,
                            )
                            .toLocaleString()}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {pendingPayoutsList.map((a: any) => (
                          <div
                            key={`po-${a.id}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/40 p-2.5 bg-card gap-2"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-sm font-medium truncate">
                                {a.contractors?.first_name}{" "}
                                {a.contractors?.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {a.jobs?.role} • {a.jobs?.weddings?.client_name}{" "}
                                • ${a.jobs?.pay_rate || 0}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="shrink-0 w-full sm:w-auto rounded-full bg-background text-xs h-8"
                            >
                              <Link to="/manager/payouts">Approve</Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Missing Drive Links Group */}
                {missingDriveLinksList.length > 0 && (
                  <AccordionItem
                    value="drive-links"
                    className="border border-border/40 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-cyan-500/10 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-cyan-500/15 shrink-0">
                          <HardDrive className="h-4 w-4 text-cyan-500" />
                        </div>
                        <span className="font-semibold text-sm text-cyan-700 dark:text-cyan-400">
                          Missing Drive Links
                        </span>
                        <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider shrink-0">
                          {missingDriveLinksList.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {missingDriveLinksList.map((w) => (
                          <div
                            key={`dl-${w.id}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/40 p-2.5 bg-card gap-2"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-sm font-medium truncate">
                                {w.client_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {formatDisplayDate(w.date)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="shrink-0 w-full sm:w-auto rounded-full bg-background text-xs h-8"
                            >
                              <Link to="/manager/post-production">
                                Add Link
                              </Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Missing Upload Links Group */}
                {missingUploadLinksList.length > 0 && (
                  <AccordionItem
                    value="upload-links"
                    className="border border-border/40 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-amber-500/10 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-amber-500/15 shrink-0">
                          <Upload className="h-4 w-4 text-amber-500" />
                        </div>
                        <span className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                          Missing Upload Links
                        </span>
                        <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider shrink-0">
                          {missingUploadLinksList.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {missingUploadLinksList.map((w) => (
                          <div
                            key={`ul-${w.id}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/40 p-2.5 bg-card gap-2"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-sm font-medium truncate">
                                {w.client_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {formatDisplayDate(w.date)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="shrink-0 w-full sm:w-auto rounded-full bg-background text-xs h-8"
                            >
                              <Link to="/manager/post-production">
                                Add Link
                              </Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Unconfirmed Attendance Group */}
                {unconfirmedAttendanceList.length > 0 && (
                  <AccordionItem
                    value="unconfirmed-attendance"
                    className="border border-rose-500/30 rounded-xl mb-2 overflow-hidden bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-full bg-rose-500/15 shrink-0">
                          <AlertCircle className="h-4 w-4 text-rose-500" />
                        </div>
                        <span className="font-bold text-sm text-rose-700 dark:text-rose-400">
                          Unconfirmed Attendance
                        </span>
                        <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider shrink-0">
                          {unconfirmedAttendanceList.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {unconfirmedAttendanceList.map((a: any) => (
                          <div
                            key={`ua-${a.id}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-rose-500/20 p-2.5 bg-card gap-2"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-sm font-medium truncate">
                                {a.contractors?.first_name}{" "}
                                {a.contractors?.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {a.jobs?.role} • {a.jobs?.weddings?.client_name}{" "}
                                • {formatDisplayDate(a.jobs?.weddings?.date)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 w-full sm:w-auto rounded-full bg-background text-xs h-8"
                              onClick={() =>
                                sendReminderMutation.mutate({
                                  unconfirmedAssignments:
                                    unconfirmedAttendanceList,
                                })
                              }
                              disabled={sendReminderMutation.isPending}
                            >
                              {sendReminderMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : null}
                              Send Reminder
                            </Button>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <CheckCircle className="mx-auto h-12 w-12 opacity-50 mb-4 text-emerald-500" />
                <p>You're all caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Jump */}
        <Card className="min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm h-fit">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-base font-bold">Quick Jump</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 grid grid-cols-2 gap-2">
            {[
              {
                label: "Weddings",
                icon: Calendar,
                to: "/manager/weddings",
                color: "text-blue-500",
                bg: "bg-blue-50 dark:bg-blue-950/30",
              },
              {
                label: "Positions",
                icon: Briefcase,
                to: "/manager/positions",
                color: "text-purple-500",
                bg: "bg-purple-50 dark:bg-purple-950/30",
              },
              {
                label: "Contractors",
                icon: Users,
                to: "/manager/contractors",
                color: "text-indigo-500",
                bg: "bg-indigo-50 dark:bg-indigo-950/30",
              },
              {
                label: "Accounting",
                icon: DollarSign,
                to: "/manager/accounting",
                color: "text-emerald-500",
                bg: "bg-emerald-50 dark:bg-emerald-950/30",
              },
              {
                label: "Post-Prod",
                icon: Video,
                to: "/manager/post-production",
                color: "text-orange-500",
                bg: "bg-orange-50 dark:bg-orange-950/30",
              },
              {
                label: "Settings",
                icon: Settings,
                to: "/manager/settings",
                color: "text-muted-foreground",
                bg: "bg-muted",
              },
            ].map((item) => (
              <Link to={item.to} key={item.label}>
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border/40 hover:shadow-md hover:border-primary/30 transition-all bg-card cursor-pointer">
                  <div className={`p-1.5 rounded-full ${item.bg} shrink-0`}>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <span className="text-sm font-medium truncate">
                    {item.label}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!reviewApp}
        onOpenChange={(open) => !open && setReviewApp(null)}
      >
        <DialogContent className="sm:max-w-[500px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              {reviewApp?.contractors?.first_name}{" "}
              {reviewApp?.contractors?.last_name} applied for{" "}
              {reviewApp?.jobs?.role}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Contractor:</span>
                <p>
                  {reviewApp?.contractors?.first_name}{" "}
                  {reviewApp?.contractors?.last_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {reviewApp?.contractors?.email}
                </p>
              </div>
              <div>
                <span className="font-semibold">Wedding:</span>
                <p>{reviewApp?.jobs?.weddings?.client_name}</p>
                <p className="text-muted-foreground text-xs">
                  {reviewApp?.jobs?.weddings?.date
                    ? new Date(
                        reviewApp.jobs.weddings.date,
                      ).toLocaleDateString()
                    : "TBD"}
                </p>
              </div>
            </div>

            {reviewApp?.jobs?.pay_type === "bidding" && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-md p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-400">
                    Contractor's Bid:
                  </span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-500">
                    {reviewApp?.bid_amount != null
                      ? `$${reviewApp.bid_amount}`
                      : "No bid placed"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Suggested Range:</span>
                  <span>
                    {(() => {
                      const role = reviewApp?.jobs?.role?.toLowerCase() || "";
                      const hours = reviewApp?.jobs?.hours || 8;
                      const isPhoto = role.includes("photo");
                      const isVideo = role.includes("video");

                      let minRate = 50;
                      let maxRate = 100;

                      if (isPhoto) {
                        minRate = settings?.photo_bid_min || 50;
                        maxRate = settings?.photo_bid_max || 100;
                      } else if (isVideo) {
                        minRate = settings?.video_bid_min || 60;
                        maxRate = settings?.video_bid_max || 120;
                      }

                      return `$${minRate * hours} - $${maxRate * hours}`;
                    })()}
                  </span>
                </div>
              </div>
            )}

            {reviewApp?.message && (
              <div>
                <span className="font-semibold text-sm">Message:</span>
                <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                  {reviewApp.message}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              className="rounded-full shadow-sm"
              onClick={() => setReviewApp(null)}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="rounded-full shadow-sm"
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: reviewApp.id,
                    status: "declined",
                    app: reviewApp,
                  })
                }
                disabled={updateStatusMutation.isPending}
              >
                Decline
              </Button>
              <Button
                variant="default"
                className="rounded-full shadow-sm"
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: reviewApp.id,
                    status: "awarded",
                    app: reviewApp,
                  })
                }
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Approve & Assign
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle>Communication Hub</DialogTitle>
            <DialogDescription>
              Send a direct message or bulk announcement to your contractors.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>To</Label>
              <Select
                value={messageRecipientType}
                onValueChange={setMessageRecipientType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recipients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Active Contractors</SelectItem>
                  <SelectItem value="region">Specific Region</SelectItem>
                  <SelectItem value="contractor">
                    Specific Contractor
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {messageRecipientType === "region" && (
              <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                <Label>Select Region</Label>
                <Select value={messageRegion} onValueChange={setMessageRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a region" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings?.regions?.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {messageRecipientType === "contractor" && (
              <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                <Label>Select Contractor</Label>
                <Select
                  value={messageContractorId}
                  onValueChange={setMessageContractorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a contractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors
                      .filter((c) => c.status === "active")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Subject</Label>
              <Input
                placeholder="e.g. Upcoming Busy Season"
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Type your message here..."
                className="min-h-[120px]"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              className="rounded-full shadow-sm"
              onClick={() => setIsMessageModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full shadow-sm"
              onClick={() => sendMessageMutation.mutate()}
              disabled={
                sendMessageMutation.isPending ||
                !messageTitle.trim() ||
                !messageBody.trim()
              }
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ratingModalOpen}
        onOpenChange={(open) => {
          setRatingModalOpen(open);
          if (!open) {
            setEditorRating(5);
            setSpeedRating(5);
            setEditorFeedback("");
            setMarkReadyToEdit(true);
            setPaymentMethod("Venmo");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle>Rate Contractor & Approve Payout</DialogTitle>
            <DialogDescription>
              Rate the media quality and professionalism for{" "}
              {ratingAssignment?.contractors?.first_name}. This helps calculate
              their overall score.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Media Quality & Instructions (1-5 Stars)</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEditorRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 ${star <= editorRating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Submission Speed / Turnaround (1-5 Stars)</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSpeedRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 ${star <= speedRating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Feedback Notes (Optional)</Label>
              <Textarea
                placeholder="Were the files organized? Did they miss any shots?"
                value={editorFeedback}
                onChange={(e) => setEditorFeedback(e.target.value)}
              />
            </div>

            <div className="space-y-2 pt-2 border-t mt-2">
              <Label>Payment Method</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="flex flex-col space-y-2 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Stripe" id="pm-dash-stripe" />
                  <label
                    htmlFor="pm-dash-stripe"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Stripe Direct Transfer
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Zelle" id="pm-dash-zelle" />
                  <label
                    htmlFor="pm-dash-zelle"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Zelle
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Venmo" id="pm-dash-venmo" />
                  <label
                    htmlFor="pm-dash-venmo"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Venmo
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CashApp" id="pm-dash-cashapp" />
                  <label
                    htmlFor="pm-dash-cashapp"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    CashApp
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PayPal" id="pm-dash-paypal" />
                  <label
                    htmlFor="pm-dash-paypal"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    PayPal
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Other" id="pm-dash-other" />
                  <label
                    htmlFor="pm-dash-other"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Other
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t mt-2">
              <input
                type="checkbox"
                id="markReadyToEditDash"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={markReadyToEdit}
                onChange={(e) => setMarkReadyToEdit(e.target.checked)}
              />
              <label
                htmlFor="markReadyToEditDash"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Mark wedding as "Ready to Edit"
              </label>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              className="rounded-full shadow-sm"
              onClick={() => setRatingModalOpen(false)}
              disabled={approvePayoutMutation.isPending || isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full shadow-sm"
              onClick={() => {
                if (ratingAssignment && !isSubmitting) {
                  setIsSubmitting(true);
                  approvePayoutMutation.mutate(
                    {
                      id: ratingAssignment.id,
                      rating: editorRating,
                      speed_rating: speedRating,
                      feedback: editorFeedback,
                      contractorId: ratingAssignment.contractor_id,
                    },
                    {
                      onSuccess: () => {
                        setIsSubmitting(false);
                        setRatingModalOpen(false);
                      },
                      onError: () => {
                        setIsSubmitting(false);
                      },
                    },
                  );
                }
              }}
              disabled={approvePayoutMutation.isPending || isSubmitting}
            >
              {(approvePayoutMutation.isPending || isSubmitting) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Approve Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={driveLinkModalOpen} onOpenChange={setDriveLinkModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl overflow-hidden shadow-xl border-border/40">
          <DialogHeader>
            <DialogTitle>Add Raw Media Link</DialogTitle>
            <DialogDescription>
              Paste the Google Drive or Dropbox folder link where contractors
              should upload their raw files for{" "}
              {selectedWeddingForDrive?.client_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Folder Link</Label>
              <Input
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveLinkInput}
                onChange={(e) => setDriveLinkInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              className="rounded-full shadow-sm"
              onClick={() => setDriveLinkModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full shadow-sm"
              onClick={() => {
                if (selectedWeddingForDrive && driveLinkInput) {
                  updateDriveLinkMutation.mutate({
                    id: selectedWeddingForDrive.id,
                    link: driveLinkInput,
                  });
                }
              }}
              disabled={
                updateDriveLinkMutation.isPending || !driveLinkInput.trim()
              }
            >
              {updateDriveLinkMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Save Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
