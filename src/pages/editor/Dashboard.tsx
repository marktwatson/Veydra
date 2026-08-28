import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, DbWedding } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDisplayDate, getCompanyTimezone } from "@/lib/utils";

// Parse a date string as a local date (no UTC midnight shift)
const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(NaN);
  const datePart = dateStr.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, m - 1, d);
};
import {
  Search,
  Loader2,
  HardDrive,
  Video,
  Play,
  Image,
  FileText,
  Check,
  Clock,
  Edit,
  DollarSign,
  Plus,
  Trash2,
  AlertCircle,
  Calendar,
  CheckCircle,
  MoreHorizontal,
  Target,
  Link as LinkIcon,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Star,
  Music,
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";

const STATUS_OPTIONS = [
  { value: "ready_to_edit", label: "Ready to Edit" },
  { value: "in_progress", label: "In Progress" },
  { value: "revisions_requested", label: "Revisions Requested" },
  { value: "client_review", label: "Manager Review" },
  { value: "delivered", label: "Delivered" },
];

function calculateDeadline(wedding: DbWedding) {
  if (wedding.editor_due_date) return new Date(wedding.editor_due_date);
  const date = parseLocalDate(wedding.date);
  const month = date.getMonth();
  const isBusySeason = month >= 8 && month <= 10;
  const daysToAdd = isBusySeason ? 28 : 21;
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

export default function EditorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<"date" | "status">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedWedding, setSelectedWedding] = useState<DbWedding | null>(
    null,
  );
  const [uploadAcknowledged, setUploadAcknowledged] = useState(false);
  const [actualPhotoCount, setActualPhotoCount] = useState<string>("");
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [contractorRatings, setContractorRatings] = useState<
    Record<string, { rating: number; feedback: string }>
  >({});
  const [invoiceWedding, setInvoiceWedding] = useState<DbWedding | null>(null);
  const [photoCount, setPhotoCount] = useState<number>(0);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);

  const { data: weddings = [], isLoading } = useQuery({
    queryKey: ["editor-weddings"],
    queryFn: api.getWeddings,
  });

  const { data: settings } = useQuery({
    queryKey: ["portal-settings"],
    queryFn: api.getPortalSettings,
  });

  const { data: editorProfile } = useQuery({
    queryKey: ["editor-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("editors")
        .select("stripe_account_id")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: weddingAssignments = [], isLoading: isLoadingAssignments } =
    useQuery({
      queryKey: ["wedding-assignments", selectedWedding?.id],
      queryFn: async () => {
        if (!selectedWedding?.id) return [];
        const { data: jobs } = await supabase
          .from("jobs")
          .select("id")
          .eq("wedding_id", selectedWedding.id);
        if (!jobs || jobs.length === 0) return [];
        const jobIds = jobs.map((j) => j.id);
        const { data } = await supabase
          .from("assignments")
          .select(
            `
        id, job_id, contractor_id, status,
        contractors(first_name, last_name, avatar_url),
        jobs(role)
      `,
          )
          .in("job_id", jobIds)
          .neq("status", "Cancelled");
        return data || [];
      },
      enabled: !!selectedWedding?.id && isRatingModalOpen,
    });

  const videoPricing = useMemo(() => {
    if (settings?.editor_video_pricing) {
      try {
        const parsed =
          typeof settings.editor_video_pricing === "string"
            ? JSON.parse(settings.editor_video_pricing)
            : settings.editor_video_pricing;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      {
        id: "highlight_9_10",
        label: "Wedding Highlight (9-10 min)",
        price: 190,
      },
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
  }, [settings]);

  const updateWeddingMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<DbWedding>;
    }) => api.updateWedding(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-weddings"] });
      toast({ title: "Updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update wedding.",
        variant: "destructive",
      });
    },
  });

  const activeWeddings = useMemo(() => {
    return weddings
      .map((w) => {
        let parsedVideoTargets = w.editor_video_targets;
        if (typeof parsedVideoTargets === "string") {
          try {
            parsedVideoTargets = JSON.parse(parsedVideoTargets);
          } catch (e) {
            parsedVideoTargets = [];
          }
        }
        return {
          ...w,
          editor_video_targets: Array.isArray(parsedVideoTargets)
            ? parsedVideoTargets
            : [],
        };
      })
      .filter((w) => {
        const status = w.editing_status || "awaiting_raw_media";
        const isVisible = [
          "ready_to_edit",
          "in_progress",
          "revisions_requested",
          "client_review",
          "delivered",
        ].includes(status);
        const matchesSearch = w.client_name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const isNotCancelled =
          w.status !== "cancelled" && w.status !== "Cancelled";
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        const isAssignedToMe = w.editor_id === user?.id;

        if (
          !isVisible ||
          !matchesSearch ||
          !isNotCancelled ||
          !matchesStatus ||
          !isAssignedToMe
        )
          return false;

        return true;
      })
      .sort((a, b) => {
        let valA: any = "";
        let valB: any = "";

        if (sortColumn === "date") {
          valA = parseLocalDate(a.date).getTime();
          valB = parseLocalDate(b.date).getTime();
        } else if (sortColumn === "status") {
          const STATUS_ORDER: Record<string, number> = {
            ready_to_edit: 1,
            in_progress: 2,
            revisions_requested: 3,
            client_review: 4,
            delivered: 5,
          };
          valA = STATUS_ORDER[a.editing_status || "ready_to_edit"] || 99;
          valB = STATUS_ORDER[b.editing_status || "ready_to_edit"] || 99;
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [
    weddings,
    searchQuery,
    statusFilter,
    sortColumn,
    sortDirection,
    user?.id,
  ]);

  const handleStatusChange = (id: string, newStatus: string) => {
    updateWeddingMutation.mutate({
      id,
      updates: { editing_status: newStatus },
    });
  };

  const openDetails = (wedding: DbWedding) => {
    setSelectedWedding(wedding);
    setUploadAcknowledged(false);
    setActualPhotoCount(wedding.editor_photo_target?.toString() || "");
    setIsDetailsOpen(true);
  };

  const openInvoiceModal = (wedding: DbWedding) => {
    setInvoiceWedding(wedding);
    setPhotoCount(wedding.editor_photo_target || 0);
    setSelectedVideos(wedding.editor_video_targets || []);
    setIsInvoiceModalOpen(true);
  };

  const handleAddVideo = () => {
    setSelectedVideos([...selectedVideos, videoPricing[0]?.id || ""]);
  };

  const handleVideoChange = (index: number, newId: string) => {
    const newVideos = [...selectedVideos];
    newVideos[index] = newId;
    setSelectedVideos(newVideos);
  };

  const handleRemoveVideo = (index: number) => {
    const newVideos = [...selectedVideos];
    newVideos.splice(index, 1);
    setSelectedVideos(newVideos);
  };

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWedding) return;

      const promises = Object.entries(contractorRatings).map(
        async ([assignmentId, data]) => {
          if (data.rating > 0) {
            await supabase
              .from("assignments")
              .update({
                editor_rating: data.rating,
                editor_feedback: data.feedback || null,
              })
              .eq("id", assignmentId);

            const assignment = weddingAssignments.find(
              (a: any) => a.id === assignmentId,
            );
            if (assignment?.contractor_id) {
              await api.recalculateContractorRating(assignment.contractor_id);
            }
          }
        },
      );
      await Promise.all(promises);

      const updates: any = { editing_status: "client_review" };
      if (selectedWedding.editor_photo_target && actualPhotoCount) {
        updates.editor_photo_target = parseInt(actualPhotoCount, 10);
      }
      await api.updateWedding(selectedWedding.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editor-weddings"] });
      setIsRatingModalOpen(false);
      setIsDetailsOpen(false);
      toast({ title: "Submitted for review" });
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit review.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitInvoice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!invoiceWedding) return;

    const photoTotal = photoCount * 0.12;
    const videoTotal = selectedVideos.reduce((sum, vidId) => {
      const video = videoPricing.find((v) => v.id === vidId);
      return sum + (video ? video.price : 0);
    }, 0);
    const totalPayout = photoTotal + videoTotal;

    const updates = {
      editor_payout_amount: totalPayout,
      editor_invoice_status: "pending",
      editor_invoice_details: {
        photoCount,
        photoTotal,
        videos: selectedVideos.map((id) => {
          const v = videoPricing.find((v) => v.id === id);
          return { id, label: v?.label, price: v?.price };
        }),
        videoTotal,
      },
    };

    updateWeddingMutation.mutate(
      { id: invoiceWedding.id, updates },
      {
        onSuccess: () => {
          setIsInvoiceModalOpen(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Editor Portal
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your current editing pipeline.
          </p>
        </div>
      </div>

      {!editorProfile?.stripe_account_id && (
        <Alert
          variant="destructive"
          className="bg-destructive/10 border-destructive/20 text-destructive"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Required: Connect Stripe</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <span>
              You must connect your Stripe account to receive payouts for your
              invoices.
            </span>
            <Button asChild size="sm" variant="destructive">
              <Link to="/editor/invoices">Go to Settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : activeWeddings.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border border-border">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or search query.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block rounded-md border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSortColumn("date");
                      setSortDirection(
                        sortColumn === "date" && sortDirection === "asc"
                          ? "desc"
                          : "asc",
                      );
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Deadline{" "}
                      {sortColumn === "date" ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSortColumn("status");
                      setSortDirection(
                        sortColumn === "status" && sortDirection === "asc"
                          ? "desc"
                          : "asc",
                      );
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Status{" "}
                      {sortColumn === "status" ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Links</TableHead>
                  <TableHead className="hidden lg:table-cell">Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeWeddings.map((wedding) => {
                  const currentStatus =
                    wedding.editing_status || "ready_to_edit";
                  const deadline = calculateDeadline(wedding);
                  const isOverdue =
                    new Date() > deadline && currentStatus !== "delivered";
                  const isNearing =
                    !isOverdue &&
                    new Date().getTime() >
                      deadline.getTime() - 5 * 24 * 60 * 60 * 1000 &&
                    currentStatus !== "delivered";
                  const statusObj = STATUS_OPTIONS.find(
                    (s) => s.value === currentStatus,
                  );

                  return (
                    <TableRow
                      key={wedding.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openDetails(wedding)}
                    >
                      <TableCell>
                        <div className="font-medium">{wedding.client_name}</div>
                        <div className="text-xs text-muted-foreground mb-1">
                          {formatDisplayDate(wedding.date)}
                        </div>
                        {(wedding.editor_photo_target ||
                          (wedding.editor_video_targets &&
                            wedding.editor_video_targets.length > 0)) && (
                          <div className="flex flex-wrap gap-1">
                            {wedding.editor_photo_target ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 bg-muted/50"
                              >
                                {wedding.editor_photo_target} Photos
                              </Badge>
                            ) : null}
                            {wedding.editor_video_targets?.map((vid, idx) => {
                              const v = videoPricing.find((p) => p.id === vid);
                              return v ? (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 bg-muted/50 truncate max-w-[120px]"
                                >
                                  {v.label.split("(")[0].trim()}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div
                          className={`flex items-center gap-1.5 text-sm ${isOverdue ? "text-destructive font-medium" : isNearing ? "text-orange-500 font-medium" : "text-muted-foreground"}`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {formatDisplayDate(deadline.toISOString())}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={statusObj?.label || currentStatus}
                        />
                      </TableCell>
                      <TableCell
                        className="hidden md:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-2">
                          {wedding.drive_link && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(wedding.drive_link!, "_blank");
                              }}
                              title="Raw Media"
                            >
                              <HardDrive className="h-4 w-4" />
                            </Button>
                          )}
                          {wedding.upload_link && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(wedding.upload_link!, "_blank");
                              }}
                              title="Final Edits"
                            >
                              <Video className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[250px]">
                        {wedding.revisions_notes &&
                        (currentStatus === "revisions_requested" ||
                          currentStatus === "in_progress") ? (
                          <div
                            className="text-xs text-destructive truncate"
                            title={wedding.revisions_notes}
                          >
                            <span className="font-semibold">Revisions:</span>{" "}
                            {wedding.revisions_notes}
                          </div>
                        ) : wedding.editing_notes ? (
                          <div
                            className="text-xs text-muted-foreground truncate"
                            title={wedding.editing_notes}
                          >
                            <span className="font-semibold">Notes:</span>{" "}
                            {wedding.editing_notes}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end items-center gap-2">
                          {(currentStatus === "ready_to_edit" ||
                            currentStatus === "revisions_requested") && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(wedding);
                              }}
                            >
                              Start
                            </Button>
                          )}
                          {currentStatus === "in_progress" && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(wedding);
                              }}
                            >
                              Submit
                            </Button>
                          )}
                          {currentStatus === "delivered" && (
                            <Button
                              size="sm"
                              variant={
                                wedding.editor_invoice_status
                                  ? "outline"
                                  : "default"
                              }
                              className={
                                wedding.editor_invoice_status
                                  ? "pointer-events-none opacity-70"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                !wedding.editor_invoice_status &&
                                  openInvoiceModal(wedding);
                              }}
                            >
                              {wedding.editor_invoice_status
                                ? "Invoiced"
                                : "Invoice"}
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetails(wedding);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    wedding.drive_link || "#",
                                    "_blank",
                                  );
                                }}
                                disabled={!wedding.drive_link}
                              >
                                <HardDrive className="h-4 w-4 mr-2" /> Raw Media
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    wedding.upload_link || "#",
                                    "_blank",
                                  );
                                }}
                                disabled={!wedding.upload_link}
                              >
                                <Video className="h-4 w-4 mr-2" /> Final Edits
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-4">
            {activeWeddings.map((wedding) => {
              const currentStatus = wedding.editing_status || "ready_to_edit";
              const deadline = calculateDeadline(wedding);
              const isOverdue =
                new Date() > deadline && currentStatus !== "delivered";
              const isNearing =
                !isOverdue &&
                new Date().getTime() >
                  deadline.getTime() - 5 * 24 * 60 * 60 * 1000 &&
                currentStatus !== "delivered";
              const statusObj = STATUS_OPTIONS.find(
                (s) => s.value === currentStatus,
              );

              return (
                <Card
                  key={wedding.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openDetails(wedding)}
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-semibold">
                          {wedding.client_name}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {formatDisplayDate(wedding.date)}
                        </div>
                      </div>
                      <StatusBadge
                        status={statusObj?.label || currentStatus}
                        className="shrink-0"
                      />
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="font-medium">Deadline:</span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${isOverdue ? "text-destructive font-medium" : isNearing ? "text-orange-500 font-medium" : "text-muted-foreground"}`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {formatDisplayDate(deadline.toISOString())}
                      </div>
                    </div>

                    {(wedding.editor_photo_target ||
                      (wedding.editor_video_targets &&
                        wedding.editor_video_targets.length > 0)) && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                        {wedding.editor_photo_target ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            {wedding.editor_photo_target} Photos
                          </Badge>
                        ) : null}
                        {wedding.editor_video_targets?.map((vid, idx) => {
                          const v = videoPricing.find((p) => p.id === vid);
                          return v ? (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 truncate max-w-[150px]"
                            >
                              {v.label.split("(")[0].trim()}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}

                    <div
                      className="flex justify-between items-center pt-2 border-t"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-2">
                        {wedding.drive_link && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(wedding.drive_link!, "_blank");
                            }}
                          >
                            <HardDrive className="h-4 w-4" />
                          </Button>
                        )}
                        {wedding.upload_link && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(wedding.upload_link!, "_blank");
                            }}
                          >
                            <Video className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {(currentStatus === "ready_to_edit" ||
                          currentStatus === "revisions_requested") && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetails(wedding);
                            }}
                          >
                            Start
                          </Button>
                        )}
                        {currentStatus === "in_progress" && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetails(wedding);
                            }}
                          >
                            Submit
                          </Button>
                        )}
                        {currentStatus === "delivered" && (
                          <Button
                            size="sm"
                            variant={
                              wedding.editor_invoice_status
                                ? "outline"
                                : "default"
                            }
                            className={
                              wedding.editor_invoice_status
                                ? "pointer-events-none opacity-70"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              !wedding.editor_invoice_status &&
                                openInvoiceModal(wedding);
                            }}
                          >
                            {wedding.editor_invoice_status
                              ? "Invoiced"
                              : "Invoice"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetails(wedding);
                          }}
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="w-full sm:max-w-md md:max-w-xl overflow-y-auto p-0">
          {selectedWedding && (
            <div className="p-6 flex flex-col min-h-full">
              <SheetHeader className="mb-6">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <SheetTitle className="text-2xl">
                      {selectedWedding.client_name}
                    </SheetTitle>
                    <SheetDescription className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {formatDisplayDate(selectedWedding.date)}
                      </div>
                      <div className="flex items-center gap-1.5 text-orange-500 font-medium">
                        <Clock className="h-4 w-4" />
                        Due:{" "}
                        {formatDisplayDate(
                          calculateDeadline(selectedWedding).toISOString(),
                        )}
                      </div>
                    </SheetDescription>
                  </div>
                  <StatusBadge
                    status={
                      STATUS_OPTIONS.find(
                        (s) =>
                          s.value ===
                          (selectedWedding.editing_status || "ready_to_edit"),
                      )?.label ||
                      selectedWedding.editing_status ||
                      "Ready to Edit"
                    }
                    className="text-sm px-3 py-1"
                  />
                </div>
              </SheetHeader>

              <div className="space-y-8">
                {/* Targets Section */}
                {(selectedWedding.editor_photo_target ||
                  (selectedWedding.editor_video_targets &&
                    selectedWedding.editor_video_targets.length > 0)) && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4 shadow-sm">
                    <h3 className="font-semibold flex items-center gap-2 text-sm text-primary uppercase tracking-wider">
                      <Target className="h-5 w-5" /> Project Targets
                    </h3>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                      {selectedWedding.editor_photo_target ? (
                        <div className="flex items-center gap-3 bg-background border border-border rounded-lg px-4 py-3 shadow-sm min-w-[140px]">
                          <div className="bg-blue-100 dark:bg-blue-900/50 p-2.5 rounded-md">
                            <Image className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-foreground">
                              {selectedWedding.editor_photo_target}
                            </div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Photos
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {selectedWedding.editor_video_targets?.map((vid, idx) => {
                        const v = videoPricing.find((p) => p.id === vid);
                        return v ? (
                          <div
                            key={idx}
                            className="flex items-center gap-3 bg-background border border-border rounded-lg px-4 py-3 shadow-sm flex-1 min-w-[200px]"
                          >
                            <div className="bg-purple-100 dark:bg-purple-900/50 p-2.5 rounded-md">
                              <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-foreground leading-tight">
                                {v.label.split("(")[0].trim()}
                              </div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
                                {v.label.includes("(")
                                  ? v.label.split("(")[1].replace(")", "")
                                  : "Video"}
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
                    <FileText className="h-4 w-4" /> Instructions & Feedback
                  </h3>

                  {selectedWedding.revisions_notes && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
                      <div className="font-semibold text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> Revisions Requested
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {selectedWedding.revisions_notes}
                      </p>
                    </div>
                  )}

                  {selectedWedding.editing_notes ? (
                    <div className="bg-muted/50 border rounded-lg p-4 space-y-2">
                      <div className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />{" "}
                        Editor Notes
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {selectedWedding.editing_notes}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-muted/30 border border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
                      No specific editing notes provided.
                    </div>
                  )}

                  {(() => {
                    const songs = Array.isArray(selectedWedding.highlight_songs)
                      ? selectedWedding.highlight_songs
                      : [];
                    if (songs.length === 0) return null;
                    return (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                        <div className="font-semibold flex items-center gap-2">
                          <Music className="h-4 w-4 text-primary" /> Highlight
                          Video Songs
                          <Badge variant="secondary" className="text-[10px]">
                            {songs.length} song{songs.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {songs.map((s: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 bg-background/60 p-3 rounded-md border"
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
                      </div>
                    );
                  })()}
                </div>

                <Separator />

                {/* Links Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
                    <LinkIcon className="h-4 w-4" /> Media Links
                  </h3>

                  <div className="flex gap-3 mb-6">
                    <Button
                      variant="outline"
                      className="flex-1 bg-blue-50/50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900"
                      onClick={() =>
                        window.open(selectedWedding.drive_link || "#", "_blank")
                      }
                      disabled={!selectedWedding.drive_link}
                    >
                      <HardDrive className="h-4 w-4 mr-2" /> Raw Media
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900"
                      onClick={() =>
                        window.open(
                          selectedWedding.upload_link || "#",
                          "_blank",
                        )
                      }
                      disabled={!selectedWedding.upload_link}
                    >
                      <HardDrive className="h-4 w-4 mr-2" /> Final Destination
                      Folder
                    </Button>
                  </div>

                  {selectedWedding.editing_status === "in_progress" && (
                    <div className="space-y-4 bg-muted/30 p-4 rounded-lg border">
                      {selectedWedding.editor_photo_target ? (
                        <div className="space-y-2 pb-2">
                          <Label htmlFor="actual-photos">
                            Actual Photos Uploaded
                          </Label>
                          <Input
                            id="actual-photos"
                            type="number"
                            value={actualPhotoCount}
                            onChange={(e) =>
                              setActualPhotoCount(e.target.value)
                            }
                            placeholder="e.g. 500"
                          />
                          <p className="text-xs text-muted-foreground">
                            Enter the exact number of photos you uploaded so you
                            are paid correctly.
                          </p>
                        </div>
                      ) : null}

                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="upload-ack"
                          checked={uploadAcknowledged}
                          onCheckedChange={(checked) =>
                            setUploadAcknowledged(checked as boolean)
                          }
                          className="mt-1"
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label
                            htmlFor="upload-ack"
                            className="text-sm font-medium leading-tight"
                          >
                            I acknowledge that I have uploaded all final media
                            to the Final Destination Folder.
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            You must upload the files before submitting for
                            review.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6 flex justify-end gap-3 mt-auto">
                  {(selectedWedding.editing_status === "ready_to_edit" ||
                    selectedWedding.editing_status ===
                      "revisions_requested") && (
                    <Button
                      size="lg"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        handleStatusChange(selectedWedding.id, "in_progress");
                        setIsDetailsOpen(false);
                      }}
                    >
                      Editing Started
                    </Button>
                  )}
                  {selectedWedding.editing_status === "in_progress" && (
                    <div className="w-full sm:w-auto flex flex-col items-center sm:items-end gap-1">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto"
                        disabled={
                          !uploadAcknowledged ||
                          updateWeddingMutation.isPending ||
                          (!!selectedWedding.editor_photo_target &&
                            !actualPhotoCount)
                        }
                        onClick={() => {
                          setIsRatingModalOpen(true);
                          setContractorRatings({});
                        }}
                      >
                        {updateWeddingMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Send to Manager for Review
                      </Button>
                      {(!uploadAcknowledged ||
                        (!!selectedWedding.editor_photo_target &&
                          !actualPhotoCount)) && (
                        <span className="text-xs text-destructive text-center sm:text-right w-full">
                          Please fill out all required fields before submitting.
                        </span>
                      )}
                    </div>
                  )}
                  {selectedWedding.editing_status === "delivered" &&
                    !selectedWedding.editor_invoice_status && (
                      <Button
                        size="lg"
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          setIsDetailsOpen(false);
                          openInvoiceModal(selectedWedding);
                        }}
                      >
                        Create Invoice
                      </Button>
                    )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isRatingModalOpen} onOpenChange={setIsRatingModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Rate the Team</DialogTitle>
            <DialogDescription>
              Please rate the raw media provided by the contractors. This helps
              us ensure quality!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {isLoadingAssignments ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : weddingAssignments.length === 0 ? (
              <div className="text-center p-8 bg-muted/30 rounded-lg border border-dashed">
                <p className="text-muted-foreground">
                  No contractors found for this wedding.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {weddingAssignments.map((assignment: any) => {
                  const contractor = assignment.contractors;
                  const role = assignment.jobs?.role || "Contractor";
                  const ratingData = contractorRatings[assignment.id] || {
                    rating: 0,
                    feedback: "",
                  };

                  return (
                    <div
                      key={assignment.id}
                      className="bg-muted/30 p-4 rounded-lg border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {contractor?.first_name} {contractor?.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {role}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                setContractorRatings((prev) => ({
                                  ...prev,
                                  [assignment.id]: {
                                    ...ratingData,
                                    rating: star,
                                  },
                                }))
                              }
                              className="focus:outline-none transition-transform hover:scale-110"
                            >
                              <Star
                                className={`h-6 w-6 ${star <= ratingData.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {ratingData.rating > 0 && (
                        <Textarea
                          placeholder="Optional feedback about their raw media..."
                          value={ratingData.feedback}
                          onChange={(e) =>
                            setContractorRatings((prev) => ({
                              ...prev,
                              [assignment.id]: {
                                ...ratingData,
                                feedback: e.target.value,
                              },
                            }))
                          }
                          className="h-20 resize-none text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRatingModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => submitReviewMutation.mutate()}
              disabled={submitReviewMutation.isPending}
            >
              {submitReviewMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          {invoiceWedding && (
            <form onSubmit={handleSubmitInvoice} className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Image className="h-4 w-4" /> Photos Edited
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground block mb-1">
                        Number of Images
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={photoCount || ""}
                        onChange={(e) =>
                          setPhotoCount(parseInt(e.target.value) || 0)
                        }
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-1">
                        Rate ($0.12/img)
                      </div>
                      <div className="font-semibold text-lg">
                        ${(photoCount * 0.12).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg border space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Video className="h-4 w-4" /> Videos Edited
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddVideo}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Video
                    </Button>
                  </div>

                  {selectedVideos.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4 italic">
                      No videos added to this invoice yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedVideos.map((vidId, index) => {
                        const selectedVideo = videoPricing.find(
                          (v) => v.id === vidId,
                        );
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-3 bg-background p-2 rounded border"
                          >
                            <div className="flex-1">
                              <Select
                                value={vidId}
                                onValueChange={(val) =>
                                  handleVideoChange(index, val)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {videoPricing.map((v) => (
                                    <SelectItem key={v.id} value={v.id}>
                                      {v.label} - ${v.price}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="font-semibold w-16 text-right">
                              ${selectedVideo?.price || 0}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive shrink-0"
                              onClick={() => handleRemoveVideo(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Total Invoice Amount
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                    $
                    {(
                      photoCount * 0.12 +
                      selectedVideos.reduce((sum, vidId) => {
                        const video = videoPricing.find((v) => v.id === vidId);
                        return sum + (video ? video.price : 0);
                      }, 0)
                    ).toFixed(2)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInvoiceModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateWeddingMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {updateWeddingMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Submit Invoice
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
