import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { clearClientOnboardingState } from '../lib/onboardingState';
import { readProfileCache, writeProfileCache, clearProfileCache } from '../lib/profileCache';
import { allocateUniqueSlug, slugFromEmail } from '../lib/profileSlug';
import type { User } from '@supabase/supabase-js';
import { pickBestSubscription } from '../lib/plan';
import type { Profile, Subscription } from '../lib/types';
import { persistSignupAttribution } from '../lib/campaignAttribution';
import { storageSet } from '../lib/safeStorage';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  subscription: Subscription | null;
  subscriptionLoaded: boolean;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (intendedPath?: string) => Promise<{ error: string | null }>;
  signInWithMicrosoft: (intendedPath?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => readProfileCache());
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data: sessionData } = await supabase.auth.getUser();
    const authUser = sessionData?.user;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      // Backfill missing profile fields after signup (OAuth gaps, pre-migration accounts).
      const patch: Record<string, string | boolean> = {};
      if (!data.email && authUser?.email) patch.email = authUser.email;
      if (!data.full_name && authUser?.user_metadata?.full_name) patch.full_name = authUser.user_metadata.full_name;
      if (!data.full_name && authUser?.user_metadata?.name) patch.full_name = authUser.user_metadata.name;

      const emailForSlug = authUser?.email ?? data.email;
      if (!data.slug && emailForSlug) {
        patch.slug = await allocateUniqueSlug(slugFromEmail(emailForSlug), userId);
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from('profiles').update(patch).eq('id', userId);
        const merged = { ...data, ...patch } as Profile;
        setProfile(merged);
        writeProfileCache(merged);
        void persistSignupAttribution(userId);
        return;
      }

      setProfile(data);
      writeProfileCache(data);
      void persistSignupAttribution(userId);
    } else {
      setProfile(null);
    }
  }, []);

  const fetchSubscription = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId);
    setSubscription(pickBestSubscription((data ?? []) as Subscription[]));
    setSubscriptionLoaded(true);
  }, []);

  useEffect(() => {
    let initialized = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchSubscription(session.user.id);
      } else {
        setProfile(null);
        clearProfileCache();
        setSubscription(null);
        setSubscriptionLoaded(true);
      }
      if (!initialized) {
        initialized = true;
        setLoading(false);
      }
    });

    // Fallback: if onAuthStateChange never fires (edge case), stop loading after a tick
    const fallback = setTimeout(() => {
      if (!initialized) {
        initialized = true;
        setLoading(false);
      }
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, [fetchProfile, fetchSubscription]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const startOAuthRedirect = async (
    provider: 'google' | 'azure',
    options: { redirectTo: string; scopes?: string; queryParams: Record<string, string> },
  ) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { ...options, skipBrowserRedirect: true },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: `Could not start ${provider === 'google' ? 'Google' : 'Microsoft'} sign-in. Try again.` };
    window.location.assign(data.url);
    return { error: null };
  };

  const signInWithGoogle = async (intendedPath?: string) => {
    if (intendedPath) storageSet('auth_redirect', intendedPath);
    const base = import.meta.env.VITE_APP_URL ?? window.location.origin;
    return startOAuthRedirect('google', {
      redirectTo: `${base}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    });
  };

  const signInWithMicrosoft = async (intendedPath?: string) => {
    if (intendedPath) storageSet('auth_redirect', intendedPath);
    const base = import.meta.env.VITE_APP_URL ?? window.location.origin;
    return startOAuthRedirect('azure', {
      redirectTo: `${base}/auth/callback`,
      scopes: 'email profile openid User.Read',
      queryParams: { prompt: 'select_account' },
    });
  };

  const signOut = async () => {
    clearClientOnboardingState();
    clearProfileCache();
    localStorage.removeItem('pinonit_last_activity');
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await Promise.all([fetchProfile(user.id), fetchSubscription(user.id)]);
  }, [user, fetchProfile, fetchSubscription]);

  return (
    <AuthContext.Provider value={{ user, profile, subscription, subscriptionLoaded, loading, signUp, signIn, signInWithGoogle, signInWithMicrosoft, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
