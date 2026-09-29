import {
  ExternalLink,
  Copy,
  CheckCircle2,
  Trash2,
  Pencil,
  CheckCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
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

interface Props {
  proposal: any;
  awaiting: boolean;
  copied: boolean;
  onCopy: (id: string) => void;
  onEdit: (id: string) => void;
  onMarkBooked: (proposal: any) => void;
  onPreview: (id: string) => void;
  onReview: (proposal: any) => void;
  onDelete: (id: string) => void;
}

/**
 * The per-row action buttons in the manager Proposals table: copy link, edit,
 * mark as booked, preview, and delete. Extracted from Proposals.tsx to keep
 * the page under the edit cap.
 */
export function ProposalRowActions({
  proposal,
  awaiting,
  copied,
  onCopy,
  onEdit,
  onMarkBooked,
  onPreview,
  onReview,
  onDelete,
}: Props) {
  return (
    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-end gap-2">
        {awaiting ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onReview(proposal)}
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
              onClick={() => onCopy(proposal.id)}
              title="Copy Link"
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(proposal.id)}
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
                  onClick={() => onMarkBooked(proposal)}
                  title="Mark as Booked"
                >
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </Button>
              )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPreview(proposal.id)}
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
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                proposal and it will no longer be accessible via the link.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(proposal.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TableCell>
  );
}
