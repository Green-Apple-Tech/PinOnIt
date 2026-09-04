import { describe, expect, it } from 'vitest';
import { normalizePhoneE164 } from './phone';

describe('normalizePhoneE164', () => {
  it('returns empty for blank input', () => {
    expect(normalizePhoneE164('')).toBe('');
    expect(normalizePhoneE164('   ')).toBe('');
  });

  it('treats 10-digit US numbers as +1', () => {
    expect(normalizePhoneE164('305-661-1234')).toBe('+13056611234');
    expect(normalizePhoneE164('(305) 661-1234')).toBe('+13056611234');
  });

  it('strips formatting from numbers that already include +', () => {
    expect(normalizePhoneE164('+1 (305) 661-1234')).toBe('+13056611234');
    expect(normalizePhoneE164('+1-305-661-1234')).toBe('+13056611234');
  });
});
