import { supabase } from "./supabase";

/**
 * Load `app_url` from the portal_settings row scoped to a territory_id.
 * Trims trailing slashes. Returns null when the row is missing or app_url is
 * empty — the caller falls back to window.location.origin and toasts.
 *
 * Never a bare .limit(1) — always .eq("territory_id", …).
 */
export async function getAppUrlForTerritory(
  territoryId: string | null | undefined,
): Promise<string | null> {
  if (!territoryId) return null;
  try {
    const { data, error } = await supabase
      .from("portal_settings")
      .select("app_url")
      .eq("territory_id", territoryId)
      .limit(1);
    if (error && error.code !== "42P01") return null;
    const appUrl = (data && data[0]?.app_url) || "";
    const trimmed = String(appUrl).trim().replace(/\/+$/, "");
    return trimmed || null;
  } catch {
    return null;
  }
}

type ToastFn = (t: {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}) => void;

/**
 * Build a `/proposal/{id}` link using the area's app_url for the proposal's
 * territory_id. Falls back to window.location.origin and toasts
 * "Set App URL for this area" when app_url is empty/missing.
 */
export async function buildProposalLink(
  proposalId: string,
  territoryId: string | null | undefined,
  toast?: ToastFn,
): Promise<string> {
  const appUrl = await getAppUrlForTerritory(territoryId);
  if (appUrl) return `${appUrl}/proposal/${proposalId}`;
  toast?.({
    title: "Set App URL for this area",
    description:
      "Proposal link uses this site because the area has no App URL set.",
    variant: "destructive",
  });
  return `${window.location.origin}/proposal/${proposalId}`;
}
