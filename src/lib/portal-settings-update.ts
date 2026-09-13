import { supabase } from "./supabase";

// Use a loose type to avoid a circular import with api.ts.
type PortalSettingsPatch = Record<string, any>;

/**
 * Columns that were added after the original portal_settings table was
 * created. On older territories these columns may not exist yet, which
 * causes the bulk update to fail and the field-by-field retry to silently
 * skip them. We self-heal them (ALTER ... ADD COLUMN IF NOT EXISTS) before
 * saving so the value actually persists.
 */
const HEALABLE_COLUMNS: Record<string, string> = {
  hl_user_id: "TEXT",
  ghl_invoice_base_url: "TEXT",
};

async function selfHealColumns(patch: PortalSettingsPatch): Promise<void> {
  const toAdd: string[] = [];
  for (const col of Object.keys(HEALABLE_COLUMNS)) {
    if (col in patch) {
      toAdd.push(
        `ALTER TABLE public.portal_settings ADD COLUMN IF NOT EXISTS ${col} ${HEALABLE_COLUMNS[col]};`,
      );
    }
  }
  if (toAdd.length === 0) return;
  try {
    await supabase.rpc("exec_sql", {
      sql_text: toAdd.join(" ") + " NOTIFY pgrst, 'reload schema';",
    });
    // Give PostgREST a moment to pick up the new columns.
    await new Promise((r) => setTimeout(r, 300));
  } catch {
    /* exec_sql may not exist on some areas — not fatal */
  }
}

/**
 * Updates a single portal_settings row, resilient to missing columns.
 *
 * The portal_settings table historically had no `updated_at` column, and
 * different territories may be missing newer columns. A naive bulk update
 * fails entirely if ANY column in the payload doesn't exist. This function:
 *
 *  1. Self-heals known newer columns (hl_user_id, ghl_invoice_base_url).
 *  2. Tries a bulk update (with updated_at).
 *  3. On failure, retries field-by-field WITHOUT updated_at so that the
 *     missing column no longer poisons every other field's update.
 *  4. Stamps updated_at separately (tolerates "column does not exist").
 *
 * Returns the saved field values (not a full DB row). Callers that need the
 * fresh row should re-fetch via getPortalSettings().
 */
export async function updatePortalSettingsRow(
  settings: PortalSettingsPatch,
): Promise<Record<string, any>> {
  const nowIso = new Date().toISOString();

  // Self-heal newer columns before saving so they actually persist.
  await selfHealColumns(settings);

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
