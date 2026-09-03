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
    expect(getPageHelp('/dashboard/settings', '?tab=contacts').title).toMatch(/contact/i);
  });

  it('explains the Docs settings tab', () => {
    expect(getPageHelp('/dashboard/settings', '?tab=docs').title).toMatch(/docs/i);
    expect(getPageHelp('/dashboard/settings', '?tab=docs').purpose).toMatch(/waiver|template|PDF/i);
  });

  it('explains Doc Center on the quotes and documents routes', () => {
    expect(getPageHelp('/dashboard/quotes').title).toMatch(/send docs|sign-by-text|doc/i);
    expect(getPageHelp('/dashboard/documents').title).toMatch(/send docs|sign-by-text/i);
    expect(getPageHelp('/dashboard/documents/new').cannotDo?.join(' ')).toMatch(/will|trust|notary/i);
  });
});

describe('matchHelpFaq', () => {
  it('answers sign-by-text scope questions locally', () => {
    const faq = matchHelpFaq('Can I send a will with Sign-by-Text?');
    expect(faq?.id).toBe('sign-scope');
    expect(faq?.answer).toMatch(/not for wills/i);
  });

  it('answers how to send a document', () => {
    const faq = matchHelpFaq('How do I send an NDA?');
    expect(faq?.id).toBe('how-send-doc');
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
