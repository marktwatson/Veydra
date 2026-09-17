import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { generatePaymentSchedule, formatDisplayDate } from "@/lib/utils";
import { buildPlanChangeEmail } from "@/lib/payment-plan-email";
import { InstallmentEditor, type Installment } from "./InstallmentEditor";

interface PendingRequest {
  id: string;
  status: string;
  customer_token: string;
  staff_note?: string | null;
  proposed_plan: any;
  created_at: string;
}

function fmtMoney(n: number) {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function toISO(displayDate: string): string {
  const parts = displayDate.split("/");
  if (parts.length === 3)
    return `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  return displayDate;
}

export function ChangePaymentPlanDialog({
  wedding,
  open,
  onOpenChange,
  settings,
  onEmailPreview,
}: {
  wedding: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: any;
  onEmailPreview: (
    email: string,
    subject: string,
    html: string,
    name: string,
    sendFn: () => Promise<void>,
  ) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [staffNote, setStaffNote] = useState("");
  const [planType, setPlanType] = useState<string>("custom");
  const [sending, setSending] = useState(false);

  const total = Number(wedding?.total_amount) || 0;
  const paid = Number(wedding?.paid_amount) || 0;
  const outstanding = Math.max(0, total - paid);
  const weddingDate = wedding?.date ? wedding.date.split("T")[0] : "";
  const contractDate =
    wedding?.contract_date || wedding?.created_at || todayStr();

  const currentPlan =
    typeof wedding?.custom_payment_plan === "string"
      ? (() => {
          try {
            return JSON.parse(wedding.custom_payment_plan);
          } catch {
            return null;
          }
        })()
      : wedding?.custom_payment_plan;

  const loadPending = useCallback(async () => {
    if (!wedding?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("payment_plan_change_requests")
        .select("*")
        .eq("wedding_id", wedding.id)
        .eq("status", "pending")
        .maybeSingle();
      setPending(data || null);
      if (data?.proposed_plan?.custom_payment_plan?.installments) {
        setInstallments(
          data.proposed_plan.custom_payment_plan.installments.map((i: any) => ({
            date: i.date,
            amount: Number(i.amount) || 0,
            label: i.label,
          })),
        );
        setStaffNote(data.staff_note || "");
      }
    } finally {
      setLoading(false);
    }
  }, [wedding?.id]);

  useEffect(() => {
    if (open && wedding?.id) {
      const schedule = generatePaymentSchedule(
        total,
        wedding.payment_plan || "full",
        weddingDate,
        contractDate,
        paid,
        currentPlan,
      );
      const unpaid = schedule
        .filter((s: any) => s.status !== "paid")
        .map((s: any) => ({
          date: s.date && s.date !== "TBD" ? toISO(s.date) : "",
          amount: Number(s.amount) || 0,
        }));
      setInstallments(unpaid.length ? unpaid : []);
      setStaffNote("");
      setPlanType("custom");
      loadPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wedding?.id]);

  const regenerateFromType = (type: string) => {
    setPlanType(type);
    if (type === "custom") return;
    const sched = generatePaymentSchedule(
      outstanding,
      type,
      weddingDate || todayStr(),
      todayStr(),
      0,
      null,
    );
    setInstallments(
      sched
        .filter((s: any) => s.status !== "paid")
        .map((s: any) => ({
          date: s.date && s.date !== "TBD" ? toISO(s.date) : "",
          amount: Number(s.amount) || 0,
        })),
    );
  };

  const proposedSum = useMemo(
    () => installments.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [installments],
  );
  const sumMatches = Math.abs(proposedSum - outstanding) <= 0.01;
  const allDatesValid = installments.every(
    (i) => i.date && i.date >= todayStr() && i.amount > 0,
  );
  const hasRows = installments.length > 0;

  const cancelPending = async () => {
    if (!pending) return;
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/payment-plan-approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ action: "cancel", requestId: pending.id }),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast({ title: "Request cancelled" });
        setPending(null);
      } else throw new Error(data.error);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to cancel",
        description: e.message,
      });
    }
  };

  const handleSend = async () => {
    if (!sumMatches) {
      toast({
        variant: "destructive",
        title: "Amounts don't match",
        description: `Proposed total (${fmtMoney(proposedSum)}) must equal the outstanding balance (${fmtMoney(outstanding)}).`,
      });
      return;
    }
    if (!allDatesValid) {
      toast({
        variant: "destructive",
        title: "Invalid dates",
        description:
          "Every installment needs a valid date (today or later) and amount.",
      });
      return;
    }
    const email =
      wedding?.client_email ||
      wedding?.questionnaire_data?.contact_info?.email ||
      wedding?.questionnaire_data?.email;
    if (!email) {
      toast({
        variant: "destructive",
        title: "No email",
        description: "Add the client's email before sending.",
      });
      return;
    }

    const currentSchedule = generatePaymentSchedule(
      total,
      wedding.payment_plan || "full",
      weddingDate,
      contractDate,
      paid,
      currentPlan,
    );
    const customerToken = crypto.randomUUID();
    const appUrl = (settings?.app_url || window.location.origin).replace(
      /\/$/,
      "",
    );
    const approvalLink = `${appUrl}/payment-plan/${customerToken}`;
    const proposedPlan = {
      payment_plan: "custom",
      custom_payment_plan: {
        enabled: true,
        deposit: 0,
        installments: installments.map((i, idx) => ({
          date: i.date,
          amount: Number(i.amount) || 0,
          label: i.label || `Installment #${idx + 1}`,
        })),
      },
    };

    setSending(true);
    try {
      if (pending?.id) {
        await supabase
          .from("payment_plan_change_requests")
          .update({
            proposed_plan: proposedPlan,
            staff_note: staffNote || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pending.id);
      } else {
        const { error } = await supabase
          .from("payment_plan_change_requests")
          .insert({
            wedding_id: wedding.id,
            status: "pending",
            current_plan: {
              payment_plan: wedding.payment_plan || "full",
              custom_payment_plan: currentPlan || null,
              schedule: currentSchedule,
            },
            proposed_plan: proposedPlan,
            staff_note: staffNote || null,
            customer_token: customerToken,
          });
        if (error) throw error;
      }

      const { subject, html } = buildPlanChangeEmail(
        installments,
        staffNote,
        settings,
        wedding,
        approvalLink,
      );

      onEmailPreview(email, subject, html, wedding.client_name, async () => {
        await api.sendOvantaEmail(
          email,
          subject,
          html,
          wedding.client_name,
          true,
        );
        try {
          const sms = `Hi ${wedding.client_name.split(" ")[0]}! ${settings?.company_name || "We"} sent you a proposed payment plan update. Review & approve here: ${approvalLink}`;
          await api.sendOvantaSms(email, sms, wedding.client_name, true);
        } catch {
          /* SMS optional */
        }
        await api.logAdminActivity(
          "Payment Plan Change Requested",
          `Sent payment plan change request to ${wedding.client_name} (${email}).`,
        );
        toast({
          title: "Request sent!",
          description: `Approval link emailed to ${email}.`,
        });
        loadPending();
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to create request",
        description: e.message,
      });
    } finally {
      setSending(false);
    }
  };

  const resendLink = async () => {
    if (!pending) return;
    const email = wedding?.client_email;
    if (!email) return;
    const appUrl = (settings?.app_url || window.location.origin).replace(
      /\/$/,
      "",
    );
    const link = `${appUrl}/payment-plan/${pending.customer_token}`;
    const { subject, html } = buildPlanChangeEmail(
      pending.proposed_plan?.custom_payment_plan?.installments || [],
      pending.staff_note || "",
      settings,
      wedding,
      link,
    );
    onEmailPreview(email, subject, html, wedding.client_name, async () => {
      await api.sendOvantaEmail(
        email,
        subject,
        html,
        wedding.client_name,
        true,
      );
      toast({ title: "Link resent", description: `Emailed to ${email}` });
    });
  };

  const isPending = pending?.status === "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Change Payment Plan</DialogTitle>
          <DialogDescription>
            Propose a new remaining schedule and send the couple an approval
            link. Nothing changes until they approve.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isPending ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4">
            <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Payment plan change pending
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              A request was sent on{" "}
              {new Date(pending.created_at).toLocaleDateString("en-US")}. The
              couple hasn't responded yet.
            </p>
            {pending.staff_note && (
              <p className="text-sm mt-2 italic">"{pending.staff_note}"</p>
            )}
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={resendLink}>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Resend link
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={cancelPending}
              >
                Cancel request
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Couple</p>
                <p className="font-medium truncate">{wedding?.client_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Wedding Date</p>
                <p className="font-medium">{formatDisplayDate(weddingDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Package</p>
                <p className="font-medium truncate">
                  {wedding?.package || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Outstanding</p>
                <p className="font-medium text-primary">
                  {fmtMoney(outstanding)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                Seed from a plan type (optional)
              </Label>
              <Select value={planType} onValueChange={regenerateFromType}>
                <SelectTrigger>
                  <SelectValue placeholder="Custom (edit manually)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom (edit manually)</SelectItem>
                  <SelectItem value="deposit">Monthly ($99 deposit)</SelectItem>
                  <SelectItem value="quarterly">
                    Quarterly ($99 deposit)
                  </SelectItem>
                  <SelectItem value="half">50/50 Split</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Proposed Future Installments</Label>
              <InstallmentEditor
                installments={installments}
                onChange={setInstallments}
                minDate={todayStr()}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Proposed total</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{fmtMoney(proposedSum)}</span>
                <Badge variant={sumMatches ? "secondary" : "destructive"}>
                  {sumMatches
                    ? "matches balance"
                    : `needs ${fmtMoney(outstanding)}`}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-note" className="text-xs">
                Note to couple (optional)
              </Label>
              <Textarea
                id="staff-note"
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                placeholder="Add a personal note shown on the approval page..."
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isPending && (
            <Button
              onClick={handleSend}
              disabled={sending || !sumMatches || !allDatesValid || !hasRows}
              className="gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to couple for approval
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
