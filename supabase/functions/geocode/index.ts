import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "Veydra/1.0",
};

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number; display_name: string } | null> {
  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=1&email=hello@veydra.com`;
  const response = await fetch(url, { headers: NOMINATIM_HEADERS });

  if (response.status === 429) {
    console.log(`[geocode] Rate limited, waiting 3s...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const retry = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!retry.ok) return null;
    const data = await retry.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name };
    }
    return null;
  }

  if (!response.ok) {
    console.error(`[geocode] Nominatim HTTP ${response.status} for "${query}"`);
    return null;
  }

  const data = await response.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name };
  }
  return null;
}

// Structured search using Nominatim's structured params — much better for "City, ST" lookups
async function nominatimStructured(city: string, state: string): Promise<{ lat: number; lng: number; display_name: string } | null> {
  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    city: city,
    state: state,
    country: "US",
    email: "hello@veydra.com",
  });
  const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
  const response = await fetch(url, { headers: NOMINATIM_HEADERS });

  if (!response.ok) return null;

  const data = await response.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name };
  }
  return null;
}

// Parse "Venue Name, City, ST" into parts
function parseAddress(address: string): { venue?: string; city?: string; state?: string } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const result: { venue?: string; city?: string; state?: string } = {};

  if (parts.length >= 1) {
    const last = parts[parts.length - 1];
    if (/^[A-Z]{2}$/.test(last)) {
      result.state = last;
      if (parts.length >= 2) result.city = parts[parts.length - 2];
      if (parts.length >= 3) result.venue = parts.slice(0, -2).join(", ");
    } else {
      // No state code — treat the whole thing as a venue/query
      result.venue = address;
    }
  }

  return result;
}

// When venue name and city are merged (e.g. "River Point Ranch Carthage"),
// try extracting the last 1-2 words as the city name.
function extractCityCandidates(merged: string): string[] {
  const words = merged.trim().split(/\s+/);
  const candidates: string[] = [];
  if (words.length >= 2) candidates.push(words[words.length - 1]);           // last word
  if (words.length >= 3) candidates.push(words.slice(-2).join(" "));         // last 2 words
  if (words.length >= 4) candidates.push(words.slice(-3).join(" "));         // last 3 words
  return candidates;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { address, force } = await req.json();

    if (!address) {
      return new Response(JSON.stringify({ error: 'Address is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[geocode] Processing: "${address}"${force ? " (force re-geocode)" : ""}`);

    // Rate limit: wait between requests
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const parsed = parseAddress(address);

    // Strategy 1: If we have a city + state, try structured search FIRST (most reliable for venues)
    if (parsed.city && parsed.state) {
      console.log(`[geocode] Trying structured: city="${parsed.city}", state="${parsed.state}"`);
      const structured = await nominatimStructured(parsed.city, parsed.state);
      if (structured) {
        console.log(`[geocode] STRUCTURED SUCCESS: "${parsed.city}, ${parsed.state}" → ${structured.lat}, ${structured.lng}`);
        return new Response(JSON.stringify({ success: true, coords: structured, method: "structured" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Strategy 2: Try "City, ST" text search
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const cityState = `${parsed.city}, ${parsed.state}`;
      console.log(`[geocode] Trying city+state text: "${cityState}"`);
      const csResult = await nominatimSearch(cityState);
      if (csResult) {
        console.log(`[geocode] CITY+STATE SUCCESS: "${cityState}" → ${csResult.lat}, ${csResult.lng}`);
        return new Response(JSON.stringify({ success: true, coords: csResult, method: "city_state" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Strategy 3: Try the full original address (sometimes Nominatim finds the venue)
    await new Promise((resolve) => setTimeout(resolve, 1100));
    console.log(`[geocode] Trying full address: "${address}"`);
    const fullResult = await nominatimSearch(address);
    if (fullResult) {
      console.log(`[geocode] FULL ADDRESS SUCCESS: "${address}" → ${fullResult.lat}, ${fullResult.lng}`);
      return new Response(JSON.stringify({ success: true, coords: fullResult, method: "full" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Strategy 4: Try just the venue name + state (skip city, sometimes venue is well-known)
    if (parsed.venue && parsed.state) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const venueState = `${parsed.venue}, ${parsed.state}, USA`;
      console.log(`[geocode] Trying venue+state: "${venueState}"`);
      const vsResult = await nominatimSearch(venueState);
      if (vsResult) {
        console.log(`[geocode] VENUE+STATE SUCCESS: "${venueState}" → ${vsResult.lat}, ${vsResult.lng}`);
        return new Response(JSON.stringify({ success: true, coords: vsResult, method: "venue_state" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Strategy 5: The "city" field might have venue name merged in (e.g. "River Point Ranch Carthage").
    // Try extracting the last 1, 2, 3 words as the city name and do structured search.
    if (parsed.state) {
      const cityCandidate = parsed.city || parsed.venue;
      if (cityCandidate) {
        const cityCandidates = extractCityCandidates(cityCandidate);
        for (const cityGuess of cityCandidates) {
          await new Promise((resolve) => setTimeout(resolve, 1100));
          console.log(`[geocode] Trying extracted city guess: "${cityGuess}, ${parsed.state}"`);
          const guessResult = await nominatimStructured(cityGuess, parsed.state);
          if (guessResult) {
            console.log(`[geocode] CITY GUESS SUCCESS: "${cityGuess}, ${parsed.state}" → ${guessResult.lat}, ${guessResult.lng}`);
            return new Response(JSON.stringify({ success: true, coords: guessResult, method: "city_guess", fallback: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
    }

    // NO state-only fallback — it returns the geographic center of the state,
    // which is misleading (all venues in TN would get the same point).
    console.warn(`[geocode] NO RESULTS for "${address}" (all strategies exhausted, no state fallback)`);
    return new Response(JSON.stringify({ success: false, error: 'Location not found — try adding a city to the venue name' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[geocode] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
