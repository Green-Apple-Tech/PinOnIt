import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { Footer } from '../components/Footer';
import { JsonLd } from '../components/JsonLd';
import { useTheme } from '../hooks/useTheme';
import { usePageMeta } from '../lib/pageMeta';
import { signupHref } from '../lib/campaignAttribution';
import { INTENT_OG_IMAGE, INTENT_PAGES } from '../lib/seoIntentPages';
import { faqPageJsonLd, intentWebPageJsonLd, organizationJsonLd, softwareApplicationJsonLd } from '../lib/jsonLd';
import { PINONIT_CORE_SENTENCE } from '../lib/seoIdentity';

export function SeoIntentPage() {
  const { pathname } = useLocation();
  const page = INTENT_PAGES.find((p) => p.path === pathname) ?? null;
  const { theme, toggleTheme } = useTheme();

  usePageMeta({
    title: page?.metaTitle || 'PinOnIt',
    description: page?.metaDescription || PINONIT_CORE_SENTENCE,
    url: page?.canonical || 'https://pinonit.com',
    image: INTENT_OG_IMAGE,
  });

  if (!page) return <Navigate to="/" replace />;

  const signup = signupHref();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      <JsonLd data={[organizationJsonLd(), softwareApplicationJsonLd(), intentWebPageJsonLd(page), faqPageJsonLd(page.faq)]} />
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <img src="/pinonit_logo.png" alt="PinOnIt" className="h-11 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login" className="hidden sm:inline px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Log in
            </Link>
            <Link
              to={signup}
              className="inline-flex items-center gap-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 px-6 py-12 md:py-16">
        <article className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-3">{page.eyebrow}</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">{page.h1}</h1>
          <p className="mt-5 text-lg text-slate-700 dark:text-slate-200 leading-relaxed">{page.opening}</p>
          {page.body.map((para) => (
            <p key={para.slice(0, 40)} className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed">
              {para}
            </p>
          ))}

          {page.compareRows && page.compareRows.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-bold">{page.compareTitle}</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Feature</th>
                      <th className="text-left px-3 py-2 font-semibold">PinOnIt</th>
                      <th className="text-left px-3 py-2 font-semibold">{page.compareOther}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.compareRows.map((row) => (
                      <tr key={row.feature} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-medium">{row.feature}</td>
                        <td className="px-3 py-2">{row.pinonit}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.other}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {page.compareNote && (
                <p className="mt-2 text-xs text-slate-400">{page.compareNote}</p>
              )}
            </section>
          )}

          <section className="mt-12">
            <h2 className="text-lg font-bold">FAQ</h2>
            <dl className="mt-4 space-y-4">
              {page.faq.map((item) => (
                <div key={item.q}>
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-12 rounded-2xl bg-brand-500 px-6 py-8 text-center text-white">
            <p className="text-sm text-brand-100 mb-3">{PINONIT_CORE_SENTENCE}</p>
            <Link
              to={page.ctaTo === '/signup' ? signup : page.ctaTo}
              className="inline-flex items-center gap-2 min-h-11 px-6 rounded-full bg-white text-brand-600 text-sm font-semibold"
            >
              {page.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
