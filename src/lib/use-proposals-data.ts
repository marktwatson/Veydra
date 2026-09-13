import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { proposalsToReconcile, detectSuperseded } from "@/lib/proposal-tabs";

const WEDDING_SELECT =
  "id, status, paid_amount, total_amount, offplatform_status, offplatform_method, offplatform_amount, contract_status, contract_signed_at, ghl_invoice_id, ghl_invoice_url";

/**
 * Fetch proposals with their linked wedding row embedded.
 *
 * Strategy:
 *  1. Try the embed select (`*, wedding:weddings!wedding_id(...)`).
 *  2. If that throws (missing FK / type mismatch / RLS), fall back to a plain
 *     `select *` from proposals, then batch-fetch the linked weddings by
 *     wedding_id / original_wedding_id and attach them in JS as `p.wedding`.
 *
 * ALWAYS setProposals(rows) after a successful proposals select — even if the
 * wedding attach step fails — so the list is never silently empty.
 *
 * Runs a one-time reconcile on load (only when rows.length > 0):
 *  - proposals whose wedding is now booked but status != accepted → set accepted
 *  - duplicate older proposals → set status "superseded" (only when a newer
 *    sibling exists in the same group)
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
      let rows: any[] = [];
      try {
        // 1. Try the embed select.
        const { data, error } = await supabase
          .from("proposals")
          .select(`*, wedding:weddings!wedding_id(${WEDDING_SELECT})`)
          .order("created_at", { ascending: false });

        if (error) throw error;
        rows = (data as any[]) || [];
      } catch (embedErr) {
        // 2. Fallback: plain proposals select, then attach weddings in JS.
        console.warn(
          "useProposalsData: embed select failed, using fallback",
          embedErr,
        );
        try {
          const { data: plain, error: plainErr } = await supabase
            .from("proposals")
            .select("*")
            .order("created_at", { ascending: false });

          if (plainErr) throw plainErr;
          rows = (plain as any[]) || [];

          if (cancelled) return;

          // Batch-fetch weddings for both wedding_id and original_wedding_id.
          const wIds = Array.from(
            new Set(
              rows
                .map((p: any) => p.wedding_id || null)
                .filter(Boolean) as string[],
            ),
          );
          const oIds = Array.from(
            new Set(
              rows
                .filter((p: any) => p.is_upgrade && p.original_wedding_id)
                .map((p: any) => p.original_wedding_id) as string[],
            ),
          );
          const allIds = Array.from(new Set([...wIds, ...oIds]));

          if (allIds.length) {
            const { data: wRows, error: wErr } = await supabase
              .from("weddings")
              .select(WEDDING_SELECT)
              .in("id", allIds);

            if (wErr) {
              console.warn(
                "useProposalsData: wedding fetch failed, attaching null",
                wErr,
              );
            }
            // wedding_id may be text or uuid — match as STRING so a text
            // proposals.wedding_id always joins to a uuid weddings.id.
            const wMap = new Map(
              (wRows || []).map((w: any) => [String(w.id), w]),
            );
            rows = rows.map((p: any) => ({
              ...p,
              wedding:
                (p.wedding_id && wMap.get(String(p.wedding_id))) ||
                (p.is_upgrade &&
                  p.original_wedding_id &&
                  wMap.get(String(p.original_wedding_id))) ||
                null,
            }));
          }
        } catch (fallbackErr) {
          console.error(
            "useProposalsData: fallback select failed",
            fallbackErr,
          );
        }
      }

      if (cancelled) return;

      // 3. ALWAYS set proposals after a successful proposals select.
      if (rows.length) {
        setProposals(rows);
      }

      // 4. Reconcile + dedup only when we actually have rows.
      if (rows.length > 0 && !cancelled) {
        // Reconcile: set proposal.status = accepted for booked weddings.
        try {
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
        } catch (e) {
          console.warn("useProposalsData: reconcile failed", e);
        }

        // Dedup: mark older duplicates superseded (only with a newer sibling).
        try {
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
        } catch (e) {
          console.warn("useProposalsData: dedup failed", e);
        }

        if (!cancelled) setProposals(rows);
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { proposals, loading, refresh };
}

export { resolveWedding } from "@/lib/proposal-tabs";
