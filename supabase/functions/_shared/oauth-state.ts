/** OAuth state passed through Google/Microsoft browser redirects (no JWT on callback). */

export const OAUTH_APP_URL = "https://pinonit.com";

export interface OAuthStatePayload {
  userId?: string;
  uid?: string;
  source?: string;
}

export interface OAuthContext {
  userId: string | null;
  source: string;
  redirectBase: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidOAuthUserId(id: string): boolean {
  return UUID_RE.test(id);
}

export function oauthRedirectBase(source: string): string {
  return source === "contacts"
    ? `${OAUTH_APP_URL}/dashboard/contacts`
    : `${OAUTH_APP_URL}/dashboard/appointments`;
}

export function encodeOAuthState(userId: string, source: string): string {
  const json = JSON.stringify({ userId, uid: userId, source });
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeOAuthState(state: string): OAuthStatePayload | null {
  const candidates = [state, decodeURIComponent(state), state.split(".")[0]];

  for (const raw of candidates) {
    if (!raw) continue;

    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

    try {
      const decoded = JSON.parse(atob(padded)) as OAuthStatePayload;
      if (decoded.userId || decoded.uid) return decoded;
    } catch {
      // try next variant
    }

    // Legacy plain base64 from older auth deployments
    try {
      const decoded = JSON.parse(atob(raw)) as OAuthStatePayload;
      if (decoded.userId || decoded.uid) return decoded;
    } catch {
      // try next variant
    }
  }

  return null;
}

export function resolveOAuthUserId(payload: OAuthStatePayload | null): string | null {
  if (!payload) return null;
  return payload.userId ?? payload.uid ?? null;
}

/** Parse state early so error redirects land on the correct dashboard tab. */
export function parseOAuthContext(state: string | null): OAuthContext {
  if (!state) {
    return { userId: null, source: "calendar", redirectBase: oauthRedirectBase("calendar") };
  }

  const decoded = decodeOAuthState(state);
  const source = decoded?.source ?? "calendar";
  return {
    userId: resolveOAuthUserId(decoded),
    source,
    redirectBase: oauthRedirectBase(source),
  };
}
