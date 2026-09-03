import { describe, expect, it } from 'vitest';
import {
  emptyContactReminderOverride,
  mergeReminderPrefsWithContactOverride,
  normalizeContactReminderOverride,
} from './contactReminderOverride';

describe('normalizeContactReminderOverride', () => {
  it('returns null for empty or incomplete payloads', () => {
    expect(normalizeContactReminderOverride(null)).toBeNull();
    expect(normalizeContactReminderOverride({})).toBeNull();
    expect(normalizeContactReminderOverride({ channels: ['email'], times: [] })).toBeNull();
  });

  it('keeps valid channels and times', () => {
    expect(
      normalizeContactReminderOverride({
        channels: ['email', 'voice', 'fax'],
        times: ['24hour', 'nope', '1hour'],
      }),
    ).toEqual({ channels: ['email', 'voice'], times: ['24hour', '1hour'] });
  });
});

describe('mergeReminderPrefsWithContactOverride', () => {
  it('falls back to base when override is null', () => {
    const base = { channels: ['email'], times: ['1hour'] };
    expect(mergeReminderPrefsWithContactOverride(base, null)).toEqual(base);
  });

  it('uses contact override when set', () => {
    expect(
      mergeReminderPrefsWithContactOverride(
        { channels: ['email'], times: ['1hour'] },
        emptyContactReminderOverride(),
      ),
    ).toEqual({ channels: ['email', 'sms'], times: ['24hour', '1hour'] });
  });
});
