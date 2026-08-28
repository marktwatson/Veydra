import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.14.0";

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch portal settings
    const { data: settings, error: settingsError } = await supabase
      .from("portal_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "Failed to fetch settings" }), { status: 500 });
    }

    const tz = settings.timezone || "America/New_York";
    const currentHourStr = new Date().toLocaleString("en-US", { timeZone: tz, hour: 'numeric', hour12: false });
    const currentHour = parseInt(currentHourStr, 10);
    
    // Only run if it's 9 AM in the configured timezone
    if (currentHour !== 9) {
      return new Response(JSON.stringify({ message: `Skipping: It is currently ${currentHour}:00 in ${tz}, waiting for 9:00` }), { status: 200 });
    }

    const todayAtMidnight = new Date();
    todayAtMidnight.setHours(0, 0, 0, 0);

    let sentCount = 0;

    // 1. Assignments (Prep Reminders & 48-Hour Reminders)
    const { data: assignments } = await supabase
      .from("assignments")
      .select(`
        id,
        contractor_id,
        status,
        jobs (id, role, contractor_todos, weddings(client_name, date, location)),
        contractors (first_name, last_name, email, sms_notifications, email_notifications)
      `)
      .in("status", ["Upcoming", "upcoming", "Accepted", "accepted", "Confirmed", "confirmed", "Assigned", "assigned", "Action Required", "action required"]);

    if (assignments && assignments.length > 0) {
      for (const a of assignments) {
        const job = a.jobs as any;
        const contractor = a.contractors as any;
        
        if (!job?.weddings?.date || !contractor?.email) continue;
        
        const wDate = new Date(job.weddings.date.split('T')[0] + 'T12:00:00');
        wDate.setHours(0,0,0,0);
        
        const diffTime = wDate.getTime() - todayAtMidnight.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Prep SMS & Email — fires when wedding is within the configured day window AND contractor has incomplete todos
        if (settings.sms_contractor_prep_days) {
          let hasPendingTodos = false;
          const todos = job.contractor_todos;
          if (todos) {
            let parsedTodos = [];
            if (typeof todos === 'string') {
              try { parsedTodos = JSON.parse(todos); } catch(e){}
            } else if (Array.isArray(todos)) {
              parsedTodos = todos;
            }
            hasPendingTodos = parsedTodos.some((t: any) => !t.completed);
          }

          // Fire if within the window (e.g. prep_days=5 means fire at 5,4,3,2,1 days out)
          if (hasPendingTodos && diffDays > 0 && diffDays <= settings.sms_contractor_prep_days) {
            const portalLink = (settings.app_url || "https://veydra.com").replace(/\/$/, "");

            // SMS
            if (settings.sms_contractor_prep_enabled && settings.sms_contractor_prep_template && contractor.sms_notifications !== false) {
              let msg = settings.sms_contractor_prep_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{contractor_name}}/g, contractor.first_name)
                .replace(/{{wedding_name}}/g, job.weddings.client_name)
                .replace(/{{client_name}}/g, job.weddings.client_name)
                .replace(/{{days}}/g, String(diffDays))
                .replace(/{{location}}/g, job.weddings.location || "TBD")
                .replace(/{{date}}/g, new Date(job.weddings.date).toLocaleDateString())
                .replace(/{{portal_link}}/g, portalLink);
              
              const success = await sendOvantaSms(contractor.email, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }

            // Email
            if (settings.email_contractor_prep_enabled && settings.email_contractor_prep_template && contractor.email_notifications !== false) {
              let subject = (settings.email_contractor_prep_subject || "Action Items Due for {{wedding_name}} Wedding")
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{contractor_name}}/g, contractor.first_name)
                .replace(/{{wedding_name}}/g, job.weddings.client_name)
                .replace(/{{client_name}}/g, job.weddings.client_name)
                .replace(/{{days}}/g, String(diffDays));

              let msg = settings.email_contractor_prep_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{logo_url}}/g, settings.logo_url || "https://vibe.filesafe.space/1785896143476160753/attachments/70e8de35-254d-4365-a8cc-fe2c6acdb517.png")
                .replace(/{{contractor_name}}/g, contractor.first_name)
                .replace(/{{wedding_name}}/g, job.weddings.client_name)
                .replace(/{{client_name}}/g, job.weddings.client_name)
                .replace(/{{days}}/g, String(diffDays))
                .replace(/{{location}}/g, job.weddings.location || "TBD")
                .replace(/{{date}}/g, new Date(job.weddings.date).toLocaleDateString())
                .replace(/{{portal_link}}/g, portalLink);

              const success = await sendOvantaEmail(contractor.email, subject, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }
          }
        }

        // Reminder SMS & Email (e.g. 48 hours)
        if (settings.sms_reminder_hours) {
          const targetDays = Math.round(settings.sms_reminder_hours / 24);
          if (diffDays === targetDays) {
            if (settings.sms_reminder_enabled && settings.sms_reminder_template && contractor.sms_notifications !== false) {
              let msg = settings.sms_reminder_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{contractor_name}}/g, contractor.first_name)
                .replace(/{{client_name}}/g, job.weddings.client_name)
                .replace(/{{location}}/g, job.weddings.location || "TBD")
                .replace(/{{date}}/g, new Date(job.weddings.date).toLocaleDateString())
                .replace(/{{portal_link}}/g, (settings.app_url || "https://veydra.com").replace(/\/$/, ""));
              
              const success = await sendOvantaSms(contractor.email, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }
            
            if (settings.email_reminder_enabled && settings.email_reminder_template && contractor.email_notifications !== false) {
              let subject = (settings.email_reminder_subject || "Upcoming Job Reminder")
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{client_name}}/g, job.weddings.client_name)
                .replace(/{{date}}/g, new Date(job.weddings.date).toLocaleDateString());
                
              let msg = settings.email_reminder_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{logo_url}}/g, settings.logo_url || "https://vibe.filesafe.space/1785896143476160753/attachments/70e8de35-254d-4365-a8cc-fe2c6acdb517.png")
                .replace(/{{contractor_name}}/g, contractor.first_name)
                .replace(/{{client_name}}/g, job.weddings.client_name)
                .replace(/{{location}}/g, job.weddings.location || "TBD")
                .replace(/{{date}}/g, new Date(job.weddings.date).toLocaleDateString())
                .replace(/{{portal_link}}/g, (settings.app_url || "https://veydra.com").replace(/\/$/, ""));
                
              const success = await sendOvantaEmail(contractor.email, subject, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }
          }
        }
      }
    }

    // 2. Bride Automations
    const { data: weddings } = await supabase.from("weddings").select("*").neq("status", "cancelled");
    
    if (weddings) {
      for (const wedding of weddings) {
        // Prioritize client_email (main Details email) over questionnaire email
        let brideEmail = wedding.client_email || "";
        if (!brideEmail && wedding.questionnaire_data) {
           let qData = wedding.questionnaire_data;
           if (typeof qData === 'string') { try { qData = JSON.parse(qData); } catch(e){} }
           if (qData?.contact_info?.email) brideEmail = qData.contact_info.email;
           else if (qData?.email) brideEmail = qData.email;
        }
        if (!brideEmail) {
          const emailMatch = wedding.notes?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
          if (emailMatch) brideEmail = emailMatch[1];
        }

        if (!brideEmail) continue;

        // Welcome SMS & Email is now triggered on publish (pending -> upcoming)
        // in the Weddings UI, NOT by this daily cron. The guard column
        // `welcome_email_sent` prevents double-sending. Nothing to do here.

        // Pre-Wedding Check-in
        if (wedding.date && settings.sms_bride_pre_wedding_hours) {
          const wDate = new Date(wedding.date.split('T')[0] + 'T12:00:00');
          wDate.setHours(0,0,0,0);
          
          const diffTime = wDate.getTime() - todayAtMidnight.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const targetDays = Math.round(settings.sms_bride_pre_wedding_hours / 24);
          
          if (diffDays === targetDays) {
            if (settings.sms_bride_pre_wedding_enabled && settings.sms_bride_pre_wedding_template) {
              let msg = settings.sms_bride_pre_wedding_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride");
                
              const success = await sendOvantaSms(brideEmail, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }
            if (settings.email_bride_pre_wedding_enabled && settings.email_bride_pre_wedding_template) {
              let subject = (settings.email_bride_pre_wedding_subject || "Your big day is almost here!")
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride");
              let msg = settings.email_bride_pre_wedding_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{logo_url}}/g, settings.logo_url || "https://vibe.filesafe.space/1785896143476160753/attachments/70e8de35-254d-4365-a8cc-fe2c6acdb517.png")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                .replace(/{{portal_link}}/g, `${(settings.app_url || "https://veydra.com").replace(/\/$/, "")}/bride-portal/${wedding.id}`);
              const success = await sendOvantaEmail(brideEmail, subject, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }
          }
        }
        
        // Day After Wedding (1 day after)
        if (wedding.date) {
          const wDate = new Date(wedding.date.split('T')[0] + 'T12:00:00');
          wDate.setHours(0,0,0,0);
          
          const diffTime = todayAtMidnight.getTime() - wDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            if (settings.sms_bride_day_after_enabled && settings.sms_bride_day_after_template) {
              let msg = settings.sms_bride_day_after_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                .replace(/{{portal_link}}/g, `${(settings.app_url || "https://veydra.com").replace(/\/$/, "")}/bride-portal/${wedding.id}`);
                
              const success = await sendOvantaSms(brideEmail, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }
            if (settings.email_bride_day_after_enabled && settings.email_bride_day_after_template) {
              let subject = (settings.email_bride_day_after_subject || "Thank you from {{company_name}}!")
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride");
              let msg = settings.email_bride_day_after_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{logo_url}}/g, settings.logo_url || "https://vibe.filesafe.space/1785896143476160753/attachments/70e8de35-254d-4365-a8cc-fe2c6acdb517.png")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                .replace(/{{portal_link}}/g, `${(settings.app_url || "https://veydra.com").replace(/\/$/, "")}/bride-portal/${wedding.id}`);
              const success = await sendOvantaEmail(brideEmail, subject, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }
          }
        }

        // Post-Wedding Rating (2 days after)
        if (wedding.date) {
          const wDate = new Date(wedding.date.split('T')[0] + 'T12:00:00');
          wDate.setHours(0,0,0,0);
          
          const diffTime = todayAtMidnight.getTime() - wDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 2) {
            if (settings.sms_bride_rating_enabled && settings.sms_bride_rating_template) {
              let msg = settings.sms_bride_rating_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                .replace(/{{feedback_link}}/g, `${(settings.app_url || "https://veydra.com").replace(/\/$/, "")}/feedback/${wedding.id}`);
                
              const success = await sendOvantaSms(brideEmail, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }
            if (settings.email_bride_rating_enabled && settings.email_bride_rating_template) {
              let subject = (settings.email_bride_rating_subject || "How did we do?")
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride");
              let msg = settings.email_bride_rating_template
                .replace(/{{company_name}}/g, settings.company_name || "Veydra")
                .replace(/{{logo_url}}/g, settings.logo_url || "https://vibe.filesafe.space/1785896143476160753/attachments/70e8de35-254d-4365-a8cc-fe2c6acdb517.png")
                .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
                .replace(/{{feedback_link}}/g, `${(settings.app_url || "https://veydra.com").replace(/\/$/, "")}/feedback/${wedding.id}`);
              const success = await sendOvantaEmail(brideEmail, subject, msg, settings.hl_api_key, settings.hl_location_id);
              if (success) sentCount++;
            }
          }
        }
      }
    }
    
    // 3. Auto-Sync Stripe Paid Amounts & Process Payments
    const { data: allStripeWeddings } = await supabase
      .from("weddings")
      .select("*")
      .neq("status", "cancelled");

    if (allStripeWeddings) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

      for (const wedding of allStripeWeddings) {
        if (!wedding.stripe_customer_id && !wedding.client_email) continue;

        try {
          let customerId = wedding.stripe_customer_id;
          if (!customerId && wedding.client_email) {
            const searchRes = await stripe.customers.list({ email: wedding.client_email.trim(), limit: 1 });
            if (searchRes.data.length > 0) {
              customerId = searchRes.data[0].id;
              await supabase.from("weddings").update({ stripe_customer_id: customerId }).eq("id", wedding.id);
            }
          }

          if (customerId) {
            const charges = await stripe.charges.list({ customer: customerId, limit: 100 });
            const totalPaidCents = charges.data
              .filter((c: any) => c.paid && c.status === "succeeded")
              .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
            const totalPaidDollars = totalPaidCents / 100;

            if (totalPaidDollars > 0 && Math.abs((wedding.paid_amount || 0) - totalPaidDollars) > 0.01) {
              await supabase.from("weddings").update({ paid_amount: totalPaidDollars }).eq("id", wedding.id);
              console.log(`Auto-synced Stripe paid amount for ${wedding.client_name}: $${totalPaidDollars} (was $${wedding.paid_amount})`);
            }
          }
        } catch (syncErr) {
          console.error(`Failed to auto-sync Stripe charges for ${wedding.client_name}:`, syncErr);
        }

        if (!wedding.date || !wedding.total_amount || wedding.final_payment_processed) continue;

        const wDate = new Date(wedding.date.split('T')[0] + 'T12:00:00');
        wDate.setHours(0,0,0,0);
        
        const diffTime = wDate.getTime() - todayAtMidnight.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Handle Custom Payment Plans
        let chargedCustomToday = false;
        if (wedding.payment_plan === 'custom' && wedding.custom_payment_plan) {
          try {
            let plan = wedding.custom_payment_plan;
            if (typeof plan === 'string') {
              try { plan = JSON.parse(plan); } catch(e) {}
            }
            if (plan && Array.isArray(plan.installments)) {
              for (const inst of plan.installments) {
                if (inst.date) {
                  const instDate = new Date(inst.date + 'T12:00:00');
                  instDate.setHours(0,0,0,0);
                  if (instDate.getTime() === todayAtMidnight.getTime()) {
                    // It's time to charge this custom installment!
                    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
                    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
                    
                    const chargeCents = Math.round(Number(inst.amount) * 100);
                    if (chargeCents > 0) {
                      const invoice = await stripe.invoices.create({
                        customer: wedding.stripe_customer_id,
                        auto_advance: false,
                        collection_method: 'charge_automatically',
                        description: `Custom Payment Plan Installment for ${wedding.client_name}`
                      });

                      await stripe.invoiceItems.create({
                        customer: wedding.stripe_customer_id,
                        invoice: invoice.id,
                        amount: chargeCents,
                        currency: 'usd',
                        description: `Custom Payment Plan Installment for ${wedding.client_name}`,
                      });

                      const finalized = await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: true });
                      if (finalized.status !== 'paid') {
                        try {
                          await stripe.invoices.pay(finalized.id);
                        } catch (payErr: any) {
                          if (!payErr.message?.includes('already paid') && payErr.code !== 'invoice_already_paid') {
                            throw payErr;
                          }
                        }
                      }
                      console.log(`Successfully processed custom installment of $${inst.amount} for ${wedding.client_name}`);
                      chargedCustomToday = true;
                    }
                  }
                }
              }
            }
          } catch(e) {
            console.error(`Failed to process custom payment for ${wedding.client_name}:`, e);
          }
        }

        // Charge exactly 10 days before wedding
        if (diffDays === 10 && !chargedCustomToday && wedding.payment_plan !== 'custom') {
          const remainingBalance = wedding.total_amount - (wedding.paid_amount || 0);
          
          if (remainingBalance > 0) {
            try {
              const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
              const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

              if (wedding.stripe_subscription_id && wedding.stripe_subscription_status === 'active') {
                // 1. Create a one-off invoice item for the remaining balance
                await stripe.invoiceItems.create({
                  customer: wedding.stripe_customer_id,
                  amount: Math.round(remainingBalance * 100), // convert to cents
                  currency: 'usd',
                  description: `Final Wedding Balance for ${wedding.client_name}`,
                });

                // 2. Cancel the recurring subscription so it stops charging $250/mo
                await stripe.subscriptions.cancel(wedding.stripe_subscription_id, {
                  invoice_now: true, // This generates the final invoice immediately with the pending invoice item
                  prorate: false,
                });
              } else {
                // Non-subscription (e.g. 50/50 plan)
                await stripe.invoiceItems.create({
                  customer: wedding.stripe_customer_id,
                  amount: Math.round(remainingBalance * 100),
                  currency: 'usd',
                  description: `Final Wedding Balance for ${wedding.client_name}`,
                });
                
                const invoice = await stripe.invoices.create({
                  customer: wedding.stripe_customer_id,
                  auto_advance: true,
                  collection_method: 'charge_automatically',
                });
                
                await stripe.invoices.pay(invoice.id);
              }

              // 3. Mark as processed in DB
              await supabase
                .from("weddings")
                .update({ final_payment_processed: true })
                .eq("id", wedding.id);

              console.log(`Successfully processed final payment of $${remainingBalance} for ${wedding.client_name}`);
            } catch (stripeErr) {
              console.error(`Failed to process final payment for ${wedding.client_name}:`, stripeErr);
            }
          } else if (remainingBalance <= 0) {
            // They overpaid or paid exactly, just cancel the subscription if it exists
            try {
              if (wedding.stripe_subscription_id && wedding.stripe_subscription_status === 'active') {
                const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
                const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
                await stripe.subscriptions.cancel(wedding.stripe_subscription_id);
              }
              
              await supabase
                .from("weddings")
                .update({ final_payment_processed: true })
                .eq("id", wedding.id);
            } catch (stripeErr) {
               console.error(`Failed to cancel subscription for ${wedding.client_name}:`, stripeErr);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ message: `Successfully sent ${sentCount} reminders and processed final payments` }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

async function sendOvantaSms(email: string, message: string, apiKey: string, locationId: string) {
  if (!apiKey || !locationId || !email) return false;

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Version": "2021-07-28",
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}`, { headers });
  if (!searchRes.ok) return false;
  
  const searchData = await searchRes.json();
  const contactId = searchData.contacts?.[0]?.id;
  if (!contactId) return false;

  const smsHeaders = { ...headers, "Version": "2021-04-15" };
  const smsPayload = {
    type: "SMS",
    contactId: contactId,
    message: message,
    status: "pending"
  };
  
  const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: smsHeaders,
    body: JSON.stringify(smsPayload)
  });
  
  return res.ok;
}

async function sendOvantaEmail(email: string, subject: string, message: string, apiKey: string, locationId: string) {
  if (!apiKey || !locationId || !email) return false;

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Version": "2021-07-28",
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}`, { headers });
  if (!searchRes.ok) return false;
  
  const searchData = await searchRes.json();
  const contactId = searchData.contacts?.[0]?.id;
  if (!contactId) return false;

  const emailHeaders = { ...headers, "Version": "2021-04-15" };
  
  let htmlContent = message;
  if (!htmlContent.includes("<!DOCTYPE html>") && !htmlContent.includes("<html")) {
    htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; }
    p { margin-bottom: 16px; }
    a { color: #0066cc; text-decoration: none; word-break: break-all; }
    a:hover { text-decoration: underline; }
    @media only screen and (max-width: 600px) {
      body { padding: 15px; font-size: 16px; }
    }
  </style>
</head>
<body>
  ${message}
</body>
</html>`;
  }

  // Minify HTML to prevent CRM outbox (Conversations tab) from breaking on multi-line tags
  htmlContent = htmlContent.replace(/\s+/g, ' ').trim();

  const emailPayload = {
    type: "Email",
    contactId: contactId,
    subject: subject,
    message: "Please view this email in an HTML-compatible email client.",
    html: htmlContent,
    status: "pending"
  };
  
  const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: emailHeaders,
    body: JSON.stringify(emailPayload)
  });
  
  return res.ok;
}
