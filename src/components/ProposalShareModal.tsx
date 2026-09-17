import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, CheckCircle2, ExternalLink, AlertTriangle } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface Props {
  link: string;
  open: boolean;
  onClose: () => void;
  /** When true, show a warning that no contractor is assigned yet. */
  coveragePending?: boolean;
}

/** Post-create share modal for a generated proposal link. */
export default function ProposalShareModal({
  link,
  open,
  onClose,
  coveragePending,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openProposal = () => {
    if (coveragePending) {
      setConfirmOpen(true);
    } else {
      window.open(link, "_blank");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Proposal Created</DialogTitle>
            <DialogDescription>
              Share this link with the client to review and book their package.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {coveragePending && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  No contractor assigned yet. They won't be able to pay until
                  coverage is confirmed.
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input readOnly value={link} className="flex-1" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Copy link"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={openProposal}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => !o && setConfirmOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No contractor assigned yet</AlertDialogTitle>
            <AlertDialogDescription>
              Send anyway? They won't be able to pay until coverage is
              confirmed. You can request coverage from the proposal detail or
              the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                window.open(link, "_blank");
              }}
            >
              Send anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
