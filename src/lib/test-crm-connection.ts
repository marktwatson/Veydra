/**
 * Test a sub-account Ovanta (CRM) Private Integration connection.
 *
 * NOTE: GET /locations/{locationId} is an *agency-level* endpoint. A
 * sub-account Private Integration token (generated inside one sub-account)
 * is valid for CRM operations but is NOT permitted to introspect its own
 * location via that route, so it returns 403 even with full scopes — which
 * is why the same credentials work on the legacy app but fail here.
 *
 * Test against the contacts endpoint instead: it is sub-account accessible
 * and also validates that the Location ID belongs to this token (a
 * mismatched location returns 401/403).
 *
 * Inputs are trimmed — a pasted token with a trailing space or newline is the
 * #1 cause of a 403 that "works on the old app".
 */
export async function testCrmConnection(
  apiKey: string,
  locationId: string,
): Promise<{ ok: true; locationId: string } | { ok: false; message: string }> {
  const key = (apiKey || "").trim();
  const loc = (locationId || "").trim();
  if (!key || !loc) {
    return {
      ok: false,
      message: "Please enter both an API Key and Location ID.",
    };
  }

  try {
    const response = await fetch(
      // Trailing slash matters: /contacts/?locationId=... is the route the
      // working edge functions use; the no-slash /contacts?... variant 403s
      // for sub-account Private Integration tokens.
      `https://services.leadconnectorhq.com/contacts/?locationId=${encodeURIComponent(
        loc,
      )}&limit=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      // Surface the actual CRM error body — it usually says exactly why
      // (e.g. "Location not found", "access denied", "invalid token").
      let detail = "";
      try {
        const errBody = await response.json();
        detail = errBody?.message || errBody?.error || JSON.stringify(errBody);
      } catch {
        try {
          detail = await response.text();
        } catch {
          /* ignore */
        }
      }
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          message: `API returned ${response.status}${detail ? `: ${detail}` : ""}. Ensure the API Key is a sub-account Private Integration token for this exact Location ID (${loc}), with Contacts read access.`,
        };
      }
      return {
        ok: false,
        message: `API returned ${response.status}${detail ? `: ${detail}` : `: ${response.statusText}`}`,
      };
    }

    return { ok: true, locationId: loc };
  } catch (error: any) {
    return {
      ok: false,
      message:
        error?.message ||
        "Failed to connect to the Ovanta API. Please check your credentials.",
    };
  }
}
