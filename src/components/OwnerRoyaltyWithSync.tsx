import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import OwnerRoyaltyDashboard from "@/pages/owner/RoyaltyDashboard";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { syncRoyaltyPaymentMethod } from "@/lib/royalty-sync";

/**
 * Wraps the owner Royalty dashboard so that, on load, if the owner's territory
 * has a Stripe customer but no recorded payment method, we ask the
 * royalty-processor edge function to sync any bank/card attached to that
 * customer back into the DB row. This clears the "Connect Bank Account"
 * prompt automatically when a bank was attached directly in Stripe — without
 * needing a sale to trigger the charge path.
 */
export default function OwnerRoyaltyWithSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: territory } = useQuery({
    queryKey: ["owner-territory", user?.id],
    queryFn: () => api.getOwnerTerritory(user!.id),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!territory) return;
    const hasPm =
      territory.primary_payment_method_id || territory.stripe_payment_method_id;
    if (territory.stripe_customer_id && !hasPm && !territory.stripe_connected) {
      syncRoyaltyPaymentMethod()
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: ["owner-territory", user?.id],
          });
          queryClient.invalidateQueries({ queryKey: ["royalty-settings"] });
        })
        .catch(() => {
          /* best-effort; the page still renders normally */
        });
    }
  }, [territory, queryClient, user?.id]);

  return <OwnerRoyaltyDashboard />;
}
