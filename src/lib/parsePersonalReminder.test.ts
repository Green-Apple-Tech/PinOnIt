import { describe, expect, it } from 'vitest';
import { mergePersonalPlans, DEFAULT_PERSONAL_REMINDER, expandPersonalJobs } from './personalReminders';
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

describe('relative reminders', () => {
  const now = new Date(2026, 9, 7, 15, 0, 0);

  it('reminds at the time they named, plus the usual text 10 minutes before', () => {
    const parsed = parsePersonalReminder('remind me in 20 minutes that the stove is on', now);
    expect(parsed.title).toBe('Stove is on');
    expect(parsed.relative).toBe(true);
    expect(parsed.dueAt?.getHours()).toBe(15);
    expect(parsed.dueAt?.getMinutes()).toBe(20);

    const jobs = expandPersonalJobs(parsed.dueAt!, DEFAULT_PERSONAL_REMINDER, {
      now,
      atTime: parsed.relative,
      explicitChannels: parsed.explicitChannels,
    });
    const channelsAt = (min: number) =>
      jobs.filter((job) => job.fireAt.getMinutes() === min).map((job) => job.channel).sort();
    expect(channelsAt(10)).toEqual(['sms']);
    expect(channelsAt(20)).toEqual(['email', 'sms']);
    expect(jobs.some((job) => job.kind === 'escalate')).toBe(false);
    expect(jobs.some((job) => job.channel === 'voice' || job.channel === 'whatsapp')).toBe(false);
  });

  it('uses a named channel at the time they asked, and still sends the usual text 10 minutes before', () => {
    const parsed = parsePersonalReminder('remind me in 25 minutes to call mom and email me', now);
    expect(parsed.explicitChannels).toEqual(['email']);
    const jobs = expandPersonalJobs(parsed.dueAt!, DEFAULT_PERSONAL_REMINDER, {
      now,
      atTime: true,
      explicitChannels: parsed.explicitChannels,
    });
    const channelsAt = (min: number) =>
      jobs.filter((job) => job.fireAt.getMinutes() === min).map((job) => job.channel).sort();
    expect(parsed.dueAt?.getMinutes()).toBe(25);
    expect(channelsAt(15)).toEqual(['sms']);
    expect(channelsAt(25)).toEqual(['email']);
    expect(jobs.some((job) => job.kind === 'escalate')).toBe(false);
  });

  it('leaves a clock-time visit on the usual before-reminders', () => {
    const parsed = parsePersonalReminder(
      'remind me about my call today with the dentist at 7pm and send me a quick reminder 10 min before',
      now,
    );
    expect(parsed.relative).toBe(false);
    const jobs = expandPersonalJobs(parsed.dueAt!, DEFAULT_PERSONAL_REMINDER, { now, atTime: false });
    expect(jobs.some((job) => job.fireAt.getHours() === 19 && job.fireAt.getMinutes() === 0)).toBe(false);
    expect(jobs.some((job) => job.channel === 'voice')).toBe(false);
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
