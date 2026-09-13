/**
 * Bartender onboarding is basics + photo only.
 * Photographers/videographers still need avatar + bio + portfolio.
 */

/** True when this contractor's specialty is Bartender. */
export function isBartender(specialty?: string | null): boolean {
  return /bartender/i.test(specialty || "");
}

/**
 * Whether a contractor's profile is incomplete.
 * Bartenders: only avatar_url is required.
 * Photo/video: avatar_url + bio + portfolio_url (unchanged).
 */
export function profileIsIncomplete(
  c:
    | {
        avatar_url?: string | null;
        bio?: string | null;
        portfolio_url?: string | null;
        specialty?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!c) return false;
  if (isBartender(c.specialty)) {
    return !c.avatar_url;
  }
  return !c.avatar_url || !c.bio || !c.portfolio_url;
}
