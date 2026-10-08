import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { isSuperAdminEmail } from "@/lib/super-admin";
import {
  getAllowedTerritoryIds,
  getSuperAdminViewTerritory,
  loadManagerTerritory,
  setSuperAdminViewTerritory,
} from "@/lib/current-territory";
import { HONEYSUCKLE_TERRITORY_ID } from "@/lib/territory";

interface SwitcherArea {
  id: string;
  name: string;
}

/**
 * Area switcher for super admins AND multi-area managers.
 *
 *  - Super admin: every territory. No "All Areas" item — they pick one area.
 *  - Multi-area manager (territory_ids has > 1 id): only their allowed areas.
 *
 * The selection persists to localStorage `veydra_view_territory_id` and
 * reloads the page so every list query re-runs scoped to the picked area via
 * currentTerritoryId().
 *
 * Single-area managers / owners never see this (canSwitchAreas() is false).
 */
export function SuperAdminAreaSwitcher() {
  const [areas, setAreas] = useState<SwitcherArea[]>([]);
  const [value, setValue] = useState<string>("");
  const [defaultId, setDefaultId] = useState<string>(HONEYSUCKLE_TERRITORY_ID);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Resolve the user's allowed areas + home area.
      let allowedIds: string[] | null = null; // null = every area (super admin)
      let homeId = HONEYSUCKLE_TERRITORY_ID;
      let isSuper = false;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        let impersonated: { email?: string; role?: string } | null = null;
        try {
          const raw = localStorage.getItem("impersonated_user");
          if (raw) impersonated = JSON.parse(raw);
        } catch {
          impersonated = null;
        }
        const email = impersonated?.email || user?.email;
        isSuper =
          impersonated?.role === "super_admin" ||
          (!impersonated && isSuperAdminEmail(email));
        if (isSuper) {
          allowedIds = null;
        } else {
          const mgr = await loadManagerTerritory();
          homeId = (mgr?.territory_id as string) || homeId;
          allowedIds = await getAllowedTerritoryIds();
        }
      } catch {
        /* ignore */
      }

      // 2. Load territory rows. Super admin → all; manager → only allowed.
      let rows: SwitcherArea[] = [];
      try {
        let q = supabase.from("territories").select("id, name").order("name");
        if (allowedIds && allowedIds.length > 0) {
          q = q.in("id", allowedIds);
        }
        const { data, error } = await q;
        if (!error && data) rows = data as SwitcherArea[];
        if (allowedIds) {
          const seen = new Set(rows.map((row) => row.id));
          allowedIds.forEach((id) => {
            if (!seen.has(id)) {
              rows.push({
                id,
                name:
                  id === "cc79aa88-2fcf-4d6c-8696-47c25f57e909"
                    ? "North Carolina (Andrew)"
                    : id === HONEYSUCKLE_TERRITORY_ID
                      ? "Tennessee (Nik)"
                      : "Assigned area",
              });
            }
          });
        }
      } catch {
        /* ignore */
      }
      if (rows.length === 0) {
        rows = [{ id: HONEYSUCKLE_TERRITORY_ID, name: "Honeysuckle" }];
      }

      // 3. Keep a selected area. Do not reset it to the home area.
      const def = isSuper
        ? rows[0]?.id || HONEYSUCKLE_TERRITORY_ID
        : homeId || rows[0]?.id || HONEYSUCKLE_TERRITORY_ID;
      const saved = getSuperAdminViewTerritory();
      const inList = rows.some((r) => r.id === saved);
      const next = saved && inList ? saved : def;
      setDefaultId(def);
      setAreas(rows);
      setValue(next);
      // The dropdown already shows one area. Save it so the lists use that
      // area on this load instead of every area.
      if (!saved || !inList) setSuperAdminViewTerritory(next);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (v: string) => {
    setSuperAdminViewTerritory(v);
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
          {areas.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Mounts the area switcher into the header for users who can switch areas
 * (super admin or multi-area manager). Rendered directly in LayoutHeader
 * JSX; this mounter is kept for backward compatibility.
 */
export function SuperAdminAreaSwitcherMounter() {
  return null;
}
