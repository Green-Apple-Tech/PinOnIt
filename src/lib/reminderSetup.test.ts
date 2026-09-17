import { describe, expect, it } from 'vitest';
import { missingDefaultGuestEmailSlots } from './reminderSetup';

describe('missingDefaultGuestEmailSlots', () => {
  it('asks for 24-hour and 1-hour email when the host has none', () => {
    const missing = missingDefaultGuestEmailSlots([]);
    expect(missing.map((s) => s.timing_offset_minutes).sort((a, b) => a - b)).toEqual([-1440, -60]);
  });

  it('does not recreate a slot the host already has, even if it is off', () => {
    const missing = missingDefaultGuestEmailSlots([
      { type: 'reminder', channel: 'email', timing_offset_minutes: -60 },
    ]);
    expect(missing).toHaveLength(1);
    expect(missing[0]?.timing_offset_minutes).toBe(-1440);
  });

  it('ignores confirmation and other channels', () => {
    const missing = missingDefaultGuestEmailSlots([
      { type: 'confirmation', channel: 'email', timing_offset_minutes: 0 },
      { type: 'reminder', channel: 'sms', timing_offset_minutes: -60 },
    ]);
    expect(missing).toHaveLength(2);
  });
});
