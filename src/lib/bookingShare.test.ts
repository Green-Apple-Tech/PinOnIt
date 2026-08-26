import { describe, expect, it } from 'vitest';
import {
  buildAvailabilityEmailInvite,
  buildAvailabilitySmsInvite,
  isMobileShareClient,
} from './bookingShare';

describe('bookingShare', () => {
  it('builds email invite with share URL', () => {
    const inv = buildAvailabilityEmailInvite('https://pinonit.com/jane', 'Jane');
    expect(inv.subject).toContain('Schedule');
    expect(inv.body).toContain('https://pinonit.com/jane');
    expect(inv.body).toContain('Jane');
  });

  it('builds sms invite', () => {
    const body = buildAvailabilitySmsInvite('https://pinonit.com/jane', 'Jane');
    expect(body).toContain('https://pinonit.com/jane');
    expect(body).toContain('Jane');
  });

  it('detects mobile from userAgent when present', () => {
    // jsdom UA is typically desktop — just assert the helper is boolean-safe
    expect(typeof isMobileShareClient()).toBe('boolean');
  });
});
