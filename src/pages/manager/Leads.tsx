import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Download,
  MoreHorizontal,
  UserPlus,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  ArrowUpRight,
  RefreshCw,
  Check,
  MapPin,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDisplayDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const {
    data: leads = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["ovanta-leads"],
    queryFn: async () => {
      return await api.getOvantaLeads(undefined);
    },
    retry: false,
  });

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.venue_location || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      lead.status?.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const newLeadsCount = leads.filter((l) => l.status === "New").length;
  const withVenueCount = leads.filter((l) => l.venue_location).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Manage and track your incoming leads from Ovanta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leads.length}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Leads</CardTitle>
            <Badge variant="secondary" className="font-normal">
              {newLeadsCount} Action Required
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {newLeadsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting initial contact
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              With Venue Location
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {withVenueCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for market map
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
          <CardDescription>
            A list of recent leads synced from Ovanta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search leads..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setStatusFilter("all")}
                  className="justify-between cursor-pointer"
                >
                  All Statuses
                  {statusFilter === "all" && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setStatusFilter("new")}
                  className="justify-between cursor-pointer"
                >
                  New Only
                  {statusFilter === "new" && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setStatusFilter("qualified")}
                  className="justify-between cursor-pointer"
                >
                  Qualified Only
                  {statusFilter === "qualified" && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setStatusFilter("contacted")}
                  className="justify-between cursor-pointer"
                >
                  Contacted Only
                  {statusFilter === "contacted" && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Venue Name</TableHead>
                  <TableHead>Venue Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Loading leads...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-destructive"
                    >
                      <p>{(error as Error).message}</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() =>
                          (window.location.href = "/manager/settings")
                        }
                      >
                        Go to Settings
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No leads found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead: any) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedLead(lead);
                        setIsDetailsOpen(true);
                      }}
                    >
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center text-muted-foreground">
                            <Mail className="mr-1 h-3 w-3" /> {lead.email}
                          </span>
                          <span className="flex items-center text-muted-foreground">
                            <Phone className="mr-1 h-3 w-3" /> {lead.phone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.venue_name ? (
                          <span className="text-sm font-medium text-foreground">
                            {lead.venue_name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.venue_location ? (
                          <span className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="mr-1 h-3 w-3" />{" "}
                            {lead.venue_location}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            lead.status === "New"
                              ? "default"
                              : lead.status === "Qualified"
                                ? "secondary"
                                : "outline"
                          }
                          className={
                            lead.status === "Lost"
                              ? "text-destructive border-destructive/30"
                              : ""
                          }
                        >
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.source}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground text-sm">
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {formatDisplayDate(lead.date)}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedLead(lead);
                                setIsDetailsOpen(true);
                              }}
                            >
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toast("Status synced from CRM", {
                                  description:
                                    "Update tags in your CRM to change status.",
                                })
                              }
                            >
                              Update Status
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                toast("Manage in CRM", {
                                  description:
                                    "Please delete leads directly in your CRM.",
                                })
                              }
                            >
                              Delete Lead
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>Information synced from CRM</DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Name
                  </h4>
                  <p className="font-medium">{selectedLead.name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Status
                  </h4>
                  <Badge
                    variant={
                      selectedLead.status === "New" ? "default" : "secondary"
                    }
                    className="mt-1"
                  >
                    {selectedLead.status}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Email
                  </h4>
                  <p>
                    <a
                      href={`mailto:${selectedLead.email}`}
                      className="text-primary hover:underline"
                    >
                      {selectedLead.email}
                    </a>
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Phone
                  </h4>
                  <p>
                    <a
                      href={`tel:${selectedLead.phone}`}
                      className="text-primary hover:underline"
                    >
                      {selectedLead.phone}
                    </a>
                  </p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Source
                  </h4>
                  <p>{selectedLead.source}</p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Venue Name
                  </h4>
                  <p
                    className={
                      selectedLead.venue_name
                        ? "font-medium"
                        : "text-muted-foreground italic"
                    }
                  >
                    {selectedLead.venue_name || "Not provided in CRM"}
                  </p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Wedding Venue Location
                  </h4>
                  <p
                    className={
                      selectedLead.venue_location
                        ? "flex items-center gap-1 font-medium"
                        : "text-muted-foreground italic"
                    }
                  >
                    {selectedLead.venue_location ? (
                      <>
                        <MapPin className="h-3 w-3" />{" "}
                        {selectedLead.venue_location}
                      </>
                    ) : (
                      "Not provided in CRM"
                    )}
                  </p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedLead.tags?.map((tag: string) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                    {(!selectedLead.tags || selectedLead.tags.length === 0) && (
                      <span className="text-sm text-muted-foreground">
                        No tags
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedLead._rawContact?.customFields && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Raw CRM Custom Fields (debug)
                  </h4>
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap">
                    {JSON.stringify(
                      selectedLead._rawContact.customFields,
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
