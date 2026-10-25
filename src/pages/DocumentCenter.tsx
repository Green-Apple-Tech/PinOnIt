import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { Footer } from '../components/Footer';
import { JsonLd } from '../components/JsonLd';
import { MarketingStickyHeader } from '../components/landing/MarketingAnnouncementBar';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  DOCUMENT_CENTER_CITIES,
  DOCUMENT_CENTER_CTA,
  DOCUMENT_CENTER_DISCLAIMER,
  DOCUMENT_CENTER_DOCS,
  DOCUMENT_CENTER_INDEX_CTA,
  DOCUMENT_CENTER_INDEX_META,
  DOCUMENT_CENTER_SAMPLE_BANNER,
  composeDocumentCenterBody,
  documentCenterCanonical,
  documentCenterDocPath,
  documentCenterIndexPath,
  documentCenterIntro,
  documentCenterJsonLd,
  documentCenterLegalMeta,
  documentCenterLegalPath,
  documentCenterLoginHref,
  documentCenterSampleHref,
  documentCenterSendPath,
  documentCenterSignupHref,
  findDocumentCenterPage,
  saveDocumentCenterDraft,
  type DocumentCenterPage,
} from '../lib/documentCenter';
import { TRIAL_FRICTION_LINE } from '../lib/marketingLanding';
import { usePageMeta } from '../lib/pageMeta';
import { PINONIT_PRICE_MONTHLY } from '../lib/seoIdentity';

function fieldDomId(name: string) {
  return `dc-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function DocumentCenterChrome({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      <MarketingStickyHeader>
        <nav className="bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <Link to={documentCenterIndexPath()} className="flex items-center gap-2 min-w-0">
              <img src="/pinonit_logo.png" alt="PinOnIt" className="h-11 w-auto shrink-0" />
              <span className="hidden sm:inline text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                Document Center
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link to={documentCenterIndexPath()} className="px-2 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                Templates
              </Link>
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {user ? (
                <Link to="/dashboard" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full">
                  Dashboard
                </Link>
              ) : (
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full"
                >
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </nav>
      </MarketingStickyHeader>
      <main className="flex-1 px-6 py-10 md:py-14">
        <article className="max-w-3xl mx-auto">{children}</article>
      </main>
      <p className="max-w-3xl mx-auto px-6 pb-6 text-center text-xs text-slate-400">
        Free templates by PinOnIt — sign by text, no app or login for your customer.{' '}
        <Link to={documentCenterLegalPath('privacy')} className="underline">Privacy</Link>
        {' · '}
        <Link to={documentCenterLegalPath('terms')} className="underline">Terms</Link>
      </p>
      <Footer />
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="mt-8 rounded-r-lg border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
      <b>Not legal advice.</b> {DOCUMENT_CENTER_DISCLAIMER.replace(/^Not legal advice\.\s*/, '')}
    </p>
  );
}

function SendNote() {
  return (
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
      {TRIAL_FRICTION_LINE} Then Pro is {PINONIT_PRICE_MONTHLY}. Customers sign on their phone — no app, no login.
      ESIGN Act and Florida UETA electronic signatures.
    </p>
  );
}

export function DocumentCenterIndexPage() {
  const { user } = useAuth();
  usePageMeta({
    title: DOCUMENT_CENTER_INDEX_META.title,
    description: DOCUMENT_CENTER_INDEX_META.description,
    url: DOCUMENT_CENTER_INDEX_META.canonical,
    image: 'https://pinonit.com/og-why-pinonit.png',
    robots: 'index, follow',
  });

  return (
    <DocumentCenterChrome>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
        {DOCUMENT_CENTER_INDEX_META.h1}
      </h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        State-specific sample contracts and leases for trades and landlords, with plain-language guides that cite official sources.
      </p>
      <Link
        to={user ? '/dashboard/documents/new?type=contract&mode=sign' : '/signup'}
        className="mt-6 block rounded-xl bg-amber-400 px-4 py-4 text-center text-lg font-extrabold text-slate-900 hover:bg-amber-300"
      >
        {DOCUMENT_CENTER_INDEX_CTA}
      </Link>
      {DOCUMENT_CENTER_DOCS.map((doc) => (
        <section key={doc.slug} className="mt-8">
          <h2 className="text-xl font-bold">{doc.title}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {DOCUMENT_CENTER_CITIES.filter((city) => doc.facts[city.state]?.length).map((city, index, list) => (
              <span key={city.slug}>
                <Link
                  className="text-brand-700 dark:text-brand-300 font-medium hover:underline"
                  to={documentCenterDocPath(city.state, city.slug, doc.slug)}
                >
                  {city.name}
                </Link>
                {index < list.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
        </section>
      ))}
      <Disclaimer />
    </DocumentCenterChrome>
  );
}

function useFilledPreview(page: DocumentCenterPage, values: Record<string, string>) {
  return useMemo(() => composeDocumentCenterBody(page.doc, values), [page, values]);
}

export function DocumentCenterDocPage() {
  const params = useParams<{ state: string; city: string; document: string }>();
  const page = findDocumentCenterPage(params.state ?? '', params.city ?? '', params.document ?? '');
  if (!page) return <DocumentCenterMissing />;
  return <DocumentCenterArticle page={page} />;
}

function DocumentCenterMissing() {
  usePageMeta({
    title: 'Template not found | PinOnIt',
    description: 'That document template is not in the PinOnIt Document Center.',
    url: documentCenterCanonical('/templates/'),
    image: 'https://pinonit.com/og-why-pinonit.png',
    robots: 'noindex, nofollow',
  });
  return (
    <DocumentCenterChrome>
      <h1 className="text-3xl font-black">Template not found</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">
        That city or document is not in the catalog.
      </p>
      <Link to={documentCenterIndexPath()} className="mt-6 inline-block text-brand-700 dark:text-brand-300 font-semibold hover:underline">
        Browse templates
      </Link>
    </DocumentCenterChrome>
  );
}

function DocumentCenterArticle({ page }: { page: DocumentCenterPage }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const preview = useFilledPreview(page, values);
  const sendTo = user
    ? documentCenterSendPath(page.state.slug, page.city.slug, page.doc.slug)
    : documentCenterSignupHref(page.state.slug, page.city.slug, page.doc.slug);
  const facts = page.doc.facts[page.state.slug] ?? [];
  const otherCities = DOCUMENT_CENTER_CITIES.filter(
    (city) => city.state === page.state.slug && city.slug !== page.city.slug,
  );

  usePageMeta({
    title: page.title,
    description: page.description,
    url: page.canonical,
    image: 'https://pinonit.com/og-why-pinonit.png',
    robots: 'index, follow',
  });

  const carry = () => saveDocumentCenterDraft(page.id, values);

  return (
    <DocumentCenterChrome>
      <JsonLd data={documentCenterJsonLd(page)} />
      <style>{'@media print { .dc-noprint { display: none !important; } }'}</style>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">{page.h1}</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{documentCenterIntro(page)}</p>
      <Link
        to={sendTo}
        onClick={carry}
        className="dc-noprint mt-6 block rounded-xl bg-amber-400 px-4 py-4 text-center text-lg font-extrabold text-slate-900 hover:bg-amber-300"
      >
        {DOCUMENT_CENTER_CTA}
      </Link>

      <h2 className="dc-noprint mt-10 text-xl font-bold">Fill-in preview</h2>
      <form
        className="dc-noprint mt-3 rounded-xl border-2 border-slate-800 dark:border-slate-200 bg-slate-50 dark:bg-slate-900 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          carry();
          navigate(sendTo);
        }}
      >
        {page.doc.fields.map((field) => {
          const id = fieldDomId(field);
          return (
            <label key={field} htmlFor={id} className="block text-sm font-medium mt-3">
              {field}
              <input
                id={id}
                name={field}
                value={values[field] ?? ''}
                placeholder={field}
                autoComplete="off"
                onChange={(event) => {
                  const next = event.target.value;
                  setValues((prev) => ({ ...prev, [field]: next }));
                }}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base font-normal"
              />
            </label>
          );
        })}
        <button
          type="submit"
          className="mt-5 block w-full rounded-xl bg-amber-400 px-4 py-4 text-center text-lg font-extrabold text-slate-900 hover:bg-amber-300"
        >
          {DOCUMENT_CENTER_CTA}
        </button>
        <SendNote />
        {!user && (
          <p className="mt-2 text-sm text-slate-500">
            Already have an account?{' '}
            <Link
              to={documentCenterLoginHref(page.state.slug, page.city.slug, page.doc.slug)}
              onClick={carry}
              className="text-brand-700 dark:text-brand-300 font-medium hover:underline"
            >
              Log in
            </Link>
          </p>
        )}
      </form>

      <h2 className="mt-10 text-xl font-bold">What {page.state.name} law says (with sources)</h2>
      <ul className="mt-3 list-disc pl-5 space-y-3 text-slate-700 dark:text-slate-200">
        {facts.map((fact) => (
          <li key={fact.title}>
            <b>{fact.title}.</b> {fact.text}{' '}
            <a href={fact.url} rel="nofollow noopener noreferrer" target="_blank" className="text-brand-700 dark:text-brand-300 underline">
              {fact.citation}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-slate-600 dark:text-slate-300">
        Check a contractor&apos;s license at the{' '}
        <a href="https://www.myfloridalicense.com/wl11.asp" rel="nofollow noopener noreferrer" target="_blank" className="underline">
          Florida DBPR license search
        </a>
        . Local permit rules come from your city or {page.city.county} County building department.
      </p>
      <Disclaimer />

      <h2 className="mt-10 text-xl font-bold">Sample template (printable)</h2>
      <p className="dc-noprint mt-2 text-sm">
        <button type="button" onClick={() => window.print()} className="underline font-medium">
          Print / save as PDF
        </button>
        {' · '}
        <a href={documentCenterSampleHref(page.state.slug, page.doc.slug)} download className="underline font-medium">
          Download .txt
        </a>
      </p>
      <div className="mt-3 whitespace-pre-wrap rounded-lg border border-dashed border-slate-400 p-4 font-serif text-sm leading-relaxed">
        {DOCUMENT_CENTER_SAMPLE_BANNER}
        {'\n\n'}
        {page.doc.title.toUpperCase()}
        {'\n\n'}
        {preview}
      </div>
      <Link
        to={sendTo}
        onClick={carry}
        className="dc-noprint mt-6 block rounded-xl bg-amber-400 px-4 py-4 text-center text-lg font-extrabold text-slate-900 hover:bg-amber-300"
      >
        {DOCUMENT_CENTER_CTA}
      </Link>
      <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
        Other cities:{' '}
        {otherCities.map((city, index) => (
          <span key={city.slug}>
            <Link
              className="text-brand-700 dark:text-brand-300 font-medium hover:underline"
              to={documentCenterDocPath(page.state.slug, city.slug, page.doc.slug)}
            >
              {city.name}
            </Link>
            {index < otherCities.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </p>
    </DocumentCenterChrome>
  );
}

export function DocumentCenterLegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const meta = documentCenterLegalMeta(kind);
  usePageMeta({
    title: meta.title,
    description: meta.description,
    url: meta.canonical,
    image: 'https://pinonit.com/og-why-pinonit.png',
    robots: 'index, follow',
  });
  return (
    <DocumentCenterChrome>
      <h1 className="text-3xl font-black">{meta.h1}</h1>
      {kind === 'privacy' ? (
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          These template pages use no cookies, analytics or third-party trackers and collect no personal data.
          The fill-in preview is not submitted anywhere. When you sign up at PinOnIt, the{' '}
          <Link to="/privacy" className="underline">PinOnIt privacy policy</Link> applies.
        </p>
      ) : (
        <>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Templates are free generic samples provided as-is, for information only, and are not legal advice.
            No attorney-client relationship is created. Consult a licensed attorney before use. See the{' '}
            <Link to="/terms" className="underline">PinOnIt Terms of Service</Link>.
          </p>
          <Disclaimer />
        </>
      )}
    </DocumentCenterChrome>
  );
}
