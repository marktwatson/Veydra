import {
  managerNavGroups,
  areasNavItem,
  royaltyNavItem,
  ownerRoyaltyNavItem,
} from "@/components/layout-nav";

type NavItem = { icon: any; label: string; path: string };
type NavGroup = { label: string; items: NavItem[] };

/**
 * Build the per-role manager nav groups.
 *
 * - manager: restricted set (no team/accounting/growth/leads/ads/territories).
 * - super_admin: full set + a single Areas item in System Control.
 * - owner / owner_readonly: full set + Areas + owner Royalty Dashboard.
 *
 * The old /manager/territories route is kept for bookmarks but is hidden from
 * the sidebar everywhere.
 */
export function buildVisibleManagerNavGroups(role: string): NavGroup[] {
  return (managerNavGroups as NavGroup[])
    .map((group) => {
      if (role === "manager") {
        if (group.label === "Intel & Growth") return null;
        const filteredItems = group.items.filter(
          (item) =>
            item.path !== "/manager/team" &&
            item.path !== "/manager/accounting" &&
            item.path !== "/manager/growth" &&
            item.path !== "/manager/leads" &&
            item.path !== "/manager/ad-campaigns" &&
            item.path !== "/manager/territories",
        );
        if (filteredItems.length === 0) return null;
        return { ...group, items: filteredItems };
      }
      if (role === "super_admin" && group.label === "System Control") {
        return {
          ...group,
          items: [...group.items, areasNavItem, royaltyNavItem],
        };
      }
      if (role === "owner" || role === "owner_readonly") {
        const filteredItems = group.items.filter(
          (item) => item.path !== "/manager/territories",
        );
        if (filteredItems.length === 0) return null;
        if (group.label === "System Control") {
          return {
            ...group,
            items: [...filteredItems, areasNavItem, ownerRoyaltyNavItem],
          };
        }
        return { ...group, items: filteredItems };
      }
      return group;
    })
    .filter(Boolean) as NavGroup[];
}
