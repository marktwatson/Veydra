import { supabase } from "./supabase";
import { api } from "./api";

/**
 * Manually mark a proposal as booked: create/update the wedding, set proposal
 * status accepted, send welcome email + CRM contact tags. Extracted from
 * Proposals.tsx to keep the page under the edit cap.
 */
export async function markProposalAsBooked(
  proposal: any,
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toast: (t: any) => any;
    refresh: () => void;
    invalidateWeddings: () => void;
  },
): Promise<void> {
  try {
    const { data: settings } = await supabase
      .from("portal_settings")
      .select("*")
      .single();
    let weddingId = proposal.is_upgrade
      ? proposal.original_wedding_id
      : proposal.wedding_id;
    const customPlan =
      typeof proposal.custom_payment_plan === "string"
        ? JSON.parse(proposal.custom_payment_plan)
        : proposal.custom_payment_plan;
    const resolvedPaymentPlan =
      proposal.payment_plan || (customPlan?.enabled ? "custom" : null);
    const packageName = proposal.package_id
      ? proposal.package_id.charAt(0).toUpperCase() +
        proposal.package_id.slice(1)
      : "Custom";
    const coverageLabel =
      proposal.coverage_type === "photo"
        ? "Photo Only"
        : proposal.coverage_type === "video"
          ? "Video Only"
          : "Photo & Video";
    const packageString = `${packageName} (${coverageLabel})`;
    const effectiveTotalAmount =
      resolvedPaymentPlan === "full"
        ? proposal.total_amount * 0.95
        : proposal.total_amount;

    if (weddingId) {
      await supabase
        .from("weddings")
        .update({
          package: packageString,
          addons: proposal.addons,
          second_shooter_hours: proposal.second_shooter_hours,
          second_shooter_type: proposal.second_shooter_type,
          total_amount: effectiveTotalAmount,
          payment_plan: resolvedPaymentPlan,
          custom_payment_plan: customPlan,
          status: proposal.is_upgrade ? undefined : "pending",
          notes: proposal.is_upgrade
            ? `Upgraded Package (Manually Marked).\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`
            : `Manually Marked as Booked.\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`,
        })
        .eq("id", weddingId);
    } else {
      const { data: wedding, error: weddingError } = await supabase
        .from("weddings")
        .insert([
          {
            client_name: proposal.client_name,
            client_email: proposal.client_email,
            partner_name: proposal.partner_name,
            date: proposal.wedding_date,
            location:
              `${proposal.venue || ""} ${proposal.city || ""}, ${proposal.state || ""}`.trim(),
            package: packageString,
            addons: proposal.addons,
            second_shooter_hours: proposal.second_shooter_hours,
            second_shooter_type: proposal.second_shooter_type,
            status: "pending",
            payment_plan: resolvedPaymentPlan,
            custom_payment_plan: customPlan,
            total_amount: effectiveTotalAmount,
            paid_amount: 0,
            contract_date: new Date().toISOString(),
            notes: `Manually Marked as Booked.\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`,
          },
        ])
        .select()
        .single();
      if (weddingError) throw weddingError;
      if (wedding) weddingId = wedding.id;
    }

    if (weddingId) {
      const { error: propError } = await supabase
        .from("proposals")
        .update({ status: "accepted", wedding_id: weddingId })
        .eq("id", proposal.id);
      if (propError) throw propError;

      if (
        !proposal.is_upgrade &&
        settings?.email_bride_welcome_enabled &&
        settings?.email_bride_welcome_template &&
        proposal.client_email &&
        settings?.hl_api_key
      ) {
        const companyName = settings.company_name || "Company";
        let subject = (
          settings.email_bride_welcome_subject || "Welcome to the Family!"
        ).replace(/{{company_name}}/g, companyName);
        let msg = settings.email_bride_welcome_template
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{logo_url}}/g, settings.logo_url || "")
          .replace(/{{bride_name}}/g, proposal.client_name)
          .replace(
            /{{portal_link}}/g,
            `${settings.app_url || window.location.origin}/bride-portal/${weddingId}`,
          );
        await fetch(
          `https://services.leadconnectorhq.com/conversations/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.hl_api_key}`,
              Version: "2021-04-15",
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              email: proposal.client_email,
              type: "Email",
              subject,
              html: msg,
            }),
          },
        ).catch(console.error);
      }

      if (
        settings?.hl_api_key &&
        settings?.hl_location_id &&
        proposal.client_email
      ) {
        const headers = {
          Authorization: `Bearer ${settings.hl_api_key}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
        };
        try {
          const searchRes = await fetch(
            `https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(proposal.client_email)}`,
            { headers },
          );
          const searchData = await searchRes.json();
          let contactId = searchData.contacts?.[0]?.id;
          if (!contactId) {
            const createPayload: any = {
              locationId: settings.hl_location_id,
              email: proposal.client_email,
              name: proposal.client_name || "",
              tags: ["booked", "payment-received"],
            };
            if (proposal.client_name) {
              const parts = proposal.client_name.trim().split(" ");
              createPayload.firstName = parts[0];
              if (parts.length > 1)
                createPayload.lastName = parts.slice(1).join(" ");
            }
            const createRes = await fetch(
              `https://services.leadconnectorhq.com/contacts/`,
              {
                method: "POST",
                headers,
                body: JSON.stringify(createPayload),
              },
            );
            const createData = await createRes.json();
            contactId = createData.contact?.id;
          }
          if (contactId) {
            const existingTags = searchData.contacts?.[0]?.tags || [];
            const newTags = Array.from(
              new Set([...existingTags, "booked", "payment-received"]),
            );
            const putRes = await fetch(
              `https://services.leadconnectorhq.com/contacts/${contactId}`,
              {
                method: "PUT",
                headers,
                body: JSON.stringify({ tags: newTags }),
              },
            );
            if (!putRes.ok)
              console.error("CRM Sync Error on PUT:", await putRes.text());
          }
        } catch (e) {
          console.error("CRM Sync Error:", e);
        }
      }
    }

    api.logAdminActivity(
      "Proposal Manually Booked",
      `Marked proposal for ${proposal.client_name} as booked`,
    );
    callbacks.toast({
      title: "Success",
      description: "Proposal marked as booked and wedding created!",
    });
    callbacks.invalidateWeddings();
    callbacks.refresh();
  } catch (error: any) {
    console.error("Error marking as booked:", error);
    api.logAdminActivity(
      "Proposal Booking Error",
      `Failed to manually book proposal for ${proposal.client_name}: ${error.message}`,
    );
    callbacks.toast({
      title: "Error",
      description: "Failed to mark as booked: " + error.message,
      variant: "destructive",
    });
  }
}
