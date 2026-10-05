import { supabase } from "./supabase";

/** Parse a region/JSON-array field that may come back as a stringified array. */
function parseRegionsArray(regions: any): string[] {
  if (!regions) return [];
  if (Array.isArray(regions)) return regions;
  if (typeof regions === "string") {
    try {
      const parsed = JSON.parse(regions);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
    return regions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Weddings assigned to a specific editor, across ALL territories.
 *
 * Editors are scoped by assignment (editor_id), NOT by territory_id. An
 * editor assigned to a Nik TN or North Carolina wedding must see it in their
 * queue regardless of which area the wedding lives in. This deliberately does
 * NOT call the territory-scoped getWeddings / getWeddingsForTerritory paths
 * (which fall back to a single area and would hide cross-area assignments).
 *
 * Excludes draft and cancelled weddings. Mirrors the same JSON-array parsing
 * the main getWeddings methods apply.
 */
export async function getWeddingsForEditor(editorId: string) {
  const { data, error } = await supabase
    .from("weddings")
    .select("*")
    .eq("editor_id", editorId)
    .neq("status", "draft")
    .neq("status", "cancelled")
    .neq("status", "Cancelled")
    .order("date", { ascending: true });
  if (error) throw error;

  return (data || []).map((w) => ({
    ...w,
    region:
      typeof w.region === "string" ? parseRegionsArray(w.region) : w.region,
    editor_video_targets:
      typeof w.editor_video_targets === "string"
        ? parseRegionsArray(w.editor_video_targets)
        : w.editor_video_targets,
    questionnaire_data:
      typeof w.questionnaire_data === "string"
        ? (() => {
            try {
              return JSON.parse(w.questionnaire_data);
            } catch {
              return w.questionnaire_data;
            }
          })()
        : w.questionnaire_data,
    editor_invoice_details:
      typeof w.editor_invoice_details === "string"
        ? (() => {
            try {
              return JSON.parse(w.editor_invoice_details);
            } catch {
              return w.editor_invoice_details;
            }
          })()
        : w.editor_invoice_details,
    highlight_songs:
      typeof w.highlight_songs === "string"
        ? (() => {
            try {
              return JSON.parse(w.highlight_songs);
            } catch {
              return w.highlight_songs;
            }
          })()
        : w.highlight_songs || [],
  })) as any[];
}

/** Company name from each area's portal settings. Not the territory name. */
export async function companyNamesByTerritory(territoryIds: string[]) {
  const ids = [...new Set(territoryIds.filter(Boolean))];
  if (ids.length === 0) return {} as Record<string, string>;
  const { data, error } = await supabase
    .from("portal_settings")
    .select("territory_id, company_name")
    .in("territory_id", ids);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data || []) {
    if (row.territory_id && row.company_name) {
      map[row.territory_id] = row.company_name;
    }
  }
  return map;
}
