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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserMinus, UserPlus, Star } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export default function ManagerApplications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reassignApp, setReassignApp] = useState<any>(null);
  const [selectedContractor, setSelectedContractor] = useState<string>("");

  const { data: applications = [], isLoading: isLoadingApps } = useQuery({
    queryKey: ["applications"],
    queryFn: api.getApplications,
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
  });

  const { data: blackoutDates = [] } = useQuery({
    queryKey: ["all-blackout-dates"],
    queryFn: async () => {
      const { data } = await supabase.from("blackout_dates").select("*");
      return data || [];
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
              : status === "not_selected"
                ? `Another contractor was selected for ${job?.role} at ${wedding?.client_name}'s wedding. Thank you for applying!`
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
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: error.message,
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async ({ app }: { app: any }) => {
      const job = app.jobs;
      const wedding = job?.weddings;

      // 1. Decline old application
      await api.updateApplicationStatus(app.id, "declined");

      // 2. Cancel assignment
      await api.cancelAssignmentByJobAndContractor(
        app.job_id,
        app.contractor_id,
      );

      // 3. Update job to open
      await api.updateJob(app.job_id, { status: "open" });

      // 4. Notify old contractor
      try {
        await api.createNotification({
          contractor_id: app.contractor_id,
          title: "Assignment Cancelled",
          message: `You have been unassigned from ${job?.role} for ${wedding?.client_name}'s wedding.`,
          type: "assignment",
        });
      } catch (e) {
        console.error(e);
      }

      // 5. Notify all other contractors about the open position
      try {
        const activeContractors = contractors.filter(
          (c) => c.status === "active",
        );
        for (const c of activeContractors) {
          if (c.id !== app.contractor_id) {
            await api.createNotification({
              contractor_id: c.id,
              title: "New Position Available!",
              message: `A ${job?.role} position has opened up for ${wedding?.client_name}'s wedding.`,
              type: "job",
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({
        title: "Position Unassigned",
        description: "The position is now open for new applications.",
      });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async ({
      app,
      newContractorId,
    }: {
      app: any;
      newContractorId: string;
    }) => {
      const job = app.jobs;
      const wedding = job?.weddings;

      // 1. Decline old application
      await api.updateApplicationStatus(app.id, "declined");

      // 2. Cancel old assignment
      await api.cancelAssignmentByJobAndContractor(
        app.job_id,
        app.contractor_id,
      );

      // 3. Notify old contractor
      try {
        await api.createNotification({
          contractor_id: app.contractor_id,
          title: "Assignment Cancelled",
          message: `You have been unassigned from ${job?.role} for ${wedding?.client_name}'s wedding.`,
          type: "assignment",
        });
      } catch (e) {
        console.error(e);
      }

      // 4. Create new application for new contractor
      const newApp = await api.applyForJob({
        job_id: app.job_id,
        contractor_id: newContractorId,
        message: "Assigned directly by Manager",
      });
      await api.updateApplicationStatus(newApp.id, "awarded");

      // 5. Create new assignment
      await api.createAssignment({
        job_id: app.job_id,
        contractor_id: newContractorId,
        status: "upcoming",
      });

      // 6. Update job status
      await api.updateJob(app.job_id, { status: "filled" });

      // 7. Notify new contractor
      try {
        await api.createNotification({
          contractor_id: newContractorId,
          title: "New Assignment!",
          message: `You have been assigned as ${job?.role} for ${wedding?.client_name}'s wedding.`,
          type: "assignment",
        });
      } catch (e) {
        console.error(e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setReassignApp(null);
      setSelectedContractor("");
      toast({
        title: "Position Reassigned",
        description: "The position has been successfully reassigned.",
      });
    },
  });

  const handleStatusChange = (app: any, status: string) => {
    if (status === "awarded") {
      const jobDateStr = app.jobs?.weddings?.date;
      if (jobDateStr) {
        const jobDate = new Date(jobDateStr);
        jobDate.setHours(0, 0, 0, 0);
        const hasBlackout = blackoutDates.some((bd: any) => {
          if (bd.contractor_id !== app.contractor_id) return false;
          const [sy, sm, sd] = bd.start_date.split("-").map(Number);
          const [ey, em, ed] = bd.end_date.split("-").map(Number);
          const start = new Date(sy, sm - 1, sd);
          const end = new Date(ey, em - 1, ed);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          return jobDate >= start && jobDate <= end;
        });

        if (hasBlackout) {
          if (
            !window.confirm(
              "Warning: This contractor has a blackout date that overlaps with this wedding. Are you sure you want to assign them anyway?",
            )
          ) {
            return;
          }
        }
      }
    }
    updateStatusMutation.mutate({ id: app.id, status, app });
  };

  const pendingApps = applications.filter(
    (a: any) => a.status === "pending" || a.status === "under_review",
  );
  const staleApps = pendingApps.filter(
    (a: any) =>
      !a.jobs || ["filled", "completed", "cancelled"].includes(a.jobs?.status),
  );

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      for (const app of staleApps) {
        await api.updateApplicationStatus(app.id, "not_selected");
        const job = app.jobs;
        const wedding = job?.weddings;
        try {
          await api.createNotification({
            contractor_id: app.contractor_id,
            title: "Application Update",
            message: `Another contractor was selected for ${job?.role || "the position"} at ${wedding?.client_name || "the"}'s wedding. Thank you for applying!`,
            type: "job",
          });
        } catch (e) {
          console.error("Failed to create notification", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast({
        title: "Cleanup Complete",
        description: `Closed ${staleApps.length} stale applications.`,
      });
    },
  });

  const reviewedApps = applications.filter(
    (a: any) =>
      a.status === "awarded" ||
      a.status === "declined" ||
      a.status === "not_selected",
  );

  const renderTable = (apps: any[], isReviewedTab: boolean = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contractor</TableHead>
          <TableHead>Wedding</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoadingApps ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </TableCell>
          </TableRow>
        ) : apps.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center py-8 text-muted-foreground"
            >
              No applications found.
            </TableCell>
          </TableRow>
        ) : (
          apps.map((app: any) => {
            const job = app.jobs;
            const wedding = job?.weddings;
            const contractor = app.contractors;

            let hasBlackout = false;
            if (wedding?.date && contractor?.id) {
              const jobDate = new Date(wedding.date);
              jobDate.setHours(0, 0, 0, 0);
              hasBlackout = blackoutDates.some((bd: any) => {
                if (bd.contractor_id !== contractor.id) return false;
                const [sy, sm, sd] = bd.start_date.split("-").map(Number);
                const [ey, em, ed] = bd.end_date.split("-").map(Number);
                const start = new Date(sy, sm - 1, sd);
                const end = new Date(ey, em - 1, ed);
                start.setHours(0, 0, 0, 0);
                end.setHours(0, 0, 0, 0);
                return jobDate >= start && jobDate <= end;
              });
            }

            return (
              <TableRow key={app.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      {contractor?.first_name} {contractor?.last_name}
                      {hasBlackout && (
                        <Badge
                          variant="destructive"
                          className="ml-2 text-[10px] uppercase"
                        >
                          Blackout
                        </Badge>
                      )}
                    </div>
                    {(contractor?.rating !== undefined ||
                      contractor?.specialty) && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-normal">
                        {contractor?.rating ? (
                          <span className="flex items-center text-amber-500 font-bold">
                            {contractor.rating.toFixed(1)}{" "}
                            <Star className="h-3 w-3 fill-current ml-0.5" />
                          </span>
                        ) : (
                          <span className="flex items-center text-muted-foreground font-medium">
                            New{" "}
                            <Star className="h-3 w-3 fill-current ml-0.5 opacity-50" />
                          </span>
                        )}
                        {contractor?.specialty && (
                          <span>• {contractor.specialty}</span>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {wedding?.client_name || "Unknown Wedding"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{job?.role || "Unknown Position"}</span>
                    {job?.pay_type === "bidding" ? (
                      app.bid_amount != null ? (
                        <span className="text-xs text-muted-foreground mt-0.5">
                          Bid: ${app.bid_amount}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground mt-0.5">
                          Bidding
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        Rate: ${job?.pay_rate || 0}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={
                      app.status === "not_selected"
                        ? "Not Selected"
                        : app.status === "under_review"
                          ? "Under Review"
                          : app.status
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {(app.status === "pending" ||
                      app.status === "under_review") && (
                      <>
                        {!job ||
                        ["filled", "completed", "cancelled"].includes(
                          job?.status,
                        ) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleStatusChange(app, "not_selected")
                            }
                            disabled={updateStatusMutation.isPending}
                          >
                            Close (Job Filled)
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleStatusChange(app, "awarded")}
                              disabled={updateStatusMutation.isPending}
                            >
                              Assign
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleStatusChange(app, "declined")
                              }
                              disabled={updateStatusMutation.isPending}
                            >
                              Decline
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {app.status === "awarded" && isReviewedTab && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => unassignMutation.mutate({ app })}
                          disabled={unassignMutation.isPending}
                        >
                          <UserMinus className="h-4 w-4 mr-1" /> Unassign
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReassignApp(app)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" /> Reassign
                        </Button>
                      </>
                    )}
                    {(app.status === "declined" ||
                      app.status === "not_selected") &&
                      isReviewedTab && (
                        <span className="text-xs text-muted-foreground italic mr-2">
                          {app.status === "not_selected"
                            ? "Not Selected"
                            : "Declined"}
                        </span>
                      )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Applications
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Review and manage job applications.
          </p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingApps.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed & Awarded</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Pending Applications</CardTitle>
              {staleApps.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cleanupMutation.mutate()}
                  disabled={cleanupMutation.isPending}
                >
                  {cleanupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Close {staleApps.length} Stale Apps
                </Button>
              )}
            </CardHeader>
            <CardContent>{renderTable(pendingApps)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviewed">
          <Card>
            <CardHeader>
              <CardTitle>Reviewed Applications</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(reviewedApps, true)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!reassignApp}
        onOpenChange={(open) => !open && setReassignApp(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Position</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will cancel the current assignment for{" "}
              <strong>
                {reassignApp?.contractors?.first_name}{" "}
                {reassignApp?.contractors?.last_name}
              </strong>{" "}
              and assign the job to the selected contractor instead.
            </p>
            <Select
              value={selectedContractor}
              onValueChange={setSelectedContractor}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a new contractor" />
              </SelectTrigger>
              <SelectContent>
                {contractors
                  .filter((c) => {
                    if (
                      c.id === reassignApp?.contractor_id ||
                      c.status !== "active"
                    )
                      return false;

                    // Check blackout dates
                    const jobDateStr = reassignApp?.jobs?.weddings?.date;
                    if (!jobDateStr) return true;

                    const jobDate = new Date(jobDateStr);
                    jobDate.setHours(0, 0, 0, 0);

                    const hasBlackout = blackoutDates.some((bd: any) => {
                      if (bd.contractor_id !== c.id) return false;
                      const [sy, sm, sd] = bd.start_date.split("-").map(Number);
                      const [ey, em, ed] = bd.end_date.split("-").map(Number);
                      const start = new Date(sy, sm - 1, sd);
                      const end = new Date(ey, em - 1, ed);
                      start.setHours(0, 0, 0, 0);
                      end.setHours(0, 0, 0, 0);
                      return jobDate >= start && jobDate <= end;
                    });

                    return !hasBlackout;
                  })
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}{" "}
                      {c.rating ? `(⭐ ${c.rating.toFixed(1)})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignApp(null)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedContractor || reassignMutation.isPending}
              onClick={() =>
                reassignMutation.mutate({
                  app: reassignApp,
                  newContractorId: selectedContractor,
                })
              }
            >
              {reassignMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reassign Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
