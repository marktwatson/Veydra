import { Link } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  ChevronRight,
  Loader2,
  ArrowUpDown,
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
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentCalendar } from "@/components/AssignmentCalendar";
import { StatusBadge } from "@/components/StatusBadge";
import { cn, formatDisplayDate } from "@/lib/utils";
import { useState } from "react";

export default function Assignments() {
  const { user } = useAuth();

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  const { data: contractors = [], isLoading: isLoadingContractors } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
  });

  const currentUser = contractors.find(
    (c) => c.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase(),
  );
  const myAssignments = assignments.filter(
    (a: any) => a.contractor_id === currentUser?.id,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPastDate = (dateStr?: string) => {
    if (!dateStr) return false;
    const dateOnly = dateStr.split("T")[0];
    const [year, month, day] = dateOnly.split("-").map(Number);
    const wDate = new Date(year, month - 1, day);
    return wDate.getTime() < today.getTime();
  };

  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const dateOnly = dateStr.split("T")[0];
    const [year, month, day] = dateOnly.split("-").map(Number);
    const wDate = new Date(year, month - 1, day);
    return wDate.getTime() === today.getTime();
  };

  const getDisplayStatus = (assignment: any) => {
    const status = assignment.status || "Upcoming";
    if (status.toLowerCase() === "upcoming") {
      if (isToday(assignment.jobs?.weddings?.date)) return "Today";
      if (isPastDate(assignment.jobs?.weddings?.date)) return "Past";
    }
    return status;
  };

  const sortAssignments = (arr: any[], asc: boolean = true) => {
    return [...arr].sort((a, b) => {
      const dateA = new Date(
        a.jobs?.weddings?.date || (asc ? "9999-12-31" : "0"),
      ).getTime();
      const dateB = new Date(
        b.jobs?.weddings?.date || (asc ? "9999-12-31" : "0"),
      ).getTime();
      return asc ? dateA - dateB : dateB - dateA;
    });
  };

  const actionRequiredAssignments = sortAssignments(
    myAssignments.filter((a: any) => {
      const s = String(a.status || "")
        .trim()
        .toLowerCase();
      const js = String(a.jobs?.status || "")
        .trim()
        .toLowerCase();
      const ws = String(a.jobs?.weddings?.status || "")
        .trim()
        .toLowerCase();
      if (js === "cancelled" || ws === "cancelled") return false;
      const isActive = [
        "upcoming",
        "accepted",
        "confirmed",
        "action required",
        "assigned",
      ].includes(s);
      return isActive && isPastDate(a.jobs?.weddings?.date);
    }),
    false,
  );

  const upcomingAssignments = sortAssignments(
    myAssignments.filter((a: any) => {
      const s = String(a.status || "")
        .trim()
        .toLowerCase();
      const js = String(a.jobs?.status || "")
        .trim()
        .toLowerCase();
      const ws = String(a.jobs?.weddings?.status || "")
        .trim()
        .toLowerCase();
      if (js === "cancelled" || ws === "cancelled") return false;
      const isActive = [
        "upcoming",
        "accepted",
        "confirmed",
        "action required",
        "assigned",
      ].includes(s);
      return isActive && !isPastDate(a.jobs?.weddings?.date);
    }),
    true,
  );

  const completedAssignments = sortAssignments(
    myAssignments.filter((a: any) => {
      const s = String(a.status || "")
        .trim()
        .toLowerCase();
      const js = String(a.jobs?.status || "")
        .trim()
        .toLowerCase();
      const ws = String(a.jobs?.weddings?.status || "")
        .trim()
        .toLowerCase();
      if (js === "cancelled" || ws === "cancelled") return true;
      return [
        "completed",
        "payment received",
        "paid",
        "pending payout",
        "canceled",
        "declined",
        "cancelled",
      ].includes(s);
    }),
    false,
  );

  if (isLoadingAssignments || isLoadingContractors) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
        <p className="text-muted-foreground">
          Manage your upcoming and completed jobs.
        </p>
      </div>

      <Tabs
        defaultValue={
          actionRequiredAssignments.length > 0 ? "action-required" : "upcoming"
        }
        className="space-y-4"
      >
        <TabsList>
          {actionRequiredAssignments.length > 0 && (
            <TabsTrigger
              value="action-required"
              className="text-destructive data-[state=active]:text-destructive data-[state=active]:bg-destructive/10"
            >
              Action Required ({actionRequiredAssignments.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed & Cancelled</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="action-required" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {actionRequiredAssignments.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 opacity-50 mb-4" />
                <p>No action required at this time.</p>
              </div>
            ) : (
              actionRequiredAssignments.map((assignment: any) => {
                const job = assignment.jobs;
                const wedding = job?.weddings;
                return (
                  <Card
                    key={assignment.id}
                    className="flex flex-col border-destructive/50 shadow-sm"
                  >
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="w-full">
                          <div className="flex items-start justify-between mb-1">
                            <CardTitle className="text-xl">
                              {wedding?.client_name || "Unknown Wedding"}
                            </CardTitle>
                            <div className="sm:hidden shrink-0 ml-2">
                              <Badge variant="destructive">Upload Media</Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-normal whitespace-nowrap"
                            >
                              {job?.role || "Role"}
                            </Badge>
                          </div>
                        </div>
                        <div className="hidden sm:block shrink-0">
                          <Badge variant="destructive">Upload Media</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>{formatDisplayDate(wedding?.date)} (Past)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{wedding?.location || "TBD"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span>${job?.pay_rate || 0}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-destructive/5 pt-4 border-t border-destructive/20">
                      <Button
                        asChild
                        className="w-full h-auto py-2.5 whitespace-normal"
                        variant="destructive"
                      >
                        <Link to={`/assignments/${assignment.id}`}>
                          <span className="text-center">
                            Submit Media & Request Payout
                          </span>
                          <ChevronRight className="ml-2 h-4 w-4 shrink-0" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingAssignments.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 opacity-50 mb-4" />
                <p>You have no upcoming assignments.</p>
              </div>
            ) : (
              upcomingAssignments.map((assignment: any) => {
                const job = assignment.jobs;
                const wedding = job?.weddings;
                return (
                  <Card key={assignment.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="w-full">
                          <div className="flex items-start justify-between mb-1">
                            <CardTitle className="text-xl">
                              {wedding?.client_name || "Unknown Wedding"}
                            </CardTitle>
                            <div className="sm:hidden shrink-0 ml-2">
                              <StatusBadge
                                status={getDisplayStatus(assignment)}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-normal whitespace-nowrap"
                            >
                              {job?.role || "Role"}
                            </Badge>
                            {job?.addons && job.addons.length > 0 && (
                              <Badge
                                variant="outline"
                                className="font-normal text-[10px] bg-purple-50/50 text-purple-600 border-purple-200"
                              >
                                +{job.addons.length} Addon
                                {job.addons.length > 1 ? "s" : ""}
                              </Badge>
                            )}
                            {wedding?.is_lgbtq && (
                              <Badge
                                variant="outline"
                                className="font-normal text-[10px] bg-rose-50/50 text-rose-600 border-rose-200"
                                title="LGBTQ+ Wedding"
                              >
                                🌈 LGBTQ+
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="hidden sm:block shrink-0">
                          <StatusBadge status={getDisplayStatus(assignment)} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>{formatDisplayDate(wedding?.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{wedding?.location || "TBD"}</span>
                      </div>
                      {job?.hours && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 text-primary" />
                          <span>{job.hours} hrs</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span>${job?.pay_rate || 0}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-muted/50 pt-4 border-t">
                      <Button asChild className="w-full" variant="secondary">
                        <Link to={`/assignments/${assignment.id}`}>
                          View Details
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedAssignments.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 opacity-50 mb-4" />
                <p>You have no completed or cancelled assignments.</p>
              </div>
            ) : (
              completedAssignments.map((assignment: any) => {
                const job = assignment.jobs;
                const wedding = job?.weddings;
                return (
                  <Card
                    key={assignment.id}
                    className={cn(
                      "flex flex-col",
                      String(assignment.status || "")
                        .trim()
                        .toLowerCase() === "cancelled" ||
                        String(assignment.status || "")
                          .trim()
                          .toLowerCase() === "canceled"
                        ? "opacity-70"
                        : "",
                    )}
                  >
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="w-full">
                          <div className="flex items-start justify-between mb-1">
                            <CardTitle className="text-xl">
                              {wedding?.client_name || "Unknown Wedding"}
                            </CardTitle>
                            <div className="sm:hidden shrink-0 ml-2">
                              <StatusBadge
                                status={getDisplayStatus(assignment)}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-normal whitespace-nowrap"
                            >
                              {job?.role || "Role"}
                            </Badge>
                            {job?.addons && job.addons.length > 0 && (
                              <Badge
                                variant="outline"
                                className="font-normal text-[10px] bg-purple-50/50 text-purple-600 border-purple-200"
                              >
                                +{job.addons.length} Addon
                                {job.addons.length > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="hidden sm:block shrink-0">
                          <StatusBadge status={getDisplayStatus(assignment)} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>{formatDisplayDate(wedding?.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{wedding?.location || "TBD"}</span>
                      </div>
                      {job?.hours && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 text-primary" />
                          <span>{job.hours} hrs</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span>${job?.pay_rate || 0}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-muted/50 pt-4 border-t">
                      <Button asChild className="w-full" variant="secondary">
                        <Link to={`/assignments/${assignment.id}`}>
                          View Details
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <AssignmentCalendar
            assignments={upcomingAssignments}
            role="contractor"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
