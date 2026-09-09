import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { clearClientOnboardingState, clearStaleOnboardingLocalState, markOnboardingCompletedLocal, clearWizardLocal } from '../lib/onboardingState';
import { storageGet, storageRemove } from '../lib/safeStorage';
import { persistSignupAttribution } from '../lib/campaignAttribution';
import {
  clearOauthInflight,
  isConsumedOauthCodeError,
  markOauthInflight,
  readOauthInflight,
} from '../lib/oauthLogin';
import { Loader2, AlertCircle } from 'lucide-react';

const REDIRECT_KEY = 'auth_redirect';

/** One in-flight exchange per tab/module so Strict Mode or a double load cannot redeem the code twice. */
const exchangeByCode = new Map<string, Promise<string | null>>();

function extractParam(key: string): string | null {
  const fromSearch = new URLSearchParams(window.location.search).get(key);
  if (fromSearch) return fromSearch;
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash).get(key);
}

async function checkOnboardingCompleted(userId: string): Promise<{ completed: boolean; wizardActive: boolean }> {
  const { data } = await supabase
    .from('profiles')
    .select('onboarding_completed, wizard_active')
    .eq('id', userId)
    .maybeSingle();
  return {
    completed: data?.onboarding_completed === true,
    wizardActive: data?.wizard_active === true,
  };
}

function getPostLoginRedirect(): string {
  const stored = storageGet(REDIRECT_KEY);
  storageRemove(REDIRECT_KEY);
  if (stored && stored.startsWith('/') && !stored.startsWith('//')) return stored;
  return '/dashboard';
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForSessionUserId(timeoutMs: number): Promise<string | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) return data.session.user.id;
    await sleep(250);
  }
  return null;
}

async function exchangeCode(code: string): Promise<string | null> {
  const existing = exchangeByCode.get(code);
  if (existing) return existing;

  const run = (async () => {
    markOauthInflight(code);
    try {
      const { data: already } = await supabase.auth.getSession();
      if (already.session?.user?.id) return already.session.user.id;

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (data.session?.user?.id) return data.session.user.id;

      if (error && isConsumedOauthCodeError(error.message)) {
        return waitForSessionUserId(4000);
      }
      if (error) throw error;
      return waitForSessionUserId(2000);
    } finally {
      clearOauthInflight();
    }
  })();

  exchangeByCode.set(code, run);
  return run;
}

export function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const urlError = extractParam('error');
    const urlErrorDesc = extractParam('error_description');

    if (urlError) {
      setErrorMsg(urlErrorDesc ?? urlError);
      return;
    }

    const code = extractParam('code');
    let cancelled = false;

    const handleSession = async (userId: string) => {
      void persistSignupAttribution(userId).catch(() => undefined);
      let completed = true;
      let wizardActive = false;
      try {
        const result = await Promise.race([
          checkOnboardingCompleted(userId),
          new Promise<{ completed: boolean; wizardActive: boolean }>((resolve) =>
            setTimeout(() => resolve({ completed: true, wizardActive: false }), 8000),
          ),
        ]);
        completed = result.completed;
        wizardActive = result.wizardActive;
      } catch {
        completed = true;
      }
      if (cancelled) return;
      const redirect = getPostLoginRedirect();
      if (!completed) {
        if (wizardActive) {
          clearStaleOnboardingLocalState();
        } else {
          clearClientOnboardingState();
        }
        navigate('/dashboard?onboarding=1', { replace: true });
      } else {
        markOnboardingCompletedLocal();
        clearWizardLocal();
        navigate(redirect, { replace: true });
      }
    };

    const fail = (message: string) => {
      if (!cancelled) setErrorMsg(message);
    };

    if (code) {
      const timeout = window.setTimeout(() => {
        fail('Sign-in timed out. Please try again.');
      }, 15000);
      void (async () => {
        try {
          if (readOauthInflight() === code && !exchangeByCode.has(code)) {
            const raced = await waitForSessionUserId(4000);
            if (raced) {
              await handleSession(raced);
              return;
            }
          }
          const userId = await exchangeCode(code);
          if (cancelled) return;
          if (userId) {
            await handleSession(userId);
            return;
          }
          fail('Sign-in failed. Please try again.');
        } catch (err) {
          fail(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
        } finally {
          window.clearTimeout(timeout);
        }
      })();
      return () => {
        cancelled = true;
        window.clearTimeout(timeout);
      };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        subscription.unsubscribe();
        void handleSession(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        subscription.unsubscribe();
        fail('Sign-in was cancelled or failed. Please try again.');
      }
    });

    const timeout = window.setTimeout(() => {
      subscription.unsubscribe();
      fail('Sign-in timed out. Please try again.');
    }, 10000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h2 className="text-slate-900 text-xl font-semibold">Sign-in failed</h2>
          <p className="text-slate-500 text-sm">{errorMsg}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
        <p className="text-slate-500 text-sm">Completing sign-in...</p>
      </div>
    </div>
  );
}
