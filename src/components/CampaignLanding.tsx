import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { usePageMeta } from '../lib/pageMeta';
import { captureCampaignParams, signupHref } from '../lib/campaignAttribution';
import type { CampaignCopy } from '../lib/campaignLandings';
import { useEffect } from 'react';

function dashboardHref(path: string): string {
  if (!path.startsWith('/dashboard')) return '/dashboard';
  if (path.startsWith('//') || path.includes('://') || path.includes('\\') || path.includes('@')) return '/dashboard';
  if (path.split('?')[0].includes('..')) return '/dashboard';
  return path;
}

export function CampaignLanding({ copy }: { copy: CampaignCopy }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    captureCampaignParams(location.search, `/${copy.slug}`);
  }, [location.search, copy.slug]);

  usePageMeta({
    title: copy.metaTitle,
    description: copy.metaDescription,
    url: `https://pinonit.com/${copy.slug}`,
    image: 'https://pinonit.com/pinonit_logo.png',
  });

  const ctaTo = user ? dashboardHref(copy.loggedInCtaTo) : signupHref();
  const ctaLabel = user ? copy.loggedInCtaLabel : 'Start Free Trial';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0" aria-label="PinOnIt home">
            <img src="/pinonit_logo.png" alt="Pin on It" className="h-11 w-auto" />
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
            <Link
              to={ctaTo}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full transition-colors"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-16 pb-12 px-6 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-brand-500/5 blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <p className="inline-block px-3 py-1.5 mb-6 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-200 text-xs font-bold uppercase tracking-widest">
            {copy.eyebrow}
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] text-slate-900 dark:text-white mb-6">
            {copy.headline}
          </h1>
          <p className={`text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed ${copy.supportingLine ? 'mb-4' : 'mb-8'}`}>
            {copy.subhead}
          </p>
          {copy.supportingLine ? (
            <p className="text-sm sm:text-base font-normal text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
              {copy.supportingLine}
            </p>
          ) : null}
          <Link
            to={ctaTo}
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold text-lg rounded-full transition-colors shadow-lg shadow-brand-500/25"
          >
            {ctaLabel} <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <section className="py-16 px-6 bg-slate-50 dark:bg-slate-900/40">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-10">
            How it works
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {copy.steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative text-center">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-5 relative">
                    <Icon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                    <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-white leading-relaxed">
            {copy.secondaryUseCase}
          </p>
          {copy.holdUp ? (
            <p className="mt-6 text-base text-slate-600 dark:text-slate-300 leading-relaxed">{copy.holdUp}</p>
          ) : null}
          <Link
            to={ctaTo}
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold text-lg rounded-full transition-colors"
          >
            {ctaLabel} <ArrowRight className="h-5 w-5" />
          </Link>
          {copy.disclaimer ? (
            <p className="mt-6 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
              {copy.disclaimer}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
