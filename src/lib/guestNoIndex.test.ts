import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUEST_NOINDEX_PREFIXES, isGuestNoIndexPath } from './guestNoIndex';

describe('guest noindex paths', () => {
  it('matches token URLs without catching marketing slugs', () => {
    expect(isGuestNoIndexPath('/d/abc')).toBe(true);
    expect(isGuestNoIndexPath('/q/abc')).toBe(true);
    expect(isGuestNoIndexPath('/r/abc')).toBe(true);
    expect(isGuestNoIndexPath('/c/abc')).toBe(true);
    expect(isGuestNoIndexPath('/s/abc')).toBe(true);
    expect(isGuestNoIndexPath('/poll/abc')).toBe(true);
    expect(isGuestNoIndexPath('/d')).toBe(true);
    expect(isGuestNoIndexPath('/poll')).toBe(true);
    expect(isGuestNoIndexPath('/docusign-alternative')).toBe(false);
    expect(isGuestNoIndexPath('/send-quote-by-text')).toBe(false);
    expect(isGuestNoIndexPath('/sms-appointment-reminders')).toBe(false);
    expect(isGuestNoIndexPath('/solutions')).toBe(false);
    expect(isGuestNoIndexPath('/status')).toBe(false);
    expect(isGuestNoIndexPath('/calendly-alternative')).toBe(false);
  });

  it('sets X-Robots-Tag on guest paths in Netlify headers', () => {
    const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
    const headers = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
    for (const prefix of GUEST_NOINDEX_PREFIXES) {
      expect(toml).toContain(`for = "${prefix}/*"`);
      expect(toml).toMatch(/X-Robots-Tag = "noindex, nofollow"/);
      expect(headers).toContain(`${prefix}/*`);
      expect(headers).toMatch(/X-Robots-Tag: noindex, nofollow/);
    }
  });
});
