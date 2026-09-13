import { describe, expect, it } from 'vitest';
import {
  ageFromDob,
  emptyWaiverParticipants,
  newWaiverParticipant,
  validWaiverParticipants,
} from './waiverParticipants';

describe('waiver participants', () => {
  it('starts with one empty row and can add more without repeating waiver text', () => {
    const rows = emptyWaiverParticipants();
    expect(rows).toHaveLength(1);
    const three = [...rows, newWaiverParticipant(), newWaiverParticipant()];
    expect(three).toHaveLength(3);
    expect(new Set(three.map((r) => r.id)).size).toBe(3);
  });

  it('requires name and ISO date of birth', () => {
    expect(validWaiverParticipants([
      { id: '1', fullName: 'Ada', dateOfBirth: '2018-05-01' },
      { id: '2', fullName: '  ', dateOfBirth: '2018-05-01' },
      { id: '3', fullName: 'Bea', dateOfBirth: 'May 1' },
    ])).toHaveLength(1);
  });

  it('computes age for display only and does not require storing it', () => {
    expect(ageFromDob('2018-01-01', new Date('2026-09-13'))).toBe(8);
    expect(ageFromDob('bad')).toBeNull();
  });
});
