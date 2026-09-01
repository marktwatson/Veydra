// Push notification API methods — kept separate from the oversized api.ts.
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";

export type PushCategory =
  "bookings_payments" | "royalty_finance" | "team_operations" | "daily_digest";

export interface PushPreferences {
  enabled: boolean;
  bookings_payments: boolean;
  royalty_finance: boolean;
  team_operations: boolean;
  daily_digest: boolean;
}

const DEFAULT_PREFS: PushPreferences = {
  enabled: true,
  bookings_payments: true,
  royalty_finance: true,
  team_operations: false,
  daily_digest: true,
};

// Send a test push to the current user (Profile "Send Test" button).
export async function sendTestPush() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const functionUrl = `${supabaseUrl}/functions/v1/send-push`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      action: "test",
      title: "Veydra — Test Notification",
      body: "Push notifications are working! You'll receive alerts here.",
      url: "/manager",
      tag: "test-push",
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      json?.error || `Test push failed (HTTP ${response.status})`,
    );
  }
  // The edge fn returns { success, sent, failed, total } or a skip reason.
  // If it sent 0 and there's a reason, surface it so the user knows why
  // nothing arrived (e.g. "no subscriptions" = device not registered).
  if (json && json.sent === 0 && json.reason) {
    throw new Error(`No notification sent — ${json.reason}.`);
  }
  if (json && json.sent === 0 && json.skipped) {
    throw new Error(`Skipped — ${json.skipped}.`);
  }
  // Surface the push-service response code per subscription so we can
  // diagnose silent failures (403 = VAPID rejected, 201 = accepted).
  if (Array.isArray(json.details) && json.details.length) {
    (json as any)._detailSummary = json.details
      .map(
        (d: any) =>
          `${d.status}${d.ok ? " ok" : " FAIL"}${d.error ? ` (${d.error})` : ""}`,
      )
      .join(" | ");
  }
  return json;
}

// Fire-and-forget push. Supports explicit userIds OR a roles array
// (["owner","super_admin"]) which the send-push edge fn expands from the
// managers table. Best-effort — never throws.
export async function sendPushNotification(opts: {
  userIds?: string[];
  roles?: string[];
  category: PushCategory;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  try {
    const functionUrl = `${supabaseUrl}/functions/v1/send-push`;
    await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        action: "send",
        user_ids: opts.userIds || [],
        roles: opts.roles,
        category: opts.category,
        title: opts.title,
        body: opts.body,
        url: opts.url || "/manager",
        tag: opts.tag,
      }),
    });
  } catch (e) {
    console.warn("[Push] send failed:", e);
  }
}

// Trigger the daily-digest edge function (owners + super_admins get a morning
// summary push). Fire-and-forget — called from the daily heartbeat.
export async function triggerDailyDigest(): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/daily-digest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({}),
    });
  } catch (e) {
    console.warn("[Push] daily-digest trigger failed:", e);
  }
}

// Manually trigger the daily-digest with force: true so it bypasses the
// once-per-day guard. Returns the digest payload so the UI can show what was
// sent. Used by the "Send Digest Now" button for testing.
export async function sendDigestNow(): Promise<{
  success: boolean;
  digest?: any;
  body?: string;
  error?: string;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const functionUrl = `${supabaseUrl}/functions/v1/daily-digest`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ force: true }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || `Digest failed (HTTP ${response.status})`);
  }
  return json;
}

// Load the current user's push preferences (returns defaults if none saved).
export async function getPushPreferences(
  userId: string,
): Promise<PushPreferences> {
  const { data, error } = await supabase
    .from("push_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...DEFAULT_PREFS };
  return {
    enabled: data.enabled ?? true,
    bookings_payments: data.bookings_payments ?? true,
    royalty_finance: data.royalty_finance ?? true,
    team_operations: data.team_operations ?? false,
    daily_digest: data.daily_digest ?? true,
  };
}

// Upsert the current user's push preferences.
export async function savePushPreferences(
  userId: string,
  prefs: PushPreferences,
): Promise<PushPreferences> {
  const { data, error } = await supabase
    .from("push_preferences")
    .upsert(
      { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select()
    .maybeSingle();
  if (error) throw error;
  return {
    enabled: data.enabled,
    bookings_payments: data.bookings_payments,
    royalty_finance: data.royalty_finance,
    team_operations: data.team_operations,
    daily_digest: data.daily_digest,
  };
}
