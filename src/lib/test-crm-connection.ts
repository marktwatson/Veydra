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
 */
export async function testCrmConnection(
  apiKey: string,
  locationId: string,
): Promise<{ ok: true; locationId: string } | { ok: false; message: string }> {
  if (!apiKey || !locationId) {
    return {
      ok: false,
      message: "Please enter both an API Key and Location ID.",
    };
  }

  try {
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts?locationId=${encodeURIComponent(
        locationId,
      )}&limit=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      // Surface a clearer message for the common auth/scope failures.
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          message: `API returned ${response.status}. Ensure the API Key is a sub-account Private Integration token for this exact Location ID (${locationId}), with Contacts read access.`,
        };
      }
      return {
        ok: false,
        message: `API returned ${response.status}: ${response.statusText}`,
      };
    }

    return { ok: true, locationId };
  } catch (error: any) {
    return {
      ok: false,
      message:
        error?.message ||
        "Failed to connect to the Ovanta API. Please check your credentials.",
    };
  }
}
