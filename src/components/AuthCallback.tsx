import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { clearClientOnboardingState, clearStaleOnboardingLocalState, markOnboardingCompletedLocal, clearWizardLocal } from '../lib/onboardingState';
import { Loader2, AlertCircle } from 'lucide-react';

const REDIRECT_KEY = 'auth_redirect';

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
  const stored = localStorage.getItem(REDIRECT_KEY);
  localStorage.removeItem(REDIRECT_KEY);
  if (stored && stored.startsWith('/') && !stored.startsWith('//')) return stored;
  return '/dashboard';
}

export function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Guard against double execution (React 18 Strict Mode runs effects twice in dev)
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;

    const urlError = extractParam('error');
    const urlErrorDesc = extractParam('error_description');

    if (urlError) {
      setErrorMsg(urlErrorDesc ?? urlError);
      return;
    }

    const code = extractParam('code');

    const handleSession = async (userId: string) => {
      const { persistSignupAttribution } = await import('../lib/campaignAttribution');
      await persistSignupAttribution(userId);
      const { completed, wizardActive } = await checkOnboardingCompleted(userId);
      const redirect = getPostLoginRedirect();
      if (!completed) {
        if (wizardActive) {
          clearStaleOnboardingLocalState();
        } else {
          clearClientOnboardingState();
        }
        navigate('/dashboard?onboarding=1', { replace: true });
      } else {
        // Returning hosts: don't let leftover wizard flags look like a first-time signup
        markOnboardingCompletedLocal();
        clearWizardLocal();
        navigate(redirect, { replace: true });
      }
    };

    if (code) {
      exchanged.current = true;
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          setErrorMsg(error.message);
        } else if (data.session?.user) {
          handleSession(data.session.user.id);
        } else {
          navigate(getPostLoginRedirect(), { replace: true });
        }
      });
      return;
    }

    // No code — wait for PKCE implicit flow via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        subscription.unsubscribe();
        handleSession(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        subscription.unsubscribe();
        setErrorMsg('Sign-in was cancelled or failed. Please try again.');
      }
    });

    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      setErrorMsg('Sign-in timed out. Please try again.');
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
