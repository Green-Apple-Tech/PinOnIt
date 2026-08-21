export type AlsoChannel = 'email' | 'sms' | 'whatsapp';

export type AlsoPerson = {
  id: string;
  name: string;
  email: string;
  phone: string;
  channels: AlsoChannel[];
};

export const ALSO_CHANNEL_OPTIONS: { id: AlsoChannel; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

export function newAlsoPerson(): AlsoPerson {
  return {
    id: crypto.randomUUID(),
    name: '',
    email: '',
    phone: '',
    channels: ['email'],
  };
}

export function normalizeAlsoPeople(raw: unknown): AlsoPerson[] {
  if (!Array.isArray(raw)) return [];
  const out: AlsoPerson[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const channels = Array.isArray(row.channels)
      ? (row.channels as string[]).filter((c): c is AlsoChannel =>
          c === 'email' || c === 'sms' || c === 'whatsapp',
        )
      : [];
    out.push({
      id: typeof row.id === 'string' && row.id ? row.id : crypto.randomUUID(),
      name: String(row.name || '').trim(),
      email: String(row.email || '').trim(),
      phone: String(row.phone || '').trim(),
      channels: channels.length ? channels : ['email'],
    });
    if (out.length >= 8) break;
  }
  return out;
}

export function alsoPersonIsReady(p: AlsoPerson): boolean {
  if (!p.name.trim()) return false;
  if (p.channels.includes('email') && !p.email.trim()) return false;
  if ((p.channels.includes('sms') || p.channels.includes('whatsapp')) && !p.phone.trim()) {
    return false;
  }
  return p.channels.length > 0;
}
