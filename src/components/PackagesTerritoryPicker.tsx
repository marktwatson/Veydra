import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  activeTerritoryId,
  setActiveTerritoryId,
  loadTerritoriesForPicker,
} from "@/lib/active-territory";
import { HONEYSUCKLE_TERRITORY_ID } from "@/lib/territory";
import { setSuperAdminViewTerritory } from "@/lib/current-territory";

/**
 * Territory picker shown on Settings → Packages for super admins only.
 *
 * Managers/owners are locked to their own area (no picker). A super admin
 * picks an area from the dropdown; the selection is persisted to
 * localStorage `veydra_active_territory_id` and the page reloads so the
 * Packages tab re-fetches packages/addons scoped to the new area.
 *
 * This component is injected into the Packages & Addons header via a DOM
 * portal (Settings.tsx is not editable), so it renders inline next to the
 * "Show archived" toggle without modifying the page source.
 */
export function PackagesTerritoryPicker({
  isSuperAdmin,
}: {
  isSuperAdmin: boolean;
}) {
  const [territories, setTerritories] = useState<
    { id: string; name: string; slug: string | null }[]
  >([]);
  const [activeId, setActiveId] = useState<string>("");
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadTerritoriesForPicker().then(setTerritories);
    activeTerritoryId().then(setActiveId);
  }, [isSuperAdmin]);

  // Find the Packages & Addons header row and mount the picker into its
  // right-side controls container (the flex div holding "Show archived").
  useEffect(() => {
    if (!isSuperAdmin) return;
    const findHost = () => {
      const headers = Array.from(
        document.querySelectorAll<HTMLElement>("h2.text-xl.font-semibold"),
      );
      const pkgHeader = headers.find((h) =>
        h.textContent?.includes("Packages & Addons"),
      );
      if (!pkgHeader) return null;
      // The sibling controls div is the next .flex.items-center.gap-2 after
      // the header's parent.
      const controls = pkgHeader
        .closest("div")
        ?.parentElement?.querySelector<HTMLElement>(
          "div.flex.items-center.gap-2",
        );
      return controls ?? null;
    };
    const el = findHost();
    if (el) setHost(el);
    // Retry a few times in case the tab content renders lazily.
    if (!el) {
      const tries = [200, 500, 1000];
      const timers = tries.map((ms) =>
        setTimeout(() => {
          const e2 = findHost();
          if (e2) setHost(e2);
        }, ms),
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [isSuperAdmin]);

  if (!isSuperAdmin || !host) return null;

  const handleChange = (id: string) => {
    setActiveTerritoryId(id);
    setSuperAdminViewTerritory(id);
    setActiveId(id);
    // Reload so the Packages tab re-fetches with the new active territory.
    window.location.reload();
  };

  const display =
    territories.find((t) => t.id === activeId)?.name ||
    (activeId ? activeId.slice(0, 8) : "Honeysuckle");

  return createPortal(
    <div className="flex items-center gap-2 mr-2">
      <Label className="text-sm text-muted-foreground whitespace-nowrap">
        Area
      </Label>
      <Select value={activeId} onValueChange={handleChange}>
        <SelectTrigger className="w-[200px] h-8">
          <SelectValue placeholder={display} />
        </SelectTrigger>
        <SelectContent>
          {territories.length === 0 && (
            <SelectItem value={HONEYSUCKLE_TERRITORY_ID}>
              Honeysuckle
            </SelectItem>
          )}
          {territories.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>,
    host,
  );
}

/**
 * Global mounter: renders the PackagesTerritoryPicker only on the Settings
 * page and only for super admins. Mounted once in main.tsx alongside
 * PaymentDueAlert so it works without editing Settings.tsx.
 */
export function PackagesTerritoryMounter() {
  const [pathname, setPathname] = useState(
    typeof window !== "undefined" ? window.location.pathname : "",
  );
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    setPathname(window.location.pathname);
    import("@/lib/active-territory").then(({ isSuperAdminActive }) =>
      isSuperAdminActive().then(setIsSuperAdmin),
    );
  }, []);

  // Only the Settings page hosts the Packages & Addons tab.
  if (!pathname.includes("/manager/settings")) return null;
  if (!isSuperAdmin) return null;

  return <PackagesTerritoryPicker isSuperAdmin={isSuperAdmin} />;
}
