import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { PACKAGES, ADDONS } from "@/lib/wedding-constants";
import { DEFAULT_LOGO_URL } from "@/lib/utils";

/**
 * Review & Publish dialog for a pending wedding.
 *
 * Loads EXISTING jobs + assignments so staff sees what's already assigned
 * (instead of a blank "add positions" form). Positions are NOT required to
 * publish — staff can add one if they want, but a wedding that already has
 * assignments just shows them and lets you publish.
 *
 * Only NEW (unsaved) positions are inserted on publish — existing jobs are
 * never recreated, so no duplicate positions.
 */
export function ReviewWeddingDialog({
  wedding,
  onPublish,
}: {
  wedding: any;
  onPublish: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [clientName, setClientName] = useState(wedding.client_name);
  const [date, setDate] = useState(
    wedding.date ? wedding.date.split("T")[0] : "",
  );
  const [location, setLocation] = useState(wedding.location);
  const [region, setRegion] = useState(
    Array.isArray(wedding.region)
      ? wedding.region[0] || ""
      : wedding.region || "",
  );
  const [weddingPackage, setWeddingPackage] = useState("");
  const [weddingAddons, setWeddingAddons] = useState("");

  const notesParts = (wedding.notes || "").split("--- Raw Data Backup ---");
  const initialNotes = notesParts[0].trim();
  const rawData = notesParts.length > 1 ? notesParts[1].trim() : null;

  const [notes, setNotes] = useState(initialNotes);
  const [totalAmount, setTotalAmount] = useState<number>(
    wedding.total_amount || 0,
  );
  const [paidAmount, setPaidAmount] = useState<number>(
    wedding.paid_amount || 0,
  );
  const [stripeCustomerId, setStripeCustomerId] = useState<string>(
    wedding.stripe_customer_id || "",
  );
  const [isSyncingStripe, setIsSyncingStripe] = useState(false);

  const [existingJobs, setExistingJobs] = useState<any[]>([]);
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, any>>({});
  const [contractorNames, setContractorNames] = useState<
    Record<string, string>
  >({});
  const [isJobsLoaded, setIsJobsLoaded] = useState(false);

  const [newJobs, setNewJobs] = useState<
    {
      role: string;
      pay_rate: number;
      pay_type: "flat" | "bidding";
      hours: number | null;
      addons?: string[];
    }[]
  >([]);

  useEffect(() => {
    if (wedding) {
      setWeddingPackage(
        PACKAGES.find((p) => p.id === wedding.package)?.name ||
          wedding.package ||
          "",
      );
      setWeddingAddons(
        Array.isArray(wedding.addons)
          ? wedding.addons
              .map((id: string) => ADDONS.find((a) => a.id === id)?.name || id)
              .join(", ")
          : wedding.addons || "",
      );
    }
  }, [wedding]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSyncStripe = async (showToast = true) => {
    setIsSyncingStripe(true);
    try {
      const { data: freshWedding } = await supabase
        .from("weddings")
        .select("stripe_customer_id, client_email, questionnaire_data")
        .eq("id", wedding.id)
        .single();

      const dbCustomerId = (freshWedding?.stripe_customer_id || "").trim();
      const dbEmail = (
        freshWedding?.client_email ||
        (freshWedding?.questionnaire_data as any)?.contact_info?.email ||
        ""
      ).trim();

      if (dbCustomerId && dbCustomerId !== stripeCustomerId) {
        setStripeCustomerId(dbCustomerId);
      }

      const effectiveCustomerId = (stripeCustomerId || dbCustomerId).trim();
      const effectiveEmail = (wedding.client_email || dbEmail).trim();

      if (!effectiveCustomerId && !effectiveEmail) {
        if (showToast)
          toast({
            variant: "destructive",
            title: "No Customer Info",
            description:
              "No Stripe Customer ID or email on file for this wedding.",
          });
        return;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          customerId: effectiveCustomerId,
          customerEmail: effectiveEmail,
        }),
      });
      if (!res.ok) {
        throw new Error(`Stripe API error: ${res.status}`);
      }
      const data = await res.json();

      if (data) {
        if (data.customerId) setStripeCustomerId(data.customerId);
        if (typeof data.totalPaid === "number" && data.totalPaid > 0) {
          setPaidAmount(data.totalPaid);
          if (showToast)
            toast({
              title: "Stripe Synced!",
              description: `Found $${data.totalPaid.toLocaleString()} paid in Stripe.`,
            });
        } else if (showToast) {
          toast({
            title: "Stripe Checked",
            description: `No paid transactions found${effectiveCustomerId ? ` for ${effectiveCustomerId}` : ""}. Verify the ID matches your live Stripe dashboard.`,
          });
        }
      }
    } catch (err: any) {
      if (showToast)
        toast({
          variant: "destructive",
          title: "Sync Failed",
          description: err.message,
        });
    } finally {
      setIsSyncingStripe(false);
    }
  };

  useEffect(() => {
    if (isOpen) handleSyncStripe(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isJobsLoaded) return;
    (async () => {
      try {
        const weddingJobs = await api.getJobsForWedding(wedding.id);
        setExistingJobs(weddingJobs || []);
        const jobIds = (weddingJobs || []).map((j: any) => j.id);
        const aMap: Record<string, any> = {};
        if (jobIds.length > 0) {
          const allAssignments = await api.getAssignments();
          const contractorIds = new Set<string>();
          for (const a of allAssignments || []) {
            if (jobIds.includes(a.job_id)) {
              const s = String(a.status || "")
                .trim()
                .toLowerCase();
              if (
                !["cancelled", "canceled", "declined", "not_selected"].includes(
                  s,
                )
              ) {
                aMap[a.job_id] = a;
                if (a.contractor_id) contractorIds.add(a.contractor_id);
              }
            }
          }
          setAssignmentsMap(aMap);
          if (contractorIds.size > 0) {
            const { data: contractors } = await supabase
              .from("contractors")
              .select("id, first_name, last_name")
              .in("id", Array.from(contractorIds));
            const names: Record<string, string> = {};
            for (const c of contractors || []) {
              names[c.id] = `${c.first_name || ""} ${c.last_name || ""}`.trim();
            }
            setContractorNames(names);
          }
        }
      } catch {
        setExistingJobs([]);
      }
      setIsJobsLoaded(true);
    })();
  }, [isOpen, isJobsLoaded, wedding.id]);

  useEffect(() => {
    if (!isOpen) {
      setIsJobsLoaded(false);
      setNewJobs([]);
      setExistingJobs([]);
      setAssignmentsMap({});
      setContractorNames({});
    }
  }, [isOpen]);

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
  });
  const regions = Array.isArray(settings?.regions) ? settings.regions : [];

  const updateWeddingMutation = useMutation({
    mutationFn: async () => {
      for (const job of newJobs) {
        if (!job.role) continue;
        await api.createJob({
          wedding_id: wedding.id,
          role: job.role,
          pay_type: job.pay_type,
          pay_rate: job.pay_rate || 0,
          hours: job.hours,
          addons: job.addons || [],
          status: "open",
          requirements: "",
        });
      }

      const fullNotes = rawData
        ? `${notes}\n\n--- Raw Data Backup ---\n${rawData}`
        : notes;

      await api.updateWedding(wedding.id, {
        status: "upcoming",
        region: region ? [region] : null,
        client_name: clientName,
        date: date,
        location: location,
        notes: fullNotes,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        stripe_customer_id: stripeCustomerId || null,
        package: weddingPackage,
        addons: weddingAddons
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      } as any);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setIsOpen(false);
      onPublish();
      toast({
        title: "Wedding Published",
        description: "The wedding is now live.",
      });

      const brideEmail =
        wedding.client_email ||
        (wedding.questionnaire_data as any)?.contact_info?.email;
      const welcomeAlreadySent = (wedding as any).welcome_email_sent === true;
      if (brideEmail && !welcomeAlreadySent) {
        try {
          let sentAny = false;
          if (
            settings?.sms_bride_welcome_enabled &&
            settings?.sms_bride_welcome_template
          ) {
            const smsMsg = settings.sms_bride_welcome_template
              .replace(/{{company_name}}/g, settings.company_name || "us")
              .replace(/{{bride_name}}/g, clientName || "Bride")
              .replace(
                /{{portal_link}}/g,
                `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/bride-portal/${wedding.id}`,
              );
            await api
              .sendOvantaSms(brideEmail, smsMsg, clientName)
              .catch(() => {});
            sentAny = true;
          }
          if (
            settings?.email_bride_welcome_enabled &&
            settings?.email_bride_welcome_template &&
            settings?.email_bride_welcome_subject
          ) {
            const subject = settings.email_bride_welcome_subject
              .replace(/{{company_name}}/g, settings.company_name || "us")
              .replace(/{{bride_name}}/g, clientName || "Bride");
            const msg = settings.email_bride_welcome_template
              .replace(/{{company_name}}/g, settings.company_name || "us")
              .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
              .replace(/{{bride_name}}/g, clientName || "Bride")
              .replace(
                /{{portal_link}}/g,
                `${(settings.app_url || window.location.origin).replace(/\/$/, "")}/bride-portal/${wedding.id}`,
              );
            await api.sendOvantaEmail(
              brideEmail,
              subject,
              msg,
              clientName,
              true,
            );
            sentAny = true;
          }
          await api.updateWedding(wedding.id, {
            welcome_email_sent: true,
          } as any);
          if (sentAny)
            toast({
              title: "Welcome Email Sent",
              description: `Welcome & questionnaire email sent to ${brideEmail}`,
            });
        } catch (err: any) {
          toast({
            variant: "destructive",
            title: "Welcome Email Failed",
            description: err.message,
          });
        }
      }
      api.rescheduleWeddingJobs(wedding.id).catch(() => {});
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to publish wedding",
        description: error.message,
      });
    },
  });

  const handlePublish = () => updateWeddingMutation.mutate();

  const addJob = () => {
    setNewJobs([
      ...newJobs,
      {
        role: "Second Videographer",
        pay_rate: 300,
        pay_type: "flat",
        hours: null,
        addons: [],
      },
    ]);
  };
  const removeNewJob = (index: number) =>
    setNewJobs(newJobs.filter((_, i) => i !== index));

  const updateNewJob = (
    index: number,
    field: "role" | "pay_rate" | "pay_type" | "hours",
    value: any,
  ) => {
    const updated = [...newJobs];
    updated[index] = { ...updated[index], [field]: value };
    if (
      (field === "hours" || field === "role" || field === "pay_type") &&
      updated[index].hours &&
      updated[index].pay_type === "flat"
    ) {
      const role = updated[index].role?.toLowerCase() || "";
      if (role.includes("photo") && settings?.photo_pay_rate != null)
        updated[index].pay_rate =
          updated[index].hours * settings.photo_pay_rate;
      else if (role.includes("video") && settings?.video_pay_rate != null)
        updated[index].pay_rate =
          updated[index].hours * settings.video_pay_rate;
      else if (
        role.includes("bartender") &&
        settings?.bartender_pay_rate != null
      )
        updated[index].pay_rate =
          updated[index].hours * settings.bartender_pay_rate;
    }
    setNewJobs(updated);
  };

  const toggleAddon = (index: number, addon: string) => {
    const updated = [...newJobs];
    const job = updated[index];
    const addons = job.addons || [];
    if (addons.includes(addon)) {
      job.addons = addons.filter((a) => a !== addon);
      if (addon === "Engagements" || addon === "Bridals")
        job.hours = (job.hours || 0) - 1.5;
      if (addon === "Drone Operator") job.pay_rate = (job.pay_rate || 0) - 50;
      if (addon === "Audio & Vows") job.pay_rate = (job.pay_rate || 0) - 25;
    } else {
      job.addons = [...addons, addon];
      if (addon === "Engagements" || addon === "Bridals")
        job.hours = (job.hours || 0) + 1.5;
      if (addon === "Drone Operator") job.pay_rate = (job.pay_rate || 0) + 50;
      if (addon === "Audio & Vows") job.pay_rate = (job.pay_rate || 0) + 25;
    }
    setNewJobs(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          Review & Publish
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Wedding</DialogTitle>
          <DialogDescription>
            Review the details and publish. Positions are optional — add one
            only if you need to.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Client
              </Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Location
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Total Investment ($)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={totalAmount || ""}
                onChange={(e) =>
                  setTotalAmount(parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-muted-foreground font-medium">
                  Paid Amount ($)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleSyncStripe(true)}
                  disabled={isSyncingStripe}
                >
                  {isSyncingStripe ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Syncing
                    </>
                  ) : (
                    "Sync Stripe"
                  )}
                </Button>
              </div>
              <Input
                type="number"
                step="0.01"
                value={paidAmount || ""}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Stripe Customer ID
              </Label>
              <Input
                value={stripeCustomerId}
                onChange={(e) => setStripeCustomerId(e.target.value)}
                placeholder="Auto-filled on sync"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Region
              </Label>
              <Select value={region || undefined} onValueChange={setRegion}>
                <SelectTrigger className="h-9">
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
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Package
              </Label>
              <Input value={weddingPackage} readOnly />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground font-medium">
                Add-ons
              </Label>
              <Input value={weddingAddons} readOnly />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-muted-foreground font-medium">
                Notes & Details
              </Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>

          {existingJobs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">
                Assigned Positions ({existingJobs.length})
              </h4>
              <div className="space-y-2">
                {existingJobs.map((job) => {
                  const assignment = assignmentsMap[job.id];
                  const contractorName = assignment
                    ? contractorNames[assignment.contractor_id] || "Assigned"
                    : null;
                  return (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-sm">
                          {job.role || "Unassigned role"}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          ${job.pay_rate || 0} · {job.pay_type || "flat"}
                          {job.hours ? ` · ${job.hours} hrs` : ""}
                        </div>
                      </div>
                      {contractorName ? (
                        <Badge
                          variant="default"
                          className="gap-1 text-xs shrink-0"
                        >
                          <UserCheck className="h-3 w-3" />
                          {contractorName}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Open
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold">
                Add a Position{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional)
                </span>
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addJob}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Position
              </Button>
            </div>
            {newJobs.map((job, index) => (
              <div
                key={index}
                className="flex flex-col gap-4 bg-muted/20 p-4 rounded-xl border relative shadow-sm"
              >
                <div className="absolute top-3 right-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeNewJob(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2 pr-10">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Role
                    </Label>
                    <Select
                      value={job.role}
                      onValueChange={(val) => updateNewJob(index, "role", val)}
                    >
                      <SelectTrigger className="h-9 w-full font-medium">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lead Photographer">
                          Lead Photographer
                        </SelectItem>
                        <SelectItem value="Second Photographer">
                          Second Photographer
                        </SelectItem>
                        <SelectItem value="Lead Videographer">
                          Lead Videographer
                        </SelectItem>
                        <SelectItem value="Second Videographer">
                          Second Videographer
                        </SelectItem>
                        <SelectItem value="Bartender">Bartender</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Hours
                    </Label>
                    <Input
                      type="number"
                      value={job.hours ?? ""}
                      onChange={(e) =>
                        updateNewJob(
                          index,
                          "hours",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Pay Rate ($)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        type="number"
                        value={job.pay_rate}
                        onChange={(e) =>
                          updateNewJob(
                            index,
                            "pay_rate",
                            Number(e.target.value),
                          )
                        }
                        className="h-9 pl-7"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Pay Type
                    </Label>
                    <Select
                      value={job.pay_type || "flat"}
                      onValueChange={(val) =>
                        updateNewJob(index, "pay_type", val)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Pay Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate</SelectItem>
                        <SelectItem value="bidding">Bidding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.role?.toLowerCase().includes("photo") && (
                    <>
                      <Badge
                        variant={
                          job.addons?.includes("Engagements")
                            ? "default"
                            : "secondary"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleAddon(index, "Engagements")}
                      >
                        + Engagements
                      </Badge>
                      <Badge
                        variant={
                          job.addons?.includes("Bridals")
                            ? "default"
                            : "secondary"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleAddon(index, "Bridals")}
                      >
                        + Bridals
                      </Badge>
                    </>
                  )}
                  {job.role?.toLowerCase().includes("video") && (
                    <>
                      <Badge
                        variant={
                          job.addons?.includes("Drone Operator")
                            ? "default"
                            : "secondary"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleAddon(index, "Drone Operator")}
                      >
                        + Drone Operator
                      </Badge>
                      <Badge
                        variant={
                          job.addons?.includes("Audio & Vows")
                            ? "default"
                            : "secondary"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleAddon(index, "Audio & Vows")}
                      >
                        + Audio & Vows
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={updateWeddingMutation.isPending}
          >
            {updateWeddingMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Publish Wedding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
