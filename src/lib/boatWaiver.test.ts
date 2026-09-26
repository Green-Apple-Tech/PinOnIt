import { describe, expect, it } from 'vitest';
import {
  BOAT_WAIVER_STARTER_TEXT,
  boatWaiverError,
  displayOutingDate,
  fillBoatWaiver,
} from './boatWaiver';

const complete = {
  vessel: 'Sea Glass',
  owner: 'Pedro',
  outingDate: '2026-09-26',
  participant: 'Ada Guest',
  emergencyContact: 'Bea Guest',
  emergencyPhone: '555-0100',
};

describe('boat waiver blanks', () => {
  it('writes each answer into the waiver and leaves the owner signature line open', () => {
    const filled = fillBoatWaiver(BOAT_WAIVER_STARTER_TEXT, complete, 'September 26, 2026');
    expect(filled).toContain('Vessel: Sea Glass');
    expect(filled).toContain('Vessel Owner/Operator: Pedro');
    expect(filled).toContain('Date of Outing: September 26, 2026');
    expect(filled).toContain('Participant/Guest: Ada Guest');
    expect(filled).toContain('Emergency Contact: Bea Guest');
    expect(filled).toContain('Emergency Contact Phone: 555-0100');
    expect(filled).toContain('Date: September 26, 2026');
    expect(filled).toContain('Signature: ______________________________');
    expect(filled).not.toContain('[Vessel]');
    expect(filled).not.toContain('[Participant/Guest]');
  });

  it('requires every guest blank', () => {
    expect(boatWaiverError({ ...complete, vessel: '  ' })).toMatch(/Vessel/);
    expect(boatWaiverError({ ...complete, outingDate: 'yesterday' })).toMatch(/Date of outing/);
    expect(boatWaiverError(complete)).toBeNull();
    expect(displayOutingDate('2026-09-26')).toBe('September 26, 2026');
  });
});
