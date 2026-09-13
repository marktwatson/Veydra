import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PlusSquare,
  ExternalLink,
  Copy,
  CheckCircle2,
  Trash2,
  Pencil,
  CheckCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { OffPlatformBadge } from "@/components/OffPlatformBadge";
import {
  type ProposalTab,
  tabCounts,
  filterByTab,
  methodLabel,
} from "@/lib/proposal-tabs";

const PACKAGES = [
  { id: "pearl", name: "Pearl", isArchived: true },
  { id: "emerald", name: "Emerald", isArchived: true },
  { id: "diamond", name: "Diamond Special", isArchived: true },
  { id: "platinum", name: "Platinum", isArchived: true },
  { id: "all_in_bride", name: "All-In Bride" },
];
const ADDONS = [
  { id: "audio", name: "Audio of Vows & Speeches", isArchived: true },
  { id: "drone", name: "Aerial Drone Footage", isArchived: true },
  { id: "second_shooter", name: "2nd Shooter", isArchived: true },
  { id: "raw", name: "4K RAW Footage Delivery", isArchived: true },
  { id: "highlight_30", name: "30-Min Highlight Video", isArchived: true },
  { id: "highlight_60", name: "60-Min Highlight Video", isArchived: true },
  { id: "extra_session", name: "Extra Session", isArchived: true },
  { id: "drone_new", name: "Aerial Drone Footage" },
  { id: "second_shooter_new", name: "2nd Shooter (up to 10 hours)" },
];
let DB_PACKAGES: any[] = PACKAGES;

export default function ManagerProposals() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProposalTab>("all");
  const [detailProposal, setDetailProposal] = useState<any | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    api
      .getPackages(true)
      .then((pkgs) => {
        if (pkgs.length) DB_PACKAGES = pkgs;
      })
      .catch(() => {});
  }, []);

  const fetchProposals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to load proposals",
        variant: "destructive",
      });
    } else setProposals(data || []);
    setLoading(false);
  };
  useEffect(() => {
    fetchProposals();
  }, []);

  const counts = useMemo(() => tabCounts(proposals), [proposals]);
  const filtered = useMemo(
    () => filterByTab(proposals, activeTab),
    [proposals, activeTab],
  );

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/proposal/${id}`;
    const done = () => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: "Copied!",
        description: "Proposal link copied to clipboard.",
      });
    };
    const fb = () => {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
      done();
    };
    try {
      if (navigator.clipboard && window.isSecureContext)
        navigator.clipboard.writeText(link).then(done).catch(fb);
      else fb();
    } catch {
      fb();
    }
  };

  const deleteProposal = async (id: string) => {
    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (error)
      toast({
        title: "Error",
        description: "Failed to delete proposal",
        variant: "destructive",
      });
    else {
      api.logAdminActivity("Proposal Deleted", `Deleted proposal ${id}`);
      toast({ title: "Success", description: "Proposal deleted" });
      fetchProposals();
    }
  };

  const handleMarkAsBooked = async (proposal: any) => {
    try {
      const { data: settings } = await supabase
        .from("portal_settings")
        .select("*")
        .single();
      let weddingId = proposal.is_upgrade
        ? proposal.original_wedding_id
        : proposal.wedding_id;
      const customPlan =
        typeof proposal.custom_payment_plan === "string"
          ? JSON.parse(proposal.custom_payment_plan)
          : proposal.custom_payment_plan;
      const resolvedPaymentPlan =
        proposal.payment_plan || (customPlan?.enabled ? "custom" : null);
      const packageName = proposal.package_id
        ? proposal.package_id.charAt(0).toUpperCase() +
          proposal.package_id.slice(1)
        : "Custom";
      const coverageLabel =
        proposal.coverage_type === "photo"
          ? "Photo Only"
          : proposal.coverage_type === "video"
            ? "Video Only"
            : "Photo & Video";
      const packageString = `${packageName} (${coverageLabel})`;
      const effectiveTotalAmount =
        resolvedPaymentPlan === "full"
          ? proposal.total_amount * 0.95
          : proposal.total_amount;

      if (weddingId) {
        await supabase
          .from("weddings")
          .update({
            package: packageString,
            addons: proposal.addons,
            second_shooter_hours: proposal.second_shooter_hours,
            second_shooter_type: proposal.second_shooter_type,
            total_amount: effectiveTotalAmount,
            payment_plan: resolvedPaymentPlan,
            custom_payment_plan: customPlan,
            status: proposal.is_upgrade ? undefined : "pending",
            notes: proposal.is_upgrade
              ? `Upgraded Package (Manually Marked).\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`
              : `Manually Marked as Booked.\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`,
          })
          .eq("id", weddingId);
      } else {
        const { data: wedding, error: weddingError } = await supabase
          .from("weddings")
          .insert([
            {
              client_name: proposal.client_name,
              client_email: proposal.client_email,
              partner_name: proposal.partner_name,
              date: proposal.wedding_date,
              location:
                `${proposal.venue || ""} ${proposal.city || ""}, ${proposal.state || ""}`.trim(),
              package: packageString,
              addons: proposal.addons,
              second_shooter_hours: proposal.second_shooter_hours,
              second_shooter_type: proposal.second_shooter_type,
              status: "pending",
              payment_plan: resolvedPaymentPlan,
              custom_payment_plan: customPlan,
              total_amount: effectiveTotalAmount,
              paid_amount: 0,
              contract_date: new Date().toISOString(),
              notes: `Manually Marked as Booked.\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`,
            },
          ])
          .select()
          .single();
        if (weddingError) throw weddingError;
        if (wedding) weddingId = wedding.id;
      }

      if (weddingId) {
        const { error: propError } = await supabase
          .from("proposals")
          .update({ status: "accepted", wedding_id: weddingId })
          .eq("id", proposal.id);
        if (propError) throw propError;

        if (
          !proposal.is_upgrade &&
          settings?.email_bride_welcome_enabled &&
          settings?.email_bride_welcome_template &&
          proposal.client_email &&
          settings?.hl_api_key
        ) {
          const companyName = settings.company_name || "Company";
          let subject = (
            settings.email_bride_welcome_subject || "Welcome to the Family!"
          ).replace(/{{company_name}}/g, companyName);
          let msg = settings.email_bride_welcome_template
            .replace(/{{company_name}}/g, companyName)
            .replace(/{{logo_url}}/g, settings.logo_url || "")
            .replace(/{{bride_name}}/g, proposal.client_name)
            .replace(
              /{{portal_link}}/g,
              `${settings.app_url || window.location.origin}/bride-portal/${weddingId}`,
            );
          await fetch(
            `https://services.leadconnectorhq.com/conversations/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${settings.hl_api_key}`,
                Version: "2021-04-15",
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                email: proposal.client_email,
                type: "Email",
                subject,
                html: msg,
              }),
            },
          ).catch(console.error);
        }

        if (
          settings?.hl_api_key &&
          settings?.hl_location_id &&
          proposal.client_email
        ) {
          const headers = {
            Authorization: `Bearer ${settings.hl_api_key}`,
            Version: "2021-07-28",
            "Content-Type": "application/json",
          };
          try {
            const searchRes = await fetch(
              `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(proposal.client_email)}`,
              { headers },
            );
            const searchData = await searchRes.json();
            let contactId = searchData.contacts?.[0]?.id;
            if (!contactId) {
              const createPayload: any = {
                locationId: settings.hl_location_id,
                email: proposal.client_email,
                name: proposal.client_name || "",
                tags: ["booked", "payment-received"],
              };
              if (proposal.client_name) {
                const parts = proposal.client_name.trim().split(" ");
                createPayload.firstName = parts[0];
                if (parts.length > 1)
                  createPayload.lastName = parts.slice(1).join(" ");
              }
              const createRes = await fetch(
                `https://services.leadconnectorhq.com/contacts/`,
                {
                  method: "POST",
                  headers,
                  body: JSON.stringify(createPayload),
                },
              );
              const createData = await createRes.json();
              contactId = createData.contact?.id;
            }
            if (contactId) {
              const existingTags = searchData.contacts?.[0]?.tags || [];
              const newTags = Array.from(
                new Set([...existingTags, "booked", "payment-received"]),
              );
              const putRes = await fetch(
                `https://services.leadconnectorhq.com/contacts/${contactId}`,
                {
                  method: "PUT",
                  headers,
                  body: JSON.stringify({ tags: newTags }),
                },
              );
              if (!putRes.ok)
                console.error("CRM Sync Error on PUT:", await putRes.text());
            }
          } catch (e) {
            console.error("CRM Sync Error:", e);
          }
        }
      }

      api.logAdminActivity(
        "Proposal Manually Booked",
        `Marked proposal for ${proposal.client_name} as booked`,
      );
      toast({
        title: "Success",
        description: "Proposal marked as booked and wedding created!",
      });
      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposal.id
            ? { ...p, status: "accepted", wedding_id: weddingId }
            : p,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      fetchProposals();
    } catch (error: any) {
      console.error("Error marking as booked:", error);
      api.logAdminActivity(
        "Proposal Booking Error",
        `Failed to manually book proposal for ${proposal.client_name}: ${error.message}`,
      );
      toast({
        title: "Error",
        description: "Failed to mark as booked: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (proposal: any) => {
    const isExpired =
      proposal.expires_at && new Date(proposal.expires_at) < new Date();
    switch (proposal.status) {
      case "paid":
      case "accepted":
        return (
          <Badge className="bg-green-500/10 text-green-700 border-green-500/20">
            Booked
          </Badge>
        );
      case "viewed":
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
            Viewed
          </Badge>
        );
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      default:
        if (isExpired) return <Badge variant="secondary">Expired</Badge>;
        return (
          <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">
            Pending
          </Badge>
        );
    }
  };

  const planLabel = (p: any) =>
    p.payment_plan === "full"
      ? "Paid in Full"
      : p.payment_plan === "half"
        ? "50/50 Split"
        : p.payment_plan === "monthly"
          ? "Monthly"
          : p.payment_plan === "quarterly"
            ? "Quarterly"
            : p.payment_plan === "custom" ||
                (p.custom_payment_plan &&
                  (typeof p.custom_payment_plan === "string"
                    ? JSON.parse(p.custom_payment_plan)
                    : p.custom_payment_plan
                  )?.enabled)
              ? "Custom"
              : "Not Set";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Proposals</h1>
          <p className="text-muted-foreground mt-1">
            Manage open proposals and their statuses
          </p>
        </div>
        <Button onClick={() => navigate("/build-proposal")}>
          <PlusSquare className="w-4 h-4 mr-2" />
          Create Proposal
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ProposalTab)}
      >
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
          <TabsTrigger value="waiting">
            Waiting payment ({counts.waiting})
          </TabsTrigger>
          <TabsTrigger value="booked">Booked ({counts.booked})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === "all"
              ? "All Proposals"
              : activeTab === "draft"
                ? "Draft Proposals"
                : activeTab === "waiting"
                  ? "Waiting Payment"
                  : "Booked"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8 text-muted-foreground">
              Loading proposals...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No proposals in this view.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Wedding Date</TableHead>
                    <TableHead>Package & Addons</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Viewed</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((proposal) => {
                    const ofStatus = proposal.offplatform_status;
                    const ofAmount = Number(proposal.offplatform_amount) || 0;
                    return (
                      <TableRow
                        key={proposal.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setDetailProposal(proposal)}
                      >
                        <TableCell>
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            {proposal.client_name}
                            {proposal.is_upgrade && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                Upgrade
                              </span>
                            )}
                          </div>
                          {ofStatus && (
                            <div className="mt-1.5">
                              <OffPlatformBadge
                                status={ofStatus}
                                method={proposal.offplatform_method}
                                amount={ofAmount}
                                claimedAt={proposal.offplatform_claimed_at}
                              />
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {proposal.client_email}
                          </div>
                          {proposal.client_phone && (
                            <div className="text-xs text-muted-foreground">
                              {proposal.client_phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDisplayDate(proposal.wedding_date)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {proposal.package_id
                              ? `${DB_PACKAGES.find((p) => p.id === proposal.package_id)?.name || proposal.package_id.charAt(0).toUpperCase() + proposal.package_id.slice(1)} (${proposal.coverage_type === "photo" ? "Photo Only" : proposal.coverage_type === "video" ? "Video Only" : "Photo & Video"})`
                              : "Custom"}
                          </div>
                          {proposal.addons && proposal.addons.length > 0 && (
                            <div
                              className="text-xs text-muted-foreground truncate max-w-[200px]"
                              title={
                                Array.isArray(proposal.addons)
                                  ? proposal.addons
                                      .map(
                                        (id: string) =>
                                          ADDONS.find((a) => a.id === id)
                                            ?.name || id,
                                      )
                                      .join(", ")
                                  : proposal.addons
                              }
                            >
                              {Array.isArray(proposal.addons)
                                ? proposal.addons
                                    .map(
                                      (id: string) =>
                                        ADDONS.find((a) => a.id === id)?.name ||
                                        id,
                                    )
                                    .join(", ")
                                : proposal.addons}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          ${proposal.total_amount?.toLocaleString()}
                        </TableCell>
                        <TableCell>{planLabel(proposal)}</TableCell>
                        <TableCell>{getStatusBadge(proposal)}</TableCell>
                        <TableCell>
                          {proposal.viewed_at ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                proposal.viewed_at,
                              ).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Not yet
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(proposal.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyLink(proposal.id)}
                              title="Copy Link"
                            >
                              {copiedId === proposal.id ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                navigate(`/edit-proposal/${proposal.id}`)
                              }
                              title="Edit Proposal"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {proposal.status !== "accepted" &&
                              proposal.status !== "paid" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleMarkAsBooked(proposal)}
                                  title="Mark as Booked"
                                >
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                </Button>
                              )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                window.open(
                                  `/proposal/${proposal.id}`,
                                  "_blank",
                                )
                              }
                              title="Preview"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Are you absolutely sure?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will
                                    permanently delete the proposal and it will
                                    no longer be accessible via the link.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteProposal(proposal.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={!!detailProposal}
        onOpenChange={(o) => !o && setDetailProposal(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          {detailProposal && (
            <>
              <SheetHeader>
                <SheetTitle>{detailProposal.client_name}</SheetTitle>
                <SheetDescription>
                  {formatDisplayDate(detailProposal.wedding_date)} ·{" "}
                  {detailProposal.client_email}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {detailProposal.offplatform_status && (
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          Off-platform payment
                        </span>
                        <OffPlatformBadge
                          status={detailProposal.offplatform_status}
                          method={detailProposal.offplatform_method}
                          amount={
                            Number(detailProposal.offplatform_amount) || 0
                          }
                          claimedAt={detailProposal.offplatform_claimed_at}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Waiting for: $
                        {Number(
                          detailProposal.offplatform_amount || 0,
                        ).toLocaleString()}{" "}
                        via {methodLabel(detailProposal.offplatform_method)}
                      </div>
                      {detailProposal.offplatform_claimed_at && (
                        <div className="text-xs text-muted-foreground">
                          {detailProposal.offplatform_status === "promised"
                            ? "Promised"
                            : "Claimed"}{" "}
                          on{" "}
                          {new Date(
                            detailProposal.offplatform_claimed_at,
                          ).toLocaleString()}
                        </div>
                      )}
                      {(detailProposal.offplatform_status === "claimed" ||
                        detailProposal.offplatform_status === "promised") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => navigate("/manager/payments")}
                        >
                          Review in Payment Audit
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Package</span>
                    <p className="font-medium">
                      {detailProposal.package_id
                        ? DB_PACKAGES.find(
                            (p) => p.id === detailProposal.package_id,
                          )?.name || detailProposal.package_id
                        : "Custom"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total</span>
                    <p className="font-medium">
                      ${detailProposal.total_amount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Plan</span>
                    <p className="font-medium">{planLabel(detailProposal)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <div className="mt-0.5">
                      {getStatusBadge(detailProposal)}
                    </div>
                  </div>
                </div>
                {detailProposal.venue && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Venue: </span>
                    {detailProposal.venue}
                  </div>
                )}
                {detailProposal.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes: </span>
                    {detailProposal.notes}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      navigate(`/edit-proposal/${detailProposal.id}`)
                    }
                  >
                    <Pencil className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      window.open(`/proposal/${detailProposal.id}`, "_blank")
                    }
                  >
                    <ExternalLink className="w-4 h-4 mr-1" /> Preview
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
