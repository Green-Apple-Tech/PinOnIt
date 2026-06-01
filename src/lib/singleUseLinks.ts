/** Compute expires_at for a new single-use link from profile default_link_expiry_days. */
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
