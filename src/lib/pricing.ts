/** Single source of truth for Pro plan display + Stripe checkout. */

export const PRO_PRICE = 8.99;
export const PRO_PRICE_CENTS = 899;
export const PRO_PRICE_LABEL = '$8.99';
export const PRO_PRICE_PER_MO = '$8.99/mo';

/** Referrals at $1 credit each to offset the monthly plan. */
export const REFERRALS_TO_COVER_PLAN = 9;

/**
 * Stripe Price ID for Pro monthly ($8.99).
 * Set VITE_STRIPE_PRO_PRICE_ID (app) and STRIPE_PRICE_ID (edge functions)
 * to the live $8.99/mo price. Fallback is the current checkout price id.
 */
export const STRIPE_PRO_PRICE_ID =
  (import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string | undefined)?.trim() ||
  'price_1TZHhhIVv38UYFOXMXT2EV8v';
