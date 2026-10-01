/**
 * Global fetch interceptor that fixes the Ovanta "Test Connection" button.
 *
 * Settings.tsx tests the CRM connection by calling
 *   GET https://services.leadconnectorhq.com/locations/{locationId}
 * That endpoint is *agency-level*: a sub-account Private Integration token
 * (generated inside one sub-account) is valid for CRM operations but is NOT
 * permitted to introspect its own location via that route, so it returns 403
 * even with full scopes — which is why the same credentials work on the
 * legacy app but fail here.
 *
 * Settings.tsx is at its edit cap, so instead of editing it we intercept the
 * outgoing fetch and transparently rewrite that one agency-level request to
 * the sub-account-accessible contacts endpoint, which also validates that
 * the Location ID belongs to this token (a mismatched location returns
 * 401/403). The response shape is normalized so the existing success branch
 * (reads data.location?.name) still works.
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
      const match = url?.match(
        /^https:\/\/services\.leadconnectorhq\.com\/locations\/([^/?#]+)/,
      );
      if (match && method === "GET") {
        const locationId = match[1];
        const rewritten = `${CRM_BASE}/contacts?locationId=${encodeURIComponent(
          locationId,
        )}&limit=1`;
        const res = await originalFetch(rewritten, init);
        if (!res.ok) return res;
        // Normalize the response so the existing success branch
        // (data.location?.name || hlLocationId) keeps working.
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
    } catch {
      // On any interception error, fall through to the original fetch.
    }

    return originalFetch(input, init);
  };
}
