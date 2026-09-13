import { Link } from "react-router-dom";
import { Search, Sparkles, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/utils";

interface LeadsTabProps {
  loadingLeads: boolean;
  filteredLeads: any[];
  leadTagFilter: "all" | "new";
  onLeadTagFilter: (v: "all" | "new") => void;
  searchTerm: string;
  onSearchTerm: (v: string) => void;
}

export function GrowthLeadsTab(props: LeadsTabProps) {
  const {
    loadingLeads,
    filteredLeads,
    leadTagFilter,
    onLeadTagFilter,
    searchTerm,
    onSearchTerm,
  } = props;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Leads & Inquiries Pipeline</h3>
          <p className="text-xs text-muted-foreground">
            Incoming prospective clients synced with Ovanta CRM
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/40 p-0.5 rounded-full border border-border/40">
            <Button
              size="sm"
              variant={leadTagFilter === "all" ? "default" : "ghost"}
              onClick={() => onLeadTagFilter("all")}
              className="rounded-full h-7 text-[11px] px-3"
            >
              All CRM Contacts
            </Button>
            <Button
              size="sm"
              variant={leadTagFilter === "new" ? "default" : "ghost"}
              onClick={() => onLeadTagFilter("new")}
              className="rounded-full h-7 text-[11px] px-3"
            >
              New Leads Only
            </Button>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => onSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-full border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            asChild
            className="rounded-full text-xs"
          >
            <Link to="/manager/leads">Full Leads List</Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Contact Name</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingLeads ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  Loading leads...
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No matching leads found.
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead: any) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="font-semibold text-sm">{lead.name}</div>
                    {lead.leadToBookingDays !== null && (
                      <div className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Booked in{" "}
                        {lead.leadToBookingDays} days
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>{lead.email}</div>
                      <div>{lead.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        lead.status === "Booked"
                          ? "default"
                          : lead.status === "New"
                            ? "secondary"
                            : "outline"
                      }
                      className={`rounded-full px-2.5 text-[10px] ${lead.status === "Booked" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : ""}`}
                    >
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{lead.source}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDisplayDate(lead.date)}
                  </TableCell>
                  <TableCell className="text-right">
                    {lead.matchedWedding ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        className="rounded-full h-8 text-xs text-emerald-600 hover:text-emerald-700"
                      >
                        <Link to="/manager/weddings">
                          View Project <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        className="rounded-full h-8 text-xs"
                      >
                        <Link to="/manager/proposals">
                          Build Proposal{" "}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
