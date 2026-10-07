/** Login OAuth helpers. Keep this file free of the Supabase client so boot code can import it. */

export const OAUTH_INFLIGHT_KEY = 'pinonit_oauth_inflight';

/** Same-tab lock so a remount or double-click cannot mint a second PKCE verifier. */
let oauthStartClaimed = false;

export function claimOauthStart(): boolean {
  if (oauthStartClaimed) return false;
  oauthStartClaimed = true;
  return true;
}

export function clearOauthStart() {
  oauthStartClaimed = false;
}

export function isOauthReturnUrl(href: string): boolean {
  try {
    const url = new URL(href, 'https://pinonit.com');
    return url.pathname === '/auth/callback' || url.pathname.startsWith('/auth/callback/');
  } catch {
    return /\/auth\/callback(?:\/|\?|#|$)/.test(href);
  }
}

export function oauthCallbackRedirect(origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin.replace(/\/$/, '')}/auth/callback`;
}

/** Always show the Google or Microsoft account list. A phone browser otherwise reuses the last account. */
export function oauthAccountPickerParams(extra?: Record<string, string>): Record<string, string> {
  return { ...extra, prompt: 'select_account' };
}

/** Same-origin function that strips params Supabase leaks onto the provider link. */
export const OAUTH_PROVIDER_URL_PATH = '/.netlify/functions/oauth-provider-url';

/** Params Google and Microsoft actually accept. Anything else (redirect_to) is dropped. */
const PROVIDER_AUTH_PARAMS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method',
  'access_type',
  'include_granted_scopes',
  'hd',
  'login_hint',
] as const;

const REQUIRED_PROVIDER_AUTH_PARAMS = ['client_id', 'redirect_uri', 'response_type', 'scope', 'state'] as const;

function isProviderAuthHost(hostname: string): boolean {
  return (
    hostname === 'accounts.google.com' ||
    hostname === 'login.microsoftonline.com' ||
    hostname.endsWith('.microsoftonline.com')
  );
}

function dedupedScope(scope: string): string {
  const seen: string[] = [];
  for (const part of scope.split(/\s+/)) {
    if (!part || seen.includes(part)) continue;
    seen.push(part);
  }
  return seen.join(' ');
}

/**
 * Rebuild the provider link from an allowlist.
 * URLSearchParams uses "+" for spaces. iPhone Chrome turns those pluses into raw
 * spaces, the request line becomes illegal, and Google shows "400. That's an error."
 * Encode spaces as %20 and let the browser follow a server redirect, not a script.
 */
export function cleanProviderAuthUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Sign-in link was invalid.');
  }
  if (url.protocol !== 'https:' || !isProviderAuthHost(url.hostname)) {
    throw new Error('Sign-in link was invalid.');
  }
  const params = new URLSearchParams();
  for (const key of PROVIDER_AUTH_PARAMS) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    params.set(key, key === 'scope' ? dedupedScope(value) : value);
  }
  params.set('prompt', 'select_account');
  for (const key of REQUIRED_PROVIDER_AUTH_PARAMS) {
    if (!params.get(key)) throw new Error('Sign-in link was invalid.');
  }
  const query = params.toString().replace(/\+/g, '%20');
  return `${url.origin}${url.pathname}?${query}`;
}

/** Full-page POST so the phone follows our redirect instead of opening a script-built Google URL. */
export function redirectViaProviderBounce(authorizeUrl: string) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = OAUTH_PROVIDER_URL_PATH;
  form.acceptCharset = 'UTF-8';
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'authorizeUrl';
  input.value = authorizeUrl;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

export async function resolveProviderAuthUrl(
  authorizeUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(OAUTH_PROVIDER_URL_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorizeUrl }),
  });
  const json = (await res.json().catch(() => ({}))) as { url?: unknown };
  if (!res.ok || typeof json.url !== 'string') {
    throw new Error('Could not start sign-in. Try again.');
  }
  return cleanProviderAuthUrl(json.url);
}

export const IOS_OAUTH_SAFARI_MESSAGE =
  'Google sign-in does not work from the home-screen app or inside Instagram / Messages / Gmail. Open pinonit.com/login in Safari or Chrome, then tap Sign in with Google.';

/**
 * True when iPhone would finish Google OAuth in a different browser than this page
 * (home-screen app, Instagram, Gmail, etc.). Safari and Chrome stay in-place.
 */
export function isIosIsolatedWebView(ua: string, standalone = false): boolean {
  const ios = /iPhone|iPad|iPod/i.test(ua);
  if (!ios) return false;
  const isFullIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  if (
    /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|Snapchat|TikTok|ByteLocale|GSA\/|DuckDuckGo|Pinterest|WhatsApp|Messenger/i.test(
      ua,
    )
  ) {
    return true;
  }
  // Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS), and Opera (OPiOS) can complete
  // OAuth in-place, including when opened from a home-screen shortcut.
  if (isFullIosBrowser) return false;
  if (standalone) return true;
  return /AppleWebKit/i.test(ua) && !/Safari/i.test(ua);
}

export function readIosStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  try {
    return Boolean(nav.standalone) || window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return Boolean(nav.standalone);
  }
}

/** Message to show instead of starting Google OAuth, or null if this browser is fine. */
export function iosOauthBlockMessage(
  ua = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  standalone = typeof window === 'undefined' ? false : readIosStandalone(),
): string | null {
  return isIosIsolatedWebView(ua, standalone) ? IOS_OAUTH_SAFARI_MESSAGE : null;
}

export function isConsumedOauthCodeError(message: string): boolean {
  const m = message.toLowerCase();
  if (!m.trim()) return false;
  if (m.includes('code verifier') || m.includes('pkce') || m.includes('flow_state')) return true;
  if (m.includes('both auth code and code verifier')) return true;
  return /(authorization code|auth code|\bcode\b).*(expired|already|used|claimed|redeemed|not found|invalid)/.test(m);
}

export function markOauthInflight(code: string) {
  try {
    sessionStorage.setItem(OAUTH_INFLIGHT_KEY, code);
  } catch {
    /* ignore */
  }
}

export function readOauthInflight(): string | null {
  try {
    return sessionStorage.getItem(OAUTH_INFLIGHT_KEY);
  } catch {
    return null;
  }
}

export function clearOauthInflight() {
  try {
    sessionStorage.removeItem(OAUTH_INFLIGHT_KEY);
  } catch {
    /* ignore */
  }
}
