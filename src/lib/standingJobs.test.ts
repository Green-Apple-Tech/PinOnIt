import { describe, expect, it } from 'vitest';
import { countRecurringSeriesOnSlot } from './recurring';
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

  it('counts a standing job series on a slot even when visits are not flagged is_recurring', () => {
    const when = new Date(2026, 8, 16, 9, 0);
    const dateKey = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
    const slot = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
    const n = countRecurringSeriesOnSlot(
      [
        {
          id: 'a',
          service_id: 'svc',
          start_time: when.toISOString(),
          status: 'confirmed',
          is_recurring: false,
          standing_job_id: 'job-1',
        },
      ],
      'svc',
      dateKey,
      slot,
    );
    expect(n).toBe(1);
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

  it('fills Tuesday and Friday and the first Monday of each month', () => {
    const now = new Date(2026, 8, 16, 8, 0);
    const horizonEnd = new Date(now.getTime() + STANDING_HORIZON_DAYS * 86400000);
    const tueFri = standingOccurrenceStarts({
      startsAt: new Date(2026, 8, 18, 9, 0),
      frequency: 'weekly',
      weekdays: [2, 5],
      horizonEnd,
      now,
    });
    expect(tueFri[0].getDay()).toBe(5);
    expect(tueFri[1].getDay()).toBe(2);
    expect(tueFri[2].getDay()).toBe(5);
    expect(formatStandingFrequency('weekly', null, [2, 5])).toBe('Weekly on Tue & Fri');

    const firstMonday = standingOccurrenceStarts({
      startsAt: new Date(2026, 9, 5, 9, 0),
      frequency: 'monthly',
      weekdays: [1],
      monthNth: 1,
      horizonEnd: new Date(2026, 11, 31, 9, 0),
      now: new Date(2026, 9, 1, 8, 0),
    });
    expect(firstMonday[0].getDate()).toBe(5);
    expect(firstMonday[0].getMonth()).toBe(9);
    expect(firstMonday[1].getDate()).toBe(2);
    expect(firstMonday[1].getMonth()).toBe(10);
    expect(formatStandingFrequency('monthly', null, [1], 1)).toBe('First Monday');
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
