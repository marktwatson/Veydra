import { useState, useEffect } from "react";
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

// Module-level cache updated on DB load
let DB_PACKAGES: any[] = PACKAGES;

export default function ManagerProposals() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
    } else {
      setProposals(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const copyLink = (id: string) => {
    const link = `${window.location.origin}/proposal/${id}`;
    const fallbackCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: "Copied!",
        description: "Proposal link copied to clipboard.",
      });
    };
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(link)
          .then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
            toast({
              title: "Copied!",
              description: "Proposal link copied to clipboard.",
            });
          })
          .catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
  };

  const deleteProposal = async (id: string) => {
    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete proposal",
        variant: "destructive",
      });
    } else {
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
          .update({
            status: "accepted",
            wedding_id: weddingId,
          })
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

        // Sync to CRM
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
                  body: JSON.stringify({
                    tags: newTags,
                  }),
                },
              );
              if (!putRes.ok) {
                console.error("CRM Sync Error on PUT:", await putRes.text());
              }
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

      <Card>
        <CardHeader>
          <CardTitle>All Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8 text-muted-foreground">
              Loading proposals...
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No proposals found. Create one to get started.
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
                  {proposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {proposal.client_name}
                          {proposal.is_upgrade && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                              Upgrade
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
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
                                        ADDONS.find((a) => a.id === id)?.name ||
                                        id,
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
                      <TableCell>
                        {proposal.payment_plan === "full"
                          ? "Paid in Full"
                          : proposal.payment_plan === "half"
                            ? "50/50 Split"
                            : proposal.payment_plan === "monthly"
                              ? "Monthly"
                              : proposal.payment_plan === "quarterly"
                                ? "Quarterly"
                                : proposal.payment_plan === "custom" ||
                                    (proposal.custom_payment_plan &&
                                      (typeof proposal.custom_payment_plan ===
                                      "string"
                                        ? JSON.parse(
                                            proposal.custom_payment_plan,
                                          )
                                        : proposal.custom_payment_plan
                                      )?.enabled)
                                  ? "Custom"
                                  : "Not Set"}
                      </TableCell>
                      <TableCell>{getStatusBadge(proposal)}</TableCell>
                      <TableCell>
                        {proposal.viewed_at ? (
                          <span className="text-xs text-muted-foreground">
                            {new Date(proposal.viewed_at).toLocaleDateString()}
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
                      <TableCell className="text-right">
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
                              window.open(`/proposal/${proposal.id}`, "_blank")
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
                                  permanently delete the proposal and it will no
                                  longer be accessible via the link.
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
