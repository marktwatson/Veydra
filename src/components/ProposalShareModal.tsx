import { useState } from "react";
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
import { Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface Props {
  link: string;
  open: boolean;
  onClose: () => void;
}

/** Post-create share modal for a generated proposal link. */
export default function ProposalShareModal({ link, open, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Proposal Created</DialogTitle>
          <DialogDescription>
            Share this link with the client to review and book their package.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
          <Button onClick={() => window.open(link, "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
