import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

/**
 * Shows a "Change pending" badge when this wedding has a pending
 * payment_plan_change_requests row. Used inside ManageWeddingSheet's
 * Financials schedule list and the Payment Audit table.
 */
export function ChangePendingBadge({ weddingId }: { weddingId: string }) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!weddingId) return;
    let active = true;
    supabase
      .from("payment_plan_change_requests")
      .select("id")
      .eq("wedding_id", weddingId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setPending(!!data);
      });
    return () => {
      active = false;
    };
  }, [weddingId]);

  if (!pending) return null;
  return (
    <Badge
      variant="outline"
      className="ml-2 border-amber-400 text-amber-600 dark:text-amber-400 text-[10px] px-1.5 py-0"
    >
      Change pending
    </Badge>
  );
}
