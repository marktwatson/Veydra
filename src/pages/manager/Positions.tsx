import { useState, useEffect } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Plus, AlertCircle, Send, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, getEligibleContractorsForJob } from "@/lib/api";
import { cn, getRateCalculationTooltip, formatDisplayDate } from "@/lib/utils";

function ResendAlertsDialog({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: eligibleData = [], isLoading } = useQuery({
    queryKey: ["eligibleContractors", jobId],
    queryFn: () =>
      jobId ? getEligibleContractorsForJob(jobId) : Promise.resolve([]),
    enabled: !!jobId && open,
  });

  // Pre-select eligible contractors when data loads
  useEffect(() => {
    if (eligibleData.length > 0) {
      const initialSelected = new Set<string>();
      eligibleData.forEach((item) => {
        if (item.isEligible) initialSelected.add(item.contractor.id);
      });
      setSelectedIds(initialSelected);
    }
  }, [eligibleData]);

  const toggleContractor = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const resendAlertsMutation = useMutation({
    mutationFn: (ids: string[]) => api.resendJobAlerts(jobId!, ids),
    onSuccess: (sentCount) => {
      toast({
        title: "Alerts Sent",
        description: `Successfully sent alerts to ${sentCount} contractors.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to send alerts",
        description: error.message,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Send Job Alerts</DialogTitle>
          <DialogDescription>
            Select the contractors you want to invite to this position.
            Contractors are sorted by rating.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const eligible = new Set<string>();
                    eligibleData.forEach((item) => {
                      if (item.isEligible) eligible.add(item.contractor.id);
                    });
                    setSelectedIds(eligible);
                  }}
                >
                  Select Eligible
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear All
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto -mx-6 px-6 py-2">
              <div className="space-y-4">
                {eligibleData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No active contractors found.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {eligibleData.map(({ contractor, isEligible, reason }) => (
                      <label
                        key={contractor.id}
                        className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(contractor.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      >
                        <Checkbox
                          checked={selectedIds.has(contractor.id)}
                          onCheckedChange={() =>
                            toggleContractor(contractor.id)
                          }
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-medium truncate">
                                {contractor.first_name} {contractor.last_name}
                              </span>
                              {contractor.rating ? (
                                <div className="flex items-center text-yellow-500 text-xs font-medium">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-3 h-3 mr-0.5"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  {contractor.rating}
                                </div>
                              ) : null}
                            </div>
                            {!isEligible && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] shrink-0 ml-2"
                              >
                                {reason || "Not eligible"}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {contractor.region?.join(", ") || "No region"} •{" "}
                            {contractor.specialty || "No specialty"}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => resendAlertsMutation.mutate(Array.from(selectedIds))}
            disabled={resendAlertsMutation.isPending || selectedIds.size === 0}
          >
            {resendAlertsMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Send to {selectedIds.size} Contractor{selectedIds.size !== 1 && "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PositionsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [resendJobId, setResendJobId] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [newDroneRequired, setNewDroneRequired] = useState(false);
  const [editDroneRequired, setEditDroneRequired] = useState(false);
  const [newAddons, setNewAddons] = useState<string[]>([]);
  const [editAddons, setEditAddons] = useState<string[]>([]);
  const [newRole, setNewRole] = useState<string>("");
  const [newHours, setNewHours] = useState<string>("");
  const [newRate, setNewRate] = useState<string>("");
  const [newPayType, setNewPayType] = useState<"flat" | "bidding">("flat");
  const [editPayType, setEditPayType] = useState<"flat" | "bidding">("flat");
  const [editRole, setEditRole] = useState<string>("");
  const [editHours, setEditHours] = useState<string>("");
  const [editRate, setEditRate] = useState<string>("");

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
  });

  const calculateRate = (role: string, hoursStr: string) => {
    const hours = parseFloat(hoursStr);
    if (!isNaN(hours) && hours > 0) {
      const roleLower = role.toLowerCase();
      if (roleLower.includes("photo") && settings?.photo_pay_rate != null) {
        return (hours * settings.photo_pay_rate).toString();
      } else if (
        roleLower.includes("video") &&
        settings?.video_pay_rate != null
      ) {
        return (hours * settings.video_pay_rate).toString();
      }
    }
    return "";
  };

  const handleRoleOrHoursChange = (role: string, hoursStr: string) => {
    setNewRole(role);
    setNewHours(hoursStr);
    const calculated = calculateRate(role, hoursStr);
    if (calculated) setNewRate(calculated);
  };

  const handlePayTypeChange = (val: "flat" | "bidding") => {
    setNewPayType(val);
    if (val === "flat") {
      const calculated = calculateRate(newRole, newHours);
      if (calculated) setNewRate(calculated);
    }
  };

  const handleEditRoleOrHoursChange = (role: string, hoursStr: string) => {
    setEditRole(role);
    setEditHours(hoursStr);
    const calculated = calculateRate(role, hoursStr);
    if (calculated) setEditRate(calculated);
  };

  const handleEditPayTypeChange = (val: "flat" | "bidding") => {
    setEditPayType(val);
    if (val === "flat") {
      const calculated = calculateRate(editRole, editHours);
      if (calculated) setEditRate(calculated);
    }
  };

  const ADDON_OPTIONS = [
    "Engagement Session: 1.5 hour photo",
    "Bridal Session: 1.5 hour photo",
  ];

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: jobs = [],
    isLoading: isLoadingJobs,
    error: jobsError,
  } = useQuery({
    queryKey: ["jobs"],
    queryFn: api.getJobs,
  });

  const openJobs = jobs.filter((j: any) => j.status === "open");
  const filledJobs = jobs.filter((j: any) => j.status !== "open");

  const { data: weddings = [], isLoading: isLoadingWeddings } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  const createJobMutation = useMutation({
    mutationFn: api.createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setIsDialogOpen(false);
      setNewAddons([]);
      setNewRole("");
      setNewHours("");
      setNewRate("");
      toast({
        title: "Position Created",
        description: "The position has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create position",
        description: error.message,
      });
    },
  });

  const handleAddPosition = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    createJobMutation.mutate({
      wedding_id: formData.get("weddingId") as string,
      role: formData.get("role") as string,
      pay_type: newPayType,
      pay_rate: parseFloat(formData.get("rate") as string) || 0,
      hours: formData.get("hours")
        ? parseFloat(formData.get("hours") as string)
        : null,
      status: "open",
      requirements: formData.get("requirements") as string,
      drone_required: newDroneRequired,
      addons: newAddons,
    });
  };

  const updateJobMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      api.updateJob(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setEditingJob(null);
      setEditAddons([]);
      toast({
        title: "Position Updated",
        description: "The position has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update position",
        description: error.message,
      });
    },
  });

  const handleUpdatePosition = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingJob) return;
    const formData = new FormData(e.currentTarget);

    updateJobMutation.mutate({
      id: editingJob.id,
      updates: {
        wedding_id: formData.get("weddingId") as string,
        role: formData.get("role") as string,
        pay_type: editPayType,
        pay_rate: parseFloat(formData.get("rate") as string) || 0,
        hours: formData.get("hours")
          ? parseFloat(formData.get("hours") as string)
          : null,
        status: formData.get("status") as string,
        requirements: formData.get("requirements") as string,
        drone_required: editDroneRequired,
        addons: editAddons,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setNewDroneRequired(false);
              setNewAddons([]);
              setNewRole("");
              setNewHours("");
              setNewRate("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Position
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleAddPosition}>
              <DialogHeader>
                <DialogTitle>Create New Position</DialogTitle>
                <DialogDescription>
                  Add a new job opportunity for contractors to apply to.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="weddingId" className="text-right">
                    Wedding
                  </Label>
                  <div className="col-span-3">
                    <Select name="weddingId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a wedding" />
                      </SelectTrigger>
                      <SelectContent>
                        {weddings.map((w: any) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.client_name} - {formatDisplayDate(w.date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">
                    Role
                  </Label>
                  <div className="col-span-3">
                    <Select
                      name="role"
                      required
                      value={newRole}
                      onValueChange={(val) =>
                        handleRoleOrHoursChange(val, newHours)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
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
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="hours" className="text-right">
                    Hours
                  </Label>
                  <Input
                    id="hours"
                    name="hours"
                    type="number"
                    step="0.5"
                    placeholder="e.g. 8"
                    className="col-span-3"
                    value={newHours}
                    onChange={(e) =>
                      handleRoleOrHoursChange(newRole, e.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="pay_type" className="text-right">
                    Pay Type
                  </Label>
                  <div className="col-span-3">
                    <Select
                      value={newPayType}
                      onValueChange={handlePayTypeChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pay type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate</SelectItem>
                        <SelectItem value="bidding">
                          Contractor Bidding
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {newPayType === "flat" && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="flex items-center justify-end gap-1">
                      <Label htmlFor="rate" className="text-right">
                        Pay Rate ($)
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            tabIndex={-1}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="whitespace-pre-wrap text-xs">
                          {getRateCalculationTooltip(
                            {
                              role: newRole,
                              hours: parseFloat(newHours) || null,
                              pay_rate: parseFloat(newRate) || 0,
                              addons: newAddons,
                            },
                            settings,
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="rate"
                      name="rate"
                      type="number"
                      step="0.01"
                      placeholder="500.00"
                      className="col-span-3"
                      required={newPayType === "flat"}
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                    />
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="requirements" className="text-right">
                    Requirements
                  </Label>
                  <Input
                    id="requirements"
                    name="requirements"
                    placeholder="Must have own drone"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="drone_required" className="text-right">
                    Requires Drone
                  </Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <Switch
                      id="drone_required"
                      checked={newDroneRequired}
                      onCheckedChange={setNewDroneRequired}
                    />
                    <Label
                      htmlFor="drone_required"
                      className="font-normal text-muted-foreground"
                    >
                      Contractor must be drone approved
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">Addons</Label>
                  <div className="col-span-3 space-y-2">
                    {ADDON_OPTIONS.map((addon) => (
                      <div key={addon} className="flex items-center space-x-2">
                        <Checkbox
                          id={`new-addon-${addon.replace(/\s+/g, "-")}`}
                          checked={newAddons.includes(addon)}
                          onCheckedChange={(checked) => {
                            if (checked) setNewAddons([...newAddons, addon]);
                            else
                              setNewAddons(
                                newAddons.filter((a) => a !== addon),
                              );
                          }}
                        />
                        <Label
                          htmlFor={`new-addon-${addon.replace(/\s+/g, "-")}`}
                          className="font-normal text-sm"
                        >
                          {addon}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createJobMutation.isPending}>
                  {createJobMutation.isPending ? "Saving..." : "Save Position"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="open" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="open" className="relative">
            Open Positions
            {openJobs.length > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {openJobs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="filled">Filled / Completed</TabsTrigger>
          <TabsTrigger value="all">All Positions</TabsTrigger>
        </TabsList>

        {[
          { value: "open", data: openJobs, title: "Open Positions" },
          { value: "filled", data: filledJobs, title: "Filled Positions" },
          { value: "all", data: jobs, title: "All Positions" },
        ].map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <Card>
              <CardHeader>
                <CardTitle>{tab.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {jobsError ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-destructive">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p className="font-semibold">Failed to load positions.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This usually happens if the database relationship between
                      Jobs and Weddings is broken.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wedding</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingJobs ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : tab.data.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No positions found in this category.
                          </TableCell>
                        </TableRow>
                      ) : (
                        tab.data.map((job: any) => {
                          const isUrgent =
                            job.status === "open" &&
                            job.weddings?.date &&
                            new Date(job.weddings.date).getTime() -
                              new Date().getTime() <
                              14 * 24 * 60 * 60 * 1000;
                          return (
                            <TableRow
                              key={job.id}
                              className={cn(
                                job.status === "open" &&
                                  "bg-amber-50/50 dark:bg-amber-950/20",
                              )}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {job.weddings?.client_name ||
                                    "Unknown Wedding"}
                                  {isUrgent && (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px] h-5 px-1.5"
                                    >
                                      Urgent
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1 items-start">
                                  {job.role}
                                  {(job.drone_required === true ||
                                    job.drone_required === "true") &&
                                    !(
                                      job.role
                                        ?.toLowerCase()
                                        .includes("photo") &&
                                      !job.role?.toLowerCase().includes("video")
                                    ) && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] bg-blue-50/50 text-blue-600 border-blue-200"
                                      >
                                        Drone Required
                                      </Badge>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {formatDisplayDate(job.weddings?.date)}
                              </TableCell>
                              <TableCell>
                                {job.hours ? `${job.hours} hrs` : "—"}
                              </TableCell>
                              <TableCell>
                                {job.pay_type === "bidding" ? (
                                  job.status === "filled" ||
                                  job.status === "completed" ? (
                                    `$${job.pay_rate} (Bid)`
                                  ) : (
                                    <Badge variant="outline">Bidding</Badge>
                                  )
                                ) : (
                                  `$${job.pay_rate}`
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    job.status === "open"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {job.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end items-center gap-2">
                                  {job.status === "open" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      title="Send Job Alerts"
                                      onClick={() => setResendJobId(job.id)}
                                    >
                                      <Send className="h-4 w-4 mr-2" />
                                      Send Alerts
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingJob(job);
                                      setEditRole(job.role || "");
                                      setEditHours(
                                        job.hours ? job.hours.toString() : "",
                                      );
                                      setEditRate(
                                        job.pay_rate
                                          ? job.pay_rate.toString()
                                          : "",
                                      );
                                      setEditPayType(job.pay_type || "flat");
                                      setEditDroneRequired(
                                        job.drone_required === true ||
                                          job.drone_required === "true",
                                      );
                                      setEditAddons(job.addons || []);
                                    }}
                                  >
                                    Edit
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={!!editingJob}
        onOpenChange={(open) => {
          if (!open) {
            setEditingJob(null);
            setEditDroneRequired(false);
            setEditAddons([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpdatePosition}>
            <DialogHeader>
              <DialogTitle>Edit Position</DialogTitle>
              <DialogDescription>
                Update details for this position.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-weddingId" className="text-right">
                  Wedding
                </Label>
                <div className="col-span-3">
                  <Select
                    name="weddingId"
                    defaultValue={editingJob?.wedding_id}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a wedding" />
                    </SelectTrigger>
                    <SelectContent>
                      {weddings.map((w: any) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.client_name} - {formatDisplayDate(w.date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-role" className="text-right">
                  Role
                </Label>
                <div className="col-span-3">
                  <Select
                    name="role"
                    value={editRole}
                    onValueChange={(val) =>
                      handleEditRoleOrHoursChange(val, editHours)
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
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
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-hours" className="text-right">
                  Hours
                </Label>
                <Input
                  id="edit-hours"
                  name="hours"
                  type="number"
                  step="0.5"
                  value={editHours}
                  onChange={(e) =>
                    handleEditRoleOrHoursChange(editRole, e.target.value)
                  }
                  placeholder="e.g. 8"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_pay_type" className="text-right">
                  Pay Type
                </Label>
                <div className="col-span-3">
                  <Select
                    value={editPayType}
                    onValueChange={handleEditPayTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pay type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat Rate</SelectItem>
                      <SelectItem value="bidding">
                        Contractor Bidding
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {true && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="flex items-center justify-end gap-1">
                    <Label htmlFor="edit-rate" className="text-right">
                      {editPayType === "bidding"
                        ? editingJob?.status === "filled"
                          ? "Approved Bid ($)"
                          : "Budget / Base Rate ($)"
                        : "Pay Rate ($)"}
                    </Label>
                    {editingJob && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            tabIndex={-1}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="whitespace-pre-wrap text-xs">
                          {getRateCalculationTooltip(
                            {
                              role: editRole,
                              hours: parseFloat(editHours) || null,
                              pay_rate: parseFloat(editRate) || 0,
                              addons: editAddons,
                            },
                            settings,
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Input
                    id="edit-rate"
                    name="rate"
                    type="number"
                    step="0.01"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    placeholder="500.00"
                    className="col-span-3"
                    required={editPayType === "flat"}
                  />
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">
                  Status
                </Label>
                <div className="col-span-3">
                  <Select
                    name="status"
                    defaultValue={editingJob?.status}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="filled">Filled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-requirements" className="text-right">
                  Requirements
                </Label>
                <Input
                  id="edit-requirements"
                  name="requirements"
                  defaultValue={editingJob?.requirements || ""}
                  placeholder="Must have own drone"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-drone_required" className="text-right">
                  Requires Drone
                </Label>
                <div className="col-span-3 flex items-center space-x-2">
                  <Switch
                    id="edit-drone_required"
                    checked={editDroneRequired}
                    onCheckedChange={setEditDroneRequired}
                  />
                  <Label
                    htmlFor="edit-drone_required"
                    className="font-normal text-muted-foreground"
                  >
                    Contractor must be drone approved
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Addons</Label>
                <div className="col-span-3 space-y-2">
                  {ADDON_OPTIONS.map((addon) => (
                    <div key={addon} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-addon-${addon.replace(/\s+/g, "-")}`}
                        checked={editAddons.includes(addon)}
                        onCheckedChange={(checked) => {
                          if (checked) setEditAddons([...editAddons, addon]);
                          else
                            setEditAddons(
                              editAddons.filter((a) => a !== addon),
                            );
                        }}
                      />
                      <Label
                        htmlFor={`edit-addon-${addon.replace(/\s+/g, "-")}`}
                        className="font-normal text-sm"
                      >
                        {addon}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingJob(null);
                  setEditDroneRequired(false);
                  setEditAddons([]);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateJobMutation.isPending}>
                {updateJobMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ResendAlertsDialog
        jobId={resendJobId}
        open={!!resendJobId}
        onOpenChange={(open) => !open && setResendJobId(null)}
      />
    </div>
  );
}
