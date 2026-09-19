import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PINONIT_CORE_SENTENCE, PINONIT_SOFTWARE } from './seoIdentity';
import { PRO_PRICE } from './pricing';
import { INTENT_PAGES } from './seoIntentPages';
import { softwareApplicationJsonLd, websiteJsonLd } from './jsonLd';

const REQUIRED_PATHS = [
  '/calendly-alternative',
  '/docusign-alternative',
  '/sign-by-text',
  '/electronic-signature-by-text',
  '/booking-with-sms-reminders',
  '/send-quote-by-text',
  '/send-estimate-by-text',
  '/forms-and-waivers',
  '/contractor-booking-app',
  '/small-business-booking-app',
  '/service-business-software',
  '/calendly-docusign-alternative',
];

describe('SEO intent pages', () => {
  it('uses distinct H1s, titles, and the same core sentence', () => {
    const h1s = INTENT_PAGES.map((p) => p.h1);
    const titles = INTENT_PAGES.map((p) => p.metaTitle);
    const paths = INTENT_PAGES.map((p) => p.path);
    expect(new Set(h1s).size).toBe(INTENT_PAGES.length);
    expect(new Set(titles).size).toBe(INTENT_PAGES.length);
    expect(new Set(paths).size).toBe(INTENT_PAGES.length);
    expect(paths).toContain('/calendly-alternative');
    expect(paths).not.toContain('/calendly-alternative-for-small-business');
    expect(paths).toContain('/solutions');
    for (const required of REQUIRED_PATHS) {
      expect(paths).toContain(required);
    }
    for (const page of INTENT_PAGES) {
      expect(page.opening).toBe(PINONIT_CORE_SENTENCE);
      expect(page.metaTitle).toContain('PinOnIt');
      expect(page.canonical).toBe(`https://pinonit.com${page.path}`);
      expect(page.faq.length).toBeGreaterThanOrEqual(3);
      expect(page.body.join(' ')).not.toMatch(/completely replaces/i);
    }
  });

  it('gives each landing 2–4 related links and unique opening body copy', () => {
    const firstParas = INTENT_PAGES.map((p) => p.body[0]);
    expect(new Set(firstParas).size).toBe(INTENT_PAGES.length);
    for (const page of INTENT_PAGES) {
      expect(page.related?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(page.related?.length ?? 0).toBeLessThanOrEqual(4);
    }
  });

  it('lists every intent URL in the sitemap and omits the retired Calendly slug', () => {
    const xml = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8');
    expect(xml).not.toContain('calendly-alternative-for-small-business');
    for (const page of INTENT_PAGES) {
      expect(xml).toContain(`${page.canonical}</loc>`);
    }
  });

  it('derives SoftwareApplication price from the live Pro config', () => {
    expect(PINONIT_SOFTWARE.price).toBe(String(PRO_PRICE));
    const json = JSON.stringify(softwareApplicationJsonLd());
    expect(json).not.toMatch(/aggregateRating/);
    expect(json).toContain(String(PRO_PRICE));
    expect(json).toContain('featureList');
    expect(json).toContain('Sign-by-Text');
    expect(JSON.stringify(websiteJsonLd())).toContain('WebSite');
  });
});
