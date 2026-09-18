import { useState, useMemo } from "react";
import { ProposalCountdownBadge } from "@/components/ProposalCountdownBadge";
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
  Users,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  resolveWedding,
  isBooked,
  isAwaitingCoverage,
} from "@/lib/proposal-tabs";
import { useProposalsData } from "@/lib/use-proposals-data";
import { markProposalAsBooked } from "@/lib/mark-proposal-booked";
import { ProposalSheetActions } from "@/components/ProposalSheetActions";
import { CoverageApplicants } from "@/components/CoverageApplicants";

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
  const { proposals, loading, refresh } = useProposalsData();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProposalTab>(
    searchParams.get("tab") === "coverage" ? "coverage" : "all",
  );
  const [detailProposal, setDetailProposal] = useState<any | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load DB package names (best-effort).
  useMemo(() => {
    api
      .getPackages(true)
      .then((pkgs) => {
        if (pkgs.length) DB_PACKAGES = pkgs;
      })
      .catch(() => {});
    return null;
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
      refresh();
    }
  };

  const handleMarkAsBooked = (proposal: any) =>
    markProposalAsBooked(proposal, {
      toast,
      refresh,
      invalidateWeddings: () =>
        queryClient.invalidateQueries({ queryKey: ["weddings"] }),
    });

  const getStatusBadge = (proposal: any) => {
    if (isAwaitingCoverage(proposal)) {
      return (
        <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
          <Users className="h-3 w-3 mr-1" />
          Awaiting coverage
        </Badge>
      );
    }
    if (isBooked(proposal)) {
      return (
        <Badge className="bg-green-500/10 text-green-700 border-green-500/20">
          Booked
        </Badge>
      );
    }
    const isExpired =
      proposal.expires_at && new Date(proposal.expires_at) < new Date();
    switch (proposal.status) {
      case "superseded":
        return (
          <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20">
            Superseded
          </Badge>
        );
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
          <TabsTrigger value="coverage">
            Awaiting coverage ({counts.coverage || 0})
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired ({counts.expired || 0})
          </TabsTrigger>
          <TabsTrigger value="superseded">
            Superseded ({counts.superseded})
          </TabsTrigger>
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
                  : activeTab === "booked"
                    ? "Booked"
                    : activeTab === "coverage"
                      ? "Awaiting Coverage"
                      : activeTab === "expired"
                        ? "Expired"
                        : "Superseded"}
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
                    const w = resolveWedding(proposal);
                    const ofStatus =
                      w?.offplatform_status || proposal.offplatform_status;
                    const ofMethod =
                      w?.offplatform_method || proposal.offplatform_method;
                    const ofAmount =
                      Number(
                        w?.offplatform_amount || proposal.offplatform_amount,
                      ) || 0;
                    const awaiting = isAwaitingCoverage(proposal);
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
                                method={ofMethod}
                                amount={ofAmount}
                                claimedAt={proposal.offplatform_claimed_at}
                              />
                            </div>
                          )}
                          {awaiting && (
                            <div className="mt-1.5">
                              <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                                <Users className="h-3 w-3 mr-1" />
                                Awaiting coverage
                              </Badge>
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
                        <TableCell>
                          <div className="flex flex-col items-start gap-0.5">
                            {getStatusBadge(proposal)}
                            <ProposalCountdownBadge proposal={proposal} />
                          </div>
                        </TableCell>
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
                            {awaiting ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => setDetailProposal(proposal)}
                                title="Review coverage / applicants"
                              >
                                <Users className="w-4 h-4 mr-1" />
                                Review
                              </Button>
                            ) : (
                              <>
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
                                  proposal.status !== "paid" &&
                                  proposal.status !== "superseded" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleMarkAsBooked(proposal)
                                      }
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
                              </>
                            )}
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
                {(() => {
                  const awaiting = isAwaitingCoverage(detailProposal);
                  if (!awaiting) return null;
                  const w = resolveWedding(detailProposal);
                  const wid = w?.id || detailProposal.wedding_id;
                  return (
                    <Card className="bg-amber-500/5 border-amber-500/20">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            Coverage
                          </span>
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                            <Users className="h-3 w-3 mr-1" />
                            Awaiting coverage
                          </Badge>
                        </div>
                        {wid ? (
                          <CoverageApplicants
                            proposal={detailProposal}
                            weddingId={wid}
                            onChanged={refresh}
                          />
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            A contractor must be assigned before the bride can
                            sign &amp; pay. Review applicants in Positions.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
                {(() => {
                  const w = resolveWedding(detailProposal);
                  const ofStatus =
                    w?.offplatform_status || detailProposal.offplatform_status;
                  const ofMethod =
                    w?.offplatform_method || detailProposal.offplatform_method;
                  const ofAmount =
                    Number(
                      w?.offplatform_amount ||
                        detailProposal.offplatform_amount,
                    ) || 0;
                  const ofClaimedAt =
                    detailProposal.offplatform_claimed_at ||
                    w?.offplatform_claimed_at;
                  if (!ofStatus) return null;
                  return (
                    <Card className="bg-muted/30">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            Off-platform payment
                          </span>
                          <OffPlatformBadge
                            status={ofStatus}
                            method={ofMethod}
                            amount={ofAmount}
                            claimedAt={ofClaimedAt}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Waiting for: ${ofAmount.toLocaleString()} via{" "}
                          {methodLabel(ofMethod)}
                        </div>
                        {ofClaimedAt && (
                          <div className="text-xs text-muted-foreground">
                            {ofStatus === "promised" ? "Promised" : "Claimed"}{" "}
                            on {new Date(ofClaimedAt).toLocaleString()}
                          </div>
                        )}
                        {(ofStatus === "claimed" ||
                          ofStatus === "promised") && (
                          <OffPlatformBadge.Review
                            wedding={w}
                            proposal={detailProposal}
                          />
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
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
                    <div className="mt-0.5 flex flex-col items-start gap-0.5">
                      {getStatusBadge(detailProposal)}
                      <ProposalCountdownBadge proposal={detailProposal} />
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
                <ProposalSheetActions
                  proposal={detailProposal}
                  onEdit={() => navigate(`/edit-proposal/${detailProposal.id}`)}
                  onPreview={() =>
                    window.open(`/proposal/${detailProposal.id}`, "_blank")
                  }
                  onRefresh={refresh}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
