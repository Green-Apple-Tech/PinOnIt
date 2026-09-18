import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isIosIsolatedWebView, readIosStandalone } from '../../lib/oauthLogin';
import {
  LANDING_CLOSING_HEADLINE,
  LANDING_GOOGLE_CTA,
  LANDING_PRIMARY_CTA,
  TRIAL_FRICTION_LINE,
} from '../../lib/marketingLanding';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

const PRIMARY_BTN =
  'w-full sm:w-auto min-h-12 px-8 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full text-base transition-all shadow-lg shadow-brand-200/60 dark:shadow-none inline-flex items-center justify-center gap-2';

export function LandingPrimaryCta({ className = PRIMARY_BTN }: { className?: string }) {
  return (
    <Link to="/signup" className={className}>
      {LANDING_PRIMARY_CTA} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function TrialFrictionLine({ className }: { className?: string }) {
  return <p className={className}>{TRIAL_FRICTION_LINE}</p>;
}

export function LandingGoogleButton({ className }: { className?: string }) {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const started = useRef(false);
  const isolated = isIosIsolatedWebView(
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
    readIosStandalone(),
  );

  if (isolated) return null;

  const onClick = async () => {
    if (isolated || started.current || loading) return;
    started.current = true;
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      started.current = false;
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={isolated || loading}
      className={
        className ??
        'w-full sm:w-auto min-h-12 px-8 py-3.5 rounded-full text-base font-semibold border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-brand-400 disabled:opacity-60 inline-flex items-center justify-center gap-2'
      }
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
      {LANDING_GOOGLE_CTA}
    </button>
  );
}

export function LandingHeroCtas() {
  return (
    <div className="flex flex-col items-center lg:items-start gap-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 w-full">
        <LandingPrimaryCta />
        <LandingGoogleButton />
      </div>
      <TrialFrictionLine className="text-sm text-slate-500 dark:text-slate-400" />
      <a
        href="#how-it-works"
        className="w-full sm:w-auto min-h-12 px-8 py-3.5 rounded-full text-base font-semibold border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300 inline-flex items-center justify-center"
      >
        See how it works
      </a>
    </div>
  );
}

export function LandingCompactCta() {
  return (
    <section className="py-10 md:py-12 px-4 sm:px-6 bg-slate-50 dark:bg-slate-900/40">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
        <LandingPrimaryCta />
        <TrialFrictionLine className="text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left" />
      </div>
    </section>
  );
}

export function LandingClosingCta() {
  return (
    <section className="py-20 md:py-24 px-4 sm:px-6 bg-brand-500">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-4xl font-black text-white leading-tight mb-6">
          {LANDING_CLOSING_HEADLINE}
        </h2>
        <LandingPrimaryCta className="inline-flex items-center justify-center gap-3 min-h-12 px-10 py-4 bg-white text-brand-600 font-black text-lg rounded-full transition-all shadow-2xl hover:bg-brand-50" />
        <TrialFrictionLine className="mt-5 text-brand-100 text-sm" />
      </div>
    </section>
  );
}
