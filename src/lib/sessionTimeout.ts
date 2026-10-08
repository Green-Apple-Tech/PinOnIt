import { isGuestNoIndexPath } from './guestNoIndex';
import { storageSet } from './safeStorage';

/** Idle auto sign-out. 15 minutes is the common HIPAA workstation / OWASP mid-risk default. */
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;
const LAST_ACTIVITY_KEY = 'pinonit_last_activity';
/** A Google return is a full page load, so the idle clock must not use the previous visit. */
export const FRESH_SIGN_IN_GRACE_MS = 2 * 60 * 1000;

export const SESSION_TIMEOUT_OPTIONS: { label: string; minutes: number }[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: '8 hours', minutes: 480 },
  { label: '1 day', minutes: 1440 },
  { label: 'Never', minutes: 0 },
];

/**
 * Minutes of inactivity before sign-out.
 * 0 = never. null/undefined (legacy "Never") defaults to 15.
 */
export function resolveSessionTimeoutMinutes(
  value: number | null | undefined,
): number | null {
  if (value === 0) return null;
  if (value == null || value < 0) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  return value;
}

/** Guest waiver and booking links stay open. Sign-in pages must not sign the new session out. */
export function inactivitySignOutDestination(pathname: string) {
  if (isGuestNoIndexPath(pathname)) return null;
  if (isPublicBookingPath(pathname)) return null;
  if (pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/')) return null;
  return '/login?signed_out=inactivity';
}

/** /:slug and /:slug/services. Idle timeout must not dump the host off their own booking page. */
export function isPublicBookingPath(pathname: string) {
  const path = (pathname.split('?')[0] || '/').replace(/\/$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 2 && parts[1] === 'services') return true;
  if (parts.length !== 1) return false;
  return !PUBLIC_APP_ROOTS.has(parts[0]);
}

const PUBLIC_APP_ROOTS = new Set([
  'acceptable-use',
  'blog',
  'calendly-alternative',
  'calendly-alternative-for-small-business',
  'dashboard',
  'documents',
  'leaderboard',
  'legal-templates',
  'login',
  'nda',
  'onboarding',
  'privacy',
  'reminders',
  'sign-now',
  'signup',
  'sms-consent',
  'status',
  'terms',
  'why-pinonit',
]);

export function recordSessionActivity(now = Date.now()) {
  storageSet(LAST_ACTIVITY_KEY, String(now));
}

/** True when this browser session just finished Google or email sign-in. */
export function signedInTooRecently(lastSignInAt: string | null | undefined, now = Date.now()) {
  if (!lastSignInAt) return false;
  const signedIn = Date.parse(lastSignInAt);
  if (!Number.isFinite(signedIn)) return false;
  return now - signedIn >= 0 && now - signedIn < FRESH_SIGN_IN_GRACE_MS;
}

export function sessionTimeoutOptionValue(
  value: number | null | undefined,
): number {
  return resolveSessionTimeoutMinutes(value) ?? 0;
}
