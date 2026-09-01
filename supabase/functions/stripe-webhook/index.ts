import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "jsr:@supabase/supabase-js";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Fire-and-forget push to owners + super_admins. Best-effort, never throws.
async function notifyOwnersPush(su: string, sk: string, category: string, title: string, body: string, url = "/manager", tag?: string) {
  try {
    await fetch(`${su}/functions/v1/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sk}`, apikey: sk },
      body: JSON.stringify({ action: "send", roles: ["owner", "super_admin"], category, title, body, url, tag }),
    });
  } catch (e) { console.error("[PUSH] failed:", (e as any)?.message); }
}

const lcHeaders = (key: string) => ({ "Authorization": `Bearer ${key}`, "Version": "2021-07-28", "Content-Type": "application/json", "Accept": "application/json" });

async function findLcContact(email: string, key: string, loc: string): Promise<string | null> {
  try {
    const r = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${loc}&query=${encodeURIComponent(email)}`, { headers: lcHeaders(key) });
    if (!r.ok) return null;
    return (await r.json()).contacts?.[0]?.id || null;
  } catch { return null; }
}

async function sendLcMessage(email: string, type: "Email" | "SMS", payload: any, key: string, loc: string) {
  if (!key || !loc || !email) return false;
  const contactId = await findLcContact(email, key, loc);
  if (!contactId) return false;
  try {
    const r = await fetch(`https://services.leadconnectorhq.com/conversations/messages`, {
      method: "POST", headers: { ...lcHeaders(key), "Version": "2021-04-15" },
      body: JSON.stringify({ contactId, type, ...payload }),
    });
    return r.ok;
  } catch { return false; }
}

const sendOvantaEmail = (email: string, subject: string, message: string, key: string, loc: string) => {
  let html = message;
  if (!html.includes("<!DOCTYPE html>") && !html.includes("<html")) {
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${message}</body></html>`;
  }
  return sendLcMessage(email, "Email", { subject, html }, key, loc);
};
const sendOvantaSms = (email: string, message: string, key: string, loc: string) => sendLcMessage(email, "SMS", { message }, key, loc);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  try {
    const body = await req.text();
    const event = (endpointSecret && signature) ? stripe.webhooks.constructEvent(body, signature, endpointSecret) : JSON.parse(body);

    const su = Deno.env.get("SUPABASE_URL") || "";
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!su || !sk) return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), { status: 500 });
    const supabase = createClient(su, sk);

    const { data: settings } = await supabase.from('portal_settings').select('*').single();
    const hlKey = settings?.hl_api_key || "";
    const hlLoc = settings?.hl_location_id || "";

    const syncToCRM = async (wedding: any, amount: number, type: string) => {
      if (!hlKey || !hlLoc || !wedding.client_email) return;
      try {
        const contactId = await findLcContact(wedding.client_email, hlKey, hlLoc);
        let cid = contactId;
        if (!cid) {
          const tags = ["booked", "payment-received"];
          if (type === 'gift') tags.push("gift-received"); else if (type === 'subscription') tags.push("subscription-payment");
          const cp: any = { locationId: hlLoc, email: wedding.client_email, name: wedding.client_name || "", tags };
          if (wedding.client_name) { const p = wedding.client_name.trim().split(" "); cp.firstName = p[0]; if (p.length > 1) cp.lastName = p.slice(1).join(" "); }
          const cr = await fetch(`https://services.leadconnectorhq.com/contacts/`, { method: "POST", headers: lcHeaders(hlKey), body: JSON.stringify(cp) });
          cid = (await cr.json()).contact?.id;
        }
        if (cid) {
          const existing = (await (await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${hlLoc}&query=${encodeURIComponent(wedding.client_email)}`, { headers: lcHeaders(hlKey) })).json()).contacts?.[0]?.tags || [];
          const newTags = new Set([...existing, "booked", "payment-received"]);
          if (type === 'gift') newTags.add("gift-received"); else if (type === 'subscription') newTags.add("subscription-payment");
          await fetch(`https://services.leadconnectorhq.com/contacts/${cid}`, { method: "PUT", headers: lcHeaders(hlKey), body: JSON.stringify({ tags: Array.from(newTags) }) });
        }
      } catch (e) { console.error("CRM Sync Error:", e); }
    };

    const recordRoyaltySale = async (weddingId: string | null, amount: number, description: string, isRefund = false) => {
      if (!amount || amount <= 0) return;
      try {
        let territory: any = null;
        const { data: primaryTerr } = await supabase.from("territories").select("id").eq("is_primary", true).limit(1).maybeSingle();
        if (primaryTerr?.id) territory = primaryTerr;
        else { const { data: anyTerr } = await supabase.from("territories").select("id").limit(1).maybeSingle(); if (anyTerr?.id) { territory = anyTerr; console.warn("[ROYALTY] No is_primary territory — using first row."); } }
        if (!territory?.id) { console.warn(`[ROYALTY] SKIPPED ${isRefund ? "refund" : "sale"} $${amount} — no territory.`); return; }
        await supabase.from("royalty_sales").insert({ territory_id: territory.id, wedding_id: weddingId || null, sale_amount: Math.abs(amount), sale_date: new Date().toISOString().split("T")[0], description, is_refund: isRefund });
      } catch (e) { console.error("[ROYALTY] Failed:", (e as any)?.message); }
    };

    const autoVerifyFinalPayment = async (weddingId: string, paid: number, total: number) => {
      const t = Number(total) || 0, p = Number(paid) || 0;
      if (t > 0 && p >= t - 0.01 && p > 0) { await supabase.from("weddings").update({ final_payment_verified: true }).eq("id", weddingId); }
    };

    const sendAdminBookingNotification = async (clientName: string, clientEmail: string, weddingDate: string, venue: string, packageName: string, amountPaid: number, weddingId: string) => {
      const adminEmails = (settings?.admin_notification_emails || "").split(/[,\s]+/).map((e: string) => e.trim()).filter(Boolean);
      if (adminEmails.length === 0) return;
      const appUrl = settings?.app_url || "https://veydra.app";
      const fmtDate = weddingDate ? new Date(weddingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A";
      const vars: Record<string, string> = { "{{company_name}}": settings?.company_name || "Veydra", "{{bride_name}}": clientName || "Client", "{{client_name}}": clientName || "Client", "{{client_email}}": clientEmail || "N/A", "{{wedding_date}}": fmtDate, "{{venue}}": venue || "N/A", "{{package_name}}": packageName || "N/A", "{{amount}}": amountPaid.toFixed(2), "{{wedding_id}}": weddingId, "{{portal_link}}": `${appUrl}/bride-portal/${weddingId}` };
      const replaceVars = (text: string) => { let r = text; for (const [k, v] of Object.entries(vars)) r = r.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v); return r; };
      if (settings?.sms_admin_booking_enabled && settings?.sms_admin_booking_template) { const m = replaceVars(settings.sms_admin_booking_template); for (const e of adminEmails) { try { await sendOvantaSms(e, m, hlKey, hlLoc); } catch {} } }
      if (settings?.email_admin_booking_enabled && settings?.email_admin_booking_template) { const s = replaceVars(settings.email_admin_booking_subject || "New Booking Received!"); const h = replaceVars(settings.email_admin_booking_template); for (const e of adminEmails) { try { await sendOvantaEmail(e, s, h, hlKey, hlLoc); } catch {} } }
    };

    const sendBrideWelcome = async (email: string, name: string, weddingId: string) => {
      if (!settings?.email_bride_welcome_enabled || !settings?.email_bride_welcome_template || !email) return;
      const cn = settings.company_name || "Company";
      const s = (settings.email_bride_welcome_subject || "Welcome to the Family!").replace(/{{company_name}}/g, cn);
      const m = settings.email_bride_welcome_template.replace(/{{company_name}}/g, cn).replace(/{{logo_url}}/g, settings.logo_url || "").replace(/{{bride_name}}/g, name).replace(/{{portal_link}}/g, `${settings.app_url || "https://veydra.app"}/bride-portal/${weddingId}`);
      await sendOvantaEmail(email, s, m, hlKey, hlLoc);
    };

    const fulfillProposal = async (proposalId: string, customerId: string, subscriptionId: string, amountPaid: number, metadata: any) => {
      const { data: proposal } = await supabase.from("proposals").select("*").eq("id", proposalId).single();
      if (!proposal) return;
      let weddingId = proposal.original_wedding_id;
      const paymentPlan = metadata.paymentOption || proposal.payment_plan || "full";
      if (proposal.status === "accepted" || proposal.status === "paid") {
        weddingId = proposal.wedding_id || weddingId;
        if (weddingId) { const { data: w } = await supabase.from("weddings").select("*").eq("id", weddingId).single(); if (w) await syncToCRM(w, 0, 'payment'); }
        return;
      }
      const packageName = proposal.package_id ? (proposal.package_id.charAt(0).toUpperCase() + proposal.package_id.slice(1)) : "Custom";
      const coverageLabel = proposal.coverage_type === 'photo' ? 'Photo Only' : proposal.coverage_type === 'video' ? 'Video Only' : 'Photo & Video';
      const packageString = `${packageName} (${coverageLabel})`;
      if (proposal.is_upgrade && weddingId) {
        await supabase.from("weddings").update({ package: packageString, addons: proposal.addons, second_shooter_hours: proposal.second_shooter_hours, second_shooter_type: proposal.second_shooter_type, total_amount: paymentPlan === "full" ? proposal.total_amount * 0.95 : proposal.total_amount, paid_amount: (proposal.amount_paid_so_far || 0) + amountPaid, payment_plan: paymentPlan, custom_payment_plan: proposal.custom_payment_plan, notes: `Upgraded Package.\nPhone: ${proposal.client_phone || 'N/A'}\n${proposal.notes || ''}` + (paymentPlan === "custom" ? `\n\nCustom Payment Plan:\n${JSON.stringify(proposal.custom_payment_plan)}` : "") }).eq("id", weddingId);
      } else {
        const { data: wedding, error: wErr } = await supabase.from("weddings").insert([{ client_name: proposal.client_name, client_email: proposal.client_email, partner_name: proposal.partner_name, date: proposal.wedding_date, location: `${proposal.venue || ''} ${proposal.city || ''}, ${proposal.state || ''}`.trim(), package: packageString, addons: proposal.addons, contract_date: new Date().toISOString(), second_shooter_hours: proposal.second_shooter_hours, second_shooter_type: proposal.second_shooter_type, status: "pending", payment_plan: paymentPlan, custom_payment_plan: proposal.custom_payment_plan, total_amount: paymentPlan === "full" ? proposal.total_amount * 0.95 : proposal.total_amount, paid_amount: amountPaid, notes: `Phone: ${proposal.client_phone || 'N/A'}\n${proposal.notes || ''}` + (paymentPlan === "custom" ? `\n\nCustom Payment Plan:\n${JSON.stringify(proposal.custom_payment_plan)}` : ""), stripe_customer_id: customerId, stripe_subscription_id: subscriptionId || null }]).select().single();
        if (!wErr && wedding) weddingId = wedding.id;
      }
      if (weddingId) {
        await supabase.from("proposals").update({ status: "accepted", wedding_id: weddingId, payment_plan: paymentPlan }).eq("id", proposal.id);
        await sendBrideWelcome(proposal.client_email, proposal.client_name, weddingId);
        await sendAdminBookingNotification(proposal.client_name, proposal.client_email, proposal.wedding_date, proposal.venue, packageString, amountPaid, weddingId);
        const { data: uw } = await supabase.from("weddings").select("*").eq("id", weddingId).single();
        if (uw) await syncToCRM(uw, 0, 'payment');
        if (amountPaid > 0) await recordRoyaltySale(weddingId, amountPaid, `Proposal payment — ${proposal.client_name || "client"}`);
        await notifyOwnersPush(su, sk, "bookings_payments", "New Booking — " + (proposal.client_name || "Client"), `$${amountPaid.toFixed(0)} received · ${packageString}`, "/manager/weddings", `booking-${weddingId}`);
      }
    };

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
          const custId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
          const amountPaid = invoice.amount_paid / 100;
          if (amountPaid > 0) {
            let subscription;
            try { subscription = await stripe.subscriptions.retrieve(subId); } catch (e) { console.error("Failed to retrieve subscription:", e); }
            const proposalId = subscription?.metadata?.proposalId;
            const wId = subscription?.metadata?.weddingId;
            if (proposalId) { await fulfillProposal(proposalId, custId || "", subId, amountPaid, subscription?.metadata || {}); }
            else if (wId) {
              const { data: wedding, error: fe } = await supabase.from('weddings').select('*').eq('id', wId).single();
              if (fe) console.error(`[WEBHOOK] fetch failed ${wId}:`, fe.message);
              if (wedding) {
                const isFirst = (wedding.paid_amount || 0) === 0;
                const newPaid = (wedding.paid_amount || 0) + amountPaid;
                const up: any = { paid_amount: newPaid, stripe_customer_id: custId, stripe_subscription_id: subId };
                if (wedding.notes?.includes('[UNPAID_DRAFT]')) { up.notes = wedding.notes.replace('[UNPAID_DRAFT]\n', '').replace('[UNPAID_DRAFT]', ''); up.status = 'pending'; up.contract_date = new Date().toISOString(); }
                const { error: ue } = await supabase.from('weddings').update(up).eq('id', wId);
                if (ue) console.error(`[WEBHOOK] update failed ${wId}:`, ue.message);
                await syncToCRM(wedding, amountPaid, 'subscription');
                await recordRoyaltySale(wId, amountPaid, `Invoice payment — ${wedding.client_name || "client"}`);
                await autoVerifyFinalPayment(wId, newPaid, wedding.total_amount);
                if (isFirst) { await sendBrideWelcome(wedding.client_email, wedding.client_name, wedding.id); await sendAdminBookingNotification(wedding.client_name, wedding.client_email, wedding.date, wedding.location, wedding.package, amountPaid, wedding.id); await notifyOwnersPush(su, sk, "bookings_payments", "New Booking — " + (wedding.client_name || "Client"), `$${amountPaid.toFixed(0)} received · ${wedding.package || "Package"}`, "/manager/weddings", `booking-${wedding.id}`); }
                else { await notifyOwnersPush(su, sk, "bookings_payments", "Payment Received — " + (wedding.client_name || "Client"), `$${amountPaid.toFixed(0)} · Balance $${Math.max(0, (Number(wedding.total_amount) || 0) - newPaid).toFixed(0)}`, "/manager/weddings", `payment-${wedding.id}`); }
              }
            }
            if (!proposalId && !wId) {
              let { data: weddings } = await supabase.from('weddings').select('*').eq('stripe_subscription_id', subId);
              if (!weddings || weddings.length === 0) { const { data: cw } = await supabase.from('weddings').select('*').eq('stripe_customer_id', custId); weddings = cw || []; }
              if (weddings && weddings.length > 0) {
                const w = weddings[0]; const newPaid = (w.paid_amount || 0) + amountPaid; const up: any = { paid_amount: newPaid };
                if (!w.stripe_customer_id && custId) up.stripe_customer_id = custId;
                if (!w.stripe_subscription_id && subId) up.stripe_subscription_id = subId;
                const { error: fue } = await supabase.from('weddings').update(up).eq('id', w.id);
                if (fue) console.error(`[WEBHOOK] fallback update failed ${w.id}:`, fue.message);
              }
            }
          }
        }
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object;
        const wId = session.metadata?.weddingId; const type = session.metadata?.type; const amountPaid = session.amount_total / 100;
        const upsellPkgName = (session.metadata?.packageName as string) || 'Bartending Add-On';
        if (wId && (type === 'gift' || type === 'payment' || type === 'upsell')) {
          const { data: wedding } = await supabase.from('weddings').select('*').eq('id', wId).single();
          if (wedding) {
            const newPaid = (wedding.paid_amount || 0) + amountPaid;
            await supabase.from('weddings').update({ paid_amount: newPaid }).eq('id', wId);
            await syncToCRM(wedding, amountPaid, type);
            if (type === 'payment') { await recordRoyaltySale(wId, amountPaid, `Checkout payment — ${wedding.client_name || "client"}`); await autoVerifyFinalPayment(wId, newPaid, wedding.total_amount); await notifyOwnersPush(su, sk, "bookings_payments", "Payment Received — " + (wedding.client_name || "Client"), `$${amountPaid.toFixed(0)} · Balance $${Math.max(0, (Number(wedding.total_amount) || 0) - newPaid).toFixed(0)}`, "/manager/weddings", `payment-${wedding.id}`); }
            else if (type === 'upsell') {
              await recordRoyaltySale(wId, amountPaid, `Bartending add-on — ${wedding.client_name || "client"}`);
              // Record the upsell purchase row
              try {
                await supabase.from('upsell_purchases').insert({
                  wedding_id: wId,
                  service: 'bartending',
                  package_name: upsellPkgName,
                  amount: amountPaid,
                  status: 'paid',
                  stripe_checkout_session_id: session.id,
                  stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
                  stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || wedding.stripe_customer_id || null,
                });
              } catch (e) { console.error('[WEBHOOK] upsell purchase insert failed:', (e as any)?.message); }
              await notifyOwnersPush(su, sk, "bookings_payments", "Bartending Add-On Purchased — " + (wedding.client_name || "Client"), `$${amountPaid.toFixed(0)} · ${upsellPkgName}`, "/manager/weddings", `upsell-${wedding.id}`);
            }
            else { await notifyOwnersPush(su, sk, "bookings_payments", "Gift Received — " + (wedding.client_name || "Client"), `$${amountPaid.toFixed(0)} gift applied`, "/manager/weddings", `gift-${wedding.id}`); }
            if (type === 'gift' && hlKey && hlLoc && wedding.client_email) {
              const appUrl = settings.app_url || "https://veydra.app"; const portalLink = `${appUrl}/bride-portal/${wedding.id}`; const cn = settings.company_name || "Company"; const logoUrl = settings.logo_url || "";
              if (settings.email_bride_gift_enabled && settings.email_bride_gift_template) { let s = (settings.email_bride_gift_subject || "You received a gift!").replace(/{{company_name}}/g, cn); let m = settings.email_bride_gift_template.replace(/{{company_name}}/g, cn).replace(/{{logo_url}}/g, logoUrl).replace(/{{bride_name}}/g, wedding.client_name || "Bride").replace(/{{amount}}/g, amountPaid.toFixed(2)).replace(/{{portal_link}}/g, portalLink); await sendOvantaEmail(wedding.client_email, s, m, hlKey, hlLoc); }
              if (settings.sms_bride_gift_enabled && settings.sms_bride_gift_template) { let m = settings.sms_bride_gift_template.replace(/{{company_name}}/g, cn).replace(/{{bride_name}}/g, wedding.client_name || "Bride").replace(/{{amount}}/g, amountPaid.toFixed(2)).replace(/{{portal_link}}/g, portalLink); await sendOvantaSms(wedding.client_email, m, hlKey, hlLoc); }
            }
          }
        }
        break;
      }
      case 'setup_intent.succeeded':
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        const couponId = intent.metadata?.couponId; const proposalId = intent.metadata?.proposalId;
        const custId = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id;
        const amountPaid = event.type === 'setup_intent.succeeded' ? 0 : (intent.amount_received / 100);
        if (custId && intent.payment_method) { try { const pmId = typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method.id; await stripe.customers.update(custId, { invoice_settings: { default_payment_method: pmId } }); } catch (e) { console.error("Failed to update customer default PM:", e); } }
        const wId = intent.metadata?.weddingId;
        if (proposalId) { await fulfillProposal(proposalId, custId || "", "", amountPaid, intent.metadata); }
        else if (wId) {
          const { data: wedding, error: fe } = await supabase.from('weddings').select('*').eq('id', wId).single();
          if (fe) console.error(`[WEBHOOK] fetch failed ${wId}:`, fe.message);
          if (wedding) {
            const isFirst = (wedding.paid_amount || 0) === 0; const newPaid = (wedding.paid_amount || 0) + amountPaid;
            const up: any = { paid_amount: newPaid, stripe_customer_id: custId };
            if (wedding.notes?.includes('[UNPAID_DRAFT]')) { up.notes = wedding.notes.replace('[UNPAID_DRAFT]\n', '').replace('[UNPAID_DRAFT]', ''); up.status = 'pending'; up.contract_date = new Date().toISOString(); }
            const { error: ue } = await supabase.from('weddings').update(up).eq('id', wId);
            if (ue) console.error(`[WEBHOOK] update failed ${wId}:`, ue.message);
            await syncToCRM(wedding, amountPaid, 'payment');
            await recordRoyaltySale(wId, amountPaid, `Payment intent — ${wedding.client_name || "client"}`);
            await autoVerifyFinalPayment(wId, newPaid, wedding.total_amount);
            if (isFirst) { await sendBrideWelcome(wedding.client_email, wedding.client_name, wedding.id); await sendAdminBookingNotification(wedding.client_name, wedding.client_email, wedding.date, wedding.location, wedding.package, amountPaid, wedding.id); await notifyOwnersPush(su, sk, "bookings_payments", "New Booking — " + (wedding.client_name || "Client"), `$${amountPaid.toFixed(0)} received · ${wedding.package || "Package"}`, "/manager/weddings", `booking-${wedding.id}`); }
            else { await notifyOwnersPush(su, sk, "bookings_payments", "Payment Received — " + (wedding.client_name || "Client"), `$${amountPaid.toFixed(0)} · Balance $${Math.max(0, (Number(wedding.total_amount) || 0) - newPaid).toFixed(0)}`, "/manager/weddings", `payment-${wedding.id}`); }
          }
        }
        if (couponId) { try { const { data: c } = await supabase.from('coupons').select('current_uses').eq('id', couponId).single(); if (c) await supabase.from('coupons').update({ current_uses: (c.current_uses || 0) + 1 }).eq('id', couponId); } catch (e) { console.error("Failed to increment coupon:", e); } }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
          await supabase.from('weddings').update({ stripe_subscription_status: 'past_due' }).eq('stripe_subscription_id', subId);
          const { data: wedding } = await supabase.from('weddings').select('*').eq('stripe_subscription_id', subId).single();
          if (wedding?.client_email && hlKey) { const cid = await findLcContact(wedding.client_email, hlKey, hlLoc); if (cid) await fetch(`https://services.leadconnectorhq.com/contacts/${cid}`, { method: "PUT", headers: lcHeaders(hlKey), body: JSON.stringify({ tags: ["payment-failed"] }) }); }
          if (wedding) await notifyOwnersPush(su, sk, "bookings_payments", "Payment Failed — " + (wedding.client_name || "Client"), `Auto-charge failed · $${(invoice.amount_due / 100).toFixed(0)} — needs attention`, "/manager/payments", `failed-${wedding.id}`);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object; const status = subscription.status;
        if (event.type === 'customer.subscription.created') { const couponId = subscription.metadata?.couponId; if (couponId) { try { const { data: c } = await supabase.from('coupons').select('current_uses').eq('id', couponId).single(); if (c) await supabase.from('coupons').update({ current_uses: (c.current_uses || 0) + 1 }).eq('id', couponId); } catch (e) { console.error("Failed to increment coupon:", e); } } }
        const { error } = await supabase.from('weddings').update({ stripe_subscription_status: status }).eq('stripe_subscription_id', subscription.id);
        if (error) console.error(`Error updating subscription status to ${status}:`, error);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object; const refundAmount = (charge.amount_refunded || 0) / 100; const wId = charge.metadata?.weddingId;
        if (refundAmount > 0) { await recordRoyaltySale(wId || null, refundAmount, `Refund — ${charge.metadata?.proposalId ? "proposal" : "booking"}`, true); await notifyOwnersPush(su, sk, "bookings_payments", "Refund Issued", `$${refundAmount.toFixed(0)} refunded`, "/manager/weddings", `refund-${wId || charge.id}`); }
        break;
      }
      default: console.log(`Unhandled event type ${event.type}`);
    }
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    console.error("Webhook Error:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
