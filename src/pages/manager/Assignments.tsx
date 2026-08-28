import { useState } from "react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Loader2,
  MoreHorizontal,
  Check,
  X,
  Clock,
  Link2,
  Star,
  MessageSquare,
  Undo,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AssignmentCalendar } from "@/components/AssignmentCalendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatDisplayDate } from "@/lib/utils";

export default function ManagerAssignments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const itemsPerPage = 10;

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateAssignmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast({
        title: "Status updated",
        description: "The assignment status has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update assignment status.",
        variant: "destructive",
      });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(
        ids.map((id) => api.updateAssignmentStatus(id, status)),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setSelectedIds(new Set());
      toast({
        title: "Statuses updated",
        description: "The selected assignments have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk update failed",
        description: error.message || "Failed to update assignment statuses.",
        variant: "destructive",
      });
    },
  });

  const upcomingAssignments = assignments
    .filter(
      (a: any) =>
        a.status !== "Completed" &&
        a.status !== "Cancelled" &&
        a.status !== "cancelled",
    )
    .sort((a: any, b: any) => {
      const dateA = new Date(a.jobs?.weddings?.date || "9999-12-31").getTime();
      const dateB = new Date(b.jobs?.weddings?.date || "9999-12-31").getTime();
      return dateA - dateB; // Closest first
    });

  const completedAssignments = assignments
    .filter(
      (a: any) =>
        a.status === "Completed" ||
        a.status === "Cancelled" ||
        a.status === "cancelled",
    )
    .sort((a: any, b: any) => {
      const dateA = new Date(a.jobs?.weddings?.date || 0).getTime();
      const dateB = new Date(b.jobs?.weddings?.date || 0).getTime();
      return dateB - dateA; // Most recent past first
    });

  const renderTable = (
    data: any[],
    currentPage: number,
    setCurrentPage: (page: number | ((prev: number) => number)) => void,
  ) => {
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const paginatedData = data.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );
    const allIds = data.map((a) => a.id);
    const isAllSelected =
      data.length > 0 && data.every((a) => selectedIds.has(a.id));
    const isSomeSelected = data.some((a) => selectedIds.has(a.id));

    const toggleAll = () => {
      if (isAllSelected) {
        const newSelected = new Set(selectedIds);
        data.forEach((a) => newSelected.delete(a.id));
        setSelectedIds(newSelected);
      } else {
        const newSelected = new Set(selectedIds);
        data.forEach((a) => newSelected.add(a.id));
        setSelectedIds(newSelected);
      }
    };

    const toggleRow = (id: string) => {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedIds(newSelected);
    };

    return (
      <div className="space-y-4">
        {isSomeSelected && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border">
            <span className="text-sm font-medium ml-2">
              {data.filter((a) => selectedIds.has(a.id)).length} selected
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  bulkUpdateStatusMutation.mutate({
                    ids: Array.from(selectedIds),
                    status: "Completed",
                  })
                }
                disabled={bulkUpdateStatusMutation.isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                Mark Completed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  bulkUpdateStatusMutation.mutate({
                    ids: Array.from(selectedIds),
                    status: "Upcoming",
                  })
                }
                disabled={bulkUpdateStatusMutation.isPending}
              >
                <Clock className="mr-2 h-4 w-4" />
                Mark Upcoming
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  bulkUpdateStatusMutation.mutate({
                    ids: Array.from(selectedIds),
                    status: "Cancelled",
                  })
                }
                disabled={bulkUpdateStatusMutation.isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel Selected
              </Button>
            </div>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    isAllSelected || (isSomeSelected ? "indeterminate" : false)
                  }
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Wedding</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Contractor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Client Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No assignments found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((assg: any) => {
                const job = assg.jobs;
                const wedding = job?.weddings;
                const contractor = assg.contractors;
                const isSelected = selectedIds.has(assg.id);

                let displayStatus = assg.status;
                if (
                  assg.status?.toLowerCase() === "upcoming" &&
                  wedding?.date
                ) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const datePart = wedding.date.split("T")[0];
                  const [year, month, day] = datePart.split("-").map(Number);
                  const wDate = new Date(year, month - 1, day);

                  if (wDate.getTime() === today.getTime())
                    displayStatus = "Today";
                  else if (wDate.getTime() < today.getTime())
                    displayStatus = "Past";
                }

                return (
                  <TableRow
                    key={assg.id}
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(assg.id)}
                        aria-label={`Select assignment ${assg.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {wedding?.client_name}
                    </TableCell>
                    <TableCell>{job?.role}</TableCell>
                    <TableCell>
                      {contractor?.first_name} {contractor?.last_name}
                    </TableCell>
                    <TableCell>{formatDisplayDate(wedding?.date)}</TableCell>
                    <TableCell>
                      {[
                        "upcoming",
                        "accepted",
                        "confirmed",
                        "assigned",
                      ].includes(assg.status?.toLowerCase()) ? (
                        assg.attendance_confirmed ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            Confirmed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                          >
                            Unconfirmed
                          </Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assg.client_rating ? (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-yellow-500 flex items-center">
                            {assg.client_rating}{" "}
                            <Star className="h-3 w-3 ml-0.5 fill-yellow-500" />
                          </span>
                          {assg.client_feedback && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <MessageSquare className="h-4 w-4 text-muted-foreground cursor-help ml-1" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[250px] whitespace-normal">
                                <p className="text-sm font-semibold mb-1">
                                  Feedback:
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {assg.client_feedback}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          displayStatus === "Completed"
                            ? "default"
                            : displayStatus === "Cancelled" ||
                                displayStatus === "cancelled"
                              ? "destructive"
                              : displayStatus === "Today"
                                ? "default"
                                : displayStatus === "Past"
                                  ? "secondary"
                                  : "secondary"
                        }
                        className={
                          displayStatus === "Today"
                            ? "bg-purple-50 text-purple-700 hover:bg-purple-100/80 dark:bg-purple-950/30 dark:text-purple-400 border-transparent shadow-sm"
                            : displayStatus === "Past"
                              ? "bg-orange-50 text-orange-700 hover:bg-orange-100/80 dark:bg-orange-950/30 dark:text-orange-400 border-transparent shadow-sm"
                              : ""
                        }
                      >
                        {displayStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={async () => {
                              const link = `${window.location.origin}/feedback/${wedding?.id}`;
                              try {
                                if (
                                  navigator.clipboard &&
                                  window.isSecureContext
                                ) {
                                  await navigator.clipboard.writeText(link);
                                  toast({
                                    title: "Link Copied",
                                    description:
                                      "Feedback link copied to clipboard.",
                                  });
                                } else {
                                  throw new Error(
                                    "Clipboard API not available",
                                  );
                                }
                              } catch (err) {
                                // Fallback for blocked clipboard API
                                const textArea =
                                  document.createElement("textarea");
                                textArea.value = link;
                                document.body.appendChild(textArea);
                                textArea.select();
                                try {
                                  document.execCommand("copy");
                                  toast({
                                    title: "Link Copied",
                                    description:
                                      "Feedback link copied to clipboard.",
                                  });
                                } catch (err2) {
                                  toast({
                                    title: "Failed to copy",
                                    description:
                                      "Please copy the link manually: " + link,
                                    variant: "destructive",
                                  });
                                }
                                document.body.removeChild(textArea);
                              }
                            }}
                          >
                            <Link2 className="mr-2 h-4 w-4" />
                            Copy Feedback Link
                          </DropdownMenuItem>
                          {assg.status !== "Completed" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: assg.id,
                                  status: "Completed",
                                })
                              }
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Mark Completed
                            </DropdownMenuItem>
                          )}
                          {assg.status !== "Upcoming" &&
                            assg.status !== "Completed" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: assg.id,
                                    status: "Upcoming",
                                  })
                                }
                              >
                                <Clock className="mr-2 h-4 w-4" />
                                Mark Upcoming
                              </DropdownMenuItem>
                            )}
                          {assg.status === "Pending Payout" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: assg.id,
                                  status: "Action Required",
                                })
                              }
                            >
                              <Undo className="mr-2 h-4 w-4" />
                              Reject back to contractor
                            </DropdownMenuItem>
                          )}
                          {assg.status !== "Cancelled" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: assg.id,
                                  status: "Cancelled",
                                })
                              }
                              className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel Assignment
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Assignments
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage active and completed assignments.
          </p>
        </div>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming & Active</TabsTrigger>
          <TabsTrigger value="completed">Completed & Cancelled</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTable(upcomingAssignments, upcomingPage, setUpcomingPage)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Completed Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTable(
                completedAssignments,
                completedPage,
                setCompletedPage,
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <AssignmentCalendar assignments={assignments} role="manager" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
