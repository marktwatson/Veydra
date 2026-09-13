import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { ApproveOffPlatformPaymentDialog } from "@/components/ApproveOffPlatformPaymentDialog";

/**
 * Replaces the old "Review in Payment Audit" navigation with an inline
 * Approve Off-Platform Payment modal. Used in the Proposals detail sheet.
 *
 * Props match the fields already resolved in the sheet (wedding or proposal
 * off-platform fields). Falls back to the proposal's own off-platform_*
 * fields when the wedding join is missing.
 */
export function ProposalOffPlatformReview({
  wedding,
  proposal,
}: {
  wedding: any | null;
  proposal: any;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const status = wedding?.offplatform_status || proposal.offplatform_status;
  if (!status || (status !== "claimed" && status !== "promised")) return null;

  // Build the wedding-shaped object the dialog expects.
  const w = {
    id: wedding?.id || proposal.wedding_id || proposal.original_wedding_id,
    client_name: proposal.client_name || wedding?.client_name,
    date: proposal.wedding_date || wedding?.date,
    offplatform_status: status,
    offplatform_method:
      wedding?.offplatform_method || proposal.offplatform_method,
    offplatform_amount:
      wedding?.offplatform_amount || proposal.offplatform_amount,
    offplatform_claimed_at:
      wedding?.offplatform_claimed_at || proposal.offplatform_claimed_at,
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Review off-platform payment
      </Button>
      <ApproveOffPlatformPaymentDialog
        wedding={w}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) queryClient.invalidateQueries({ queryKey: ["proposals"] });
        }}
      />
    </>
  );
}
