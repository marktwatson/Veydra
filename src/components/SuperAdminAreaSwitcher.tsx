import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  loadTerritoriesForPicker,
  isSuperAdminActive,
} from "@/lib/active-territory";
import {
  getSuperAdminViewTerritory,
  setSuperAdminViewTerritory,
  ALL_AREAS_VALUE,
} from "@/lib/current-territory";

/**
 * Area switcher for super admins.
 *
 * Lets HQ view one area at a time instead of every area's data mixed
 * together. The selection persists to localStorage `veydra_view_territory_id`
 * (null / "all" = All Areas) and reloads the page so every list query
 * (Weddings, Proposals, Contractors, Payment Audit) re-runs scoped to the
 * picked area via currentTerritoryId().
 *
 * Managers / owners are locked to their own area, so this is hidden for them.
 */
export function SuperAdminAreaSwitcher() {
  const [territories, setTerritories] = useState<
    { id: string; name: string; slug: string | null }[]
  >([]);
  const [value, setValue] = useState<string>(ALL_AREAS_VALUE);

  useEffect(() => {
    loadTerritoriesForPicker().then((rows) => {
      setTerritories(rows);
      const v = getSuperAdminViewTerritory();
      // Reset a stale id (area deleted) back to All Areas.
      if (v && !rows.some((r) => r.id === v)) {
        setSuperAdminViewTerritory(null);
        setValue(ALL_AREAS_VALUE);
      } else {
        setValue(v ?? ALL_AREAS_VALUE);
      }
    });
  }, []);

  const handleChange = (v: string) => {
    setSuperAdminViewTerritory(v === ALL_AREAS_VALUE ? null : v);
    setValue(v);
    // Reload so every list query re-runs scoped to the new area.
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1.5">
      <Globe className="h-4 w-4 text-muted-foreground hidden sm:block" />
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[130px] sm:w-[170px] text-xs gap-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_AREAS_VALUE}>All Areas</SelectItem>
          {territories.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SuperAdminAreaSwitcherMounter() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Locate the header's right-side control div.
  const findHost = (): HTMLElement | null => {
    const header = document.querySelector("header");
    if (!header) return null;
    // The header has two direct children: left (logo) + right (controls).
    // The controls div is the last direct child div of the header.
    const children = Array.from(
      header.querySelectorAll<HTMLElement>(":scope > div"),
    );
    return children[children.length - 1] ?? null;
  };

  useEffect(() => {
    let cancelled = false;
    const slotId = "super-admin-area-switcher-host";

    const attach = async () => {
      if (cancelled) return false;
      // If already mounted (StrictMode / remount), reuse it.
      const existing = document.getElementById(slotId) as HTMLElement | null;
      if (existing) {
        setHost(existing);
        setIsSuperAdmin(true);
        return true;
      }
      const el = findHost();
      if (!el) return false;
      // By the time the header is in the DOM, auth has finished loading, so
      // the super-admin check is reliable here (not a race at app start).
      let ok = false;
      try {
        ok = await isSuperAdminActive();
      } catch {
        ok = false;
      }
      if (cancelled || !ok) return false;
      if (el.querySelector(`#${slotId}`)) return true;
      const slot = document.createElement("div");
      slot.id = slotId;
      slot.className = "flex items-center";
      el.insertBefore(slot, el.firstChild);
      setHost(slot);
      setIsSuperAdmin(true);
      return true;
    };

    // Watch for the header appearing (auth-loading clears, route changes).
    const observer = new MutationObserver(() => {
      attach().then((d) => {
        if (d) observer.disconnect();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Safety timeout so we never leave an observer running forever.
    const stop = setTimeout(() => observer.disconnect(), 20000);

    // Kick off the initial attach without blocking the effect's return.
    attach().then((done) => {
      if (done) observer.disconnect();
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(stop);
    };
  }, []);

  if (!isSuperAdmin || !host) return null;

  return createPortal(<SuperAdminAreaSwitcher />, host);
}
