import type { Profile } from './types';

export const PROFILE_CACHE_KEY = 'pinonit_profile_cache';
export const PROFILE_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

interface ProfileCacheEntry {
  data: Profile;
  timestamp: number;
}

export function readProfileCache(): Profile | null {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached) as ProfileCacheEntry;
    if (Date.now() - timestamp < PROFILE_CACHE_TTL) return data;
  } catch {
    // ignore corrupt cache
  }
  return null;
}

export function writeProfileCache(profile: Profile): void {
  try {
    localStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({ data: profile, timestamp: Date.now() } satisfies ProfileCacheEntry),
    );
  } catch {
    // ignore quota errors
  }
}

export function clearProfileCache(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore
  }
}
