import { describe, expect, it } from 'vitest';
import { hostHasSmsConsent, hostHasWhatsappConsent } from './reminderChannels';

describe('host SMS / WhatsApp consent', () => {
  it('keeps both consents independent of default reminder channel', () => {
    const profile = {
      sms_opt_in: true,
      whatsapp_opt_in: true,
      default_reminder_channel: 'email' as const,
    };
    expect(hostHasSmsConsent(profile)).toBe(true);
    expect(hostHasWhatsappConsent(profile)).toBe(true);
  });

  it('does not revoke WhatsApp consent when default channel is SMS', () => {
    const profile = {
      sms_opt_in: true,
      whatsapp_opt_in: true,
      default_reminder_channel: 'sms' as const,
    };
    expect(hostHasSmsConsent(profile)).toBe(true);
    expect(hostHasWhatsappConsent(profile)).toBe(true);
  });

  it('falls back to default channel only when opt-in columns are missing', () => {
    expect(hostHasSmsConsent({ default_reminder_channel: 'sms' })).toBe(true);
    expect(hostHasWhatsappConsent({ default_reminder_channel: 'sms' })).toBe(false);
    expect(hostHasWhatsappConsent({ default_reminder_channel: 'whatsapp' })).toBe(true);
  });

  it('treats explicit false as not consented even if default channel matches', () => {
    expect(hostHasSmsConsent({
      sms_opt_in: false,
      default_reminder_channel: 'sms',
    })).toBe(false);
  });
});
