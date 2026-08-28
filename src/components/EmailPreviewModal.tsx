import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Send, Eye } from "lucide-react";

export interface EmailPreviewData {
  to: string;
  subject: string;
  html: string;
  recipientName?: string;
}

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailData: EmailPreviewData | null;
  onConfirm: () => Promise<void>;
  sendLabel?: string;
}

export default function EmailPreviewModal({
  open,
  onOpenChange,
  emailData,
  onConfirm,
  sendLabel = "Approve & Send",
}: EmailPreviewModalProps) {
  const [isSending, setIsSending] = useState(false);

  const handleConfirm = async () => {
    setIsSending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      // parent handles error toast
    } finally {
      setIsSending(false);
    }
  };

  if (!emailData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Email Preview — Review Before Sending
          </DialogTitle>
        </DialogHeader>

        {/* Email metadata */}
        <div className="space-y-2 border-b pb-4">
          <div className="flex items-start gap-2 text-sm">
            <span className="font-semibold text-muted-foreground min-w-[60px]">
              To:
            </span>
            <span className="text-foreground">{emailData.to}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className="font-semibold text-muted-foreground min-w-[60px]">
              Subject:
            </span>
            <span className="text-foreground font-medium">
              {emailData.subject}
            </span>
          </div>
        </div>

        {/* Email preview iframe */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-md border bg-white">
          <iframe
            title="Email Preview"
            srcDoc={emailData.html}
            className="w-full h-full min-h-[300px] border-0"
            sandbox="allow-same-origin"
          />
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSending}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {sendLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper to prepare email preview data with variable substitution.
 * Returns the final HTML/subject that should be shown in the preview modal.
 */
export function prepareEmailPreview(
  template: string,
  subjectTemplate: string,
  recipientEmail: string,
  recipientName: string,
  variables: Record<string, string>,
): EmailPreviewData {
  const replaceVars = (text: string) => {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(
        new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        value,
      );
    }
    return result;
  };

  return {
    to: recipientEmail,
    subject: replaceVars(subjectTemplate),
    html: replaceVars(template),
    recipientName,
  };
}
