import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False in Bolt preview when env vars were not injected — do not throw or the page stays white. */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'public-anon-key',
  {
    auth: {
      flowType: 'pkce',
      // AuthCallback owns ?code= so we do not race a second PKCE exchange.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
