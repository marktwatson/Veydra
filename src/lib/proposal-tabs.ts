/**
 * Proposal tab classification + off-platform helpers.
 *
 * Tabs: all | draft | waiting | booked
 * - booked: off-platform confirmed, or proposal accepted/paid
 * - waiting: off-platform promised/claimed, or signed (viewed) but unpaid
 * - draft: everything else (no off-platform, not accepted)
 */
export type ProposalTab = "all" | "draft" | "waiting" | "booked";

export function classifyProposal(p: any): ProposalTab {
  const ofStatus = p.offplatform_status;
  if (
    ofStatus === "confirmed" ||
    p.status === "accepted" ||
    p.status === "paid"
  ) {
    return "booked";
  }
  if (
    ofStatus === "promised" ||
    ofStatus === "claimed" ||
    (p.status === "viewed" &&
      Number(p.paid_amount || 0) < Number(p.total_amount || 0))
  ) {
    return "waiting";
  }
  return "draft";
}

export function tabCounts(proposals: any[]): Record<ProposalTab, number> {
  const c: Record<ProposalTab, number> = {
    all: proposals.length,
    draft: 0,
    waiting: 0,
    booked: 0,
  };
  for (const p of proposals) c[classifyProposal(p)]++;
  return c;
}

export function filterByTab(proposals: any[], tab: ProposalTab): any[] {
  if (tab === "all") return proposals;
  return proposals.filter((p) => classifyProposal(p) === tab);
}

export function methodLabel(method?: string | null): string {
  if (method === "venmo") return "Venmo";
  if (method === "cashapp") return "Cash App";
  if (method === "zelle") return "Zelle";
  return method || "Off-platform";
}
