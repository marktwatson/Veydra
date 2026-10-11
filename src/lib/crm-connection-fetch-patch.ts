/**
 * Global fetch interceptor that fixes the Ovanta "Test Connection" button.
 *
 * Settings.tsx is at its edit cap, so we cannot edit its inline test handler.
 * The probe is sent to ovanta-send instead of calling Ovanta from the browser.
 * The success response shape stays { location: { name } } so the existing
 * Settings success branch keeps working.
 */
import { callOvantaSend } from "./api";

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

      const locMatch = url?.match(
        /^https:\/\/services\.leadconnectorhq\.com\/locations\/([^/?#]+)/,
      );
      if (locMatch && method === "GET") {
        return testThroughFunction(init, locMatch[1].trim());
      }

      const contactsMatch = url?.match(
        /^https:\/\/services\.leadconnectorhq\.com\/contacts\/?\?(.*)$/,
      );
      if (contactsMatch && method === "GET") {
        const qs = new URLSearchParams(contactsMatch[1] || "");
        if (qs.get("limit") === "1" && qs.has("locationId")) {
          return testThroughFunction(init, (qs.get("locationId") || "").trim());
        }
      }
    } catch {
      // On any interception error, fall through to the original fetch.
    }

    return originalFetch(input, init);
  };
}

async function testThroughFunction(
  init: RequestInit | undefined,
  locationId: string,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const apiKey = (headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  try {
    const data = await callOvantaSend({
      action: "test-connection",
      apiKey,
      locationId,
    });
    const name = data?.name || locationId;
    return new Response(
      JSON.stringify({ location: { name }, contacts: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(error?.message || "Connection failed", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
