import { describe, expect, it } from 'vitest';
import {
  isQuoteExpired,
  quoteHostStatus,
  quoteLinkSms,
  receiptLinkSms,
  validUntilFromDays,
} from './quoteSms';

describe('quote SMS copy', () => {
  it('names the business, job, total, and approve link', () => {
    const sms = quoteLinkSms({
      businessName: 'Pedro Lawn',
      shortDescription: 'front yard cleanup',
      total: 450,
      link: 'https://pinonit.com/d/abc',
    });
    expect(sms).toBe("Pedro Lawn: Here's your quote for front yard cleanup — $450.00. View and approve: https://pinonit.com/d/abc");
  });

  it('builds a receipt text after mark paid', () => {
    const sms = receiptLinkSms({
      businessName: 'Pedro Lawn',
      shortDescription: 'front yard cleanup',
      total: 450,
      link: 'https://pinonit.com/d/abc',
    });
    expect(sms).toBe('Pedro Lawn: Receipt for front yard cleanup — $450.00. View: https://pinonit.com/d/abc');
  });
});

describe('quote expiry', () => {
  it('is expired after valid_until', () => {
    expect(isQuoteExpired('2020-01-01T00:00:00.000Z', new Date('2026-09-08T00:00:00.000Z'))).toBe(true);
    expect(isQuoteExpired('2030-01-01T00:00:00.000Z', new Date('2026-09-08T00:00:00.000Z'))).toBe(false);
    expect(isQuoteExpired(null)).toBe(false);
  });

  it('defaults validity to 30 days', () => {
    const from = new Date('2026-09-08T12:00:00.000Z');
    expect(validUntilFromDays(30, from)).toBe(new Date('2026-10-08T12:00:00.000Z').toISOString());
  });
});

describe('quote host status', () => {
  it('labels Viewed vs Approved vs Expired for the host list', () => {
    expect(quoteHostStatus({ status: 'pending' }).label).toBe('Sent');
    expect(quoteHostStatus({ status: 'viewed' }).label).toBe('Viewed');
    expect(quoteHostStatus({ status: 'signed' }).label).toBe('Approved');
    expect(quoteHostStatus({ status: 'paid' }).label).toBe('Paid');
    expect(quoteHostStatus({ status: 'pending', valid_until: '2020-01-01T00:00:00.000Z' }).label).toBe('Expired');
  });
});
