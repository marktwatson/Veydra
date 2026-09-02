import { supabase } from "@/lib/supabase";

/**
 * Escapes PostgREST filter string values safely.
 */
function escapeFilterVal(val: string): string {
  return val.replace(/"/g, '""');
}

/**
 * Look up manager row by id or email without throwing PostgREST syntax errors.
 */
export async function findManagerAccount(userId?: string, email?: string) {
  if (!userId && !email) return null;

  if (userId) {
    const { data } = await supabase
      .from("managers")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data;
  }

  if (email) {
    const { data } = await supabase
      .from("managers")
      .select("*")
      .ilike("email", escapeFilterVal(email.trim()))
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

/**
 * Look up editor row by id or email.
 */
export async function findEditorAccount(userId?: string, email?: string) {
  if (!userId && !email) return null;

  if (userId) {
    const { data } = await supabase
      .from("editors")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data;
  }

  if (email) {
    const { data } = await supabase
      .from("editors")
      .select("*")
      .ilike("email", escapeFilterVal(email.trim()))
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}
