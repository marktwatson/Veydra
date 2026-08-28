import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  MapPin,
  DollarSign,
  Briefcase,
  Filter,
  Loader2,
  Navigation,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { geocodeAddress, calculateDistanceMiles } from "@/lib/geocoding";
import { parseRegions, formatDisplayDate } from "@/lib/utils";

export default function Opportunities() {
  const { user } = useAuth();
  const [filterRegion, setFilterRegion] = useState<boolean>(true);

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
  const [distances, setDistances] = useState<Record<string, number>>({});

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

  const visiblePositions = jobs
    .filter((p) => {
      if (p.status !== "open") return false;
      if (myBookedDates.has(p.weddings?.date)) return false;

      const isInvited = p.invited_contractors?.includes(currentUser?.id);

      if (isInvited) return true;

      const isPhotoOnly =
        p.role?.toLowerCase().includes("photo") &&
        !p.role?.toLowerCase().includes("video");
      const requiresDrone =
        (p.drone_required === true || p.drone_required === "true") &&
        !isPhotoOnly;

      if (requiresDrone && !currentUser?.drone_approved) {
        return false;
      }
      if (currentUser?.specialty) {
        const specialty = (currentUser.specialty || "").toLowerCase();
        const role = (p.role || "").toLowerCase();

        if (!specialty.includes("both") && !specialty.includes("&")) {
          if (specialty.includes("video") && !role.includes("video"))
            return false;
          if (specialty.includes("photo") && !role.includes("photo"))
            return false;
          if (specialty.includes("content") && !role.includes("content"))
            return false;
        }
      }

      if (filterRegion && currentUser?.region) {
        const regions = parseRegions(currentUser.region);
        if (regions.length > 0) {
          const isAllRegions = regions.some(
            (r: string) => r.toLowerCase() === "all regions",
          );
          if (!isAllRegions) {
            const jobLocation = (p.weddings?.location || "").toLowerCase();
            const weddingRegions = parseRegions(p.weddings?.region);

            let matchesRegion = false;
            if (weddingRegions.length > 0) {
              matchesRegion = regions.some((r: string) =>
                weddingRegions.some(
                  (wr: string) => wr.toLowerCase() === r.toLowerCase(),
                ),
              );
            } else {
              matchesRegion = regions.some((r: string) =>
                jobLocation.includes(r.toLowerCase()),
              );
            }

            if (!matchesRegion) return false;
          }
        }
      }

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.weddings?.date || "9999-12-31").getTime();
      const dateB = new Date(b.weddings?.date || "9999-12-31").getTime();
      return dateA - dateB; // Closest first
    });

  const myApplications = applications
    .filter((a: any) => a.contractor_id === currentUser?.id)
    .sort((a: any, b: any) => {
      const dateA = new Date(a.jobs?.weddings?.date || "9999-12-31").getTime();
      const dateB = new Date(b.jobs?.weddings?.date || "9999-12-31").getTime();
      return dateA - dateB; // Closest first
    });

  const openJobs = visiblePositions.filter(
    (p) => !myApplications.some((a) => a.job_id === p.id),
  );

  const appliedJobs = myApplications
    .map((app) => {
      const position = jobs.find((p) => p.id === app.job_id);
      if (!position) return null;
      return {
        ...position,
        applicationStatus: app.status,
        applicationId: app.id,
      };
    })
    .filter(Boolean);

  useEffect(() => {
    if (!currentUser?.address || jobs.length === 0) return;

    let isMounted = true;
    const calculateAll = async () => {
      const homeCoords = await geocodeAddress(currentUser.address!);
      if (!homeCoords) return;

      const newDistances: Record<string, number> = {};
      for (const job of jobs) {
        if (job.weddings?.location) {
          const jobCoords = await geocodeAddress(job.weddings.location);
          if (jobCoords) {
            newDistances[job.id] = calculateDistanceMiles(
              homeCoords,
              jobCoords,
            );
          }
        }
      }
      if (isMounted) setDistances(newDistances);
    };
    calculateAll();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.address, jobs]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Open Positions</h1>
          <p className="text-muted-foreground">
            Find and apply to upcoming wedding assignments.
          </p>
        </div>
      </div>

      <Tabs defaultValue="open" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="open">Open Positions</TabsTrigger>
            <TabsTrigger value="applications">My Applications</TabsTrigger>
          </TabsList>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterRegion(!filterRegion)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">
              {filterRegion ? "My Region Only" : "All Regions"}
            </span>
          </Button>
        </div>

        <TabsContent value="open" className="space-y-4">
          {openJobs.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <CardTitle className="text-xl">No open positions</CardTitle>
              <p className="text-muted-foreground mt-2">
                Check back later or expand your region filter.
              </p>
            </Card>
          ) : (
            openJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                status="Open"
                currentUser={currentUser}
                distance={distances[job.id]}
                settings={settings}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          {appliedJobs.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <CardTitle className="text-xl">No active applications</CardTitle>
              <p className="text-muted-foreground mt-2">
                You have not applied to any positions yet.
              </p>
            </Card>
          ) : (
            appliedJobs.map((job: any) => (
              <JobCard
                key={job.id}
                job={job}
                status={job.applicationStatus}
                currentUser={currentUser}
                distance={distances[job.id]}
                settings={settings}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobCard({
  job,
  status,
  currentUser,
  distance,
  settings,
}: {
  job: any;
  status: string;
  currentUser?: any;
  distance?: number;
  settings?: any;
}) {
  const displayStatus =
    status === "pending"
      ? "Applied"
      : status === "awarded"
        ? "Awarded"
        : status === "declined" || status === "not_selected"
          ? "Not Selected"
          : status === "under_review"
            ? "Under Review"
            : "Open";

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="w-full">
            <div className="flex items-start justify-between mb-1">
              <CardTitle className="text-lg">
                {job.weddings?.client_name || "Unknown Wedding"}
              </CardTitle>
              <div className="sm:hidden shrink-0 ml-2">
                <StatusBadge status={displayStatus} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-medium">
                {job.role}
              </Badge>
              {(job.drone_required === true || job.drone_required === "true") &&
                !(
                  job.role?.toLowerCase().includes("photo") &&
                  !job.role?.toLowerCase().includes("video")
                ) && (
                  <Badge
                    variant="outline"
                    className="font-normal text-[10px] bg-blue-50/50 text-blue-600 border-blue-200"
                  >
                    Drone Required
                  </Badge>
                )}
              {job.weddings?.is_lgbtq && (
                <Badge
                  variant="outline"
                  className="font-normal text-[10px] bg-rose-50/50 text-rose-600 border-rose-200"
                  title="LGBTQ+ Wedding"
                >
                  🌈 LGBTQ+
                </Badge>
              )}
              {job.addons && job.addons.length > 0 && (
                <Badge
                  variant="outline"
                  className="font-normal text-[10px] bg-purple-50/50 text-purple-600 border-purple-200"
                >
                  +{job.addons.length} Addon{job.addons.length > 1 ? "s" : ""}
                </Badge>
              )}
              {job.invited_contractors?.includes(currentUser?.id) && (
                <Badge
                  variant="outline"
                  className="font-normal text-[10px] bg-emerald-50/50 text-emerald-600 border-emerald-200"
                >
                  Invited
                </Badge>
              )}
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1 w-full sm:w-auto mt-1 sm:mt-0">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {job.weddings?.location || "TBD"}
                </span>
              </span>
            </div>
          </div>
          <div className="hidden sm:block shrink-0">
            <StatusBadge status={displayStatus} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {formatDisplayDate(job.weddings?.date)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {job.pay_type === "bidding" ? (
                <>
                  Bidding
                  {job.hours && settings && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      (Suggested: $
                      {job.role?.toLowerCase().includes("photo")
                        ? `${(settings.photo_bid_min || 60) * job.hours} - ${(settings.photo_bid_max || 75) * job.hours}`
                        : `${(settings.video_bid_min || 60) * job.hours} - ${(settings.video_bid_max || 75) * job.hours}`}
                      )
                    </span>
                  )}
                </>
              ) : (
                `$${job.pay_rate}`
              )}
            </span>
          </div>
          {job.hours && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">
                {job.hours} hrs
              </span>
            </div>
          )}
          {distance !== undefined && (
            <div className="flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">
                {distance.toFixed(1)} miles away
              </span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 pt-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1 sm:max-w-[60%] w-full">
          {job.requirements || "No specific requirements listed."}
        </p>
        <Button
          asChild
          size="sm"
          variant={status === "Open" ? "default" : "secondary"}
          className="w-full sm:w-auto shrink-0"
        >
          <Link to={`/opportunities/${job.id}`}>
            {status === "Open" ? "Apply Now" : "View Details"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
