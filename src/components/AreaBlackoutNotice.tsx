import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/lib/utils";

export function AreaBlackoutNotice({
  open,
  date,
  onCheck,
  onConfirm,
}: {
  open: boolean;
  date: string;
  onCheck: () => void;
  onConfirm: () => void;
}) {
  const label = date ? formatDisplayDate(date) : "This date";
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCheck()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>This date needs a coverage check</DialogTitle>
          <DialogDescription>
            {label} is a blackout date for this area. There are already a lot
            of weddings that day. Please ask the manager if the team can still
            cover it before you send this proposal.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onConfirm}>
            The manager confirmed we can cover it
          </Button>
          <Button variant="outline" onClick={onCheck}>
            I'll check with the manager
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
