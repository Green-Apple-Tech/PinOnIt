import { describe, expect, it } from 'vitest';
import {
  bookingMatchesCriticalAuto,
  normalizeCriticalAutoMatches,
  parseCriticalAutoInput,
} from './criticalAutoMatch';

describe('criticalAutoMatch', () => {
  it('parses email, domain, and name inputs', () => {
    expect(parseCriticalAutoInput('Boss@Acme.com')).toEqual({ type: 'email', value: 'boss@acme.com' });
    expect(parseCriticalAutoInput('@acme.com')).toEqual({ type: 'domain', value: 'acme.com' });
    expect(parseCriticalAutoInput('Jane Doe')).toEqual({ type: 'name', value: 'jane doe' });
  });

  it('matches guest against rules', () => {
    const rules = normalizeCriticalAutoMatches([
      { type: 'email', value: 'ceo@acme.com' },
      { type: 'domain', value: 'board.org' },
      { type: 'name', value: 'mayor' },
    ]);
    expect(bookingMatchesCriticalAuto('ceo@acme.com', 'Pat', rules)).toBe(true);
    expect(bookingMatchesCriticalAuto('a@board.org', 'Pat', rules)).toBe(true);
    expect(bookingMatchesCriticalAuto('x@y.com', 'City Mayor', rules)).toBe(true);
    expect(bookingMatchesCriticalAuto('x@y.com', 'Pat', rules)).toBe(false);
  });
});
