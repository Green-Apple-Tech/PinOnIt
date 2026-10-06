import { describe, expect, it } from 'vitest';
import { draftResponse, scoreOpportunity, type FinderQuery } from './redditFinder';

const query: FinderQuery = {
  q: 'Calendly alternative',
  industry: 'cleaners',
  feature: 'scheduling',
  intent: 36,
  seo: true,
};

const now = Date.parse('2026-10-05T12:00:00Z');

describe('scoreOpportunity', () => {
  it('scores a recent recommendation request highly and mentions PinOnIt', () => {
    const result = scoreOpportunity({
      title: 'Cheap Calendly alternative for a one-person cleaning business?',
      body: 'Looking for something that texts reminders. Customers will not download an app.',
      createdUtc: (now - 3 * 60 * 60 * 1000) / 1000,
      numComments: 4,
      archived: false,
      query,
      rulesText: 'Be nice. Recommendations are welcome.',
      nowMs: now,
    });
    expect(result.score).toBeGreaterThan(70);
    expect(result.mention).toBe('yes');
    expect(result.highSeoValue).toBe(true);
    expect(result.suggestedResponse).toContain('cleaning business');
    expect(result.suggestedResponse).toContain('Full disclosure');
  });

  it('does not recommend PinOnIt when the subreddit bans promotion', () => {
    const result = scoreOpportunity({
      title: 'What scheduling app should I use?',
      body: 'Looking for a Calendly alternative.',
      createdUtc: now / 1000,
      numComments: 3,
      archived: false,
      query,
      rulesText: 'No self-promotion or advertising.',
      nowMs: now,
    });
    expect(result.mention).toBe('no');
    expect(result.suggestedResponse.toLowerCase()).toContain('do not mention pinonit');
    expect(result.score).toBeLessThan(40);
  });

  it('does not pitch PinOnIt for a job it does not do', () => {
    const result = scoreOpportunity({
      title: 'Need a notary and multi-signer closing package',
      body: 'Looking for a DocuSign alternative for real estate closings.',
      createdUtc: now / 1000,
      numComments: 2,
      archived: false,
      query: { ...query, q: 'DocuSign alternative', feature: 'sign-by-text' },
      rulesText: '',
      nowMs: now,
    });
    expect(result.mention).toBe('no');
    expect(result.mentionReason.toLowerCase()).toContain('does not do');
  });

  it('writes different drafts for different threads', () => {
    const a = draftResponse({
      mention: 'yes',
      title: 'Waiver for boat rentals',
      problem: 'Guests will not download an app.',
      feature: 'texting a waiver',
    });
    const b = draftResponse({
      mention: 'yes',
      title: 'HVAC no-shows',
      problem: 'Techs lose the afternoon when people forget.',
      feature: 'text reminders',
    });
    expect(a).not.toBe(b);
    expect(a).toContain('boat rentals');
    expect(b).toContain('HVAC');
  });
});
