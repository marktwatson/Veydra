/**
 * Shared campaign-inclusion helpers for Intelligence / Growth Hub / Accounting.
 *
 * A single source of truth for which campaigns count toward ad-spend totals,
 * ROAS, CAC, clicks and impressions. The exclusion list lives on
 * portal_settings.excluded_campaign_ids (TEXT[], self-healed) and is shared
 * across every area — no per-user copy.
 *
 * Campaign id is read from the Ovanta/FB payload field `id` (the same id
 * rendered in the Ad Campaigns table). If a campaign object uses a different
 * key, pass a custom idAccessor.
 */

export type CampaignLike = Record<string, any>;

/**
 * Read the canonical campaign id from a payload object.
 * Falls back through common aliases used by different Ovanta/FB shapes.
 */
export function getCampaignId(c: CampaignLike): string {
  if (!c) return "";
  return String(
    c.id ?? c.campaign_id ?? c.campaignId ?? c.fb_campaign_id ?? "",
  );
}

/**
 * Normalize a raw excluded list (which may arrive as a Postgres TEXT[] array,
 * a JSON string, or a JS array) into a clean string[] for comparison.
 */
export function normalizeExcludedIds(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    // Postgres text[] often arrives like {a,b,c}
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* not JSON */
    }
    return trimmed ? [trimmed] : [];
  }
  return [];
}

/**
 * Return only the campaigns NOT in the excluded list.
 * This is what every spend / ROAS / CAC / clicks total should sum over.
 */
export function includedCampaigns(
  campaigns: CampaignLike[],
  excludedIds: string[] | null | undefined,
): CampaignLike[] {
  const excl = new Set(normalizeExcludedIds(excludedIds).map((s) => s.trim()));
  return (Array.isArray(campaigns) ? campaigns : []).filter(
    (c) => !excl.has(getCampaignId(c).trim()),
  );
}

/**
 * Sum a numeric field across included campaigns only.
 */
export function sumIncluded(
  campaigns: CampaignLike[],
  excludedIds: string[] | null | undefined,
  field: string,
): number {
  return includedCampaigns(campaigns, excludedIds).reduce(
    (sum, c) => sum + (Number(c[field]) || 0),
    0,
  );
}

/**
 * ROAS = booked revenue in range / included ad spend.
 * Returns the multiplier as a number, or null when spend is 0 (so the UI
 * can show "—" instead of Infinity).
 */
export function computeRoas(
  bookedRevenue: number,
  campaigns: CampaignLike[],
  excludedIds: string[] | null | undefined,
): number | null {
  const spend = sumIncluded(campaigns, excludedIds, "spend");
  if (spend <= 0) return null;
  return bookedRevenue / spend;
}

/**
 * CAC = included ad spend / bookings count (or conversions fallback).
 */
export function computeCac(
  campaigns: CampaignLike[],
  excludedIds: string[] | null | undefined,
  bookingsCount: number,
): number {
  const spend = sumIncluded(campaigns, excludedIds, "spend");
  const conversions = sumIncluded(campaigns, excludedIds, "conversions");
  if (bookingsCount > 0 && spend > 0) return spend / bookingsCount;
  if (conversions > 0) return spend / conversions;
  return 0;
}

/**
 * Human-readable list of excluded campaign names (for chip display).
 */
export function excludedCampaignNames(
  campaigns: CampaignLike[],
  excludedIds: string[] | null | undefined,
): { id: string; name: string }[] {
  const excl = new Set(normalizeExcludedIds(excludedIds).map((s) => s.trim()));
  return (Array.isArray(campaigns) ? campaigns : [])
    .filter((c) => excl.has(getCampaignId(c).trim()))
    .map((c) => ({ id: getCampaignId(c), name: String(c.name ?? c.id) }));
}
