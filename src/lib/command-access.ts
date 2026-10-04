/**
 * Emails allowed to see the Command page (/manager/command) and its nav item.
 * Everyone else — including owners and super admins — is redirected to
 * /manager and never sees the menu item.
 */
const COMMAND_EMAILS: string[] = [
  "mark@kavoddigital.com",
  "gosocialonline@gmail.com",
];

export function canAccessCommand(email?: string | null): boolean {
  if (!email) return false;
  return COMMAND_EMAILS.includes(email.trim().toLowerCase());
}
