/** Single source of truth for Pro plan display + Stripe checkout. */

export const PRO_PRICE = 9.99;
export const PRO_PRICE_CENTS = 999;
export const PRO_PRICE_LABEL = '$9.99';
export const PRO_PRICE_PER_MO = '$9.99/mo';

/** Referrals at $1 credit each to offset the monthly plan. */
export const REFERRALS_TO_COVER_PLAN = 10;

/**
 * Checkout Price ID. Fallback is the existing $8.99 Price until the $9.99 Price is created
 * and saved here. Existing subscriptions stay on the old Price.
 * Set VITE_STRIPE_PRO_PRICE_ID (app) and STRIPE_PRICE_ID (edge functions) to the $9.99 Price.
 */
export const STRIPE_PRO_PRICE_ID =
  (import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string | undefined)?.trim() ||
  'price_1TZHhhIVv38UYFOXMXT2EV8v';
