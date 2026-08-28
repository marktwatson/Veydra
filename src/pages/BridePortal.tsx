import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { api, DbWedding } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  Heart,
  Loader2,
  Trash2,
  Plus,
  Calendar,
  Clock,
  Image as ImageIcon,
  Video,
  FileText,
  Users,
  MessageSquare,
  Send,
  BookOpen,
  ChevronRight,
  Sparkles,
  Camera,
  MapPin,
  ListChecks,
  Smartphone,
  Gift,
  Share2,
  CreditCard,
  FileSignature,
  Download,
  Music,
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  parseTimeTo24Hour,
  formatTime,
  formatPhoneNumber,
  cn,
  DEFAULT_LOGO_URL,
  formatDisplayDate,
  generatePaymentSchedule,
  getCompanyTimezone,
} from "@/lib/utils";

const getSafeDate = (dateStr: string | null) => {
  if (!dateStr) return new Date();
  // If it's a plain date (YYYY-MM-DD), parse as local midnight to avoid UTC shift
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  // If it has a time component, convert from company timezone to get correct local date
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return new Date();
  // For ISO timestamps with timezone, we want the date in the company timezone
  const tzDate = new Date(
    date.toLocaleString("en-US", { timeZone: getCompanyTimezone() }),
  );
  return tzDate;
};

export default function BridePortal() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wedding, setWedding] = useState<Partial<DbWedding> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const queryClient = useQueryClient();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState("overview");
  const [isManagingPayments, setIsManagingPayments] = useState(false);
  const [invoicesData, setInvoicesData] = useState<{
    upcoming: any;
    pastInvoices: any[];
  } | null>(null);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [companyName, setCompanyName] = useState(
    localStorage.getItem("veydra_company_name") || "Company",
  );
  const [logoUrl, setLogoUrl] = useState(
    localStorage.getItem("veydra_logo_url") || "",
  );
  const [companyState, setCompanyState] = useState("Tennessee");

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [isSendingContact, setIsSendingContact] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [selectedContractor, setSelectedContractor] = useState<any | null>(
    null,
  );
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => api.getMessages(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;

    // Presence channel
    const presenceChannel = supabase.channel("online-users", {
      config: { presence: { key: id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const newState = presenceChannel.presenceState();
        const online = new Set<string>();
        for (const uid in newState) {
          online.add(uid);
        }
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ online: true });
        }
      });

    // Typing indicator channel
    const typingChannel = supabase.channel("typing", {
      config: { broadcast: { self: false } },
    });

    typingChannel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (
          payload.payload.receiver_id === id &&
          payload.payload.sender_id === "manager"
        ) {
          setIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);

          setTimeout(() => {
            if (chatScrollRef.current)
              chatScrollRef.current.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    const channel = supabase
      .channel(`public:messages_${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [id, queryClient]);

  useEffect(() => {
    if (contactModalOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollIntoView({ behavior: "smooth" });

      // Mark unread messages as read
      const unread = messages.filter((m) => m.receiver_id === id && !m.read);
      if (unread.length > 0) {
        unread.forEach((m) => api.markMessageAsRead(m.id));
        setTimeout(
          () => queryClient.invalidateQueries({ queryKey: ["messages", id] }),
          500,
        );
      }
    }
  }, [messages, contactModalOpen, id, queryClient]);

  // Form State
  const [timelineEvents, setTimelineEvents] = useState<
    { time: string; event: string }[]
  >([{ time: "12:00", event: "Photographer Arrives" }]);
  const [vipNames, setVipNames] = useState("");
  const [vendors, setVendors] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  const [questionnaireData, setQuestionnaireData] = useState({
    contact_info: {
      full_name: "",
      email: "",
      bride_full_name: "",
      groom_full_name: "",
      phone_bride: "",
      phone_groom: "",
      preferred_contact_method: "Email",
      best_contact_time: "Morning",
    },
    style_vibe: {
      wedding_theme: "",
      dress_code: "",
      florist_name: "",
      decor_style: "",
      pinterest_link: "",
    },
    photo_video: {
      first_look: "No",
      must_have_photos: "",
      must_have_video_moments: "",
      audio_vows_toasts: "Yes",
      photography_restrictions: "",
      special_photo_locations: "",
      dont_want_captured: "",
    },
    family_details: {
      bride_parents_names: "",
      groom_parents_names: "",
      family_members_to_prioritize: "",
      sensitive_family_situations: "",
      emergency_contact: "",
    },
    wedding_party: {
      wedding_party_size: "",
      special_traditions_events: "",
    },
  });

  const [highlightSongs, setHighlightSongs] = useState<
    { title: string; artist: string; link: string; moment: string }[]
  >([]);
  const [songsSubmitted, setSongsSubmitted] = useState(false);
  const [isSavingSongs, setIsSavingSongs] = useState(false);

  useEffect(() => {
    async function loadWedding() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await api.getPublicWedding(id);
        setWedding(data);

        api
          .getPortalSettings()
          .then((settings: any) => {
            if (settings?.company_name) {
              setCompanyName(settings.company_name);
              try {
                localStorage.setItem(
                  "veydra_company_name",
                  settings.company_name,
                );
              } catch (e) {}
            }
            if (settings?.logo_url) {
              setLogoUrl(settings.logo_url);
              try {
                localStorage.setItem("veydra_logo_url", settings.logo_url);
              } catch (e) {}
            }
            if (settings?.state) {
              setCompanyState(settings.state);
            }
          })
          .catch(() => {});

        if (data.questionnaire_completed) {
          setSuccess(true);
          setActiveTab("overview");
        } else {
          setActiveTab("questionnaire");
          if (data.timeline) {
            try {
              const parsed =
                typeof data.timeline === "string"
                  ? JSON.parse(data.timeline)
                  : data.timeline;
              if (Array.isArray(parsed) && parsed.length > 0) {
                setTimelineEvents(
                  parsed.map((e: any) => ({
                    ...e,
                    time: parseTimeTo24Hour(e.time),
                  })),
                );
              }
            } catch (e) {
              // Ignore if it's old raw text, keep default
            }
          }
          setVipNames(data.vip_names || "");
          setVendors(data.vendors || "");
          setSpecialRequests(data.special_requests || "");

          if (data.questionnaire_data) {
            try {
              const qData =
                typeof data.questionnaire_data === "string"
                  ? JSON.parse(data.questionnaire_data)
                  : data.questionnaire_data;
              setQuestionnaireData((prev) => ({
                ...prev,
                ...qData,
              }));
            } catch (e) {
              // Ignore
            }
          }
        }

        // Load highlight songs
        if (data.highlight_songs) {
          const songs =
            typeof data.highlight_songs === "string"
              ? (() => {
                  try {
                    return JSON.parse(data.highlight_songs);
                  } catch {
                    return [];
                  }
                })()
              : data.highlight_songs;
          if (Array.isArray(songs) && songs.length > 0) {
            setHighlightSongs(songs);
          }
        }
        if (data.songs_submitted_at) {
          setSongsSubmitted(true);
        }
      } catch (err: any) {
        console.error("Error loading wedding:", err);
        setError(
          "We couldn't find your wedding details. Please check the link and try again.",
        );
      } finally {
        setLoading(false);
      }
    }
    loadWedding();
  }, [id]);

  useEffect(() => {
    if (
      wedding &&
      (wedding.stripe_customer_id || wedding.client_email) &&
      !invoicesData &&
      !isLoadingInvoices
    ) {
      const fetchInvoices = async () => {
        setIsLoadingInvoices(true);
        try {
          const res = await fetch(
            `${supabaseUrl}/functions/v1/stripe-invoices`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                customerId: wedding.stripe_customer_id,
                customerEmail: wedding.client_email,
              }),
            },
          );
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          if (data) {
            setInvoicesData(data);
            if (
              typeof data.totalPaid === "number" &&
              data.totalPaid > 0 &&
              Math.abs((wedding.paid_amount || 0) - data.totalPaid) > 0.01
            ) {
              setWedding((prev) =>
                prev ? { ...prev, paid_amount: data.totalPaid } : prev,
              );
            }
          }
        } catch (err) {
          console.error("Error fetching invoices:", err);
        } finally {
          setIsLoadingInvoices(false);
        }
      };
      fetchInvoices();
    }
  }, [wedding, invoicesData, isLoadingInvoices]);

  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProgress = async () => {
    if (!id) return;
    try {
      setIsSaving(true);
      await api.saveWeddingQuestionnaireProgress(id, {
        timeline: timelineEvents.map((e) => ({
          ...e,
          time: formatTime(e.time),
        })) as any,
        vip_names: vipNames,
        vendors,
        special_requests: specialRequests,
        questionnaire_data: questionnaireData,
      });
      toast({
        title: "Progress Saved",
        description:
          "Your responses have been saved. You can return later to finish.",
      });
    } catch (err) {
      console.error("Error saving progress:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was a problem saving your progress.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      setSubmitting(true);
      await api.submitWeddingQuestionnaire(id, {
        timeline: timelineEvents.map((e) => ({
          ...e,
          time: formatTime(e.time),
        })) as any,
        vip_names: vipNames,
        vendors,
        special_requests: specialRequests,
        questionnaire_data: questionnaireData,
      });

      setSuccess(true);
      toast({
        title: "Details Submitted!",
        description: "Thank you! We've received your wedding details.",
      });
    } catch (err: any) {
      console.error("Error submitting questionnaire:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "There was a problem submitting your details. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManagePayments = async () => {
    if (!wedding?.stripe_customer_id) return;

    try {
      setIsManagingPayments(true);
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          customerId: wedding.stripe_customer_id,
          returnUrl: window.location.href,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Error opening payment portal:", err);
      toast({
        title: "Error",
        description:
          "Could not open the payment portal. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsManagingPayments(false);
    }
  };

  const updateQData = (
    section: keyof typeof questionnaireData,
    field: string,
    value: string,
  ) => {
    setQuestionnaireData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim() || !wedding || !id) return;

    setIsSendingContact(true);
    try {
      await api.sendMessage({
        sender_id: id,
        receiver_id: "manager",
        content: contactMessage.trim(),
      });

      const managers = await api.getManagers();
      const manager = managers[0];
      if (manager?.email) {
        await api
          .sendOvantaEmail(
            manager.email,
            `New Message from Bride: ${wedding.client_name}`,
            `You have received a new message from ${wedding.client_name} via the Bride Portal:<br><br>${contactMessage.replace(/\n/g, "<br>")}`,
          )
          .catch(() => {}); // fire and forget email
      }
      setContactMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages", id] });
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "There was a problem sending your message. Please try again.",
      });
    } finally {
      setIsSendingContact(false);
    }
  };

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => api.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", id] });
      toast({
        title: "Message deleted",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete message",
      });
    },
  });

  // Team members are now fetched separately to bypass RLS
  useEffect(() => {
    if (id) {
      api
        .getPublicWeddingTeam(id)
        .then((data) => {
          if (data && Array.isArray(data)) {
            setTeamMembers(data);
          }
        })
        .catch(console.error);
    }
  }, [id]);

  const paymentSchedule = useMemo(() => {
    if (!wedding) return [];

    const sortedPast = invoicesData?.pastInvoices
      ? [...invoicesData.pastInvoices].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        )
      : [];
    const firstInvoiceDate = sortedPast.length > 0 ? sortedPast[0].date : null;
    const baseDate =
      wedding.contract_date || firstInvoiceDate || wedding.created_at || "";

    let schedule = generatePaymentSchedule(
      wedding.total_amount || 0,
      wedding.payment_plan || "full",
      wedding.date || "",
      baseDate,
      invoicesData
        ? Math.max(
            wedding.paid_amount || 0,
            sortedPast.reduce((sum: number, inv: any) => sum + inv.amount, 0),
          )
        : wedding.paid_amount || 0,
      wedding.custom_payment_plan,
    );

    if (invoicesData) {
      let pastIdx = 0;
      schedule = schedule.map((item) => {
        if (item.status === "paid" && pastIdx < sortedPast.length) {
          const inv = sortedPast[pastIdx++];
          return { ...item, date: formatDisplayDate(inv.date) };
        }
        return item;
      });
    }

    return schedule;
  }, [
    wedding?.total_amount,
    wedding?.payment_plan,
    wedding?.date,
    wedding?.created_at,
    wedding?.paid_amount,
    wedding?.custom_payment_plan,
    invoicesData,
  ]);

  const hasVideo = useMemo(() => {
    if (!wedding?.package) return true;
    const pkg = (wedding.package || "").toLowerCase();
    const addons = Array.isArray(wedding.addons)
      ? wedding.addons.join(" ").toLowerCase()
      : (wedding.addons || "").toString().toLowerCase();

    // If explicitly photo only and no video/highlight addon
    if (
      pkg.includes("photo only") &&
      !addons.includes("video") &&
      !addons.includes("film") &&
      !addons.includes("highlight")
    ) {
      return false;
    }
    // If package includes video keywords
    if (
      pkg.includes("video") ||
      pkg.includes("film") ||
      pkg.includes("highlight") ||
      pkg.includes("cinema") ||
      pkg.includes("combo") ||
      pkg.includes("+")
    ) {
      return true;
    }
    // If addons include video keywords
    if (
      addons.includes("video") ||
      addons.includes("film") ||
      addons.includes("highlight")
    ) {
      return true;
    }
    // If purely photo/photography
    if (pkg.includes("photo") || pkg.includes("photography")) {
      return false;
    }
    return true;
  }, [wedding?.package, wedding?.addons]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf7f2] bride-portal">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[#c9a96e]/20 animate-ping" />
            <Heart className="h-10 w-10 text-[#1a1a1a] animate-pulse relative z-10" />
          </div>
          <p
            className="text-[#1a1a1a]/60 text-sm font-light"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Loading your portal...
          </p>
        </div>
      </div>
    );
  }

  if (error || !wedding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf7f2] p-4 bride-portal">
        <Card className="max-w-md w-full text-center rounded-2xl border-[#c9a96e]/30 shadow-sm">
          <CardHeader className="pt-8 pb-6">
            <div className="mx-auto w-14 h-14 bg-[#c9a96e]/20 rounded-full flex items-center justify-center mb-4">
              <Heart className="h-7 w-7 text-[#1a1a1a]" />
            </div>
            <CardTitle
              className="text-[#1a1a1a]"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Oops!
            </CardTitle>
            <CardDescription className="text-[#1a1a1a]/70 mt-2">
              {error ||
                "We couldn't find your wedding details. Please check the link and try again."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const renderQuestionnaire = () => {
    if (success) {
      return (
        <Card className="text-center py-12 rounded-2xl shadow-sm border-[#c9a96e]/30 bg-white">
          <CardContent className="space-y-6">
            <div className="mx-auto w-16 h-16 bg-[#c9a96e]/30 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-[#1a1a1a]" />
            </div>
            <h2
              className="text-2xl font-bold tracking-tight text-[#1a1a1a]"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              You're All Set!
            </h2>
            <p className="text-[#1a1a1a]/60 max-w-md mx-auto">
              Thank you! We have successfully received your wedding details. Our
              team will review your timeline and reach out if we have any
              questions.
            </p>
            <div className="pt-4">
              <Button
                variant="outline"
                className="border-[#1a1a1a]/30 text-[#1a1a1a] hover:bg-[#c9a96e]/20 rounded-full"
                onClick={() => setSuccess(false)}
              >
                Make Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    const steps = [
      { id: "contact", title: "Contact Info" },
      { id: "style", title: "Style & Vibe" },
      { id: "photo", title: "Photo & Video" },
      { id: "family", title: "Family Details" },
      { id: "party", title: "Wedding Party" },
      { id: "timeline", title: "Timeline" },
      { id: "additional", title: "Additional Notes" },
    ];

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-[#1a1a1a]/60 uppercase tracking-wider">
              Step {currentStep + 1} of {steps.length}
            </h3>
            <span className="text-sm font-medium text-[#1a1a1a]">
              {steps[currentStep].title}
            </span>
          </div>
          <div className="flex gap-2">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`h-2 flex-1 rounded-full transition-colors ${idx <= currentStep ? "bg-[#1a1a1a]" : "bg-[#c9a96e]/30"}`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {currentStep === 0 && (
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Contact Information
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Let's make sure we have the right details to reach you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Your Full Name *</Label>
                    <Input
                      required
                      value={questionnaireData.contact_info.full_name}
                      onChange={(e) =>
                        updateQData("contact_info", "full_name", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      required
                      type="email"
                      value={questionnaireData.contact_info.email}
                      onChange={(e) =>
                        updateQData("contact_info", "email", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bride's Full Name *</Label>
                    <Input
                      required
                      value={questionnaireData.contact_info.bride_full_name}
                      onChange={(e) =>
                        updateQData(
                          "contact_info",
                          "bride_full_name",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Groom's Full Name *</Label>
                    <Input
                      required
                      value={questionnaireData.contact_info.groom_full_name}
                      onChange={(e) =>
                        updateQData(
                          "contact_info",
                          "groom_full_name",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone (Bride) *</Label>
                    <Input
                      required
                      type="tel"
                      value={questionnaireData.contact_info.phone_bride}
                      onChange={(e) =>
                        updateQData(
                          "contact_info",
                          "phone_bride",
                          formatPhoneNumber(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone (Groom) *</Label>
                    <Input
                      required
                      type="tel"
                      value={questionnaireData.contact_info.phone_groom}
                      onChange={(e) =>
                        updateQData(
                          "contact_info",
                          "phone_groom",
                          formatPhoneNumber(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred Contact Method *</Label>
                    <Select
                      value={
                        questionnaireData.contact_info.preferred_contact_method
                      }
                      onValueChange={(v) =>
                        updateQData(
                          "contact_info",
                          "preferred_contact_method",
                          v,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Text">Text</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Phone">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Best Contact Time *</Label>
                    <Select
                      value={questionnaireData.contact_info.best_contact_time}
                      onValueChange={(v) =>
                        updateQData("contact_info", "best_contact_time", v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Afternoon">Afternoon</SelectItem>
                        <SelectItem value="Evening">Evening</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 1 && (
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Wedding Style & Vibe
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Tell us about the look and feel of your big day.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label>Wedding Theme / Color Palette</Label>
                  <Input
                    value={questionnaireData.style_vibe.wedding_theme}
                    onChange={(e) =>
                      updateQData("style_vibe", "wedding_theme", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dress Code / Attire Notes</Label>
                  <Input
                    value={questionnaireData.style_vibe.dress_code}
                    onChange={(e) =>
                      updateQData("style_vibe", "dress_code", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Florist Name</Label>
                  <Input
                    value={questionnaireData.style_vibe.florist_name}
                    onChange={(e) =>
                      updateQData("style_vibe", "florist_name", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Decor Style</Label>
                  <Input
                    value={questionnaireData.style_vibe.decor_style}
                    onChange={(e) =>
                      updateQData("style_vibe", "decor_style", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reference Photos & Mood Board Links</Label>
                  <Textarea
                    placeholder="Paste links to your Pinterest boards, Google Drive folders, or any other reference photos here..."
                    value={questionnaireData.style_vibe.pinterest_link}
                    onChange={(e) =>
                      updateQData(
                        "style_vibe",
                        "pinterest_link",
                        e.target.value,
                      )
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Photo & Video Details
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  What are the most important moments we should capture?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-3">
                  <Label>Do you want a First Look before the ceremony? *</Label>
                  <RadioGroup
                    value={questionnaireData.photo_video.first_look}
                    onValueChange={(v) =>
                      updateQData("photo_video", "first_look", v)
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Yes" id="fl-yes" />
                      <Label htmlFor="fl-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="No" id="fl-no" />
                      <Label htmlFor="fl-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Must-Have Photos *</Label>
                  <Textarea
                    required
                    placeholder="e.g., veil shot, flat lay, family groupings"
                    value={questionnaireData.photo_video.must_have_photos}
                    onChange={(e) =>
                      updateQData(
                        "photo_video",
                        "must_have_photos",
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Must-Have Video Moments *</Label>
                  <Textarea
                    required
                    value={
                      questionnaireData.photo_video.must_have_video_moments
                    }
                    onChange={(e) =>
                      updateQData(
                        "photo_video",
                        "must_have_video_moments",
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-3">
                  <Label>Do you want audio of vows/toasts included? *</Label>
                  <RadioGroup
                    value={questionnaireData.photo_video.audio_vows_toasts}
                    onValueChange={(v) =>
                      updateQData("photo_video", "audio_vows_toasts", v)
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Yes" id="audio-yes" />
                      <Label htmlFor="audio-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="No" id="audio-no" />
                      <Label htmlFor="audio-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Any photography restrictions at your venue?</Label>
                  <Textarea
                    value={
                      questionnaireData.photo_video.photography_restrictions
                    }
                    onChange={(e) =>
                      updateQData(
                        "photo_video",
                        "photography_restrictions",
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Any special photo locations planned?</Label>
                  <Textarea
                    value={
                      questionnaireData.photo_video.special_photo_locations
                    }
                    onChange={(e) =>
                      updateQData(
                        "photo_video",
                        "special_photo_locations",
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Is there anything you don't want captured?</Label>
                  <Textarea
                    value={questionnaireData.photo_video.dont_want_captured}
                    onChange={(e) =>
                      updateQData(
                        "photo_video",
                        "dont_want_captured",
                        e.target.value,
                      )
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Family Details
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Help us understand your family dynamics for smooth portraits.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label>Bride's Parents' Names</Label>
                  <Input
                    value={questionnaireData.family_details.bride_parents_names}
                    onChange={(e) =>
                      updateQData(
                        "family_details",
                        "bride_parents_names",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Groom's Parents' Names</Label>
                  <Input
                    value={questionnaireData.family_details.groom_parents_names}
                    onChange={(e) =>
                      updateQData(
                        "family_details",
                        "groom_parents_names",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Family Members to Prioritize in Photos</Label>
                  <Textarea
                    value={
                      questionnaireData.family_details
                        .family_members_to_prioritize
                    }
                    onChange={(e) =>
                      updateQData(
                        "family_details",
                        "family_members_to_prioritize",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Any Sensitive Family Situations?</Label>
                  <Textarea
                    placeholder="divorces, deaths, etc."
                    value={
                      questionnaireData.family_details
                        .sensitive_family_situations
                    }
                    onChange={(e) =>
                      updateQData(
                        "family_details",
                        "sensitive_family_situations",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact (on wedding day)</Label>
                  <Input
                    value={questionnaireData.family_details.emergency_contact}
                    onChange={(e) =>
                      updateQData(
                        "family_details",
                        "emergency_contact",
                        e.target.value,
                      )
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Wedding Party & Traditions
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Who's standing by your side and what traditions are you
                  honoring?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label>Wedding Party Size *</Label>
                  <Input
                    required
                    placeholder="e.g., 5 bridesmaids, 5 groomsmen"
                    value={questionnaireData.wedding_party.wedding_party_size}
                    onChange={(e) =>
                      updateQData(
                        "wedding_party",
                        "wedding_party_size",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Special Traditions or Events</Label>
                  <Textarea
                    placeholder="first look, cultural rituals, etc."
                    value={
                      questionnaireData.wedding_party.special_traditions_events
                    }
                    onChange={(e) =>
                      updateQData(
                        "wedding_party",
                        "special_traditions_events",
                        e.target.value,
                      )
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 5 && (
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Wedding Day Timeline
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Please provide your detailed timeline (e.g., Hair/Makeup
                  start, First Look, Ceremony, Reception events).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-3">
                  {timelineEvents.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 bg-[#faf7f2] p-3 rounded-lg border border-[#c9a96e]/20"
                    >
                      <div className="w-1/3">
                        <Label htmlFor={`time-${index}`} className="sr-only">
                          Time
                        </Label>
                        <Input
                          id={`time-${index}`}
                          type="time"
                          placeholder="e.g. 12:00"
                          value={item.time}
                          onChange={(e) => {
                            const newEvents = [...timelineEvents];
                            newEvents[index].time = e.target.value;
                            setTimelineEvents(newEvents);
                          }}
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={`event-${index}`} className="sr-only">
                          Event Description
                        </Label>
                        <Input
                          id={`event-${index}`}
                          placeholder="e.g. Photographer Arrives"
                          value={item.event}
                          onChange={(e) => {
                            const newEvents = [...timelineEvents];
                            newEvents[index].event = e.target.value;
                            setTimelineEvents(newEvents);
                          }}
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0"
                        onClick={() => {
                          const newEvents = [...timelineEvents];
                          newEvents.splice(index, 1);
                          setTimelineEvents(newEvents);
                        }}
                        disabled={timelineEvents.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#1a1a1a]/30 text-[#1a1a1a] hover:bg-[#c9a96e]/15"
                  onClick={() =>
                    setTimelineEvents([
                      ...timelineEvents,
                      { time: "", event: "" },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Event
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 6 && (
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Additional Details
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Any final thoughts or quick references we need.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-3">
                  <Label htmlFor="vipNames" className="text-base font-semibold">
                    VIPs & Family Names (Quick List)
                  </Label>
                  <Textarea
                    id="vipNames"
                    placeholder="Parents of the Bride: John & Jane Doe&#10;Maid of Honor: Sarah Smith&#10;..."
                    className="min-h-[120px]"
                    value={vipNames}
                    onChange={(e) => setVipNames(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="vendors" className="text-base font-semibold">
                    Other Vendors
                  </Label>
                  <Textarea
                    id="vendors"
                    placeholder="Planner: @bestweddingplanner (planner@email.com)&#10;DJ: DJ Awesome&#10;..."
                    className="min-h-[120px]"
                    value={vendors}
                    onChange={(e) => setVendors(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <Label
                    htmlFor="specialRequests"
                    className="text-base font-semibold"
                  >
                    Special Requests & Notes
                  </Label>
                  <Textarea
                    id="specialRequests"
                    placeholder="We are doing a private last dance! Also, please make sure to get a photo of my grandmother's brooch on the bouquet."
                    className="min-h-[120px]"
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0 || submitting}
            >
              Back
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveProgress}
                disabled={isSaving || submitting}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Progress
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button
                  type="button"
                  className="bg-[#1a1a1a] hover:bg-[#1a1a1a]/90 text-white"
                  onClick={() =>
                    setCurrentStep((prev) =>
                      Math.min(steps.length - 1, prev + 1),
                    )
                  }
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="bg-[#1a1a1a] hover:bg-[#1a1a1a]/90 text-white"
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Submit Details
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  };

  // Use company timezone for "today" to ensure consistent date comparisons
  const nowInTz = new Date(
    new Date().toLocaleString("en-US", { timeZone: getCompanyTimezone() }),
  );
  const today = new Date(
    nowInTz.getFullYear(),
    nowInTz.getMonth(),
    nowInTz.getDate(),
  );

  const isPast = wedding.date ? getSafeDate(wedding.date) < today : false;
  const daysUntil = wedding.date
    ? Math.ceil(
        (getSafeDate(wedding.date).getTime() - today.getTime()) /
          (1000 * 3600 * 24),
      )
    : null;

  const firstInvoiceDate = invoicesData?.pastInvoices?.length
    ? [...invoicesData.pastInvoices].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )[0].date
    : null;
  const contractDate = wedding.contract_date
    ? formatDisplayDate(wedding.contract_date)
    : firstInvoiceDate
      ? formatDisplayDate(firstInvoiceDate)
      : formatDisplayDate(wedding.created_at || new Date().toISOString());

  const journeySteps = [
    {
      id: "booked",
      label: "Booked",
      description: "Welcome!",
      icon: CheckCircle,
      isCompleted: true,
    },
    {
      id: "planning",
      label: "Planning",
      description: "Details & Timeline",
      icon: FileText,
      isCompleted: !!wedding.questionnaire_completed,
    },
    {
      id: "wedding",
      label: "Wedding Day",
      description: wedding.date
        ? getSafeDate(wedding.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "TBD",
      icon: Heart,
      isCompleted: isPast,
    },
    {
      id: "editing",
      label: "In Editing",
      description: "Crafting your media",
      icon: Video,
      isCompleted:
        !!(
          wedding.gallery_link ||
          wedding.vimeo_link ||
          wedding.youtube_link
        ) ||
        ["client_review", "completed"].includes(wedding.editing_status || ""),
    },
    {
      id: "delivered",
      label: "Delivered",
      description: "Media is ready!",
      icon: ImageIcon,
      isCompleted: !!(
        wedding.gallery_link ||
        wedding.vimeo_link ||
        wedding.youtube_link
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf7f2] pb-12 bride-portal">
      {/* Header Banner — Sky & Peach */}
      <div className="bg-gradient-to-b from-[#f7f3ee] via-[#e8ddc8] to-[#c9a96e] py-10 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden rounded-b-[2.5rem] shadow-lg mb-8">
        <div className="absolute top-6 left-6 md:left-8 flex items-center gap-3 z-20">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className="h-8 w-auto object-contain bg-white/30 p-1 rounded-lg backdrop-blur-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_LOGO_URL;
              }}
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-white/40 backdrop-blur-sm flex items-center justify-center font-bold text-[#1a1a1a]">
              {companyName.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-[#1a1a1a] tracking-wide text-sm md:text-base">
            {companyName} Portal
          </span>
        </div>
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#c9a96e]/20 rounded-full blur-3xl" />
        <div className="max-w-4xl mx-auto relative z-10 space-y-4 mt-4">
          <div className="inline-flex items-center justify-center p-4 bg-white/40 rounded-full backdrop-blur-sm border border-white/50 mb-2 shadow-sm">
            <Heart className="h-8 w-8 text-[#1a1a1a] animate-pulse" />
          </div>
          <h1
            className="text-4xl md:text-6xl font-bold tracking-tight text-[#1a1a1a]"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Welcome, {wedding.client_name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-[#1a1a1a]/70 text-lg md:text-xl max-w-2xl mx-auto font-light">
            Your personal wedding portal. Access your questionnaire, timeline,
            and final media all in one beautifully organized place.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-8"
        >
          {/* Icon Grid Navigation — compact, modern, no text truncation */}
          <TabsList
            className={cn(
              "grid gap-2 bg-transparent h-auto p-0 w-full mb-8 shadow-none",
              hasVideo
                ? "grid-cols-4 sm:grid-cols-7"
                : "grid-cols-3 sm:grid-cols-6",
            )}
          >
            {[
              { value: "overview", icon: Calendar, label: "Overview" },
              { value: "questionnaire", icon: FileText, label: "Details" },
              { value: "guide", icon: BookOpen, label: "Guide" },
              { value: "contract", icon: FileSignature, label: "Contract" },
              { value: "financials", icon: ListChecks, label: "Financials" },
              { value: "media", icon: ImageIcon, label: "Media" },
              ...(hasVideo
                ? [{ value: "songs", icon: Music, label: "Songs" }]
                : []),
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white data-[state=active]:border-[#1a1a1a] data-[state=active]:shadow-lg bg-[#f7f3ee]/40 border-[#c9a96e]/50 text-[#1a1a1a] hover:border-[#1a1a1a]/40 hover:bg-[#c9a96e]/20 shadow-sm"
              >
                <tab.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-[10px] sm:text-xs font-medium">
                  {tab.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-6 outline-none">
            {!wedding.questionnaire_completed && (
              <Card className="bg-[#c9a96e]/15 border-[#c9a96e]/40 shadow-sm animate-pulse rounded-2xl">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#1a1a1a] text-white p-3 rounded-full">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">
                        Details Due
                      </h3>
                      <p className="text-sm text-[#1a1a1a]/70">
                        Please complete your wedding questionnaire so we can
                        prepare for your big day.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="bg-[#1a1a1a] hover:bg-[#1a1a1a]/90 text-white rounded-full"
                    onClick={() => setActiveTab("questionnaire")}
                  >
                    Complete Now
                  </Button>
                </CardContent>
              </Card>
            )}

            {hasVideo && !songsSubmitted && (
              <Card className="bg-[#f0e6d2]/25 border-[#c9a96e]/40 shadow-sm rounded-2xl">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#c9a96e]/30 p-3 rounded-full">
                      <Music className="h-6 w-6 text-[#1a1a1a]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">
                        Pick Your Highlight Songs
                      </h3>
                      <p className="text-sm text-[#1a1a1a]/70">
                        Choose the songs for your wedding highlight video so our
                        editors know exactly what to use.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-[#1a1a1a]/30 text-[#1a1a1a] hover:bg-[#f0e6d2]/20 rounded-full"
                    onClick={() => setActiveTab("songs")}
                  >
                    Choose Songs
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Your Wedding Journey
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Follow along as we prepare, capture, and deliver your
                  memories.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-0">
                  {/* Connecting Line (Desktop) */}
                  <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-0.5 bg-[#c9a96e]/30 z-0">
                    <div
                      className="absolute top-0 left-0 h-full bg-[#1a1a1a] transition-all duration-1000"
                      style={{
                        width: `${((journeySteps.filter((s) => s.isCompleted).length - 1) / (journeySteps.length - 1)) * 100}%`,
                      }}
                    />
                  </div>
                  {/* Connecting Line (Mobile) */}
                  <div className="md:hidden absolute top-6 bottom-6 left-[23px] w-0.5 bg-[#c9a96e]/30 z-0">
                    <div
                      className="absolute top-0 left-0 w-full bg-[#1a1a1a] transition-all duration-1000"
                      style={{
                        height: `${((journeySteps.filter((s) => s.isCompleted).length - 1) / (journeySteps.length - 1)) * 100}%`,
                      }}
                    />
                  </div>

                  {journeySteps.map((step, index) => {
                    const isActive =
                      !step.isCompleted &&
                      (index === 0 || journeySteps[index - 1].isCompleted);
                    return (
                      <div
                        key={step.id}
                        className="relative z-10 flex md:flex-col items-center gap-4 md:gap-3 w-full md:w-1/5 text-left md:text-center group"
                      >
                        {/* Icon Circle */}
                        <div
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 shrink-0",
                            step.isCompleted
                              ? "bg-[#1a1a1a] border-[#c9a96e]/30 text-white shadow-lg"
                              : isActive
                                ? "bg-white border-[#1a1a1a] text-[#1a1a1a] shadow-[0_0_15px_rgba(26,26,26,0.3)] animate-pulse"
                                : "bg-[#f7f3ee] border-[#c9a96e]/30 text-[#1a1a1a]/50",
                          )}
                        >
                          <step.icon className="w-6 h-6" />
                        </div>
                        {/* Text */}
                        <div>
                          <h4
                            className={cn(
                              "font-semibold text-sm md:text-base",
                              step.isCompleted || isActive
                                ? "text-[#1a1a1a]"
                                : "text-[#1a1a1a]/50",
                            )}
                          >
                            {step.label}
                          </h4>
                          <p className="text-xs text-[#1a1a1a]/50 mt-0.5">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
                  <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                    <CardTitle
                      className="text-[#1a1a1a]"
                      style={{ fontFamily: "'DM Serif Display', serif" }}
                    >
                      Wedding Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-4 bg-[#faf7f2] p-4 rounded-xl border border-[#c9a96e]/20">
                      <div className="bg-[#c9a96e]/30 p-3 rounded-full">
                        <Calendar className="h-6 w-6 text-[#1a1a1a]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1a1a1a]/60 uppercase tracking-wider">
                          Date
                        </p>
                        <p className="text-lg font-semibold text-[#1a1a1a]">
                          {wedding.date
                            ? getSafeDate(wedding.date).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                },
                              )
                            : "TBD"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-[#faf7f2] p-4 rounded-xl border border-[#c9a96e]/20">
                      <div className="bg-[#c9a96e]/30 p-3 rounded-full">
                        <Clock className="h-6 w-6 text-[#1a1a1a]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1a1a1a]/60 uppercase tracking-wider">
                          Countdown
                        </p>
                        <p className="text-lg font-semibold text-[#1a1a1a]">
                          {isPast
                            ? "Happily Married!"
                            : daysUntil !== null
                              ? `${daysUntil} days to go!`
                              : "TBD"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-[#faf7f2] p-4 rounded-xl border border-[#c9a96e]/20">
                      <div className="bg-[#c9a96e]/30 p-3 rounded-full">
                        <CheckCircle className="h-6 w-6 text-[#1a1a1a]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1a1a1a]/60 uppercase tracking-wider">
                          Questionnaire Status
                        </p>
                        <p className="text-lg font-semibold text-[#1a1a1a]">
                          {wedding.questionnaire_completed
                            ? "Completed - Thank you!"
                            : "Action Required - Please complete"}
                        </p>
                      </div>
                    </div>
                    {wedding.package && (
                      <div className="flex items-center gap-4 bg-[#faf7f2] p-4 rounded-xl border border-[#c9a96e]/20">
                        <div className="bg-[#c9a96e]/30 p-3 rounded-full">
                          <Sparkles className="h-6 w-6 text-[#1a1a1a]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1a1a1a]/60 uppercase tracking-wider">
                            Your Package
                          </p>
                          <p className="text-lg font-semibold text-[#1a1a1a]">
                            {wedding.package}
                          </p>
                          {wedding.addons && wedding.addons.length > 0 && (
                            <p className="text-sm mt-1 text-[#1a1a1a]/70">
                              <span className="font-medium">Addons:</span>{" "}
                              {Array.isArray(wedding.addons)
                                ? wedding.addons.join(", ")
                                : wedding.addons}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="md:col-span-1 space-y-6">
                {teamMembers.length > 0 ? (
                  <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
                    <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20 pb-4">
                      <CardTitle
                        className="flex items-center gap-2 text-lg text-[#1a1a1a]"
                        style={{ fontFamily: "'DM Serif Display', serif" }}
                      >
                        <Users className="h-5 w-5 text-[#1a1a1a]" />
                        Your Team
                      </CardTitle>
                      <CardDescription className="text-[#1a1a1a]/60">
                        Assigned to capture your big day.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 pb-4 px-4 space-y-3">
                      {teamMembers.map((member, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 border border-[#c9a96e]/20 rounded-xl bg-[#faf7f2] hover:shadow-md hover:border-[#1a1a1a]/30 hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer"
                          onClick={() =>
                            setSelectedContractor(member.contractor)
                          }
                        >
                          <Avatar className="h-10 w-10 border group-hover:border-[#1a1a1a]/50 transition-colors">
                            <AvatarImage
                              src={member.contractor.avatar_url || ""}
                            />
                            <AvatarFallback className="bg-[#c9a96e]/30 text-[#1a1a1a] text-xs group-hover:bg-[#1a1a1a] group-hover:text-white transition-colors">
                              {member.contractor.first_name?.[0]}
                              {member.contractor.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-[#1a1a1a] text-sm group-hover:text-[#1a1a1a] transition-colors">
                              {member.contractor.first_name}{" "}
                              {member.contractor.last_name}
                            </p>
                            <p className="text-xs text-[#1a1a1a]/60 capitalize">
                              {member.role.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
                    <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20 pb-4">
                      <CardTitle
                        className="flex items-center gap-2 text-lg text-[#1a1a1a]"
                        style={{ fontFamily: "'DM Serif Display', serif" }}
                      >
                        <Users className="h-5 w-5 text-[#1a1a1a]" />
                        Your Team
                      </CardTitle>
                      <CardDescription className="text-[#1a1a1a]/60">
                        Assigned to capture your big day.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 pb-6 px-4 text-center">
                      <div className="bg-[#c9a96e]/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="h-6 w-6 text-[#1a1a1a]" />
                      </div>
                      <p className="text-sm text-[#1a1a1a]/60 leading-relaxed">
                        Our team is currently putting together your schedule and
                        someone will be added to your wedding soon!
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
                  <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20 pb-4">
                    <CardTitle
                      className="text-lg text-[#1a1a1a]"
                      style={{ fontFamily: "'DM Serif Display', serif" }}
                    >
                      Quick Links
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <Button
                      variant="outline"
                      className="w-full justify-start relative h-auto py-3 px-4 rounded-xl hover:bg-[#c9a96e]/15 hover:text-[#1a1a1a] transition-colors border-[#c9a96e]/40 text-[#1a1a1a] bg-[#faf7f2]"
                      onClick={() => setContactModalOpen(true)}
                    >
                      <MessageSquare className="h-5 w-5 mr-3 text-[#1a1a1a] shrink-0" />
                      <div className="text-left">
                        <div className="font-semibold text-sm">
                          Send Message
                        </div>
                        <div className="text-xs text-[#1a1a1a]/60 font-normal">
                          Chat with your managers
                        </div>
                      </div>
                      {messages.filter((m) => m.receiver_id === id && !m.read)
                        .length > 0 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#1a1a1a] text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                          {
                            messages.filter(
                              (m) => m.receiver_id === id && !m.read,
                            ).length
                          }
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-auto py-3 px-4 rounded-xl hover:bg-[#c9a96e]/15 hover:text-[#1a1a1a] transition-colors border-[#c9a96e]/40 text-[#1a1a1a] bg-[#faf7f2]"
                      onClick={() => setActiveTab("questionnaire")}
                    >
                      <FileText className="h-5 w-5 mr-3 text-[#1a1a1a] shrink-0" />
                      <div className="text-left">
                        <div className="font-semibold text-sm">
                          Edit Questionnaire
                        </div>
                        <div className="text-xs text-[#1a1a1a]/60 font-normal">
                          Update your details
                        </div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-auto py-3 px-4 rounded-xl hover:bg-[#c9a96e]/15 hover:text-[#1a1a1a] transition-colors border-[#c9a96e]/40 text-[#1a1a1a] bg-[#faf7f2]"
                      onClick={() => setActiveTab("media")}
                    >
                      <ImageIcon className="h-5 w-5 mr-3 text-[#1a1a1a] shrink-0" />
                      <div className="text-left">
                        <div className="font-semibold text-sm">View Media</div>
                        <div className="text-xs text-[#1a1a1a]/60 font-normal">
                          See your final gallery
                        </div>
                      </div>
                    </Button>
                    {hasVideo && (
                      <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-3 px-4 rounded-xl hover:bg-[#c9a96e]/15 hover:text-[#1a1a1a] transition-colors border-[#c9a96e]/40 text-[#1a1a1a] bg-[#faf7f2]"
                        onClick={() => setActiveTab("songs")}
                      >
                        <Music className="h-5 w-5 mr-3 text-[#1a1a1a] shrink-0" />
                        <div className="text-left">
                          <div className="font-semibold text-sm">
                            Highlight Songs
                          </div>
                          <div className="text-xs text-[#1a1a1a]/60 font-normal">
                            Pick your video songs
                          </div>
                        </div>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="questionnaire" className="outline-none">
            {renderQuestionnaire()}
          </TabsContent>

          <TabsContent value="guide" className="outline-none space-y-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2
                className="text-3xl md:text-4xl font-semibold mb-4 text-[#1a1a1a]"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Wedding Planning Guide
              </h2>
              <p className="text-[#1a1a1a]/60 text-lg md:text-xl font-light">
                Everything you need to know to prepare for your big day, from
                timeline tips to photo prep.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Card 1 */}
              <Dialog>
                <DialogTrigger asChild>
                  <Card className="group cursor-pointer rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 bg-card flex flex-col h-full">
                    <div className="h-48 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/c30d93b6-1e31-4f83-89b8-f19bb5da9b67.png')] bg-cover bg-center group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-sm text-pink-500">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    </div>
                    <CardHeader className="pt-6 pb-4 flex-1">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        Engagement Session Prep
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm line-clamp-3 leading-relaxed">
                        What to wear, how to choose a location, and tips for
                        feeling natural in front of the camera.
                      </CardDescription>
                    </CardHeader>
                    <div className="px-6 pb-6 mt-auto">
                      <div className="flex items-center text-sm font-semibold text-primary">
                        Read Guide{" "}
                        <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-3xl rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl">
                  <div className="h-64 relative">
                    <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/c30d93b6-1e31-4f83-89b8-f19bb5da9b67.png')] bg-cover bg-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-6 left-8 right-8 text-white">
                      <div className="bg-white/20 backdrop-blur-md w-fit p-2 rounded-full mb-4">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <DialogTitle className="text-3xl md:text-4xl font-serif text-white [text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
                        Engagement Session Prep
                      </DialogTitle>
                    </div>
                  </div>
                  <div className="p-8 md:p-10 space-y-8 max-h-[60vh] overflow-y-auto">
                    <div className="prose prose-sm md:prose-base text-muted-foreground max-w-none">
                      <h3 className="text-foreground font-semibold text-xl border-b pb-2">
                        What to Wear
                      </h3>
                      <p className="leading-relaxed">
                        We recommend bringing two outfits: one casual and one
                        dressy. Avoid neon colors, large logos, and overly busy
                        patterns. Stick to solid colors, earth tones, or soft
                        pastels that complement your location. Most importantly,
                        wear something you feel confident and comfortable in!
                      </p>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        Choosing a Location
                      </h3>
                      <p className="leading-relaxed">
                        Think about places that are meaningful to your
                        relationship—where you had your first date, your
                        favorite park, or a coffee shop you frequent. If you're
                        unsure, we can suggest beautiful outdoor spots with
                        great natural light.
                      </p>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        Feeling Natural
                      </h3>
                      <p className="leading-relaxed">
                        It's completely normal to feel nervous! Our goal is to
                        capture your genuine connection. We'll guide you through
                        prompts rather than stiff poses, so just focus on each
                        other, laugh, and have fun.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Card 2 */}
              <Dialog>
                <DialogTrigger asChild>
                  <Card className="group cursor-pointer rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 bg-card flex flex-col h-full">
                    <div className="h-48 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/c6a44d30-6cc0-4373-a39a-5bb770c44d68.png')] bg-cover bg-center group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-sm text-blue-500">
                        <Clock className="h-5 w-5" />
                      </div>
                    </div>
                    <CardHeader className="pt-6 pb-4 flex-1">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        Building Your Timeline
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm line-clamp-3 leading-relaxed">
                        How much time to allocate for hair & makeup, portraits,
                        family formals, and more.
                      </CardDescription>
                    </CardHeader>
                    <div className="px-6 pb-6 mt-auto">
                      <div className="flex items-center text-sm font-semibold text-primary">
                        Read Guide{" "}
                        <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-3xl rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl">
                  <div className="h-64 relative">
                    <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/c6a44d30-6cc0-4373-a39a-5bb770c44d68.png')] bg-cover bg-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-6 left-8 right-8 text-white">
                      <div className="bg-white/20 backdrop-blur-md w-fit p-2 rounded-full mb-4">
                        <Clock className="h-6 w-6 text-white" />
                      </div>
                      <DialogTitle className="text-3xl md:text-4xl font-serif text-white [text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
                        Building Your Timeline
                      </DialogTitle>
                    </div>
                  </div>
                  <div className="p-8 md:p-10 space-y-8 max-h-[60vh] overflow-y-auto">
                    <div className="prose prose-sm md:prose-base text-muted-foreground max-w-none">
                      <h3 className="text-foreground font-semibold text-xl border-b pb-2">
                        General Time Guidelines
                      </h3>
                      <ul className="list-disc pl-5 space-y-3 mt-4">
                        <li>
                          <strong className="text-foreground">
                            Details & Prep:
                          </strong>{" "}
                          1.5 - 2 hours (capturing the dress, rings,
                          invitations, and final touch-ups)
                        </li>
                        <li>
                          <strong className="text-foreground">
                            First Look & Couples Portraits:
                          </strong>{" "}
                          45 - 60 minutes
                        </li>
                        <li>
                          <strong className="text-foreground">
                            Wedding Party Photos:
                          </strong>{" "}
                          30 - 45 minutes
                        </li>
                        <li>
                          <strong className="text-foreground">
                            Family Formals:
                          </strong>{" "}
                          30 minutes (plan for about 3 minutes per group)
                        </li>
                        <li>
                          <strong className="text-foreground">
                            Buffer Time:
                          </strong>{" "}
                          Always add 30 minutes of "hide away" time before the
                          ceremony as guests arrive.
                        </li>
                      </ul>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        Golden Hour
                      </h3>
                      <p className="leading-relaxed">
                        Don't forget to schedule 15-20 minutes during sunset for
                        those magical golden hour portraits. Check the sunset
                        time for your wedding date and plan to sneak out during
                        dinner or right after!
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Card 3 */}
              <Dialog>
                <DialogTrigger asChild>
                  <Card className="group cursor-pointer rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 bg-card flex flex-col h-full">
                    <div className="h-48 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/940d7fbf-5da1-4c7b-9032-e593e71ad60f.png')] bg-cover bg-center group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-sm text-purple-500">
                        <Heart className="h-5 w-5" />
                      </div>
                    </div>
                    <CardHeader className="pt-6 pb-4 flex-1">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        First Look vs. Traditional
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm line-clamp-3 leading-relaxed">
                        Weighing the pros and cons of seeing each other before
                        the ceremony.
                      </CardDescription>
                    </CardHeader>
                    <div className="px-6 pb-6 mt-auto">
                      <div className="flex items-center text-sm font-semibold text-primary">
                        Read Guide{" "}
                        <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-3xl rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl">
                  <div className="h-64 relative">
                    <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/940d7fbf-5da1-4c7b-9032-e593e71ad60f.png')] bg-cover bg-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-6 left-8 right-8 text-white">
                      <div className="bg-white/20 backdrop-blur-md w-fit p-2 rounded-full mb-4">
                        <Heart className="h-6 w-6 text-white" />
                      </div>
                      <DialogTitle className="text-3xl md:text-4xl font-serif text-white [text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
                        First Look vs. Traditional
                      </DialogTitle>
                    </div>
                  </div>
                  <div className="p-8 md:p-10 space-y-8 max-h-[60vh] overflow-y-auto">
                    <div className="prose prose-sm md:prose-base text-muted-foreground max-w-none">
                      <h3 className="text-foreground font-semibold text-xl border-b pb-2">
                        The First Look
                      </h3>
                      <p className="leading-relaxed">
                        <strong className="text-foreground">Pros:</strong> You
                        get a private, intimate moment together. It calms nerves
                        before the ceremony. You can knock out all wedding party
                        and couples portraits beforehand, allowing you to
                        actually enjoy your cocktail hour!
                      </p>
                      <p className="leading-relaxed">
                        <strong className="text-foreground">Cons:</strong> You
                        lose the traditional element of seeing each other for
                        the first time at the altar.
                      </p>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        Traditional (Down the Aisle)
                      </h3>
                      <p className="leading-relaxed">
                        <strong className="text-foreground">Pros:</strong> High
                        emotional buildup and keeping with tradition. The
                        reaction at the altar is shared with all your guests.
                      </p>
                      <p className="leading-relaxed">
                        <strong className="text-foreground">Cons:</strong> All
                        photos (couples, wedding party, family) must be squeezed
                        into the cocktail hour, which can feel rushed and means
                        you'll likely miss mingling with your guests.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Card 4 */}
              <Dialog>
                <DialogTrigger asChild>
                  <Card className="group cursor-pointer rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 bg-card flex flex-col h-full">
                    <div className="h-48 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/2b8b4441-0c19-4e72-84da-45b515435f2c.png')] bg-cover bg-center group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-sm text-emerald-500">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>
                    <CardHeader className="pt-6 pb-4 flex-1">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        Family Formals Guide
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm line-clamp-3 leading-relaxed">
                        How to organize family photos efficiently so everyone
                        can get to the party.
                      </CardDescription>
                    </CardHeader>
                    <div className="px-6 pb-6 mt-auto">
                      <div className="flex items-center text-sm font-semibold text-primary">
                        Read Guide{" "}
                        <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-3xl rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl">
                  <div className="h-64 relative">
                    <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/2b8b4441-0c19-4e72-84da-45b515435f2c.png')] bg-cover bg-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-6 left-8 right-8 text-white">
                      <div className="bg-white/20 backdrop-blur-md w-fit p-2 rounded-full mb-4">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <DialogTitle className="text-3xl md:text-4xl font-serif text-white [text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
                        Family Formals Guide
                      </DialogTitle>
                    </div>
                  </div>
                  <div className="p-8 md:p-10 space-y-8 max-h-[60vh] overflow-y-auto">
                    <div className="prose prose-sm md:prose-base text-muted-foreground max-w-none">
                      <p className="text-lg leading-relaxed">
                        Family formals can be chaotic, but with a solid plan, we
                        can fly through them!
                      </p>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        Keep the List Concise
                      </h3>
                      <p className="leading-relaxed">
                        We recommend keeping the formal shot list to immediate
                        family and grandparents (approx. 10-15 groupings).
                        Extended family photos are often better captured
                        candidly during the reception or quickly near the dance
                        floor.
                      </p>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        Assign a "Wrangler"
                      </h3>
                      <p className="leading-relaxed">
                        Designate a loud, organized friend or family member who
                        knows everyone's faces to help us call out names. This
                        speeds up the process tremendously!
                      </p>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        Sample List Structure
                      </h3>
                      <ul className="list-disc pl-5 mt-4 space-y-2">
                        <li>B&G with Bride's Extended Family</li>
                        <li>
                          B&G with Bride's Immediate Family & Grandparents
                        </li>
                        <li>B&G with Bride's Parents</li>
                        <li>(Repeat for Groom's side)</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Card 5 */}
              <Dialog>
                <DialogTrigger asChild>
                  <Card className="group cursor-pointer rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 bg-card flex flex-col h-full">
                    <div className="h-48 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/079b091d-e932-476f-ae2f-2c96f187720f.png')] bg-cover bg-center group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-sm text-amber-500">
                        <Camera className="h-5 w-5" />
                      </div>
                    </div>
                    <CardHeader className="pt-6 pb-4 flex-1">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        Details & Flat Lays
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm line-clamp-3 leading-relaxed">
                        What to pack in your "details box" for those beautiful
                        morning shots.
                      </CardDescription>
                    </CardHeader>
                    <div className="px-6 pb-6 mt-auto">
                      <div className="flex items-center text-sm font-semibold text-primary">
                        Read Guide{" "}
                        <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-3xl rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl">
                  <div className="h-64 relative">
                    <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/079b091d-e932-476f-ae2f-2c96f187720f.png')] bg-cover bg-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-6 left-8 right-8 text-white">
                      <div className="bg-white/20 backdrop-blur-md w-fit p-2 rounded-full mb-4">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                      <DialogTitle className="text-3xl md:text-4xl font-serif text-white [text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
                        Details & Flat Lays
                      </DialogTitle>
                    </div>
                  </div>
                  <div className="p-8 md:p-10 space-y-8 max-h-[60vh] overflow-y-auto">
                    <div className="prose prose-sm md:prose-base text-muted-foreground max-w-none">
                      <p className="leading-relaxed">
                        To ensure we get stunning photos of your wedding
                        details, gather all these items into a shoebox or bag
                        the week before the wedding. Hand this box to us as soon
                        as we arrive!
                      </p>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        What to Include:
                      </h3>
                      <ul className="list-disc pl-5 space-y-3 mt-4">
                        <li>
                          <strong className="text-foreground">
                            All three rings
                          </strong>{" "}
                          (engagement ring and both wedding bands)
                        </li>
                        <li>
                          Full invitation suite (including envelopes and
                          save-the-dates)
                        </li>
                        <li>Shoes, jewelry, and hair pieces</li>
                        <li>Perfume/Cologne Bottles</li>
                        <li>Vow books</li>
                        <li>Any heirlooms or special items</li>
                        <li>
                          Loose florals from your florist (ask them to leave a
                          few extra blooms and greenery!)
                        </li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Card 6 */}
              <Dialog>
                <DialogTrigger asChild>
                  <Card className="group cursor-pointer rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 bg-card flex flex-col h-full">
                    <div className="h-48 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/6344f7d8-1408-4889-a044-8147b2f78151.png')] bg-cover bg-center group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-sm text-slate-500">
                        <Smartphone className="h-5 w-5" />
                      </div>
                    </div>
                    <CardHeader className="pt-6 pb-4 flex-1">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        Unplugged Ceremonies
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm line-clamp-3 leading-relaxed">
                        Why you should ask guests to put their phones away
                        during the ceremony.
                      </CardDescription>
                    </CardHeader>
                    <div className="px-6 pb-6 mt-auto">
                      <div className="flex items-center text-sm font-semibold text-primary">
                        Read Guide{" "}
                        <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-3xl rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl">
                  <div className="h-64 relative">
                    <div className="absolute inset-0 bg-[url('https://vibe.filesafe.space/1785896143476160753/assets/6344f7d8-1408-4889-a044-8147b2f78151.png')] bg-cover bg-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-6 left-8 right-8 text-white">
                      <div className="bg-white/20 backdrop-blur-md w-fit p-2 rounded-full mb-4">
                        <Smartphone className="h-6 w-6 text-white" />
                      </div>
                      <DialogTitle className="text-3xl md:text-4xl font-serif text-white [text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
                        Unplugged Ceremonies
                      </DialogTitle>
                    </div>
                  </div>
                  <div className="p-8 md:p-10 space-y-8 max-h-[60vh] overflow-y-auto">
                    <div className="prose prose-sm md:prose-base text-muted-foreground max-w-none">
                      <p className="leading-relaxed">
                        We highly recommend having an "unplugged" ceremony! This
                        means asking guests to turn off their phones and cameras
                        and simply be present with you.
                      </p>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        Why is this important?
                      </h3>
                      <ul className="list-disc pl-5 space-y-3 mt-4">
                        <li>
                          <strong className="text-foreground">
                            Better Photos:
                          </strong>{" "}
                          When you look back at your ceremony photos, you'll see
                          the smiling, crying, emotional faces of your loved
                          ones—not a sea of iPhones and iPads blocking their
                          faces.
                        </li>
                        <li>
                          <strong className="text-foreground">
                            No Ruined Shots:
                          </strong>{" "}
                          Eager guests often step into the aisle right as the
                          bride is walking down or during the first kiss,
                          blocking our professional cameras completely.
                        </li>
                        <li>
                          <strong className="text-foreground">Presence:</strong>{" "}
                          You invited these people to witness your marriage.
                          Give them the gift of being fully present in the
                          moment.
                        </li>
                      </ul>

                      <h3 className="text-foreground font-semibold text-xl border-b pb-2 mt-8">
                        How to do it
                      </h3>
                      <p className="leading-relaxed">
                        Have your officiant make a quick, friendly announcement
                        right before the processional begins, and place a nice
                        sign at the entrance to your ceremony space.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>

          <TabsContent value="contract" className="outline-none space-y-6">
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle
                    className="text-[#1a1a1a]"
                    style={{ fontFamily: "'DM Serif Display', serif" }}
                  >
                    Service Agreement
                  </CardTitle>
                  <CardDescription className="text-[#1a1a1a]/60">
                    Review your signed wedding photography & videography
                    contract.
                  </CardDescription>
                </div>
                <Button
                  onClick={async () => {
                    const element = document.getElementById(
                      "contract-pdf-content",
                    );
                    if (!element) return;

                    // Temporarily remove height constraints for full capture
                    const originalMaxHeight = element.style.maxHeight;
                    const originalOverflow = element.style.overflow;
                    element.style.maxHeight = "none";
                    element.style.overflow = "visible";

                    try {
                      const canvas = await html2canvas(element, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: "#ffffff",
                      });
                      const imgData = canvas.toDataURL("image/png");
                      const pdf = new jsPDF("p", "mm", "a4");
                      const pdfWidth = pdf.internal.pageSize.getWidth();
                      const pdfHeight =
                        (canvas.height * pdfWidth) / canvas.width;

                      // If content is taller than one page, it will just scale down to fit on one page
                      // or we can add multiple pages, but scaling down is easiest for now.
                      // Actually, let's just let it scale or paginate.
                      // A simple approach is just scaling it to fit the width, and if it exceeds height, it runs off the page.
                      // For a contract, we should probably handle multiple pages if it's very long, but let's see.
                      if (pdfHeight > pdf.internal.pageSize.getHeight()) {
                        // Add new pages as needed
                        let heightLeft = pdfHeight;
                        let position = 0;

                        pdf.addImage(
                          imgData,
                          "PNG",
                          0,
                          position,
                          pdfWidth,
                          pdfHeight,
                        );
                        heightLeft -= pdf.internal.pageSize.getHeight();

                        while (heightLeft >= 0) {
                          position = heightLeft - pdfHeight;
                          pdf.addPage();
                          pdf.addImage(
                            imgData,
                            "PNG",
                            0,
                            position,
                            pdfWidth,
                            pdfHeight,
                          );
                          heightLeft -= pdf.internal.pageSize.getHeight();
                        }
                      } else {
                        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
                      }

                      pdf.save(
                        `${wedding?.client_name?.replace(/\s+/g, "_") || "Wedding"}_Contract.pdf`,
                      );
                    } catch (error) {
                      console.error("Error generating PDF", error);
                    } finally {
                      // Restore original styles
                      element.style.maxHeight = originalMaxHeight || "";
                      element.style.overflow = originalOverflow || "";
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <div
                  id="contract-pdf-content"
                  className="border border-stone-200 dark:border-stone-800 rounded-3xl p-8 sm:p-12 max-h-[600px] overflow-y-auto bg-white dark:bg-stone-900/30 text-sm space-y-8 contract-content shadow-inner text-stone-900 dark:text-stone-100"
                >
                  <h2 className="text-2xl font-serif text-center mb-2 text-stone-900 dark:text-stone-50">
                    Wedding Photography & Videography Agreement
                  </h2>
                  <p className="text-center text-stone-500 dark:text-stone-400 font-light mb-8">
                    ({companyName} — {companyState})
                  </p>

                  <p>
                    This Wedding Agreement ("Agreement") is entered into on{" "}
                    <strong>{contractDate}</strong> by and between:
                  </p>
                  <p>
                    <strong>Client(s):</strong> {wedding.client_name}{" "}
                    {wedding.partner_name ? `& ${wedding.partner_name}` : ""}
                  </p>
                  <p>
                    <strong>Service Provider:</strong> {companyName}, an
                    independently owned and operated limited liability company
                    based in {companyState} ("Photographer/Videographer").
                  </p>

                  <h3 className="text-lg font-serif mt-8">1. Services</h3>
                  <p>
                    {companyName} agrees to provide professional wedding
                    photography and/or videography services for the Client's
                    event as follows:
                  </p>
                  <p>
                    <strong>Wedding Date:</strong>{" "}
                    {formatDisplayDate(wedding.date)}
                  </p>
                  <p>
                    <strong>Venue:</strong> {wedding.location}
                  </p>
                  <p>
                    <strong>Package Booked:</strong>{" "}
                    {wedding.package || "Custom Package"}
                  </p>
                  {wedding.addons &&
                    (Array.isArray(wedding.addons)
                      ? wedding.addons.length > 0
                      : true) && (
                      <p>
                        <strong>Add-ons:</strong>{" "}
                        {Array.isArray(wedding.addons)
                          ? wedding.addons.join(", ")
                          : wedding.addons}
                      </p>
                    )}
                  <p>
                    <strong>Assigned Team:</strong>{" "}
                    {wedding.package?.toLowerCase().includes("photo only")
                      ? "1 Photographer"
                      : wedding.package?.toLowerCase().includes("video only")
                        ? "1 Videographer"
                        : "1 Photographer + 1 Videographer"}{" "}
                    (unless otherwise noted)
                  </p>
                  <p>
                    {companyName} reserves the right to assign qualified
                    creative professionals from its trusted network to ensure
                    timely, high-quality coverage.
                  </p>

                  <h3 className="text-lg font-serif mt-8">2. Deliverables</h3>
                  <p>
                    The Photographer/Videographer agrees to deliver the
                    following:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 mt-2">
                    {!wedding.package?.toLowerCase().includes("video only") && (
                      <li>Professionally edited digital photo gallery</li>
                    )}
                    {!wedding.package?.toLowerCase().includes("photo only") && (
                      <li>
                        Edited wedding film (highlight + optional
                        documentary/full ceremony edits, depending on package)
                      </li>
                    )}
                  </ul>
                  <p className="mt-4">
                    <strong>Delivery Timeline:</strong> Within approximately 3–4
                    weeks following the wedding date. During high-volume months
                    (such as October), timelines may extend slightly to maintain
                    editing quality.
                  </p>

                  <h3 className="text-lg font-serif mt-8">3. Payment Terms</h3>
                  <p>
                    <strong>Total Investment:</strong> $
                    {(wedding.total_amount || 0).toLocaleString()}
                  </p>

                  <p>
                    <strong>Retainer (Non-Refundable):</strong> $
                    {((wedding.total_amount || 0) / 2).toLocaleString()} due
                    upon signing to reserve your wedding date. The retainer is
                    50% of the contract value.
                  </p>

                  <p>
                    <strong>Remaining Balance:</strong> Due no later than 10
                    days before the wedding date.
                  </p>
                  <p>
                    <strong>Accepted Payments:</strong> Credit Card only
                    (processed securely through {companyName}'s online payment
                    system).
                  </p>
                  <p>
                    Payments made via credit card include standard merchant
                    processing fees, which are built into the total investment.
                    <br />
                    Cash, check, or alternative payment methods are not
                    accepted.
                  </p>
                  <p>
                    Failure to make timely payments may result in suspension or
                    cancellation of services and forfeiture of the retainer.
                  </p>

                  <h3 className="text-lg font-serif mt-8">
                    4. Rescheduling & Cancellation
                  </h3>
                  <p>
                    <strong>Rescheduling:</strong> The retainer may be applied
                    to a new wedding date, subject to availability.
                  </p>
                  <p>
                    <strong>Cancellation:</strong> The retainer is
                    non-refundable. Any additional payments made beyond the
                    retainer will be refunded if cancellation occurs.
                  </p>
                  <p>
                    If {companyName} must cancel due to emergency or unforeseen
                    circumstances, all payments made by the Client will be
                    refunded in full, and best efforts will be made to assist in
                    finding an alternate provider.
                  </p>

                  <h3 className="text-lg font-serif mt-8">
                    5. Creative Rights
                  </h3>
                  <p>
                    The Client acknowledges that {companyName} maintains
                    complete creative control over style, editing, and artistic
                    decisions. The Client has reviewed the company's portfolio
                    and understands the creative nature of the work.
                  </p>
                  <p>
                    All photographs and videos remain the copyrighted property
                    of {companyName}, which grants the Client a perpetual,
                    non-exclusive, personal-use license to download, print,
                    share, and display the media for personal use.
                  </p>

                  <h3 className="text-lg font-serif mt-8">
                    6. Substitutions & Liability
                  </h3>
                  <p>
                    If a scheduled Photographer or Videographer is unable to
                    attend due to illness, emergency, or unforeseen event,{" "}
                    {companyName} will provide a qualified replacement whenever
                    possible.
                  </p>
                  <p>
                    {companyName} is not responsible for circumstances beyond
                    reasonable control (e.g., weather, equipment failure, venue
                    restrictions, or interference by guests).
                    <br />
                    Liability is limited to the return of all payments received.
                  </p>

                  <h3 className="text-lg font-serif mt-8">
                    7. Client Cooperation
                  </h3>
                  <p>
                    The Client agrees to provide a safe and cooperative
                    environment for all team members. The Client understands
                    that full cooperation—including adherence to schedules,
                    communication, and participation from key
                    individuals—directly impacts the final quality of results.
                  </p>

                  <h3 className="text-lg font-serif mt-8">8. Model Release</h3>
                  <p>
                    The Client grants {companyName} permission to use images
                    and/or video clips from the event for portfolio, social
                    media, website, and promotional use.
                    <br />
                    (Optional: Clients may request in writing to opt out prior
                    to the wedding date.)
                  </p>

                  <h3 className="text-lg font-serif mt-8">
                    9. Entire Agreement
                  </h3>
                  <p>
                    This Agreement represents the full understanding between the
                    Client and {companyName}. Any modifications or additions
                    must be made in writing and signed by both parties.
                  </p>

                  <div className="mt-12 pt-8 border-t border-stone-200 dark:border-stone-800 flex justify-between items-end">
                    <div>
                      <p className="text-sm text-stone-500 mb-2">
                        Client(s) Signature:
                      </p>
                      <p className="text-2xl font-serif italic text-stone-900 dark:text-stone-50">
                        {wedding.client_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-stone-500 mb-2">Date:</p>
                      <p className="text-sm font-medium">{contractDate}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="financials" className="outline-none space-y-6">
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Financial Overview
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Review your payment plan and outstanding balance.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl h-12 gap-2 border-[#1a1a1a]/30 text-[#1a1a1a] hover:bg-[#c9a96e]/15"
                    onClick={() => {
                      const giftUrl = `${window.location.origin}/gift/${id}`;
                      const fallbackCopy = () => {
                        const ta = document.createElement("textarea");
                        ta.value = giftUrl;
                        document.body.appendChild(ta);
                        ta.select();
                        try {
                          document.execCommand("copy");
                        } catch {}
                        document.body.removeChild(ta);
                        toast({
                          title: "Gift Link Copied!",
                          description:
                            "Share this link with family and friends to help fund your wedding media.",
                        });
                      };
                      try {
                        if (navigator.clipboard && window.isSecureContext) {
                          navigator.clipboard
                            .writeText(giftUrl)
                            .then(() => {
                              toast({
                                title: "Gift Link Copied!",
                                description:
                                  "Share this link with family and friends to help fund your wedding media.",
                              });
                            })
                            .catch(fallbackCopy);
                        } else {
                          fallbackCopy();
                        }
                      } catch {
                        fallbackCopy();
                      }
                    }}
                  >
                    <Gift className="h-4 w-4" />
                    Share Gift Link
                  </Button>
                  <Button
                    className="flex-1 rounded-xl h-12 gap-2 shadow-md font-medium bg-[#1a1a1a] hover:bg-[#1a1a1a]/90 text-white"
                    onClick={handleManagePayments}
                    disabled={isManagingPayments}
                  >
                    {isManagingPayments ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Manage Payment Methods
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-[#c9a96e]/15 rounded-xl p-6 border border-[#c9a96e]/30 flex flex-col items-center justify-center text-center">
                    <span className="text-[#1a1a1a]/60 text-sm font-medium mb-1">
                      Total Investment
                    </span>
                    <span className="text-3xl font-bold text-[#1a1a1a]">
                      ${(wedding.total_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-emerald-500/10 rounded-xl p-6 border border-emerald-500/20 flex flex-col items-center justify-center text-center">
                    <span className="text-[#1a1a1a]/60 text-sm font-medium mb-1">
                      Amount Paid
                    </span>
                    <span className="text-3xl font-bold text-emerald-600">
                      $
                      {(invoicesData
                        ? Math.max(
                            wedding.paid_amount || 0,
                            invoicesData.pastInvoices.reduce(
                              (sum: number, inv: any) => sum + inv.amount,
                              0,
                            ),
                          )
                        : wedding.paid_amount || 0
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-red-500/10 rounded-xl p-6 border border-red-500/20 flex flex-col items-center justify-center text-center">
                    <span className="text-[#1a1a1a]/60 text-sm font-medium mb-1">
                      Remaining Balance
                    </span>
                    <span className="text-3xl font-bold text-red-600">
                      $
                      {Math.max(
                        0,
                        (wedding.total_amount || 0) -
                          (invoicesData
                            ? Math.max(
                                wedding.paid_amount || 0,
                                invoicesData.pastInvoices.reduce(
                                  (sum: number, inv: any) => sum + inv.amount,
                                  0,
                                ),
                              )
                            : wedding.paid_amount || 0),
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">
                    Payment Schedule
                  </h3>
                  <div className="border border-[#c9a96e]/20 rounded-xl divide-y divide-[#c9a96e]/20">
                    {wedding.payment_plan === "full" ? (
                      <div className="flex items-center justify-between p-4 bg-[#f7f3ee]/40">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                          <div>
                            <p className="font-medium text-[#1a1a1a]">
                              Paid in Full
                            </p>
                            <p className="text-sm text-[#1a1a1a]/60">
                              Includes 5% discount
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-emerald-600">
                          Paid
                        </span>
                      </div>
                    ) : (
                      <>
                        {paymentSchedule.map((payment: any, i: number) => {
                          const isCustom =
                            wedding.payment_plan === "custom" ||
                            wedding.custom_payment_plan?.enabled;
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between p-4"
                            >
                              <div className="flex items-center gap-3">
                                {payment.status === "paid" ? (
                                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                                ) : payment.label === "Final Balance" ? (
                                  <Calendar className="h-5 w-5 text-[#1a1a1a]/50" />
                                ) : (
                                  <Clock className="h-5 w-5 text-[#1a1a1a]/60" />
                                )}
                                <div>
                                  <p className="font-medium text-[#1a1a1a]">
                                    {payment.label}
                                  </p>
                                  <p className="text-sm text-[#1a1a1a]/60">
                                    {payment.status === "paid"
                                      ? `Paid on ${payment.date}`
                                      : `Scheduled for ${payment.date}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span
                                  className={cn(
                                    "font-semibold",
                                    payment.status === "paid"
                                      ? "text-emerald-600"
                                      : "text-[#1a1a1a]",
                                  )}
                                >
                                  $
                                  {payment.amount.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  {payment.status === "paid"
                                    ? "Paid"
                                    : "Pending"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {invoicesData &&
                    invoicesData.pastInvoices &&
                    invoicesData.pastInvoices.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-4 text-[#1a1a1a]">
                          Past Receipts
                        </h3>
                        <div className="border border-[#c9a96e]/20 rounded-xl divide-y divide-[#c9a96e]/20">
                          {invoicesData.pastInvoices.map((inv: any) => (
                            <div
                              key={inv.id}
                              className="flex items-center justify-between p-4 bg-[#faf7f2]"
                            >
                              <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                                <div>
                                  <p className="font-medium text-[#1a1a1a]">
                                    {inv.description === "Subscription creation"
                                      ? "Payment Plan Deposit"
                                      : inv.description || "Invoice"}
                                  </p>
                                  <p className="text-sm text-[#1a1a1a]/60">
                                    {new Date(inv.date).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      },
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-semibold text-emerald-600">
                                  ${inv.amount.toLocaleString()}
                                </span>
                                {inv.pdf && (
                                  <a
                                    href={inv.pdf}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-primary hover:underline"
                                  >
                                    Receipt
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {wedding.stripe_customer_id && (
                    <div className="pt-4 border-t mt-6">
                      <p className="text-sm text-muted-foreground mb-4">
                        Need to update your credit card, download past invoices,
                        or see your exact upcoming charge dates?
                      </p>
                      <Button
                        onClick={handleManagePayments}
                        disabled={isManagingPayments}
                        className="w-full sm:w-auto bg-[#1a1a1a] hover:bg-[#1a1a1a]/90 text-white"
                      >
                        {isManagingPayments
                          ? "Opening Portal..."
                          : "Manage Payment Methods & Invoices"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-8 p-4 bg-[#f7f3ee]/40 rounded-xl text-sm text-[#1a1a1a]/70">
                  <p className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-[#1a1a1a] shrink-0" />
                    Payments are automatically processed using the card on file.
                    If you need to update your payment method or have questions
                    about your balance, please message us using the chat button
                    below.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="media" className="outline-none">
            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Your Media
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Access your final photos and videos below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!wedding.gallery_link &&
                !wedding.vimeo_link &&
                !wedding.youtube_link ? (
                  <div className="text-center py-16 px-4 bg-gradient-to-b from-[#f7f3ee]/30 to-[#faf7f2] rounded-2xl border border-dashed border-[#c9a96e]/40">
                    <div className="bg-[#c9a96e]/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ImageIcon className="h-10 w-10 text-[#1a1a1a]/40" />
                    </div>
                    <h3
                      className="text-2xl font-medium text-[#1a1a1a] mb-2"
                      style={{ fontFamily: "'DM Serif Display', serif" }}
                    >
                      Media Not Ready Yet
                    </h3>
                    <p className="text-[#1a1a1a]/60 max-w-md mx-auto text-lg font-light">
                      {isPast
                        ? "Our team is currently working on your beautiful photos and videos! We will notify you as soon as they are ready to view."
                        : "Your media will appear here after your wedding day."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {wedding.gallery_link && (
                      <a
                        href={wedding.gallery_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-8 bg-[#faf7f2] border border-[#c9a96e]/30 rounded-xl hover:bg-[#f7f3ee] hover:border-[#1a1a1a]/30 transition-colors group"
                      >
                        <ImageIcon className="h-10 w-10 mb-4 text-[#1a1a1a] group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-lg text-[#1a1a1a]">
                          Photo Gallery
                        </h3>
                        <p className="text-sm text-[#1a1a1a]/60 mt-1">
                          View & Download Photos
                        </p>
                      </a>
                    )}
                    {(wedding.vimeo_link || wedding.youtube_link) && (
                      <a
                        href={wedding.vimeo_link || wedding.youtube_link || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-8 bg-[#faf7f2] border border-[#c9a96e]/30 rounded-xl hover:bg-[#f7f3ee] hover:border-[#1a1a1a]/30 transition-colors group"
                      >
                        <Video className="h-10 w-10 mb-4 text-[#1a1a1a] group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-lg text-[#1a1a1a]">
                          Wedding Video
                        </h3>
                        <p className="text-sm text-[#1a1a1a]/60 mt-1">
                          Watch Your Film
                        </p>
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="songs" className="outline-none space-y-6">
            <div className="text-center max-w-2xl mx-auto mb-6">
              <div className="inline-flex items-center justify-center p-4 bg-[#f0e6d2]/30 rounded-full mb-4">
                <Music className="h-8 w-8 text-[#1a1a1a]" />
              </div>
              <h2
                className="text-3xl font-semibold mb-3 text-[#1a1a1a]"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Highlight Video Songs
              </h2>
              <p className="text-[#1a1a1a]/60 text-lg font-light">
                Choose the songs for your wedding highlight video! Add the song
                title and artist, and optionally paste a link (Spotify, YouTube,
                Apple Music, etc.) so our editors can find the exact version.
              </p>
            </div>

            {songsSubmitted && highlightSongs.length > 0 && (
              <Card className="bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Your songs have been submitted! Our editors have received
                    them. You can still make changes below — they'll be updated
                    automatically.
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl shadow-sm border-[#c9a96e]/30 overflow-hidden bg-white">
              <CardHeader className="bg-[#f7f3ee]/50 border-b border-[#c9a96e]/20">
                <CardTitle
                  className="text-[#1a1a1a]"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Your Song Choices
                </CardTitle>
                <CardDescription className="text-[#1a1a1a]/60">
                  Add one or more songs for your highlight video. Use the
                  "Moment" field to tell us where each song should play (e.g.,
                  ceremony, reception, full video).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {highlightSongs.length === 0 && (
                  <div className="text-center py-8 px-4 bg-[#faf7f2] rounded-xl border border-dashed border-[#c9a96e]/40">
                    <Music className="h-10 w-10 text-[#1a1a1a]/40 mx-auto mb-3" />
                    <p className="text-[#1a1a1a]/60">
                      No songs added yet. Click below to add your first song!
                    </p>
                  </div>
                )}

                {highlightSongs.map((song, index) => (
                  <div
                    key={index}
                    className="bg-[#faf7f2] p-4 rounded-xl border border-[#c9a96e]/20 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#1a1a1a]/60">
                        Song {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => {
                          const newSongs = [...highlightSongs];
                          newSongs.splice(index, 1);
                          setHighlightSongs(newSongs);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Song Title *</Label>
                        <Input
                          placeholder="e.g., Perfect"
                          value={song.title}
                          onChange={(e) => {
                            const newSongs = [...highlightSongs];
                            newSongs[index] = {
                              ...song,
                              title: e.target.value,
                            };
                            setHighlightSongs(newSongs);
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Artist *</Label>
                        <Input
                          placeholder="e.g., Ed Sheeran"
                          value={song.artist}
                          onChange={(e) => {
                            const newSongs = [...highlightSongs];
                            newSongs[index] = {
                              ...song,
                              artist: e.target.value,
                            };
                            setHighlightSongs(newSongs);
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Link (optional)</Label>
                      <Input
                        placeholder="Paste Spotify, YouTube, or Apple Music link"
                        value={song.link}
                        onChange={(e) => {
                          const newSongs = [...highlightSongs];
                          newSongs[index] = { ...song, link: e.target.value };
                          setHighlightSongs(newSongs);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Which moment? (optional)
                      </Label>
                      <Input
                        placeholder="e.g., First dance, ceremony entrance, full highlight"
                        value={song.moment}
                        onChange={(e) => {
                          const newSongs = [...highlightSongs];
                          newSongs[index] = { ...song, moment: e.target.value };
                          setHighlightSongs(newSongs);
                        }}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="border-[#1a1a1a]/30 text-[#1a1a1a] hover:bg-[#c9a96e]/15"
                  onClick={() =>
                    setHighlightSongs([
                      ...highlightSongs,
                      { title: "", artist: "", link: "", moment: "" },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Song
                </Button>

                <div className="pt-4 border-t flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    className="flex-1 bg-[#1a1a1a] hover:bg-[#1a1a1a]/90 text-white"
                    disabled={
                      highlightSongs.length === 0 ||
                      highlightSongs.some(
                        (s) => !s.title.trim() || !s.artist.trim(),
                      ) ||
                      isSavingSongs
                    }
                    onClick={async () => {
                      if (!id) return;
                      try {
                        setIsSavingSongs(true);
                        await api.saveHighlightSongs(id, highlightSongs);
                        setSongsSubmitted(true);
                        toast({
                          title: "Songs Saved!",
                          description:
                            "Our editors have received your song choices.",
                        });
                      } catch (err) {
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description:
                            "There was a problem saving your songs. Please try again.",
                        });
                      } finally {
                        setIsSavingSongs(false);
                      }
                    }}
                  >
                    {isSavingSongs ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Music className="h-4 w-4 mr-2" />
                    )}
                    {songsSubmitted ? "Update Songs" : "Submit Songs"}
                  </Button>
                </div>
                {highlightSongs.length > 0 &&
                  highlightSongs.some(
                    (s) => !s.title.trim() || !s.artist.trim(),
                  ) && (
                    <p className="text-xs text-destructive text-center">
                      Please fill in the title and artist for all songs before
                      submitting.
                    </p>
                  )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="sm:max-w-[500px] h-[85vh] sm:h-[80vh] flex flex-col p-0 gap-0 overflow-hidden rounded-[2rem] border-[#c9a96e]/40 shadow-2xl bg-white">
          <DialogHeader className="p-6 border-b border-[#c9a96e]/20 shrink-0 bg-gradient-to-r from-[#f7f3ee] to-transparent">
            <DialogTitle
              className="text-2xl text-[#1a1a1a]"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Chat with Team
            </DialogTitle>
            <DialogDescription className="text-base">
              Send a direct message to our management team.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                <p>No messages yet.</p>
                <p className="text-sm">
                  Send a message to start the conversation.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex group ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      {isMine && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMessageMutation.mutate(msg.id)}
                            disabled={deleteMessageMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm border"
                        }`}
                      >
                        <p className="text-sm break-words">{msg.content}</p>
                        <span
                          className={`text-[10px] mt-1 block ${
                            isMine
                              ? "text-primary-foreground/70 text-right"
                              : "text-muted-foreground"
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {!isMine && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMessageMutation.mutate(msg.id)}
                            disabled={deleteMessageMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1 w-16 h-10 border">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                )}
                <div ref={chatScrollRef} />
              </div>
            )}
          </div>
          <div className="p-4 border-t bg-background shrink-0">
            <form onSubmit={handleContactSubmit} className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={contactMessage}
                onChange={(e) => {
                  setContactMessage(e.target.value);
                  if (typingChannelRef.current && id) {
                    typingChannelRef.current.send({
                      type: "broadcast",
                      event: "typing",
                      payload: { sender_id: id, receiver_id: "manager" },
                    });
                  }
                }}
                className="flex-1 rounded-full"
                disabled={isSendingContact}
              />
              <Button
                type="submit"
                size="icon"
                className="rounded-full shrink-0"
                disabled={!contactMessage.trim() || isSendingContact}
              >
                {isSendingContact ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedContractor}
        onOpenChange={(open) => !open && setSelectedContractor(null)}
      >
        <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-[#c9a96e]/40 bg-white">
          <DialogHeader>
            <DialogTitle
              className="text-[#1a1a1a]"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Team Member Contact
            </DialogTitle>
          </DialogHeader>
          {selectedContractor && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Avatar className="h-24 w-24 border-4 border-[#c9a96e]/20">
                <AvatarImage src={selectedContractor.avatar_url || ""} />
                <AvatarFallback className="bg-[#c9a96e]/30 text-[#1a1a1a] text-2xl">
                  {selectedContractor.first_name?.[0]}
                  {selectedContractor.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-center space-y-1">
                <h3 className="text-2xl font-semibold text-[#1a1a1a]">
                  {selectedContractor.first_name} {selectedContractor.last_name}
                </h3>
              </div>
              <div className="w-full space-y-3 mt-4">
                <div className="bg-[#faf7f2] p-4 rounded-xl border border-[#c9a96e]/20 flex flex-col gap-1">
                  <span className="text-sm font-medium text-[#1a1a1a]/60 uppercase tracking-wider">
                    Email
                  </span>
                  <span className="text-[#1a1a1a] font-medium break-all">
                    {selectedContractor.email ? (
                      <a
                        href={`mailto:${selectedContractor.email}`}
                        className="text-[#1a1a1a] hover:underline"
                      >
                        {selectedContractor.email}
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </span>
                </div>
                <div className="bg-[#faf7f2] p-4 rounded-xl border border-[#c9a96e]/20 flex flex-col gap-1">
                  <span className="text-sm font-medium text-[#1a1a1a]/60 uppercase tracking-wider">
                    Phone
                  </span>
                  <span className="text-[#1a1a1a] font-medium">
                    {selectedContractor.phone ? (
                      <a
                        href={`tel:${selectedContractor.phone}`}
                        className="text-[#1a1a1a] hover:underline"
                      >
                        {formatPhoneNumber(selectedContractor.phone)}
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
