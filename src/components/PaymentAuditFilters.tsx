import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Calendar } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
}

interface Metrics {
  overdueCount: number;
  pendingCount: number;
  paidCount: number;
}

interface Props {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  clientFilter: string;
  onClientFilterChange: (v: string) => void;
  clientOptions: ClientOption[];
  dateFilter: string;
  onDateFilterChange: (v: string) => void;
  statusFilter: "all" | "paid" | "overdue" | "pending";
  onStatusFilterChange: (v: "all" | "paid" | "overdue" | "pending") => void;
  planFilter: string;
  onPlanFilterChange: (v: string) => void;
  sortBy: "date-asc" | "date-desc" | "name-asc" | "name-desc";
  onSortByChange: (
    v: "date-asc" | "date-desc" | "name-asc" | "name-desc",
  ) => void;
  totalItems: number;
  metrics: Metrics;
  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
}

export function PaymentAuditFilters(props: Props) {
  const {
    searchTerm,
    onSearchChange,
    clientFilter,
    onClientFilterChange,
    clientOptions,
    dateFilter,
    onDateFilterChange,
    statusFilter,
    onStatusFilterChange,
    planFilter,
    onPlanFilterChange,
    sortBy,
    onSortByChange,
    totalItems,
    metrics,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
  } = props;

  return (
    <Card className="shadow-sm border-border/40 rounded-2xl bg-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search client name, email, or payment label..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 rounded-full"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Client Name */}
            <Select value={clientFilter} onValueChange={onClientFilterChange}>
              <SelectTrigger className="w-[170px] rounded-full text-xs">
                <SelectValue placeholder="Filter by Client" />
              </SelectTrigger>
              <SelectContent rounded-xl className="max-h-60">
                <SelectItem value="all">
                  All Clients ({clientOptions.length})
                </SelectItem>
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filter by Date */}
            <Select value={dateFilter} onValueChange={onDateFilterChange}>
              <SelectTrigger className="w-[160px] rounded-full text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent rounded-xl>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="past">Past Due & Historical</SelectItem>
                <SelectItem value="today">Due Today</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="next-30">Next 30 Days</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(v: any) => onStatusFilterChange(v)}
            >
              <SelectTrigger className="w-[140px] rounded-full text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent rounded-xl>
                <SelectItem value="all">All Statuses ({totalItems})</SelectItem>
                <SelectItem value="overdue">
                  Overdue ({metrics.overdueCount})
                </SelectItem>
                <SelectItem value="pending">
                  Pending ({metrics.pendingCount})
                </SelectItem>
                <SelectItem value="paid">Paid ({metrics.paidCount})</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment Plan Filter */}
            <Select value={planFilter} onValueChange={onPlanFilterChange}>
              <SelectTrigger className="w-[150px] rounded-full text-xs">
                <SelectValue placeholder="All Payment Plans" />
              </SelectTrigger>
              <SelectContent rounded-xl>
                <SelectItem value="all">All Payment Plans</SelectItem>
                <SelectItem value="custom">Custom Plan</SelectItem>
                <SelectItem value="full">Pay in Full</SelectItem>
                <SelectItem value="half">50/50 Split</SelectItem>
                <SelectItem value="monthly">Monthly Plan</SelectItem>
                <SelectItem value="quarterly">Quarterly Plan</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Select
              value={sortBy}
              onValueChange={(v: any) => onSortByChange(v)}
            >
              <SelectTrigger className="w-[150px] rounded-full text-xs">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent rounded-xl>
                <SelectItem value="date-asc">Date: Earliest First</SelectItem>
                <SelectItem value="date-desc">Date: Latest First</SelectItem>
                <SelectItem value="name-asc">Client: A to Z</SelectItem>
                <SelectItem value="name-desc">Client: Z to A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Date Inputs if Custom Date selected */}
        {dateFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">Start:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="h-8 rounded-full text-xs w-[140px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">End:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="h-8 rounded-full text-xs w-[140px]"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onStartDateChange("");
                  onEndDateChange("");
                }}
                className="h-8 text-xs rounded-full text-muted-foreground hover:text-foreground"
              >
                Clear Custom Dates
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
