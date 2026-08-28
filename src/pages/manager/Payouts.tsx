import { useState } from "react";
// Force HMR reload
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  DollarSign,
  ExternalLink,
  CheckCircle,
  MoreHorizontal,
  Undo,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ManagerPayouts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payoutToConfirm, setPayoutToConfirm] = useState<string | null>(null);
  const [editorPayoutToConfirm, setEditorPayoutToConfirm] = useState<
    string | null
  >(null);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [editorRating, setEditorRating] = useState<number>(5);
  const [speedRating, setSpeedRating] = useState<number>(5);
  const [editorFeedback, setEditorFeedback] = useState<string>("");
  const [markReadyToEdit, setMarkReadyToEdit] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] = useState<string>("Venmo");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  const { data: weddings = [] } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  const { data: editors = [] } = useQuery({
    queryKey: ["editors"],
    queryFn: api.getEditors,
  });

  const markEditorPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.updateWedding(id, { editor_invoice_status: "paid" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({ title: "Editor Invoice Marked as Paid" });
    },
  });

  const deleteEditorInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.updateWedding(id, {
        editor_invoice_status: null,
        editor_payout_amount: null,
        editor_invoice_details: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({ title: "Editor Invoice Deleted" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateAssignmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({ title: "Status updated" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update status",
        description: error.message,
      });
    },
  });

  const approvePayoutMutation = useMutation({
    mutationFn: async (id: string) => {
      const assignment = assignments.find((a: any) => a.id === id);
      if (!assignment) throw new Error("Assignment not found");

      // 1. Process Stripe Payout FIRST (so if it fails, we don't mark as paid)
      if (paymentMethod === "Stripe") {
        const stripeAccountId = assignment.contractors?.stripe_account_id;
        if (!stripeAccountId) {
          throw new Error(
            "Contractor does not have a connected Stripe account. Please select another payment method.",
          );
        }
        const amount = assignment.jobs?.pay_rate || 0;
        if (amount > 0) {
          await api.processStripePayout(
            amount,
            stripeAccountId,
            `Payout for ${assignment.jobs?.weddings?.client_name || "Wedding"} - ${assignment.jobs?.role || "Job"}`,
            idempotencyKey,
          );
        }
      }

      // 2. Mark as Completed in the database
      await api.approvePayoutWithRating(
        id,
        editorRating,
        editorFeedback,
        assignment.contractor_id,
        paymentMethod,
        speedRating,
      );

      if (assignment.jobs?.wedding_id && markReadyToEdit) {
        const weddingId = assignment.jobs.wedding_id;
        try {
          await api.updateWedding(weddingId, {
            editing_status: "ready_to_edit",
          });
        } catch (e) {
          console.error("Failed to update wedding status", e);
        }
      }

      if (assignment) {
        try {
          const settings = await api.getPortalSettings();
          const webhookUrl =
            settings?.payout_webhook ||
            localStorage.getItem("veydra_payout_webhook");
          if (webhookUrl) {
            const payload = {
              event: "payout_approved",
              assignment_id: assignment.id,
              amount: assignment.jobs?.pay_rate || 0,
              contractor_id: assignment.contractor_id,
              contractor_name: `${assignment.contractors?.first_name} ${assignment.contractors?.last_name}`,
              contractor_email: assignment.contractors?.email,
              venmo_handle: assignment.contractors?.venmo_handle,
              stripe_account_id: assignment.contractors?.stripe_account_id,
              payment_method: paymentMethod,
              wedding_name: assignment.jobs?.weddings?.client_name,
              role: assignment.jobs?.role,
            };

            fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
              .then(async (res) => {
                api.logApiEvent(
                  "Webhook: payout_approved",
                  JSON.stringify(payload),
                  await res.text(),
                  res.ok ? "success" : "error",
                );
              })
              .catch((err) => {
                api.logApiEvent(
                  "Webhook: payout_approved",
                  JSON.stringify(payload),
                  null,
                  "error",
                  err.message,
                );
              });
          }
        } catch (e) {
          console.error("Failed to trigger payout webhook", e);
        }
      }
    },
    onSuccess: (_, id) => {
      setPaidIds((prev) => new Set(prev).add(id));
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      toast({
        title: "Payout Approved",
        description:
          "Payment is approved and sent to the owner for processing. Please allow 12-24 hours for it to come through.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to approve payout",
        description: error.message,
      });
    },
  });

  const approveEditorPayoutMutation = useMutation({
    mutationFn: async (id: string) => {
      const wedding = weddings.find((w: any) => w.id === id);
      if (!wedding) throw new Error("Wedding not found");

      const editor = editors.find((e) => e.id === wedding.editor_id);
      if (!editor) throw new Error("Editor not found");

      if (paymentMethod === "Stripe") {
        const stripeAccountId = editor.stripe_account_id;
        if (!stripeAccountId) {
          throw new Error(
            "Editor does not have a connected Stripe account. Please select another payment method.",
          );
        }
        const amount = wedding.editor_payout_amount || 0;
        if (amount > 0) {
          await api.processStripePayout(
            amount,
            stripeAccountId,
            `Payout for ${wedding.client_name} - Editing`,
            idempotencyKey,
          );
        }
      }

      await api.updateWedding(id, { editor_invoice_status: "paid" });

      if (editor.email) {
        const amount = wedding.editor_payout_amount || 0;
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Payment Processed</h2>
            <p>Hi ${editor.name || "Editor"},</p>
            <p>Your invoice for <strong>${wedding.client_name}</strong> has been approved.</p>
            <p>A payment of <strong>$${amount}</strong> has been processed via <strong>${paymentMethod}</strong>.</p>
            <p>Thank you for your work!</p>
          </div>
        `;
        try {
          await api.sendOvantaEmail(
            editor.email,
            `Payment Processed: ${wedding.client_name}`,
            html,
            editor.name,
          );
        } catch (e) {
          console.error("Failed to send editor payment email", e);
        }
      }
    },
    onSuccess: (_, id) => {
      setPaidIds((prev) => new Set(prev).add(id));
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({
        title: "Editor Payout Approved",
        description:
          "Payment is approved and sent to the owner for processing.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to approve editor payout",
        description: error.message,
      });
    },
  });

  const pendingPayouts = assignments.filter(
    (a: any) => a.status === "Pending Payout",
  );
  const paidHistory = assignments.filter(
    (a: any) => a.status === "Completed" || a.status === "Payment Received",
  );

  const editorInvoices = weddings.filter((w) => w.editor_invoice_status);
  const pendingEditorInvoices = editorInvoices.filter(
    (w) =>
      w.editor_invoice_status === "pending" ||
      w.editor_invoice_status === "approved",
  );
  const paidEditorInvoices = editorInvoices.filter(
    (w) => w.editor_invoice_status === "paid",
  );

  const renderTable = (
    data: any[],
    isPending: boolean,
    isHistory: boolean = false,
  ) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contractor</TableHead>
          <TableHead>Wedding</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Payout Amount</TableHead>
          <TableHead className="text-center">Media</TableHead>
          {(isPending || isHistory) && (
            <TableHead className="text-right">Actions</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={isPending ? 6 : 5} className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </TableCell>
          </TableRow>
        ) : data.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={isPending ? 6 : 5}
              className="text-center py-8 text-muted-foreground"
            >
              No {isPending ? "pending" : "completed"} payouts found.
            </TableCell>
          </TableRow>
        ) : (
          data.map((assg: any) => {
            const job = assg.jobs;
            const wedding = job?.weddings;
            const contractor = assg.contractors;
            const basePay = job?.pay_rate || 0;
            const total = basePay;

            return (
              <TableRow key={assg.id}>
                <TableCell>
                  <div className="font-medium">
                    {contractor?.first_name} {contractor?.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {isHistory && assg.payment_method ? (
                      <span className="font-medium text-green-600 dark:text-green-500">
                        Paid via {assg.payment_method}
                      </span>
                    ) : contractor?.venmo_handle ? (
                      `Venmo: ${contractor.venmo_handle}`
                    ) : (
                      "No payment info"
                    )}
                  </div>
                </TableCell>
                <TableCell>{wedding?.client_name}</TableCell>
                <TableCell>{job?.role}</TableCell>
                <TableCell className="text-right font-bold text-green-600 dark:text-green-500">
                  ${total}
                </TableCell>
                <TableCell className="text-center">
                  {assg.media_link ? (
                    <div className="flex flex-col gap-1">
                      <a
                        href={assg.media_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                      >
                        View Link <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                      {(assg.file_count || assg.invoice_notes) && (
                        <span
                          className="text-[10px] text-muted-foreground line-clamp-2"
                          title={
                            assg.invoice_notes ||
                            `File Count: ${assg.file_count}`
                          }
                        >
                          {assg.file_count
                            ? `Files: ${assg.file_count}`
                            : assg.invoice_notes}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">
                      N/A
                    </span>
                  )}
                </TableCell>
                {(isPending || isHistory) && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isPending && (
                        <Button
                          size="sm"
                          onClick={() => {
                            if (
                              !contractor?.venmo_handle &&
                              !contractor?.stripe_account_id
                            ) {
                              toast({
                                title: "Payment Info Missing",
                                description:
                                  "This contractor hasn't connected a Stripe account or provided a Venmo handle, but you can still record the payout if you paid them another way.",
                              });
                            }
                            setPayoutToConfirm(assg.id);
                            setIdempotencyKey(crypto.randomUUID());
                          }}
                          disabled={paidIds.has(assg.id)}
                          className={
                            paidIds.has(assg.id)
                              ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          }
                        >
                          {paidIds.has(assg.id) ? (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" /> Paid
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" /> Approve
                              and pay
                            </>
                          )}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isPending ? (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: assg.id,
                                    status: "Action Required",
                                  })
                                }
                              >
                                <Undo className="mr-2 h-4 w-4" />
                                Reject back to contractor
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: assg.id,
                                    status: "Cancelled",
                                  })
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Payout
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: assg.id,
                                    status: "Pending Payout",
                                  })
                                }
                              >
                                <Undo className="mr-2 h-4 w-4" />
                                Revert to Pending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: assg.id,
                                    status: "Cancelled",
                                  })
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Payout
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                )}
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-green-600 dark:text-green-500" />
            Payouts & Invoices
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Review contractor media submissions and approve their payouts.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approvals
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayouts.length}</div>
            <p className="text-xs text-muted-foreground">
              Invoices awaiting review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Pending ($)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
              $
              {pendingPayouts.reduce(
                (sum: number, a: any) => sum + (a.jobs?.pay_rate || 0),
                0,
              )}
            </div>
            <p className="text-xs text-muted-foreground">To be paid out</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Payouts
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidHistory.length}</div>
            <p className="text-xs text-muted-foreground">
              Historically paid invoices
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            Pending Payouts
            {pendingPayouts.length > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                {pendingPayouts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Paid History</TabsTrigger>
          <TabsTrigger value="editor-payouts" className="relative">
            Editor Payouts
            {pendingEditorInvoices.length > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
                {pendingEditorInvoices.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Needs Review</CardTitle>
              <CardDescription>
                These contractors have submitted their raw media links and are
                waiting for their invoice to be approved.
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTable(pendingPayouts, true)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Completed Payouts</CardTitle>
              <CardDescription>
                History of all approved and paid assignments.
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTable(paidHistory, false, true)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editor-payouts">
          <Card>
            <CardHeader>
              <CardTitle>Editor Payouts</CardTitle>
              <CardDescription>
                Track and manage editor invoices and payouts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Editor</TableHead>
                    <TableHead>Wedding</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editorInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No editor invoices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    editorInvoices
                      .sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime(),
                      )
                      .map((wedding) => {
                        const editor = editors.find(
                          (e) => e.id === wedding.editor_id,
                        );
                        return (
                          <TableRow key={wedding.id}>
                            <TableCell className="font-medium">
                              {editor?.name || "Unknown Editor"}
                            </TableCell>
                            <TableCell>{wedding.client_name}</TableCell>
                            <TableCell>
                              <div className="text-xs text-muted-foreground">
                                {wedding.editor_invoice_details?.photoCount >
                                  0 && (
                                  <span>
                                    {wedding.editor_invoice_details.photoCount}{" "}
                                    Photos
                                  </span>
                                )}
                                {wedding.editor_invoice_details?.videos
                                  ?.length > 0 && (
                                  <span>
                                    {" "}
                                    •{" "}
                                    {
                                      wedding.editor_invoice_details.videos
                                        .length
                                    }{" "}
                                    Videos
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  wedding.editor_invoice_status === "paid"
                                    ? "default"
                                    : wedding.editor_invoice_status ===
                                        "approved"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {wedding.editor_invoice_status === "paid"
                                  ? "Paid"
                                  : wedding.editor_invoice_status === "approved"
                                    ? "Approved"
                                    : "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-green-600 dark:text-green-500">
                              ${wedding.editor_payout_amount}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {wedding.editor_invoice_status !== "paid" && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      if (
                                        !editor?.venmo_handle &&
                                        !editor?.stripe_account_id
                                      ) {
                                        toast({
                                          title: "Payment Info Missing",
                                          description:
                                            "This editor hasn't connected a Stripe account or provided a Venmo handle, but you can still record the payout if you paid them another way.",
                                        });
                                      }
                                      setEditorPayoutToConfirm(wedding.id);
                                      setIdempotencyKey(crypto.randomUUID());
                                    }}
                                    disabled={paidIds.has(wedding.id)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />{" "}
                                    Approve and pay
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                                      onClick={() =>
                                        deleteEditorInvoiceMutation.mutate(
                                          wedding.id,
                                        )
                                      }
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete Payout
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={!!payoutToConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setPayoutToConfirm(null);
            setEditorRating(5);
            setSpeedRating(5);
            setEditorFeedback("");
            setMarkReadyToEdit(true);
            setPaymentMethod("Venmo");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve and pay</AlertDialogTitle>
            <AlertDialogDescription>
              Review the media, select payment method, and provide a rating
              before releasing the payout.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Media Quality & Professionalism
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEditorRating(star)}
                    className={`text-2xl transition-colors ${star <= editorRating ? "text-yellow-500" : "text-muted"}`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground font-medium">
                  {editorRating}.0 / 5.0
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Submission Speed (Turnaround Time)
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSpeedRating(star)}
                    className={`text-2xl transition-colors ${star <= speedRating ? "text-yellow-500" : "text-muted"}`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground font-medium">
                  {speedRating}.0 / 5.0
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Internal Feedback (Optional)
              </label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Leave notes about framing, lighting, or attitude..."
                value={editorFeedback}
                onChange={(e) => setEditorFeedback(e.target.value)}
              />
            </div>

            <div className="space-y-2 pt-2 border-t mt-4">
              <label className="text-sm font-medium">Payment Method</label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="flex flex-col space-y-2 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Stripe" id="pm-stripe" />
                  <label
                    htmlFor="pm-stripe"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Stripe Direct Transfer
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Zelle" id="pm-zelle" />
                  <label
                    htmlFor="pm-zelle"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Zelle
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Venmo" id="pm-venmo" />
                  <label
                    htmlFor="pm-venmo"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Venmo
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CashApp" id="pm-cashapp" />
                  <label
                    htmlFor="pm-cashapp"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    CashApp
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PayPal" id="pm-paypal" />
                  <label
                    htmlFor="pm-paypal"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    PayPal
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Other" id="pm-other" />
                  <label
                    htmlFor="pm-other"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Other
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t mt-4">
              <input
                type="checkbox"
                id="markReadyToEdit"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={markReadyToEdit}
                onChange={(e) => setMarkReadyToEdit(e.target.checked)}
              />
              <label
                htmlFor="markReadyToEdit"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Mark wedding as "Ready to Edit"
              </label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={approvePayoutMutation.isPending || isSubmitting}
              onClick={() => {
                setEditorRating(5);
                setEditorFeedback("");
                setMarkReadyToEdit(true);
                setPaymentMethod("Venmo");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (payoutToConfirm && !isSubmitting) {
                  setIsSubmitting(true);
                  approvePayoutMutation.mutate(payoutToConfirm, {
                    onSuccess: () => {
                      setPayoutToConfirm(null);
                      setIsSubmitting(false);
                    },
                    onError: () => {
                      setIsSubmitting(false);
                    },
                  });
                }
              }}
              disabled={approvePayoutMutation.isPending || isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approvePayoutMutation.isPending || isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Yes, Approve and pay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!editorPayoutToConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setEditorPayoutToConfirm(null);
            setPaymentMethod("Venmo");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Editor Payout</AlertDialogTitle>
            <AlertDialogDescription>
              Select payment method before releasing the payout.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="flex flex-col space-y-2 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Stripe" id="editor-pm-stripe" />
                  <label
                    htmlFor="editor-pm-stripe"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Stripe Direct Transfer
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Zelle" id="editor-pm-zelle" />
                  <label
                    htmlFor="editor-pm-zelle"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Zelle
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Venmo" id="editor-pm-venmo" />
                  <label
                    htmlFor="editor-pm-venmo"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Venmo
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CashApp" id="editor-pm-cashapp" />
                  <label
                    htmlFor="editor-pm-cashapp"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    CashApp
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PayPal" id="editor-pm-paypal" />
                  <label
                    htmlFor="editor-pm-paypal"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    PayPal
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Other" id="editor-pm-other" />
                  <label
                    htmlFor="editor-pm-other"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Other
                  </label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={approveEditorPayoutMutation.isPending || isSubmitting}
              onClick={() => {
                setPaymentMethod("Venmo");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (editorPayoutToConfirm && !isSubmitting) {
                  setIsSubmitting(true);
                  approveEditorPayoutMutation.mutate(editorPayoutToConfirm, {
                    onSuccess: () => {
                      setEditorPayoutToConfirm(null);
                      setIsSubmitting(false);
                    },
                    onError: () => {
                      setIsSubmitting(false);
                    },
                  });
                }
              }}
              disabled={approveEditorPayoutMutation.isPending || isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approveEditorPayoutMutation.isPending || isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Yes, Approve and pay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
