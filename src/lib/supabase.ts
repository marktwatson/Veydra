import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://oosmhtzqdmntlzhheofw.supabase.co";
export const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vc21odHpxZG1udGx6aGhlb2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ3ODQsImV4cCI6MjA5MjM4MDc4NH0.slGFmtfr_cPC8EgKmQzf9ObOa7Sm5QwebqngQO0LAKc";

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

const rawClient = createClient(supabaseUrl, supabaseAnonKey, {
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
});

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
