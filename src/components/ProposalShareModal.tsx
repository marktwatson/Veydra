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
import {
  Copy,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Send,
  Loader2,
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import {
  sendProposalToClient,
  describeSendResult,
} from "@/lib/send-proposal-api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  link: string;
  open: boolean;
  onClose: () => void;
  /** The proposal id (for Send to client). */
  proposalId?: string;
  /** Client email + phone shown in the send confirm. */
  clientEmail?: string;
  clientPhone?: string;
  /** When true, show a warning that no contractor is assigned yet. */
  coveragePending?: boolean;
  /** Called after a successful send so the parent can refresh. */
  onSent?: () => void;
}

/** Post-create share modal for a generated proposal link. */
export default function ProposalShareModal({
  link,
  open,
  onClose,
  proposalId,
  clientEmail,
  clientPhone,
  coveragePending,
  onSent,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<any>(null);
  const { toast } = useToast();

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

  const handleSend = async () => {
    if (!proposalId) {
      toast({
        title: "Cannot send",
        description: "Proposal id is missing.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const result = await sendProposalToClient(proposalId);
      setSentResult(result);
      toast({
        title: "Sent to client",
        description: describeSendResult(result),
      });
      onSent?.();
      setConfirmOpen(false);
      // Keep the modal open so the expiry line is visible after send.
    } catch (err: any) {
      toast({
        title: "Send failed",
        description: err?.message || "Failed to send proposal.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Proposal Created</DialogTitle>
            <DialogDescription>
              Send to the client to start the review clock, or copy the link.
              Expiry is set in Settings → Proposal send.
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
            {sentResult?.expires_at && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-300/70 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Review clock started · expires{" "}
                  {new Date(sentResult.expires_at).toLocaleString()}
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
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={openProposal}
              className="sm:flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!proposalId || sending}
              className="sm:flex-1"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send to client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send-to-client confirm — shows email/phone + 48h warning */}
      <AlertDialog
        open={confirmOpen && !coveragePending}
        onOpenChange={(o) => !o && setConfirmOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to client?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <span>
                  This emails + texts the proposal link and starts the review
                  clock.
                </span>
                {(clientEmail || clientPhone) && (
                  <div className="text-xs text-muted-foreground">
                    {clientEmail && <div>Email: {clientEmail}</div>}
                    {clientPhone && <div>Phone: {clientPhone}</div>}
                  </div>
                )}
                <span className="block text-xs">
                  Need more time? Contact your manager.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Start review clock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Coverage-pending confirm (Open path) */}
      <AlertDialog
        open={confirmOpen && coveragePending}
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
