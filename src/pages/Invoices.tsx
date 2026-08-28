import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  Receipt,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDisplayDate } from "@/lib/utils";

export default function Invoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  const myAssignments = allAssignments.filter(
    (a) => a.contractor_id === user?.id,
  );

  // Consider "Pending Payout", "Completed", and "Payment Received" as invoice-related statuses
  const invoices = myAssignments.filter(
    (a) =>
      a.status === "Pending Payout" ||
      a.status === "Completed" ||
      a.status === "Payment Received",
  );

  const pendingInvoices = invoices.filter((a) => a.status === "Pending Payout");
  const paidInvoices = invoices.filter((a) => a.status === "Completed");
  const confirmedInvoices = invoices.filter(
    (a) => a.status === "Payment Received",
  );

  const confirmPaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.updateAssignmentStatus(id, "Payment Received");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({
        title: "Payment Confirmed",
        description: "You have successfully marked this payment as received.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderInvoiceCard = (invoice: any) => {
    const job = invoice.jobs;
    const wedding = job?.weddings;
    const amount = job?.pay_rate || 0;

    return (
      <Card key={invoice.id} className="overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                {wedding?.client_name || "Unknown Wedding"}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {wedding?.date ? formatDisplayDate(wedding.date) : "TBD"}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-green-600 dark:text-green-500">
                ${amount}
              </div>
              <div className="mt-1">
                <StatusBadge status={invoice.status} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium">{job?.role}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Submitted:</span>
            <span className="font-medium">
              {new Date(invoice.created_at).toLocaleDateString()}
            </span>
          </div>
          {invoice.invoice_notes && (
            <div className="mt-4 p-3 bg-muted rounded-md text-sm">
              <span className="text-muted-foreground block mb-1 text-xs uppercase font-semibold">
                Notes:
              </span>
              {invoice.invoice_notes}
            </div>
          )}
        </CardContent>
        {invoice.status === "Completed" && (
          <CardFooter className="bg-muted/30 pt-4 border-t">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => confirmPaymentMutation.mutate(invoice.id)}
              disabled={confirmPaymentMutation.isPending}
            >
              {confirmPaymentMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Mark Payment Received
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  };

  const totalPending = pendingInvoices.reduce(
    (sum, a) => sum + (a.jobs?.pay_rate || 0),
    0,
  );
  const totalReceived = [...paidInvoices, ...confirmedInvoices].reduce(
    (sum, a) => sum + (a.jobs?.pay_rate || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Invoices & Payouts
        </h1>
        <p className="text-muted-foreground">
          Track your pending payouts and payment history.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Payouts
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              ${totalPending}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingInvoices.length} invoices awaiting manager approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
              ${totalReceived}
            </div>
            <p className="text-xs text-muted-foreground">
              {paidInvoices.length + confirmedInvoices.length} completed payouts
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingInvoices.length > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
                {pendingInvoices.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="action-needed" className="relative">
            Action Needed
            {paidInvoices.length > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                {paidInvoices.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingInvoices.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <CardTitle className="text-xl">No pending invoices</CardTitle>
              <p className="text-muted-foreground mt-2">
                You don't have any invoices awaiting manager approval.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingInvoices.map(renderInvoiceCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="action-needed" className="space-y-4">
          {paidInvoices.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <CardTitle className="text-xl">You're all caught up</CardTitle>
              <p className="text-muted-foreground mt-2">
                No payments waiting for your confirmation.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paidInvoices.map(renderInvoiceCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {confirmedInvoices.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <CardTitle className="text-xl">No payment history</CardTitle>
              <p className="text-muted-foreground mt-2">
                You haven't confirmed any received payments yet.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {confirmedInvoices.map(renderInvoiceCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
