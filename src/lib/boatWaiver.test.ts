import { describe, expect, it } from 'vitest';
import {
  BOAT_WAIVER_STARTER_TEXT,
  boatPartyBlock,
  boatPartyError,
  boatWaiverError,
  displayOutingDate,
  fillBoatWaiver,
  isOpenBoatLinkName,
  openBoatBlankFields,
  OPEN_BOAT_LINK_NAME,
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

  it('keeps the owner the host already wrote, including the signature line', () => {
    const text = BOAT_WAIVER_STARTER_TEXT
      .replace('Vessel Owner/Operator: [Vessel Owner/Operator]', 'Vessel Owner/Operator: Miami Expeditions LLC - Boat Operator / pilot Peter Stebbins')
      .replace('Vessel: [Vessel]', 'Vessel: Stone Crab')
      .replace('Date of Outing: [Date of Outing]', 'Date of Outing: Sept 29, 2026');
    expect(openBoatBlankFields(text)).not.toContain('owner');
    expect(openBoatBlankFields(text)).not.toContain('vessel');
    const filled = fillBoatWaiver(text, { ...complete, owner: '', vessel: '', outingDate: '' }, 'September 29, 2026');
    expect(filled).toContain('Miami Expeditions LLC - Boat Operator / pilot Peter Stebbins');
    expect(filled).not.toContain('[Vessel Owner/Operator]');
  });

  it('does not ask the guest for blanks the host already filled in', () => {
    const text = BOAT_WAIVER_STARTER_TEXT
      .replaceAll('[Vessel Owner/Operator]', 'Pedro')
      .replaceAll('[Vessel]', 'Sea Glass')
      .replaceAll('[Date of Outing]', 'September 26, 2026');
    const open = openBoatBlankFields(text);
    expect(open).not.toContain('vessel');
    expect(open).not.toContain('owner');
    expect(open).not.toContain('outingDate');
    expect(open).toContain('participant');
    expect(boatWaiverError({ ...complete, vessel: '', owner: '', outingDate: '' }, open)).toBeNull();
  });

  it('treats a blank host name as an open link the guest must fill in', () => {
    expect(isOpenBoatLinkName('')).toBe(true);
    expect(isOpenBoatLinkName(OPEN_BOAT_LINK_NAME)).toBe(true);
    expect(isOpenBoatLinkName('Ada Guest')).toBe(false);
  });

  it('lets a boat waiver add more people under the same signature', () => {
    expect(boatPartyError([])).toBeNull();
    expect(boatPartyError([{ fullName: 'Ada', dateOfBirth: '' }])).toMatch(/full name and date of birth/);
    const block = boatPartyBlock([{ fullName: 'Ada Guest', dateOfBirth: '2016-04-02' }]);
    expect(block).toContain('Ada Guest');
    expect(block).toContain('April 2, 2016');
    expect(block).toContain('One signature covers');
  });
});
