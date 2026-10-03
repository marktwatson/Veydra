import { supabase } from "./supabase";
import { HONEYSUCKLE_TERRITORY_ID } from "./territory";

/**
 * Territory-scoped package + addon loaders for public/client-facing pages.
 *
 * The manager `api.getPackages()` / `api.getAddons()` helpers scope by the
 * logged-in user's territory (Honeysuckle fallback for anonymous visitors).
 * A bride viewing a Captured Memories proposal is anonymous, so those helpers
 * return the Honeysuckle package set — the proposal's `package_id` doesn't
 * match, and she sees the raw id with blank photo/video feature lists.
 *
 * These helpers load packages/addons from the PROPOSAL's (or wedding's)
 * territory_id instead, so a client always sees the package that owns the
 * proposal — regardless of who is logged in.
 */

export interface ProposalPackage {
  id: string;
  name: string;
  desc: string;
  priceBoth: number;
  priceSingle: number;
  photoFeatures: string[];
  videoFeatures: string[];
  isArchived: boolean;
}

export interface ProposalAddon {
  id: string;
  name: string;
  price: number;
  isHourly: boolean;
  minHours: number;
  isArchived: boolean;
  isBartending: boolean;
  description: string;
  features: string[];
}

function mapPackageRow(p: any): ProposalPackage {
  return {
    id: p.id,
    name: p.name,
    desc: p.description,
    priceBoth: Number(p.price_both),
    priceSingle: Number(p.price_single),
    photoFeatures: p.photo_features || [],
    videoFeatures: p.video_features || [],
    isArchived: p.is_archived,
  };
}

function mapAddonRow(a: any): ProposalAddon {
  return {
    id: a.id,
    name: a.name,
    price: Number(a.price),
    isHourly: a.is_hourly,
    minHours: Number(a.min_hours) || 0,
    isArchived: a.is_archived,
    isBartending: a.is_bartending || false,
    description: a.description || "",
    features: a.features || [],
  };
}

/** Resolve a territory id for a client-facing package load. Falls back to
 *  Honeysuckle so a missing territory still shows something. */
export function resolveClientTerritoryId(
  territoryId: string | null | undefined,
): string {
  return territoryId || HONEYSUCKLE_TERRITORY_ID;
}

/** Load every package for a territory (including archived), mapped to the
 *  same shape the manager getPackages() returns. */
export async function getPackagesForTerritory(
  territoryId: string | null | undefined,
  includeArchived = true,
): Promise<ProposalPackage[]> {
  const tid = resolveClientTerritoryId(territoryId);
  let query = supabase
    .from("pricing_packages")
    .select("*")
    .eq("territory_id", tid)
    .order("sort_order", { ascending: true });
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapPackageRow);
}

/** Load every addon for a territory, mapped to the manager getAddons() shape. */
export async function getAddonsForTerritory(
  territoryId: string | null | undefined,
  includeArchived = true,
): Promise<ProposalAddon[]> {
  const tid = resolveClientTerritoryId(territoryId);
  let query = supabase
    .from("pricing_addons")
    .select("*")
    .eq("territory_id", tid)
    .order("sort_order", { ascending: true });
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapAddonRow);
}

/** Load a single package row by (id, territory_id). Returns null if missing
 *  so the caller can fall back to the saved name/total on the proposal. */
export async function getPackageForProposal(
  packageId: string | null | undefined,
  territoryId: string | null | undefined,
): Promise<ProposalPackage | null> {
  if (!packageId) return null;
  const tid = resolveClientTerritoryId(territoryId);
  const { data, error } = await supabase
    .from("pricing_packages")
    .select("*")
    .eq("id", packageId)
    .eq("territory_id", tid)
    .maybeSingle();
  if (error || !data) return null;
  return mapPackageRow(data);
}
