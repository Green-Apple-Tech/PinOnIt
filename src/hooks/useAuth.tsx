import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { clearClientOnboardingState } from '../lib/onboardingState';
import type { User } from '@supabase/supabase-js';
import type { Profile, Subscription } from '../lib/types';

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
  const [profile, setProfile] = useState<Profile | null>(null);
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
      // Backfill email / full_name from the auth session if the profile row is missing them.
      // This happens with Microsoft OAuth when the provider doesn't return email in the
      // standard claim and the trigger stored a null/empty value.
      const patch: Record<string, string> = {};
      if (!data.email && authUser?.email) patch.email = authUser.email;
      if (!data.full_name && authUser?.user_metadata?.full_name) patch.full_name = authUser.user_metadata.full_name;
      if (!data.full_name && authUser?.user_metadata?.name) patch.full_name = authUser.user_metadata.name;

      if (Object.keys(patch).length > 0) {
        await supabase.from('profiles').update(patch).eq('id', userId);
        setProfile({ ...data, ...patch });
        return;
      }
    }

    setProfile(data);
  }, []);

  const fetchSubscription = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setSubscription(data);
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

  const signInWithGoogle = async (intendedPath?: string) => {
    if (intendedPath) localStorage.setItem('auth_redirect', intendedPath);
    const base = import.meta.env.VITE_APP_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${base}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    return { error: error?.message ?? null };
  };

  const signInWithMicrosoft = async (intendedPath?: string) => {
    if (intendedPath) localStorage.setItem('auth_redirect', intendedPath);
    const base = import.meta.env.VITE_APP_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${base}/auth/callback`,
        scopes: 'email profile openid User.Read',
        queryParams: { prompt: 'select_account' },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    clearClientOnboardingState();
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
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

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
