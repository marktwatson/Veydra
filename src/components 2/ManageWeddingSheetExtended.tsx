import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  DollarSign,
  Lock,
  ExternalLink,
  FileText,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { cn, formatDisplayDate } from "@/lib/utils";
import WeddingBookedServices from "@/components/WeddingBookedServices";
import { ChangePendingBadge } from "@/components/ChangePendingBadge";

const REGIONS_FALLBACK: string[] = [];

/**
 * Extended Manage Wedding Sheet — available for ALL statuses:
 * pending, draft, viewed, promised/claimed, upcoming, completed.
 * Cancelled = read-only (no form submission).
 *
 * Tabs: details, booked, jobs, questionnaire, financials, notes, documents
 */
export function ManageWeddingSheetExtended({
  wedding,
  trigger,
}: {
  wedding: any;
  trigger?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isCancelled =
    String(wedding.status || "").toLowerCase() === "cancelled";
  const readOnly = isCancelled;

  // ---- Details state ----
  const [clientName, setClientName] = useState(wedding.client_name);
  const [partnerName, setPartnerName] = useState(wedding.partner_name || "");
  const [clientEmail, setClientEmail] = useState(wedding.client_email || "");
  const [date, setDate] = useState(
    wedding.date ? wedding.date.split("T")[0] : "",
  );
  const [contractDate, setContractDate] = useState(
    wedding.contract_date ? wedding.contract_date.split("T")[0] : "",
  );
  const [location, setLocation] = useState(wedding.location || "");
  const [notes, setNotes] = useState(wedding.notes || "");
  const [status, setStatus] = useState(wedding.status);

  // ---- Financials state ----
  const [totalAmount, setTotalAmount] = useState<number>(
    wedding.total_amount || 0,
  );
  const [paidAmount, setPaidAmount] = useState<number>(
    wedding.paid_amount || 0,
  );
  const [paymentPlan, setPaymentPlan] = useState(wedding.payment_plan || "");
  const [customPaymentPlan, setCustomPaymentPlan] = useState<any>(
    typeof wedding.custom_payment_plan === "string"
      ? JSON.parse(wedding.custom_payment_plan)
      : wedding.custom_payment_plan || {
          enabled: false,
          deposit: 0,
          installments: [],
        },
  );

  // ---- Jobs state ----
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsToDelete, setJobsToDelete] = useState<string[]>([]);

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
  });
  const regions = Array.isArray(settings?.regions)
    ? settings.regions
    : REGIONS_FALLBACK;

  const { data: initialJobs = [] } = useQuery({
    queryKey: ["jobs", "wedding", wedding.id],
    queryFn: () => api.getJobsForWedding(wedding.id),
    enabled: isOpen,
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
    enabled: isOpen,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["wedding-documents", wedding.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wedding_documents")
        .select("*")
        .eq("wedding_id", wedding.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isOpen,
  });

  const [region, setRegion] = useState<string>(
    Array.isArray(wedding.region)
      ? wedding.region[0] || ""
      : wedding.region || "",
  );

  // Sync jobs when loaded
  useState(() => {
    if (isOpen && initialJobs.length > 0) {
      setJobs(initialJobs);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.updateWedding(wedding.id, {
        client_name: clientName,
        client_email: clientEmail,
        partner_name: partnerName,
        date,
        location,
        region: region ? [region] : null,
        notes,
        status,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        payment_plan: paymentPlan,
        custom_payment_plan: customPaymentPlan,
        contract_date: contractDate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setIsOpen(false);
      toast({ title: "Wedding Updated", description: "Changes saved." });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err.message,
      });
    },
  });

  const remaining = Math.max(
    0,
    (Number(totalAmount) || 0) - (Number(paidAmount) || 0),
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Manage
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[420px] sm:w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Manage Wedding
            {readOnly && (
              <Badge variant="secondary" className="text-xs">
                <Lock className="h-3 w-3 mr-1" /> Read-only
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {wedding.client_name} — {formatDisplayDate(wedding.date)}
            {readOnly && " (cancelled — restore to edit)"}
          </SheetDescription>
        </SheetHeader>

        <div className="py-4">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="booked">Booked</TabsTrigger>
              <TabsTrigger value="jobs">Positions</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
            </TabsList>
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="questionnaire">Questionnaire</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            {/* DETAILS */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Client Name</Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Partner Name</Label>
                  <Input
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={status}
                    onValueChange={setStatus}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending Review</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Location</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Region</Label>
                  <Select
                    value={region || undefined}
                    onValueChange={setRegion}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((r: string) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Contract Date</Label>
                <Input
                  type="date"
                  value={contractDate}
                  onChange={(e) => setContractDate(e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </TabsContent>

            {/* BOOKED SERVICES */}
            <TabsContent value="booked" className="space-y-4">
              <WeddingBookedServices wedding={wedding} />
              {wedding.ghl_invoice_url && (
                <a
                  href={wedding.ghl_invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open GHL invoice
                </a>
              )}
            </TabsContent>

            {/* JOBS */}
            <TabsContent value="jobs" className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-sm font-semibold">Positions (Jobs)</h3>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setJobs([
                        ...jobs,
                        {
                          id: `new-${Date.now()}`,
                          role: "",
                          pay_rate: 0,
                          pay_type: "flat",
                          hours: null,
                          addons: [],
                          status: "open",
                          contractor_id: "unassigned",
                        },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                )}
              </div>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  No jobs yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job, i) => (
                    <div
                      key={job.id}
                      className="p-3 rounded-lg border bg-muted/20"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">
                          {job.role || "Unassigned role"}
                        </span>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => {
                              if (job.id && !job.id.startsWith("new-"))
                                setJobsToDelete([...jobsToDelete, job.id]);
                              setJobs(jobs.filter((_, idx) => idx !== i));
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                          Pay: ${job.pay_rate || 0} · {job.pay_type || "flat"}
                        </div>
                        <div>Hours: {job.hours || "—"}</div>
                        <div>Status: {job.status || "open"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* FINANCIALS */}
            <TabsContent value="financials" className="space-y-4">
              <ChangePendingBadge weddingId={wedding.id} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Total ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={totalAmount || ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        setTotalAmount(parseFloat(e.target.value) || 0)
                      }
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Paid ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={paidAmount || ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        setPaidAmount(parseFloat(e.target.value) || 0)
                      }
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Remaining balance
                </span>
                <span className="font-semibold">
                  {remaining > 0 ? `$${remaining.toFixed(2)}` : "Paid in full"}
                </span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Payment Plan</Label>
                <Select
                  value={paymentPlan || "full"}
                  onValueChange={setPaymentPlan}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Paid in Full</SelectItem>
                    <SelectItem value="half">50/50 Split</SelectItem>
                    <SelectItem value="deposit">
                      Monthly ($99 Deposit)
                    </SelectItem>
                    <SelectItem value="quarterly">
                      Quarterly ($99 Deposit)
                    </SelectItem>
                    <SelectItem value="custom">Custom Payment Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentPlan === "custom" && (
                <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cpp-enabled"
                      checked={!!customPaymentPlan.enabled}
                      disabled={readOnly}
                      onCheckedChange={(c) =>
                        setCustomPaymentPlan({
                          ...customPaymentPlan,
                          enabled: !!c,
                        })
                      }
                    />
                    <Label htmlFor="cpp-enabled" className="text-xs">
                      Enable Custom Plan
                    </Label>
                  </div>
                  {customPaymentPlan.enabled && (
                    <div className="space-y-2">
                      <Label className="text-xs">Deposit ($)</Label>
                      <Input
                        type="number"
                        value={customPaymentPlan.deposit || ""}
                        disabled={readOnly}
                        onChange={(e) =>
                          setCustomPaymentPlan({
                            ...customPaymentPlan,
                            deposit: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <Label className="text-xs">Installments</Label>
                      {(customPaymentPlan.installments || []).map(
                        (inst: any, idx: number) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              type="date"
                              value={inst.date}
                              disabled={readOnly}
                              onChange={(e) => {
                                const ni = [...customPaymentPlan.installments];
                                ni[idx].date = e.target.value;
                                setCustomPaymentPlan({
                                  ...customPaymentPlan,
                                  installments: ni,
                                });
                              }}
                            />
                            <Input
                              type="number"
                              value={inst.amount || ""}
                              disabled={readOnly}
                              onChange={(e) => {
                                const ni = [...customPaymentPlan.installments];
                                ni[idx].amount =
                                  parseFloat(e.target.value) || 0;
                                setCustomPaymentPlan({
                                  ...customPaymentPlan,
                                  installments: ni,
                                });
                              }}
                            />
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
              {wedding.ghl_invoice_url && (
                <a
                  href={wedding.ghl_invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open GHL invoice
                </a>
              )}
            </TabsContent>

            {/* QUESTIONNAIRE */}
            <TabsContent value="questionnaire" className="space-y-4">
              {wedding.questionnaire_data &&
              Object.keys(wedding.questionnaire_data).length > 0 ? (
                <pre className="text-xs whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border max-h-[400px] overflow-y-auto">
                  {JSON.stringify(wedding.questionnaire_data, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No questionnaire submitted yet.
                </p>
              )}
            </TabsContent>

            {/* NOTES */}
            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Internal Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={readOnly}
                  className="min-h-[120px]"
                />
              </div>
            </TabsContent>

            {/* DOCUMENTS */}
            <TabsContent value="documents" className="space-y-4">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.name || doc.file_name || "Document"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDisplayDate(doc.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {!readOnly && (
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
