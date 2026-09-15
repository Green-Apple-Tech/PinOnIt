/** Tokenized guest URLs — never index. robots.txt Disallow is not enough. */
export const GUEST_NOINDEX_ROBOTS = 'noindex, nofollow';

export const GUEST_NOINDEX_PREFIXES = ['/d', '/q', '/r', '/c', '/s', '/poll'] as const;

export function isGuestNoIndexPath(pathname: string) {
  const path = pathname.split('?')[0] || '/';
  return GUEST_NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
