import { useMemo, useEffect, useState } from "react";
export { ProposalCoverageBlock } from "@/components/ProposalCoverageBlock";
import { ProposalCoverageBlock } from "@/components/ProposalCoverageBlock";
import { needsCoverage } from "@/lib/coverage";
import { supabase } from "@/lib/supabase";
import type { CreateProposalArgs } from "@/lib/use-create-proposal";

/**
 * Thin wrapper that wires ProposalCoverageBlock into CreateProposal without
 * growing that page. Computes the sticky proposal id (url id || savedProposal.id)
 * and passes an ensureSaved callback (saveDraft) so Request Coverage Now can
 * save a brand-new proposal before posting jobs.
 *
 * Loads coverage_requested_at / coverage_confirmed_at / wedding_id from the DB
 * when savedProposal is missing them, so state 2 (already requested) renders
 * instead of remounting the request form.
 */
export function CreateProposalCoverageBlock({
  id,
  savedProposal,
  formData,
  coverageConfirmed,
  loadCoverageState,
  saveDraft,
  createArgs,
}: {
  id?: string;
  savedProposal: any;
  formData: any;
  coverageConfirmed: boolean;
  loadCoverageState: (proposalId: string) => Promise<void>;
  saveDraft: (args: CreateProposalArgs) => Promise<any>;
  createArgs: CreateProposalArgs;
}) {
  const shortNotice = needsCoverage(formData.weddingDate);

  // Extra columns that may be missing from savedProposal (e.g. right after
  // insert). Load them from the DB so the block shows state 2, not state 1.
  const [extra, setExtra] = useState<{
    coverage_requested_at: string | null;
    coverage_confirmed_at: string | null;
    wedding_id: string | null;
  } | null>(null);

  const pid = id || savedProposal?.id;

  useEffect(() => {
    if (!pid) {
      setExtra(null);
      return;
    }
    // If savedProposal already has the columns, use them — no query needed.
    if (
      savedProposal &&
      "coverage_requested_at" in savedProposal &&
      "coverage_confirmed_at" in savedProposal &&
      "wedding_id" in savedProposal
    ) {
      setExtra(null);
      return;
    }
    let active = true;
    supabase
      .from("proposals")
      .select("coverage_requested_at, coverage_confirmed_at, wedding_id")
      .eq("id", pid)
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (!active || error || !data) return;
        setExtra({
          coverage_requested_at: data.coverage_requested_at || null,
          coverage_confirmed_at: data.coverage_confirmed_at || null,
          wedding_id: data.wedding_id || null,
        });
      });
    return () => {
      active = false;
    };
  }, [pid, savedProposal]);

  const proposal = useMemo(
    () => ({
      id: pid,
      wedding_date: formData.weddingDate,
      coverage_type: formData.coverageType,
      addons: formData.addons,
      second_shooter_type: formData.secondShooterType,
      city: formData.city,
      coverage_requested_at:
        savedProposal?.coverage_requested_at ??
        extra?.coverage_requested_at ??
        null,
      coverage_confirmed_at:
        savedProposal?.coverage_confirmed_at ??
        extra?.coverage_confirmed_at ??
        (coverageConfirmed ? new Date().toISOString() : null),
      wedding_id: savedProposal?.wedding_id ?? extra?.wedding_id ?? null,
    }),
    [
      pid,
      formData.weddingDate,
      formData.coverageType,
      formData.addons,
      formData.secondShooterType,
      formData.city,
      coverageConfirmed,
      savedProposal?.coverage_requested_at,
      savedProposal?.coverage_confirmed_at,
      savedProposal?.wedding_id,
      extra?.coverage_requested_at,
      extra?.coverage_confirmed_at,
      extra?.wedding_id,
    ],
  );

  const weddingId = savedProposal?.wedding_id ?? extra?.wedding_id ?? null;

  if (!shortNotice) return null;

  return (
    <ProposalCoverageBlock
      proposal={proposal}
      weddingId={weddingId}
      ensureSaved={async () => saveDraft(createArgs)}
      onChanged={() => {
        const p = id || savedProposal?.id;
        if (p) loadCoverageState(p);
      }}
    />
  );
}
