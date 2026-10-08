import { describe, expect, it } from 'vitest';
import { missingDefaultGuestEmailSlots } from './reminderSetup';

describe('missingDefaultGuestEmailSlots', () => {
  it('starts NeverMiss with exact-time email, text, and call, plus email and WhatsApp an hour before', () => {
    const missing = missingDefaultGuestEmailSlots([]);
    expect(missing.map((s) => `${s.timing_offset_minutes}:${s.channel}`).sort()).toEqual([
      '-60:email',
      '-60:whatsapp',
      '0:email',
      '0:sms',
      '0:voice',
    ]);
  });

  it('does not recreate a slot the host already has, even if it is off', () => {
    const missing = missingDefaultGuestEmailSlots([
      { type: 'reminder', channel: 'email', timing_offset_minutes: -60 },
    ]);
    expect(missing.map((s) => `${s.timing_offset_minutes}:${s.channel}`).sort()).toEqual([
      '-60:whatsapp',
      '0:email',
      '0:sms',
      '0:voice',
    ]);
  });

  it('does not add the 15, 30, or 24 hour slots', () => {
    const missing = missingDefaultGuestEmailSlots([]);
    expect(missing.some((s) => s.timing_offset_minutes === -15)).toBe(false);
    expect(missing.some((s) => s.timing_offset_minutes === -30)).toBe(false);
    expect(missing.some((s) => s.timing_offset_minutes === -1440)).toBe(false);
  });
});
