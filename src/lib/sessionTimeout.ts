import { isGuestNoIndexPath } from './guestNoIndex';

/** Idle auto sign-out. 15 minutes is the common HIPAA workstation / OWASP mid-risk default. */
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;

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

/** Guest waiver and booking links stay open. Only the host dashboard goes to sign-in. */
export function inactivitySignOutDestination(pathname: string) {
  if (isGuestNoIndexPath(pathname)) return null;
  return '/login?signed_out=inactivity';
}

export function sessionTimeoutOptionValue(
  value: number | null | undefined,
): number {
  return resolveSessionTimeoutMinutes(value) ?? 0;
}
