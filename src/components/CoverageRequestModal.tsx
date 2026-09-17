import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Loader2, Camera, Video, MapPin, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { requestCoverage } from "@/lib/coverage-request";
import { coverageRequirements, type CoverageRequirement } from "@/lib/coverage";

export interface CoverageRoleConfig {
  enabled: boolean;
  payRate: number;
  hours: number;
}

export interface CoverageRequestPayload {
  roles: {
    photo?: CoverageRoleConfig;
    video?: CoverageRoleConfig;
  };
  region: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: any;
  regions: string[];
  onDone?: () => void;
}

export function CoverageRequestModal({
  open,
  onOpenChange,
  proposal,
  regions,
  onDone,
}: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const req: CoverageRequirement = coverageRequirements(proposal);

  const [photo, setPhoto] = useState<CoverageRoleConfig>({
    enabled: req.needsPhoto,
    payRate: 0,
    hours: req.hours || 8,
  });
  const [video, setVideo] = useState<CoverageRoleConfig>({
    enabled: req.needsVideo,
    payRate: 0,
    hours: req.hours || 8,
  });
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");

  // Reset when reopened with a new proposal
  useEffect(() => {
    if (!open) return;
    setPhoto({ enabled: req.needsPhoto, payRate: 0, hours: req.hours || 8 });
    setVideo({ enabled: req.needsVideo, payRate: 0, hours: req.hours || 8 });
    setRegion("");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposal?.id]);

  const dateStr = proposal?.wedding_date
    ? new Date(proposal.wedding_date + "T12:00:00").toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        },
      )
    : "TBD";

  const city = proposal?.city || "";
  const venue = proposal?.venue || "";

  const canSubmit =
    (photo.enabled && photo.payRate > 0) ||
    (video.enabled && video.payRate > 0);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({
        title: "Pay rate required",
        description: "Enter a pay rate greater than $0 for at least one role.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const payload: CoverageRequestPayload = {
        roles: {},
        region,
        notes,
      };
      if (photo.enabled) payload.roles.photo = photo;
      if (video.enabled) payload.roles.video = video;

      const res = await requestCoverage(proposal, payload);
      toast({
        title: "Coverage requested",
        description: `${res.notified} contractor(s) notified. Team can accept from Open Jobs.`,
      });
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast({
        title: "Failed to request coverage",
        description: e?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Coverage</DialogTitle>
          <DialogDescription>
            Post open jobs for this short-notice wedding so contractors can
            accept from Open Jobs.
          </DialogDescription>
        </DialogHeader>

        {/* Read-only event summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{dateStr}</span>
          </div>
          {city && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {city}
                {proposal?.state ? `, ${proposal.state}` : ""}
              </span>
            </div>
          )}
          {venue && (
            <div className="text-muted-foreground pl-6 text-xs">{venue}</div>
          )}
        </div>

        {/* Role rows */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Roles to Cover
          </Label>

          {/* Photographer */}
          <div className="rounded-lg border p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="cov-photo"
                checked={photo.enabled}
                onCheckedChange={(c) =>
                  setPhoto((p) => ({ ...p, enabled: !!c }))
                }
              />
              <Camera className="h-4 w-4 text-primary" />
              <Label htmlFor="cov-photo" className="font-medium cursor-pointer">
                Lead Photographer
              </Label>
            </div>
            {photo.enabled && (
              <div className="grid grid-cols-2 gap-3 pl-7">
                <div className="space-y-1">
                  <Label className="text-xs">Pay Rate ($) *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={photo.payRate || ""}
                    onChange={(e) =>
                      setPhoto((p) => ({
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
                    value={photo.hours || ""}
                    onChange={(e) =>
                      setPhoto((p) => ({
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

          {/* Videographer */}
          <div className="rounded-lg border p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="cov-video"
                checked={video.enabled}
                onCheckedChange={(c) =>
                  setVideo((v) => ({ ...v, enabled: !!c }))
                }
              />
              <Video className="h-4 w-4 text-primary" />
              <Label htmlFor="cov-video" className="font-medium cursor-pointer">
                Lead Videographer
              </Label>
            </div>
            {video.enabled && (
              <div className="grid grid-cols-2 gap-3 pl-7">
                <div className="space-y-1">
                  <Label className="text-xs">Pay Rate ($) *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={video.payRate || ""}
                    onChange={(e) =>
                      setVideo((v) => ({
                        ...v,
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
                    value={video.hours || ""}
                    onChange={(e) =>
                      setVideo((v) => ({
                        ...v,
                        hours: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder="8"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Region */}
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

        {/* Notes */}
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
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {submitting ? "Posting Jobs…" : "Request Coverage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
