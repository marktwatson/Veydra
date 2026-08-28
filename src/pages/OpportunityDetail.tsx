import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  DollarSign,
  Briefcase,
  CheckCircle2,
  Loader2,
  Navigation,
  Clock,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { geocodeAddress, calculateDistanceMiles } from "@/lib/geocoding";
import { formatDisplayDate } from "@/lib/utils";
import confetti from "canvas-confetti";

export default function OpportunityDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: api.getJobs,
  });

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  const { data: applications = [], isLoading: isLoadingApps } = useQuery({
    queryKey: ["applications"],
    queryFn: api.getApplications,
  });

  const { data: contractors = [], isLoading: isLoadingContractors } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
  });

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
  });

  const currentUser = contractors.find(
    (c) => c.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase(),
  );
  const position = jobs.find((p) => p.id === id);
  const application = applications.find(
    (a) => a.job_id === id && a.contractor_id === currentUser?.id,
  );

  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUser?.address || !position?.weddings?.location) return;

    let isMounted = true;
    const calculateDistance = async () => {
      const homeCoords = await geocodeAddress(currentUser.address!);
      if (!homeCoords) return;

      const jobCoords = await geocodeAddress(position.weddings!.location);
      if (jobCoords && isMounted) {
        setDistance(calculateDistanceMiles(homeCoords, jobCoords));
      }
    };
    calculateDistance();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.address, position?.weddings?.location]);

  const [bidAmount, setBidAmount] = useState<string>("");
  const [isBidDialogOpen, setIsBidDialogOpen] = useState(false);
  const [isUpdateBidDialogOpen, setIsUpdateBidDialogOpen] = useState(false);
  const [updateBidAmount, setUpdateBidAmount] = useState<string>("");
  const [isOverbidWarningOpen, setIsOverbidWarningOpen] = useState(false);
  const [pendingBidAction, setPendingBidAction] = useState<
    "apply" | "update" | null
  >(null);

  const maxSuggestedBid =
    position?.hours && settings
      ? position.role?.toLowerCase().includes("photo")
        ? (settings.photo_bid_max || 75) * position.hours
        : (settings.video_bid_max || 75) * position.hours
      : Infinity;

  const jobApplications = applications.filter(
    (a) =>
      a.job_id === id &&
      a.status !== "declined" &&
      a.status !== "not_selected" &&
      a.status !== "withdrawn",
  );
  const lowestBid = jobApplications.reduce((min, app) => {
    if (app.bid_amount && app.bid_amount < min) return app.bid_amount;
    return min;
  }, Infinity);
  const hasLowestBid = lowestBid !== Infinity;

  const updateBidMutation = useMutation({
    mutationFn: (newBid: number) =>
      api.updateApplicationBid(application!.id, newBid),
    onSuccess: (_, newBid) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });

      if (!hasLowestBid || newBid <= lowestBid) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#10b981", "#34d399", "#059669"], // Emerald colors
        });
        toast({
          title: "🎉 You have the lowest bid!",
          description:
            "Your bid has been successfully updated and is currently the lowest.",
        });
      } else {
        toast({
          title: "Bid Updated",
          description: "Your bid has been successfully updated.",
        });
      }
      setIsUpdateBidDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update bid",
        description: error.message,
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      api.applyForJob({
        job_id: position!.id,
        contractor_id: currentUser!.id,
        message: "I am interested in this position.",
        bid_amount:
          position!.pay_type === "bidding" ? parseFloat(bidAmount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });

      const submittedBid =
        position?.pay_type === "bidding" ? parseFloat(bidAmount) : undefined;

      if (
        submittedBid !== undefined &&
        (!hasLowestBid || submittedBid <= lowestBid)
      ) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#10b981", "#34d399", "#059669"], // Emerald colors
        });
        toast({
          title: "🎉 You have the lowest bid!",
          description: "Your competitive bid has been placed successfully.",
        });
      } else {
        toast({
          title: "Application Submitted",
          description:
            "We'll notify you if you're selected for this assignment.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to apply",
        description: error.message,
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => api.withdrawApplication(application!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast({
        title: "Application Withdrawn",
        description: "Your application has been successfully withdrawn.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to withdraw",
        description: error.message,
      });
    },
  });

  if (
    isLoadingJobs ||
    isLoadingApps ||
    isLoadingContractors ||
    isLoadingAssignments
  ) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!position) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-2xl font-bold mb-2">Position Not Found</h2>
        <Button asChild variant="outline">
          <Link to="/opportunities">Return to Opportunities</Link>
        </Button>
      </div>
    );
  }

  const appStatus = application ? application.status : "Open";

  const displayStatus =
    appStatus === "pending"
      ? "Applied"
      : appStatus === "awarded"
        ? "Awarded"
        : appStatus === "declined" || appStatus === "not_selected"
          ? "Not Selected"
          : appStatus === "under_review"
            ? "Under Review"
            : "Open";

  const myActiveAssignments = assignments.filter(
    (a: any) =>
      a.contractor_id === currentUser?.id &&
      [
        "upcoming",
        "accepted",
        "confirmed",
        "assigned",
        "action required",
      ].includes(
        String(a.status || "")
          .trim()
          .toLowerCase(),
      ),
  );

  const myBookedDates = new Set(
    myActiveAssignments.map((a: any) => a.jobs?.weddings?.date).filter(Boolean),
  );

  const isDoubleBooked = myBookedDates.has(position?.weddings?.date);

  const isPhotoOnly =
    position.role?.toLowerCase().includes("photo") &&
    !position.role?.toLowerCase().includes("video");
  const isDroneBlock =
    (position.drone_required === true || position.drone_required === "true") &&
    !isPhotoOnly &&
    !currentUser?.drone_approved;
  const isAlreadyAssignedToWedding = isDoubleBooked;

  const handleAction = () => {
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Could not find your contractor profile. Please contact support.",
      });
      return;
    }
    applyMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-3 mb-2 text-muted-foreground"
      >
        <Link to="/opportunities">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Positions
        </Link>
      </Button>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {position.weddings?.client_name || "Unknown Wedding"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none text-sm font-medium">
              {position.role}
            </Badge>
            {(position.drone_required === true ||
              position.drone_required === "true") &&
              !isPhotoOnly && (
                <Badge
                  variant="outline"
                  className="text-sm bg-blue-50/50 text-blue-600 border-blue-200"
                >
                  Drone Required
                </Badge>
              )}
            {position.weddings?.is_lgbtq && (
              <Badge
                variant="outline"
                className="text-sm bg-rose-50/50 text-rose-600 border-rose-200"
                title="LGBTQ+ Wedding"
              >
                🌈 LGBTQ+
              </Badge>
            )}
            <StatusBadge status={displayStatus} />
          </div>
        </div>
        <div className="flex-shrink-0 hidden md:block">
          {/* Status badge moved to main header area on mobile, kept here on desktop if needed, but we already have it in the left column. We can just leave this empty or remove it. */}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Date
                    </span>
                  </div>
                  <p className="font-medium text-base">
                    {formatDisplayDate(position.weddings?.date)}
                  </p>
                </div>

                {position.hours && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Hours
                      </span>
                    </div>
                    <p className="font-medium text-base">
                      {position.hours} hrs
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Location
                    </span>
                  </div>
                  <p className="font-medium text-base">
                    {position.weddings?.location || "TBD"}
                  </p>
                </div>

                {distance !== null && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Navigation className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Distance
                      </span>
                    </div>
                    <p className="font-medium text-base">
                      {distance.toFixed(1)} miles away
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Pay
                    </span>
                  </div>
                  <p className="font-medium text-base">
                    {position.pay_type === "bidding"
                      ? "Bidding"
                      : `$${position.pay_rate}`}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Role
                    </span>
                  </div>
                  <p className="font-medium text-base">{position.role}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {((position.requirements && position.requirements.trim() !== "") ||
            (position.addons && position.addons.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Position Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {position.requirements &&
                  position.requirements.trim() !== "" && (
                    <div>
                      <h3 className="font-semibold mb-2">Requirements</h3>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {position.requirements}
                      </p>
                    </div>
                  )}
                {position.addons && position.addons.length > 0 && (
                  <div
                    className={
                      position.requirements &&
                      position.requirements.trim() !== ""
                        ? "pt-4 border-t"
                        : ""
                    }
                  >
                    <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
                      Addons Included
                    </h3>
                    <ul className="grid gap-3">
                      {position.addons.map((addon: string, i: number) => (
                        <li key={i} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4 text-purple-500" />
                            <span>{addon}</span>
                          </div>
                          {addon === "Audio & Vows" && (
                            <p className="text-xs text-muted-foreground ml-6">
                              Requires you to bring lapels and other recording
                              equipment for this job.
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:sticky lg:top-20 self-start">
          <Card className="border-primary/20 bg-card shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/30">
              <CardTitle className="text-lg flex items-center justify-between">
                Application
                {position.pay_type === "bidding" && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-600 border-emerald-200 ml-2"
                  >
                    Bidding Job
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {appStatus === "Open" && (
                <div className="flex flex-col gap-4">
                  {position.pay_type === "bidding" ? (
                    <Dialog
                      open={isBidDialogOpen}
                      onOpenChange={setIsBidDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="lg"
                          disabled={isDroneBlock || isAlreadyAssignedToWedding}
                          className="w-full font-bold text-lg h-14 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                        >
                          Place Official Bid
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle className="text-2xl flex items-center gap-2">
                            <DollarSign className="h-6 w-6 text-emerald-600" />
                            Official Bid Submission
                          </DialogTitle>
                          <DialogDescription>
                            Submit your competitive bid for{" "}
                            {position.weddings?.client_name ||
                              "this assignment"}
                            .
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/50 p-3 rounded-lg border">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                                Suggested Range
                              </p>
                              <p className="text-lg font-bold text-foreground">
                                {position.hours && settings
                                  ? position.role
                                      ?.toLowerCase()
                                      .includes("photo")
                                    ? `$${(settings.photo_bid_min || 60) * position.hours} - $${(settings.photo_bid_max || 75) * position.hours}`
                                    : `$${(settings.video_bid_min || 60) * position.hours} - $${(settings.video_bid_max || 75) * position.hours}`
                                  : "N/A"}
                              </p>
                            </div>
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
                              <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider font-semibold mb-1">
                                Current Lowest
                              </p>
                              <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                                {hasLowestBid ? `$${lowestBid}` : "No bids yet"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label
                              htmlFor="bid_amount"
                              className="text-sm font-semibold"
                            >
                              Your Bid Amount ($)
                            </Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                              <Input
                                id="bid_amount"
                                type="number"
                                placeholder="Enter your competitive bid..."
                                value={bidAmount}
                                onChange={(e) => setBidAmount(e.target.value)}
                                className="pl-10 h-14 text-xl font-medium border-emerald-500/30 focus-visible:ring-emerald-500"
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsBidDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              const bid = parseFloat(bidAmount);
                              if (bid > maxSuggestedBid) {
                                setPendingBidAction("apply");
                                setIsOverbidWarningOpen(true);
                              } else {
                                handleAction();
                                setIsBidDialogOpen(false);
                              }
                            }}
                            disabled={applyMutation.isPending || !bidAmount}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {applyMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Submit Bid
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Button
                      onClick={handleAction}
                      size="lg"
                      disabled={
                        applyMutation.isPending ||
                        isDroneBlock ||
                        isAlreadyAssignedToWedding
                      }
                      className="w-full font-semibold h-12"
                    >
                      {applyMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Apply Now
                    </Button>
                  )}

                  {isDroneBlock && !isAlreadyAssignedToWedding && (
                    <p className="text-sm text-destructive text-center bg-destructive/10 p-2 rounded-md">
                      This position requires drone approval. Please contact
                      management.
                    </p>
                  )}
                  {isAlreadyAssignedToWedding && (
                    <p className="text-sm text-destructive text-center bg-destructive/10 p-2 rounded-md">
                      You are already booked for an assignment on this date.
                    </p>
                  )}
                </div>
              )}

              {(appStatus === "pending" || appStatus === "under_review") && (
                <div className="flex flex-col gap-4">
                  {position.pay_type === "bidding" ? (
                    <div className="space-y-4">
                      <div className="bg-muted/30 border rounded-lg p-4 space-y-2 text-center">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          Your Current Bid
                        </p>
                        <p className="font-bold text-3xl text-emerald-600 dark:text-emerald-400">
                          ${application?.bid_amount}
                        </p>

                        {hasLowestBid &&
                          lowestBid < (application?.bid_amount || 0) && (
                            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-400 font-medium flex items-center justify-center gap-2">
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              </span>
                              You've been outbid! (Lowest: ${lowestBid})
                            </div>
                          )}
                        {hasLowestBid &&
                          lowestBid === application?.bid_amount && (
                            <div className="mt-3 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center justify-center gap-2">
                              <CheckCircle2 className="h-4 w-4" /> You have the
                              lowest bid
                            </div>
                          )}
                      </div>

                      <Dialog
                        open={isUpdateBidDialogOpen}
                        onOpenChange={setIsUpdateBidDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="lg"
                            className="w-full font-bold h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Update Official Bid
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle className="text-2xl flex items-center gap-2">
                              <DollarSign className="h-6 w-6 text-emerald-600" />
                              Update Official Bid
                            </DialogTitle>
                            <DialogDescription>
                              Adjust your competitive bid for{" "}
                              {position.weddings?.client_name ||
                                "this assignment"}
                              .
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-muted/50 p-3 rounded-lg border">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                                  Your Current Bid
                                </p>
                                <p className="text-lg font-bold text-foreground">
                                  ${application?.bid_amount}
                                </p>
                              </div>
                              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
                                <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider font-semibold mb-1">
                                  Current Lowest
                                </p>
                                <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                                  {hasLowestBid
                                    ? `$${lowestBid}`
                                    : "No bids yet"}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <Label
                                htmlFor="update_bid_amount"
                                className="text-sm font-semibold"
                              >
                                New Bid Amount ($)
                              </Label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                  id="update_bid_amount"
                                  type="number"
                                  placeholder={
                                    application?.bid_amount?.toString() ||
                                    "Enter new bid..."
                                  }
                                  value={updateBidAmount}
                                  onChange={(e) =>
                                    setUpdateBidAmount(e.target.value)
                                  }
                                  className="pl-10 h-14 text-xl font-medium border-emerald-500/30 focus-visible:ring-emerald-500"
                                />
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setIsUpdateBidDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                const bid = parseFloat(updateBidAmount);
                                if (bid > maxSuggestedBid) {
                                  setPendingBidAction("update");
                                  setIsOverbidWarningOpen(true);
                                } else {
                                  updateBidMutation.mutate(bid);
                                }
                              }}
                              disabled={
                                updateBidMutation.isPending || !updateBidAmount
                              }
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {updateBidMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Update Bid
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full font-medium h-12"
                      disabled
                    >
                      {appStatus === "pending"
                        ? "Application Pending"
                        : "Under Review"}
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Withdraw Application
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Withdraw Application?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to withdraw your application for
                          this position? You can re-apply later if the position
                          is still open.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => withdrawMutation.mutate()}
                          disabled={withdrawMutation.isPending}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {withdrawMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Yes, Withdraw
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {(appStatus === "declined" || appStatus === "not_selected") && (
                <Button variant="secondary" className="w-full h-12" disabled>
                  Not Selected
                </Button>
              )}

              {appStatus === "awarded" && (
                <Button asChild variant="default" className="w-full h-12">
                  <Link to="/assignments">View Assignment</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={isOverbidWarningOpen}
        onOpenChange={setIsOverbidWarningOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to overbid?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your bid is higher than the suggested maximum for this position.
              While you are free to submit any amount, please note that
              overbidding significantly decreases your chances of being awarded
              this job.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingBidAction(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingBidAction === "apply") {
                  handleAction();
                  setIsBidDialogOpen(false);
                } else if (pendingBidAction === "update") {
                  updateBidMutation.mutate(parseFloat(updateBidAmount));
                  setIsUpdateBidDialogOpen(false);
                }
                setIsOverbidWarningOpen(false);
                setPendingBidAction(null);
              }}
            >
              Submit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
