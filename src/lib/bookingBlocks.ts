export type BlockMatchType = 'email' | 'domain';
export type BlockReason = 'blocked' | 'spam';

export type BookingBlock = {
  id: string;
  host_id: string;
  match_type: BlockMatchType;
  value: string;
  reason: BlockReason;
  created_at: string;
};

export function parseBlockInput(raw: string): { matchType: BlockMatchType; value: string } | null {
  const v = raw.trim().toLowerCase().replace(/^mailto:/, '').replace(/\s+/g, '');
  if (!v) return null;
  if (v.startsWith('@') || !v.includes('@')) {
    const domain = v.replace(/^@+/, '').replace(/^\.+|\.+$/g, '');
    if (!domain.includes('.')) return null;
    return { matchType: 'domain', value: domain };
  }
  const at = v.lastIndexOf('@');
  const local = v.slice(0, at);
  const domain = v.slice(at + 1).replace(/^\.+|\.+$/g, '');
  if (!local || !domain || !domain.includes('.')) return null;
  return { matchType: 'email', value: `${local}@${domain}` };
}

export function guestEmailIsBlocked(
  email: string,
  blocks: { match_type: string; value: string }[],
): boolean {
  const e = email.trim().toLowerCase();
  if (!e.includes('@')) return false;
  const domain = e.slice(e.lastIndexOf('@') + 1);
  return blocks.some(
    (b) =>
      (b.match_type === 'email' && b.value === e) ||
      (b.match_type === 'domain' && b.value === domain),
  );
}
