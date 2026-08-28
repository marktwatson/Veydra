import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Using a fallback webhook secret for development if needed, but should be set in environment
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  
  if (!signature || !endpointSecret) {
    // If no secret is configured, we'll just parse the body directly (less secure, but works if no endpoint secret is set)
    // For production, always use endpointSecret
  }

  try {
    const body = await req.text();
    let event;

    if (endpointSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } else {
      event = JSON.parse(body);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase credentials");
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch portal settings for CRM integration
    const { data: settings } = await supabase
      .from('portal_settings')
      .select('*')
      .single();

    const syncToCRM = async (wedding: any, amount: number, type: string) => {
      if (!settings?.hl_api_key || !settings?.hl_location_id || !wedding.client_email) return;

      const headers = {
        "Authorization": `Bearer ${settings.hl_api_key}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
      };

      try {
        // 1. Find contact
        const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(wedding.client_email)}`, { headers });
        const searchData = await searchRes.json();
        let contactId = searchData.contacts?.[0]?.id;

        if (!contactId) {
          const tags = ["booked", "payment-received"];
          if (type === 'gift') tags.push("gift-received");
          else if (type === 'subscription') tags.push("subscription-payment");

          const createPayload: any = {
            locationId: settings.hl_location_id,
            email: wedding.client_email,
            name: wedding.client_name || "",
            tags
          };
          if (wedding.client_name) {
            const parts = wedding.client_name.trim().split(" ");
            createPayload.firstName = parts[0];
            if (parts.length > 1) createPayload.lastName = parts.slice(1).join(" ");
          }
          const createRes = await fetch(`https://services.leadconnectorhq.com/contacts/`, {
            method: "POST",
            headers,
            body: JSON.stringify(createPayload)
          });
          const createData = await createRes.json();
          contactId = createData.contact?.id;
        }

        if (contactId) {
          // 2. Update contact with tag
          const existingTags = searchData.contacts?.[0]?.tags || [];
          const newTags = new Set([...existingTags, "booked", "payment-received"]);
          if (type === 'gift') newTags.add("gift-received");
          else if (type === 'subscription') newTags.add("subscription-payment");
          
          const updateRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              tags: Array.from(newTags)
            })
          });
          
          if (!updateRes.ok) {
             console.error("Failed to update CRM contact:", await updateRes.text());
          } else {
             console.log(`Synced payment of $${amount} to CRM for ${wedding.client_email}`);
          }
        }
      } catch (e) {
        console.error("CRM Sync Error:", e);
      }
    };

    // ─── Royalty attribution ───
    // Every successful gross-sale payment in THIS territory's app must be
    // recorded in royalty_sales so the weekly processor can compute
    // royalty + payback. Single-territory model: all sales attribute to the
    // primary (this instance's own) territory. Refunds insert a negative
    // row (is_refund = true) so they reverse out of the correct period.
    const recordRoyaltySale = async (weddingId: string | null, amount: number, description: string, isRefund = false) => {
      if (!amount || amount <= 0) return;
      try {
        // Resolve THIS instance's own territory robustly. Previously we only
        // matched is_primary = true and SILENTLY skipped if no row matched —
        // which meant if the is_primary flag was ever unset, every sale would
        // stop being recorded for royalty with zero indication. Now we try
        // is_primary first, then fall back to ANY territory (single-territory
        // model), and log loudly if none exists so the problem is visible.
        let territory: any = null;
        const { data: primaryTerr } = await supabase
          .from("territories")
          .select("id")
          .eq("is_primary", true)
          .limit(1)
          .maybeSingle();
        if (primaryTerr?.id) {
          territory = primaryTerr;
        } else {
          const { data: anyTerr } = await supabase
            .from("territories")
            .select("id")
            .limit(1)
            .maybeSingle();
          if (anyTerr?.id) {
            territory = anyTerr;
            console.warn("[ROYALTY] No is_primary territory found — attributing sale to first territory row. Set is_primary = true on the correct territory.");
          }
        }
        if (!territory?.id) {
          // Royalty not set up yet — log loudly (not silent) so it's visible.
          console.warn(`[ROYALTY] SKIPPED recording ${isRefund ? "refund" : "sale"} $${amount} (wedding ${weddingId || "none"}) — no territory exists yet. Royalty will not be tracked until a territory is configured.`);
          return;
        }
        await supabase.from("royalty_sales").insert({
          territory_id: territory.id,
          wedding_id: weddingId || null,
          sale_amount: Math.abs(amount),
          sale_date: new Date().toISOString().split("T")[0],
          description,
          is_refund: isRefund,
        });
        console.log(`[ROYALTY] Recorded ${isRefund ? "refund" : "sale"} $${amount} for territory ${territory.id}${weddingId ? ` (wedding ${weddingId})` : ""}`);
      } catch (e) {
        console.error("[ROYALTY] Failed to record sale:", (e as any)?.message);
      }
    };

    // Auto-mark final_payment_verified when the bride has paid the full balance.
    // Called after every successful payment update so readiness reflects reality
    // without a manager having to manually click "verify".
    const autoVerifyFinalPayment = async (weddingId: string, paidAmount: number, totalAmount: number) => {
      try {
        const total = Number(totalAmount) || 0;
        const paid = Number(paidAmount) || 0;
        // Consider it fully paid if paid >= total (small float tolerance) and total > 0
        if (total > 0 && paid >= total - 0.01 && paid > 0) {
          await supabase
            .from("weddings")
            .update({ final_payment_verified: true })
            .eq("id", weddingId);
          console.log(`[WEBHOOK] Auto-verified final payment for wedding ${weddingId} (paid $${paid} / total $${total})`);
        }
      } catch (e) {
        console.error("[WEBHOOK] Failed to auto-verify final payment:", (e as any)?.message);
      }
    };

    const fulfillProposal = async (proposalId: string, customerId: string, subscriptionId: string, amountPaid: number, metadata: any) => {
      const { data: proposal } = await supabase.from("proposals").select("*").eq("id", proposalId).single();
      if (!proposal) return;

      let weddingId = proposal.original_wedding_id;
      const paymentPlan = metadata.paymentOption || proposal.payment_plan || "full";

      // If it's already accepted, it means the frontend already created the wedding.
      // We just need to make sure we sync to CRM.
      if (proposal.status === "accepted" || proposal.status === "paid") {
        weddingId = proposal.wedding_id || weddingId;
        if (weddingId) {
          const { data: existingWedding } = await supabase.from("weddings").select("*").eq("id", weddingId).single();
          if (existingWedding) {
            await syncToCRM(existingWedding, 0, 'payment');
          }
        }
        return;
      }

      const packageName = proposal.package_id ? (proposal.package_id.charAt(0).toUpperCase() + proposal.package_id.slice(1)) : "Custom";
      const coverageLabel = proposal.coverage_type === 'photo' ? 'Photo Only' : proposal.coverage_type === 'video' ? 'Video Only' : 'Photo & Video';
      const packageString = `${packageName} (${coverageLabel})`;

      if (proposal.is_upgrade && weddingId) {
        await supabase.from("weddings").update({
          package: packageString,
          addons: proposal.addons,
          second_shooter_hours: proposal.second_shooter_hours,
          second_shooter_type: proposal.second_shooter_type,
          total_amount: paymentPlan === "full" ? proposal.total_amount * 0.95 : proposal.total_amount,
          paid_amount: (proposal.amount_paid_so_far || 0) + amountPaid,
          payment_plan: paymentPlan,
          custom_payment_plan: proposal.custom_payment_plan,
          notes: `Upgraded Package.\nPhone: ${proposal.client_phone || 'N/A'}\n${proposal.notes || ''}` + (paymentPlan === "custom" ? `\n\nCustom Payment Plan:\n${JSON.stringify(proposal.custom_payment_plan)}` : ""),
        }).eq("id", weddingId);
      } else {
        const { data: wedding, error: weddingError } = await supabase.from("weddings").insert([{
          client_name: proposal.client_name,
          client_email: proposal.client_email,
          partner_name: proposal.partner_name,
          date: proposal.wedding_date,
          location: `${proposal.venue || ''} ${proposal.city || ''}, ${proposal.state || ''}`.trim(),
          package: packageString,
          addons: proposal.addons,
          contract_date: new Date().toISOString(),
          second_shooter_hours: proposal.second_shooter_hours,
          second_shooter_type: proposal.second_shooter_type,
          status: "pending",
          payment_plan: paymentPlan,
          custom_payment_plan: proposal.custom_payment_plan,
          total_amount: paymentPlan === "full" ? proposal.total_amount * 0.95 : proposal.total_amount,
          paid_amount: amountPaid,
          notes: `Phone: ${proposal.client_phone || 'N/A'}\n${proposal.notes || ''}` + (paymentPlan === "custom" ? `\n\nCustom Payment Plan:\n${JSON.stringify(proposal.custom_payment_plan)}` : ""),
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId || null
        }]).select().single();

        if (!weddingError && wedding) {
          weddingId = wedding.id;
        }
      }

      if (weddingId) {
        await supabase.from("proposals").update({ status: "accepted", wedding_id: weddingId, payment_plan: paymentPlan }).eq("id", proposal.id);
        
        if (settings?.email_bride_welcome_enabled && settings?.email_bride_welcome_template && proposal.client_email) {
          const companyName = settings.company_name || "Company";
          let subject = (settings.email_bride_welcome_subject || "Welcome to the Family!").replace(/{{company_name}}/g, companyName);
          let msg = settings.email_bride_welcome_template
            .replace(/{{company_name}}/g, companyName)
            .replace(/{{logo_url}}/g, settings.logo_url || "")
            .replace(/{{bride_name}}/g, proposal.client_name)
            .replace(/{{portal_link}}/g, `${settings.app_url || "https://veydra.app"}/bride-portal/${weddingId}`);
          await sendOvantaEmail(proposal.client_email, subject, msg, settings.hl_api_key, settings.hl_location_id);
        }

        // Send admin booking notification
        await sendAdminBookingNotification(settings, proposal.client_name, proposal.client_email, proposal.wedding_date, proposal.venue, packageString, amountPaid, weddingId);

        const { data: updatedWedding } = await supabase.from("weddings").select("*").eq("id", weddingId).single();
        if (updatedWedding) {
           await syncToCRM(updatedWedding, 0, 'payment');
        }
        // Attribute this gross sale to the territory for royalty calculations
        if (amountPaid > 0) {
          await recordRoyaltySale(weddingId, amountPaid, `Proposal payment — ${proposal.client_name || "client"}`);
        }
      }
    };



    const sendOvantaEmail = async (email: string, subject: string, message: string, apiKey: string, locationId: string) => {
      if (!apiKey || !locationId || !email) return false;
      const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      };
      try {
        const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}`, { headers });
        if (!searchRes.ok) return false;
        const searchData = await searchRes.json();
        const contactId = searchData.contacts?.[0]?.id;
        if (!contactId) return false;
        
        let htmlContent = message;
        if (!htmlContent.includes("<!DOCTYPE html>") && !htmlContent.includes("<html")) {
          htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${message}</body></html>`;
        }
        
        const emailHeaders = { ...headers, "Version": "2021-04-15" };
        const res = await fetch(`https://services.leadconnectorhq.com/conversations/messages`, {
          method: "POST",
          headers: emailHeaders,
          body: JSON.stringify({
            contactId,
            type: "Email",
            subject,
            html: htmlContent
          })
        });
        return res.ok;
      } catch (e) {
        console.error("Failed to send email:", e);
        return false;
      }
    };

    const sendOvantaSms = async (email: string, message: string, apiKey: string, locationId: string) => {
      if (!apiKey || !locationId || !email) return false;
      const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      };
      try {
        const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}`, { headers });
        if (!searchRes.ok) return false;
        const searchData = await searchRes.json();
        const contactId = searchData.contacts?.[0]?.id;
        if (!contactId) return false;
        
        const emailHeaders = { ...headers, "Version": "2021-04-15" };
        const res = await fetch(`https://services.leadconnectorhq.com/conversations/messages`, {
          method: "POST",
          headers: emailHeaders,
          body: JSON.stringify({
            contactId,
            type: "SMS",
            message
          })
        });
        return res.ok;
      } catch (e) {
        console.error("Failed to send SMS:", e);
        return false;
      }
    };

    // Send admin booking notification (email + SMS) to all configured admin emails
    const sendAdminBookingNotification = async (settings: any, clientName: string, clientEmail: string, weddingDate: string, venue: string, packageName: string, amountPaid: number, weddingId: string) => {
      const adminEmailsRaw = settings?.admin_notification_emails || "";
      const adminEmails = adminEmailsRaw.split(/[,\s]+/).map((e: string) => e.trim()).filter(Boolean);
      if (adminEmails.length === 0) return;

      const companyName = settings?.company_name || "Veydra";
      const appUrl = settings?.app_url || "https://veydra.app";
      const formattedDate = weddingDate ? new Date(weddingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A";

      const variables: Record<string, string> = {
        "{{company_name}}": companyName,
        "{{bride_name}}": clientName || "Client",
        "{{client_name}}": clientName || "Client",
        "{{client_email}}": clientEmail || "N/A",
        "{{wedding_date}}": formattedDate,
        "{{venue}}": venue || "N/A",
        "{{package_name}}": packageName || "N/A",
        "{{amount}}": amountPaid.toFixed(2),
        "{{wedding_id}}": weddingId,
        "{{portal_link}}": `${appUrl}/bride-portal/${weddingId}`,
      };

      const replaceVars = (text: string) => {
        let result = text;
        for (const [key, value] of Object.entries(variables)) {
          result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        return result;
      };

      // Send SMS
      if (settings?.sms_admin_booking_enabled && settings?.sms_admin_booking_template) {
        const smsMsg = replaceVars(settings.sms_admin_booking_template);
        for (const email of adminEmails) {
          try { await sendOvantaSms(email, smsMsg, settings.hl_api_key, settings.hl_location_id); } catch (e) { console.error("Admin booking SMS failed:", e); }
        }
      }

      // Send Email
      if (settings?.email_admin_booking_enabled && settings?.email_admin_booking_template) {
        const subject = replaceVars(settings.email_admin_booking_subject || "New Booking Received!");
        const htmlMsg = replaceVars(settings.email_admin_booking_template);
        for (const email of adminEmails) {
          try { await sendOvantaEmail(email, subject, htmlMsg, settings.hl_api_key, settings.hl_location_id); } catch (e) { console.error("Admin booking email failed:", e); }
        }
      }
    };

    // Handle the event
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object;
        
        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
          const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
          const amountPaid = invoice.amount_paid / 100;

          if (amountPaid > 0) {
            let subscription;
            try {
              subscription = await stripe.subscriptions.retrieve(subscriptionId);
            } catch (e) {
              console.error("Failed to retrieve subscription:", e);
            }

            const proposalId = subscription?.metadata?.proposalId;
            const weddingIdFromMeta = subscription?.metadata?.weddingId;
            
            if (proposalId) {
              await fulfillProposal(proposalId, customerId || "", subscriptionId, amountPaid, subscription?.metadata || {});
            } else if (weddingIdFromMeta) {
              // Direct booking via /book — PERSIST IMMEDIATELY on successful invoice payment
              // This runs regardless of frontend state — webhook is the source of truth
              const { data: wedding, error: fetchError } = await supabase.from('weddings').select('*').eq('id', weddingIdFromMeta).single();
              
              if (fetchError) {
                console.error(`[WEBHOOK] Failed to fetch wedding ${weddingIdFromMeta} for invoice payment:`, fetchError.message);
              }
              
              if (wedding) {
                const isFirstPayment = (wedding.paid_amount || 0) === 0;
                const newPaidAmount = (wedding.paid_amount || 0) + amountPaid;
                const updatePayload: any = { 
                  paid_amount: newPaidAmount,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId
                };
                
                // Always save customer/subscription IDs immediately
                if (!wedding.stripe_customer_id && customerId) {
                  updatePayload.stripe_customer_id = customerId;
                }
                if (!wedding.stripe_subscription_id && subscriptionId) {
                  updatePayload.stripe_subscription_id = subscriptionId;
                }
                
                // Only promote from draft to pending on first successful payment
                if (wedding.notes?.includes('[UNPAID_DRAFT]')) {
                  updatePayload.notes = wedding.notes.replace('[UNPAID_DRAFT]\n', '').replace('[UNPAID_DRAFT]', '');
                  updatePayload.status = 'pending';
                  updatePayload.contract_date = new Date().toISOString();
                  console.log(`[WEBHOOK] Wedding ${weddingIdFromMeta} promoted from DRAFT to PENDING via invoice — paid $${amountPaid}`);
                } else {
                  console.log(`[WEBHOOK] Wedding ${weddingIdFromMeta} updated via invoice — paid $${amountPaid} (total: $${newPaidAmount})`);
                }
                
                const { error: updateError } = await supabase.from('weddings').update(updatePayload).eq('id', weddingIdFromMeta);
                
                if (updateError) {
                  console.error(`[WEBHOOK] FAILED to update wedding ${weddingIdFromMeta} for invoice:`, updateError.message);
                } else {
                  console.log(`[WEBHOOK] SUCCESS — Invoice payment persisted for ${weddingIdFromMeta}: paid=$${newPaidAmount}, customer=${customerId}, sub=${subscriptionId}`);
                }
                
                await syncToCRM(wedding, amountPaid, 'subscription');
                await recordRoyaltySale(weddingIdFromMeta, amountPaid, `Invoice payment — ${wedding.client_name || "client"}`);
                await autoVerifyFinalPayment(weddingIdFromMeta, newPaidAmount, wedding.total_amount);
                
                // Send welcome email only on first payment
                if (isFirstPayment && settings?.email_bride_welcome_enabled && settings?.email_bride_welcome_template && wedding.client_email) {
                  const companyName = settings.company_name || "Company";
                  let subject = (settings.email_bride_welcome_subject || "Welcome to the Family!").replace(/{{company_name}}/g, companyName);
                  let msg = settings.email_bride_welcome_template
                    .replace(/{{company_name}}/g, companyName)
                    .replace(/{{logo_url}}/g, settings.logo_url || "")
                    .replace(/{{bride_name}}/g, wedding.client_name)
                    .replace(/{{portal_link}}/g, `${settings.app_url || "https://veydra.app"}/bride-portal/${wedding.id}`);
                  await sendOvantaEmail(wedding.client_email, subject, msg, settings.hl_api_key, settings.hl_location_id);
                }

                // Send admin booking notification on first payment
                if (isFirstPayment) {
                  await sendAdminBookingNotification(settings, wedding.client_name, wedding.client_email, wedding.date, wedding.location, wedding.package, amountPaid, wedding.id);
                }
              } else {
                console.error(`[WEBHOOK] Wedding ${weddingIdFromMeta} not found in DB — cannot persist invoice payment`);
              }
            }

            // Fallback: try to find by subscription or customer ID if metadata wasn't present
            if (!proposalId && !weddingIdFromMeta) {
              let { data: weddings } = await supabase
                .from('weddings')
                .select('*')
                .eq('stripe_subscription_id', subscriptionId);
                
              if (!weddings || weddings.length === 0) {
                const { data: custWeddings } = await supabase
                  .from('weddings')
                  .select('*')
                  .eq('stripe_customer_id', customerId);
                weddings = custWeddings || [];
              }
              if (weddings && weddings.length > 0) {
                const wedding = weddings[0];
                const newPaidAmount = (wedding.paid_amount || 0) + amountPaid;
                const updatePayload: any = { paid_amount: newPaidAmount };
                
                // Also persist customer/subscription IDs if not already saved
                if (!wedding.stripe_customer_id && customerId) {
                  updatePayload.stripe_customer_id = customerId;
                }
                if (!wedding.stripe_subscription_id && subscriptionId) {
                  updatePayload.stripe_subscription_id = subscriptionId;
                }
                
                const { error: fallbackUpdateError } = await supabase
                  .from('weddings')
                  .update(updatePayload)
                  .eq('id', wedding.id);
                  
                if (fallbackUpdateError) {
                  console.error(`[WEBHOOK] Fallback update failed for wedding ${wedding.id}:`, fallbackUpdateError.message);
                } else {
                  console.log(`[WEBHOOK] Fallback SUCCESS — Wedding ${wedding.id} updated: paid=$${newPaidAmount}`);
                }
              }
            }
          }
        }
        break;
      }

    case 'checkout.session.completed': {
        const session = event.data.object;
        const weddingId = session.metadata?.weddingId;
        const type = session.metadata?.type;
        const amountPaid = session.amount_total / 100; // cents to dollars

        if (weddingId && (type === 'gift' || type === 'payment')) {
          const { data: wedding } = await supabase
            .from('weddings')
            .select('*')
            .eq('id', weddingId)
            .single();

          if (wedding) {
            const newPaidAmount = (wedding.paid_amount || 0) + amountPaid;
            await supabase
              .from('weddings')
              .update({ paid_amount: newPaidAmount })
              .eq('id', weddingId);
            
            console.log(`Successfully updated paid amount for wedding ${weddingId} via GIFT/PAYMENT by $${amountPaid}`);
            await syncToCRM(wedding, amountPaid, type);
            // Only attribute genuine payments (not gifts) to royalty gross sales
            if (type === 'payment') {
              await recordRoyaltySale(weddingId, amountPaid, `Checkout payment — ${wedding.client_name || "client"}`);
              await autoVerifyFinalPayment(weddingId, (wedding.paid_amount || 0) + amountPaid, wedding.total_amount);
            }

            if (type === 'gift' && settings?.hl_api_key && settings?.hl_location_id && wedding.client_email) {
              const appUrl = settings.app_url || "https://veydra.app";
              const portalLink = `${appUrl}/bride-portal/${wedding.id}`;
              const companyName = settings.company_name || "Company";
              const logoUrl = settings.logo_url || "";
              
              if (settings.email_bride_gift_enabled && settings.email_bride_gift_template) {
                let subject = settings.email_bride_gift_subject || "You received a gift!";
                subject = subject.replace(/{{company_name}}/g, companyName);
                
                let msg = settings.email_bride_gift_template
                  .replace(/{{company_name}}/g, companyName)
                  .replace(/{{logo_url}}/g, logoUrl)
                  .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                  .replace(/{{amount}}/g, amountPaid.toFixed(2))
                  .replace(/{{portal_link}}/g, portalLink);
                  
                await sendOvantaEmail(wedding.client_email, subject, msg, settings.hl_api_key, settings.hl_location_id);
              }
              
              if (settings.sms_bride_gift_enabled && settings.sms_bride_gift_template) {
                let msg = settings.sms_bride_gift_template
                  .replace(/{{company_name}}/g, companyName)
                  .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                  .replace(/{{amount}}/g, amountPaid.toFixed(2))
                  .replace(/{{portal_link}}/g, portalLink);
                  
                await sendOvantaSms(wedding.client_email, msg, settings.hl_api_key, settings.hl_location_id);
              }
            }
          }
        }
        break;
      }
      
      case 'setup_intent.succeeded':
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        const couponId = intent.metadata?.couponId;
        const proposalId = intent.metadata?.proposalId;
        const customerId = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id;
        const amountPaid = event.type === 'setup_intent.succeeded' ? 0 : (intent.amount_received / 100);

        // Ensure default payment method is saved on customer for future off-session auto-charges
        if (customerId && intent.payment_method) {
          try {
            const pmId = typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method.id;
            await stripe.customers.update(customerId, {
              invoice_settings: { default_payment_method: pmId }
            });
          } catch (e) {
            console.error("Failed to update customer default payment method:", e);
          }
        }

        const weddingIdFromMeta = intent.metadata?.weddingId;

        if (proposalId) {
          await fulfillProposal(proposalId, customerId || "", "", amountPaid, intent.metadata);
        } else if (weddingIdFromMeta) {
          // Direct booking via /book — PERSIST IMMEDIATELY on successful payment
          // This runs regardless of whether frontend confirms — webhook is the source of truth
          const { data: wedding, error: fetchError } = await supabase.from('weddings').select('*').eq('id', weddingIdFromMeta).single();
          
          if (fetchError) {
            console.error(`[WEBHOOK] Failed to fetch wedding ${weddingIdFromMeta}:`, fetchError.message);
          }
          
          if (wedding) {
            const isFirstPayment = (wedding.paid_amount || 0) === 0;
            const newPaidAmount = (wedding.paid_amount || 0) + amountPaid;
            const updatePayload: any = { 
              paid_amount: newPaidAmount,
              stripe_customer_id: customerId
            };
            
            // Always save customer ID immediately so it persists in DB
            if (!wedding.stripe_customer_id && customerId) {
              updatePayload.stripe_customer_id = customerId;
            }
            
            // Only promote to pending after payment clears — never before
            if (wedding.notes?.includes('[UNPAID_DRAFT]')) {
              updatePayload.notes = wedding.notes.replace('[UNPAID_DRAFT]\n', '').replace('[UNPAID_DRAFT]', '');
              updatePayload.status = 'pending';
              updatePayload.contract_date = new Date().toISOString();
              console.log(`[WEBHOOK] Wedding ${weddingIdFromMeta} promoted from DRAFT to PENDING — paid $${amountPaid}`);
            } else {
              console.log(`[WEBHOOK] Wedding ${weddingIdFromMeta} updated — paid $${amountPaid} (total: $${newPaidAmount})`);
            }
            
            const { error: updateError } = await supabase.from('weddings').update(updatePayload).eq('id', weddingIdFromMeta);
            
            if (updateError) {
              console.error(`[WEBHOOK] FAILED to update wedding ${weddingIdFromMeta}:`, updateError.message);
            } else {
              console.log(`[WEBHOOK] SUCCESS — Wedding ${weddingIdFromMeta} persisted to DB: paid=$${newPaidAmount}, customer=${customerId}, status=${updatePayload.status || wedding.status}`);
            }
            
            await syncToCRM(wedding, amountPaid, 'payment');
            await recordRoyaltySale(weddingIdFromMeta, amountPaid, `Payment intent — ${wedding.client_name || "client"}`);
            await autoVerifyFinalPayment(weddingIdFromMeta, newPaidAmount, wedding.total_amount);
            
            // Send welcome email only on first payment
            if (isFirstPayment && settings?.email_bride_welcome_enabled && settings?.email_bride_welcome_template && wedding.client_email) {
              const companyName = settings.company_name || "Company";
              let subject = (settings.email_bride_welcome_subject || "Welcome to the Family!").replace(/{{company_name}}/g, companyName);
              let msg = settings.email_bride_welcome_template
                .replace(/{{company_name}}/g, companyName)
                .replace(/{{logo_url}}/g, settings.logo_url || "")
                .replace(/{{bride_name}}/g, wedding.client_name)
                .replace(/{{portal_link}}/g, `${settings.app_url || "https://veydra.app"}/bride-portal/${wedding.id}`);
              await sendOvantaEmail(wedding.client_email, subject, msg, settings.hl_api_key, settings.hl_location_id);
            }

            // Send admin booking notification on first payment
            if (isFirstPayment) {
              await sendAdminBookingNotification(settings, wedding.client_name, wedding.client_email, wedding.date, wedding.location, wedding.package, amountPaid, wedding.id);
            }
          } else {
            console.error(`[WEBHOOK] Wedding ${weddingIdFromMeta} not found in DB — cannot persist payment`);
          }
        }

        if (couponId) {
          try {
            const { data: coupon } = await supabase.from('coupons').select('current_uses').eq('id', couponId).single();
            if (coupon) {
              await supabase.from('coupons').update({ current_uses: (coupon.current_uses || 0) + 1 }).eq('id', couponId);
            }
          } catch (e) {
            console.error("Failed to increment coupon usage for payment intent:", e);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
          console.error(`Payment failed for subscription ${subscriptionId}`);
          
          await supabase
            .from('weddings')
            .update({ stripe_subscription_status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId);

          // Notify CRM of failure
          const { data: wedding } = await supabase.from('weddings').select('*').eq('stripe_subscription_id', subscriptionId).single();
          if (wedding?.client_email && settings?.hl_api_key) {
            const headers = { "Authorization": `Bearer ${settings.hl_api_key}`, "Version": "2021-07-28", "Content-Type": "application/json" };
            const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${settings.hl_location_id}&query=${encodeURIComponent(wedding.client_email)}`, { headers });
            const searchData = await searchRes.json();
            const contactId = searchData.contacts?.[0]?.id;
            if (contactId) {
              await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({ tags: ["payment-failed"] })
              });
            }
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const status = subscription.status; // e.g. 'active', 'past_due', 'canceled'
        
        // If this is a newly created subscription and it used a coupon, increment usage
        if (event.type === 'customer.subscription.created') {
          const couponId = subscription.metadata?.couponId;
          if (couponId) {
            try {
              const { data: coupon } = await supabase.from('coupons').select('current_uses').eq('id', couponId).single();
              if (coupon) {
                await supabase.from('coupons').update({ current_uses: (coupon.current_uses || 0) + 1 }).eq('id', couponId);
              }
            } catch (e) {
              console.error("Failed to increment coupon usage for subscription:", e);
            }
          }
        }

        
        const { error } = await supabase
          .from('weddings')
          .update({ stripe_subscription_status: status })
          .eq('stripe_subscription_id', subscription.id);
          
        if (error) {
          console.error(`Error updating subscription status to ${status}:`, error);
        } else {
          console.log(`Updated subscription ${subscription.id} status to ${status}`);
        }
        break;
      }
      
      case 'charge.refunded': {
        // Reverse the refunded amount out of royalty gross sales so the
        // correct period's calculation is reduced. Refunds insert a
        // negative row (is_refund = true) dated today.
        const charge = event.data.object;
        const refundAmount = (charge.amount_refunded || 0) / 100;
        const weddingIdFromMeta = charge.metadata?.weddingId;
        if (refundAmount > 0) {
          await recordRoyaltySale(weddingIdFromMeta || null, refundAmount, `Refund — ${charge.metadata?.proposalId ? "proposal" : "booking"}`, true);
        }
        break;
      }
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    console.error("Webhook Error:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
