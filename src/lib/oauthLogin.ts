/** Login OAuth helpers. Keep this file free of the Supabase client so boot code can import it. */

export const OAUTH_INFLIGHT_KEY = 'pinonit_oauth_inflight';

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

export const IOS_OAUTH_SAFARI_MESSAGE =
  'Google sign-in on iPhone needs Safari. The home-screen app, Chrome, and in-app browsers show Google’s “Something went wrong” error. Open pinonit.com/login in Safari, then tap Sign in with Google.';

/**
 * True when iPhone would finish Google OAuth in a different browser than this page,
 * or in a WKWebView Google blocks (home-screen app, Chrome, Instagram, etc.).
 */
export function isIosIsolatedWebView(ua: string, standalone = false): boolean {
  const ios = /iPhone|iPad|iPod/i.test(ua);
  if (!ios) return false;
  if (standalone) return true;
  if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return true;
  if (
    /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|Snapchat|TikTok|ByteLocale|GSA\/|DuckDuckGo|Pinterest|WhatsApp|Messenger/i.test(
      ua,
    )
  ) {
    return true;
  }
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
