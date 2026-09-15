import { describe, expect, it } from 'vitest';
import {
  STANDING_HORIZON_DAYS,
  addStandingOccurrence,
  formatStandingFrequency,
  nextStandingVisit,
  standingComposePath,
  standingOccurrenceStarts,
} from './standingJobs';

describe('guest recurring vs standing jobs', () => {
  it('labels custom cadence the same way host and guest opt-in share', () => {
    expect(formatStandingFrequency('weekly')).toBe('Weekly');
    expect(formatStandingFrequency('custom', 10)).toBe('Every 10 days');
  });
});

describe('standing occurrence math', () => {
  it('walks weekly dates across a 90-day horizon', () => {
    const startsAt = new Date(2026, 8, 16, 9, 0);
    const now = new Date(2026, 8, 16, 8, 0);
    const horizonEnd = new Date(now.getTime() + STANDING_HORIZON_DAYS * 86400000);
    const dates = standingOccurrenceStarts({
      startsAt,
      frequency: 'weekly',
      horizonEnd,
      now,
    });
    expect(dates[0].getDate()).toBe(16);
    expect(dates[1].getDate()).toBe(23);
    expect(dates.length).toBeGreaterThanOrEqual(12);
    expect(dates.length).toBeLessThanOrEqual(14);
    expect(addStandingOccurrence(startsAt, 'custom', 10).getDate()).toBe(26);
  });

  it('stops at occurrence count and end date', () => {
    const startsAt = new Date(2026, 8, 16, 9, 0);
    const now = new Date(2026, 8, 16, 8, 0);
    const horizonEnd = new Date(now.getTime() + STANDING_HORIZON_DAYS * 86400000);
    expect(
      standingOccurrenceStarts({
        startsAt,
        frequency: 'weekly',
        horizonEnd,
        occurrenceCount: 3,
        now,
      }),
    ).toHaveLength(3);
    expect(
      standingOccurrenceStarts({
        startsAt,
        frequency: 'weekly',
        horizonEnd,
        endsAt: new Date(2026, 8, 20, 9, 0),
        now,
      }),
    ).toHaveLength(1);
  });

  it('labels frequency and builds a quote deep-link with the customer filled in', () => {
    expect(formatStandingFrequency('biweekly')).toBe('Every 2 weeks');
    expect(formatStandingFrequency('custom', 10)).toBe('Every 10 days');
    expect(
      standingComposePath('quote', { name: 'Jane Doe', phone: '+15551212', email: 'jane@x.com' }),
    ).toBe('/dashboard/documents/new?type=quote&name=Jane+Doe&phone=%2B15551212&email=jane%40x.com');
  });

  it('picks the next confirmed visit and ignores skipped', () => {
    const next = nextStandingVisit(
      [
        { start_time: '2026-09-16T13:00:00.000Z', status: 'skipped' },
        { start_time: '2026-09-23T13:00:00.000Z', status: 'confirmed' },
      ],
      new Date('2026-09-16T12:00:00.000Z'),
    );
    expect(next?.start_time).toBe('2026-09-23T13:00:00.000Z');
  });
});
