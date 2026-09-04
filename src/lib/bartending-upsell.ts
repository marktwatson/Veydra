import { supabase } from "./supabase";

export async function processBartendingUpsell(
  api: any,
  {
    wedding,
    addon,
    discount: _discount,
    totalDue,
    deposit,
    installments,
  }: {
    wedding: any;
    addon: any;
    discount: number;
    totalDue: number;
    deposit: number;
    installments: any[];
    settings?: any;
  },
) {
  if (!wedding?.id) throw new Error("Wedding not found");
  if (!addon) throw new Error("No add-on selected");

  let chargeResult: any = null;

  // 1. Charge the card on file if deposit > 0
  if (deposit > 0) {
    const customerId = wedding.stripe_customer_id;
    if (!customerId) {
      throw new Error(
        "No card on file. The bride needs a saved payment method before charging.",
      );
    }
    chargeResult = await api.chargeSavedCard({
      weddingId: wedding.id,
      amount: deposit,
      description: `Bartending add-on deposit — ${addon.name}`,
    });
  }

  // Build payment schedule snapshot (deposit + future installments)
  const scheduleEntries: any[] = [];
  if (deposit > 0) {
    scheduleEntries.push({
      label: "Deposit",
      amount: deposit,
      date: new Date().toISOString().split("T")[0],
      status: "paid",
    });
  }
  for (const inst of installments || []) {
    scheduleEntries.push({
      label: inst.label || `Installment`,
      amount: Number(inst.amount) || 0,
      date: inst.date || "",
      status: "scheduled",
    });
  }

  // 2. Insert upsell_purchases row
  const { data: insertData, error: insertError } = await supabase
    .from("upsell_purchases")
    .insert({
      wedding_id: wedding.id,
      service: "bartending",
      package_name: addon.name,
      amount: totalDue,
      list_price: addon.price || totalDue,
      discount_amount: _discount || 0,
      deposit_amount: deposit || 0,
      status: deposit > 0 ? "deposit_paid" : "scheduled",
      contract_status: "sent",
      stripe_payment_intent_id:
        chargeResult?.data?.paymentIntentId || chargeResult?.data?.id || null,
      stripe_charge_id:
        chargeResult?.data?.chargeId || chargeResult?.data?.id || null,
      stripe_customer_id: wedding.stripe_customer_id || null,
      purchased_at: new Date().toISOString(),
      package_details: {
        name: addon.name,
        price: addon.price || totalDue,
        description: addon.description || "",
        features: addon.features || [],
      },
      payment_schedule: scheduleEntries,
    })
    .select()
    .single();
  if (insertError) {
    console.error("[upsell] insert error:", insertError);
    throw new Error(
      `Could not save the bartending purchase record: ${insertError.message}`,
    );
  }

  // 3. Update weddings: addons, total_amount, paid_amount, custom_payment_plan
  const existingAddons = Array.isArray(wedding.addons)
    ? wedding.addons
    : typeof wedding.addons === "string"
      ? (() => {
          try {
            return JSON.parse(wedding.addons);
          } catch {
            return [];
          }
        })()
      : [];
  const newAddons = [...existingAddons, `Bartending: ${addon.name}`];

  const newTotal = (Number(wedding.total_amount) || 0) + totalDue;
  const newPaid =
    (Number(wedding.paid_amount) || 0) + (deposit > 0 ? deposit : 0);

  let existingPlan: any =
    typeof wedding.custom_payment_plan === "string"
      ? (() => {
          try {
            return JSON.parse(wedding.custom_payment_plan);
          } catch {
            return null;
          }
        })()
      : wedding.custom_payment_plan;
  if (!existingPlan || typeof existingPlan !== "object") {
    existingPlan = { enabled: true, deposit: 0, installments: [] };
  }
  if (!Array.isArray(existingPlan.installments)) existingPlan.installments = [];

  const bartendingInstallments = (installments || []).map(
    (inst: any, idx: number) => ({
      date: inst.date || "",
      amount: Number(inst.amount) || 0,
      label: `Bartending — ${inst.label || `Installment #${idx + 1}`}`,
      _bartending: true,
    }),
  );
  existingPlan.installments = [
    ...existingPlan.installments,
    ...bartendingInstallments,
  ];
  if (deposit > 0) {
    existingPlan.installments.unshift({
      date: new Date().toISOString().split("T")[0],
      amount: deposit,
      label: `Bartending — Deposit (${addon.name})`,
      status: "paid",
      _bartending: true,
    });
  }

  const { error: updateError } = await supabase
    .from("weddings")
    .update({
      addons: newAddons,
      total_amount: newTotal,
      paid_amount: newPaid,
      custom_payment_plan: existingPlan,
    })
    .eq("id", wedding.id);
  if (updateError) {
    console.error("[upsell] wedding update error:", updateError);
    throw new Error(
      "Failed to update wedding record. Please check and try again.",
    );
  }

  return {
    success: true,
    purchaseId: insertData?.id || null,
    depositCharged: deposit > 0,
    chargeResult,
    newTotal,
    newPaid,
  };
}
