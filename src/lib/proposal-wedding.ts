import { supabase } from "./supabase";

/**
 * Ensure a weddings row exists for a proposal and return its id.
 *
 * Reuses an existing wedding (proposal.wedding_id or, for upgrades,
 * proposal.original_wedding_id); otherwise inserts a fresh pending wedding
 * and links it back onto the proposal. This mirrors the create/update logic in
 * api.fulfillProposalPayment but does NOT mark the proposal accepted/paid or
 * tag the CRM contact — it is used by the Sign & Pay flow so we have a real
 * weddings.id to attach a GHL invoice to BEFORE any payment posts.
 */
export async function ensureWeddingForProposal(
  proposalId: string,
): Promise<string | null> {
  try {
    const { data: proposal } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", proposalId)
      .single();
    if (!proposal) return null;

    let weddingId = proposal.is_upgrade
      ? proposal.original_wedding_id || proposal.wedding_id
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

    if (weddingId) {
      // For upgrades, don't clobber an existing custom_payment_plan — let the
      // addon invoice carry the unpaid delta instead. Only write the plan
      // when the wedding doesn't already have one.
      const { data: existingWedding } = await supabase
        .from("weddings")
        .select("custom_payment_plan")
        .eq("id", weddingId)
        .maybeSingle();
      const hasExistingPlan =
        existingWedding?.custom_payment_plan != null &&
        existingWedding?.custom_payment_plan !== "";

      const update: any = {
        package: packageString,
        addons: proposal.addons,
        second_shooter_hours: proposal.second_shooter_hours,
        second_shooter_type: proposal.second_shooter_type,
        total_amount: proposal.total_amount,
        payment_plan: resolvedPaymentPlan,
      };
      if (!hasExistingPlan) {
        update.custom_payment_plan = customPlan;
      }
      await supabase.from("weddings").update(update).eq("id", weddingId);
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
            total_amount: proposal.total_amount,
            paid_amount: 0,
            contract_date: new Date().toISOString(),
            notes: `Booked via Portal.\nPhone: ${proposal.client_phone || "N/A"}\n${proposal.notes || ""}`,
          },
        ])
        .select()
        .single();

      if (weddingError) throw weddingError;
      if (wedding) weddingId = wedding.id;
    }

    if (weddingId && weddingId !== proposal.wedding_id) {
      await supabase
        .from("proposals")
        .update({ wedding_id: weddingId })
        .eq("id", proposal.id);
    }

    return weddingId || null;
  } catch (error) {
    console.error("Failed to ensure wedding for proposal:", error);
    return null;
  }
}
