import { supabase } from "./supabase";
import { resolveTerritoryBySlug } from "./territory";
import {
  getPortalSettingsForTerritory,
  type ApplyPortalSettings,
} from "./apply-territory-settings";
import { api } from "./api";

export type PublicApply = {
  found: boolean;
  id: string | null;
  settings: ApplyPortalSettings | null;
  /** True when the database function is not installed yet. */
  legacy: boolean;
};

function missingRpc(error: { code?: string; message?: string } | null) {
  const msg = `${error?.code || ""} ${error?.message || ""}`;
  return /PGRST202|42883|does not exist|schema cache/i.test(msg);
}

function asSettings(row: any): ApplyPortalSettings {
  const regions = Array.isArray(row?.regions)
    ? row.regions.filter((region: unknown) => typeof region === "string" && region)
    : [];
  return {
    company_name: row?.company_name || null,
    logo_url: row?.logo_url || null,
    app_url: row?.app_url || null,
    regions,
    email_pipeline_rejected_enabled: row?.email_pipeline_rejected_enabled,
    email_pipeline_rejected_subject: row?.email_pipeline_rejected_subject,
    email_pipeline_rejected_template: row?.email_pipeline_rejected_template,
    sms_pipeline_rejected_enabled: row?.sms_pipeline_rejected_enabled,
    sms_pipeline_rejected_template: row?.sms_pipeline_rejected_template,
    email_applicant_welcome_enabled: row?.email_applicant_welcome_enabled,
    email_applicant_welcome_subject: row?.email_applicant_welcome_subject,
    email_applicant_welcome_template: row?.email_applicant_welcome_template,
    sms_applicant_welcome_enabled: row?.sms_applicant_welcome_enabled,
    sms_applicant_welcome_template: row?.sms_applicant_welcome_template,
  };
}

async function loadLegacyApply(slug?: string): Promise<PublicApply> {
  const territory = await resolveTerritoryBySlug(slug);
  if (!territory.found || !territory.id) {
    return { found: false, id: null, settings: null, legacy: true };
  }
  const settings = await getPortalSettingsForTerritory(territory.id);
  return { found: true, id: territory.id, settings, legacy: true };
}

/** Area name, logo, and regions for one public apply link. No secrets. */
export async function loadPublicApply(slug?: string): Promise<PublicApply> {
  const { data, error } = await supabase.rpc("get_public_apply", {
    p_slug: slug ?? "",
  });
  if (error) {
    if (missingRpc(error)) return loadLegacyApply(slug);
    console.warn("public apply lookup failed", error.message);
    return { found: false, id: null, settings: null, legacy: false };
  }
  const row = data as any;
  if (!row?.found || !row?.territory_id) {
    return { found: false, id: null, settings: null, legacy: false };
  }
  return {
    found: true,
    id: row.territory_id,
    settings: asSettings(row),
    legacy: false,
  };
}

export async function submitPublicApplication(input: {
  slug?: string;
  legacy: boolean;
  territoryId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialty: string;
  regions: string[];
  portfolioUrl: string;
  gearList: string;
  leadWeddings: number;
  trainingCompleted: boolean;
  userId: string;
}) {
  if (!input.legacy) {
    const { data, error } = await supabase.rpc("submit_public_application", {
      p_slug: input.slug ?? "",
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_email: input.email,
      p_phone: input.phone,
      p_specialty: input.specialty,
      p_regions: input.regions,
      p_portfolio_url: input.portfolioUrl,
      p_gear_list: input.gearList,
      p_lead_weddings: input.leadWeddings,
    });
    if (error) throw error;
    return data as { id: string; status: string; territory_id: string };
  }

  const status = input.leadWeddings < 3 ? "rejected" : "applied";
  const saved = await api.addContractor({
    id: input.userId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    status,
    specialty: input.specialty,
    region: input.regions,
    drone_approved: false,
    training_completed: input.trainingCompleted,
    portfolio_url: input.portfolioUrl,
    gear_list: input.gearList,
    territory_id: input.territoryId,
  } as any);
  return { id: saved.id, status, territory_id: input.territoryId };
}
