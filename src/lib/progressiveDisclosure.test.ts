import { describe, expect, it } from 'vitest';
import { buildSidebarNav, navPathMatches } from './dashboardNav';
import { parseRevealedTools, presetsForBusinessType, profilePatchForBusinessType } from './progressiveDisclosure';
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

describe('quoteTotals', () => {
  it('applies tax to the subtotal in cents', () => {
    expect(quoteTotals([{ amount: 100 }], 6)).toEqual({ subtotal: 100, taxAmount: 6, total: 106 });
  });
});
