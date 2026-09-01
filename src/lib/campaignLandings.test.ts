import { describe, expect, it } from 'vitest';
import { campaignCopy, NDA_SUPPORTING_LINE, NDA_SUBHEAD } from './campaignLandings';
import { HOLD_UP_COPY as DOC_HOLD_UP } from './documentCopy';

describe('campaignCopy', () => {
  it('serves NDA copy with the supporting line and logged-in Doc Center CTA', () => {
    const nda = campaignCopy('nda');
    expect(nda?.headline).toMatch(/NDA/i);
    expect(nda?.supportingLine).toBe(NDA_SUPPORTING_LINE);
    expect(nda?.subhead).not.toMatch(/They get a text, tap the link/i);
    expect(nda?.subhead).not.toMatch(/nothing guarantees legal enforceability/i);
    expect(nda?.typeShortcuts?.map((s) => s.label)).toEqual([
      'NDAs',
      'contracts',
      'invoices',
      'waivers',
      'receipts',
      'quotes',
    ]);
    expect(nda?.loggedInCtaTo).toBe('/dashboard/documents/new');
  });

  it('serves reminders copy as a templated campaign page', () => {
    const reminders = campaignCopy('reminders');
    expect(reminders?.slug).toBe('reminders');
    expect(reminders?.headline).toMatch(/remind/i);
    expect(reminders?.steps.length).toBeGreaterThanOrEqual(3);
    expect(reminders?.loggedInCtaTo).toBe('/dashboard/reminders');
    expect(reminders?.loggedInCtaLabel).toMatch(/reminder/i);
    expect(reminders?.subhead).not.toBe(NDA_SUBHEAD);
  });

  it('returns null for unknown slugs', () => {
    expect(campaignCopy('not-a-campaign')).toBeNull();
  });
});

describe('HOLD_UP_COPY', () => {
  it('uses the strong-legal-position line in both campaign and Doc Center copy', () => {
    expect(DOC_HOLD_UP).toMatch(/SMS-verified/i);
    expect(DOC_HOLD_UP).not.toMatch(/hold up if/i);
  });
});
