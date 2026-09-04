import { supabase } from "./supabase";

// Use a loose type to avoid a circular import with api.ts.
type PortalSettingsPatch = Record<string, any>;

/**
 * Updates a single portal_settings row, resilient to missing columns.
 *
 * The portal_settings table historically had no `updated_at` column, and
 * different territories may be missing newer columns. A naive bulk update
 * fails entirely if ANY column in the payload doesn't exist. This function:
 *
 *  1. Tries a bulk update (with updated_at).
 *  2. On failure, retries field-by-field WITHOUT updated_at so that the
 *     missing column no longer poisons every other field's update.
 *  3. Stamps updated_at separately (tolerates "column does not exist").
 *
 * Returns the saved field values (not a full DB row). Callers that need the
 * fresh row should re-fetch via getPortalSettings().
 */
export async function updatePortalSettingsRow(
  settings: PortalSettingsPatch,
): Promise<Record<string, any>> {
  const nowIso = new Date().toISOString();

  // Find the existing row.
  const { data: existingRows, error: selectError } = await supabase
    .from("portal_settings")
    .select("id")
    .limit(1);
  if (selectError) {
    console.warn("Select error in updatePortalSettings:", selectError);
  }

  const existing = existingRows?.[0];

  // --- INSERT path (no row yet) ---
  if (!existing) {
    const { data, error } = await supabase
      .from("portal_settings")
      .insert(settings)
      .select();
    if (error) throw error;
    return (data?.[0] as PortalSettingsPatch) ?? {};
  }

  // --- UPDATE path ---
  // 1. Try bulk update with updated_at.
  const { data: bulkData, error: bulkError } = await supabase
    .from("portal_settings")
    .update({ ...settings, updated_at: nowIso })
    .eq("id", existing.id)
    .select();

  if (!bulkError) {
    return (bulkData?.[0] as PortalSettingsPatch) ?? settings;
  }

  // 2. Bulk failed (likely a missing column). Retry field-by-field WITHOUT
  //    updated_at so one missing column doesn't block the rest.
  console.warn(
    "Bulk settings update failed, retrying field-by-field:",
    bulkError.message,
  );

  const savedFields: Record<string, any> = {};

  // Stamp updated_at separately — tolerates "column does not exist".
  try {
    const { error: tsError } = await supabase
      .from("portal_settings")
      .update({ updated_at: nowIso })
      .eq("id", existing.id);
    if (!tsError) savedFields.updated_at = nowIso;
  } catch {
    /* updated_at column may not exist yet */
  }

  for (const [key, value] of Object.entries(settings)) {
    try {
      const { error: fieldError } = await supabase
        .from("portal_settings")
        .update({ [key]: value })
        .eq("id", existing.id);
      if (!fieldError) savedFields[key] = value;
    } catch {
      // Skip fields that don't exist in the schema.
    }
  }

  return savedFields;
}
