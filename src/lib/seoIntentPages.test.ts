import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PINONIT_CORE_SENTENCE } from './seoIdentity';
import { INTENT_PAGES } from './seoIntentPages';
import { softwareApplicationJsonLd } from './jsonLd';

describe('SEO intent pages', () => {
  it('uses five distinct H1s and the same core sentence', () => {
    expect(INTENT_PAGES).toHaveLength(5);
    const h1s = INTENT_PAGES.map((p) => p.h1);
    expect(new Set(h1s).size).toBe(5);
    expect(INTENT_PAGES.map((p) => p.path)).toContain('/calendly-alternative');
    expect(INTENT_PAGES.map((p) => p.path)).not.toContain('/calendly-alternative-for-small-business');
    expect(readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8')).not.toContain(
      'calendly-alternative-for-small-business',
    );
    expect(readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8')).toContain(
      'https://pinonit.com/calendly-alternative</loc>',
    );
    for (const page of INTENT_PAGES) {
      expect(page.opening).toBe(PINONIT_CORE_SENTENCE);
      expect(page.metaTitle).toContain('PinOnIt');
      expect(page.canonical).toBe(`https://pinonit.com${page.path}`);
      expect(page.faq.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not fabricate reviews on SoftwareApplication schema', () => {
    const json = JSON.stringify(softwareApplicationJsonLd());
    expect(json).not.toMatch(/aggregateRating/);
    expect(json).toContain('8.99');
  });
});
