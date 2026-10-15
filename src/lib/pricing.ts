/** Single source of truth for Pro plan display + Stripe checkout. */

export const PRO_PRICE = 9.99;
export const PRO_PRICE_CENTS = 999;
export const PRO_PRICE_LABEL = '$9.99';
export const PRO_PRICE_PER_MO = '$9.99/mo';

/** $1 credits needed to offset the monthly plan. Applies only while customer referrals are still open. */
export const REFERRALS_TO_COVER_PLAN = 10;


/**
 * New Pro checkout Price: active, $9.99 USD, billed monthly.
 * Existing subscriptions stay on price_1TZHhhIVv38UYFOXMXT2EV8v.
 * VITE_STRIPE_PRO_PRICE_ID overrides this fallback when set.
 */
export const STRIPE_PRO_PRICE_ID =
  (import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string | undefined)?.trim() ||
  'price_1UBerwIVv38UYFOXg43WzEWL';
