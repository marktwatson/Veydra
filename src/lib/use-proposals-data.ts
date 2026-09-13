import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { proposalsToReconcile, detectSuperseded } from "@/lib/proposal-tabs";

const WEDDING_SELECT =
  "id, status, paid_amount, total_amount, offplatform_status, offplatform_method, offplatform_amount";

/**
 * Fetch proposals with their linked wedding row embedded. For upgrades whose
 * wedding_id is null, falls back to original_wedding_id and fetches that
 * wedding separately so the tab classifier can follow the real wedding state.
 *
 * Runs a one-time reconcile on load:
 *  - proposals whose wedding is now booked but status != accepted → set accepted
 *  - duplicate older proposals → set status "superseded"
 *
 * Self-heals the proposals.status "superseded" value (it's just text, no
 * enum constraint) — no migration needed.
 */
export function useProposalsData() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("proposals")
          .select(`*, wedding:weddings!wedding_id(${WEDDING_SELECT})`)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        let rows = data || [];

        // Fallback: upgrades with no wedding_id → load original_wedding_id.
        const needOriginal = rows.filter(
          (p: any) =>
            !p.wedding &&
            !p.wedding_id &&
            p.is_upgrade &&
            p.original_wedding_id,
        );
        if (needOriginal.length) {
          const ids = Array.from(
            new Set(needOriginal.map((p: any) => p.original_wedding_id)),
          );
          const { data: wRows } = await supabase
            .from("weddings")
            .select(WEDDING_SELECT)
            .in("id", ids);
          const wMap = new Map((wRows || []).map((w: any) => [w.id, w]));
          rows = rows.map((p: any) =>
            p.original_wedding_id && !p.wedding
              ? { ...p, wedding: wMap.get(p.original_wedding_id) || null }
              : p,
          );
        }

        if (cancelled) return;

        // --- Reconcile: set proposal.status = accepted for booked weddings ---
        const toReconcile = proposalsToReconcile(rows);
        if (toReconcile.length) {
          for (const p of toReconcile) {
            await supabase
              .from("proposals")
              .update({ status: "accepted" })
              .eq("id", p.id);
          }
          rows = rows.map((p: any) =>
            toReconcile.find((r) => r.id === p.id)
              ? { ...p, status: "accepted" }
              : p,
          );
        }

        // --- Dedup: mark older duplicates superseded ---
        const { superseded } = detectSuperseded(rows);
        if (superseded.length) {
          for (const id of superseded) {
            await supabase
              .from("proposals")
              .update({ status: "superseded" })
              .eq("id", id);
          }
          rows = rows.map((p: any) =>
            superseded.includes(p.id) ? { ...p, status: "superseded" } : p,
          );
        }

        if (!cancelled) setProposals(rows);
      } catch (err) {
        console.error("useProposalsData error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { proposals, loading, refresh };
}

export { resolveWedding } from "@/lib/proposal-tabs";
