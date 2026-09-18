/** Guest and token routes the service worker must never intercept as SPA fallbacks. */
export const PWA_NAV_DENYLIST_SOURCES = [
  '^/d(?:/|$)',
  '^/q(?:/|$)',
  '^/r(?:/|$)',
  '^/c(?:/|$)',
  '^/s(?:/|$)',
  '^/poll(?:/|$)',
] as const;

export function pwaNavigateFallbackDenylist(): RegExp[] {
  return [
    ...PWA_NAV_DENYLIST_SOURCES.map((source) => new RegExp(source)),
    /supabase\.co/i,
    /\/functions\/v1\//,
    /^\/api(?:\/|$)/,
  ];
}
