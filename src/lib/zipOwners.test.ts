import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decideZipOwnersSync } from '../shared/zipOwners';

const base = {
  email: 'agent@example.com',
  subscriberId: 'zo_123',
  active: true,
  existingKind: null,
  paidSubscription: false,
  subscriberTaken: false,
} as const;

describe('Zip Owners grant', () => {
  it('grants Pro only for a verified active subscriber', () => {
    expect(decideZipOwnersSync(base)).toEqual({ ok: true, action: 'grant' });
    expect(decideZipOwnersSync({ ...base, active: false })).toEqual({ ok: true, action: 'end' });
  });

  it('replaces a local trial by granting, and does not stack a second offer', () => {
    expect(decideZipOwnersSync({ ...base, existingKind: 'zip_owners' })).toEqual({ ok: true, action: 'grant' });
  });

  it('leaves complimentary, creator, and paid Stripe subscriptions alone', () => {
    expect(decideZipOwnersSync({ ...base, existingKind: 'complimentary' }).ok).toBe(false);
    expect(decideZipOwnersSync({ ...base, existingKind: 'creator' })).toEqual({
      ok: false,
      reason: 'existing_grant',
    });
    expect(decideZipOwnersSync({ ...base, paidSubscription: true })).toEqual({
      ok: false,
      reason: 'paid_subscription',
    });
    expect(decideZipOwnersSync({ ...base, subscriberTaken: true })).toEqual({
      ok: false,
      reason: 'subscriber_taken',
    });
  });

  it('rejects a missing email or subscriber id', () => {
    expect(decideZipOwnersSync({ ...base, email: 'not-an-email' }).ok).toBe(false);
    expect(decideZipOwnersSync({ ...base, subscriberId: '  ' })).toEqual({
      ok: false,
      reason: 'invalid_subscriber',
    });
  });

  it('keeps the database rule from converting other grants or Stripe rows', () => {
    const sql = readFileSync(
      new URL('../../supabase/migrations/20261028170000_zip_owners_grant.sql', import.meta.url),
      'utf8',
    );
    expect(sql).toContain("'zip_owners'");
    expect(sql).toContain('existing_grant');
    expect(sql).toContain('paid_subscription');
    expect(sql).toContain('trial_source = \'zip_owners\'');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.sync_zip_owners_membership');
    expect(sql).not.toContain('stripe.subscriptions');
    const checkout = readFileSync(
      new URL('../../supabase/functions/stripe-checkout/index.ts', import.meta.url),
      'utf8',
    );
    expect(checkout).toContain("eq('kind', 'zip_owners')");
    expect(checkout).toContain('zip_owners_grant');
  });
});
