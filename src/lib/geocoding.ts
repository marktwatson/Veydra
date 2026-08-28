import { supabase, supabaseUrl } from "@/lib/supabase";

const LOCAL_GEOCODE_CACHE_KEY = "veydra_geocode_cache_v3";

/**
 * Normalize a messy venue location string into something a geocoder can parse.
 * Handles multi-line entries, parentheticals, slashes, and redundant city/state.
 * Examples:
 *   "Pilgrim Congregational/ Tennessee Aquarium Chattanooga, TN"
 *     → "Pilgrim Congregational, Chattanooga, TN"
 *   "729 Chestnut St. (St. John's) Signal Mountain(the boals' and church), Chattanooga (st. John's), TN"
 *     → "729 Chestnut St, Signal Mountain, Chattanooga, TN"
 *   "River Point Ranch Carthage , TN" → "River Point Ranch, Carthage, TN"
 */
function normalizeVenueLocation(raw: string): string {
  let s = raw.trim();

  // Remove parentheticals entirely — they're notes, not address parts
  s = s.replace(/\([^)]*\)/g, "");

  // Replace slashes with commas (they separate venue segments)
  s = s.replace(/\s*\/\s*/g, ", ");

  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, " ");

  // Collapse "City , ST" → "City, ST"
  s = s.replace(/\s*,\s*/g, ", ");

  // Remove trailing punctuation/whitespace
  s = s.replace(/[.,\s]+$/g, "").trim();

  // If the string has multiple comma-separated parts AND ends with a state code,
  // keep the most address-like parts: take the first venue name + last "City, ST"
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 3) {
    const lastPart = parts[parts.length - 1];
    const isStateCode = /^[A-Z]{2}$/.test(lastPart);
    if (isStateCode) {
      const city = parts[parts.length - 2] || "";
      const venueName = parts[0];
      s = `${venueName}, ${city}, ${lastPart}`;
    }
  }

  return s.trim();
}

/**
 * Geocode an address using OpenStreetMap Nominatim (free, no API key).
 * Checks local cache first, then DB cache (weddings table), then live API.
 */
export async function geocodeAddress(
  address: string,
  force = false,
): Promise<[number, number] | null> {
  if (!address || address === "TBD") return null;
  const normalized = normalizeVenueLocation(address);
  if (!normalized || normalized === "TBD") return null;

  // Skip cache lookups when force=true
  if (!force) {
    // 1. Check local cache (try both normalized and raw)
    try {
      const cache = JSON.parse(
        localStorage.getItem(LOCAL_GEOCODE_CACHE_KEY) || "{}",
      );
      if (cache[normalized]) return cache[normalized];
      if (cache[address]) return cache[address];
    } catch {}

    // 2. Check DB cache — venue_geocodes table
    try {
      const { data } = await supabase
        .from("venue_geocodes")
        .select("lat, lng")
        .or(`location.eq.${normalized},location.eq.${address}`)
        .limit(1);
      if (
        data &&
        data.length > 0 &&
        data[0].lat != null &&
        data[0].lng != null
      ) {
        const coords: [number, number] = [data[0].lat, data[0].lng];
        saveLocalCache(normalized, coords);
        return coords;
      }
    } catch {}

    // 3. Check weddings table for coords (legacy cache)
    try {
      const { data } = await supabase
        .from("weddings")
        .select("venue_lat, venue_lng")
        .or(`location.eq.${normalized},location.eq.${address}`)
        .not("venue_lat", "is", null)
        .limit(1);
      if (
        data &&
        data.length > 0 &&
        data[0].venue_lat != null &&
        data[0].venue_lng != null
      ) {
        const coords: [number, number] = [data[0].venue_lat, data[0].venue_lng];
        saveLocalCache(normalized, coords);
        return coords;
      }
    } catch {}
  }

  // 4. Live geocode via our edge function (server-side, no CORS, proper rate limiting)
  // Send the normalized address — much more likely to get a result
  try {
    const { data: session } = await supabase.auth.getSession();

    const response = await fetch(`${supabaseUrl}/functions/v1/geocode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.session?.access_token || ""}`,
      },
      body: JSON.stringify({ address: normalized, force }),
    });

    if (!response.ok) {
      console.warn(
        `[geocode] Edge function returned ${response.status} for "${normalized}"`,
      );
      return null;
    }

    const result = await response.json();

    if (result.success && result.coords) {
      const coords: [number, number] = [result.coords.lat, result.coords.lng];
      saveLocalCache(normalized, coords);
      console.log(
        `[geocode] SUCCESS: "${normalized}" → ${coords[0]}, ${coords[1]}${result.fallback ? " (fallback)" : ""}`,
      );
      return coords;
    } else {
      console.warn(
        `[geocode] NO RESULTS for "${normalized}"${result.error ? ` — ${result.error}` : ""}`,
      );
    }
  } catch (error) {
    console.error("[geocode] Error:", error);
  }

  return null;
}

function saveLocalCache(address: string, coords: [number, number]) {
  try {
    const cache = JSON.parse(
      localStorage.getItem(LOCAL_GEOCODE_CACHE_KEY) || "{}",
    );
    cache[address] = coords;
    localStorage.setItem(LOCAL_GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

/**
 * Geocode and persist the result to the DB so all territories share the cache.
 */
export async function geocodeAndCacheToDB(
  address: string,
  weddingId?: string,
  force = false,
): Promise<[number, number] | null> {
  const coords = await geocodeAddress(address, force);
  if (coords) {
    // Persist to venue_geocodes table (works for ALL locations — leads, proposals, weddings)
    try {
      await supabase.from("venue_geocodes").upsert(
        {
          location: address,
          lat: coords[0],
          lng: coords[1],
          geocoded_at: new Date().toISOString(),
        },
        { onConflict: "location" },
      );
    } catch (e) {
      console.error("Failed to persist geocode to venue_geocodes:", e);
    }

    // Also persist to ALL weddings with this location (legacy cache)
    try {
      await supabase
        .from("weddings")
        .update({
          venue_lat: coords[0],
          venue_lng: coords[1],
          venue_geocoded_at: new Date().toISOString(),
        })
        .eq("location", address);
    } catch (e) {
      console.error("Failed to persist geocode to weddings table:", e);
    }
  }
  return coords;
}

/**
 * Read the local geocode cache (localStorage) for a given address.
 * Used as a fallback when DB doesn't have coords yet.
 */
export function getCachedCoords(address: string): [number, number] | null {
  if (!address || address === "TBD") return null;
  try {
    const cache = JSON.parse(
      localStorage.getItem(LOCAL_GEOCODE_CACHE_KEY) || "{}",
    );
    return cache[address] || null;
  } catch {
    return null;
  }
}

export function calculateDistanceMiles(
  coord1: [number, number],
  coord2: [number, number],
): number {
  const R = 3958.8;
  const lat1 = (coord1[0] * Math.PI) / 180;
  const lon1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[0] * Math.PI) / 180;
  const lon2 = (coord2[1] * Math.PI) / 180;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
