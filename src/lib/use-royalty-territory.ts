import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  getSuperAdminViewTerritory,
  getManagerTerritoryIdRaw,
} from "@/lib/current-territory";

/**
 * Resolves which territory the Royalty page should load.
 *
 *  - Super admin (role === "super_admin" only — NOT isSuperAdminEmail):
 *    follows the header SuperAdminAreaSwitcher via getSuperAdminViewTerritory().
 *    A territory id → that area; null / "all" → default to the primary
 *    territory (Honeysuckle). Changing the header switcher reloads the page,
 *    which re-runs this hook with the new id.
 *
 *  - Owner / manager: locked to their own managers.territory_id with NO
 *    Honeysuckle fallback and NO is_primary fallback. null → "No area
 *    assigned" (the page shows that state and does not load Honeysuckle
 *    royalty).
 *
 *  - primaryTerritory: this instance's own row (Honeysuckle). Used as the
 *    super-admin default and to detect first-run setup.
 */
export function useRoyaltyTerritory() {
  const { user } = useAuth();

  // Gated by role only — an owner can never unlock the full area list.
  const isSuperAdmin = user?.role === "super_admin";

  const { data: primaryTerritory, isLoading: loadingPrimary } = useQuery({
    queryKey: ["royalty-territory-primary"],
    queryFn: api.getOwnRoyaltyTerritory,
  });

  // Super admin: sync localStorage read (available on first render).
  const superViewId = isSuperAdmin ? getSuperAdminViewTerritory() : null;

  // Owner / manager: their managers.territory_id, no fallback.
  const {
    data: managerTerritoryId,
    isLoading: loadingManagerTerritory,
    isSuccess: managerTerritoryLoaded,
  } = useQuery({
    queryKey: ["royalty-manager-territory-id"],
    queryFn: () => getManagerTerritoryIdRaw(),
    enabled: !isSuperAdmin,
  });

  const effectiveTerritoryId = isSuperAdmin
    ? superViewId || primaryTerritory?.id || null
    : (managerTerritoryId ?? null);

  return {
    isSuperAdmin,
    primaryTerritory,
    loadingPrimary,
    managerTerritoryId: managerTerritoryId ?? null,
    loadingManagerTerritory,
    managerTerritoryLoaded,
    effectiveTerritoryId,
  };
}
