import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import { Loader2, Mail, Lock, User, ArrowLeft, Sun, Moon, Eye, EyeOff } from 'lucide-react';

type View = 'login' | 'signup' | 'forgot';

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

export function AuthForm() {
  const { user, loading, signUp, signIn, signInWithGoogle, signInWithMicrosoft, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');
  // Read intended destination from router state (set by ProtectedRoute) or fall back to dashboard
  const locationState = (window.history.state?.usr as { from?: { pathname: string } }) ?? {};
  const redirectTo = locationState.from?.pathname ?? '/dashboard';
  const oauthInFlight = useRef(false);
  const pendingOauth = useRef<'google' | 'microsoft' | null>(null);

  useEffect(() => {
    // Don't steal an in-flight OAuth redirect if a session event fires first
    if (user && !oauthInFlight.current) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  useEffect(() => {
    if (searchParams.get('signed_out') === 'inactivity') {
      setSuccess('You were signed out due to inactivity.');
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>(refCode ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'microsoft' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (view === 'signup') {
      const { error } = await signUp(email, password, fullName);
      if (error) { setError(error); }
      else {
        // If signed up via referral link, record it
        if (refCode) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/referral-signup`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ referral_code: refCode }),
            }).catch(() => {/* non-critical */});
          }
        }
        navigate('/dashboard?onboarding=1');
      }
    } else if (view === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else navigate(redirectTo, { replace: true });
    } else {
      const { error } = await resetPassword(email);
      if (error) setError(error);
      else setSuccess('Password reset link sent to your email.');
    }

    setSubmitting(false);
  };

  const resetOauthLoading = () => {
    oauthInFlight.current = false;
    pendingOauth.current = null;
    setOauthLoading(null);
    if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
  };

  const startOauth = async (provider: 'google' | 'microsoft') => {
    if (oauthInFlight.current) return;
    oauthInFlight.current = true;
    setOauthLoading(provider);
    setError(null);
    if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
    oauthTimeoutRef.current = setTimeout(resetOauthLoading, 10000);
    const intended = redirectTo !== '/dashboard' ? redirectTo : undefined;
    const { error } = provider === 'google'
      ? await signInWithGoogle(intended)
      : await signInWithMicrosoft(intended);
    if (error) {
      setError(error);
      resetOauthLoading();
    }
  };

  const handleOauth = (provider: 'google' | 'microsoft') => {
    if (oauthInFlight.current || oauthLoading) return;
    if (loading) {
      pendingOauth.current = provider;
      setOauthLoading(provider);
      return;
    }
    void startOauth(provider);
  };

  useEffect(() => {
    if (loading || !pendingOauth.current) return;
    const pending = pendingOauth.current;
    pendingOauth.current = null;
    void startOauth(pending);
  }, [loading]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <img src="/Screenshot_2026-04-29_at_2.49.32_PM.png" alt="Pin on It" className="h-16 w-auto" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {view === 'login' ? 'Welcome back' : view === 'signup' ? 'Create your account' : 'Reset password'}
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">
            {view === 'login'
              ? 'Sign in to continue to your dashboard'
              : view === 'signup'
              ? 'Scheduling + reminders, set up in 2 minutes'
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        {refCode && view === 'signup' && (
          <div className="mb-6 flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-sm text-indigo-700 dark:text-indigo-500">
            <span className="text-lg">🎁</span>
            <span>You were referred! Sign up and your friend earns a $1/month credit.</span>
          </div>
        )}

        {/* OAuth buttons */}
        {view !== 'forgot' && (
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleOauth('google')}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-all shadow-sm"
            >
              {oauthLoading === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
              {view === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
            </button>

            <button
              type="button"
              onClick={() => handleOauth('microsoft')}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1e3a5f] hover:bg-[#17304f] disabled:opacity-60 text-white font-semibold rounded-xl transition-all shadow-sm"
            >
              {oauthLoading === 'microsoft' ? <Loader2 className="h-5 w-5 animate-spin" /> : <MicrosoftIcon />}
              {view === 'signup' ? 'Sign up with Microsoft' : 'Sign in with Microsoft'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-slate-50 dark:bg-slate-950 text-slate-400 font-medium">
                  or continue with email
                </span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'signup' && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
            />
          </div>

          {view !== 'forgot' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-600/20 rounded-xl text-indigo-600 dark:text-indigo-500 text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {view === 'login' ? 'Sign in with email' : view === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {view === 'login' && (
            <>
              <button
                onClick={() => setView('forgot')}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors"
              >
                Forgot your password?
              </button>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Don't have an account?{' '}
                <button onClick={() => setView('signup')} className="text-indigo-600 hover:text-indigo-500 font-semibold transition-colors">
                  Start free trial
                </button>
              </p>
            </>
          )}
          {view === 'signup' && (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Already have an account?{' '}
              <button onClick={() => setView('login')} className="text-indigo-600 hover:text-indigo-500 font-semibold transition-colors">
                Sign in
              </button>
            </p>
          )}
          {view === 'forgot' && (
            <button
              onClick={() => setView('login')}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </button>
          )}
        </div>

        {view === 'signup' && (
          <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
            By signing up you agree to our{' '}
            <Link to="/terms" className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Privacy Policy</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
