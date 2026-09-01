/**
 * Single source of truth for super-admin email backdoors.
 *
 * Previously the magic email "mark@kavoddigital.com" was hardcoded in 7
 * places across the app (AuthContext, Login, Profile, Team). That meant
 * anyone who controlled that email always got full god access, and
 * changing/removing the backdoor required editing 7 files.
 *
 * Now every check goes through isSuperAdminEmail(). To add or remove a
 * super-admin backdoor email, edit ONLY this array. To disable the
 * backdoor entirely, set the array to [].
 *
 * NOTE: This is a client-side convenience for auto-escalating known
 * super-admin accounts during login/role resolution. Real access control
 * must still be enforced by Supabase RLS policies server-side — this
 * helper is not a security boundary on its own.
 */
const SUPER_ADMIN_EMAILS: string[] = ["mark@kavoddigital.com"];

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
