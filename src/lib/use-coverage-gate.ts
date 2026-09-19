import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { coverageRequirements, healCoverageColumns } from "./coverage";

export interface CoverageGateStatus {
  required: boolean;
  confirmed: boolean;
  photoNeeded: boolean;
  videoNeeded: boolean;
  photoAssigned: boolean;
  videoAssigned: boolean;
}

export interface CoverageGate {
  loading: boolean;
  blocked: boolean; // true when coverage is needed but not yet confirmed
  status: CoverageGateStatus | null;
}

/**
 * Determines whether Sign & Pay should be blocked for a proposal.
 * Coverage is OPT-IN: blocked ONLY when staff explicitly requested
 * coverage (coverage_requested_at set) AND it is not confirmed
 * (coverage_confirmed_at null). The wedding date alone never blocks.
 */
export function useCoverageGate(
  proposal: any,
  weddingId: string | null | undefined,
): CoverageGate {
  const [status, setStatus] = useState<CoverageGateStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      setLoading(true);
      try {
        await healCoverageColumns();

        // OPT-IN coverage: only block when staff explicitly requested
        // coverage (coverage_requested_at set) and it is not confirmed.
        // The wedding date alone never blocks Sign & Pay.
        const requested = !!proposal?.coverage_requested_at;
        if (!requested) {
          if (!cancelled)
            setStatus({
              required: false,
              confirmed: true,
              photoNeeded: false,
              videoNeeded: false,
              photoAssigned: true,
              videoAssigned: true,
            });
          setLoading(false);
          return;
        }

        const req = coverageRequirements(proposal);

        // If proposal already has coverage_confirmed_at, treat as confirmed
        if (proposal?.coverage_confirmed_at) {
          if (!cancelled)
            setStatus({
              required: true,
              confirmed: true,
              photoNeeded: req.needsPhoto,
              videoNeeded: req.needsVideo,
              photoAssigned: true,
              videoAssigned: true,
            });
          setLoading(false);
          return;
        }

        let photoAssigned = false;
        let videoAssigned = false;

        if (weddingId) {
          const { data: jobs } = await supabase
            .from("jobs")
            .select("role, contractor_id")
            .eq("wedding_id", weddingId)
            .in("role", [
              "Photographer",
              "Videographer",
              "Lead Photographer",
              "Lead Videographer",
            ]);
          photoAssigned = (jobs || []).some(
            (j) => /photo/i.test(j.role || "") && j.contractor_id,
          );
          videoAssigned = (jobs || []).some(
            (j) => /video/i.test(j.role || "") && j.contractor_id,
          );
        }

        const confirmed =
          (req.needsPhoto ? photoAssigned : true) &&
          (req.needsVideo ? videoAssigned : true);

        if (!cancelled)
          setStatus({
            required: true,
            confirmed,
            photoNeeded: req.needsPhoto,
            videoNeeded: req.needsVideo,
            photoAssigned,
            videoAssigned,
          });
      } catch (e) {
        console.error("coverage gate error:", e);
        if (!cancelled)
          setStatus({
            required: false,
            confirmed: true,
            photoNeeded: false,
            videoNeeded: false,
            photoAssigned: true,
            videoAssigned: true,
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [
    proposal?.coverage_requested_at,
    proposal?.coverage_confirmed_at,
    weddingId,
  ]);

  const blocked = !loading && !!status?.required && !status.confirmed;

  return { loading, blocked, status };
}
