import { describe, expect, it } from 'vitest';
import { classifyOpportunity, draftResponse, opportunityKinds, parsePublicSearchResults, redditThreadFromUrl, scoreOpportunity, type FinderQuery } from './redditFinder';

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
    expect(result.suggestedResponse.toLowerCase()).toContain('calendly');
    expect(result.suggestedResponse.toLowerCase()).toContain('pinonit');
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
    expect(a).toContain('Waiver for boat rentals');
    expect(b).toContain('HVAC no-shows');
  });
});

describe('classifyOpportunity', () => {
  const base = {
    score: 90,
    mention: 'yes' as const,
    rulesBan: false,
    text: 'Looking for a Calendly alternative for my cleaning business',
    subreddit: 'smallbusiness',
    duplicate: false,
    mentionsToday: 0,
    subredditToday: 0,
  };

  it('marks a direct fit green', () => {
    expect(classifyOpportunity(base).band).toBe('green');
  });

  it('marks a promotion ban red and never a posting candidate', () => {
    expect(classifyOpportunity({ ...base, rulesBan: true }).band).toBe('red');
  });

  it('holds a borderline thread for review', () => {
    expect(classifyOpportunity({ ...base, score: 60, mention: 'maybe' }).band).toBe('yellow');
  });

  it('stops extra mentions after the daily cap', () => {
    expect(classifyOpportunity({ ...base, mentionsToday: 2 }).band).toBe('yellow');
  });
});

describe('fallback search helpers', () => {
  it('keeps a public reddit thread url and drops other pages', () => {
    expect(redditThreadFromUrl('https://www.reddit.com/r/smallbusiness/comments/abc123/calendly_alternative/')).toEqual({
      fullname: 't3_abc123',
      permalink: '/r/smallbusiness/comments/abc123/calendly_alternative/',
      subreddit: 'smallbusiness',
    });
    expect(redditThreadFromUrl('https://www.reddit.com/r/smallbusiness/')).toBeNull();
  });

  it('reads a public search result for a reddit thread', () => {
    const html = `<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.reddit.com%2Fr%2FSaaS%2Fcomments%2F14gubm3%2Flooking_for_a_free_alternative_to_calendly_that%2F&amp;rut=abc" class='result-link'>Looking for a free alternative to Calendly - Reddit</a><td class='result-snippet'>I was seeking a free alternative.</td>`;
    expect(parsePublicSearchResults(html)).toEqual([{
      title: 'Looking for a free alternative to Calendly',
      link: 'https://www.reddit.com/r/SaaS/comments/14gubm3/looking_for_a_free_alternative_to_calendly_that/',
      snippet: 'I was seeking a free alternative.',
      position: 1,
    }]);
  });

  it('lets one thread be both a customer lead and an SEO result', () => {
    expect(opportunityKinds({
      seoQuery: true,
      searchRank: 2,
      ageDays: 3,
      mention: 'yes',
      band: 'green',
      intent: 36,
    })).toEqual({ customer: true, seo: true });
  });
});
