import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False in Bolt preview when env vars were not injected — do not throw or the page stays white. */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const supabaseAuth = {
  flowType: 'pkce' as const,
  // AuthCallback owns ?code= so we do not race a second PKCE exchange.
  detectSessionInUrl: false,
};

export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'public-anon-key',
  {
    auth: {
      ...supabaseAuth,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

/**
 * Public booking reads. A logged-in browser still has a session in `supabase`;
 * an expired token makes those reads 401 and the page stays blank. This client
 * never sends that token.
 */
export const publicReadSupabase = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'public-anon-key',
  {
    auth: {
      ...supabaseAuth,
      persistSession: false,
      autoRefreshToken: false,
      storageKey: 'pinonit-public-read',
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  },
);
