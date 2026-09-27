import { supabase } from "./supabase";
import type { DbPortalSettings } from "./api";
import { currentTerritoryId } from "./current-territory";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";
import { getPortalSettingsForTerritory } from "./apply-territory-settings";
import type { ApplyPortalSettings } from "./apply-territory-settings";

/**
 * Resolve the territory_id for a portal_settings lookup, in priority order:
 *   1. wedding.territory_id (looked up by wedding id)
 *   2. proposal.territory_id (looked up by proposal id)
 *   3. contractor.territory_id (looked up by contractor id)
 *   4. logged-in manager's currentTerritoryId()
 *   5. Honeysuckle fallback id
 *
 * Pass whichever entity ids you have. Returns a territory_id string (never
 * null — super admin falls through to Honeysuckle here because we need a
 * concrete row to load templates/keys from).
 */
export async function resolveTerritoryIdForSettings(opts: {
  weddingId?: string | null;
  proposalId?: string | null;
  contractorId?: string | null;
  jobId?: string | null;
}): Promise<string> {
  // 0. job → wedding.territory_id
  if (opts.jobId) {
    try {
      const { data: j } = await supabase
        .from("jobs")
        .select("wedding_id")
        .eq("id", opts.jobId)
        .maybeSingle();
      if (j?.wedding_id) {
        const { data: w } = await supabase
          .from("weddings")
          .select("territory_id")
          .eq("id", j.wedding_id)
          .maybeSingle();
        if (w?.territory_id) return w.territory_id as string;
      }
    } catch {
      /* fall through */
    }
  }

  // 1. wedding.territory_id
  if (opts.weddingId) {
    try {
      const { data: w } = await supabase
        .from("weddings")
        .select("territory_id")
        .eq("id", opts.weddingId)
        .maybeSingle();
      if (w?.territory_id) return w.territory_id as string;
    } catch {
      /* fall through */
    }
  }

  // 2. proposal.territory_id
  if (opts.proposalId) {
    try {
      const { data: p } = await supabase
        .from("proposals")
        .select("territory_id")
        .eq("id", opts.proposalId)
        .maybeSingle();
      if (p?.territory_id) return p.territory_id as string;
    } catch {
      /* fall through */
    }
  }

  // 3. contractor.territory_id
  if (opts.contractorId) {
    try {
      const { data: c } = await supabase
        .from("contractors")
        .select("territory_id")
        .eq("id", opts.contractorId)
        .maybeSingle();
      if (c?.territory_id) return c.territory_id as string;
    } catch {
      /* fall through */
    }
  }

  // 4. logged-in manager's territory (null = super admin → Honeysuckle).
  const mgrTerritory = await currentTerritoryId();
  if (mgrTerritory) return mgrTerritory;

  // 5. Honeysuckle fallback.
  return HONEYSUCKLE_TERRITORY_ID;
}

/**
 * Load the portal_settings row scoped to the resolved territory for an
 * entity. Reuses getPortalSettingsForTerritory (never a bare .limit(1)).
 * Returns null when no row exists for that territory.
 */
export async function getScopedPortalSettings(opts: {
  weddingId?: string | null;
  proposalId?: string | null;
  contractorId?: string | null;
  jobId?: string | null;
}): Promise<ApplyPortalSettings | null> {
  const territoryId = await resolveTerritoryIdForSettings(opts);
  return getPortalSettingsForTerritory(territoryId);
}

/**
 * Load the FULL portal_settings row (all template/key columns) scoped to the
 * resolved territory for an entity. Used by notification senders that need
 * many template fields. Never a bare .limit(1) — always .eq("territory_id").
 * Returns null when no row exists for that territory.
 */
export async function getScopedPortalSettingsFull(opts: {
  weddingId?: string | null;
  proposalId?: string | null;
  contractorId?: string | null;
  jobId?: string | null;
}): Promise<DbPortalSettings | null> {
  const territoryId = await resolveTerritoryIdForSettings(opts);
  try {
    const { data, error } = await supabase
      .from("portal_settings")
      .select("*")
      .eq("territory_id", territoryId)
      .limit(1);
    if (error && error.code !== "42P01") throw error;
    return data && data.length > 0 ? (data[0] as DbPortalSettings) : null;
  } catch {
    return null;
  }
}

export { HONEYSUCKLE_TERRITORY_ID };

/**
 * Load just the CRM credentials (hl_api_key, hl_location_id) scoped to the
 * resolved territory for an entity. Used by sendOvantaEmail/Sms,
 * syncContractorCRM, _getCrmCustomFieldMap, getOvantaLeads. Never a bare
 * .limit(1) — always .eq("territory_id").
 */
export async function getScopedCrmCredentials(opts: {
  weddingId?: string | null;
  proposalId?: string | null;
  contractorId?: string | null;
  jobId?: string | null;
  territoryId?: string | null;
}): Promise<{
  hl_api_key: string | null;
  hl_location_id: string | null;
} | null> {
  let territoryId = opts.territoryId ?? null;
  if (!territoryId) {
    territoryId = await resolveTerritoryIdForSettings({
      weddingId: opts.weddingId,
      proposalId: opts.proposalId,
      contractorId: opts.contractorId,
      jobId: opts.jobId,
    });
  }
  try {
    const { data, error } = await supabase
      .from("portal_settings")
      .select("hl_api_key, hl_location_id")
      .eq("territory_id", territoryId)
      .limit(1);
    if (error && error.code !== "42P01") throw error;
    return data && data.length > 0 ? (data[0] as any) : null;
  } catch {
    return null;
  }
}
