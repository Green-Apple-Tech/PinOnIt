import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_CENTER_CTA,
  DOCUMENT_CENTER_DISCLAIMER,
  DOCUMENT_CENTER_INDEX,
  DOCUMENT_CENTER_INDEX_FAQ,
  DOCUMENT_CENTER_PATHS,
  DOCUMENT_CENTER_TEMPLATES,
  documentCenterRelated,
  documentCenterSignupHref,
  fillTemplateBody,
  getDocumentCenterTemplate,
} from './documentCenter';

describe('document center', () => {
  it('exposes an index path and five unique template slugs under /templates', () => {
    expect(DOCUMENT_CENTER_INDEX.path).toBe('/templates');
    expect(DOCUMENT_CENTER_TEMPLATES).toHaveLength(5);
    const slugs = DOCUMENT_CENTER_TEMPLATES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(5);
    expect(DOCUMENT_CENTER_PATHS).toEqual([
      '/templates',
      ...DOCUMENT_CENTER_TEMPLATES.map((t) => t.path),
    ]);
    for (const template of DOCUMENT_CENTER_TEMPLATES) {
      expect(template.path).toBe(`/templates/${template.slug}`);
    }
  });

  it('gives each template unique copy, a how-to, an FAQ, and title/meta', () => {
    const bodies = new Set<string>();
    const titles = new Set<string>();
    for (const template of DOCUMENT_CENTER_TEMPLATES) {
      expect(template.metaTitle.length).toBeGreaterThan(20);
      expect(template.metaDescription.length).toBeGreaterThan(40);
      expect(template.h1).toBeTruthy();
      expect(template.body.length).toBeGreaterThan(400);
      expect(template.howTo.length).toBeGreaterThanOrEqual(3);
      expect(template.faq.length).toBeGreaterThanOrEqual(3);
      expect(template.body).toMatch(/not legal advice/i);
      expect(template.faq.some((item) => /legal advice/i.test(item.q) || /legal advice/i.test(item.a))).toBe(true);
      bodies.add(template.body);
      titles.add(template.metaTitle);
    }
    expect(bodies.size).toBe(5);
    expect(titles.size).toBe(5);
  });

  it('does not invent testimonials or performance stats', () => {
    const haystack = [
      DOCUMENT_CENTER_INDEX.intro,
      DOCUMENT_CENTER_INDEX.description,
      DOCUMENT_CENTER_DISCLAIMER,
      ...DOCUMENT_CENTER_INDEX_FAQ.map((item) => `${item.q} ${item.a}`),
      ...DOCUMENT_CENTER_TEMPLATES.flatMap((t) => [
        t.summary,
        t.body,
        t.metaDescription,
        ...t.howTo,
        ...t.faq.map((item) => `${item.q} ${item.a}`),
      ]),
    ].join('\n');
    expect(haystack).not.toMatch(/\b\d{2,}%\b/);
    expect(haystack).not.toMatch(/testimonial/i);
    expect(haystack).not.toMatch(/\bcustomers say\b/i);
    expect(haystack).not.toMatch(/\b#1\b/);
  });

  it('keeps a plain-English legal-advice disclaimer and a signup CTA', () => {
    expect(DOCUMENT_CENTER_DISCLAIMER).toMatch(/not legal advice/i);
    expect(DOCUMENT_CENTER_CTA).toBe('Fill & send for signature by text — free PinOnIt account');
    expect(documentCenterSignupHref('miami-fl-handyman-service-agreement')).toBe(
      '/signup?utm_source=document-center&utm_medium=templates&utm_campaign=document-center&utm_content=miami-fl-handyman-service-agreement',
    );
  });

  it('fills placeholders and links each template to the others', () => {
    const filled = fillTemplateBody('Hello {{businessName}} in {{city}}', {
      businessName: 'Palm Fix',
    });
    expect(filled).toBe('Hello Palm Fix in __________');
    expect(getDocumentCenterTemplate('missing')).toBeNull();
    const related = documentCenterRelated('miami-fl-handyman-service-agreement');
    expect(related).toHaveLength(4);
    expect(related.some((l) => l.path.includes('handyman'))).toBe(false);
  });
});
