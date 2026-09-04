import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Master toggle for the entire Bartending module.
 *
 * When `bartending_module_enabled` is false (the default), ALL bartending UI
 * is hidden across the app — Settings cards, addon tagging, the bride-portal
 * banner, and the wedding-actions menu items. This is a super-admin-only
 * switch stored in `portal_settings`.
 *
 * The per-instance `upsell_bartending_enabled` is a sub-toggle that only takes
 * effect once this master toggle is on.
 */
export function useBartendingModule() {
  const { data: settings } = useQuery({
    queryKey: ["portal-settings-bartending-module"],
    queryFn: () => api.getPortalSettings(),
    staleTime: 30_000,
  });
  return !!settings?.bartending_module_enabled;
}
