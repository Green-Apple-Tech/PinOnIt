export type CriticalAutoMatchType = 'email' | 'domain' | 'name';

export type CriticalAutoMatch = {
  type: CriticalAutoMatchType;
  value: string;
};

export function normalizeCriticalAutoMatches(raw: unknown): CriticalAutoMatch[] {
  if (!Array.isArray(raw)) return [];
  const out: CriticalAutoMatch[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const type = (item as { type?: string }).type;
    const value = String((item as { value?: string }).value ?? '').trim().toLowerCase();
    if (!value) continue;
    if (type !== 'email' && type !== 'domain' && type !== 'name') continue;
    out.push({ type, value: type === 'domain' ? value.replace(/^@+/, '') : value });
  }
  return out;
}

/** True when guest email/name matches a host’s auto-critical rules. */
export function bookingMatchesCriticalAuto(
  guestEmail: string | null | undefined,
  guestName: string | null | undefined,
  matches: CriticalAutoMatch[],
): boolean {
  if (!matches.length) return false;
  const email = (guestEmail ?? '').trim().toLowerCase();
  const name = (guestName ?? '').trim().toLowerCase();
  const domain = email.includes('@') ? email.slice(email.lastIndexOf('@') + 1) : '';

  return matches.some((m) => {
    if (m.type === 'email') return email === m.value;
    if (m.type === 'domain') return domain === m.value || domain.endsWith(`.${m.value}`);
    if (m.type === 'name') return name === m.value || name.includes(m.value);
    return false;
  });
}

export function parseCriticalAutoInput(raw: string): CriticalAutoMatch | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v.includes('@') && !v.startsWith('@')) {
    const at = v.lastIndexOf('@');
    if (at > 0 && v.slice(at + 1).includes('.')) return { type: 'email', value: v };
  }
  if (v.startsWith('@') || (!v.includes('@') && v.includes('.'))) {
    const domain = v.replace(/^@+/, '');
    if (domain.includes('.')) return { type: 'domain', value: domain };
  }
  if (v.length >= 2) return { type: 'name', value: v };
  return null;
}
