import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RoyaltyManagement from "@/pages/manager/Royalty";
import { api } from "@/lib/api";
import { syncRoyaltyPaymentMethod } from "@/lib/royalty-sync";

/**
 * Wraps the manager Royalty page so that, on load, if this territory has a
 * Stripe customer but no recorded payment method, we ask the royalty-processor
 * edge function to sync any bank/card attached to that customer back into the
 * DB row. This clears the "Connect Bank Account" prompt automatically when a
 * bank was attached directly in Stripe (or via a prior setup that didn't write
 * the DB columns) — without needing a sale to trigger the charge path.
 */
export default function RoyaltyWithSync() {
  const queryClient = useQueryClient();

  const { data: territory } = useQuery({
    queryKey: ["royalty-territory"],
    queryFn: api.getOwnRoyaltyTerritory,
  });

  useEffect(() => {
    if (!territory) return;
    const hasPm =
      territory.primary_payment_method_id || territory.stripe_payment_method_id;
    if (territory.stripe_customer_id && !hasPm && !territory.stripe_connected) {
      syncRoyaltyPaymentMethod()
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["royalty-territory"] });
          queryClient.invalidateQueries({ queryKey: ["royalty-settings"] });
        })
        .catch(() => {
          /* best-effort; the page still renders normally */
        });
    }
  }, [territory, queryClient]);

  return <RoyaltyManagement />;
}
