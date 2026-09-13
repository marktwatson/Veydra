import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export interface WebhookPayload {
  contactId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

export const processOvantaWebhook = async (payload: WebhookPayload) => {
  const {
    contactId,
    firstName,
    lastName,
    tags = [],
    customFields = {},
  } = payload;

  if (!contactId) {
    throw new Error("Missing contactId in payload");
  }

  const results: string[] = [];

  // 1. Check for Wedding Import
  if (
    tags.includes("bride") ||
    tags.includes("groom") ||
    tags.includes("wedding")
  ) {
    // DEDUPLICATION: Check if a wedding with this email already exists
    if (payload.email) {
      const { data: existing } = await supabase
        .from("weddings")
        .select("id")
        .eq("client_email", payload.email)
        .limit(1);
      if (existing && existing.length > 0) {
        results.push(
          `Wedding already exists for ${payload.email}. Skipping creation to prevent duplicate.`,
        );
        return results;
      }
    }
    const partnerName = customFields.partnerName || "";
    const weddingDate =
      customFields.weddingDate || new Date().toISOString().split("T")[0];
    const venue = customFields.venue || "TBD";
    const city = customFields.city || "";
    const state = customFields.state || "";
    const packageName = customFields.package || "Custom";
    const notes = customFields.notes || "";

    const clientName =
      `${firstName || ""} ${lastName || ""} & ${partnerName}`.trim();
    const location = `${venue}${city ? ", " + city : ""}${state ? ", " + state : ""}`;

    const fullNotes = `Package: ${packageName}\nCRM Contact ID: ${contactId}\nNotes: ${notes}`;

    try {
      await api.createWedding({
        client_name: clientName,
        date: weddingDate,
        location: location,
        status: "pending",
        notes: fullNotes,
      });
      results.push(`Successfully created pending wedding for ${clientName}`);
    } catch (err: any) {
      throw new Error(`Failed to create wedding: ${err.message}`);
    }
  }

  if (results.length === 0) {
    results.push(
      `Processed payload for ${contactId} but no relevant tags (bride/groom/wedding) found.`,
    );
  }

  return results;
};
