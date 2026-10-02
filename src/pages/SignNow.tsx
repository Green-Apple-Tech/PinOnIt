import { Link } from 'react-router-dom';
import { ArrowRight, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { usePageMeta } from '../lib/pageMeta';
import { PINONIT_PRICE_MONTHLY } from '../lib/seoIdentity';
import { SIGN_NOW_SEND_PATH, signNowLoginHref, signNowSignupHref } from '../lib/signNow';
import { TRIAL_FRICTION_LINE } from '../lib/marketingLanding';
import { MarketingStickyHeader } from '../components/landing/MarketingAnnouncementBar';

const STEPS = [
  'Create your account.',
  'Add their name, phone, and the one-page document.',
  'We text them the link. They sign with a finger.',
];

export function SignNowPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const ctaTo = user ? SIGN_NOW_SEND_PATH : signNowSignupHref();

  usePageMeta({
    title: 'Sign your doc by text | PinOnIt',
    description:
      'Text a one-page document. They tap the link, enter a code, and sign. No app and no account for them. PinOnIt also books appointments from a link.',
    url: 'https://pinonit.com/sign-now',
    image: 'https://pinonit.com/og-why-pinonit.png',
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <MarketingStickyHeader>
        <nav className="bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
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
                Sign a document now
              </Link>
            </div>
          </div>
        </nav>
      </MarketingStickyHeader>

      <section className="relative overflow-hidden pt-16 pb-20 px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-brand-500/5 blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <p className="inline-block px-3 py-1.5 mb-6 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-200 text-xs font-bold uppercase tracking-widest">
            Sign it now
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] mb-6">
            Sign your doc by text
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
            They tap the link, enter a code, and sign with a finger. No app and no account on their end. Simple documents can be signed in as little as 10 seconds.
          </p>
          <ol className="text-left max-w-md mx-auto mb-8 space-y-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-base text-slate-700 dark:text-slate-200">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white text-sm font-bold">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <Link
            to={ctaTo}
            className="inline-flex items-center justify-center gap-2 min-h-12 px-8 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full text-base shadow-lg shadow-brand-200/60 dark:shadow-none"
          >
            Sign a document now <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {TRIAL_FRICTION_LINE} Then {PINONIT_PRICE_MONTHLY}.
          </p>
          {!user && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <Link to={signNowLoginHref()} className="underline underline-offset-2 font-medium text-slate-700 dark:text-slate-200">
                Sign in
              </Link>
            </p>
          )}
          <p className="mt-8 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            PinOnIt also books appointments the way Calendly does. They pick a time from your link. It syncs with Google, Outlook, and Apple Calendar, and texts a reminder before the visit.{' '}
            <Link to="/calendly-alternative" className="font-semibold text-brand-600 dark:text-brand-300 underline underline-offset-2">
              See booking
            </Link>
          </p>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            One page and one signer on this screen. Longer PDFs are in Documents after you sign in.
          </p>
        </div>
      </section>
    </div>
  );
}
