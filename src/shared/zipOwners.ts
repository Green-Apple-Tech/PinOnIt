/** Zip Owners Pro is its own grant. It does not convert complimentary or creator rows. */

export const ZIP_OWNERS_KIND = 'zip_owners' as const;
export const ZIP_OWNERS_TOKEN_HEADER = 'x-zip-owners-token';

export type ZipOwnersGrantKind = 'complimentary' | 'creator' | 'zip_owners';

export type ZipOwnersDecision =
  | { ok: true; action: 'grant' | 'end' }
  | {
      ok: false;
      reason: 'invalid_email' | 'invalid_subscriber' | 'existing_grant' | 'paid_subscription' | 'subscriber_taken';
    };

export function normalizeZipOwnersEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

export function normalizeZipOwnersSubscriberId(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 80);
}

function emailLooksOk(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

/**
 * A verified Zip Owners subscriber gets Pro with no extra trial.
 * An email that already has a complimentary or creator grant is left alone.
 * A Stripe subscription, including a card trial, is left alone.
 */
export function decideZipOwnersSync(input: {
  email: unknown;
  subscriberId: unknown;
  active: boolean;
  existingKind: ZipOwnersGrantKind | null;
  paidSubscription: boolean;
  subscriberTaken: boolean;
}): ZipOwnersDecision {
  const email = normalizeZipOwnersEmail(input.email);
  const subscriberId = normalizeZipOwnersSubscriberId(input.subscriberId);
  if (!emailLooksOk(email)) return { ok: false, reason: 'invalid_email' };
  if (!subscriberId) return { ok: false, reason: 'invalid_subscriber' };
  if (input.paidSubscription) return { ok: false, reason: 'paid_subscription' };
  if (input.existingKind === 'complimentary' || input.existingKind === 'creator') {
    return { ok: false, reason: 'existing_grant' };
  }
  if (input.subscriberTaken) return { ok: false, reason: 'subscriber_taken' };
  return { ok: true, action: input.active ? 'grant' : 'end' };
}
