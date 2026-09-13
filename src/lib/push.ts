// Web Push subscription helper.
// Registers the service worker, requests notification permission, and
// saves the PushSubscription to the push_subscriptions table.

import { supabase } from "@/lib/supabase";

const SW_PATH = "/sw-push.js";

export type PushPermissionState =
  "granted" | "denied" | "default" | "unsupported";

export function getPushPermission(): PushPermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission as PushPermissionState;
}

export function isPushSupported(): boolean {
  return (
    typeof Notification !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

// Public VAPID key fallback. The public key is safe to expose (it's published
// in the service worker). We keep a copy here matching the keypair seeded in
// push_settings (master_sql) so that subscription still works even if the DB
// read fails for any reason (RLS, stale cache, table not yet synced). Because
// it matches the private key stored in the DB, pushes will decrypt correctly.
const FALLBACK_VAPID_PUBLIC_KEY =
  "BP2Rhk8b2-A77mHB2XCSJjKEs4SyP_L8t9qTWDeQchhFbe03XQ0FkdCPSCN5xC8f02D2dsmf2i26vh84FgrAWuo";

async function getVapidPublicKey(): Promise<string | null> {
  const { data, error } = await supabase
    .from("push_settings")
    .select("vapid_public_key")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn(
      "[Push] push_settings read failed, using fallback VAPID key:",
      error.message,
    );
    return FALLBACK_VAPID_PUBLIC_KEY;
  }
  if (!data?.vapid_public_key) {
    console.warn("[Push] push_settings empty, using fallback VAPID key");
    return FALLBACK_VAPID_PUBLIC_KEY;
  }
  // The key is stored base64url. applicationServerKey needs base64url BufferSource.
  return data.vapid_public_key;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Register the push service worker and (if permission granted) subscribe to
 * push. Returns the subscription JSON or null if not supported/permission
 * denied. Saves the subscription to push_subscriptions for the current user.
 */
export async function subscribeToPush(userId: string, userEmail?: string) {
  if (!isPushSupported()) {
    throw new Error(
      "Push notifications are not supported on this device/browser.",
    );
  }

  const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was denied.");
  }

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) {
    throw new Error(
      "Push notifications are not configured (missing VAPID key).",
    );
  }

  // Always start from a clean subscription. If a previous subscription
  // exists (possibly created with a different/old VAPID key), the push
  // service would reject new messages signed with the current key — a
  // silent failure where "Send Test" reports sent:0 or the message never
  // arrives. Unsubscribe first, then create a fresh one with the current
  // applicationServerKey.
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
    } catch {}
    try {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", existing.endpoint);
    } catch {}
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidKey) as BufferSource,
  });

  const json = subscription.toJSON();
  // Save to DB (upsert by endpoint so re-subscribing doesn't duplicate).
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      user_email: userEmail || null,
      endpoint: json.endpoint,
      p256dh_key: json.keys?.p256dh,
      auth_key: json.keys?.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);

  return subscription;
}

/**
 * Unsubscribe the current device from push and remove the DB row.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (reg) {
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint);
      return true;
    }
  }
  return false;
}

/**
 * Check whether this device is currently subscribed.
 */
export async function isCurrentlySubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!reg) return false;
    const subscription = await reg.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
