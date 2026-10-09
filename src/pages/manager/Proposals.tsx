import { useState, useMemo } from "react";
import { buildProposalLink } from "@/lib/proposal-link";
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
import { PlusSquare, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  ProposalSheetActions,
  ProposalCoverageBlock,
} from "@/components/ProposalSheetActions";
import { CoverageApplicants } from "@/components/CoverageApplicants";
import { ProposalRowActions } from "@/components/ProposalRowActions";

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

  const copyLink = async (id: string) => {
    // Find the proposal's territory_id so the link uses that area's app_url.
    const proposal = proposals.find((p) => p.id === id);
    const link = await buildProposalLink(id, proposal?.territory_id, (t) =>
      toast(t),
    );
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

  // Open the proposal review page using that area's app_url (not the browser
  // origin). Falls back to window.location.origin when app_url is empty.
  const openProposalPreview = async (id: string, list: any[]) => {
    const proposal = list.find((p) => p.id === id);
    const link = await buildProposalLink(id, proposal?.territory_id, (t) =>
      toast(t),
    );
    window.open(link, "_blank");
  };

  const setProposalStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("proposals")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast({
        title: "Error",
        description: "Could not update that proposal",
        variant: "destructive",
      });
      return;
    }
    api.logAdminActivity(
      status === "archived" ? "Proposal Archived" : "Proposal Restored",
      `${status} proposal ${id}`,
    );
    toast({
      title: status === "archived" ? "Archived" : "Restored",
      description:
        status === "archived"
          ? "It is in the Archive tab. Nothing was deleted."
          : "It is back in the proposal list.",
    });
    refresh();
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
    <div className="phone-bleed min-w-0 max-w-7xl mx-auto space-y-4 md:space-y-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Proposals</h1>
          <p className="text-muted-foreground mt-1">
            Manage open proposals and their statuses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/manager/sales-reps")}
          >
            <Users className="w-4 h-4 mr-2" />
            Sales Reps
          </Button>
          <Button onClick={() => navigate("/build-proposal")}>
            <PlusSquare className="w-4 h-4 mr-2" />
            Create Proposal
          </Button>
        </div>
      </div>

      <select
        className="h-11 w-full rounded-full border bg-background px-4 text-sm md:hidden"
        value={activeTab}
        onChange={(e) => setActiveTab(e.target.value as ProposalTab)}
        aria-label="Proposal status"
      >
        <option value="all">All ({counts.all})</option>
        <option value="draft">Draft ({counts.draft})</option>
        <option value="waiting">Waiting payment ({counts.waiting})</option>
        <option value="booked">Booked ({counts.booked})</option>
        <option value="coverage">
          Awaiting coverage ({counts.coverage || 0})
        </option>
        <option value="expired">Expired ({counts.expired || 0})</option>
        <option value="archived">Archive ({counts.archived || 0})</option>
      </select>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ProposalTab)}
        className="hidden md:block"
      >
        <TabsList className="flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto [&>*]:shrink-0">
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
          <TabsTrigger value="archived">
            Archive ({counts.archived || 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-0 bg-transparent shadow-none md:border md:bg-card md:shadow-sm">
        <CardHeader className="hidden md:flex">
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
                        : activeTab === "archived"
                          ? "Archive"
                          : "Superseded"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {loading ? (
            <div className="flex justify-center p-8 text-muted-foreground">
              Loading proposals...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No proposals in this view.
            </div>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
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
                  <div
                    key={proposal.id}
                    className="rounded-xl border p-4"
                    onClick={() => setDetailProposal(proposal)}
                  >
                    <div className="font-medium flex flex-wrap items-center gap-2">
                      {proposal.client_name}
                      {proposal.salesperson_name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[10px] font-semibold border border-violet-500/20">
                          <Users className="h-3 w-3" />
                          {proposal.salesperson_name}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {proposal.client_email}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span>{formatDisplayDate(proposal.wedding_date)}</span>
                      <span className="font-medium">
                        ${proposal.total_amount?.toLocaleString()}
                      </span>
                      {getStatusBadge(proposal)}
                    </div>
                    {ofStatus && (
                      <div className="mt-2">
                        <OffPlatformBadge
                          status={ofStatus}
                          method={ofMethod}
                          amount={ofAmount}
                          claimedAt={proposal.offplatform_claimed_at}
                        />
                      </div>
                    )}
                    <ProposalRowActions
                      plain
                      proposal={proposal}
                      awaiting={awaiting}
                      copied={copiedId === proposal.id}
                      onCopy={copyLink}
                      onEdit={(id) => navigate(`/edit-proposal/${id}`)}
                      onMarkBooked={handleMarkAsBooked}
                      onPreview={(id) => openProposalPreview(id, proposals)}
                      onReview={setDetailProposal}
                      onArchive={(id) => setProposalStatus(id, "archived")}
                      onRestore={(id) => setProposalStatus(id, "viewed")}
                    />
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
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
                            {proposal.salesperson_name && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[10px] font-semibold border border-violet-500/20">
                                <Users className="h-3 w-3" />
                                {proposal.salesperson_name}
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
                        <ProposalRowActions
                          proposal={proposal}
                          awaiting={awaiting}
                          copied={copiedId === proposal.id}
                          onCopy={copyLink}
                          onEdit={(id) => navigate(`/edit-proposal/${id}`)}
                          onMarkBooked={handleMarkAsBooked}
                          onPreview={(id) => openProposalPreview(id, proposals)}
                          onReview={setDetailProposal}
                          onArchive={(id) => setProposalStatus(id, "archived")}
                          onRestore={(id) => setProposalStatus(id, "viewed")}
                        />
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </>
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
                  const w = resolveWedding(detailProposal);
                  const wid = w?.id || detailProposal.wedding_id;
                  if (detailProposal.coverage_confirmed_at) return null;
                  if (!detailProposal.coverage_requested_at)
                    return (
                      <ProposalCoverageBlock
                        proposal={detailProposal}
                        weddingId={wid}
                        onChanged={refresh}
                      />
                    );
                  return (
                    <Card className="bg-amber-500/5 border-amber-500/20">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            Coverage
                          </span>
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                            <Users className="h-3 w-3 mr-1" /> Awaiting coverage
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
                            sign &amp; pay.
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
                    openProposalPreview(detailProposal.id, [detailProposal])
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
