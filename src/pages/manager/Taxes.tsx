import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export default function ManagerTaxes() {
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  // Calculate 1099 data
  const reportData = useMemo(() => {
    // Filter for paid/completed assignments
    const paidAssignments = assignments.filter(
      (a: any) =>
        a.status === "Completed" ||
        a.status === "Payment Received" ||
        a.status === "Paid",
    );

    // Filter by year (using wedding date or assignment creation date as proxy for payment date)
    const yearFiltered = paidAssignments.filter((a: any) => {
      const dateStr = a.jobs?.weddings?.date || a.created_at;
      if (!dateStr) return false;
      return new Date(dateStr).getFullYear().toString() === selectedYear;
    });

    // Group by contractor
    const contractorTotals: Record<
      string,
      {
        id: string;
        name: string;
        email: string;
        address: string;
        totalPaid: number;
        assignmentCount: number;
      }
    > = {};

    yearFiltered.forEach((a: any) => {
      const contractorId = a.contractor_id;
      if (!contractorId) return;

      const contractor = a.contractors;
      const amount = a.jobs?.pay_rate || 0;

      if (!contractorTotals[contractorId]) {
        contractorTotals[contractorId] = {
          id: contractorId,
          name: contractor
            ? `${contractor.first_name} ${contractor.last_name || ""}`.trim()
            : "Unknown",
          email: contractor?.email || "No email",
          address: contractor?.address || "No address provided",
          totalPaid: 0,
          assignmentCount: 0,
        };
      }

      contractorTotals[contractorId].totalPaid += amount;
      contractorTotals[contractorId].assignmentCount += 1;
    });

    return Object.values(contractorTotals).sort(
      (a, b) => b.totalPaid - a.totalPaid,
    );
  }, [assignments, selectedYear]);

  const totalEligible = reportData.filter((d) => d.totalPaid >= 600).length;
  const totalPayoutVolume = reportData.reduce((sum, d) => sum + d.totalPaid, 0);

  const generateYears = () => {
    const years = [];
    const current = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      years.push((current - i).toString());
    }
    return years;
  };

  const exportToCSV = () => {
    const headers = [
      "Contractor Name",
      "Email",
      "Address",
      "Total Paid",
      "1099 Required",
      "Assignment Count",
    ];

    const rows = reportData.map((d) => [
      `"${d.name}"`,
      `"${d.email}"`,
      `"${d.address.replace(/"/g, '""')}"`,
      d.totalPaid,
      d.totalPaid >= 600 ? "Yes" : "No",
      d.assignmentCount,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `1099_Report_${selectedYear}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-8 w-8 text-primary" />
            1099 Reporting
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Track yearly payouts per contractor for tax reporting purposes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px] rounded-full shadow-sm">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {generateYears().map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="rounded-full shadow-sm hover:shadow-md transition-all border-border/50 bg-background/50 backdrop-blur-sm"
            onClick={exportToCSV}
            disabled={reportData.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Payouts ({selectedYear})
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPayoutVolume.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {reportData.length} contractors
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              1099 Eligible (≥$600)
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
              {totalEligible}
            </div>
            <p className="text-xs text-muted-foreground">
              Contractors exceeding threshold
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 shadow-sm border-border/40 rounded-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Below Threshold (&lt;$600)
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
              {reportData.length - totalEligible}
            </div>
            <p className="text-xs text-muted-foreground">No 1099 required</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border/40 rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/40">
          <CardTitle>Contractor Payout Summary</CardTitle>
          <CardDescription>
            Year-to-date totals for {selectedYear}. Contractors with $600 or
            more are flagged for 1099 reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="pl-6">Contractor</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead className="text-center">Assignments</TableHead>
                <TableHead className="text-right pr-6">Total Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Loading data...
                    </p>
                  </TableCell>
                </TableRow>
              ) : reportData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No payouts found for {selectedYear}.
                  </TableCell>
                </TableRow>
              ) : (
                reportData.map((data) => {
                  const isEligible = data.totalPaid >= 600;
                  return (
                    <TableRow
                      key={data.id}
                      className="hover:bg-muted/10 transition-colors"
                    >
                      <TableCell className="pl-6 font-medium">
                        <div className="flex items-center gap-2">
                          {data.name}
                          {isEligible && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 ml-2"
                            >
                              1099 Required
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{data.email}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {data.address}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {data.assignmentCount}
                      </TableCell>
                      <TableCell
                        className={`text-right pr-6 font-bold ${isEligible ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-500"}`}
                      >
                        $
                        {data.totalPaid.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
