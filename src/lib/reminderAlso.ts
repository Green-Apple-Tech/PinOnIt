export type AlsoChannel = 'email' | 'sms' | 'whatsapp';

/** Who gets automatic copies vs only when picked for a meeting. */
export type AlsoScope = 'manual' | 'all' | 'services';

export type AlsoPerson = {
  id: string;
  name: string;
  email: string;
  phone: string;
  channels: AlsoChannel[];
  /** manual = only when added on a booking; all = every booking; services = listed event types */
  scope?: AlsoScope;
  service_ids?: string[];
};

export const ALSO_SCOPE_OPTIONS: { id: AlsoScope; label: string; hint: string }[] = [
  {
    id: 'manual',
    label: 'Only meetings I pick',
    hint: 'On Calendar, open the event (bell icon) and check their name.',
  },
  {
    id: 'all',
    label: 'Every booking',
    hint: 'They get a copy for all PinOnIt bookings automatically.',
  },
  {
    id: 'services',
    label: 'Specific event types',
    hint: 'Only for the event types you choose below.',
  },
];

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
    scope: 'manual',
    service_ids: [],
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
    const scopeRaw = row.scope;
    const scope: AlsoScope =
      scopeRaw === 'manual' || scopeRaw === 'all' || scopeRaw === 'services'
        ? scopeRaw
        : 'all'; // legacy rows without scope kept on every booking
    const service_ids = Array.isArray(row.service_ids)
      ? (row.service_ids as string[]).filter((id) => typeof id === 'string' && id.length > 0)
      : [];
    out.push({
      id: typeof row.id === 'string' && row.id ? row.id : crypto.randomUUID(),
      name: String(row.name || '').trim(),
      email: String(row.email || '').trim(),
      phone: String(row.phone || '').trim(),
      channels: channels.length ? channels : ['email'],
      scope,
      service_ids,
    });
    if (out.length >= 8) break;
  }
  return out;
}

export function parseAlsoRemindIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** Resolve which roster people receive copies for a booking (or host-only personal reminder). */
export function resolveAlsoPeople(
  roster: AlsoPerson[],
  opts?: { serviceId?: string | null; bookingAlsoIds?: string[] | null },
): AlsoPerson[] {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const out = new Map<string, AlsoPerson>();
  const serviceId = opts?.serviceId ?? null;

  for (const p of roster) {
    const scope = p.scope ?? 'all';
    if (scope === 'all') {
      out.set(p.id, p);
    } else if (scope === 'services' && serviceId && p.service_ids?.includes(serviceId)) {
      out.set(p.id, p);
    }
  }

  for (const id of parseAlsoRemindIds(opts?.bookingAlsoIds)) {
    const p = byId.get(id);
    if (p) out.set(p.id, p);
  }

  return [...out.values()];
}

export function alsoPersonIsReady(p: AlsoPerson): boolean {
  if (!p.name.trim()) return false;
  if (p.channels.includes('email') && !p.email.trim()) return false;
  if ((p.channels.includes('sms') || p.channels.includes('whatsapp')) && !p.phone.trim()) {
    return false;
  }
  if (p.scope === 'services' && (!p.service_ids || p.service_ids.length === 0)) return false;
  return p.channels.length > 0;
}
