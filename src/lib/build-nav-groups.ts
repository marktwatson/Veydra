import {
  managerNavGroups,
  areasNavItem,
  royaltyNavItem,
  ownerRoyaltyNavItem,
  commandNavItem,
} from "@/components/layout-nav";
import { canAccessCommand } from "@/lib/command-access";

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
 *
 * The Command nav item is appended to "Intel & Growth" ONLY for the two
 * allow-listed emails (canAccessCommand). Everyone else never sees it.
 */
export function buildVisibleManagerNavGroups(
  role: string,
  email?: string | null,
): NavGroup[] {
  const showCommand = canAccessCommand(email);
  return (managerNavGroups as NavGroup[])
    .map((group) => {
      if (role === "manager") {
        if (group.label === "Intel & Growth") {
          // Managers normally lose the whole Intel & Growth group, but a
          // Command-allowed manager still gets the Command item alone.
          if (showCommand) {
            return { ...group, items: [commandNavItem] };
          }
          return null;
        }
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
          (item) =>
            item.path !== "/manager/territories" &&
            item.path !== "/manager/areas",
        );
        if (filteredItems.length === 0 && !showCommand) return null;
        if (group.label === "System Control") {
          return {
            ...group,
            items: [...filteredItems, ownerRoyaltyNavItem],
          };
        }
        if (group.label === "Intel & Growth" && showCommand) {
          return { ...group, items: [...filteredItems, commandNavItem] };
        }
        return { ...group, items: filteredItems };
      }
      // super_admin Intel & Growth: append Command if allowed.
      if (
        role === "super_admin" &&
        group.label === "Intel & Growth" &&
        showCommand
      ) {
        return { ...group, items: [...group.items, commandNavItem] };
      }
      return group;
    })
    .filter(Boolean) as NavGroup[];
}
