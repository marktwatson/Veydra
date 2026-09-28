import { supabase } from "./supabase";
import { api } from "./api";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";

/**
 * Loads a proposal and its territory-scoped portal_settings branding for the
 * public /proposal/:id review page.
 *
 * portal_settings now has one row per territory, so the branding load is
 * scoped by the proposal's territory_id (Honeysuckle fallback) instead of a
 * bare .single() — which throws when multiple rows exist.
 */
export async function loadProposalAndBranding(id: string): Promise<{
  proposal: any | null;
  branding: any | null;
  notFound: boolean;
}> {
  // 1) Load the proposal first.
  const proposalRes = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (proposalRes.error || !proposalRes.data) {
    return { proposal: null, branding: null, notFound: true };
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

  return {
    proposal: proposalData,
    branding: settingsRes.data ?? null,
    notFound: false,
  };
}
