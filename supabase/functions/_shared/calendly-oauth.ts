/** Calendly OAuth helpers (PKCE + token exchange/refresh). */

export const CALENDLY_AUTH_URL = "https://auth.calendly.com/oauth/authorize";
export const CALENDLY_TOKEN_URL = "https://auth.calendly.com/oauth/token";
export const CALENDLY_API_BASE = "https://api.calendly.com";

/** Scopes for import: profile, event types, availability schedules */
export const CALENDLY_IMPORT_SCOPES = "users:read event_types:read availability:read";

export interface CalendlyTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function calendlyRedirectUri(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/calendly-callback`;
}

export async function exchangeCalendlyCode(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<CalendlyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(CALENDLY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  return res.json() as Promise<CalendlyTokenResponse>;
}

export async function refreshCalendlyToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<CalendlyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });

  const res = await fetch(CALENDLY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  return res.json() as Promise<CalendlyTokenResponse>;
}

export function tokenExpiresAt(expiresIn?: number): string | null {
  if (!expiresIn || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now() + 60_000;
}
