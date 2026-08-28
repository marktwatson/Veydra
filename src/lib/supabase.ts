import { createClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "@/config";

// ───────────────────────────────────────────────────────────────────────────
// Connection resolution — env vars win (Cloudflare), otherwise src/config.ts
// (AI Studio / local). Edit src/config.ts to repoint at a different project.
// ───────────────────────────────────────────────────────────────────────────
export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || APP_CONFIG.supabaseUrl;

export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || APP_CONFIG.supabaseAnonKey;

export const areaId = import.meta.env.VITE_AREA_ID || APP_CONFIG.areaId;

export const areaSlug = import.meta.env.VITE_AREA_SLUG || APP_CONFIG.areaSlug;

export const appUrl = import.meta.env.VITE_APP_URL || APP_CONFIG.appUrl;

// True when we have both a URL and an anon key. When false, main.tsx renders a
// "Missing Supabase config" screen instead of booting the app.
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const READ_ONLY_ERROR =
  "Your account is read-only. You can view data but cannot make changes. Contact a Super Admin if you need edit access.";

/**
 * Returns true if the currently logged-in user has the owner_readonly role.
 * Reads from the same localStorage keys AuthContext writes so it works
 * synchronously without a DB round-trip.
 */
function isReadOnlyUser(): boolean {
  try {
    const impersonated = localStorage.getItem("impersonated_user");
    if (impersonated) {
      const parsed = JSON.parse(impersonated);
      if (parsed?.role === "owner_readonly") return true;
    }
    const role = localStorage.getItem("veydra_effective_role");
    if (role === "owner_readonly") return true;
  } catch (e) {}
  return false;
}

// Use safe placeholders so createClient never throws when config is missing;
// main.tsx guards the UI and never reaches the client in that case.
const rawClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: "veydra-auth-v7",
    },
    global: {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  },
);

/**
 * Wrap the supabase client so that any write operation (insert/update/upsert/
 * delete) throws immediately when the current user has the owner_readonly role.
 * Reads (select) and auth operations are unaffected.
 *
 * This is the single enforcement point for the "Owner (Read Only)" role —
 * every mutating API method in the app goes through this client, so blocking
 * here guarantees nothing is written regardless of which button is clicked.
 */
function makeReadOnlyError() {
  return Promise.reject({ message: READ_ONLY_ERROR, code: "READ_ONLY" });
}

function rejectBuilder() {
  const builder: any = {
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    is: () => builder,
    in: () => builder,
    contains: () => builder,
    containedBy: () => builder,
    range: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => makeReadOnlyError(),
    maybeSingle: () => makeReadOnlyError(),
    then: (resolve: any) => makeReadOnlyError().then(resolve, () => {}),
  };
  // Make it thenable so `await` rejects
  builder.then = (resolve: any, reject: any) =>
    makeReadOnlyError().then(resolve, reject);
  return builder;
}

function wrapFrom(originalFrom: any) {
  return function from(table: string) {
    const query = originalFrom.call(rawClient, table);
    if (!query) return query;

    // Only intercept write builders when the user is read-only.
    const intercept = (method: string) => {
      const original = query[method];
      if (typeof original !== "function") return;
      query[method] = function (...args: any[]) {
        if (isReadOnlyUser()) {
          return rejectBuilder();
        }
        return original.apply(query, args);
      };
    };

    intercept("insert");
    intercept("update");
    intercept("upsert");
    intercept("delete");

    return query;
  };
}

export const supabase = new Proxy(rawClient as any, {
  get(target, prop, receiver) {
    if (prop === "from") {
      return wrapFrom(target.from);
    }
    // Everything else (auth, storage, channel, rpc, etc.) passes through.
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
