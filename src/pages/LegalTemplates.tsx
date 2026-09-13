import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Moon, Sun, Upload } from 'lucide-react';
import { Footer } from '../components/Footer';
import { useTheme } from '../hooks/useTheme';
import { usePageMeta } from '../lib/pageMeta';
import {
  LEGAL_TEMPLATE_EXAMPLE_SITES,
  LEGAL_TEMPLATES_DISCLAIMER,
  LEGAL_TEMPLATES_META,
  LEGAL_TEMPLATES_UPLOAD_PATH,
  LEGAL_TEMPLATES_UPLOAD_STEPS,
} from '../lib/legalTemplates';

export function LegalTemplatesPage() {
  const { theme, toggleTheme } = useTheme();
  usePageMeta({
    title: LEGAL_TEMPLATES_META.title,
    description: LEGAL_TEMPLATES_META.description,
    url: LEGAL_TEMPLATES_META.url,
    image: LEGAL_TEMPLATES_META.ogImage,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <img src="/pinonit_logo.png" alt="PinOnIt" className="h-11 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/login"
              className="hidden sm:inline px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full transition-colors"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 px-6 py-12 md:py-16">
        <article className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-3">
            Sign-by-Text
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            Waiver and liability form templates
          </h1>
          <p className="mt-5 text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            PinOnIt&apos;s built-in templates are general-purpose starting points — useful when you need
            something quickly, but we recommend you review them for your state and activity.
          </p>
          <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed">
            Waiver and liability requirements vary by state and by activity. A zip-line park in California
            does not use the same form as a trampoline gym in Texas. Many hosts have an attorney review one
            waiver, then send that same PDF hundreds of times.
          </p>
          <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed">
            You can download a state-specific form from a legal template site, upload it into PinOnIt once,
            and send it for signature by text.
          </p>

          <section className="mt-10">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Example template sites</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              These are examples of sites that sell or offer state-specific waiver forms — not endorsements
              or partnerships.
            </p>
            <ul className="mt-4 space-y-3">
              {LEGAL_TEMPLATE_EXAMPLE_SITES.map((site) => (
                <li key={site.name}>
                  <a
                    href={site.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 inline-flex items-center gap-1.5">
                        {site.name}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{site.blurb}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{LEGAL_TEMPLATES_DISCLAIMER}</p>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">How to upload your own</h2>
            <ol className="mt-4 space-y-3">
              {LEGAL_TEMPLATES_UPLOAD_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="shrink-0 h-6 w-6 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <Link
              to={LEGAL_TEMPLATES_UPLOAD_PATH}
              className="mt-6 inline-flex items-center gap-2 min-h-11 px-5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload a PDF template
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}
