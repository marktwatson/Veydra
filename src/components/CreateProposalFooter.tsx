import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ChevronRight,
  Save,
  Users,
  Camera,
  Video,
  Calendar,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { requestCoverage } from "@/lib/coverage-request";
import { coverageRequirements } from "@/lib/coverage";
import { useNavigate } from "react-router-dom";
import type { CreateProposalArgs } from "@/lib/use-create-proposal";

export interface CreateProposalFooterProps {
  id?: string;
  isSubmitting: boolean;
  formData: any;
  customItems: any[];
  totalPrice: number;
  amountPaidSoFar: number;
  customPlanBlocked: boolean;
  planBalance: any;
  upgradeWeddingId?: string | null;
  /** Generate / Save Changes */
  onGenerate: () => void;
  /** Save the draft and return the saved proposal row (with id). */
  saveDraft: (args: CreateProposalArgs) => Promise<any>;
  /** Called after a successful coverage request so the page can refresh. */
  onCoverageDone?: () => void;
}

interface RoleCfg {
  enabled: boolean;
  payRate: number;
  hours: number;
}

/**
 * Investment Summary footer for CreateProposal.
 *
 * Stack (vertical, full width):
 * 1. Primary: Generate Proposal Link / Save Changes (existing behavior).
 * 2. Outline: "Request coverage first" — opens a modal collecting
 *    pay/hours/region/notes, posts jobs, stamps coverage_requested_at,
 *    does NOT open the share modal or set sent_at/expires_at, then
 *    navigates to the coverage tab.
 *
 * The Request button is disabled under the same conditions as Generate
 * (missing required fields + customPlanBlocked).
 */
export function CreateProposalFooter({
  id,
  isSubmitting,
  formData,
  customItems,
  totalPrice,
  amountPaidSoFar,
  customPlanBlocked,
  planBalance,
  upgradeWeddingId,
  onGenerate,
  saveDraft,
  onCoverageDone,
}: CreateProposalFooterProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [savedRow, setSavedRow] = useState<any>(null);
  const [requesting, setRequesting] = useState(false);

  const req = coverageRequirements({
    coverage_type: formData.coverageType,
    addons: formData.addons,
    second_shooter_type: formData.secondShooterType,
    second_shooter_hours: formData.secondShooterHours,
    package_id: formData.packageId,
  });

  const [photo, setPhoto] = useState<RoleCfg>({
    enabled: req.needsPhoto,
    payRate: 0,
    hours: req.hours || 8,
  });
  const [video, setVideo] = useState<RoleCfg>({
    enabled: req.needsVideo,
    payRate: 0,
    hours: req.hours || 8,
  });
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");

  const missingFields =
    !formData.clientName ||
    !formData.clientEmail ||
    !formData.clientPhone ||
    !formData.weddingDate ||
    !formData.city ||
    !formData.state ||
    (!formData.packageId && customItems.length === 0);

  const disabled = isSubmitting || missingFields || customPlanBlocked;

  const openModal = async () => {
    if (disabled) {
      toast({
        title: "Missing Fields",
        description:
          "Please fill out all required fields before requesting coverage.",
        variant: "destructive",
      });
      return;
    }
    // Reset role defaults for this proposal.
    setPhoto({ enabled: req.needsPhoto, payRate: 0, hours: req.hours || 8 });
    setVideo({ enabled: req.needsVideo, payRate: 0, hours: req.hours || 8 });
    setRegion("");
    setNotes("");
    if (!regions.length) {
      try {
        const { data } = await supabase
          .from("portal_settings")
          .select("regions")
          .maybeSingle();
        if (Array.isArray((data as any)?.regions))
          setRegions((data as any).regions);
      } catch {
        /* ignore */
      }
    }
    setOpen(true);
  };

  const canSubmit =
    (photo.enabled && photo.payRate > 0) ||
    (video.enabled && video.payRate > 0);

  const handleSubmit = async () => {
    if (!canSubmit || !region) {
      toast({
        title: "Pay + region required",
        description:
          "Enter a pay rate > $0 for at least one role and select a region.",
        variant: "destructive",
      });
      return;
    }
    setRequesting(true);
    try {
      // Ensure the proposal is saved so jobs get a real proposal id.
      let row = savedRow;
      if (!row?.id) {
        const args: CreateProposalArgs = {
          id,
          upgradeWeddingId,
          formData,
          customItems,
          totalPrice,
          amountPaidSoFar,
          customPlanBlocked,
          planBalance,
        };
        row = await saveDraft(args);
        setSavedRow(row);
      }
      if (!row?.id) {
        throw new Error("Save the proposal first");
      }
      const payload = {
        roles: {} as any,
        region,
        notes,
      };
      if (photo.enabled) payload.roles.photo = photo;
      if (video.enabled) payload.roles.video = video;
      await requestCoverage(row, payload);
      toast({
        title: "Coverage requested",
        description: "Assign positions before sending.",
      });
      setOpen(false);
      onCoverageDone?.();
      navigate("/manager/proposals?tab=coverage");
    } catch (e: any) {
      toast({
        title: "Failed to request coverage",
        description: e?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  const dateStr = formData.weddingDate
    ? new Date(formData.weddingDate + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  return (
    <>
      <CardFooter className="bg-muted/30 border-t flex flex-col gap-2 items-stretch p-6">
        <Button
          onClick={onGenerate}
          className="w-full"
          size="lg"
          disabled={disabled}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : id ? (
            <Save className="w-4 h-4 mr-2" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-2" />
          )}
          {isSubmitting
            ? id
              ? "Saving..."
              : "Generating..."
            : id
              ? "Save Changes"
              : "Generate Proposal Link"}
        </Button>
        <Button
          onClick={openModal}
          variant="outline"
          className="w-full"
          size="lg"
          disabled={disabled}
        >
          <Users className="w-4 h-4 mr-2" />
          Request coverage first
        </Button>
      </CardFooter>

      <Dialog open={open} onOpenChange={(o) => !requesting && setOpen(o)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Coverage</DialogTitle>
            <DialogDescription>
              Post open jobs for this wedding so contractors can apply from Open
              Positions. The bride's Sign &amp; Pay stays locked until a
              contractor is assigned.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{dateStr}</span>
            </div>
            {formData.city && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  {formData.city}
                  {formData.state ? `, ${formData.state}` : ""}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Roles to Cover
            </Label>

            <RoleRow
              checked={photo.enabled}
              onChecked={(c) => setPhoto((p) => ({ ...p, enabled: !!c }))}
              icon={<Camera className="h-4 w-4 text-primary" />}
              label="Lead Photographer"
              cfg={photo}
              setCfg={setPhoto}
            />
            <RoleRow
              checked={video.enabled}
              onChecked={(c) => setVideo((v) => ({ ...v, enabled: !!c }))}
              icon={<Video className="h-4 w-4 text-primary" />}
              label="Lead Videographer"
              cfg={video}
              setCfg={setVideo}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Region *</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger>
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes / Requirements</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requirements for this coverage…"
              className="min-h-[70px]"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={requesting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={requesting || !canSubmit || !region}
            >
              {requesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {requesting ? "Posting Jobs…" : "Request Coverage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RoleRow({
  checked,
  onChecked,
  icon,
  label,
  cfg,
  setCfg,
}: {
  checked: boolean;
  onChecked: (c: boolean) => void;
  icon: React.ReactNode;
  label: string;
  cfg: RoleCfg;
  setCfg: React.Dispatch<React.SetStateAction<RoleCfg>>;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Checkbox checked={checked} onCheckedChange={(c) => onChecked(!!c)} />
        {icon}
        <Label className="font-medium cursor-pointer">{label}</Label>
      </div>
      {checked && (
        <div className="grid grid-cols-2 gap-3 pl-7">
          <div className="space-y-1">
            <Label className="text-xs">Pay Rate ($) *</Label>
            <Input
              type="number"
              min={0}
              value={cfg.payRate || ""}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  payRate: parseFloat(e.target.value) || 0,
                }))
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hours</Label>
            <Input
              type="number"
              min={0}
              value={cfg.hours || ""}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  hours: parseFloat(e.target.value) || 0,
                }))
              }
              placeholder="8"
            />
          </div>
        </div>
      )}
    </div>
  );
}
