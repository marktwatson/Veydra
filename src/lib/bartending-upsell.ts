import { supabase } from "./supabase";
import { createGhlInvoice } from "./ghl-invoice-api";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export async function processBartendingUpsell(
  _api: any,
  {
    wedding,
    addon,
    discount,
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

  // a) Build bar rows. Deposit (if > 0) is the first installment today.
  //    Sum MUST equal totalDue (±0.01).
  const barRows: { date: string; amount: number; label?: string }[] = [];
  if (deposit > 0) {
    barRows.push({ date: todayStr(), amount: deposit, label: "Deposit" });
  }
  for (const inst of installments || []) {
    const amt = Number(inst.amount) || 0;
    if (amt <= 0) continue;
    barRows.push({
      date: inst.date || todayStr(),
      amount: amt,
      label: inst.label || "Installment",
    });
  }
  if (barRows.length === 0) {
    barRows.push({
      date: todayStr(),
      amount: totalDue,
      label: "Payment in full",
    });
  }

  const barSum = barRows.reduce((s, r) => s + r.amount, 0);
  if (Math.abs(barSum - totalDue) > 0.01) {
    throw new Error(
      `Bartending installments (${barSum.toFixed(2)}) must equal the total due (${totalDue.toFixed(2)}).`,
    );
  }

  // b) Create the GHL invoice (kind: addon, forceNew). No Stripe.
  //    If this fails, throw — do NOT insert upsell_purchases.
  const invoiceResult = await createGhlInvoice({
    weddingId: wedding.id,
    amount: totalDue,
    label: `Bartending — ${addon.name}`,
    kind: "addon",
    forceNew: true,
    installments: barRows,
  });

  // Build payment schedule snapshot for the upsell record.
  const scheduleEntries = barRows.map((r) => ({
    label: r.label || "Installment",
    amount: r.amount,
    date: r.date,
    status: r.date === todayStr() ? "invoiced" : "scheduled",
  }));

  // c) Insert upsell_purchases row — status "invoiced", no Stripe fields.
  const { data: insertData, error: insertError } = await supabase
    .from("upsell_purchases")
    .insert({
      wedding_id: wedding.id,
      service: "bartending",
      package_name: addon.name,
      amount: totalDue,
      list_price: addon.price || totalDue,
      discount_amount: discount || 0,
      deposit_amount: deposit || 0,
      status: "invoiced",
      contract_status: "sent",
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      stripe_customer_id: null,
      purchased_at: new Date().toISOString(),
      package_details: {
        name: addon.name,
        price: addon.price || totalDue,
        description: addon.description || "",
        features: addon.features || [],
        ghl_invoice_id: invoiceResult.invoiceId,
        ghl_invoice_url: invoiceResult.invoiceUrl,
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

  // d) Update weddings: addons + total_amount. Do NOT change paid_amount
  //    (the webhook adds the delta when the bride pays). Do NOT write
  //    bartending rows into custom_payment_plan.
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

  const { error: updateError } = await supabase
    .from("weddings")
    .update({
      addons: newAddons,
      total_amount: newTotal,
    })
    .eq("id", wedding.id);
  if (updateError) {
    console.error("[upsell] wedding update error:", updateError);
    throw new Error(
      "Failed to update wedding record. Please check and try again.",
    );
  }

  // e) Insert ONE unassigned Bartender job if none exists for this wedding.
  //    Do not assign anyone. Do not create a second row.
  try {
    const { data: existingBarJobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("wedding_id", wedding.id)
      .ilike("role", "Bartender");
    if (!existingBarJobs || existingBarJobs.length === 0) {
      await supabase.from("jobs").insert({
        wedding_id: wedding.id,
        role: "Bartender",
        status: "open",
        pay_type: "flat",
        pay_rate: 0,
        hours: null,
        addons: [],
        requirements: "",
      });
    }
  } catch (jobErr) {
    // Non-fatal: the upsell + invoice already succeeded.
    console.warn("[upsell] could not auto-insert Bartender job:", jobErr);
  }

  return {
    success: true,
    purchaseId: insertData?.id || null,
    invoiceUrl: invoiceResult.invoiceUrl,
    invoiceId: invoiceResult.invoiceId,
    newTotal,
  };
}
