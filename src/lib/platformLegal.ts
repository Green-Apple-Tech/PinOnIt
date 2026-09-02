import { supabase } from './supabase';

/** Bump when Terms/Privacy material terms change; stored on acceptance record. */
export const PLATFORM_TERMS_VERSION = '2026-09-02';

/** Records T&C acceptance; failures are logged but should not block signup or trial activation. */
export async function recordPlatformTermsAcceptance(userId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        platform_terms_accepted_at: new Date().toISOString(),
        platform_terms_version: PLATFORM_TERMS_VERSION,
      })
      .eq('id', userId);
    if (error) {
      console.warn('[platformLegal] Could not record terms acceptance:', error.message);
      return { error: error.message };
    }
    return { error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.warn('[platformLegal] Could not record terms acceptance:', message);
    return { error: message };
  }
}
