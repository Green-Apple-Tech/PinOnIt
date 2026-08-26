export type AlsoPerson = {
  id: string;
  name: string;
  email: string;
  phone: string;
  channels: string[];
  scope?: 'manual' | 'all' | 'services';
  service_ids?: string[];
};

export function parseAlsoPeople(raw: unknown): AlsoPerson[] {
  if (!Array.isArray(raw)) return [];
  const out: AlsoPerson[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const channels = Array.isArray(row.channels)
      ? (row.channels as string[]).filter((c) => c === 'email' || c === 'sms' || c === 'whatsapp')
      : [];
    const scopeRaw = row.scope;
    const scope =
      scopeRaw === 'manual' || scopeRaw === 'all' || scopeRaw === 'services' ? scopeRaw : 'all';
    const service_ids = Array.isArray(row.service_ids)
      ? (row.service_ids as string[]).filter((id) => typeof id === 'string' && id.length > 0)
      : [];
    out.push({
      id: typeof row.id === 'string' && row.id ? row.id : `p${out.length}`,
      name: String(row.name || '').trim() || 'there',
      email: String(row.email || '').trim(),
      phone: String(row.phone || '').trim(),
      channels,
      scope,
      service_ids,
    });
  }
  return out;
}

export function parseAlsoRemindIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function resolveAlsoPeople(
  roster: AlsoPerson[],
  opts?: { serviceId?: string | null; bookingAlsoIds?: unknown },
): AlsoPerson[] {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const out = new Map<string, AlsoPerson>();
  const serviceId = opts?.serviceId ?? null;
  const bookingIds = parseAlsoRemindIds(opts?.bookingAlsoIds);

  for (const p of roster) {
    const scope = p.scope ?? 'all';
    if (scope === 'all') {
      out.set(p.id, p);
    } else if (scope === 'services' && serviceId && p.service_ids?.includes(serviceId)) {
      out.set(p.id, p);
    }
  }

  for (const id of bookingIds) {
    const p = byId.get(id);
    if (p) out.set(p.id, p);
  }

  return [...out.values()];
}
