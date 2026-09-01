// Lead-to-booking correlation + metric helpers for the Growth Hub.
//
// Extracted from GrowthHub.tsx so the correlation logic stays testable and
// the host page stays under the per-file line limit. Pure functions only —
// they take already-fetched data and return enriched/derived values.
//
// IMPORTANT: weddings + proposals store the client's email in `client_email`
// (not `email`). The CRM lead uses `email`. The matcher below checks both
// keys so an exact email match is the strongest signal and only falls back to
// loose name matching when no email is available on either side.

export interface EnrichedLead {
  [key: string]: any;
  status: string;
  matchedWedding?: any;
  matchedProposal?: any;
  leadToBookingDays: number | null;
  bookedAmount: number;
}

/** Normalize an email/phone-ish string for comparison. */
const norm = (v: any): string =>
  (typeof v === "string" ? v.trim() : "") as string;

/** Match a CRM lead to a booked wedding by exact email, then exact full name. */
export function matchLeadToWedding(
  lead: any,
  weddings: any[],
): any | undefined {
  const leadEmail = norm(lead.email || "").toLowerCase();
  const leadName = norm(lead.name || "").toLowerCase();

  // 1) Strongest signal: exact email match.
  if (leadEmail && leadEmail.includes("@")) {
    const exact = weddings.find((w) => {
      const wEmail = norm(w.client_email || w.email || "").toLowerCase();
      return wEmail && wEmail === leadEmail;
    });
    if (exact) return exact;
  }

  // 2) Strict name match: exact full name equality (prevents "madison" matching all Madisons).
  if (leadName && leadName.length > 2) {
    const byName = weddings.find((w) => {
      const wName = norm(w.client_name || "").toLowerCase();
      return wName && wName === leadName;
    });
    if (byName) return byName;
  }

  return undefined;
}

/** Match a CRM lead to a sent proposal by exact email, then exact full name. */
export function matchLeadToProposal(
  lead: any,
  proposals: any[],
): any | undefined {
  const leadEmail = norm(lead.email || "").toLowerCase();
  const leadName = norm(lead.name || "").toLowerCase();

  if (leadEmail && leadEmail.includes("@")) {
    const exact = proposals.find((p) => {
      const pEmail = norm(p.client_email || p.email || "").toLowerCase();
      return pEmail && pEmail === leadEmail;
    });
    if (exact) return exact;
  }

  if (leadName && leadName.length > 2) {
    const byName = proposals.find((p) => {
      const pName = norm(p.couple_names || p.client_name || "").toLowerCase();
      return pName && pName === leadName;
    });
    if (byName) return byName;
  }

  return undefined;
}

/** Whole-number day diff between two date strings (>= 0, null if unparseable). */
function dayDiff(
  from: string | undefined,
  to: string | undefined,
): number | null {
  const d1 = new Date(from || "").getTime();
  const d2 = new Date(to || "").getTime();
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
}

/**
 * Enrich a raw lead list with matched wedding/proposal + derived status and
 * lead-to-booking day count. Mirrors the original GrowthHub memo exactly,
 * minus the `client_email` field bug that silently broke email matching.
 */
export function enrichLeadsWithBookingData(
  leads: any[],
  allBookedWeddings: any[],
  proposals: any[],
): EnrichedLead[] {
  const rawList = Array.isArray(leads) ? leads : [];
  return rawList.map((lead) => {
    const matchedWedding = matchLeadToWedding(lead, allBookedWeddings);
    const matchedProposal = matchLeadToProposal(lead, proposals);

    let status = lead.status;
    let leadToBookingDays: number | null = null;
    let bookedAmount = 0;

    if (matchedWedding) {
      status = "Booked";
      bookedAmount = matchedWedding.total_amount || 0;
      leadToBookingDays = dayDiff(
        lead.date || lead.created_at,
        matchedWedding.contract_date ||
          matchedWedding.created_at ||
          matchedWedding.date,
      );
    } else if (matchedProposal) {
      status = "Proposal Sent";
    }

    return {
      ...lead,
      status,
      matchedWedding,
      matchedProposal,
      leadToBookingDays,
      bookedAmount,
    };
  });
}

/** Average lead-to-booking days across a date-range-filtered lead list. */
export function computeAvgLeadToBookingDays(
  filteredLeads: EnrichedLead[],
): number | null {
  const booked = filteredLeads.filter(
    (l) => l.status === "Booked" && l.leadToBookingDays !== null,
  );
  if (booked.length === 0) return null;
  return Math.round(
    booked.reduce((acc, l) => acc + (l.leadToBookingDays || 0), 0) /
      booked.length,
  );
}
