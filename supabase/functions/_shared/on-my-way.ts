/**
 * Keep in sync with src/lib/onMyWay.ts — SMS stays off until A2P samples are approved.
 */
export const ON_MY_WAY_SMS_ENABLED = false;

export const DEFAULT_ON_MY_WAY_TEMPLATE =
  '{{business_name}}: {{host_first_name}} is on the way — about {{eta}} minutes out.';

export const ON_MY_WAY_ETA_MIN = 1;
export const ON_MY_WAY_ETA_MAX = 180;

export function clampOnMyWayEta(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  if (n < ON_MY_WAY_ETA_MIN || n > ON_MY_WAY_ETA_MAX) return null;
  return n;
}

export function hostFirstName(fullName: string | null | undefined): string {
  const first = (fullName || '').trim().split(/\s+/)[0];
  return first || 'Your host';
}

export function renderOnMyWayMessage(opts: {
  template?: string | null;
  businessName: string;
  hostFirstName: string;
  eta: number;
}): string {
  const tpl = (opts.template || '').trim() || DEFAULT_ON_MY_WAY_TEMPLATE;
  return tpl
    .replaceAll('{{business_name}}', opts.businessName)
    .replaceAll('{{host_first_name}}', opts.hostFirstName)
    .replaceAll('{{eta}}', String(opts.eta));
}

export function bumpOnMyWayEtaUsage(
  usage: Record<string, number> | null | undefined,
  eta: number,
): Record<string, number> {
  const next = { ...(usage ?? {}) };
  next[String(eta)] = (Number(next[String(eta)]) || 0) + 1;
  return next;
}

export function pickDefaultOnMyWayEta(
  usage: Record<string, number> | null | undefined,
  lastUsed?: number | null,
): number {
  let bestEta = 0;
  let bestCount = 0;
  if (usage) {
    for (const [key, count] of Object.entries(usage)) {
      const eta = Number(key);
      if (!Number.isFinite(eta) || !Number.isFinite(count) || count <= 0) continue;
      if (count > bestCount || (count === bestCount && eta === lastUsed)) {
        bestCount = count;
        bestEta = eta;
      }
    }
  }
  if (bestEta >= ON_MY_WAY_ETA_MIN && bestEta <= ON_MY_WAY_ETA_MAX) return bestEta;
  if (lastUsed != null && lastUsed >= ON_MY_WAY_ETA_MIN && lastUsed <= ON_MY_WAY_ETA_MAX) return lastUsed;
  return 20;
}
