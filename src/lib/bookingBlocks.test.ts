import { describe, expect, it } from 'vitest';
import { guestEmailIsBlocked, parseBlockInput } from './bookingBlocks';

describe('parseBlockInput', () => {
  it('parses a full email', () => {
    expect(parseBlockInput('  Joe@Spam.COM ')).toEqual({
      matchType: 'email',
      value: 'joe@spam.com',
    });
  });

  it('parses a domain with or without @', () => {
    expect(parseBlockInput('@spam.com')).toEqual({ matchType: 'domain', value: 'spam.com' });
    expect(parseBlockInput('spam.com')).toEqual({ matchType: 'domain', value: 'spam.com' });
  });

  it('rejects junk', () => {
    expect(parseBlockInput('not-an-email')).toBeNull();
    expect(parseBlockInput('')).toBeNull();
  });
});

describe('guestEmailIsBlocked', () => {
  const blocks = [
    { match_type: 'email', value: 'bad@example.com' },
    { match_type: 'domain', value: 'spam.co' },
  ];

  it('matches an exact email or a blocked domain', () => {
    expect(guestEmailIsBlocked('bad@example.com', blocks)).toBe(true);
    expect(guestEmailIsBlocked('anyone@spam.co', blocks)).toBe(true);
    expect(guestEmailIsBlocked('ok@example.com', blocks)).toBe(false);
  });
});
