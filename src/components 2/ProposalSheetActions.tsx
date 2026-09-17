import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, ExternalLink, FileText } from "lucide-react";
import { ReviseProposalDialog } from "@/components/ReviseProposalDialog";

/**
 * Renders the Edit + Preview buttons plus a "Revise package" action
 * for the Proposals detail sheet. The Revise dialog state lives here
 * so the parent (Proposals.tsx) doesn't grow.
 */
export function ProposalSheetActions({
  proposal,
  onEdit,
  onPreview,
  onRefresh,
}: {
  proposal: any;
  onEdit: () => void;
  onPreview: () => void;
  onRefresh: () => void;
}) {
  const [reviseOpen, setReviseOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
          <Pencil className="w-4 h-4 mr-1" /> Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onPreview}
        >
          <ExternalLink className="w-4 h-4 mr-1" /> Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setReviseOpen(true)}
        >
          <FileText className="w-4 h-4 mr-1" /> Revise
        </Button>
      </div>
      <ReviseProposalDialog
        proposal={proposal}
        open={reviseOpen}
        onOpenChange={setReviseOpen}
        onDone={() => onRefresh()}
      />
    </>
  );
}
