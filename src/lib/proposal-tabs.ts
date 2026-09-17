/**
 * Proposal tab classification + off-platform helpers.
 *
 * Tabs follow the WEDDING (not leftover proposal.status === "viewed").
 *
 * Tabs: all | draft | waiting | booked | superseded
 * - booked: any of the booked if-list below
 * - waiting: NOT booked AND (off-platform promised/claimed OR signed & unpaid & no invoice & no off-platform choice)
 * - draft: everything else (includes viewed-only — a bride who only opened the link but hasn't signed or picked a pay method)
 * - superseded: an older proposal for the same wedding that a newer one replaced
 */

export type ProposalTab =
  "all" | "draft" | "waiting" | "booked" | "superseded" | "coverage";

/** Resolve the wedding row attached to a proposal (handles upgrade fallback). */
export function resolveWedding(p: any): any | null {
  const w = p.wedding;
  if (w) return w;
  // When the join produced nothing (wedding_id null), upgrades fall back to
  // original_wedding_id. The caller passes that under `original_wedding` if
  // present; otherwise there is no linked wedding.
  return p.original_wedding || null;
}

/**
 * Booked if ANY of (in order):
 *  1. wedding.status in (upcoming, completed)
 *  2. wedding.paid_amount > 0
 *  3. wedding.offplatform_status === "confirmed"
 *  4. proposal.offplatform_status === "confirmed"
 *  5. proposal.status in (accepted, paid)
 */
export function isBooked(p: any): boolean {
  const w = resolveWedding(p);
  if (w) {
    if (w.status === "upcoming" || w.status === "completed") return true;
    if (Number(w.paid_amount || 0) > 0) return true;
    if (w.offplatform_status === "confirmed") return true;
  }
  if (p.offplatform_status === "confirmed") return true;
  if (p.status === "accepted" || p.status === "paid") return true;
  return false;
}

/** Contract signed (proposal or wedding level). */
export function isSigned(p: any): boolean {
  const w = resolveWedding(p);
  if (w?.contract_status === "signed" || w?.contract_signed_at) return true;
  return p.contract_status === "signed" || !!p.contract_signed_at;
}

/** Off-platform promised/claimed on proposal OR wedding. */
export function hasOffPlatformPending(p: any): boolean {
  const w = resolveWedding(p);
  const s = w?.offplatform_status || p.offplatform_status;
  return s === "promised" || s === "claimed";
}

/** Has a GHL invoice id/url on the wedding. */
export function hasInvoice(p: any): boolean {
  const w = resolveWedding(p);
  return !!(w?.ghl_invoice_id || w?.ghl_invoice_url);
}

/** Coverage requested but not yet confirmed (and not booked). */
export function isAwaitingCoverage(p: any): boolean {
  if (isBooked(p)) return false;
  if (p.status === "superseded") return false;
  return !!p.coverage_requested_at && !p.coverage_confirmed_at;
}

export function classifyProposal(p: any): ProposalTab {
  if (p.status === "superseded") return "superseded";
  if (isBooked(p)) return "booked";
  if (isAwaitingCoverage(p)) return "coverage";
  if (
    hasOffPlatformPending(p) ||
    (isSigned(p) && !hasInvoice(p) && !hasOffPlatformPending(p))
  ) {
    return "waiting";
  }
  return "draft";
}

export function tabCounts(proposals: any[]): Record<ProposalTab, number> {
  const c: Record<ProposalTab, number> = {
    all: proposals.filter((p) => p.status !== "superseded").length,
    draft: 0,
    waiting: 0,
    booked: 0,
    coverage: 0,
    superseded: 0,
  };
  for (const p of proposals) c[classifyProposal(p)]++;
  return c;
}

export function filterByTab(proposals: any[], tab: ProposalTab): any[] {
  if (tab === "all") return proposals.filter((p) => p.status !== "superseded");
  return proposals.filter((p) => classifyProposal(p) === tab);
}

export function methodLabel(method?: string | null): string {
  if (method === "venmo") return "Venmo";
  if (method === "cashapp") return "Cash App";
  if (method === "zelle") return "Zelle";
  return method || "Off-platform";
}

/* ------------------------------------------------------------------ */
/* Reconcile: set proposal.status = accepted for already-booked       */
/* weddings so old rows leave "Waiting payment". Does not clear       */
/* off-platform history.                                              */
/* ------------------------------------------------------------------ */

/**
 * Given the fetched proposals (with embedded wedding rows), return the list
 * of proposal ids whose wedding is now booked (upcoming/completed OR
 * paid_amount > 0 OR off-platform confirmed) but whose proposal.status is
 * not yet "accepted"/"paid". The caller batches the update.
 */
export function proposalsToReconcile(proposals: any[]): any[] {
  return proposals.filter((p) => {
    if (p.status === "accepted" || p.status === "paid") return false;
    if (p.status === "superseded") return false;
    const w = resolveWedding(p);
    if (!w) {
      // No wedding — book only if proposal off-platform confirmed.
      return p.offplatform_status === "confirmed";
    }
    if (w.status === "upcoming" || w.status === "completed") return true;
    if (Number(w.paid_amount || 0) > 0) return true;
    if (w.offplatform_status === "confirmed") return true;
    return false;
  });
}

/* ------------------------------------------------------------------ */
/* Duplicate detection — mark older proposals superseded             */
/* ------------------------------------------------------------------ */

export interface DedupResult {
  /** proposal ids to set status = "superseded" */
  superseded: string[];
  /** groups used for the detection, for logging */
  groups: { key: string; currentId: string; supersededIds: string[] }[];
}

/**
 * Group proposals by wedding_id, else by client_email + wedding_date.
 * Latest created_at is current; older rows are superseded (only non-booked
 * duplicates — never supersede an accepted/paid row).
 */
export function detectSuperseded(proposals: any[]): DedupResult {
  const map = new Map<string, any[]>();
  for (const p of proposals) {
    let key =
      p.wedding_id || (p.is_upgrade ? p.original_wedding_id : null) || "";
    if (!key) {
      const email = (p.client_email || "").toLowerCase().trim();
      const date = p.wedding_date || "";
      if (email || date) key = `email:${email}|${date}`;
    }
    if (!key) continue; // can't group
    const arr = map.get(key) || [];
    arr.push(p);
    map.set(key, arr);
  }

  const superseded: string[] = [];
  const groups: DedupResult["groups"] = [];

  for (const [key, arr] of map.entries()) {
    if (arr.length < 2) continue;
    // Sort newest first.
    arr.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
    const current = arr[0];
    const older = arr.slice(1);
    const supIds: string[] = [];
    for (const o of older) {
      // Never supersede an already-booked row.
      if (isBooked(o)) continue;
      // Never supersede a row that is already "superseded".
      if (o.status === "superseded") continue;
      supIds.push(o.id);
    }
    if (supIds.length) {
      superseded.push(...supIds);
      groups.push({
        key,
        currentId: current.id,
        supersededIds: supIds,
      });
    }
  }

  return { superseded, groups };
}
