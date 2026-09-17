import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { maybeConfirmCoverage } from "./coverage";

/**
 * Watches for job contractor_id changes on coverage-request jobs and
 * re-stamps proposal.coverage_confirmed_at when all required roles are assigned.
 * Refreshes the ["jobs"] / ["weddings"] / ["proposals"] caches on change.
 */
export function useCoverageConfirmWatcher() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("coverage-confirm")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs" },
        async (payload: any) => {
          const newJob = payload.new;
          const oldJob = payload.old;
          // Only when contractor_id goes from null → set
          if (
            !oldJob?.contractor_id &&
            newJob?.contractor_id &&
            newJob?.proposal_id
          ) {
            await maybeConfirmCoverage(newJob.proposal_id, newJob.wedding_id);
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            queryClient.invalidateQueries({ queryKey: ["weddings"] });
            queryClient.invalidateQueries({ queryKey: ["proposals"] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
