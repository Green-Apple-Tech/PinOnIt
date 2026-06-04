import { supabase } from './supabase';

/** Derive a URL-safe slug prefix from an email address. */
export function slugFromEmail(email: string): string {
  const prefix = email.split('@')[0] ?? '';
  return prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Pick a unique profiles.slug, appending a number when the base is taken. */
export async function allocateUniqueSlug(base: string, userId?: string): Promise<string> {
  const normalized =
    base.length >= 3 ? base : `user-${(userId ?? 'new').replace(/-/g, '').slice(0, 8)}`;

  for (let attempt = 0; attempt < 100; attempt++) {
    const slug = attempt === 0 ? normalized : `${normalized}${attempt}`;
    const { data } = await supabase.from('profiles').select('id').eq('slug', slug).maybeSingle();
    if (!data || (userId && data.id === userId)) return slug;
  }

  return `${normalized}-${Date.now()}`;
}
