/** Server-side trial lengths for shareable signup links. */
export const DEFAULT_TRIAL_DAYS = 14;
export const MAX_CHECKOUT_TRIAL_DAYS = 90;

/** FREE60 is a 60-day card trial. SWITCH is 90 days for people replacing both Calendly and DocuSign. */
export const TRIAL_PROMO_DAYS = {
  FREE60: 60,
  SWITCH: 90,
} as const;

export type TrialPromoCode = keyof typeof TRIAL_PROMO_DAYS;

export type ResolvedCheckoutTrial = {
  days: number;
  /** Present when the request included a promo code. Days came from the code table, not the client. */
  promo: string | null;
};

export function normalizePromoCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
}

/** Known codes map to their days. Any other non-empty code is the default 14-day trial. */
export function trialDaysForPromo(code: unknown): number {
  const promo = normalizePromoCode(code);
  if (promo === 'FREE60') return TRIAL_PROMO_DAYS.FREE60;
  if (promo === 'SWITCH') return TRIAL_PROMO_DAYS.SWITCH;
  return DEFAULT_TRIAL_DAYS;
}

/**
 * A promo code decides the trial. `trial_period_days` is ignored whenever a code is present,
 * including unknown codes (those fall back to 14). With no code, the requested days are
 * clamped to 0..90.
 */
export function resolveCheckoutTrial(input: {
  promo?: unknown;
  trial_period_days?: unknown;
}): ResolvedCheckoutTrial {
  const promo = normalizePromoCode(input.promo);
  if (promo) return { days: trialDaysForPromo(promo), promo };

  const raw = input.trial_period_days;
  const requested = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && raw.trim() !== ''
      ? Number(raw)
      : 0;
  if (!Number.isFinite(requested) || requested <= 0) return { days: 0, promo: null };
  return {
    days: Math.min(MAX_CHECKOUT_TRIAL_DAYS, Math.max(0, Math.floor(requested))),
    promo: null,
  };
}

/** Checkout body fields. A stored code is sent alone so the server, not the client, picks the days. */
export function checkoutTrialFields(input: {
  promo?: string | null;
  trialPeriodDays?: number | null;
}): { promo?: string; trial_period_days?: number } {
  const promo = normalizePromoCode(input.promo);
  if (promo) return { promo };
  const days = Number(input.trialPeriodDays);
  if (!Number.isFinite(days) || days <= 0) return {};
  return { trial_period_days: Math.min(MAX_CHECKOUT_TRIAL_DAYS, Math.floor(days)) };
}

export function shareableTrialSignupUrl(
  code: TrialPromoCode,
  origin = 'https://pinonit.com',
): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/signup?promo=${code}`;
}
