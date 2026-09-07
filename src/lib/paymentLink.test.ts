import { describe, expect, it } from 'vitest';
import { documentShowsPayLink, normalizeExternalUrl } from './paymentLink';

describe('normalizeExternalUrl', () => {
  it('returns null for blank input', () => {
    expect(normalizeExternalUrl('')).toBeNull();
    expect(normalizeExternalUrl('  ')).toBeNull();
    expect(normalizeExternalUrl(null)).toBeNull();
  });

  it('keeps http(s) URLs and prefixes the rest', () => {
    expect(normalizeExternalUrl('https://paypal.me/jane')).toBe('https://paypal.me/jane');
    expect(normalizeExternalUrl('paypal.me/jane')).toBe('https://paypal.me/jane');
    expect(normalizeExternalUrl('//venmo.com/u/jane')).toBe('https://venmo.com/u/jane');
  });
});

describe('documentShowsPayLink', () => {
  it('is on for quotes, invoices, and work docs — not receipts or waivers', () => {
    expect(documentShowsPayLink('quote')).toBe(true);
    expect(documentShowsPayLink('invoice')).toBe(true);
    expect(documentShowsPayLink('work_order')).toBe(true);
    expect(documentShowsPayLink('receipt')).toBe(false);
    expect(documentShowsPayLink('waiver')).toBe(false);
    expect(documentShowsPayLink('nda')).toBe(false);
  });
});
