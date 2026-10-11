import { callOvantaSend } from "./api";

/**
 * Test a sub-account Ovanta connection through the server function.
 * The key is sent once to that function and is not used in the browser
 * to call Ovanta directly.
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
    const data = await callOvantaSend({
      action: "test-connection",
      apiKey: key,
      locationId: loc,
    });
    return { ok: true, locationId: data?.locationId || loc };
  } catch (error: any) {
    return {
      ok: false,
      message:
        error?.message ||
        "Failed to connect to the Ovanta API. Please check your credentials.",
    };
  }
}
