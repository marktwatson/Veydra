import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS', 
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
      } 
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Capture EVERYTHING as raw text first
    const rawText = await req.text();
    let payload: any = {};
    
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      // If it's not JSON, maybe it's form-encoded
      if (rawText.includes('=')) {
        const params = new URLSearchParams(rawText);
        payload = Object.fromEntries(params.entries());
      }
    }
    
    // Handle both camelCase and snake_case variations from different CRM webhooks
    const contactId = payload.contactId || payload.contact_id || payload.id || payload.contact?.id || "unknown";
    const firstName = payload.firstName || payload.first_name || payload.contact?.first_name || payload.contact?.firstName || "";
    const lastName = payload.lastName || payload.last_name || payload.contact?.last_name || payload.contact?.lastName || "";
    const email = payload.email || payload.contact?.email || "";
    const phone = payload.phone || payload.contact?.phone || "";
    
    // Tags can be an array or a comma-separated string, and might be nested
    const rawTags = payload.tags || payload.contact?.tags || payload.customData?.tags;
    
    let tagsList: string[] = [];
    if (Array.isArray(rawTags)) {
      tagsList = rawTags.map((t: any) => String(t).toLowerCase().trim());
    } else if (typeof rawTags === 'string') {
      tagsList = rawTags.toLowerCase().split(',').map((t: string) => t.trim());
    }

    // Helper to recursively search the payload for specific keys with exact matching first
    function recursiveFind(obj: any, keysToFind: string[]): string {
      if (!obj || typeof obj !== 'object') return "";
      
      // 1. Exact match on keys first
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (keysToFind.includes(lowerKey)) {
          if (typeof value === 'string' || typeof value === 'number') return String(value);
          if (value && typeof value === 'object' && 'value' in (value as any)) return String((value as any).value);
        }
      }

      // 2. Exact match in arrays (custom fields array)
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (item && typeof item === 'object') {
            const itemName = String(item.name || item.key || item.id || "").toLowerCase();
            if (itemName && keysToFind.includes(itemName)) {
              const val = item.value || item.field_value || item.text || item.fieldValue;
              if (val !== undefined && val !== null) return String(val);
            }
          }
        }
        
        // Recurse array children
        for (const item of obj) {
          const found = recursiveFind(item, keysToFind);
          if (found) return found;
        }
        return "";
      }
      
      // 3. Recurse object children
      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
          const found = recursiveFind(value, keysToFind);
          if (found) return found;
        }
      }
      
      // 4. Partial match as absolute last resort
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (keysToFind.some(k => lowerKey.includes(k))) {
          if (typeof value === 'string' || typeof value === 'number') return String(value);
          if (value && typeof value === 'object' && 'value' in (value as any)) return String((value as any).value);
        }
      }
      
      return "";
    }
    
    // Check for Wedding Import tags (case-insensitive now)
    const validTags = ["bride", "groom", "wedding", "new lead", "booked"];
    const hasValidTag = tagsList.some((t: string) => validTags.includes(t));
    
    if (hasValidTag) {
      // DEDUPLICATION: Check if a wedding with this email already exists.
      // The Stripe webhook adds the "booked" tag to CRM after a /book payment,
      // which would trigger this webhook and create a duplicate wedding.
      if (email) {
        const { data: existingWeddings } = await supabase
          .from("weddings")
          .select("id, client_email, status")
          .eq("client_email", email)
          .limit(1);

        if (existingWeddings && existingWeddings.length > 0) {
          return new Response(JSON.stringify({
            success: true,
            message: `Wedding already exists for ${email} (id: ${existingWeddings[0].id}). Skipping creation to prevent duplicate.`,
            duplicate: true,
            existingWeddingId: existingWeddings[0].id
          }), {
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // Prioritize "Couples Name" if it exists, otherwise use First Name & Partner Name
      const couplesName = recursiveFind(payload, ["couples name", "couple name", "couples_name", "couple_name", "couple's name"]);
      const partnerName = recursiveFind(payload, ["partner name", "partner_name", "groom name", "groom_name", "spouse"]);
      
      let clientName = "";
      if (couplesName) {
        clientName = couplesName;
      } else if (partnerName) {
        clientName = `${firstName} & ${partnerName}`.trim();
      } else {
        clientName = `${firstName} ${lastName}`.trim();
      }
      if (!clientName) clientName = "New Client";
      
      let weddingDate = recursiveFind(payload, ["wedding date", "wedding_date", "event date", "event_date"]);
      if (!weddingDate) weddingDate = recursiveFind(payload, ["date"]); 
      
      if (!weddingDate) {
        weddingDate = new Date().toISOString().split('T')[0];
      }

      // Prioritize venue_address exactly
      let venue = recursiveFind(payload, ["venue_address", "venue address"]);
      if (!venue) venue = recursiveFind(payload, ["venue", "location name"]);
      
      const city = recursiveFind(payload, ["city", "wedding city"]);
      const state = recursiveFind(payload, ["state", "wedding state"]);
      
      let location = venue || "TBD";
      // If venue is just a name (no commas) and city/state exist, combine them
      if (venue && !venue.includes(',') && (city || state)) {
        location = [venue, city, state].filter(Boolean).join(', ');
      } else if (!venue && (city || state)) {
        location = [city, state].filter(Boolean).join(', ');
      }
      
      let packageName = recursiveFind(payload, ["package", "package_name", "selected package"]);
      if (!packageName) packageName = "Custom";
      
      const addons = recursiveFind(payload, ["add_ons", "addons", "add ons"]);
      const notes = recursiveFind(payload, ["notes", "additional info", "message"]);
      
      const fullNotes = `Package: ${packageName}${addons ? `\nAddons: ${addons}` : ''}
CRM Contact ID: ${contactId}
Email: ${email}
Phone: ${phone}
Notes: ${notes}

--- Raw Data Backup ---
${rawText}`;

      const { error } = await supabase.from("weddings").insert({
        client_name: clientName,
        date: weddingDate,
        location: location,
        status: "pending",
        notes: fullNotes,
      });

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ success: true, message: `Wedding created for ${clientName}` }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      message: "No relevant tags found, or payload was empty.", 
      receivedTags: tagsList,
      rawText: rawText || "EMPTY_BODY",
      headers: Object.fromEntries(req.headers.entries())
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
});
