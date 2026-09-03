import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { CONTRACT_HOST_HINT, WAIVER_HOST_HINT } from './documentCopy';
import {
  CONTRACT_STARTER_TEXT,
  INVOICE_STARTER_TEXT,
  NDA_STARTER_TEXT,
  QUOTE_STARTER_TEXT,
  RECEIPT_STARTER_TEXT,
  WAIVER_STARTER_TEXT,
  fillDocumentPlaceholders,
  injectWaiverRecipientPlaceholder,
  resolveHostBusinessName,
} from './documents';

describe('contract starter vs host hint', () => {
  it('keeps the disclaimer out of the contract body', () => {
    expect(CONTRACT_STARTER_TEXT).not.toContain(CONTRACT_HOST_HINT);
    expect(CONTRACT_STARTER_TEXT).not.toMatch(/not legal advice/);
  });

  it('fills Topic and Recipient Name without touching the host hint', () => {
    const filled = fillDocumentPlaceholders(CONTRACT_STARTER_TEXT, {
      topic: 'Website rebuild',
      recipientName: 'Jane Smith',
    });
    expect(filled).toContain('Website rebuild');
    expect(filled).toContain('Jane Smith');
    expect(filled).not.toContain('[Topic]');
    expect(filled).not.toContain('[Recipient Name]');
    expect(filled).not.toContain(CONTRACT_HOST_HINT);
    expect(CONTRACT_HOST_HINT).toMatch(/not legal advice/);
  });
});

describe('live document placeholders', () => {
  const starters: Array<[string, string]> = [
    ['nda', NDA_STARTER_TEXT],
    ['contract', CONTRACT_STARTER_TEXT],
    ['waiver', WAIVER_STARTER_TEXT],
    ['quote', QUOTE_STARTER_TEXT],
    ['invoice', INVOICE_STARTER_TEXT],
    ['receipt', RECEIPT_STARTER_TEXT],
  ];

  it.each(starters)('%s starter includes [Recipient Name] in the visible body', (_type, text) => {
    expect(text).toContain('[Recipient Name]');
  });

  it('keeps the waiver host hint out of the signed body', () => {
    expect(WAIVER_STARTER_TEXT).not.toContain(WAIVER_HOST_HINT);
    expect(WAIVER_STARTER_TEXT).toMatch(/^I, \[Recipient Name\], in consideration/m);
  });

  it('fills recipient and business together without mixing them', () => {
    const filled = fillDocumentPlaceholders(WAIVER_STARTER_TEXT, {
      recipientName: 'Bob smith',
      businessName: 'peter',
      activityDescription: 'power washing',
    });
    expect(filled).toContain('I, Bob smith, in consideration');
    expect(filled).toContain('power washing provided by peter');
    expect(filled).not.toContain('[Recipient Name]');
    expect(filled).not.toContain('[Business Name]');
    expect(filled).not.toContain('[Activity/Service Description]');
    expect(filled.indexOf('Bob smith')).toBeLessThan(filled.indexOf('peter'));
  });

  it('fills recipient aliases used on quotes and invoices', () => {
    const filled = fillDocumentPlaceholders(
      'Prepared for: [Client Name]. Customer: [Customer]. Also [Customer Name].',
      { recipientName: 'Bob smith' },
    );
    expect(filled).toBe('Prepared for: Bob smith. Customer: Bob smith. Also Bob smith.');
  });

  it('fills NDA recipient live from the name field', () => {
    const filled = fillDocumentPlaceholders(NDA_STARTER_TEXT, {
      topic: 'Kitchen remodel',
      recipientName: 'Bob smith',
    });
    expect(filled).toContain('and Bob smith ("Receiving Party")');
    expect(filled).toContain('Kitchen remodel');
    expect(filled).not.toContain('[Recipient Name]');
  });

  it('fills quote prepared-for line from recipient name', () => {
    const filled = fillDocumentPlaceholders(QUOTE_STARTER_TEXT, {
      topic: 'Driveway seal',
      recipientName: 'Bob smith',
    });
    expect(filled).toContain('Prepared for: Bob smith.');
    expect(filled).toContain('Driveway seal');
  });

  it('upgrades the old waiver opening so recipient fills live', () => {
    const old = `LIABILITY WAIVER AND RELEASE

In consideration for participating in or receiving services related to
[Activity/Service Description] provided by [Business Name], I acknowledge
and agree to the following:`;
    const upgraded = injectWaiverRecipientPlaceholder(old);
    expect(upgraded).toContain('I, [Recipient Name], in consideration');
    const filled = fillDocumentPlaceholders(upgraded, {
      recipientName: 'Bob smith',
      businessName: 'peter',
      activityDescription: 'power washing',
    });
    expect(filled).toContain('I, Bob smith, in consideration');
    expect(filled).toContain('provided by peter');
  });
});

describe('resolveHostBusinessName', () => {
  it('prefers business_name over paid booking display_name and full_name', () => {
    expect(
      resolveHostBusinessName({
        business_name: 'Acme Co',
        full_name: 'Peter',
        paid_booking_settings: { display_name: 'Storefront' },
      }),
    ).toBe('Acme Co');
    expect(
      resolveHostBusinessName({
        business_name: null,
        full_name: 'Peter',
        paid_booking_settings: { display_name: 'Storefront' },
      }),
    ).toBe('Storefront');
    expect(resolveHostBusinessName({ business_name: '', full_name: 'Peter' })).toBe('Peter');
  });
});
