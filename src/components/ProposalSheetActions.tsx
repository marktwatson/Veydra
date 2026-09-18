import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  ExternalLink,
  FileText,
  Send,
  Clock,
  Loader2,
} from "lucide-react";
import { ReviseProposalDialog } from "@/components/ReviseProposalDialog";
import { sendProposalToClient } from "@/lib/send-proposal-api";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDate } from "@/lib/utils";

/**
 * Renders the Edit + Preview buttons plus "Revise package", "Send to
 * client", and "Extend 48 hours" actions for the Proposals detail sheet.
 * The Revise + Send state lives here so the parent (Proposals.tsx) doesn't
 * grow.
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
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const sent = !!proposal?.sent_at;
  const expired =
    sent &&
    proposal?.expires_at &&
    new Date(proposal.expires_at) < new Date() &&
    proposal?.status !== "accepted" &&
    proposal?.status !== "paid" &&
    proposal?.status !== "upcoming";

  const handleSend = async (opts: { resend?: boolean; extend?: boolean }) => {
    if (!proposal?.id) return;
    setSending(true);
    try {
      const result = await sendProposalToClient(proposal.id, opts);
      toast({
        title: opts.extend
          ? "Deadline extended"
          : opts.resend
            ? "Re-sent to client"
            : "Sent to client",
        description: result.expires_at
          ? `Expires ${new Date(result.expires_at).toLocaleString()}`
          : undefined,
      });
      onRefresh();
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
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onEdit}
          >
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

        {sent && !expired && (
          <div className="flex items-center justify-between rounded-md border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
            <span>
              Sent · expires{" "}
              {proposal.expires_at
                ? formatDisplayDate(proposal.expires_at)
                : "—"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={sending}
              onClick={() => handleSend({ resend: true })}
            >
              {sending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Send className="w-3 h-3 mr-1" />
              )}
              Resend
            </Button>
          </div>
        )}

        {expired && (
          <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
            <span>Expired — extend or revise</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={sending}
              onClick={() => handleSend({ extend: true })}
            >
              <Clock className="w-3 h-3 mr-1" /> Extend
            </Button>
          </div>
        )}

        {!sent && (
          <Button size="sm" disabled={sending} onClick={() => handleSend({})}>
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send to client
          </Button>
        )}

        {sent && !expired && (
          <Button
            variant="ghost"
            size="sm"
            disabled={sending}
            onClick={() => handleSend({ extend: true })}
          >
            <Clock className="w-4 h-4 mr-2" /> Extend deadline
          </Button>
        )}
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
