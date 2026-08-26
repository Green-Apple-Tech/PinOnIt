import { describe, expect, it } from 'vitest';
import {
  defaultWeekdayHalfHours,
  halfHoursToRanges,
  rangeToHalfHours,
} from './availabilityGrid';

describe('availabilityGrid', () => {
  it('expands a range into half hours', () => {
    expect(rangeToHalfHours('09:00', '10:00')).toEqual(['09:00', '09:30']);
  });

  it('merges contiguous half hours into ranges', () => {
    expect(halfHoursToRanges(['09:00', '09:30', '10:00', '13:00', '13:30'])).toEqual([
      { start: '09:00', end: '10:30' },
      { start: '13:00', end: '14:00' },
    ]);
  });

  it('default weekday is 9–12 and 1–5', () => {
    const slots = defaultWeekdayHalfHours();
    expect(slots).toContain('09:00');
    expect(slots).toContain('11:30');
    expect(slots).not.toContain('12:00');
    expect(slots).not.toContain('12:30');
    expect(slots).toContain('13:00');
    expect(slots).toContain('16:30');
    expect(slots).not.toContain('17:00');
    expect(halfHoursToRanges(slots)).toEqual([
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ]);
  });
});
