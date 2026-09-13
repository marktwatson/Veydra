import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface ApplySuccessDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ApplySuccessDialog({ open, onClose }: ApplySuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-col items-center sm:text-center">
          <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
          </div>
          <DialogTitle className="text-2xl text-center">
            Application Received!
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            We got your application and will be emailing and calling you
            shortly. If you prefer text, you can reply back to us saying that.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center pt-4">
          <Button onClick={onClose} className="w-full">
            Return to Login <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
