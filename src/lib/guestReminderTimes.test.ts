import { describe, expect, it } from 'vitest';
import { guestReminderOffsetMinutes, isReminderDue } from './guestReminderTimes';

describe('guest reminder times', () => {
  it('maps 15 min before to -15', () => {
    expect(guestReminderOffsetMinutes('15min')).toBe(-15);
  });

  it('treats a reminder as due inside the late window', () => {
    const fireAt = Date.parse('2026-08-14T14:15:00.000Z');
    const now = Date.parse('2026-08-14T14:18:00.000Z');
    expect(isReminderDue(fireAt, now, 20 * 60 * 1000)).toBe(true);
    expect(isReminderDue(fireAt, now, 2 * 60 * 1000)).toBe(false);
    expect(isReminderDue(fireAt + 60_000, fireAt, 20 * 60 * 1000)).toBe(false);
  });
});
