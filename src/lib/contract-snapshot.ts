import { supabase } from "./supabase";

/**
 * Captures a frozen snapshot of the currently-rendered contract HTML and
 * saves it to the proposal's `custom_contract_snapshot` column.
 *
 * This runs at the moment the bride signs, so the signed agreement is
 * preserved exactly as it appeared — even if the template, Settings, or
 * package prices change later.
 *
 * Best-effort: failures are non-fatal (signing still proceeds).
 */
export async function saveContractSnapshotOnSign(
  proposalId: string,
): Promise<void> {
  if (!proposalId) return;
  try {
    const contractEl = document.querySelector(
      ".contract-content",
    ) as HTMLElement | null;
    if (!contractEl) return;

    const snapshot = contractEl.innerHTML;
    if (!snapshot) return;

    await supabase
      .from("proposals")
      .update({ custom_contract_snapshot: snapshot })
      .eq("id", proposalId);
  } catch {
    // non-fatal — snapshot is best-effort, signing should still proceed
  }
}
