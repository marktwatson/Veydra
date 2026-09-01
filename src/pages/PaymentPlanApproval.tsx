import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, CalendarClock, DollarSign } from "lucide-react";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { DEFAULT_LOGO_URL, formatDisplayDate } from "@/lib/utils";

interface PlanRow {
  label: string;
  date: string;
  amount: number;
  status?: string;
}

interface RequestData {
  id: string;
  status: string;
  current_plan: any;
  proposed_plan: any;
  staff_note?: string | null;
  created_at: string;
  wedding_id: string;
}

interface WeddingData {
  id: string;
  client_name: string;
  partner_name?: string;
  date?: string;
  package?: string;
  total_amount?: number;
  paid_amount?: number;
}

function fmtMoney(n: number) {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function rowsFromPlan(plan: any): PlanRow[] {
  if (!plan) return [];
  if (Array.isArray(plan.schedule)) return plan.schedule;
  if (Array.isArray(plan)) return plan;
  return [];
}

export default function PaymentPlanApproval() {
  const { token } = useParams<{ token: string }>();
  const [settings, setSettings] = useState<any>(null);
  const [request, setRequest] = useState<RequestData | null>(null);
  const [wedding, setWedding] = useState<WeddingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"approve" | "decline" | null>(
    null,
  );
  const [result, setResult] = useState<{
    type: "approved" | "declined" | "expired" | "error";
    message?: string;
  } | null>(null);

  useEffect(() => {
    supabase
      .from("portal_settings")
      .select("*")
      .single()
      .then(({ data }) => {
        if (data) setSettings(data);
      });
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${supabaseUrl}/functions/v1/payment-plan-approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ action: "fetch", token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setResult({ type: "error", message: data.error });
        } else {
          setRequest(data.request);
          setWedding(data.wedding);
          if (data.request?.status === "expired") {
            setResult({ type: "expired" });
          }
        }
      })
      .catch(() =>
        setResult({ type: "error", message: "Could not load this page." }),
      )
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (action: "apply" | "decline") => {
    if (!token) return;
    setSubmitting(action === "apply" ? "approve" : "decline");
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/payment-plan-approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ action, token }),
        },
      );
      const data = await res.json();
      if (action === "apply") {
        if (data.success) {
          setResult({ type: "approved" });
        } else if (data.expired) {
          setResult({ type: "expired", message: data.message });
        } else {
          setResult({ type: "error", message: data.error || data.message });
        }
      } else {
        if (data.success) setResult({ type: "declined" });
        else setResult({ type: "error", message: data.error });
      }
    } catch (e: any) {
      setResult({ type: "error", message: e.message });
    } finally {
      setSubmitting(null);
    }
  };

  const companyName = settings?.company_name || "us";
  const logoUrl = settings?.logo_url || DEFAULT_LOGO_URL;

  const outstanding =
    (Number(wedding?.total_amount) || 0) - (Number(wedding?.paid_amount) || 0);

  const currentRows = rowsFromPlan(request?.current_plan);
  const proposedRows: PlanRow[] =
    request?.proposed_plan?.custom_payment_plan?.installments?.map(
      (i: any, idx: number) => ({
        label: i.label || `Installment #${idx + 1}`,
        date: i.date,
        amount: Number(i.amount) || 0,
      }),
    ) || [];

  const proposedSum = proposedRows.reduce((s, r) => s + r.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt={companyName}
            className="h-16 w-auto object-contain mb-4"
          />
          <h1 className="text-2xl font-bold tracking-tight">
            Payment Plan Review
          </h1>
          {wedding && (
            <p className="text-muted-foreground mt-1">
              For {wedding.client_name}
              {wedding.partner_name ? ` & ${wedding.partner_name}` : ""}
              {wedding.date ? ` · ${formatDisplayDate(wedding.date)}` : ""}
            </p>
          )}
        </div>

        {result ? (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-3">
              {result.type === "approved" && (
                <>
                  <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
                  <h2 className="text-xl font-semibold">Plan Approved!</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Your new payment schedule is now active. Future charges will
                    follow the dates you just approved. Thank you!
                  </p>
                </>
              )}
              {result.type === "declined" && (
                <>
                  <CheckCircle2 className="h-14 w-14 text-muted-foreground mx-auto" />
                  <h2 className="text-xl font-semibold">Current Plan Kept</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    No changes were made — your existing payment schedule stays
                    as is. {companyName} has been notified.
                  </p>
                </>
              )}
              {result.type === "expired" && (
                <>
                  <CalendarClock className="h-14 w-14 text-amber-500 mx-auto" />
                  <h2 className="text-xl font-semibold">Link Expired</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {result.message ||
                      "This approval link is no longer valid. Please contact us if you'd like to update your payment plan."}
                  </p>
                </>
              )}
              {result.type === "error" && (
                <>
                  <h2 className="text-xl font-semibold text-destructive">
                    Something went wrong
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {result.message || "Please try again or contact us."}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {request?.status !== "pending" && (
              <Card className="border-amber-300">
                <CardContent className="pt-6 text-center text-amber-700">
                  This request has already been {request?.status}. No further
                  action is needed.
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Outstanding Balance</span>
                  <Badge variant="secondary" className="text-base">
                    {fmtMoney(outstanding)}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>

            {request?.staff_note && (
              <Card className="bg-muted/40">
                <CardContent className="pt-5">
                  <p className="text-sm text-muted-foreground mb-1 font-medium">
                    Note from {companyName}:
                  </p>
                  <p className="text-sm">{request.staff_note}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {currentRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No schedule on file.
                    </p>
                  )}
                  {currentRows.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5"
                    >
                      <span>{r.label}</span>
                      <span className="text-muted-foreground">{r.date}</span>
                      <span className="font-medium w-20 text-right">
                        {fmtMoney(r.amount)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-primary/40">
                <CardHeader>
                  <CardTitle className="text-base">Proposed Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {proposedRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No installments proposed.
                    </p>
                  )}
                  {proposedRows.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5"
                    >
                      <span>{r.label}</span>
                      <span className="text-muted-foreground">
                        {formatDisplayDate(r.date)}
                      </span>
                      <span className="font-medium w-20 text-right">
                        {fmtMoney(r.amount)}
                      </span>
                    </div>
                  ))}
                  {proposedRows.length > 0 && (
                    <div className="flex items-center justify-between text-sm font-semibold pt-2">
                      <span>Total</span>
                      <span className="text-primary">
                        {fmtMoney(proposedSum)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {request?.status === "pending" && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button
                  size="lg"
                  onClick={() => submit("apply")}
                  disabled={!!submitting}
                  className="gap-2"
                >
                  {submitting === "approve" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve New Schedule
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => submit("decline")}
                  disabled={!!submitting}
                  className="gap-2"
                >
                  {submitting === "decline" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <DollarSign className="h-4 w-4" />
                  )}
                  Keep Current Schedule
                </Button>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              This link is single-use and expires 7 days after it was sent.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
