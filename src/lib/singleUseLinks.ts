export type LinkExpiryValue = '1_booking' | '24_hours' | '7_days' | '30_days';

export const LINK_EXPIRY_OPTIONS: { value: LinkExpiryValue; label: string }[] = [
  { value: '1_booking', label: '1 booking' },
  { value: '7_days', label: '7 days' },
  { value: '30_days', label: '30 days' },
];

export function linkExpiryToDays(expiry: string | null | undefined): number {
  switch (expiry) {
    case '24_hours': return 1;
    case '7_days': return 7;
    case '30_days': return 30;
    default: return 0;
  }
}

export function daysToLinkExpiry(days: number | null | undefined): LinkExpiryValue {
  if (days === 7) return '7_days';
  if (days === 30) return '30_days';
  return '1_booking';
}

export function resolveLinkExpiry(profile: {
  link_expiry?: string | null;
  default_link_expiry_days?: number | null;
}): LinkExpiryValue {
  if (
    profile.link_expiry &&
    profile.link_expiry !== '24_hours' &&
    LINK_EXPIRY_OPTIONS.some((o) => o.value === profile.link_expiry)
  ) {
    return profile.link_expiry as LinkExpiryValue;
  }
  return daysToLinkExpiry(profile.default_link_expiry_days);
}

export function isSingleUseLinksEnabled(profile: {
  single_use_links?: boolean | null;
  single_use_links_enabled?: boolean | null;
}): boolean {
  return profile.single_use_links ?? profile.single_use_links_enabled ?? false;
}

/** Compute expires_at for a new single-use link from profile expiry settings. */
export function computeSingleUseExpiresAt(expiryDays: number | null | undefined): string | null {
  if (expiryDays == null || expiryDays <= 0) return null;
  const d = new Date();
  if (expiryDays === 1) {
    d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
  } else {
    d.setDate(d.getDate() + expiryDays);
  }
  return d.toISOString();
}

export function computeSingleUseExpiresAtForProfile(profile: {
  link_expiry?: string | null;
  default_link_expiry_days?: number | null;
}): string | null {
  return computeSingleUseExpiresAt(linkExpiryToDays(resolveLinkExpiry(profile)));
}

export function formatSingleUseExpiryLabel(
  expiresAt: string | null,
  used: boolean,
): string {
  if (used) return 'Used';
  if (!expiresAt) return '1 use';
  const exp = new Date(expiresAt);
  if (exp < new Date()) return 'Expired';
  return `Expires ${exp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}

export function formatLinkExpiryHint(profile: {
  link_expiry?: string | null;
  default_link_expiry_days?: number | null;
}): string | null {
  const expiry = resolveLinkExpiry(profile);
  if (expiry === '1_booking') return null;
  if (expiry === '24_hours') return 'after 24 hours';
  if (expiry === '7_days') return 'after 7 days';
  if (expiry === '30_days') return 'after 30 days';
  return null;
}
