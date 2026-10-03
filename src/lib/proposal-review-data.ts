import { supabase } from "./supabase";
import { api } from "./api";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";
import {
  getPackagesForTerritory,
  getAddonsForTerritory,
  type ProposalPackage,
  type ProposalAddon,
} from "./proposal-package";

/**
 * Loads a proposal and its territory-scoped portal_settings branding for the
 * public /proposal/:id review page.
 *
 * portal_settings now has one row per territory, so the branding load is
 * scoped by the proposal's territory_id (Honeysuckle fallback) instead of a
 * bare .single() — which throws when multiple rows exist.
 *
 * Packages + addons are loaded from the SAME territory (not the logged-in
 * user's), so an anonymous bride sees the package that owns the proposal
 * rather than the Honeysuckle fallback set.
 */
export async function loadProposalAndBranding(id: string): Promise<{
  proposal: any | null;
  branding: any | null;
  packages: ProposalPackage[];
  addons: ProposalAddon[];
  notFound: boolean;
}> {
  // 1) Load the proposal first.
  const proposalRes = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (proposalRes.error || !proposalRes.data) {
    return {
      proposal: null,
      branding: null,
      packages: [],
      addons: [],
      notFound: true,
    };
  }

  let proposalData: any = proposalRes.data;

  // Normalize custom_payment_plan from JSONB — ensure booleans are actual booleans.
  let rawPlan = proposalData.custom_payment_plan;
  if (typeof rawPlan === "string") {
    try {
      rawPlan = JSON.parse(rawPlan);
    } catch {
      /* ignore */
    }
  }
  if (rawPlan && typeof rawPlan === "object") {
    proposalData = {
      ...proposalData,
      custom_payment_plan: {
        enabled:
          rawPlan.enabled === true ||
          rawPlan.enabled === "true" ||
          rawPlan.enabled === 1,
        deposit: Number(rawPlan.deposit) || 0,
        installments: Array.isArray(rawPlan.installments)
          ? rawPlan.installments
          : [],
      },
    };
  } else {
    proposalData = {
      ...proposalData,
      custom_payment_plan: { enabled: false, deposit: 0, installments: [] },
    };
  }

  // 2) Mark as viewed if first time opening.
  if (
    !proposalData.viewed_at &&
    proposalData.status !== "accepted" &&
    proposalData.status !== "paid"
  ) {
    const viewedAt = new Date().toISOString();
    await supabase
      .from("proposals")
      .update({ viewed_at: viewedAt, status: "viewed" })
      .eq("id", id);
    api.logAdminActivity(
      "Proposal Viewed",
      `Client ${proposalData.client_name} viewed their proposal`,
      true,
    );
    proposalData = {
      ...proposalData,
      viewed_at: viewedAt,
      status: "viewed",
    };
  }

  // 3) Load branding scoped by the proposal's territory_id (Honeysuckle
  //    fallback). Never a bare .single() — there is one row per area now.
  const territoryId = proposalData.territory_id ?? HONEYSUCKLE_TERRITORY_ID;
  const settingsRes = await supabase
    .from("portal_settings")
    .select("*")
    .eq("territory_id", territoryId)
    .limit(1)
    .maybeSingle();

  // 4) Load this area's packages + addons (not the logged-in user's). A bride
  //    is anonymous, so api.getPackages() would fall back to Honeysuckle and
  //    the proposal's package_id wouldn't match — leaving a raw id + blank
  //    feature lists. Failures fall back to the caller's fallback sets.
  let packages: ProposalPackage[] = [];
  let addons: ProposalAddon[] = [];
  try {
    [packages, addons] = await Promise.all([
      getPackagesForTerritory(territoryId, true),
      getAddonsForTerritory(territoryId, true),
    ]);
  } catch {
    /* keep empty — caller keeps its fallbacks */
  }

  return {
    proposal: proposalData,
    branding: settingsRes.data ?? null,
    packages,
    addons,
    notFound: false,
  };
}
