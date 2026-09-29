import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  inactivitySignOutDestination,
  resolveSessionTimeoutMinutes,
  sessionTimeoutOptionValue,
  signedInTooRecently,
} from './sessionTimeout';

describe('session timeout', () => {
  it('defaults missing and legacy Never (null) to 15 minutes', () => {
    expect(resolveSessionTimeoutMinutes(undefined)).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
    expect(resolveSessionTimeoutMinutes(null)).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
  });

  it('treats 0 as no auto sign-out', () => {
    expect(resolveSessionTimeoutMinutes(0)).toBeNull();
    expect(sessionTimeoutOptionValue(0)).toBe(0);
  });

  it('leaves a guest waiver link open when the host session times out', () => {
    expect(inactivitySignOutDestination('/d/abc')).toBeNull();
    expect(inactivitySignOutDestination('/dashboard/documents')).toBe('/login?signed_out=inactivity');
  });

  it('does not sign out a session that is still on the login or Google callback page', () => {
    expect(inactivitySignOutDestination('/login')).toBeNull();
    expect(inactivitySignOutDestination('/auth/callback')).toBeNull();
  });

  it('treats a sign-in from the last two minutes as active', () => {
    const now = Date.parse('2026-09-29T18:00:00.000Z');
    expect(signedInTooRecently(new Date(now - 30_000).toISOString(), now)).toBe(true);
    expect(signedInTooRecently(new Date(now - 20 * 60_000).toISOString(), now)).toBe(false);
  });

  it('keeps an explicit saved timeout', () => {
    expect(resolveSessionTimeoutMinutes(60)).toBe(60);
    expect(sessionTimeoutOptionValue(null)).toBe(15);
  });
});
