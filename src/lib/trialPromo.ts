import { storageGet, storageSet } from './safeStorage';
import { normalizePromoCode } from '../shared/trialPromo';

export {
  DEFAULT_TRIAL_DAYS,
  MAX_CHECKOUT_TRIAL_DAYS,
  TRIAL_PROMO_DAYS,
  checkoutTrialFields,
  normalizePromoCode,
  resolveCheckoutTrial,
  shareableTrialSignupUrl,
  trialDaysForPromo,
  type ResolvedCheckoutTrial,
  type TrialPromoCode,
} from '../shared/trialPromo';

const STORAGE_KEY = 'pinonit_trial_promo';

/** Remember `?promo=` so checkout can send the code after signup. Later pages do not clear it. */
export function captureTrialPromo(search: string): string | null {
  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const fromQuery = normalizePromoCode(sp.get('promo'));
  if (fromQuery) {
    storageSet(STORAGE_KEY, fromQuery);
    return fromQuery;
  }
  return readTrialPromo();
}

export function readTrialPromo(): string | null {
  const stored = normalizePromoCode(storageGet(STORAGE_KEY));
  return stored || null;
}
