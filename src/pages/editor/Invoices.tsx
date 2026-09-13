import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  DollarSign,
  Calendar,
  Receipt,
  Clock,
  CheckCircle,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function EditorInvoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [stripeCountry, setStripeCountry] = useState("US");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("stripe") === "success") {
      toast({
        title: "Stripe Connected",
        description: "Your Stripe account has been successfully linked.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get("stripe") === "refresh") {
      toast({
        variant: "destructive",
        title: "Stripe connection incomplete",
        description: "Please try connecting your Stripe account again.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const { data: editorProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["editor-profile", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("editors")
        .select("*")
        .ilike("email", user.email)
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!user?.email,
  });

  const disconnectStripeMutation = useMutation({
    mutationFn: async () => {
      if (!editorProfile?.id) throw new Error("Editor record not found");
      const { error } = await supabase
        .from("editors")
        .update({ stripe_account_id: null })
        .eq("id", editorProfile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["editor-profile", user?.email],
      });
      toast({
        title: "Stripe Disconnected",
        description: "Your Stripe account has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to disconnect Stripe",
        description: error.message,
      });
    },
  });

  const { data: weddings = [], isLoading: isWeddingsLoading } = useQuery({
    queryKey: ["editor-weddings"],
    queryFn: api.getWeddings,
  });

  const myInvoices = weddings.filter(
    (w) => w.editor_id === user?.id && w.editor_invoice_status,
  );

  const pendingInvoices = myInvoices.filter(
    (w) => w.editor_invoice_status === "pending",
  );
  const approvedInvoices = myInvoices.filter(
    (w) => w.editor_invoice_status === "approved",
  );
  const paidInvoices = myInvoices.filter(
    (w) => w.editor_invoice_status === "paid",
  );

  const totalPending = pendingInvoices.reduce(
    (sum, w) => sum + (w.editor_payout_amount || 0),
    0,
  );
  const totalApproved = approvedInvoices.reduce(
    (sum, w) => sum + (w.editor_payout_amount || 0),
    0,
  );
  const totalPaid = paidInvoices.reduce(
    (sum, w) => sum + (w.editor_payout_amount || 0),
    0,
  );

  if (isWeddingsLoading || isProfileLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderInvoiceCard = (wedding: any) => {
    return (
      <Card key={wedding.id} className="overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg flex items-center gap-2 truncate">
                <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{wedding.client_name}</span>
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2">
                <Calendar className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {formatDisplayDate(wedding.date)}
                </span>
              </CardDescription>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-bold text-green-600 dark:text-green-500">
                ${wedding.editor_payout_amount}
              </div>
              <div className="mt-1">
                <Badge
                  variant={
                    wedding.editor_invoice_status === "paid"
                      ? "default"
                      : wedding.editor_invoice_status === "approved"
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
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-4 space-y-2">
          {wedding.editor_invoice_details?.photoCount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Photos Edited:</span>
              <span className="font-medium">
                {wedding.editor_invoice_details.photoCount} ($
                {wedding.editor_invoice_details.photoTotal?.toFixed(2)})
              </span>
            </div>
          )}
          {wedding.editor_invoice_details?.videos?.length > 0 && (
            <div className="space-y-1 mt-2">
              <span className="text-muted-foreground text-sm">
                Videos Edited:
              </span>
              {wedding.editor_invoice_details.videos.map(
                (v: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between text-sm pl-2 border-l-2 border-muted"
                  >
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {v.label}
                    </span>
                    <span className="font-medium">${v.price?.toFixed(2)}</span>
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

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
              Pending Approvals
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              ${totalPending}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingInvoices.length} invoices awaiting manager review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approved / Unpaid
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
              ${totalApproved}
            </div>
            <p className="text-xs text-muted-foreground">
              {approvedInvoices.length} invoices ready for payout
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
              ${totalPaid}
            </div>
            <p className="text-xs text-muted-foreground">
              {paidInvoices.length} completed payouts
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="relative">
            Pending / Approved
            {pendingInvoices.length + approvedInvoices.length > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
                {pendingInvoices.length + approvedInvoices.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Paid History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingInvoices.length === 0 && approvedInvoices.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <CardTitle className="text-xl">No pending invoices</CardTitle>
              <p className="text-muted-foreground mt-2">
                You don't have any invoices awaiting payout.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {[...approvedInvoices, ...pendingInvoices].map(renderInvoiceCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {paidInvoices.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <CardTitle className="text-xl">No payment history</CardTitle>
              <p className="text-muted-foreground mt-2">
                You haven't received any payouts yet.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paidInvoices.map(renderInvoiceCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payout Settings</CardTitle>
              <CardDescription>
                Manage how you receive your payments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-4 gap-4">
                <div className="space-y-0.5">
                  <Label className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Stripe Payouts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account to receive direct payouts.
                  </p>
                </div>
                {editorProfile?.stripe_account_id ? (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-600 border-green-200"
                    >
                      Connected
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => disconnectStripeMutation.mutate()}
                      disabled={disconnectStripeMutation.isPending}
                    >
                      {disconnectStripeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select
                      value={stripeCountry}
                      onValueChange={setStripeCountry}
                      disabled={isConnectingStripe}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="PH">Philippines</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      disabled={isConnectingStripe}
                      onClick={async () => {
                        if (!editorProfile?.id || !user?.email) return;
                        setIsConnectingStripe(true);
                        try {
                          const returnUrl = `${window.location.origin}/editor/invoices?stripe=success`;
                          const refreshUrl = `${window.location.origin}/editor/invoices?stripe=refresh`;

                          let {
                            data: { session },
                          } = await supabase.auth.getSession();
                          if (!session?.access_token) {
                            const { data } =
                              await supabase.auth.refreshSession();
                            session = data.session;
                          }

                          const token = session?.access_token;
                          if (!token || !token.startsWith("eyJ")) {
                            throw new Error(
                              "Your session has expired. Please log out and log back in.",
                            );
                          }

                          const res = await fetch(
                            `${supabaseUrl}/functions/v1/stripe-onboard`,
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                                apikey: supabaseAnonKey,
                              },
                              body: JSON.stringify({
                                user_id: editorProfile.id,
                                user_type: "editor",
                                email: user.email,
                                country: stripeCountry,
                                return_url: returnUrl,
                                refresh_url: refreshUrl,
                              }),
                            },
                          );

                          if (!res.ok) {
                            let errorText = `Server returned ${res.status}`;
                            try {
                              const json = await res.json();
                              if (json.error) errorText = json.error;
                            } catch (e) {
                              try {
                                const text = await res.text();
                                if (text) errorText = text;
                              } catch (e2) {}
                            }
                            throw new Error(
                              errorText ||
                                "Failed to initialize Stripe onboarding",
                            );
                          }

                          const data = await res.json();

                          if (data?.url) {
                            window.open(data.url, "_blank");
                            setIsConnectingStripe(false);
                          } else {
                            throw new Error("No URL returned from Stripe");
                          }
                        } catch (err: any) {
                          console.error("Stripe Onboard Error:", err);
                          toast({
                            variant: "destructive",
                            title: "Failed to connect Stripe",
                            description:
                              err.message ||
                              "An error occurred while connecting to Stripe.",
                          });
                          setIsConnectingStripe(false);
                        }
                      }}
                    >
                      {isConnectingStripe ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Connect Stripe
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
