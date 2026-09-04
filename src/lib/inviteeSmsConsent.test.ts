import { describe, expect, it } from 'vitest';
import { SMS_BOOKING_CONSENT_CTA } from './smsCompliance';
import {
  buildNotifyViaPayload,
  resolveBookingSmsConsent,
  shouldRecordSmsOptIn,
} from './bookingSmsConsent';

describe('invitee SMS consent gates', () => {
  it('keeps registered A2P CTA verbatim (carrier filing)', () => {
    expect(SMS_BOOKING_CONSENT_CTA).toBe(
      'By checking this box and providing your mobile phone number, you agree to receive appointment-related SMS messages from Pin On It. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for assistance.',
    );
  });

  it('booking without checkbox → no sms in notify_via (email only path)', () => {
    const phone = '+15551234567';
    const via = buildNotifyViaPayload('guest@example.com', phone, false, false);
    expect(via).not.toContain('sms');
    expect(via).not.toContain('whatsapp');
    expect(resolveBookingSmsConsent(phone, false, false).smsConsentGranted).toBe(false);
    expect(shouldRecordSmsOptIn(phone, false)).toBe(false);
  });

  it('booking with checkbox → sms in notify_via', () => {
    const phone = '+15551234567';
    const via = buildNotifyViaPayload('guest@example.com', phone, true, false);
    expect(via).toContain('sms');
    expect(resolveBookingSmsConsent(phone, true, false).smsConsentGranted).toBe(true);
    expect(shouldRecordSmsOptIn(phone, true)).toBe(true);
  });
});
