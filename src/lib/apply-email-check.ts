import { supabase } from "@/lib/supabase";

/**
 * Escape SQL LIKE wildcards (_ and %) so an email containing an underscore
 * (e.g. jane_doe@example.com) does not false-match other emails where any
 * single character sits in that position. Backslash is the escape char in
 * Postgres LIKE/ILIKE.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/_/g, "\\_").replace(/%/g, "\\%");
}

export interface EmailConflictResult {
  exists: boolean;
  table?: "contractors" | "editors" | "managers";
}

/**
 * Checks whether an email already exists in contractors, editors, or
 * managers. Uses an escaped ILIKE so underscores in the email are treated
 * literally instead of as single-character wildcards.
 */
export async function checkEmailConflict(
  email: string,
): Promise<EmailConflictResult> {
  const normalized = email.trim().toLowerCase();
  const pattern = escapeLikePattern(normalized);

  const tables: Array<"contractors" | "editors" | "managers"> = [
    "contractors",
    "editors",
    "managers",
  ];

  const queries = tables.map(async (table) => {
    const { data } = await supabase
      .from(table)
      .select("id")
      .filter("email", "ilike", pattern)
      .maybeSingle();
    return { table, data };
  });

  const results = await Promise.all(queries);

  for (const r of results) {
    if (r?.data) {
      return { exists: true, table: r.table };
    }
  }

  return { exists: false };
}
