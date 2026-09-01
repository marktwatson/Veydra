// send-push — Web Push delivery using Web Crypto (no external npm deps).
// Sends a signed push message to all subscriptions for a given user_id (or
// a set of user_ids). The VAPID private key is read from push_settings.
//
// Called by other edge functions (stripe-webhook, royalty-processor,
// daily-reminders) via fetch. Also exposes a "test" action for the Profile UI.
//
// Request body:
//   { action?: "send" | "test",
//     user_ids?: string[],            // recipients (auth users)
//     category?: string,              // bookings_payments | royalty_finance | team_operations | daily_digest
//     title?: string, body?: string, url?: string, tag?: string }
//
// Per-category preferences are checked against push_preferences. If a user
// has the category disabled (or enabled=false), they are skipped.

import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Base64url helpers ──────────────────────────────────────────────────────
function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ── VAPID JWT (ES256) ──────────────────────────────────────────────────────
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyPem: Uint8Array,
): Promise<string> {
  // Import the P-256 private key (PKCS8 DER, base64url-encoded in our settings).
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyPem,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  // aud must be the origin of the push service (endpoint root).
  let aud = audience;
  try {
    const u = new URL(audience);
    aud = `${u.origin}`;
  } catch {}
  const payload = {
    aud,
    sub: subject,
    exp: now + 12 * 60 * 60, // 12 hours
  };

  const enc = (o: any) =>
    base64UrlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

// ── AES-GCM encryption of the payload according to RFC 8291 ──────────────────
async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();

  // 1. Import user agent's public key (P-256 ECDH) from p256dh subscription key.
  const userPublicKey = base64UrlDecode(p256dh);
  const userKey = await crypto.subtle.importKey(
    "raw",
    userPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // 2. Generate an ephemeral ECDH keypair for the application server.
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  // 3. Derive shared secret (ECDH) between ephemeral private + user public.
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: userKey },
      ephemeralKeyPair.privateKey,
      256,
    ),
  );

  // 4. Export the ephemeral public key (raw, 65 bytes uncompressed).
  const ephemeralPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey),
  );

  const authSecret = base64UrlDecode(auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. RFC 8291 Key Derivation:
  // Step A: PRK_key = HKDF-Extract(salt=authSecret, IKM=sharedSecret)
  const prkKey = await hkdfExtract(authSecret, sharedSecret);

  // Step B: key_info = "WebPush: info\0" || userPublicKey || ephemeralPublicKey
  const infoPrefix = encoder.encode("WebPush: info\0");
  const keyInfo = new Uint8Array(
    infoPrefix.length + userPublicKey.length + ephemeralPublicKey.length,
  );
  keyInfo.set(infoPrefix, 0);
  keyInfo.set(userPublicKey, infoPrefix.length);
  keyInfo.set(ephemeralPublicKey, infoPrefix.length + userPublicKey.length);

  // Step C: IKM = HKDF-Expand(PRK_key, key_info, 32)
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  // Step D: PRK = HKDF-Extract(salt=salt, IKM=ikm)
  const prk = await hkdfExtract(salt, ikm);

  // Step E: CEK = HKDF-Expand(PRK, "Content-Encoding: aes128gcm\0", 16)
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const cek = await hkdfExpand(prk, cekInfo, 16);

  // Step F: NONCE = HKDF-Expand(PRK, "Content-Encoding: nonce\0", 12)
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonce = await hkdfExpand(prk, nonceInfo, 12);

  // 6. Encrypt the payload with AES-128-GCM.
  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  // aes128gcm record: plaintext + padding delimiter (0x02)
  const plaintext = encoder.encode(payload);
  const record = new Uint8Array(plaintext.length + 1);
  record.set(plaintext, 0);
  record[plaintext.length] = 2; // delimiter

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      cekKey,
      record,
    ),
  );

  // 7. Build the aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(ephemeralPub)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + ephemeralPublicKey.length);
  header.set(salt, 0);
  const rsView = new DataView(header.buffer, 16, 4);
  rsView.setUint32(0, rs, false); // big-endian
  header[20] = ephemeralPublicKey.length; // idlen
  header.set(ephemeralPublicKey, 21);

  const result = new Uint8Array(header.length + encrypted.length);
  result.set(header, 0);
  result.set(encrypted, header.length);
  return result;
}

async function hkdfExtract(
  saltKey: Uint8Array,
  ikm: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    saltKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prkKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  // HKDF-Expand: T(1) = HMAC(prk, info | 0x01)
  const input = new Uint8Array(info.length + 1);
  input.set(info, 0);
  input[info.length] = 1;
  const t = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, input));
  return t.slice(0, length);
}

// ── Send one push message ───────────────────────────────────────────────────
async function sendPushMessage(
  subscription: { endpoint: string; p256dh_key: string; auth_key: string },
  payload: object,
  vapidPrivateB64: string,
  vapidPublicB64: string,
  subject: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const body = JSON.stringify(payload);
  const encrypted = await encryptPayload(
    body,
    subscription.p256dh_key,
    subscription.auth_key,
  );

  // Audience for VAPID JWT = endpoint origin.
  let audience = subscription.endpoint;
  try {
    const u = new URL(subscription.endpoint);
    audience = u.origin;
  } catch {}

  const vapidJwt = await createVapidJwt(
    audience,
    subject,
    base64UrlDecode(vapidPrivateB64),
  );

  // k= is the raw uncompressed P-256 public key (65 bytes, 0x04 prefix) in
  // base64url — exactly what we store in push_settings.vapid_public_key and
  // what the browser used as applicationServerKey. Use it directly instead of
  // trying to derive it from the private key (importKey("pkcs8").publicKey is
  // undefined in Deno, which broke every send silently).
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "2419200",
      "Authorization": `vapid t=${vapidJwt}, k=${vapidPublicB64}`,
    },
    body: encrypted,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text || `HTTP ${res.status}` };
  }
  return { ok: true, status: res.status };
}

// The VAPID public key is passed into sendPushMessage directly from
// push_settings.vapid_public_key (the raw 65-byte uncompressed key in
// base64url), so there's no need to derive it from the private key here.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      action = "send",
      user_ids = [],
      roles,
      category,
      title = "Veydra",
      body: msgBody = "",
      url = "/",
      tag,
    } = body;

    const su = Deno.env.get("SUPABASE_URL") || "";
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!su || !sk) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const db = createClient(su, sk);

    // Load VAPID keys.
    const { data: settings } = await db
      .from("push_settings")
      .select("vapid_public_key, vapid_private_key, subject")
      .limit(1)
      .maybeSingle();
    if (!settings?.vapid_private_key || !settings?.vapid_public_key) {
      return new Response(
        JSON.stringify({ error: "Push not configured (no VAPID keys)", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const vapidPublicB64 = settings.vapid_public_key;

    // Resolve recipients. Supports explicit user_ids OR a roles array
    // (e.g. ["owner","super_admin"]) expanded from the managers table, so other
    // edge functions can trigger pushes without each re-querying managers.
    let recipientIds: string[] = [...user_ids];
    if (roles && Array.isArray(roles) && roles.length) {
      const { data: roleManagers } = await db
        .from("managers")
        .select("id, role")
        .in("role", roles);
      const roleIds = (roleManagers || []).map((m: any) => m.id).filter(Boolean);
      recipientIds = [...new Set([...recipientIds, ...roleIds])];
    }
    if (action === "test") {
      // Resolve from Authorization header.
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      if (token) {
        const { data: userData } = await db.auth.getUser(token);
        if (userData?.user?.id) recipientIds = [userData.user.id];
      }
    }

    if (!recipientIds.length) {
      return new Response(
        JSON.stringify({ error: "No recipients specified", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Filter by per-category preferences (skip for "test").
    let finalRecipients = recipientIds;
    if (action !== "test" && category) {
      const { data: prefs } = await db
        .from("push_preferences")
        .select("user_id, enabled, bookings_payments, royalty_finance, team_operations, daily_digest")
        .in("user_id", recipientIds);
      finalRecipients = (prefs || [])
        .filter((p: any) => {
          if (p.enabled === false) return false;
          if (category === "bookings_payments") return p.bookings_payments !== false;
          if (category === "royalty_finance") return p.royalty_finance !== false;
          if (category === "team_operations") return p.team_operations !== false;
          if (category === "daily_digest") return p.daily_digest !== false;
          return true;
        })
        .map((p: any) => p.user_id);
      // If a recipient has no prefs row yet, default to enabled (they'll get it).
      const withPrefs = new Set(finalRecipients);
      for (const id of recipientIds) {
        if (!prefs?.find((p: any) => p.user_id === id)) finalRecipients.push(id);
      }
      finalRecipients = [...new Set([...withPrefs, ...recipientIds.filter((id) => !prefs?.find((p: any) => p.user_id === id))])];
    }

    if (!finalRecipients.length) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, skipped: "all disabled by preferences" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load subscriptions for the recipients.
    const { data: subscriptions } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key, user_id")
      .in("user_id", finalRecipients);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "no subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = { title, body: msgBody, url, tag: tag || category || "veydra" };
    let sent = 0;
    let failed = 0;
    const deadEndpoints: string[] = [];
    const details: { endpoint: string; status: number; ok: boolean; error?: string }[] = [];

    for (const sub of subscriptions) {
      try {
        const result = await sendPushMessage(
          sub as any,
          payload,
          settings.vapid_private_key,
          vapidPublicB64,
          settings.subject,
        );
        details.push({
          endpoint: (sub as any).endpoint,
          status: result.status,
          ok: result.ok,
          error: result.error,
        });
        if (result.ok) {
          sent++;
        } else {
          failed++;
          // 404 / 410 = subscription expired/invalid → clean up.
          if (result.status === 404 || result.status === 410) {
            deadEndpoints.push((sub as any).endpoint);
          }
        }
      } catch (e: any) {
        failed++;
        details.push({
          endpoint: (sub as any).endpoint,
          status: 0,
          ok: false,
          error: e?.message || String(e),
        });
      }
    }

    // Clean up dead subscriptions.
    if (deadEndpoints.length) {
      await db.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: subscriptions.length,
        // Include the push-service response for each subscription so the UI
        // can surface exactly why a test didn't arrive (e.g. 403 = VAPID
        // signature rejected, 404/410 = stale subscription, 201 = accepted).
        details: action === "test" ? details : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
