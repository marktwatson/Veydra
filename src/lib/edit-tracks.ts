export type EditTrack = "single" | "photo" | "video" | "both";

const RANK: Record<string, number> = {
  revisions_requested: 1,
  ready_to_edit: 2,
  in_progress: 3,
  client_review: 4,
  delivered: 5,
};

/** Wedding status while split. Delivered only when every assigned track is delivered. */
export function combinedEditingStatus(wedding: any): string {
  const parts: string[] = [];
  if (wedding?.photo_editor_id) parts.push(wedding.photo_editing_status || "ready_to_edit");
  if (wedding?.video_editor_id) parts.push(wedding.video_editing_status || "ready_to_edit");
  if (parts.length === 0) return wedding?.editing_status || "ready_to_edit";
  if (parts.every((status) => status === "delivered")) return "delivered";
  if (parts.some((status) => status === "revisions_requested")) return "revisions_requested";
  if (parts.some((status) => status === "client_review") && parts.every((status) => status === "client_review" || status === "delivered")) {
    return "client_review";
  }
  if (parts.some((status) => (RANK[status] || 0) >= RANK.in_progress)) return "in_progress";
  return "ready_to_edit";
}

/** What this editor is allowed to change. Null means the split wedding is not theirs. */
export function presentEditorWedding(wedding: any, editorIds: Set<string>) {
  if (!wedding?.edit_split) return { ...wedding, _track: "single" as EditTrack };
  const photo = editorIds.has(wedding.photo_editor_id);
  const video = editorIds.has(wedding.video_editor_id);
  if (photo && video) return { ...wedding, _track: "both" as EditTrack };
  if (photo) {
    return {
      ...wedding,
      _track: "photo" as EditTrack,
      editing_status: wedding.photo_editing_status || "ready_to_edit",
      editor_invoice_status: wedding.photo_invoice_status || null,
      editor_invoice_details: wedding.photo_invoice_details || null,
      editor_payout_amount: wedding.photo_payout_amount ?? null,
    };
  }
  if (video) {
    return {
      ...wedding,
      _track: "video" as EditTrack,
      editing_status: wedding.video_editing_status || "ready_to_edit",
      editor_invoice_status: wedding.video_invoice_status || null,
      editor_invoice_details: wedding.video_invoice_details || null,
      editor_payout_amount: wedding.video_payout_amount ?? null,
    };
  }
  return null;
}

export function trackStatusUpdates(wedding: any, nextStatus: string) {
  const track = wedding?._track as EditTrack | undefined;
  if (!wedding?.edit_split || !track || track === "single") {
    return { editing_status: nextStatus };
  }
  const updates: Record<string, string> = {};
  if (track === "photo" || track === "both") updates.photo_editing_status = nextStatus;
  if (track === "video" || track === "both") updates.video_editing_status = nextStatus;
  updates.editing_status = combinedEditingStatus({ ...wedding, ...updates });
  return updates;
}
