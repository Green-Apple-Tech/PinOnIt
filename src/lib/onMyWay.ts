import { notifyViaIncludesSms } from './smsCompliance';
import { SMS_OPT_OUT_FOOTER } from './smsOptOut';

/**
 * Flip to true only after Twilio 10DLC campaign samples include the en-route
 * example AND the user confirms approval. Edge function has a matching gate.
 */
export const ON_MY_WAY_SMS_ENABLED = false;

export const ON_MY_WAY_ETA_OPTIONS = [10, 20, 30, 45] as const;
export const ON_MY_WAY_DEFAULT_ETA = 20;
export const ON_MY_WAY_ETA_MIN = 1;
export const ON_MY_WAY_ETA_MAX = 180;

export const DEFAULT_ON_MY_WAY_TEMPLATE =
  '{{business_name}}: {{host_first_name}} is on the way — about {{eta}} minutes out.';

/** File this exact line on the Twilio A2P campaign sample list. */
export const SMS_ON_MY_WAY_A2P_SAMPLE =
  'Acme Lawn Care: Alex is on the way — about 20 minutes out. Reply STOP to opt out.';

/** Public /sms-consent example (placeholder form, matches other samples). */
export const SMS_ON_MY_WAY_EXAMPLE =
  '[Business Name]: [Host first name] is on the way — about [ETA] minutes out. Reply STOP to opt out.';

export type OnMyWayEtaUsage = Record<string, number>;

export function clampOnMyWayEta(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  if (n < ON_MY_WAY_ETA_MIN || n > ON_MY_WAY_ETA_MAX) return null;
  return n;
}

export function pickDefaultOnMyWayEta(
  usage: OnMyWayEtaUsage | null | undefined,
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
  const fromUsage = clampOnMyWayEta(bestEta);
  if (fromUsage) return fromUsage;
  const fromLast = lastUsed != null ? clampOnMyWayEta(lastUsed) : null;
  return fromLast ?? ON_MY_WAY_DEFAULT_ETA;
}

export function bumpOnMyWayEtaUsage(
  usage: OnMyWayEtaUsage | null | undefined,
  eta: number,
): OnMyWayEtaUsage {
  const next = { ...(usage ?? {}) };
  next[String(eta)] = (Number(next[String(eta)]) || 0) + 1;
  return next;
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

export function onMyWaySmsBody(body: string): string {
  const trimmed = body.trim();
  if (/\breply\s+stop\b/i.test(trimmed)) return trimmed;
  const sep = /[.!?]$/.test(trimmed) ? ' ' : '. ';
  return `${trimmed}${sep}${SMS_OPT_OUT_FOOTER}`;
}

export function guestAllowsOnMyWaySms(booking: {
  guest_phone?: string | null;
  notify_via?: unknown;
}): boolean {
  const phone = booking.guest_phone?.trim();
  if (!phone) return false;
  return notifyViaIncludesSms(Array.isArray(booking.notify_via) ? booking.notify_via : null);
}

export function guestHasOnMyWayEmail(booking: {
  guest_email?: string | null;
}): boolean {
  return Boolean(booking.guest_email?.trim());
}

export function isOnMyWayEligibleStatus(status: string | null | undefined): boolean {
  return status === 'confirmed' || status === 'tentative' || status === 'pending_approval';
}
