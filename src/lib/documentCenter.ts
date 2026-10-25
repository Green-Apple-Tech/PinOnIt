/**
 * Public Document Center (/templates).
 * Cities are the only per-market config: add one entry to DOCUMENT_CENTER_CITIES
 * and every document in the catalog gets a page for that city, as long as the
 * document has facts for the city's state.
 */
import catalogJson from './documentCenter.data.json';
import { storageGet, storageSet } from './safeStorage';

export const DOCUMENT_CENTER_ORIGIN = 'https://pinonit.com';
export const DOCUMENT_CENTER_BASE_PATH = '/templates';
export const DOCUMENT_CENTER_LASTMOD = '2026-10-25';
export const DOCUMENT_CENTER_DRAFT_KEY = 'pinonit_doc_center_draft';
export const DOCUMENT_CENTER_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const DOCUMENT_CENTER_DISCLAIMER =
  'Not legal advice. This page is general information and a generic sample template. Laws change and your situation may differ. Have a Florida attorney review any contract before you use it.';

export const DOCUMENT_CENTER_SAMPLE_BANNER =
  'SAMPLE — GENERIC TEMPLATE — HAVE AN ATTORNEY REVIEW BEFORE USE';

export const DOCUMENT_CENTER_CTA = 'Fill it in and send for signature by text';

export const DOCUMENT_CENTER_INDEX_CTA = 'Fill it in and send for signature by text — no app needed →';

const RECIPIENT_FIELDS = ['Owner name', 'Customer name', 'Tenant name(s)'];
const BUSINESS_FIELDS = ['Contractor business name', 'Company name', 'Landlord name'];

export type DocumentCenterFact = {
  title: string;
  text: string;
  url: string;
  citation: string;
};

export type DocumentCenterState = {
  slug: string;
  name: string;
  abbr: string;
};

export type DocumentCenterCity = {
  slug: string;
  name: string;
  state: string;
  county: string;
};

export type DocumentCenterDoc = {
  slug: string;
  title: string;
  trade: string;
  keyword: string;
  intro: string;
  fields: string[];
  body: string[];
  facts: Record<string, DocumentCenterFact[]>;
};

type CatalogFile = Record<string, Omit<DocumentCenterDoc, 'slug'>>;

export const DOCUMENT_CENTER_STATES: DocumentCenterState[] = [
  { slug: 'florida', name: 'Florida', abbr: 'FL' },
];

/** One object per city. Document pages are generated from this list. */
export const DOCUMENT_CENTER_CITIES: DocumentCenterCity[] = [
  { slug: 'miami', name: 'Miami', state: 'florida', county: 'Miami-Dade' },
  { slug: 'fort-lauderdale', name: 'Fort Lauderdale', state: 'florida', county: 'Broward' },
  { slug: 'tampa', name: 'Tampa', state: 'florida', county: 'Hillsborough' },
  { slug: 'orlando', name: 'Orlando', state: 'florida', county: 'Orange' },
  { slug: 'jacksonville', name: 'Jacksonville', state: 'florida', county: 'Duval' },
];

export const DOCUMENT_CENTER_DOCS: DocumentCenterDoc[] = Object.entries(catalogJson as CatalogFile).map(
  ([slug, doc]) => ({ slug, ...doc }),
);

export type DocumentCenterPage = {
  id: string;
  state: DocumentCenterState;
  city: DocumentCenterCity;
  doc: DocumentCenterDoc;
  /** Trailing slash, matching the public canonical. */
  path: string;
  canonical: string;
  title: string;
  description: string;
  h1: string;
};

export type DocumentCenterSitemapEntry = {
  loc: string;
  changefreq: string;
  priority: string;
  lastmod: string;
};

export type DocumentCenterShellSpec = {
  /** Path segments under /templates, empty for the index. */
  dir: string[];
  title: string;
  description: string;
  canonical: string;
  snapshotHtml: string;
};

export type DocumentCenterSampleFile = {
  state: string;
  slug: string;
  body: string;
};

function stateBySlug(slug: string) {
  return DOCUMENT_CENTER_STATES.find((state) => state.slug === slug) ?? null;
}

export function documentCenterDocPath(state: string, city: string, doc: string) {
  return `${DOCUMENT_CENTER_BASE_PATH}/${state}/${city}/${doc}/`;
}

export function documentCenterCanonical(path: string) {
  const withSlash = path.endsWith('/') ? path : `${path}/`;
  return `${DOCUMENT_CENTER_ORIGIN}${withSlash}`;
}

function buildPage(state: DocumentCenterState, city: DocumentCenterCity, doc: DocumentCenterDoc): DocumentCenterPage {
  const path = documentCenterDocPath(state.slug, city.slug, doc.slug);
  const title = `${doc.title} Template — ${city.name}, ${state.name} (Free)`;
  return {
    id: `${state.slug}/${city.slug}/${doc.slug}`,
    state,
    city,
    doc,
    path,
    canonical: documentCenterCanonical(path),
    title,
    description: `Free ${doc.title.toLowerCase()} template for ${city.name}, ${state.abbr}. Plain-language ${state.name} rules with sources, fill-in form, and sign by text in 60 seconds.`,
    h1: `Free ${city.name}, ${state.abbr} ${doc.title} Template`,
  };
}

export function documentCenterPages(): DocumentCenterPage[] {
  const pages: DocumentCenterPage[] = [];
  for (const doc of DOCUMENT_CENTER_DOCS) {
    for (const city of DOCUMENT_CENTER_CITIES) {
      const state = stateBySlug(city.state);
      if (!state || !doc.facts[state.slug]?.length) continue;
      pages.push(buildPage(state, city, doc));
    }
  }
  return pages;
}

export function findDocumentCenterPage(state: string, city: string, doc: string): DocumentCenterPage | null {
  return documentCenterPages().find(
    (page) => page.state.slug === state && page.city.slug === city && page.doc.slug === doc,
  ) ?? null;
}

export function documentCenterIndexPath() {
  return `${DOCUMENT_CENTER_BASE_PATH}/`;
}

export function documentCenterLegalPath(kind: 'privacy' | 'terms') {
  return `${DOCUMENT_CENTER_BASE_PATH}/${kind}/`;
}

export const DOCUMENT_CENTER_INDEX_META = {
  title: 'Free Contract & Lease Templates by City — Sign by Text | PinOnIt',
  description: 'Free Florida contractor contract and lease templates by city. Fill in and send for e-signature by text, no app needed.',
  canonical: documentCenterCanonical(documentCenterIndexPath()),
  h1: 'Free document templates — sign them by text',
};

export function documentCenterLegalMeta(kind: 'privacy' | 'terms') {
  if (kind === 'privacy') {
    return {
      title: 'Privacy — PinOnIt Document Center',
      description: 'Privacy policy',
      canonical: documentCenterCanonical(documentCenterLegalPath('privacy')),
      h1: 'Privacy',
    };
  }
  return {
    title: 'Terms — PinOnIt Document Center',
    description: 'Terms of use',
    canonical: documentCenterCanonical(documentCenterLegalPath('terms')),
    h1: 'Terms of use',
  };
}

export function documentCenterSitemapEntries(): DocumentCenterSitemapEntry[] {
  const index: DocumentCenterSitemapEntry = {
    loc: DOCUMENT_CENTER_INDEX_META.canonical,
    changefreq: 'weekly',
    priority: '0.7',
    lastmod: DOCUMENT_CENTER_LASTMOD,
  };
  const pages = documentCenterPages().map((page) => ({
    loc: page.canonical,
    changefreq: 'monthly',
    priority: '0.6',
    lastmod: DOCUMENT_CENTER_LASTMOD,
  }));
  const legal = (['privacy', 'terms'] as const).map((kind) => ({
    loc: documentCenterLegalMeta(kind).canonical,
    changefreq: 'yearly',
    priority: '0.2',
    lastmod: DOCUMENT_CENTER_LASTMOD,
  }));
  return [index, ...pages, ...legal];
}

export function documentCenterIntro(page: DocumentCenterPage) {
  return `${page.doc.intro} This guide is for ${page.doc.trade.toLowerCase()} work and agreements in ${page.city.name} (${page.city.county} County), ${page.state.name}.`;
}

export function documentCenterSampleFile(doc: DocumentCenterDoc) {
  return `${DOCUMENT_CENTER_SAMPLE_BANNER}\n\n${doc.title.toUpperCase()}\n\n${doc.body.join('\n\n')}\n`;
}

export function documentCenterSampleFiles(): DocumentCenterSampleFile[] {
  const states = new Set(DOCUMENT_CENTER_CITIES.map((city) => city.state));
  const files: DocumentCenterSampleFile[] = [];
  for (const state of states) {
    for (const doc of DOCUMENT_CENTER_DOCS) {
      if (!doc.facts[state]?.length) continue;
      files.push({ state, slug: doc.slug, body: documentCenterSampleFile(doc) });
    }
  }
  return files;
}

export function documentCenterSampleHref(state: string, slug: string) {
  return `${DOCUMENT_CENTER_BASE_PATH}/${state}/${slug}.txt`;
}

export function fieldValue(values: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = values[name]?.trim();
    if (value) return value;
  }
  return '';
}

export function composeDocumentCenterBody(doc: DocumentCenterDoc, values: Record<string, string>) {
  let text = doc.body.join('\n\n');
  for (const field of doc.fields) {
    const value = values[field]?.trim();
    if (!value) continue;
    text = text.split(`[${field}]`).join(value);
  }
  const license = values['Contractor license #']?.trim();
  if (license) text = text.replaceAll('License # [__]', `License # ${license}`);
  return text;
}

export function composeDocumentCenterSendText(page: DocumentCenterPage, values: Record<string, string>) {
  const filled = page.doc.fields
    .map((field) => `${field}: ${(values[field] ?? '').trim()}`)
    .join('\n');
  return [
    DOCUMENT_CENTER_SAMPLE_BANNER,
    '',
    page.doc.title.toUpperCase(),
    `${page.city.name}, ${page.state.name} (${page.city.county} County)`,
    '',
    composeDocumentCenterBody(page.doc, values),
    '',
    'FILLED FIELDS',
    filled,
  ].join('\n');
}

type StoredDraft = {
  id?: string;
  values?: Record<string, string>;
  savedAt?: number;
};

function cleanValues(values: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values)) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim().slice(0, 500);
    if (value) out[key.slice(0, 120)] = value;
    if (Object.keys(out).length >= 40) break;
  }
  return out;
}

export function saveDocumentCenterDraft(id: string, values: Record<string, string>) {
  const payload: StoredDraft = { id, values: cleanValues(values), savedAt: Date.now() };
  storageSet(DOCUMENT_CENTER_DRAFT_KEY, JSON.stringify(payload));
}

export function readDocumentCenterDraft(id: string): Record<string, string> {
  const raw = storageGet(DOCUMENT_CENTER_DRAFT_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as StoredDraft;
    if (parsed.id !== id || !parsed.values) return {};
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > DOCUMENT_CENTER_DRAFT_TTL_MS) {
      return {};
    }
    return cleanValues(parsed.values);
  } catch {
    return {};
  }
}

export type DocumentCenterComposerPrefill = {
  id: string;
  topic: string;
  text: string;
  recipientName: string;
  businessName: string;
};

export function pageFromDocCenterParam(param: string | null | undefined): DocumentCenterPage | null {
  if (!param) return null;
  const parts = param.split('/');
  if (parts.length !== 3) return null;
  const [state, city, doc] = parts;
  if (!state || !city || !doc) return null;
  return findDocumentCenterPage(state, city, doc);
}

export function documentCenterComposerPrefill(param: string | null | undefined): DocumentCenterComposerPrefill | null {
  const page = pageFromDocCenterParam(param);
  if (!page) return null;
  const values = readDocumentCenterDraft(page.id);
  return {
    id: page.id,
    topic: `${page.doc.title} — ${page.city.name}, ${page.state.abbr}`.slice(0, 120),
    text: composeDocumentCenterSendText(page, values),
    recipientName: fieldValue(values, RECIPIENT_FIELDS),
    businessName: fieldValue(values, BUSINESS_FIELDS),
  };
}

/** Signed-in send screen with this template selected. Contract body is editable. */
export function isDocumentCenterSendPath(pathname: string, search: string) {
  if (pathname !== '/dashboard/documents/new') return false;
  return documentCenterNextParam(`${pathname}${search}`) !== null;
}

export function documentCenterSendPath(state: string, city: string, doc: string) {
  const params = new URLSearchParams({
    type: 'contract',
    mode: 'sign',
    docCenter: `${state}/${city}/${doc}`,
  });
  return `/dashboard/documents/new?${params.toString()}`;
}

export function documentCenterSignupHref(state: string, city: string, doc: string) {
  return `/signup?next=${encodeURIComponent(documentCenterSendPath(state, city, doc))}`;
}

export function documentCenterLoginHref(state: string, city: string, doc: string) {
  return `/login?next=${encodeURIComponent(documentCenterSendPath(state, city, doc))}`;
}

/**
 * Allow only a real Document Center template into the post-login redirect.
 * Anything else (external URLs, extra query keys) is rejected.
 */
export function documentCenterNextParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!value.startsWith('/dashboard/documents/new?')) return null;
  if (value.includes('://') || value.startsWith('//')) return null;
  const query = value.slice(value.indexOf('?') + 1);
  const params = new URLSearchParams(query);
  const keys = [...params.keys()];
  if (keys.length !== 3) return null;
  if (params.get('type') !== 'contract' || params.get('mode') !== 'sign') return null;
  const page = pageFromDocCenterParam(params.get('docCenter'));
  if (!page) return null;
  return documentCenterSendPath(page.state.slug, page.city.slug, page.doc.slug);
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function factsHtml(page: DocumentCenterPage) {
  const facts = page.doc.facts[page.state.slug] ?? [];
  return `<ul>${facts.map((fact) => (
    `<li><b>${esc(fact.title)}.</b> ${esc(fact.text)} <a href="${esc(fact.url)}" rel="nofollow">${esc(fact.citation)}</a></li>`
  )).join('')}</ul>`;
}

function docSnapshot(page: DocumentCenterPage) {
  const others = DOCUMENT_CENTER_CITIES
    .filter((city) => city.state === page.state.slug && city.slug !== page.city.slug)
    .map((city) => `<a href="${esc(documentCenterDocPath(page.state.slug, city.slug, page.doc.slug))}">${esc(city.name)}</a>`)
    .join(' · ');
  return [
    `<h1>${esc(page.h1)}</h1>`,
    `<p>${esc(documentCenterIntro(page))}</p>`,
    `<p><a href="${esc(documentCenterSignupHref(page.state.slug, page.city.slug, page.doc.slug))}">${esc(DOCUMENT_CENTER_CTA)}</a></p>`,
    `<h2>What ${esc(page.state.name)} law says (with sources)</h2>`,
    factsHtml(page),
    `<p>Check a contractor's license at the <a href="https://www.myfloridalicense.com/wl11.asp" rel="nofollow">Florida DBPR license search</a>. Local permit rules come from your city or ${esc(page.city.county)} County building department.</p>`,
    `<p><b>Not legal advice.</b> ${esc(DOCUMENT_CENTER_DISCLAIMER.replace(/^Not legal advice\.\s*/, ''))}</p>`,
    `<h2>Sample template</h2>`,
    `<pre>${esc(documentCenterSampleFile(page.doc))}</pre>`,
    `<p>Other cities: ${others}</p>`,
    `<p><a href="${esc(documentCenterIndexPath())}">All templates</a></p>`,
  ].join('');
}

function indexSnapshot() {
  const groups = DOCUMENT_CENTER_DOCS.map((doc) => {
    const links = DOCUMENT_CENTER_CITIES
      .filter((city) => doc.facts[city.state]?.length)
      .map((city) => `<a href="${esc(documentCenterDocPath(city.state, city.slug, doc.slug))}">${esc(city.name)}</a>`)
      .join(' · ');
    return `<h2>${esc(doc.title)}</h2><p>${links}</p>`;
  }).join('');
  return [
    `<h1>${esc(DOCUMENT_CENTER_INDEX_META.h1)}</h1>`,
    '<p>State-specific sample contracts and leases for trades and landlords, with plain-language guides that cite official sources.</p>',
    groups,
    `<p><b>Not legal advice.</b> ${esc(DOCUMENT_CENTER_DISCLAIMER.replace(/^Not legal advice\.\s*/, ''))}</p>`,
  ].join('');
}

function legalSnapshot(kind: 'privacy' | 'terms') {
  const meta = documentCenterLegalMeta(kind);
  if (kind === 'privacy') {
    return `<h1>${esc(meta.h1)}</h1><p>These template pages use no cookies, analytics or third-party trackers and collect no personal data. The fill-in preview is not submitted anywhere. When you sign up at PinOnIt, the <a href="https://pinonit.com/privacy">PinOnIt privacy policy</a> applies.</p>`;
  }
  return `<h1>${esc(meta.h1)}</h1><p>Templates are free generic samples provided as-is, for information only, and are not legal advice. No attorney-client relationship is created. Consult a licensed attorney before use. See the <a href="https://pinonit.com/terms">PinOnIt Terms of Service</a>.</p><p><b>Not legal advice.</b> ${esc(DOCUMENT_CENTER_DISCLAIMER.replace(/^Not legal advice\.\s*/, ''))}</p>`;
}

export function documentCenterShellSpecs(): DocumentCenterShellSpec[] {
  const specs: DocumentCenterShellSpec[] = [
    {
      dir: [],
      title: DOCUMENT_CENTER_INDEX_META.title,
      description: DOCUMENT_CENTER_INDEX_META.description,
      canonical: DOCUMENT_CENTER_INDEX_META.canonical,
      snapshotHtml: indexSnapshot(),
    },
    ...(['privacy', 'terms'] as const).map((kind) => {
      const meta = documentCenterLegalMeta(kind);
      return {
        dir: [kind],
        title: meta.title,
        description: meta.description,
        canonical: meta.canonical,
        snapshotHtml: legalSnapshot(kind),
      };
    }),
    ...documentCenterPages().map((page) => ({
      dir: [page.state.slug, page.city.slug, page.doc.slug],
      title: page.title,
      description: page.description,
      canonical: page.canonical,
      snapshotHtml: docSnapshot(page),
    })),
  ];
  return specs;
}

/** Crawlable copy inside the app shell so the page still boots React. */
export function applyDocumentCenterShell(
  indexHtml: string,
  spec: Pick<DocumentCenterShellSpec, 'title' | 'description' | 'canonical' | 'snapshotHtml'>,
) {
  let html = indexHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(spec.title)}</title>`);
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${esc(spec.description)}$2`,
  );
  const canonical = `<link rel="canonical" href="${esc(spec.canonical)}" />`;
  if (html.includes('rel="canonical"')) {
    html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, canonical);
  } else {
    html = html.replace('</title>', `</title>\n    ${canonical}`);
  }
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(spec.canonical)}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(spec.title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(spec.description)}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(spec.title)}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(spec.description)}$2`);
  if (!html.includes('name="robots"')) {
    html = html.replace('</title>', '</title>\n    <meta name="robots" content="index, follow" />');
  }
  if (!html.includes('<!--seo-snapshot-->') || !html.includes('<!--/seo-snapshot-->')) {
    throw new Error('index.html is missing seo-snapshot markers');
  }
  html = html.replace(
    /<!--seo-snapshot-->[\s\S]*?<!--\/seo-snapshot-->/,
    `<!--seo-snapshot-->${spec.snapshotHtml}<!--/seo-snapshot-->`,
  );
  return html;
}

export function documentCenterJsonLd(page: DocumentCenterPage) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.h1,
    description: page.description,
    url: page.canonical,
    isPartOf: { '@type': 'WebSite', name: 'PinOnIt', url: `${DOCUMENT_CENTER_ORIGIN}/` },
  };
}
