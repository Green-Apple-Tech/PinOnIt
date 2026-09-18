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
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022" />
      <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00" />
      <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF" />
      <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900" />
    </svg>
  );
}

const PILL =
  'min-h-12 px-5 sm:px-6 py-3 rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm sm:text-base font-semibold shadow-md shadow-slate-900/10 border border-slate-200/80 dark:border-slate-700 inline-flex items-center justify-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 w-full sm:w-auto';

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

export function LandingHeroCtas() {
  const { signInWithGoogle, signInWithMicrosoft } = useAuth();
  const [loading, setLoading] = useState<'google' | 'microsoft' | null>(null);
  const started = useRef(false);
  const isolated = isIosIsolatedWebView(
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
    readIosStandalone(),
  );

  const start = async (provider: 'google' | 'microsoft') => {
    if (isolated || started.current || loading) return;
    started.current = true;
    setLoading(provider);
    const { error } = provider === 'google' ? await signInWithGoogle() : await signInWithMicrosoft();
    if (error) {
      started.current = false;
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col items-center lg:items-start gap-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 w-full">
        <LandingPrimaryCta />
        <button type="button" onClick={() => void start('google')} disabled={isolated || !!loading} className={PILL}>
          {loading === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
          {LANDING_GOOGLE_CTA}
        </button>
        <button type="button" onClick={() => void start('microsoft')} disabled={isolated || !!loading} className={PILL}>
          {loading === 'microsoft' ? <Loader2 className="h-5 w-5 animate-spin" /> : <MicrosoftIcon />}
          Sign up with Microsoft
        </button>
      </div>
      <TrialFrictionLine className="text-sm text-slate-500 dark:text-slate-400" />
      <p className="text-sm text-slate-500 dark:text-slate-400">
        <Link to="/signup" className="underline underline-offset-2 font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400">
          Sign up with email
        </Link>
      </p>
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
