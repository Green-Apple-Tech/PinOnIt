import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '../components/Footer';
import {
  DocumentCenterDocPage,
  DocumentCenterIndexPage,
  DocumentCenterLegalPage,
} from '../pages/DocumentCenter';
import { postLoginDestination } from './signNow';
import {
  DOCUMENT_CENTER_CITIES,
  DOCUMENT_CENTER_CTA,
  DOCUMENT_CENTER_DISCLAIMER,
  DOCUMENT_CENTER_DOCS,
  DOCUMENT_CENTER_SAMPLE_BANNER,
  applyDocumentCenterShell,
  composeDocumentCenterSendText,
  documentCenterNextParam,
  isDocumentCenterSendPath,
  documentCenterPages,
  documentCenterSampleFiles,
  documentCenterSendPath,
  documentCenterSignupHref,
  findDocumentCenterPage,
  saveDocumentCenterDraft,
  documentCenterComposerPrefill,
} from './documentCenter';
import { isGuestNoIndexPath } from './guestNoIndex';

const authState = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: authState.user, loading: false }),
}));
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: () => undefined }),
}));

function renderAt(path: string) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/templates', element: createElement(DocumentCenterIndexPage) }),
        createElement(Route, { path: '/templates/privacy', element: createElement(DocumentCenterLegalPage, { kind: 'privacy' }) }),
        createElement(Route, { path: '/templates/terms', element: createElement(DocumentCenterLegalPage, { kind: 'terms' }) }),
        createElement(Route, {
          path: '/templates/:state/:city/:document',
          element: createElement(DocumentCenterDocPage),
        }),
      ),
    ),
  );
}

describe('document center catalog', () => {
  it('builds one page per city and document from the city list', () => {
    const pages = documentCenterPages();
    expect(DOCUMENT_CENTER_CITIES).toHaveLength(5);
    expect(DOCUMENT_CENTER_DOCS).toHaveLength(5);
    expect(pages).toHaveLength(25);
    expect(new Set(pages.map((page) => page.path)).size).toBe(25);
    expect(pages.map((page) => page.path)).toContain('/templates/florida/miami/roofing-contract/');
    expect(pages.map((page) => page.path)).toContain('/templates/florida/jacksonville/residential-lease-agreement/');
    for (const page of pages) {
      expect(page.canonical).toBe(`https://pinonit.com${page.path}`);
      expect(page.doc.facts[page.state.slug]?.length).toBeGreaterThan(0);
      expect(page.doc.body.join('\n')).toContain('ELECTRONIC SIGNATURES');
    }
  });

  it('keeps statute citations and the not-legal-advice notice', () => {
    const page = findDocumentCenterPage('florida', 'miami', 'roofing-contract');
    expect(page).not.toBeNull();
    const facts = page!.doc.facts.florida;
    expect(facts.some((fact) => fact.citation === 'Fla. Stat. § 713.015' && fact.url.includes('flsenate.gov'))).toBe(true);
    expect(facts.some((fact) => fact.citation === 'Fla. Stat. § 668.50')).toBe(true);
    const lease = findDocumentCenterPage('florida', 'tampa', 'residential-lease-agreement');
    expect(lease!.doc.facts.florida.some((fact) => fact.url.includes('epa.gov'))).toBe(true);
    expect(DOCUMENT_CENTER_DISCLAIMER).toMatch(/Not legal advice/);
    expect(documentCenterSampleFiles().map((file) => file.slug)).toContain('plumbing-contract');
    const sample = documentCenterSampleFiles().find((file) => file.slug === 'roofing-contract');
    expect(sample?.body.startsWith(DOCUMENT_CENTER_SAMPLE_BANNER)).toBe(true);
    expect(sample?.body).toContain('713.015');
  });

  it('carries filled fields into the send-for-signature text and a safe next URL', () => {
    const page = findDocumentCenterPage('florida', 'orlando', 'hvac-service-agreement')!;
    const text = composeDocumentCenterSendText(page, {
      'Contractor business name': 'Ada Air',
      'Owner name': 'Grace Hopper',
      'Contractor license #': 'CAC999',
    });
    expect(text).toContain('Ada Air');
    expect(text).toContain('Grace Hopper');
    expect(text).toContain('License # CAC999');
    expect(text).toContain('FILLED FIELDS');
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
    });
    saveDocumentCenterDraft(page.id, { 'Owner name': 'Grace Hopper', 'Contractor business name': 'Ada Air' });
    const prefill = documentCenterComposerPrefill('florida/orlando/hvac-service-agreement');
    expect(prefill?.recipientName).toBe('Grace Hopper');
    expect(prefill?.businessName).toBe('Ada Air');
    expect(prefill?.text).toContain('Ada Air');
    expect(prefill?.topic).toContain('Orlando');

    const send = documentCenterSendPath('florida', 'orlando', 'hvac-service-agreement');
    const href = documentCenterSignupHref('florida', 'orlando', 'hvac-service-agreement');
    expect(href.startsWith('/signup?next=')).toBe(true);
    const next = new URLSearchParams(href.slice(href.indexOf('?') + 1)).get('next');
    expect(documentCenterNextParam(next)).toBe(send);
    expect(documentCenterNextParam('https://evil.example/dashboard/documents/new?type=contract&mode=sign')).toBeNull();
    expect(documentCenterNextParam('/dashboard/documents/new?type=contract&mode=sign&docCenter=florida/miami/not-a-doc')).toBeNull();
    expect(documentCenterNextParam(`${send}&next=https://evil.example`)).toBeNull();
    expect(postLoginDestination(send, false)).toBe(send);
    const sendUrl = new URL(send, 'https://pinonit.com');
    expect(isDocumentCenterSendPath(sendUrl.pathname, sendUrl.search)).toBe(true);
    expect(isDocumentCenterSendPath('/dashboard/documents/new', '?type=nda')).toBe(false);
  });
});

describe('document center routes', () => {
  it('serves the index, a city document, and legal pages', () => {
    authState.user = null;
    const index = renderAt('/templates');
    expect(index).toContain('Free document templates');
    expect(index).toContain('href="/templates/florida/miami/roofing-contract/"');
    expect(index).toContain('Not legal advice');

    const slashed = renderAt('/templates/florida/miami/roofing-contract/');
    const plain = renderAt('/templates/florida/miami/roofing-contract');
    for (const html of [slashed, plain]) {
      expect(html).toContain('Free Miami, FL Roofing Contract Template');
      expect(html).toContain('Fla. Stat. § 713.015');
      expect(html).toContain('Not legal advice');
      expect(html).toContain(DOCUMENT_CENTER_CTA);
      expect(html).toContain('Download .txt');
      expect(html).toContain('href="/templates/florida/roofing-contract.txt"');
      expect(html).toContain('Fort Lauderdale');
      expect(html).not.toMatch(/<input[^>]*disabled/);
      expect(html.match(/<input /g)?.length).toBe(
        findDocumentCenterPage('florida', 'miami', 'roofing-contract')!.doc.fields.length,
      );
      expect(html).toContain('/signup?next=');
      expect(html).not.toMatch(/gtag|googletagmanager|facebook\.net|segment\.com|plausible|hotjar/i);
    }

    expect(renderAt('/templates/privacy')).toContain('no cookies, analytics');
    expect(renderAt('/templates/nope/miami/roofing-contract')).toContain('Template not found');
    expect(isGuestNoIndexPath('/templates/florida/miami/roofing-contract/')).toBe(false);
  });

  it('sends a signed-in visitor straight to the signature form', () => {
    authState.user = { id: 'host' };
    const html = renderAt('/templates/florida/tampa/lawn-care-contract');
    expect(html).toContain('href="/dashboard/documents/new?');
    expect(html).toContain('docCenter=florida%2Ftampa%2Flawn-care-contract');
    expect(html).not.toContain('/signup?next=');
    authState.user = null;
  });

  it('is registered before the booking slug and listed for indexing', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    const templatesAt = app.indexOf('path="/templates"');
    const slugAt = app.indexOf('path="/:slug"');
    expect(templatesAt).toBeGreaterThan(0);
    expect(templatesAt).toBeLessThan(slugAt);
    expect(app).toContain('path="/templates/:state/:city/:document"');

    const redirects = readFileSync(new URL('../../public/_redirects', import.meta.url), 'utf8');
    const netlify = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
    for (const src of [redirects, netlify]) {
      expect(src.indexOf('/templates')).toBeLessThan(src.indexOf('/:slug'));
      expect(src).not.toMatch(/\/templates\*?\s+\/\.netlify\/functions\/booking-shell/);
    }

    const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8');
    expect(robots).not.toMatch(/Disallow:\s*\/templates/);
    expect(robots).toContain('Sitemap: https://pinonit.com/sitemap.xml');

    const xml = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8');
    for (const page of documentCenterPages()) {
      expect(xml).toContain(`${page.canonical}</loc>`);
    }
    expect(xml).toContain('https://pinonit.com/templates/</loc>');
    expect(xml).toContain('https://pinonit.com/templates/privacy/</loc>');

    const footer = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Footer)));
    expect(footer).toContain('href="/templates/"');
    expect(footer).toContain('Templates');

    const vite = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
    expect(vite).toContain('navigateFallback: null');

    const shell = applyDocumentCenterShell(
      '<html><head><title>Old</title><meta name="description" content="old"><link rel="canonical" href="https://pinonit.com/" /><meta name="robots" content="index, follow" /></head><body><div id="root"><!--seo-snapshot-->home<!--/seo-snapshot--></div><script type="module" src="/src/main.tsx"></script></body></html>',
      {
        title: 'Roofing Contract Template — Miami, Florida (Free)',
        description: 'Free roofing contract template for Miami, FL.',
        canonical: 'https://pinonit.com/templates/florida/miami/roofing-contract/',
        snapshotHtml: '<h1>Free Miami, FL Roofing Contract Template</h1><p>Not legal advice.</p>',
      },
    );
    expect(shell).toContain('https://pinonit.com/templates/florida/miami/roofing-contract/');
    expect(shell).toContain('Free Miami, FL Roofing Contract Template');
    expect(shell).toContain('/src/main.tsx');
    expect(shell).toContain('index, follow');
  });
});
