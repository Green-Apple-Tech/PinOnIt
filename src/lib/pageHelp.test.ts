import { describe, expect, it } from 'vitest';
import { getPageHelp } from './pageHelp';
import { buildHelpContextPack, matchHelpFaq } from './productHelpKnowledge';

describe('getPageHelp', () => {
  it('explains reminders on the reminders settings tab', () => {
    const g = getPageHelp('/dashboard/reminders');
    expect(g.title).toMatch(/reminder/i);
    expect(g.steps.length).toBeGreaterThan(1);
  });

  it('explains event types and contacts on the settings tabs', () => {
    expect(getPageHelp('/dashboard/settings', '?tab=event-types').title).toMatch(/event type/i);
    expect(getPageHelp('/dashboard/settings', '?tab=event-types').steps.join(' ')).toMatch(/recurring bookings/i);
    expect(getPageHelp('/dashboard/settings', '?tab=contacts').title).toMatch(/contact/i);
  });

  it('explains recurring bookings from the Booking hub', () => {
    const g = getPageHelp('/dashboard/booking');
    expect(g.title).toMatch(/booking/i);
    expect(g.steps.join(' ')).toMatch(/recurring bookings/i);
  });

  it('explains the Docs settings tab', () => {
    expect(getPageHelp('/dashboard/settings', '?tab=docs').title).toMatch(/docs/i);
    expect(getPageHelp('/dashboard/settings', '?tab=docs').purpose).toMatch(/waiver|template|PDF/i);
  });

  it('explains Quote-by-Text on the quotes routes', () => {
    expect(getPageHelp('/dashboard/quotes').title).toMatch(/quote-by-text/i);
    expect(getPageHelp('/dashboard/quotes/new').purpose).toMatch(/zelle|cash app|venmo|paypal/i);
    expect(getPageHelp('/dashboard/documents/new', '?type=quote').title).toMatch(/quote-by-text/i);
  });

  it('explains Doc Center on the documents routes', () => {
    expect(getPageHelp('/dashboard/documents').title).toMatch(/send docs|sign-by-text/i);
    expect(getPageHelp('/dashboard/documents/new').cannotDo?.join(' ')).toMatch(/will|trust|notary/i);
  });
});

describe('matchHelpFaq', () => {
  it('answers sign-by-text scope questions locally', () => {
    const faq = matchHelpFaq('Can I send a will with Sign-by-Text?');
    expect(faq?.id).toBe('sign-scope');
    expect(faq?.answer).toMatch(/wills/i);
    expect(faq?.answer).toMatch(/ESIGN/i);
  });

  it('answers how to send a document', () => {
    const faq = matchHelpFaq('How do I send an NDA?');
    expect(faq?.id).toBe('how-send-doc');
  });

  it('answers quote, pay, status, and contact-picker questions locally', () => {
    expect(matchHelpFaq('How do I send a quote?')?.id).toBe('how-send-quote');
    expect(matchHelpFaq('Where is Quote-by-Text?')?.id).toBe('how-send-quote');
    expect(matchHelpFaq('How do they pay?')?.id).toBe('how-they-pay');
    expect(matchHelpFaq('What does Viewed mean?')?.id).toBe('quote-status');
    expect(matchHelpFaq('How do I mark a quote paid?')?.id).toBe('quote-status');
    expect(matchHelpFaq('Find in contacts does nothing')?.id).toBe('find-contacts');
    expect(matchHelpFaq('On my way')?.id).toBe('on-my-way');
    expect(matchHelpFaq('Where are recurring bookings?')?.id).toBe('recurring-bookings');
  });
});

describe('buildHelpContextPack', () => {
  it('includes page and product limits', () => {
    const pack = buildHelpContextPack(getPageHelp('/dashboard/documents'));
    expect(pack).toMatch(/PAGE:/);
    expect(pack).toMatch(/PRODUCT CANNOT/);
    expect(pack).toMatch(/wills/i);
  });
});
