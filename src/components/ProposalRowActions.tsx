import {
  ExternalLink,
  Copy,
  CheckCircle2,
  Archive,
  Pencil,
  CheckCircle,
  Users,
  TimerOff,
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
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onExpire: (proposal: any) => void;
  plain?: boolean;
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
  onArchive,
  onRestore,
  onExpire,
  plain,
}: Props) {
  const Wrap = plain ? "div" : TableCell;
  return (
    <Wrap
      className={plain ? "mt-2" : "text-right"}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={plain ? "flex flex-wrap items-center gap-2" : "flex items-center justify-end gap-2"}>
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
            {proposal.status !== "accepted" &&
              proposal.status !== "paid" &&
              proposal.status !== "archived" &&
              proposal.status !== "superseded" &&
              !(
                proposal.sent_at &&
                proposal.expires_at &&
                new Date(proposal.expires_at) < new Date()
              ) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Expire now">
                      <TimerOff className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Expire this proposal now?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The client will not be able to sign or pay, even if time
                        is still left. You can extend the deadline later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onExpire(proposal)}>
                        Expire now
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
          </>
        )}
        {proposal.status === "archived" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRestore(proposal.id)}
          >
            Restore
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Archive">
                <Archive className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive this proposal?</AlertDialogTitle>
                <AlertDialogDescription>
                  It moves to the Archive tab and the client link closes, even
                  if time is still left. Nothing is deleted. You can restore it
                  from the Archive tab.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onArchive(proposal.id)}>
                  Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </Wrap>
  );
}
