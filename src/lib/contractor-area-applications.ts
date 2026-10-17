import { supabase } from "./supabase";
import { api } from "./api";

export type AreaApplication = {
  territory_id: string;
  status: string;
  specialty?: string | null;
  region?: string[] | null;
  drone_approved?: boolean | null;
  training_completed?: boolean | null;
};

const AREA_FIELDS = new Set([
  "specialty",
  "status",
  "gear_list",
  "portfolio_url",
  "region",
  "drone_approved",
  "training_completed",
  "review_notes",
  "interview_date",
]);

function missingRpc(error: { code?: string; message?: string } | null) {
  const msg = `${error?.code || ""} ${error?.message || ""}`;
  return /PGRST202|42883|does not exist|schema cache/i.test(msg);
}

export function contractorWorkTerritoryIds(contractor: {
  territory_id?: string | null;
  area_applications?: AreaApplication[] | null;
} | null): string[] {
  const ids = new Set<string>();
  if (contractor?.territory_id) ids.add(contractor.territory_id);
  for (const app of contractor?.area_applications || []) {
    const status = String(app.status || "").toLowerCase();
    if ((status === "active" || status === "hired") && app.territory_id) {
      ids.add(app.territory_id);
    }
  }
  return Array.from(ids);
}

export async function loadMyAreaApplications(): Promise<AreaApplication[]> {
  const { data, error } = await supabase.rpc("my_contractor_area_applications");
  if (error) {
    if (!missingRpc(error)) console.warn("area applications", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((row: any) => ({
    territory_id: row.territory_id,
    status: row.status,
    specialty: row.specialty,
    region: Array.isArray(row.region) ? row.region : [],
    drone_approved: row.drone_approved,
    training_completed: row.training_completed,
  }));
}

export async function listAreaApplications(territoryId: string): Promise<any[]> {
  const { data, error } = await supabase.rpc("list_contractor_area_applications", {
    p_territory: territoryId,
  });
  if (error) {
    if (!missingRpc(error)) console.warn("area application list", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function saveContractorOrArea(contractor: any, updates: Record<string, any>) {
  if (!contractor?.area_application_id) {
    return api.updateContractor(contractor.id, updates);
  }

  const areaUpdates: Record<string, any> = {};
  const personUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (AREA_FIELDS.has(key)) areaUpdates[key] = value;
    else personUpdates[key] = value;
  }

  if (Object.keys(areaUpdates).length > 0) {
    const { error } = await supabase.rpc("update_contractor_area_application", {
      p_id: contractor.area_application_id,
      p_updates: areaUpdates,
    });
    if (error) throw error;
  }
  if (Object.keys(personUpdates).length > 0) {
    await api.updateContractor(contractor.id, personUpdates);
  }
}

export async function deleteContractorOrArea(contractor: { id: string; area_application_id?: string | null }) {
  if (!contractor.area_application_id) {
    return api.deleteContractor(contractor.id);
  }
  const { error } = await supabase.rpc("delete_contractor_area_application", {
    p_id: contractor.area_application_id,
  });
  if (error) throw error;
}
