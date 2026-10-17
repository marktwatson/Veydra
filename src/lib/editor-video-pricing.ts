import { supabase } from "./supabase";

export type EditorVideoPrice = {
  id: string;
  label: string;
  price: number;
};

/** Used only when no area has saved a list yet. */
export const DEFAULT_EDITOR_VIDEO_PRICING: EditorVideoPrice[] = [
  { id: "highlight_9_10", label: "Wedding Highlight (9-10 min)", price: 190 },
  { id: "highlight_7_8", label: "Wedding Highlight (7-8 min)", price: 170 },
  { id: "highlight_5_6", label: "Wedding Highlight (5-6 min)", price: 150 },
  { id: "highlight_3_4", label: "Wedding Highlight (3-4 min)", price: 130 },
  { id: "highlight_1_2", label: "Wedding Highlight (1-2 min)", price: 110 },
  { id: "social_teaser", label: "Social Media Teaser (≤1min)", price: 80 },
  { id: "ceremony_30", label: "Ceremony Reel (≤30 mins)", price: 70 },
  { id: "ceremony_60", label: "Ceremony Reel (≤60 mins)", price: 110 },
  { id: "speeches", label: "Speeches & Toasts Reel", price: 70 },
  { id: "other_reel", label: "Other Wedding Reels (≤30 mins)", price: 50 },
  { id: "long_highlight", label: "Long Highlight (11-15mins)", price: 230 },
  { id: "doc_16_30", label: "Documentary (16-30mins)", price: 260 },
  { id: "doc_31_60", label: "Documentary (31-60mins)", price: 290 },
];

export function parseEditorVideoPricing(value: unknown): EditorVideoPrice[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object" && item.id)
      .map((item) => ({
        id: String(item.id),
        label: String(item.label || item.id),
        price: Number(item.price) || 0,
      }));
  } catch {
    return [];
  }
}

/** An area keeps its own list. An empty area uses the shared list, then the defaults. */
export function pickEditorVideoPricing(
  local: unknown,
  shared?: EditorVideoPrice[] | null,
): EditorVideoPrice[] {
  const own = parseEditorVideoPricing(local);
  if (own.length) return own;
  if (shared && shared.length) return shared;
  return DEFAULT_EDITOR_VIDEO_PRICING;
}

/** The list most areas already share. Empty rows are ignored. */
export async function loadSharedEditorVideoPricing(): Promise<EditorVideoPrice[]> {
  const { data, error } = await supabase
    .from("portal_settings")
    .select("editor_video_pricing");
  if (error || !data) return [];
  const lists = data
    .map((row) => parseEditorVideoPricing(row.editor_video_pricing))
    .filter((list) => list.length > 0);
  if (!lists.length) return [];
  const counts = new Map<string, { list: EditorVideoPrice[]; count: number }>();
  for (const list of lists) {
    const key = JSON.stringify(list);
    const found = counts.get(key);
    if (found) found.count += 1;
    else counts.set(key, { list, count: 1 });
  }
  const ranked = [...counts.values()].sort(
    (a, b) => b.count - a.count || b.list.length - a.list.length,
  );
  return ranked[0]?.list || [];
}

/** Copy the shared list onto area rows that have none. Does not change a row that already has prices. */
export async function copyEditorPricingToEmptyRows(
  pricing: EditorVideoPrice[],
): Promise<number> {
  if (!pricing.length) return 0;
  const json = JSON.stringify(pricing);
  const { data, error } = await supabase
    .from("portal_settings")
    .select("id, editor_video_pricing");
  if (error || !data) return 0;
  let copied = 0;
  for (const row of data) {
    if (parseEditorVideoPricing(row.editor_video_pricing).length) continue;
    const { error: updateError } = await supabase
      .from("portal_settings")
      .update({ editor_video_pricing: json })
      .eq("id", row.id);
    if (!updateError) copied += 1;
  }
  return copied;
}

/** Super-admin save. Writes the same list onto every area. */
export async function saveEditorPricingForEveryArea(
  pricing: EditorVideoPrice[],
): Promise<number> {
  const json = JSON.stringify(pricing);
  const { data, error } = await supabase.from("portal_settings").select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("No area settings to update.");
  for (const row of data) {
    const { error: updateError } = await supabase
      .from("portal_settings")
      .update({ editor_video_pricing: json })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }
  return data.length;
}
