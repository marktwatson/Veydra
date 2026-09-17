import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { reviseProposal } from "@/lib/revise-proposal";
import { api } from "@/lib/api";

const COVERAGE_TYPES = [
  { value: "both", label: "Photo & Video" },
  { value: "photo", label: "Photo Only" },
  { value: "video", label: "Video Only" },
];

export function ReviseProposalDialog({
  proposal,
  open,
  onOpenChange,
  onDone,
}: {
  proposal: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: (newLink: string) => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);

  // Local editable copies seeded from the proposal.
  const [packageId, setPackageId] = useState<string>(
    proposal?.package_id || "",
  );
  const [coverageType, setCoverageType] = useState<string>(
    proposal?.coverage_type || "both",
  );
  const [totalAmount, setTotalAmount] = useState<string>(
    proposal?.total_amount != null ? String(proposal.total_amount) : "",
  );
  const [notes, setNotes] = useState<string>(proposal?.notes || "");

  // Re-seed when the proposal changes.
  const [seededId, setSeededId] = useState<string | null>(null);
  if (proposal && proposal.id !== seededId) {
    setSeededId(proposal.id);
    setPackageId(proposal.package_id || "");
    setCoverageType(proposal.coverage_type || "both");
    setTotalAmount(
      proposal.total_amount != null ? String(proposal.total_amount) : "",
    );
    setNotes(proposal.notes || "");
  }

  // Load packages from DB (includeArchived false). If the current package
  // is archived, fetch it separately so the select isn't blank.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const pkgs = await api.getPackages(false);
        if (!active) return;
        let list = pkgs || [];
        // Ensure the current package_id is present even if archived.
        if (
          proposal?.package_id &&
          !list.some((p: any) => p.id === proposal.package_id)
        ) {
          try {
            const archived = await api.getPackages(true);
            const found = (archived || []).find(
              (p: any) => p.id === proposal.package_id,
            );
            if (found) list = [...list, found];
          } catch {
            // ignore — select will just show the raw id
          }
        }
        if (active) setPackages(list);
      } catch {
        if (active) setPackages([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [proposal?.package_id]);

  const handleRevise = async () => {
    if (!proposal) return;
    const total = parseFloat(totalAmount);
    if (isNaN(total) || total <= 0) {
      toast({
        title: "Invalid total",
        description: "Enter a total amount greater than 0.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await reviseProposal(proposal.id, {
        package_id: packageId || null,
        coverage_type: coverageType,
        total_amount: total,
        notes: notes || null,
      });
      toast({
        title: "Revised proposal created",
        description: result.oldInvoiceNumber
          ? `Void invoice ${result.oldInvoiceNumber} in Ovanta. New link ready.`
          : "New proposal link ready to send.",
      });
      onOpenChange(false);
      onDone?.(result.newLink);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Could not revise the proposal.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Revise package
          </DialogTitle>
          <DialogDescription>
            Creates a new proposal link for{" "}
            {proposal?.client_name || "this client"}. The old proposal is marked
            superseded. The GHL invoice is not voided from Veydra — void it in
            Ovanta if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Package</Label>
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a package" />
              </SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Coverage</Label>
            <Select value={coverageType} onValueChange={setCoverageType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COVERAGE_TYPES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revise-total">New total ($)</Label>
            <Input
              id="revise-total"
              type="number"
              min="0"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="revise-notes">Notes</Label>
            <Textarea
              id="revise-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleRevise} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create revised proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
