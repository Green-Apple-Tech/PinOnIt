import { describe, expect, it } from 'vitest';
import {
  buildNotifyViaPayload,
  resolveBookingSmsConsent,
  shouldRecordSmsOptIn,
} from './bookingSmsConsent';

describe('booking SMS consent', () => {
  it('allows booking with blank phone and unchecked checkbox (no SMS consent)', () => {
    const result = resolveBookingSmsConsent('', false, false);
    expect(result.guestPhone).toBeNull();
    expect(result.smsConsentGranted).toBe(false);
    expect(buildNotifyViaPayload('guest@example.com', '', false, false)).toEqual(['email']);
    expect(shouldRecordSmsOptIn('', false)).toBe(false);
  });

  it('allows booking with phone entered and checkbox unchecked (no SMS consent)', () => {
    const result = resolveBookingSmsConsent('3056611234', false, false);
    expect(result.guestPhone).toBe('+13056611234');
    expect(result.smsConsentGranted).toBe(false);
    expect(buildNotifyViaPayload('guest@example.com', '3056611234', false, false)).toEqual(['email']);
    expect(shouldRecordSmsOptIn('3056611234', false)).toBe(false);
  });

  it('records SMS consent only when phone is entered AND checkbox is checked', () => {
    const result = resolveBookingSmsConsent('3056611234', true, false);
    expect(result.guestPhone).toBe('+13056611234');
    expect(result.smsConsentGranted).toBe(true);
    expect(buildNotifyViaPayload('guest@example.com', '3056611234', true, false)).toEqual([
      'email',
      'sms',
    ]);
    expect(shouldRecordSmsOptIn('3056611234', true)).toBe(true);
  });

  it('does not record SMS consent when checkbox is checked but phone is blank', () => {
    expect(resolveBookingSmsConsent('', true, false).smsConsentGranted).toBe(false);
    expect(shouldRecordSmsOptIn('', true)).toBe(false);
    expect(buildNotifyViaPayload('guest@example.com', '', true, false)).toEqual(['email']);
  });

  it('does not record SMS consent for invalid partial phone even if checkbox is checked', () => {
    expect(resolveBookingSmsConsent('123', true, false).smsConsentGranted).toBe(false);
    expect(shouldRecordSmsOptIn('123', true)).toBe(false);
  });
});
