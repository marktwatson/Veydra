import { supabase } from "./supabase";

/**
 * Snapshot the package name + photo/video feature lists from the area's
 * pricing_packages row onto a proposal payload.
 *
 * The public /proposal/:id review page renders these saved fields FIRST so it
 * never depends on a client-side catalog lookup (which falls back to the wrong
 * area on a phone / private tab). pricing_packages PK is (id, territory_id),
 * so the join matches the proposal's own area row.
 *
 * Returns a partial payload object (package_name, photo_features,
 * video_features) to spread into the insert/update payload. On any error or
 * missing row, returns an empty object so the insert still proceeds — the
 * review page falls back to a direct lookup only when these are empty.
 */
export async function buildPackageSnapshotFields(
  packageId: string | null | undefined,
  territoryId: string | null | undefined,
): Promise<Record<string, string | string[]>> {
  if (!packageId || !territoryId) return {};
  try {
    const { data, error } = await supabase
      .from("pricing_packages")
      .select("name, photo_features, video_features")
      .eq("id", packageId)
      .eq("territory_id", territoryId)
      .maybeSingle();
    if (error || !data) return {};
    return {
      package_name: data.name || "",
      photo_features: Array.isArray(data.photo_features)
        ? data.photo_features
        : [],
      video_features: Array.isArray(data.video_features)
        ? data.video_features
        : [],
    };
  } catch {
    return {};
  }
}
