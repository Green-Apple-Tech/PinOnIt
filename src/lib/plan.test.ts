import { describe, expect, it } from 'vitest';
import { effectivePlan, pickBestSubscription } from './plan';
import type { Subscription } from './types';

function row(partial: Partial<Subscription>): Subscription {
  return {
    id: '1',
    user_id: 'u',
    stripe_customer_id: 'cus_x',
    stripe_subscription_id: 'sub_x',
    stripe_price_id: 'price_x',
    stripe_current_period_end: null,
    status: 'active',
    plan: 'pro',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('effectivePlan', () => {
  it('uses paid subscription over a free profile', () => {
    expect(effectivePlan({ plan: 'pro', status: 'active' }, { plan: 'free' })).toBe('pro');
  });

  it('keeps Pro when canceled but still inside the paid period', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(
      effectivePlan({ plan: 'pro', status: 'canceled', stripe_current_period_end: future }, { plan: 'free' }),
    ).toBe('pro');
  });

  it('shows Free after a canceled period has ended', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      effectivePlan({ plan: 'pro', status: 'canceled', stripe_current_period_end: past }, { plan: 'pro' }),
    ).toBe('free');
  });

  it('falls back to profile.plan when there is no subscription row', () => {
    expect(effectivePlan(null, { plan: 'pro' })).toBe('pro');
  });

  it('keeps complimentary Pro even after a canceled Stripe period has ended', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      effectivePlan(
        { plan: 'pro', status: 'canceled', stripe_current_period_end: past },
        { plan: 'free', plan_override: 'pro' },
      ),
    ).toBe('pro');
  });
});

describe('pickBestSubscription', () => {
  it('prefers a real Stripe subscription over a local trial row', () => {
    const trial = row({
      id: 'trial',
      stripe_customer_id: 'trial_u',
      stripe_subscription_id: null,
      status: 'trialing',
      plan: 'pro',
      updated_at: '2026-08-14T12:00:00.000Z',
    });
    const paid = row({
      id: 'paid',
      stripe_customer_id: 'cus_paid',
      stripe_subscription_id: 'sub_paid',
      status: 'active',
      plan: 'pro',
      updated_at: '2026-08-01T00:00:00.000Z',
    });
    expect(pickBestSubscription([trial, paid])?.id).toBe('paid');
  });

  it('returns null for an empty list', () => {
    expect(pickBestSubscription([])).toBeNull();
  });
});
