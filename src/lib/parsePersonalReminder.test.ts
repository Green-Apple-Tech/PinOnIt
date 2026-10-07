import { describe, expect, it } from 'vitest';
import { mergePersonalPlans, DEFAULT_PERSONAL_REMINDER } from './personalReminders';
import { parsePersonalReminder } from './parsePersonalReminder';

describe('parsePersonalReminder', () => {
  const now = new Date(2026, 9, 7, 15, 0, 0);

  it('turns a dentist sentence into a subject, 7pm today, and a 10-minute text', () => {
    const parsed = parsePersonalReminder(
      'remind me about my call today with the dentist at 7pm and send me a quick reminder 10 min before',
      now,
    );
    expect(parsed.title).toBe('Dentist reminder');
    expect(parsed.dueAt?.getHours()).toBe(19);
    expect(parsed.dueAt?.getDate()).toBe(7);
    expect(parsed.location).toBe('');
    expect(parsed.extras.ten_min).toEqual(['sms']);
  });

  it('keeps a named place off the clock', () => {
    const parsed = parsePersonalReminder(
      'remind me to meet Sam tomorrow at the downtown office at 9am',
      now,
    );
    expect(parsed.location.toLowerCase()).toContain('downtown office');
    expect(parsed.dueAt?.getDate()).toBe(8);
    expect(parsed.dueAt?.getHours()).toBe(9);
  });
});

describe('mergePersonalPlans', () => {
  it('keeps email the day before, a text an hour before, and a text 10 minutes before, and adds a voice call', () => {
    const plan = mergePersonalPlans(DEFAULT_PERSONAL_REMINDER, {
      hour_before: ['voice'],
      ten_min: ['sms'],
    });
    expect(plan.day_before).toEqual(['email']);
    expect(plan.hour_before).toEqual(['sms', 'voice']);
    expect(plan.ten_min).toEqual(['sms']);
  });
});
