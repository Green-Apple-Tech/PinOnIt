import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  resolveSessionTimeoutMinutes,
  sessionTimeoutOptionValue,
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

  it('keeps an explicit saved timeout', () => {
    expect(resolveSessionTimeoutMinutes(60)).toBe(60);
    expect(sessionTimeoutOptionValue(null)).toBe(15);
  });
});
