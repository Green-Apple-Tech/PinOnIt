import { describe, expect, it } from 'vitest';
import { buildSidebarNav, navPathMatches } from './dashboardNav';
import { isBusinessType, isPlaceholderMeetingName, parseRevealedTools, presetsForBusinessType, profilePatchForBusinessType } from './progressiveDisclosure';
import { taxRateForRegion } from './usSalesTax';
import { quoteTotals } from './quoteMath';

describe('presetsForBusinessType', () => {
  it('gives landscapers drive-time buffers and quote lines', () => {
    const p = presetsForBusinessType('landscaper');
    expect(p.reminderChannel).toBe('sms');
    expect(p.locationType).toBe('in_person');
    expect(p.bufferAfter).toBe(30);
    expect(p.usesTax).toBe(true);
    expect(p.quoteLines.some((i) => /lawn/i.test(i.description))).toBe(true);
    expect(p.revealed).toContain('quotes');
  });

  it('sends confirmation SMS for dental offices', () => {
    const p = presetsForBusinessType('dentist');
    expect(p.confirmationSms).toBe(true);
    expect(p.eventName).toMatch(/appointment/i);
  });

  it('uses travel time and parts quotes for HVAC', () => {
    const p = presetsForBusinessType('hvac');
    expect(p.bufferAfter).toBeGreaterThan(0);
    expect(p.usesTax).toBe(true);
    expect(p.revealed).toContain('quotes');
  });

  it('uses video consults for legal and accounting', () => {
    expect(presetsForBusinessType('legal').locationType).toBe('video');
    expect(presetsForBusinessType('accounting').quoteLines.some((i) => /tax/i.test(i.description))).toBe(true);
  });

  it('covers pressure washing, handyman, carpenter, and car wash', () => {
    expect(presetsForBusinessType('pressure_washer').quoteLines.length).toBeGreaterThan(0);
    expect(presetsForBusinessType('handyman').bufferAfter).toBeGreaterThan(0);
    expect(presetsForBusinessType('carpenter').eventName.toLowerCase()).toContain('site');
    expect(presetsForBusinessType('car_washer').durationMinutes).toBe(45);
  });

  it('sets computer / IT services with diagnostic quotes and travel time', () => {
    const p = presetsForBusinessType('computer_services');
    expect(p.bufferAfter).toBeGreaterThan(0);
    expect(p.quoteLines.some((i) => /diagnostic/i.test(i.description))).toBe(true);
    expect(p.confirmationSms).toBe(true);
  });

  it('surfaces group scheduling for real estate', () => {
    const p = presetsForBusinessType('real_estate');
    expect(p.revealed).toContain('group-scheduling');
  });
});

describe('profilePatchForBusinessType', () => {
  it('seeds Florida tax on landscaper quotes', () => {
    const patch = profilePatchForBusinessType('landscaper', 'FL', []);
    expect(patch.default_tax_percent).toBe(taxRateForRegion('FL'));
    expect(patch.meeting_buffer_minutes).toBe(30);
  });
});

describe('buildSidebarNav', () => {
  it('keeps simple mode to the four core items plus More Tools leftovers', () => {
    const { primary, moreTools } = buildSidebarNav('simple', []);
    expect(primary.map((i) => i.label)).toEqual([
      'Dashboard',
      'Calendar',
      'Smart Reminders',
    ]);
    expect(primary.map((i) => i.label)).not.toContain('Share');
    expect(moreTools.some((i) => i.label === 'Settings')).toBe(true);
    expect(moreTools.some((i) => i.label === 'Contacts')).toBe(true);
    expect(moreTools.some((i) => i.label === 'Referrals')).toBe(true);
  });

  it('keeps paid booking under More Tools in simple mode even after it is used', () => {
    const { primary, moreTools } = buildSidebarNav('simple', ['paid-booking']);
    expect(primary.map((i) => i.label)).not.toContain('Paid Booking');
    expect(moreTools.some((i) => i.label === 'Paid Booking')).toBe(true);
  });

  it('flattens every tool in advanced mode', () => {
    const { primary, moreTools } = buildSidebarNav('advanced', []);
    expect(moreTools).toEqual([]);
    expect(primary.some((i) => i.label === 'Settings')).toBe(true);
    expect(primary.some((i) => i.label === 'Doc Center')).toBe(true);
    expect(primary.some((i) => i.label === 'Paid Booking')).toBe(true);
    expect(primary.map((i) => i.label)).not.toContain('Share');
  });
});

describe('parseRevealedTools', () => {
  it('drops unknown ids', () => {
    expect(parseRevealedTools(['paid-booking', 'nope'])).toEqual(['paid-booking']);
  });
});

describe('isBusinessType', () => {
  it('accepts known industries and rejects junk', () => {
    expect(isBusinessType('landscaper')).toBe(true);
    expect(isBusinessType('spaceship')).toBe(false);
  });
});

describe('isPlaceholderMeetingName', () => {
  it('matches seeded default meetings only', () => {
    expect(isPlaceholderMeetingName('30 Minute Meeting')).toBe(true);
    expect(isPlaceholderMeetingName('15 Min Consultation')).toBe(false);
  });
});

describe('navPathMatches', () => {
  it('does not highlight Dashboard when Share hash is active', () => {
    expect(navPathMatches('/dashboard', '/dashboard', '', '#share')).toBe(false);
    expect(navPathMatches('/dashboard#share', '/dashboard', '', '#share')).toBe(true);
  });

  it('does not highlight Settings when a specialty tab is open', () => {
    expect(navPathMatches('/dashboard/settings', '/dashboard/settings', '?tab=availability', '')).toBe(false);
    expect(navPathMatches('/dashboard/settings', '/dashboard/settings', '?tab=referrals', '')).toBe(false);
    expect(navPathMatches('/dashboard/settings?tab=availability', '/dashboard/settings', '?tab=availability', '')).toBe(true);
    expect(navPathMatches('/dashboard/settings?tab=referrals', '/dashboard/settings', '?tab=referrals', '')).toBe(true);
  });
});

describe('quoteTotals', () => {
  it('applies tax to the subtotal in cents', () => {
    expect(quoteTotals([{ amount: 100 }], 6)).toEqual({ subtotal: 100, taxAmount: 6, total: 106 });
  });
});
