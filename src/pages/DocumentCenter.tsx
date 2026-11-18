import { FormEvent, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, FileText, Moon, Sun } from 'lucide-react';
import { Footer } from '../components/Footer';
import { JsonLd } from '../components/JsonLd';
import { MarketingStickyHeader } from '../components/landing/MarketingAnnouncementBar';
import { useTheme } from '../hooks/useTheme';
import { usePageMeta } from '../lib/pageMeta';
import {
  faqPageJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from '../lib/jsonLd';
import { PINONIT_ORG, PINONIT_PRICE_MONTHLY } from '../lib/seoIdentity';
import {
  DOCUMENT_CENTER_CTA,
  DOCUMENT_CENTER_DISCLAIMER,
  DOCUMENT_CENTER_INDEX,
  DOCUMENT_CENTER_INDEX_FAQ,
  DOCUMENT_CENTER_TEMPLATES,
  documentCenterCanonical,
  documentCenterRelated,
  documentCenterSignupHref,
  fillTemplateBody,
  getDocumentCenterTemplate,
  type DocumentCenterTemplate,
} from '../lib/documentCenter';

function MarketingNav({ signupTo }: { signupTo: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <MarketingStickyHeader>
      <nav className="bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <img src="/pinonit_logo.png" alt="PinOnIt" className="h-11 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/templates"
              className="hidden sm:inline px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              Document Center
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/login"
              className="hidden sm:inline px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              Log in
            </Link>
            <Link
              to={signupTo}
              className="inline-flex items-center gap-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>
    </MarketingStickyHeader>
  );
}

function DisclaimerNote() {
  return (
    <p className="mt-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-4 py-3">
      {DOCUMENT_CENTER_DISCLAIMER}
    </p>
  );
}

function CtaBlock({ href, compact = false }: { href: string; compact?: boolean }) {
  return (
    <div className={compact ? 'mt-6' : 'mt-12 rounded-2xl bg-brand-500 px-6 py-8 text-center text-white'}>
      {!compact && (
        <>
          <p className="text-sm text-brand-100 mb-1">Send it by text after you create a free account</p>
          <p className="text-sm text-brand-100 mb-4">
            Pro is {PINONIT_PRICE_MONTHLY} after a 14-day trial. Your customer does not need an account to
            sign.
          </p>
        </>
      )}
      <Link
        to={href}
        className={
          compact
            ? 'inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-11 px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold'
            : 'inline-flex items-center justify-center gap-2 min-h-11 px-6 rounded-full bg-white text-brand-600 text-sm font-semibold'
        }
      >
        {DOCUMENT_CENTER_CTA} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function collectionJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: DOCUMENT_CENTER_INDEX.h1,
    description: DOCUMENT_CENTER_INDEX.description,
    url: DOCUMENT_CENTER_INDEX.canonical,
    isPartOf: { '@type': 'WebSite', name: PINONIT_ORG.name, url: PINONIT_ORG.url },
    about: 'Starting templates for Miami and Florida service businesses, sent for signature by text.',
    hasPart: DOCUMENT_CENTER_TEMPLATES.map((t) => ({
      '@type': 'DigitalDocument',
      name: t.h1,
      url: documentCenterCanonical(t.path),
      description: t.summary,
    })),
  };
}

function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: documentCenterCanonical(item.path),
    })),
  };
}

function howToJsonLd(template: DocumentCenterTemplate) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to fill and send the ${template.title} by text`,
    description: 'Fill the starting template and send it for signature by text with a PinOnIt account.',
    step: template.howTo.map((text, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text,
    })),
  };
}

function templateWebPageJsonLd(template: DocumentCenterTemplate) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: template.h1,
    description: template.metaDescription,
    url: documentCenterCanonical(template.path),
    isPartOf: { '@type': 'WebSite', name: PINONIT_ORG.name, url: PINONIT_ORG.url },
    about: {
      '@type': 'DigitalDocument',
      name: template.h1,
      description: template.summary,
      encodingFormat: 'text/plain',
    },
  };
}

export function DocumentCenterIndexPage() {
  const signup = documentCenterSignupHref();
  usePageMeta({
    title: DOCUMENT_CENTER_INDEX.title,
    description: DOCUMENT_CENTER_INDEX.description,
    url: DOCUMENT_CENTER_INDEX.canonical,
    image: DOCUMENT_CENTER_INDEX.ogImage,
  });

  const ld = [
    organizationJsonLd(),
    softwareApplicationJsonLd(),
    websiteJsonLd(),
    collectionJsonLd(),
    breadcrumbJsonLd([
      { name: 'PinOnIt', path: '/' },
      { name: 'Document Center', path: '/templates' },
    ]),
    faqPageJsonLd(DOCUMENT_CENTER_INDEX_FAQ),
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      <JsonLd data={ld} />
      <MarketingNav signupTo={signup} />
      <main className="flex-1 px-6 py-12 md:py-16">
        <article className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-3">
            {DOCUMENT_CENTER_INDEX.eyebrow}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            {DOCUMENT_CENTER_INDEX.h1}
          </h1>
          <p className="mt-5 text-lg text-slate-700 dark:text-slate-200 leading-relaxed">
            {DOCUMENT_CENTER_INDEX.intro}
          </p>
          <DisclaimerNote />
          <CtaBlock href={signup} compact />

          <section className="mt-12">
            <h2 className="text-lg font-bold">Templates</h2>
            <ul className="mt-4 grid gap-4">
              {DOCUMENT_CENTER_TEMPLATES.map((template) => (
                <li key={template.slug}>
                  <Link
                    to={template.path}
                    className="block rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                      {template.city}, {template.state} · {template.documentType}
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                      {template.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {template.summary}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold">How it works</h2>
            <ol className="mt-4 space-y-3">
              {[
                'Open a template written for a Miami or Florida trade.',
                'Fill in your details on the page. You can do this without an account.',
                'Create a free PinOnIt account and send the document for signature by text.',
                'Your customer opens the SMS link, enters a one-time code, and signs with a finger.',
              ].map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="shrink-0 h-6 w-6 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold">FAQ</h2>
            <dl className="mt-4 space-y-4">
              {DOCUMENT_CENTER_INDEX_FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold">Related</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/legal-templates" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                  Waiver and liability form templates
                </Link>
              </li>
              <li>
                <Link to="/sign-by-text" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                  Sign documents by text
                </Link>
              </li>
              <li>
                <Link to="/send-estimate-by-text" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                  Send estimates by text
                </Link>
              </li>
            </ul>
          </section>

          <CtaBlock href={signup} />
        </article>
      </main>
      <Footer />
    </div>
  );
}

export function DocumentCenterTemplatePage() {
  const { slug = '' } = useParams();
  const template = getDocumentCenterTemplate(slug);
  const signup = documentCenterSignupHref(template?.slug);
  const [values, setValues] = useState<Record<string, string>>({});

  const filled = useMemo(
    () => (template ? fillTemplateBody(template.body, values) : ''),
    [template, values],
  );

  usePageMeta({
    title: template?.metaTitle || 'Template | PinOnIt',
    description: template?.metaDescription || DOCUMENT_CENTER_INDEX.description,
    url: documentCenterCanonical(template?.path || '/templates'),
    image: DOCUMENT_CENTER_INDEX.ogImage,
  });

  if (!template) return <Navigate to="/templates" replace />;

  const ld = [
    organizationJsonLd(),
    softwareApplicationJsonLd(),
    websiteJsonLd(),
    templateWebPageJsonLd(template),
    breadcrumbJsonLd([
      { name: 'PinOnIt', path: '/' },
      { name: 'Document Center', path: '/templates' },
      { name: template.h1, path: template.path },
    ]),
    howToJsonLd(template),
    faqPageJsonLd(template.faq),
  ];

  const related = documentCenterRelated(template.slug);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    window.location.assign(signup);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      <JsonLd data={ld} />
      <MarketingNav signupTo={signup} />
      <main className="flex-1 px-6 py-12 md:py-16">
        <article className="max-w-3xl mx-auto">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            <Link to="/templates" className="text-brand-600 dark:text-brand-400 hover:underline">
              Document Center
            </Link>
            <span aria-hidden> / </span>
            <span>{template.trade}</span>
          </p>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-3">
            {template.eyebrow}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">{template.h1}</h1>
          <p className="mt-5 text-lg text-slate-700 dark:text-slate-200 leading-relaxed">{template.summary}</p>
          <DisclaimerNote />
          <CtaBlock href={signup} compact />

          <section className="mt-12">
            <h2 className="text-lg font-bold">Fill this template</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Add your details below and the preview updates. Then create a free account to send it for
              signature by text.
            </p>
            <form onSubmit={onSubmit} className="mt-6 grid gap-4">
              {template.fields.map((field) => (
                <label key={field.key} className="block">
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">
                    {field.label}
                  </span>
                  {field.multiline ? (
                    <textarea
                      name={field.key}
                      rows={4}
                      placeholder={field.placeholder}
                      value={values[field.key] ?? ''}
                      onChange={(e) => setValues((current) => ({ ...current, [field.key]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                  ) : (
                    <input
                      type="text"
                      name={field.key}
                      placeholder={field.placeholder}
                      value={values[field.key] ?? ''}
                      onChange={(e) => setValues((current) => ({ ...current, [field.key]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 min-h-11"
                    />
                  )}
                </label>
              ))}
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-11 px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold"
              >
                {DOCUMENT_CENTER_CTA} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold">Template preview</h2>
            <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-5 text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans">
              {filled}
            </pre>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold">How to fill and send this</h2>
            <ol className="mt-4 space-y-3">
              {template.howTo.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="shrink-0 h-6 w-6 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold">FAQ</h2>
            <dl className="mt-4 space-y-4">
              {template.faq.map((item) => (
                <div key={item.q}>
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold">Other templates</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/templates" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                  All Document Center templates
                </Link>
              </li>
              {related.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/legal-templates" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                  Waiver and liability form templates
                </Link>
              </li>
            </ul>
          </section>

          <CtaBlock href={signup} />
        </article>
      </main>
      <Footer />
    </div>
  );
}
