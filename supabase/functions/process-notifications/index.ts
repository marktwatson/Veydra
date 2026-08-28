import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Check if this was triggered by a database webhook or API call
    await req.json().catch(() => null);
    
    // Fetch pending notifications
    const { data: pendingNotifs, error: fetchError } = await supabaseClient
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20);
      
    if (fetchError) throw fetchError;
    
    if (!pendingNotifs || pendingNotifs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending notifications" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings } = await supabaseClient
      .from("portal_settings")
      .select("hl_api_key, hl_location_id")
      .limit(1)
      .single();

    if (!settings?.hl_api_key || !settings?.hl_location_id) {
      throw new Error("Missing Ovanta API credentials in the database.");
    }

    const OVANTA_API_KEY = settings.hl_api_key;
    const OVANTA_LOCATION_ID = settings.hl_location_id;
    
    for (const notif of pendingNotifs) {
      // Mark as processing
      await supabaseClient
        .from('notification_queue')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', notif.id);
        
      try {
        let success = false;
        
        if (notif.type === 'email') {
          const { email, subject, html, name, force } = notif.payload;
          
          if (!force) {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: recent } = await supabaseClient
              .from("sms_logs")
              .select("id")
              .eq("recipient_email", email)
              .eq("message", `[EMAIL: ${subject}]\n${html}`)
              .eq("status", "success")
              .gte("created_at", yesterday)
              .limit(1);
              
            if (recent && recent.length > 0) {
              console.log(`Skipping duplicate Email to ${email}`);
              success = true;
            }
          }

          if (!success) {
            // 1. Find contact
            const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${OVANTA_LOCATION_ID}&query=${encodeURIComponent(email)}`, {
              headers: { "Authorization": `Bearer ${OVANTA_API_KEY}`, "Version": "2021-07-28" }
            });
            let contactId = null;
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              contactId = searchData.contacts?.[0]?.id;
            }
            
            if (!contactId) {
              // Create contact
              const createPayload: any = { locationId: OVANTA_LOCATION_ID, email, tags: ["portal-auto-created"] };
              if (name) {
                const parts = name.trim().split(" ");
                createPayload.firstName = parts[0];
                if (parts.length > 1) createPayload.lastName = parts.slice(1).join(" ");
              }
              const createRes = await fetch(`https://services.leadconnectorhq.com/contacts/`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${OVANTA_API_KEY}`, "Version": "2021-07-28", "Content-Type": "application/json" },
                body: JSON.stringify(createPayload)
              });
              if (createRes.ok) {
                const createData = await createRes.json();
                contactId = createData.contact?.id;
              } else {
                const errData = await createRes.json().catch(() => null);
                if (errData?.meta?.contactId) {
                  contactId = errData.meta.contactId;
                } else {
                  throw new Error(`Failed to auto-create contact in CRM: ${JSON.stringify(errData || await createRes.text())}`);
                }
              }
            }
            
            if (!contactId) throw new Error("Could not find or create contact in Ovanta.");
            
            // 2. Send Email
            const emailRes = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${OVANTA_API_KEY}`,
                "Version": "2021-04-15",
                "Content-Type": "application/json",
                "Accept": "application/json"
              },
              body: JSON.stringify({
                type: "Email",
                contactId: contactId,
                subject: subject,
                html: html,
                message: "Please view the HTML version of this email."
              })
            });
            
            if (!emailRes.ok) throw new Error(`Email API Error: ${await emailRes.text()}`);
            
            await supabaseClient.from("sms_logs").insert({
              recipient_email: email,
              message: `[EMAIL: ${subject}]\n${html}`,
              status: "success"
            });
            success = true;
          }
          
        } else if (notif.type === 'sms') {
          const { email, message, name, force } = notif.payload;
          
          if (!force) {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: recent } = await supabaseClient
              .from("sms_logs")
              .select("id")
              .eq("recipient_email", email)
              .eq("message", message)
              .eq("status", "success")
              .gte("created_at", yesterday)
              .limit(1);
              
            if (recent && recent.length > 0) {
              console.log(`Skipping duplicate SMS to ${email}`);
              success = true;
            }
          }

          if (!success) {
            // 1. Find contact
            const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${OVANTA_LOCATION_ID}&query=${encodeURIComponent(email)}`, {
              headers: { "Authorization": `Bearer ${OVANTA_API_KEY}`, "Version": "2021-07-28" }
            });
            let contactId = null;
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              contactId = searchData.contacts?.[0]?.id;
            }
            
            if (!contactId) {
              // Create contact
              const createPayload: any = { locationId: OVANTA_LOCATION_ID, email, tags: ["portal-auto-created"] };
              if (name) {
                const parts = name.trim().split(" ");
                createPayload.firstName = parts[0];
                if (parts.length > 1) createPayload.lastName = parts.slice(1).join(" ");
              }
              const createRes = await fetch(`https://services.leadconnectorhq.com/contacts/`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${OVANTA_API_KEY}`, "Version": "2021-07-28", "Content-Type": "application/json" },
                body: JSON.stringify(createPayload)
              });
              if (createRes.ok) {
                const createData = await createRes.json();
                contactId = createData.contact?.id;
              } else {
                const errData = await createRes.json().catch(() => null);
                if (errData?.meta?.contactId) {
                  contactId = errData.meta.contactId;
                } else {
                  throw new Error(`Failed to auto-create contact in CRM: ${JSON.stringify(errData || await createRes.text())}`);
                }
              }
            }
            
            if (!contactId) throw new Error("Could not find or create contact in Ovanta.");
            
            // 2. Send SMS
            const smsRes = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${OVANTA_API_KEY}`,
                "Version": "2021-04-15",
                "Content-Type": "application/json",
                "Accept": "application/json"
              },
              body: JSON.stringify({
                type: "SMS",
                contactId: contactId,
                message: message
              })
            });
            
            if (!smsRes.ok) throw new Error(`SMS API Error: ${await smsRes.text()}`);
            
            await supabaseClient.from("sms_logs").insert({
              recipient_email: email,
              message: message,
              status: "success"
            });
            success = true;
          }
        }
        
        if (success) {
          await supabaseClient
            .from('notification_queue')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', notif.id);
        }
        
      } catch (err) {
        await supabaseClient
          .from('notification_queue')
          .update({ 
            status: 'failed', 
            error_message: err.message,
            retry_count: notif.retry_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', notif.id);
          
        await supabaseClient.from("sms_logs").insert({
          recipient_email: notif.payload?.email || "unknown",
          message: notif.payload?.message || notif.payload?.html || "unknown",
          status: "error",
          error_details: err.message
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: pendingNotifs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})