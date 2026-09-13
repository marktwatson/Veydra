import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, DbWedding } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Filter,
  Loader2,
  Link2,
  HardDrive,
  Video,
  Image,
  FileText,
  Check,
  Clock,
  Play,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  DollarSign,
  AlertCircle,
  Plus,
  Trash2,
  Send,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const STATUS_OPTIONS = [
  { value: "awaiting_raw_media", label: "Awaiting Raw Media" },
  { value: "ready_to_edit", label: "Ready to Edit" },
  { value: "in_progress", label: "In Progress" },
  { value: "revisions_requested", label: "Revisions Requested" },
  { value: "client_review", label: "Manager Review" },
  { value: "delivered", label: "Delivered" },
];

function calculateDeadline(wedding: DbWedding) {
  if (wedding.editor_due_date) return new Date(wedding.editor_due_date);
  const date = new Date(wedding.date);
  const month = date.getMonth(); // 0 = Jan, 8 = Sept, 9 = Oct, 10 = Nov
  const isBusySeason = month >= 8 && month <= 10;
  const daysToAdd = isBusySeason ? 28 : 21; // 4 weeks for busy season, 3 weeks otherwise
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "awaiting_raw_media":
      return "destructive";
    case "ready_to_edit":
      return "secondary";
    case "in_progress":
      return "default";
    case "revisions_requested":
      return "destructive";
    case "client_review":
      return "outline";
    case "delivered":
      return "default"; // or a custom emerald class
    default:
      return "secondary";
  }
}

export default function PostProductionTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editorFilter, setEditorFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [editingWedding, setEditingWedding] = useState<DbWedding | null>(null);
  const [isLinksModalOpen, setIsLinksModalOpen] = useState(false);
  const [submitAction, setSubmitAction] = useState<"save" | "revisions">(
    "save",
  );
  const [reviewWedding, setReviewWedding] = useState<DbWedding | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const [photoTarget, setPhotoTarget] = useState<number>(0);
  const [videoTargets, setVideoTargets] = useState<string[]>([]);

  const { data: weddings = [], isLoading } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  const { data: settings } = useQuery({
    queryKey: ["portal-settings"],
    queryFn: api.getPortalSettings,
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

  const { data: editors = [] } = useQuery({
    queryKey: ["editors"],
    queryFn: api.getEditors,
  });

  const updateWeddingMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<DbWedding>;
    }) => api.updateWedding(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({ title: "Updated successfully" });
      setIsLinksModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update wedding.",
        variant: "destructive",
      });
    },
  });

  const filteredWeddings = useMemo(() => {
    let result = weddings.filter((w) => {
      const matchesSearch = w.client_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (w.editing_status || "awaiting_raw_media") === statusFilter;
      const matchesEditor =
        editorFilter === "all" ||
        (editorFilter === "unassigned"
          ? !w.editor_id
          : w.editor_id === editorFilter);
      // Exclude cancelled/pending weddings and unpaid drafts from pipeline
      const isValidStatus = w.status === "upcoming" || w.status === "completed";
      const isNotDraft = !w.notes?.includes("[UNPAID_DRAFT]");
      return (
        matchesSearch &&
        matchesStatus &&
        matchesEditor &&
        isValidStatus &&
        isNotDraft
      );
    });

    result.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortColumn) {
        case "date":
          valA = new Date(a.date).getTime();
          valB = new Date(b.date).getTime();
          break;
        case "client":
          valA = a.client_name.toLowerCase();
          valB = b.client_name.toLowerCase();
          break;
        case "deadline":
          valA = calculateDeadline(a).getTime();
          valB = calculateDeadline(b).getTime();
          break;
        case "status": {
          const STATUS_ORDER: Record<string, number> = {
            awaiting_raw_media: 1,
            ready_to_edit: 2,
            in_progress: 3,
            revisions_requested: 4,
            client_review: 5,
            delivered: 6,
          };
          valA = STATUS_ORDER[a.editing_status || "awaiting_raw_media"] || 99;
          valB = STATUS_ORDER[b.editing_status || "awaiting_raw_media"] || 99;
          break;
        }
        case "editor":
          valA = a.editor_id || "unassigned";
          valB = b.editor_id || "unassigned";
          break;
        default:
          valA = new Date(a.date).getTime();
          valB = new Date(b.date).getTime();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    weddings,
    searchQuery,
    statusFilter,
    editorFilter,
    sortColumn,
    sortDirection,
  ]);

  const totalPages = Math.ceil(filteredWeddings.length / itemsPerPage);
  const paginatedWeddings = filteredWeddings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleStatusChange = (id: string, newStatus: string) => {
    updateWeddingMutation.mutate({
      id,
      updates: { editing_status: newStatus },
    });
  };

  const handleEditorChange = (id: string, editorId: string | null) => {
    updateWeddingMutation.mutate({ id, updates: { editor_id: editorId } });
  };

  const handleSaveLinks = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingWedding) return;

    const formData = new FormData(e.currentTarget);
    const updates: Partial<DbWedding> = {
      drive_link: formData.get("drive_link") as string,
      upload_link: formData.get("upload_link") as string,
      vimeo_link: formData.get("vimeo_link") as string,
      youtube_link: formData.get("youtube_link") as string,
      gallery_link: formData.get("gallery_link") as string,
      editing_notes: formData.get("editing_notes") as string,
      revisions_notes: formData.get("revisions_notes") as string,
      editor_due_date: (formData.get("editor_due_date") as string) || null,
      editor_photo_target: photoTarget,
      editor_video_targets: videoTargets,
    };

    if (submitAction === "revisions") {
      updates.editing_status = "revisions_requested";
    }

    updateWeddingMutation.mutate({ id: editingWedding.id, updates });
  };

  const openLinksModal = (wedding: DbWedding) => {
    setEditingWedding(wedding);
    setPhotoTarget(wedding.editor_photo_target || 0);

    let parsedTargets: string[] = [];
    if (Array.isArray(wedding.editor_video_targets)) {
      parsedTargets = wedding.editor_video_targets;
    } else if (typeof wedding.editor_video_targets === "string") {
      try {
        const parsed = JSON.parse(wedding.editor_video_targets);
        parsedTargets = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        parsedTargets = [];
      }
    }

    setVideoTargets(parsedTargets);
    setIsLinksModalOpen(true);
  };

  const handleAddVideoTarget = () => {
    setVideoTargets([...videoTargets, videoPricing[0]?.id || ""]);
  };

  const handleVideoTargetChange = (index: number, newId: string) => {
    const newTargets = [...videoTargets];
    newTargets[index] = newId;
    setVideoTargets(newTargets);
  };

  const handleRemoveVideoTarget = (index: number) => {
    const newTargets = [...videoTargets];
    newTargets.splice(index, 1);
    setVideoTargets(newTargets);
  };

  const openReviewModal = (wedding: DbWedding) => {
    setReviewWedding(wedding);
    setIsReviewModalOpen(true);
  };

  const handleApproveInvoice = () => {
    if (!reviewWedding) return;
    updateWeddingMutation.mutate(
      { id: reviewWedding.id, updates: { editor_invoice_status: "approved" } },
      {
        onSuccess: () => {
          setIsReviewModalOpen(false);
        },
      },
    );
  };

  const generateMockData = async () => {
    try {
      const mockWeddings = [
        {
          client_name: "Sarah & John Smith",
          date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), // Nearing deadline
          location: "New York, NY",
          status: "active",
          editing_status: "ready_to_edit",
          drive_link: "https://drive.google.com/...",
          editing_notes:
            "Please focus on the vows and the first dance. They want a cinematic feel.",
        },
        {
          client_name: "Emily & Michael Johnson",
          date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // Overdue
          location: "Los Angeles, CA",
          status: "active",
          editing_status: "in_progress",
          drive_link: "https://drive.google.com/...",
          editing_notes: "Client requested a quick teaser within 48 hours.",
        },
        {
          client_name: "Jessica & David Williams",
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Normal
          location: "Chicago, IL",
          status: "active",
          editing_status: "client_review",
          drive_link: "https://drive.google.com/...",
          vimeo_link: "https://vimeo.com/123456",
        },
        {
          client_name: "Ashley & Christopher Brown",
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Normal
          location: "Miami, FL",
          status: "active",
          editing_status: "awaiting_raw_media",
        },
      ];

      for (const w of mockWeddings) {
        await supabase.from("weddings").insert(w);
      }

      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({ title: "Mock data generated successfully" });
    } catch (error) {
      toast({ title: "Error generating data", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Post-Production
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            High-density data table for managing edits.
          </p>
        </div>
        <Button onClick={generateMockData} variant="outline" size="sm">
          Generate Mock Data
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search weddings..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={editorFilter} onValueChange={setEditorFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by editor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Editors</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {editors.map((editor) => (
                <SelectItem key={editor.id} value={editor.id}>
                  {editor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-[120px] cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setSortColumn("date");
                  setSortDirection(
                    sortColumn === "date" && sortDirection === "desc"
                      ? "asc"
                      : "desc",
                  );
                }}
              >
                <div className="flex items-center gap-1">
                  Date{" "}
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
                className="min-w-[180px] cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setSortColumn("client");
                  setSortDirection(
                    sortColumn === "client" && sortDirection === "desc"
                      ? "asc"
                      : "desc",
                  );
                }}
              >
                <div className="flex items-center gap-1">
                  Client{" "}
                  {sortColumn === "client" ? (
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
                className="w-[140px] cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setSortColumn("deadline");
                  setSortDirection(
                    sortColumn === "deadline" && sortDirection === "desc"
                      ? "asc"
                      : "desc",
                  );
                }}
              >
                <div className="flex items-center gap-1">
                  Deadline{" "}
                  {sortColumn === "deadline" ? (
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
                className="w-[160px] cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setSortColumn("editor");
                  setSortDirection(
                    sortColumn === "editor" && sortDirection === "desc"
                      ? "asc"
                      : "desc",
                  );
                }}
              >
                <div className="flex items-center gap-1">
                  Editor{" "}
                  {sortColumn === "editor" ? (
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
                className="w-[200px] cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setSortColumn("status");
                  setSortDirection(
                    sortColumn === "status" && sortDirection === "desc"
                      ? "asc"
                      : "desc",
                  );
                }}
              >
                <div className="flex items-center gap-1">
                  Editing Status{" "}
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
              <TableHead>Links & Media</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : paginatedWeddings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No weddings found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              paginatedWeddings.map((wedding) => {
                const currentStatus =
                  wedding.editing_status || "awaiting_raw_media";
                const deadline = calculateDeadline(wedding);
                const isOverdue =
                  new Date() > deadline && currentStatus !== "delivered";
                const isNearing =
                  !isOverdue &&
                  new Date().getTime() >
                    deadline.getTime() - 5 * 24 * 60 * 60 * 1000 &&
                  currentStatus !== "delivered";

                return (
                  <TableRow key={wedding.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDisplayDate(wedding.date)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {wedding.client_name}
                    </TableCell>
                    <TableCell>
                      <div
                        className={`text-sm font-medium flex items-center gap-1.5 ${isOverdue ? "text-destructive" : isNearing ? "text-orange-500 dark:text-orange-400" : "text-muted-foreground"}`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {formatDisplayDate(deadline.toISOString())}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={wedding.editor_id || "unassigned"}
                        onValueChange={(val) =>
                          handleEditorChange(
                            wedding.id,
                            val === "unassigned" ? null : val,
                          )
                        }
                        disabled={updateWeddingMutation.isPending}
                      >
                        <SelectTrigger className="h-8 text-xs font-medium w-[140px] whitespace-nowrap">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="unassigned"
                            className="text-muted-foreground italic"
                          >
                            Unassigned
                          </SelectItem>
                          {editors.map((editor) => (
                            <SelectItem key={editor.id} value={editor.id}>
                              {editor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={currentStatus}
                        onValueChange={(val) =>
                          handleStatusChange(wedding.id, val)
                        }
                        disabled={updateWeddingMutation.isPending}
                      >
                        <SelectTrigger className="h-8 text-xs font-medium w-[160px] whitespace-nowrap">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    opt.value === "delivered"
                                      ? "bg-emerald-500"
                                      : opt.value === "awaiting_raw_media" ||
                                          opt.value === "revisions_requested"
                                        ? "bg-red-500"
                                        : "bg-blue-500"
                                  }`}
                                />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 items-center flex-wrap">
                        {wedding.drive_link ? (
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 gap-1 cursor-pointer"
                            onClick={() =>
                              window.open(wedding.drive_link!, "_blank")
                            }
                          >
                            <HardDrive className="h-3 w-3" /> Raw Media
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="opacity-50 gap-1">
                            <HardDrive className="h-3 w-3" /> Missing Raw
                          </Badge>
                        )}

                        {wedding.vimeo_link && (
                          <Badge
                            variant="secondary"
                            className="bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300 gap-1 cursor-pointer"
                            onClick={() =>
                              window.open(wedding.vimeo_link!, "_blank")
                            }
                          >
                            <Video className="h-3 w-3" /> Vimeo
                          </Badge>
                        )}

                        {wedding.youtube_link && (
                          <Badge
                            variant="secondary"
                            className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 gap-1 cursor-pointer"
                            onClick={() =>
                              window.open(wedding.youtube_link!, "_blank")
                            }
                          >
                            <Play className="h-3 w-3" /> YouTube
                          </Badge>
                        )}

                        {wedding.gallery_link && (
                          <Badge
                            variant="secondary"
                            className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 gap-1 cursor-pointer"
                            onClick={() =>
                              window.open(wedding.gallery_link!, "_blank")
                            }
                          >
                            <Image className="h-3 w-3" /> Gallery
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-y-2 align-top">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openLinksModal(wedding)}
                        className="w-full"
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {wedding.editor_invoice_status === "pending" && (
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => openReviewModal(wedding)}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Review Invoice
                        </Button>
                      )}
                      {wedding.editor_invoice_status === "approved" && (
                        <Badge
                          variant="outline"
                          className="w-full justify-center bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          Invoice Approved
                        </Badge>
                      )}
                      {wedding.editor_invoice_status === "paid" && (
                        <Badge
                          variant="outline"
                          className="w-full justify-center bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          Invoice Paid
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="p-4 border-t flex justify-end">
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
      </div>

      <Dialog open={isLinksModalOpen} onOpenChange={setIsLinksModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-muted/20 shrink-0">
            <DialogTitle>Edit Media & Links</DialogTitle>
          </DialogHeader>
          {editingWedding && (
            <form
              onSubmit={handleSaveLinks}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      Media Links
                    </h3>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-blue-500" /> Raw
                        Media Link (Drive/Dropbox)
                      </label>
                      <Input
                        name="drive_link"
                        defaultValue={editingWedding.drive_link || ""}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-emerald-500" /> Final
                        Delivery Upload Folder
                      </label>
                      <Input
                        name="upload_link"
                        defaultValue={editingWedding.upload_link || ""}
                        placeholder="https://drive.google.com/..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Video className="h-4 w-4 text-cyan-500" /> Vimeo Link
                      </label>
                      <Input
                        name="vimeo_link"
                        defaultValue={editingWedding.vimeo_link || ""}
                        placeholder="https://vimeo.com/..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Play className="h-4 w-4 text-red-500" /> YouTube Link
                      </label>
                      <Input
                        name="youtube_link"
                        defaultValue={editingWedding.youtube_link || ""}
                        placeholder="https://youtube.com/..."
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Image className="h-4 w-4 text-purple-500" /> Final
                          Gallery Link
                        </label>
                        {editingWedding.gallery_link && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={async () => {
                              const email =
                                editingWedding.client_email ||
                                editingWedding.questionnaire_data?.contact_info
                                  ?.email ||
                                editingWedding.questionnaire_data?.email;
                              let brideEmail = email;
                              if (!brideEmail) {
                                const emailMatch = editingWedding.notes?.match(
                                  /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/,
                                );
                                if (emailMatch) brideEmail = emailMatch[1];
                              }

                              if (!brideEmail) {
                                toast({
                                  variant: "destructive",
                                  title: "No Email Found",
                                  description:
                                    "Please add the bride's email in the Manage > Details tab first.",
                                });
                                return;
                              }

                              if (
                                !settings?.sms_bride_delivery_template &&
                                !settings?.email_bride_delivery_template
                              ) {
                                toast({
                                  variant: "destructive",
                                  title: "Templates Missing",
                                  description:
                                    "Please configure the Media Delivery templates in Settings.",
                                });
                                return;
                              }

                              try {
                                let sent = 0;
                                if (
                                  settings.email_bride_delivery_enabled &&
                                  settings.email_bride_delivery_template
                                ) {
                                  const subject =
                                    settings.email_bride_delivery_subject ||
                                    "Your Wedding Media is Ready!";
                                  const msg =
                                    settings.email_bride_delivery_template
                                      .replace(
                                        /{{company_name}}/g,
                                        settings.company_name || "us",
                                      )
                                      .replace(
                                        /{{bride_name}}/g,
                                        editingWedding.client_name || "Bride",
                                      )
                                      .replace(
                                        /{{gallery_link}}/g,
                                        editingWedding.gallery_link || "",
                                      )
                                      .replace(
                                        /{{portal_link}}/g,
                                        `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/bride-portal/${editingWedding.id}`,
                                      )
                                      .replace(
                                        /{{logo_url}}/g,
                                        settings.logo_url || "",
                                      );

                                  await api.sendOvantaEmail(
                                    brideEmail,
                                    subject,
                                    msg,
                                    editingWedding.client_name,
                                    true,
                                  );
                                  sent++;
                                }

                                if (
                                  settings.sms_bride_delivery_enabled &&
                                  settings.sms_bride_delivery_template
                                ) {
                                  const msg =
                                    settings.sms_bride_delivery_template
                                      .replace(
                                        /{{company_name}}/g,
                                        settings.company_name || "us",
                                      )
                                      .replace(
                                        /{{bride_name}}/g,
                                        editingWedding.client_name || "Bride",
                                      )
                                      .replace(
                                        /{{gallery_link}}/g,
                                        editingWedding.gallery_link || "",
                                      )
                                      .replace(
                                        /{{portal_link}}/g,
                                        `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/bride-portal/${editingWedding.id}`,
                                      );

                                  await api.sendOvantaSms(
                                    brideEmail,
                                    msg,
                                    editingWedding.client_name,
                                    true,
                                  );
                                  sent++;
                                }

                                if (sent > 0) {
                                  toast({
                                    title: "Notifications Sent!",
                                    description: `Successfully sent delivery notification to ${brideEmail}`,
                                  });
                                } else {
                                  toast({
                                    variant: "destructive",
                                    title: "Not Sent",
                                    description:
                                      "Both Email and SMS delivery notifications are disabled in Settings.",
                                  });
                                }
                              } catch (err: any) {
                                toast({
                                  variant: "destructive",
                                  title: "Failed to send",
                                  description: err.message,
                                });
                              }
                            }}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Notify Bride
                          </Button>
                        )}
                      </div>
                      <Input
                        name="gallery_link"
                        defaultValue={editingWedding.gallery_link || ""}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      Notes & Deadlines
                    </h3>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" /> Editor Due
                        Date
                      </label>
                      <Input
                        type="date"
                        name="editor_due_date"
                        defaultValue={
                          editingWedding.editor_due_date
                            ? new Date(editingWedding.editor_due_date)
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />{" "}
                        Editor Notes / Instructions
                      </label>
                      <Textarea
                        name="editing_notes"
                        defaultValue={editingWedding.editing_notes || ""}
                        placeholder="Specific editing instructions..."
                        className="min-h-[120px] resize-none"
                      />
                    </div>

                    <div className="space-y-2 bg-red-50/50 dark:bg-red-950/20 p-4 rounded-lg border border-red-100 dark:border-red-900/30">
                      <label className="text-sm font-medium flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertCircle className="h-4 w-4" /> Revisions Feedback
                      </label>
                      <Textarea
                        name="revisions_notes"
                        defaultValue={editingWedding.revisions_notes || ""}
                        placeholder="Feedback and revision requests for the editor..."
                        className="min-h-[120px] resize-none border-red-200 dark:border-red-900/50 focus-visible:ring-red-500 bg-white dark:bg-background"
                      />
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        Editor Targets
                      </h3>

                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Image className="h-4 w-4 text-primary" /> Target
                          Photo Count
                        </label>
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
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Video className="h-4 w-4 text-primary" /> Target
                            Videos
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddVideoTarget}
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
                              <div
                                key={index}
                                className="flex items-center gap-2"
                              >
                                <Select
                                  value={vidId}
                                  onValueChange={(val) =>
                                    handleVideoTargetChange(index, val)
                                  }
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {videoPricing.map((v) => (
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
                                  onClick={() => handleRemoveVideoTarget(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t bg-muted/20 flex flex-col-reverse sm:flex-row justify-between gap-3 shrink-0">
                {editingWedding.editing_status !== "revisions_requested" ? (
                  <Button
                    type="submit"
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={() => setSubmitAction("revisions")}
                    disabled={updateWeddingMutation.isPending}
                  >
                    {updateWeddingMutation.isPending &&
                    submitAction === "revisions" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mr-2" />
                    )}
                    Send for Revisions
                  </Button>
                ) : (
                  <div className="hidden sm:block" />
                )}
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsLinksModalOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    onClick={() => setSubmitAction("save")}
                    disabled={updateWeddingMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {updateWeddingMutation.isPending &&
                    submitAction === "save" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Editor Invoice</DialogTitle>
          </DialogHeader>
          {reviewWedding && reviewWedding.editor_invoice_details && (
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Image className="h-4 w-4" /> Photos Edited
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      {reviewWedding.editor_invoice_details.photoCount} images @
                      $0.12
                    </div>
                    <div className="font-semibold">
                      $
                      {reviewWedding.editor_invoice_details.photoTotal?.toFixed(
                        2,
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg border space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Video className="h-4 w-4" /> Videos Edited
                  </h3>
                  {reviewWedding.editor_invoice_details.videos?.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">
                      No videos included.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reviewWedding.editor_invoice_details.videos?.map(
                        (v: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-sm"
                          >
                            <div>{v.label}</div>
                            <div className="font-semibold">${v.price}</div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Total Payout
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                    ${reviewWedding.editor_payout_amount?.toFixed(2)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsReviewModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={updateWeddingMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleApproveInvoice}
                  >
                    {updateWeddingMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Approve Invoice
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
