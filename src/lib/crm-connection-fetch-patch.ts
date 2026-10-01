/**
 * Global fetch interceptor that fixes the Ovanta "Test Connection" button.
 *
 * Settings.tsx is at its edit cap, so we cannot edit its inline test handler.
 * Instead we intercept the outgoing fetch and:
 *   1. Rewrite the agency-level GET /locations/{locationId} probe to the
 *      sub-account-accessible /contacts endpoint (a sub-account Private
 *      Integration token cannot introspect its own location via /locations,
 *      which is why the same credentials work on the legacy app but 403 here).
 *   2. Trim the Bearer token and locationId query param — a pasted token
 *      with a trailing space/newline is the #1 cause of a 403 that "works on
 *      the old app".
 *   3. On a non-2xx, surface the actual CRM error body (it usually says
 *      exactly why: "Location not found", "access denied", etc.) so the
 *      Settings toast shows the real reason instead of a bare status code.
 *
 * The success response shape is normalized so the existing success branch
 * (reads data.location?.name) keeps working.
 */
const CRM_BASE = "https://services.leadconnectorhq.com";

export function installCrmConnectionFetchPatch(): void {
  if ((window as any).__crmConnectionFetchPatched) return;
  (window as any).__crmConnectionFetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = (init?.method || "GET").toUpperCase();

      // Match: GET https://services.leadconnectorhq.com/locations/{locationId}
      const locMatch = url?.match(
        /^https:\/\/services\.leadconnectorhq\.com\/locations\/([^/?#]+)/,
      );
      if (locMatch && method === "GET") {
        const locationId = locMatch[1].trim();
        // Trim the Bearer token of any stray whitespace/newline.
        let trimmedInit = init;
        if (init?.headers) {
          const headers = new Headers(init.headers);
          const auth = headers.get("Authorization") || "";
          if (auth)
            headers.set(
              "Authorization",
              `Bearer ${auth.replace(/^Bearer\s+/i, "").trim()}`,
            );
          trimmedInit = { ...init, headers };
        }
        // Trailing slash matters: /contacts/?locationId=... is the route the
        // working edge functions use; the no-slash /contacts?... variant 403s
        // for sub-account Private Integration tokens.
        const rewritten = `${CRM_BASE}/contacts/?locationId=${encodeURIComponent(
          locationId,
        )}&limit=1`;
        const res = await originalFetch(rewritten, trimmedInit);
        if (!res.ok) return await withErrorBody(res, locationId);
        const body = await res.text();
        return new Response(
          JSON.stringify({ location: { name: locationId }, contacts: body }),
          {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
          },
        );
      }

      // Match: GET .../contacts?locationId=...&limit=1  (the test probe when
      // Settings already uses the contacts endpoint). Trim token + locationId
      // and surface the CRM error body on failure.
      const contactsMatch = url?.match(
        /^https:\/\/services\.leadconnectorhq\.com\/contacts\??(.*)$/,
      );
      if (contactsMatch && method === "GET") {
        const qs = new URLSearchParams(contactsMatch[1] || "");
        if (qs.get("limit") === "1" && qs.has("locationId")) {
          const locationId = (qs.get("locationId") || "").trim();
          qs.set("locationId", locationId);
          let trimmedInit = init;
          if (init?.headers) {
            const headers = new Headers(init.headers);
            const auth = headers.get("Authorization") || "";
            if (auth)
              headers.set(
                "Authorization",
                `Bearer ${auth.replace(/^Bearer\s+/i, "").trim()}`,
              );
            trimmedInit = { ...init, headers };
          }
          // Trailing slash matters: the no-slash /contacts?locationId=...
          // route 403s for sub-account Private Integration tokens, while the
          // trailing-slash /contacts/?locationId=... route (used by every
          // real CRM operation in send-proposal / ghl-invoice) succeeds.
          const rewritten = `${CRM_BASE}/contacts/?${qs.toString()}`;
          const res = await originalFetch(rewritten, trimmedInit);
          if (!res.ok) return await withErrorBody(res, locationId);
          return res;
        }
      }
    } catch {
      // On any interception error, fall through to the original fetch.
    }

    return originalFetch(input, init);
  };
}

/**
 * Read the CRM error body and return a Response whose text is a clear,
 * human-readable message including the real CRM reason. The Settings toast
 * reads `error.message` which comes from `API returned {status}: {body}`.
 */
async function withErrorBody(
  res: Response,
  locationId: string,
): Promise<Response> {
  let detail = "";
  try {
    const errBody = await res.json();
    detail = errBody?.message || errBody?.error || JSON.stringify(errBody);
  } catch {
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
  }
  const msg =
    res.status === 401 || res.status === 403
      ? `API returned ${res.status}${detail ? `: ${detail}` : ""}. Ensure the API Key is a sub-account Private Integration token for this exact Location ID (${locationId}), with Contacts read access.`
      : `API returned ${res.status}${detail ? `: ${detail}` : `: ${res.statusText}`}`;
  return new Response(msg, {
    status: res.status,
    statusText: res.statusText,
    headers: { "Content-Type": "text/plain" },
  });
}
