import { describe, expect, it } from 'vitest';
import { buildSidebarNav, navPathMatches } from './dashboardNav';
import { parseRevealedTools, presetsForBusinessType } from './progressiveDisclosure';

describe('presetsForBusinessType', () => {
  it('uses SMS and on-site visits for mobile trades', () => {
    const p = presetsForBusinessType('mobile_trade');
    expect(p.reminderChannel).toBe('sms');
    expect(p.locationType).toBe('in_person');
    expect(p.revealed).toContain('paid-booking');
  });
});

describe('buildSidebarNav', () => {
  it('keeps simple mode to the five core items plus More Tools leftovers', () => {
    const { primary, moreTools } = buildSidebarNav('simple', []);
    expect(primary.map((i) => i.label)).toEqual([
      'Dashboard',
      'Calendar',
      'Availability',
      'Reminders',
      'Share',
    ]);
    expect(moreTools.some((i) => i.label === 'Settings')).toBe(true);
    expect(moreTools.some((i) => i.label === 'Contacts')).toBe(true);
  });

  it('surfaces paid booking in simple mode after it is revealed', () => {
    const { primary, moreTools } = buildSidebarNav('simple', ['paid-booking']);
    expect(primary.map((i) => i.label)).toContain('Paid Booking');
    expect(moreTools.some((i) => i.label === 'Paid Booking')).toBe(false);
  });

  it('flattens every tool in advanced mode', () => {
    const { primary, moreTools } = buildSidebarNav('advanced', []);
    expect(moreTools).toEqual([]);
    expect(primary.some((i) => i.label === 'Settings')).toBe(true);
    expect(primary.some((i) => i.label === 'Quote/Invoice')).toBe(true);
  });
});

describe('parseRevealedTools', () => {
  it('drops unknown ids', () => {
    expect(parseRevealedTools(['paid-booking', 'nope'])).toEqual(['paid-booking']);
  });
});

describe('navPathMatches', () => {
  it('does not highlight Dashboard when Share hash is active', () => {
    expect(navPathMatches('/dashboard', '/dashboard', '', '#share')).toBe(false);
    expect(navPathMatches('/dashboard#share', '/dashboard', '', '#share')).toBe(true);
  });

  it('does not highlight Settings when an availability tab is open', () => {
    expect(navPathMatches('/dashboard/settings', '/dashboard/settings', '?tab=availability', '')).toBe(false);
    expect(navPathMatches('/dashboard/settings?tab=availability', '/dashboard/settings', '?tab=availability', '')).toBe(true);
  });
});
